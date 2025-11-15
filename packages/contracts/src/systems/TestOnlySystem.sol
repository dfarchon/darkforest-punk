// SPDX-License-Identifier: GPL-3.0
pragma solidity >=0.8.24;

import { BaseSystem } from "systems/internal/BaseSystem.sol";
import { Biome, PlanetType, SpaceType, PlanetStatus, MaterialType } from "codegen/common.sol";
import { Planet as PlanetTable } from "codegen/tables/Planet.sol";
import { PlanetOwner } from "codegen/tables/PlanetOwner.sol";
import { PlanetJunkOwner } from "codegen/tables/PlanetJunkOwner.sol";
import { PlanetConstants } from "codegen/tables/PlanetConstants.sol";
import { Ticker } from "codegen/tables/Ticker.sol";
import { RevealedPlanet } from "codegen/tables/RevealedPlanet.sol";
import { Planet, PlanetLib } from "libraries/Planet.sol";
import { Proof } from "libraries/SnarkProof.sol";
import { SpawnInput } from "libraries/VerificationInput.sol";
import { DFUtils } from "libraries/DFUtils.sol";
import { GPTTokens } from "codegen/index.sol";
import { JunkConfig } from "codegen/tables/JunkConfig.sol";
import { PlayerJunk } from "codegen/tables/PlayerJunk.sol";
import { PlanetBiomeConfig, PlanetBiomeConfigData } from "codegen/tables/PlanetBiomeConfig.sol";
import { PlanetMaterialStorage } from "codegen/tables/PlanetMaterialStorage.sol";
import { PlanetMaterial } from "codegen/tables/PlanetMaterial.sol";
import { PlayerJunkLimit } from "codegen/tables/PlayerJunkLimit.sol";

contract TestOnlySystem is BaseSystem {
  // function createPlanet(
  //   uint256 planetHash,
  //   address owner,
  //   uint8 perlin,
  //   uint8 level,
  //   PlanetType planetType,
  //   SpaceType spaceType,
  //   uint64 population,
  //   uint64 silver,
  //   uint24 upgrades
  // ) public {
  //   DFUtils.tick(_world());

  //   PlanetConstants.set(bytes32(planetHash), perlin, level, planetType, spaceType);

  //   PlanetOwner.set(bytes32(planetHash), owner);

  //   setPlanetJunkOwner(planetHash, owner, level);

  //   PlanetTable.set(bytes32(planetHash), Ticker.getTickNumber(), population, silver, upgrades, false);
  // }
  // function createPlanet(
  //   uint256 planetHash,
  //   address owner,
  //   uint8 perlin,
  //   uint8 level,
  //   PlanetType planetType,
  //   SpaceType spaceType,
  //   uint64 population,
  //   uint64 silver,
  //   uint24 upgrades
  // ) public {
  //   DFUtils.tick(_world());

  //   PlanetConstants.set(bytes32(planetHash), perlin, level, planetType, spaceType);
  //   PlanetOwner.set(bytes32(planetHash), owner);
  //   setPlanetJunkOwner(planetHash, owner, level);

  //   PlanetTable.set(bytes32(planetHash), Ticker.getTickNumber(), population, silver, upgrades, false);

  // }
  function createPlanet(
    uint256 planetHash,
    address owner,
    uint8 perlin,
    uint8 level,
    PlanetType planetType,
    SpaceType spaceType,
    uint64 population,
    uint64 silver,
    uint24 upgrades
  ) public {
    DFUtils.tick(_world());

    // 1. Save core metadata
    PlanetConstants.set(bytes32(planetHash), perlin, level, planetType, spaceType);
    PlanetOwner.set(bytes32(planetHash), owner);
    setPlanetJunkOwner(planetHash, owner, level);

    PlanetTable.set(bytes32(planetHash), Ticker.getTickNumber(), population, silver, upgrades, false);

    // Biome biome = Biome(uint8(getPlanetBiome1(planetHash,perlin,spaceType)) - 1);
    // MaterialType[] memory allowed = PlanetLib.allowedMaterialsForBiome(biome);
    // for (uint i = 0; i < allowed.length; i++) {
    // MaterialLib.newMaterial(allowed[i], 1000 ether, 0.1 ether);
    // }
  }

  //   function getPlanetBiome1(uint256 planetHash , uint8 perlin , SpaceType spaceType) internal view returns (Biome) {
  //     // Compute biomebase deterministically from planet properties
  //     // Use a combination of planetHash and perlin to create a deterministic biomebase
  //     uint256 biomeBase = uint256(keccak256(abi.encodePacked(planetHash, perlin))) % 1000;
  //     return _getBiome1(spaceType, biomeBase);
  //   }

  //     function _getBiome1(SpaceType spaceType, uint256 biomeBase) internal view returns (Biome biome) {
  //     // 1. If planet is in Dead Space, its biome is Corrupted
  //     if (spaceType == SpaceType.DEAD_SPACE) {
  //         return Biome.CORRUPTED;                       // Dead space yields corrupted biome:contentReference[oaicite:8]{index=8}
  //     }
  //     // 2. Base index derived from spaceType (3 biome variants per zone)
  //     uint256 res = uint8(spaceType) * 3;
  //     PlanetBiomeConfigData memory config = PlanetBiomeConfig.get();  // Load threshold config:contentReference[oaicite:9]{index=9}

  //     // 3. Adjust index based on biomeBase against thresholds
  //     if (biomeBase < config.threshold1) {
  //         res -= 2;  // lowest biome variant for this zone
  //     } else if (biomeBase < config.threshold2) {
  //         res -= 1;  // middle biome variant
  //     }

  //     // 4. Cast to Biome (ensure within range)
  //     if (res > uint8(type(Biome).max)) {
  //         // Clamp to max enum value if somehow out of range
  //         res = uint8(type(Biome).max);
  //     }
  //     biome = Biome(res);
  // }

  function setPlanetJunkOwner(uint256 planetHash, address junkOwner, uint256 level) public {
    DFUtils.tick(_world());
    PlanetJunkOwner.set(bytes32(planetHash), junkOwner);
    uint256[] memory PLANET_LEVEL_JUNK = JunkConfig.getPLANET_LEVEL_JUNK();
    uint256 planetJunk = PLANET_LEVEL_JUNK[level];
    uint256 playerJunk = PlayerJunk.get(junkOwner);
    uint256 playerJunkLimit = PlayerJunkLimit.get(junkOwner);
    PlayerJunk.set(junkOwner, playerJunk + planetJunk);
  }

  function revealPlanetByAdmin(uint256 planetHash, int256 x, int256 y) public {
    RevealedPlanet.set(bytes32(planetHash), int32(x), int32(y), _msgSender());
  }

  function safeSetOwner(
    address newOwner,
    uint256[2] memory _a,
    uint256[2][2] memory _b,
    uint256[2] memory _c,
    uint256[9] memory _input
  ) public {
    Proof memory proof;
    proof.genFrom(_a, _b, _c);
    SpawnInput memory input;
    input.genFrom(_input);

    address worldAddress = _world();
    DFUtils.tick(worldAddress);

    DFUtils.verify(worldAddress, proof, input);

    // new planet instances in memory
    Planet memory planet = DFUtils.readAnyPlanet(worldAddress, input.planetHash, input.perlin, input.radiusSquare);
    planet.changeOwner(newOwner);
    planet._initPopulationAndSilver();
    // TODO PUNKE DELETE THIS FOR PUBLIC?
    // Only give materials in dev mode (when running pnpm dev - chainId 31337 for anvil/foundry)
    // Common dev chain IDs: 31337 (anvil/foundry default), 1337 (hardhat)
    if (block.chainid == 31337) {
      // If planet is a Foundry, give 2K of each material type
      if (planet.planetType == PlanetType.FOUNDRY) {
        uint256 materialAmount = 5000 * 1000; // 2K materials in wei (1e18 precision)

        // Add all material types except UNKNOWN (0)
        for (uint8 i = 1; i <= uint8(type(MaterialType).max); i++) {
          MaterialType materialType = MaterialType(i);
          uint256 currentAmount = planet.getMaterial(materialType);
          planet.setMaterial(materialType, currentAmount + materialAmount);
        }
      }
      // If planet is a Sun, give 5K SOLAR_ENERGY
      if (planet.planetType == PlanetType.SUN) {
        uint256 solarEnergyAmount = 5000 * 1000; // 5K SOLAR_ENERGY with CONTRACT_PRECISION (1000)
        uint256 currentAmount = planet.getMaterial(MaterialType.SOLAR_ENERGY);
        planet.setMaterial(MaterialType.SOLAR_ENERGY, currentAmount + solarEnergyAmount);
      }
    }

    planet.writeToStore();
  }

  /**
   * @notice Admin adds GPT tokens to a player.
   * @param player Address of the player
   * @param amount Number of GPT tokens to add
   */
  function addGPTTokens(address player, uint256 amount) public {
    GPTTokens.set(player, GPTTokens.get(player) + amount);
  }

  function addMaterial(uint256 planetHash, MaterialType materialType, uint256 amount) public {
    uint256 exsitMap = PlanetMaterialStorage.get(bytes32(planetHash));
    PlanetMaterialStorage.set(bytes32(planetHash), exsitMap | (1 << uint8(materialType)));
    PlanetMaterial.set(
      bytes32(planetHash),
      uint8(materialType),
      PlanetMaterial.get(bytes32(planetHash), uint8(materialType)) + amount
    );
  }
}
