// SPDX-License-Identifier: GPL-3.0
pragma solidity >=0.8.24;

import { BaseSystem } from "systems/internal/BaseSystem.sol";
import { Planet, PlanetLib } from "libraries/Planet.sol";
import { DFUtils } from "libraries/DFUtils.sol";
import { UniverseLib } from "libraries/Universe.sol";
import { PlanetType, SpaceType, MaterialType } from "codegen/common.sol";
import { PlanetConstants, PlanetConstantsData } from "codegen/tables/PlanetConstants.sol";
import { PlanetOwner } from "codegen/tables/PlanetOwner.sol";
import { Ticker } from "codegen/tables/Ticker.sol";
import { LastReveal } from "codegen/tables/LastReveal.sol";
import { TempConfigSet } from "codegen/tables/TempConfigSet.sol";
import { RevealedPlanet } from "codegen/tables/RevealedPlanet.sol";
import { GlobalStats } from "codegen/tables/GlobalStats.sol";
import { PlayerStats } from "codegen/tables/PlayerStats.sol";
import { Player } from "codegen/tables/Player.sol";
import { Planet as PlanetTable } from "codegen/tables/Planet.sol";
import { PlanetJunkOwner } from "codegen/tables/PlanetJunkOwner.sol";
import { PlayerJunk } from "codegen/tables/PlayerJunk.sol";
import { JunkConfig } from "codegen/tables/JunkConfig.sol";
import { PlanetInitialResource, PlanetInitialResourceData } from "codegen/tables/PlanetInitialResource.sol";
import { StarbaseType } from "codegen/tables/StarbaseType.sol";
import { StarbasePlanet } from "codegen/tables/StarbasePlanet.sol";
import { Errors } from "interfaces/errors.sol";

contract StarbaseSystem is BaseSystem {
  // Note: StarbaseType is tracked only in MUD tables (StarbaseType table in mud.config.ts)
  // The contract does not manage starbase types - this is handled client-side via MUD

  uint256 private constant CONTRACT_PRECISION = 1000;

  function createStarBase(
    uint256 sourcePlanetHash,
    uint256 starbaseHash,
    address owner,
    uint8 perlin,
    uint8 level,
    SpaceType spaceType,
    uint8 starbaseType,
    int256 x,
    int256 y,
    uint256 distance
  ) public entryFee {
    DFUtils.tick(_world());

    // Mirror reveal cooldown check so create+reveal can't diverge (inline to avoid stack-too-deep)
    if (
      !(LastReveal.get(owner) == 0 || LastReveal.get(owner) + TempConfigSet.getRevealSBCd() <= Ticker.getTickNumber())
    ) {
      revert RevealStarBaseTooOften();
    }

    _createAndRevealStarbase(
      sourcePlanetHash,
      starbaseHash,
      owner,
      perlin,
      level,
      spaceType,
      starbaseType,
      x,
      y,
      distance
    );
  }

  function _createAndRevealStarbase(
    uint256 sourcePlanetHash,
    uint256 starbaseHash,
    address owner,
    uint8 perlin,
    uint8 level,
    SpaceType spaceType,
    uint8 starbaseType,
    int256 x,
    int256 y,
    uint256 distance
  ) internal {
    // Validate and get source planet
    Planet memory sourcePlanet = _validateAndGetSourcePlanet(_world(), sourcePlanetHash);

    // Validate hash doesn't already exist
    if (_planetExists(starbaseHash)) revert Errors.InvalidPlanetHash();

    // Validate starbase type (0=Default, 1=Research, 2=Trade)
    require(starbaseType <= 2, "Invalid starbase type");

    // Validate distance: starbase must be within 50% of source planet's max range
    _validateStarbaseDistance(sourcePlanet, starbaseHash, distance);

    // Create the starbase (same pattern as createPlanet in TestOnlySystem)
    _createStarbaseEntity(sourcePlanetHash, starbaseHash, owner, perlin, level, spaceType, starbaseType);

    // Consume materials from source planet
    _consumeMaterials(sourcePlanet);
    // Atomically reveal the starbase coordinates (mirror PlanetRevealSystem.revealStarbase)
    // Update stats
    GlobalStats.setRevealLocationCount(GlobalStats.getRevealLocationCount() + 1);
    PlayerStats.setRevealLocationCount(owner, PlayerStats.getRevealLocationCount(owner) + 1);
    // Set revealed planet
    RevealedPlanet.set(bytes32(starbaseHash), int32(x), int32(y), owner);
    // Read and write planet to ensure it's synced
    uint256 starbaseDistanceSquared = uint256(x * x + y * y);
    Planet memory revealed = DFUtils.readAnyPlanet(_world(), starbaseHash, perlin, starbaseDistanceSquared);
    revealed.writeToStore();

    // Write source planet to store
    sourcePlanet.writeToStore();
  }

  function _validateStarbaseDistance(Planet memory sourcePlanet, uint256 starbaseHash, uint256 distance) internal view {
    // Create temporary Planet struct for UniverseLib distance calculation
    Planet memory tempStarbase;
    tempStarbase.planetHash = starbaseHash;
    tempStarbase.planetType = PlanetType.STARBASE;

    // Calculate distance using UniverseLib (applies multipliers for quasars, distance multipliers, etc.)
    uint256 adjustedDistance = UniverseLib.distance(sourcePlanet, tempStarbase, distance);

    // Check if distance exceeds 50% of source planet's range
    // Using fixed-point math: range * 0.5 = range * 500 / 1000
    uint256 maxAllowedDistance = (sourcePlanet.range * 500) / 1000;
    if (adjustedDistance > maxAllowedDistance) {
      revert Errors.StarbaseTooFarFromSource();
    }
  }

  function _validateAndGetSourcePlanet(
    address worldAddress,
    uint256 sourcePlanetHash
  ) internal view returns (Planet memory) {
    Planet memory sourcePlanet = DFUtils.readInitedPlanet(worldAddress, sourcePlanetHash);
    if (sourcePlanet.planetType != PlanetType.PLANET) revert Errors.InvalidPlanetType();
    if (sourcePlanet.level < 4) revert Errors.PlanetLevelTooLow();
    if (sourcePlanet.owner != _msgSender()) revert Errors.NotPlanetOwner();
    if (!_hasDefaultStarbaseMaterials(sourcePlanet)) revert Errors.NotEnoughMaterial();

    // Check if this planet already has a starbase (prevent multiple starbases from same planet)
    bytes32 existingStarbaseHash = StarbasePlanet.get(bytes32(sourcePlanetHash));
    if (existingStarbaseHash != bytes32(0)) {
      revert Errors.PlanetAlreadyHasStarbase();
    }

    return sourcePlanet;
  }

  function _createStarbaseEntity(
    uint256 sourcePlanetHash,
    uint256 starbaseHash,
    address owner,
    uint8 perlin,
    uint8 level,
    SpaceType spaceType,
    uint8 starbaseType
  ) internal {
    address worldAddress = _world();

    // Create starbase constants (same pattern as createPlanet in TestOnlySystem)
    PlanetConstants.set(bytes32(starbaseHash), perlin, level, PlanetType.STARBASE, spaceType);
    PlanetOwner.set(bytes32(starbaseHash), owner);

    // Get initial population from PlanetInitialResource (same as procedural planets)
    // This ensures starbases start with the correct initial population for their level and spaceType
    PlanetInitialResourceData memory initialResources = PlanetInitialResource.get(
      spaceType,
      PlanetType.STARBASE,
      level
    );

    // Initialize planet state with initial population from PlanetInitialResource
    PlanetTable.set(
      bytes32(starbaseHash),
      Ticker.getTickNumber(),
      initialResources.population,
      0, // Silver starts at 0 (starbases don't generate silver)
      0, // No upgrades initially
      false // useProps = false (use metadata, not props)
    );

    // Track the inputted starbase type (0=Default, 1=Research, 2=Trade)
    StarbaseType.set(bytes32(starbaseHash), starbaseType);

    // Track which planet this starbase was crafted from (prevents multiple starbases from same planet)
    StarbasePlanet.set(bytes32(sourcePlanetHash), bytes32(starbaseHash));

    // This will sync the planet to the current tick and ensure all internal structures are initialized
    Planet memory planet = DFUtils.readInitedPlanet(worldAddress, starbaseHash);
    planet.writeToStore();
  }

  function _hasDefaultStarbaseMaterials(Planet memory sourcePlanet) internal view returns (bool) {
    // Default Starbase material requirements:
    // WINDSTEEL: 500, SCRAPIUM: 400, PYROSTEEL: 300
    return
      sourcePlanet.getMaterial(MaterialType.WINDSTEEL) >= 500 * CONTRACT_PRECISION &&
      sourcePlanet.getMaterial(MaterialType.SCRAPIUM) >= 400 * CONTRACT_PRECISION &&
      sourcePlanet.getMaterial(MaterialType.PYROSTEEL) >= 300 * CONTRACT_PRECISION;
  }

  function _consumeMaterials(Planet memory sourcePlanet) internal {
    // Consume materials from source planet
    uint256 windsteelAmount = sourcePlanet.getMaterial(MaterialType.WINDSTEEL);
    uint256 scrapiumAmount = sourcePlanet.getMaterial(MaterialType.SCRAPIUM);
    uint256 pyrosteelAmount = sourcePlanet.getMaterial(MaterialType.PYROSTEEL);

    require(windsteelAmount >= 500 * CONTRACT_PRECISION, "Insufficient WINDSTEEL");
    require(scrapiumAmount >= 400 * CONTRACT_PRECISION, "Insufficient SCRAPIUM");
    require(pyrosteelAmount >= 300 * CONTRACT_PRECISION, "Insufficient PYROSTEEL");

    sourcePlanet.setMaterial(MaterialType.WINDSTEEL, windsteelAmount - 500 * CONTRACT_PRECISION);
    sourcePlanet.setMaterial(MaterialType.SCRAPIUM, scrapiumAmount - 400 * CONTRACT_PRECISION);
    sourcePlanet.setMaterial(MaterialType.PYROSTEEL, pyrosteelAmount - 300 * CONTRACT_PRECISION);
  }

  function _planetExists(uint256 planetHash) internal view returns (bool) {
    // Check if planet already exists in PlanetConstants table
    PlanetConstantsData memory constants = PlanetConstants.get(bytes32(planetHash));
    return constants.planetType != PlanetType.UNKNOWN;
  }
}
