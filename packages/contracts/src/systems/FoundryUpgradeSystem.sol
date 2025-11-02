// SPDX-License-Identifier: GPL-3.0
pragma solidity >=0.8.24;

import { BaseSystem } from "systems/internal/BaseSystem.sol";
import { Planet } from "libraries/Planet.sol";
import { DFUtils } from "libraries/DFUtils.sol";
import { GlobalStats } from "codegen/tables/GlobalStats.sol";
import { PlayerStats } from "codegen/tables/PlayerStats.sol";
import { FoundryUpgrade } from "codegen/tables/FoundryUpgrade.sol";
import { PlanetType, Biome, ArtifactRarity, SpaceType } from "codegen/common.sol";
import { PlanetBiomeConfig, PlanetBiomeConfigData } from "codegen/tables/PlanetBiomeConfig.sol";
import { Artifact, ArtifactLib } from "libraries/Artifact.sol";
import { Errors } from "interfaces/errors.sol";
import { SystemRegistry } from "@latticexyz/world/src/codegen/tables/SystemRegistry.sol";
import { RevenueStats } from "codegen/tables/RevenueStats.sol";
import { ResourceId } from "@latticexyz/store/src/ResourceId.sol";
import { EntryFee } from "codegen/tables/EntryFee.sol";

contract FoundryUpgradeSystem is BaseSystem {
  // Base upgrade fee in wei
  uint256 constant BASE_UPGRADE_FEE_LEVEL_1 = 50_000_000_000_000; // 0.00005 ETH
  uint256 constant BASE_UPGRADE_FEE_LEVEL_2 = 100_000_000_000_000; // 0.0001 ETH

  function upgradeFoundry(uint256 foundryHash) public payable requireSameOwnerAndJunkOwner(foundryHash) {
    _updateStats();

    address worldAddress = _world();
    DFUtils.tick(worldAddress);

    Planet memory foundry = DFUtils.readInitedPlanet(worldAddress, foundryHash);
    address executor = _msgSender();

    _validateUpgrade(foundry, executor, foundryHash);

    // Get current upgrade level
    uint8 currentLevel = FoundryUpgrade.getBranchLevel(bytes32(foundryHash));

    // Calculate upgrade fee
    uint256 baseFee = currentLevel == 0 ? BASE_UPGRADE_FEE_LEVEL_1 : BASE_UPGRADE_FEE_LEVEL_2;
    uint256 biomeMultiplier = _getBiomeMultiplier(_calculateBiomeFromPlanet(foundry));
    uint256 rarityMultiplier = _getHighestArtifactRarityMultiplier(foundry);
    uint256 totalFee = (baseFee * biomeMultiplier * rarityMultiplier) / 10000;

    uint256 totalRequired = EntryFee.getFee() + totalFee;
    if (_msgValue() < totalRequired) {
      revert Errors.InsufficientFoundryUpgradeFee(totalRequired, _msgValue());
    }

    // Add payment to RevenueStats
    ResourceId resourceId = SystemRegistry.get(address(this));
    RevenueStats.set(ResourceId.unwrap(resourceId), RevenueStats.get(ResourceId.unwrap(resourceId)) + _msgValue());

    // Upgrade foundry
    FoundryUpgrade.setBranchLevel(bytes32(foundryHash), currentLevel + 1);

    foundry.writeToStore();
  }

  function _validateUpgrade(Planet memory foundry, address executor, uint256 foundryHash) internal view {
    if (foundry.owner != executor) revert Errors.NotPlanetOwner();
    if (foundry.planetType != PlanetType.FOUNDRY) revert Errors.InvalidPlanetType();
    if (foundry.level < 4) revert Errors.PlanetLevelTooLow();

    uint8 currentLevel = FoundryUpgrade.getBranchLevel(bytes32(foundryHash));
    if (currentLevel >= 2) {
      revert Errors.FoundryAtMaxUpgradeLevel();
    }
  }

  function _calculateBiomeFromPlanet(Planet memory planet) internal view returns (Biome) {
    // If planet is in Dead Space, its biome is Corrupted
    if (planet.spaceType == SpaceType.DEAD_SPACE) {
      return Biome.CORRUPTED;
    }

    // Calculate biomeBase deterministically from planet hash and perlin
    // This matches the logic used in ArtifactLib._initBiome
    uint256 biomeBase = uint256(keccak256(abi.encodePacked(planet.planetHash, planet.perlin))) % 1000;

    // Calculate biome using the same logic as PlanetLib._getBiome
    uint256 res = uint8(planet.spaceType) * 3;
    PlanetBiomeConfigData memory config = PlanetBiomeConfig.get();

    if (biomeBase < config.threshold1) {
      res -= 2; // lowest biome variant for this zone
    } else if (biomeBase < config.threshold2) {
      res -= 1; // middle biome variant
    }

    // Ensure biome is within valid range
    if (res > uint8(type(Biome).max)) {
      res = uint8(type(Biome).max);
    }

    return Biome(uint8(res));
  }

  function _getBiomeMultiplier(Biome biome) internal pure returns (uint256) {
    // Biome multipliers: 1-3: 100, 4-6: 150, 7-9: 200, 10: 250
    uint16 b = uint16(biome);
    if (b >= 1 && b <= 3) return 100;
    if (b >= 4 && b <= 6) return 150;
    if (b >= 7 && b <= 9) return 200;
    if (b == 10) return 250;
    return 100;
  }

  function _getHighestArtifactRarityMultiplier(Planet memory foundry) internal view returns (uint256) {
    // Get highest rarity artifact on foundry using planet's artifact storage
    uint256 maxRarity = 100; // Default multiplier

    uint256 artifactCount = foundry.artifactStorage.GetNumber();
    for (uint256 i = 0; i < artifactCount; i++) {
      uint256 artifactId = foundry.artifactStorage.Get(i);
      Artifact memory artifact = foundry.mustGetArtifact(artifactId);
      uint256 rarityMult = _getRarityMultiplier(artifact.rarity);
      if (rarityMult > maxRarity) {
        maxRarity = rarityMult;
      }
    }

    return maxRarity;
  }

  function _getRarityMultiplier(ArtifactRarity rarity) internal pure returns (uint256) {
    if (rarity == ArtifactRarity.COMMON) return 100;
    if (rarity == ArtifactRarity.RARE) return 120;
    if (rarity == ArtifactRarity.EPIC) return 150;
    if (rarity == ArtifactRarity.LEGENDARY) return 200;
    if (rarity == ArtifactRarity.MYTHIC) return 300;
    return 100;
  }

  function _updateStats() internal {
    GlobalStats.setUpgradeFoundryCount(GlobalStats.getUpgradeFoundryCount() + 1);
    PlayerStats.setUpgradeFoundryCount(_msgSender(), PlayerStats.getUpgradeFoundryCount(_msgSender()) + 1);
  }

  // Public getter for upgrade level
  function getFoundryUpgradeLevel(uint256 foundryHash) public view returns (uint8) {
    return FoundryUpgrade.getBranchLevel(bytes32(foundryHash));
  }
}
