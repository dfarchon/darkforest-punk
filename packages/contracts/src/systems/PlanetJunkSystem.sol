// SPDX-License-Identifier: GPL-3.0Add commentMore actions
pragma solidity >=0.8.24;

import { BaseSystem } from "systems/internal/BaseSystem.sol";
import { Planet, PlanetLib } from "libraries/Planet.sol";
import { PlanetType, Biome, MaterialType, SpaceType } from "codegen/common.sol";
import { JunkConfig } from "codegen/tables/JunkConfig.sol";
import { PlanetBiomeConfig, PlanetBiomeConfigData } from "codegen/tables/PlanetBiomeConfig.sol";
import { PlayerJunk } from "codegen/tables/PlayerJunk.sol";
import { PlayerJunkLimit } from "codegen/tables/PlayerJunkLimit.sol";
import { GlobalStats } from "codegen/tables/GlobalStats.sol";
import { PlayerStats } from "codegen/tables/PlayerStats.sol";
import { DFUtils } from "libraries/DFUtils.sol";
import { Proof } from "libraries/SnarkProof.sol";
import { BiomebaseInput } from "libraries/VerificationInput.sol";
import { SnarkConfig, SnarkConfigData } from "codegen/tables/SnarkConfig.sol";
import { Player } from "codegen/tables/Player.sol";

contract PlanetJunkSystem is BaseSystem {
  modifier requireSpaceJunkEnabled() {
    bool SPACE_JUNK_ENABLED = JunkConfig.getSPACE_JUNK_ENABLED();
    if (!SPACE_JUNK_ENABLED) revert SpaceJunkDisabled();
    _;
  }

  /**
   * @notice add junk to player
   * @param planetHash Planet hash
   * @param biomeBase Biome base value for verification
   * @param proof ZK proof for biome base verification
   */
  function addJunk(uint256 planetHash, uint256 biomeBase, Proof memory proof) public entryFee requireSpaceJunkEnabled {
    _updateStats();
    _processAddJunk(planetHash, biomeBase, proof);
  }

  function _updateStats() internal {
    GlobalStats.setAddJunkCount(GlobalStats.getAddJunkCount() + 1);
    PlayerStats.setAddJunkCount(_msgSender(), PlayerStats.getAddJunkCount(_msgSender()) + 1);
  }

  function _processAddJunk(uint256 planetHash, uint256 biomeBase, Proof memory proof) internal {
    address worldAddress = _world();
    DFUtils.tick(worldAddress);

    Planet memory planet = DFUtils.readInitedPlanet(worldAddress, planetHash);
    address executor = _msgSender();

    _validateAddJunk(planet, executor);
    _executeAddJunk(planet, executor, biomeBase, proof);
  }

  function _validateAddJunk(Planet memory planet, address executor) internal view {
    uint256[] memory PLANET_LEVEL_JUNK = JunkConfig.getPLANET_LEVEL_JUNK();
    uint256 planetJunk = PLANET_LEVEL_JUNK[planet.level];
    uint256 playerJunk = PlayerJunk.get(executor);
    uint256 playerJunkLimit = PlayerJunkLimit.get(executor);

    if (planet.owner != executor) revert NotPlanetOwner();
    if (playerJunk + planetJunk > playerJunkLimit) revert JunkLimitExceeded();
  }

  function _executeAddJunk(Planet memory planet, address executor, uint256 biomeBase, Proof memory proof) internal {
    bool isFirstTime = planet.addJunkTick == 0;
    _updateJunkOwnership(planet, executor);
    _verifyBiomeProof(planet, biomeBase, proof);
    if (isFirstTime) {
      _initAsteroidMaterials(planet, biomeBase);
    }
    planet.writeToStore();
  }

  function _updateJunkOwnership(Planet memory planet, address executor) internal {
    uint256[] memory PLANET_LEVEL_JUNK = JunkConfig.getPLANET_LEVEL_JUNK();
    uint256 planetJunk = PLANET_LEVEL_JUNK[planet.level];

    address oldPlanetJunkOwner = planet.junkOwner;
    if (oldPlanetJunkOwner != address(0)) {
      uint256 oldOwnerJunk = PlayerJunk.get(oldPlanetJunkOwner);
      PlayerJunk.set(oldPlanetJunkOwner, oldOwnerJunk - planetJunk);
    }

    planet.junkOwner = executor;
    planet.addJunkTick = DFUtils.getCurrentTick();
    uint256 playerJunk = PlayerJunk.get(executor);
    PlayerJunk.set(executor, playerJunk + planetJunk);
  }

  function _verifyBiomeProof(Planet memory planet, uint256 biomeBase, Proof memory proof) internal {
    BiomebaseInput memory input;
    input.planetHash = planet.planetHash;
    input.biomebase = biomeBase;

    SnarkConfigData memory config = SnarkConfig.get();
    input.mimcHashKey = config.planetHashKey;
    input.biomebaseKey = config.biomeBaseKey;
    input.perlinLengthScale = config.perlinLengthScale;
    input.perlinMirrorX = config.perlinMirrorX;
    input.perlinMirrorY = config.perlinMirrorY;

    DFUtils.verify(_world(), proof, input);
  }

  function _initAsteroidMaterials(Planet memory planet, uint256 biomeBase) internal view {
    if (planet.planetType == PlanetType.ASTEROID_FIELD) {
      Biome biome = planet._getBiome(biomeBase);
      MaterialType[] memory allowed = PlanetLib.allowedMaterialsForBiome(biome);
      for (uint256 i; i < allowed.length; i++) {
        planet.initMaterial(allowed[i]);
      }
    } else if (planet.planetType == PlanetType.SUN) {
      // Initialize SOLAR_ENERGY for SUN planets
      MaterialType[] memory allowed = PlanetLib.allowedMaterialsForPlanetType(planet.planetType);
      for (uint256 i; i < allowed.length; i++) {
        planet.initMaterial(allowed[i]);
      }
    }
  }

  /**
   * @notice clear junk
   * @param planetHash Planet hash
   */
  function clearJunk(uint256 planetHash) public entryFee requireSpaceJunkEnabled {
    GlobalStats.setClearJunkCount(GlobalStats.getClearJunkCount() + 1);
    PlayerStats.setClearJunkCount(_msgSender(), PlayerStats.getClearJunkCount(_msgSender()) + 1);

    address worldAddress = _world();
    DFUtils.tick(worldAddress);

    Planet memory planet = DFUtils.readInitedPlanet(worldAddress, planetHash);
    address executor = _msgSender();

    uint256[] memory PLANET_LEVEL_JUNK = JunkConfig.getPLANET_LEVEL_JUNK();

    if (planet.junkOwner != executor) revert NotJunkOwner();

    uint256 planetJunk = PLANET_LEVEL_JUNK[planet.level];
    uint256 playerJunk = PlayerJunk.get(executor);

    PlayerJunk.set(planet.junkOwner, (playerJunk - planetJunk));
    planet.junkOwner = address(0);

    if (planet.owner == executor) {
      planet.changeOwner(address(0));
    }

    planet.writeToStore();
  }

  function getBuyJunkFee(uint amount) internal returns (uint) {
    uint SPACE_JUNK_FREE_ALLOCATION = JunkConfig.getSPACE_JUNK_FREE_ALLOCATION();

    uint SPACE_JUNK_LINEAR_MIN_PURCHASE = JunkConfig.getSPACE_JUNK_LINEAR_MIN_PURCHASE();

    uint SPACE_JUNK_LINEAR_MAX_PURCHASE = JunkConfig.getSPACE_JUNK_LINEAR_MAX_PURCHASE();

    uint SPACE_JUNK_LINEAR_BASE_PRICE = JunkConfig.getSPACE_JUNK_LINEAR_BASE_PRICE();

    uint SPACE_JUNK_QUADRATIC_MIN_PURCHASE = JunkConfig.getSPACE_JUNK_QUADRATIC_MIN_PURCHASE();

    uint SPACE_JUNK_QUADRATIC_BASE_PRICE = JunkConfig.getSPACE_JUNK_QUADRATIC_BASE_PRICE();

    uint fee = 0;
    if (amount <= SPACE_JUNK_FREE_ALLOCATION) fee = 0;
    else if (amount <= SPACE_JUNK_LINEAR_MAX_PURCHASE) {
      fee += (amount - SPACE_JUNK_LINEAR_MIN_PURCHASE + 1) * SPACE_JUNK_LINEAR_BASE_PRICE;
    } else if (amount >= SPACE_JUNK_QUADRATIC_MIN_PURCHASE) {
      fee += (SPACE_JUNK_LINEAR_MAX_PURCHASE - SPACE_JUNK_LINEAR_MIN_PURCHASE + 1) * SPACE_JUNK_LINEAR_BASE_PRICE;
      uint t = (amount - SPACE_JUNK_QUADRATIC_MIN_PURCHASE + 1);
      fee += t * t * SPACE_JUNK_QUADRATIC_BASE_PRICE;
    }
    return fee;
  }

  function buyJunk(uint amount) public payable requireSpaceJunkEnabled {
    address worldAddress = _world();
    DFUtils.tick(worldAddress);
    address executor = _msgSender();

    if (Player.getIndex(executor) == 0) {
      revert NotRegistered();
    }

    uint playerJunkLimit = PlayerJunkLimit.get(executor);
    uint preAmount = playerJunkLimit / 1000;
    if (amount < preAmount) {
      revert NeedBuyMore();
    }

    uint SPACE_JUNK_QUADRATIC_MAX_PURCHASE = JunkConfig.getSPACE_JUNK_QUADRATIC_MAX_PURCHASE();

    if (amount > SPACE_JUNK_QUADRATIC_MAX_PURCHASE) {
      revert NeedBuyLess();
    }

    uint fee = getBuyJunkFee(amount) - getBuyJunkFee(preAmount);

    if (_msgValue() < fee) {
      revert NeedFundsToBuySpaceJunk();
    }

    PlayerJunkLimit.set(executor, amount * 1000);
  }
}
