// SPDX-License-Identifier: GPL-3.0
pragma solidity >=0.8.24;

import { BaseSystem } from "systems/internal/BaseSystem.sol";
import { Planet } from "libraries/Planet.sol";
import { Artifact, ArtifactLib } from "libraries/Artifact.sol";
import { Counter } from "codegen/tables/Counter.sol";
import { DFUtils } from "libraries/DFUtils.sol";
import { GlobalStats } from "codegen/tables/GlobalStats.sol";
import { PlayerStats } from "codegen/tables/PlayerStats.sol";
import { CraftedSpaceship, CraftedSpaceshipData } from "codegen/tables/CraftedSpaceship.sol";
import { SpaceshipBonus, SpaceshipBonusData } from "codegen/tables/SpaceshipBonus.sol";
import { FoundryCraftingCount, FoundryCraftingCountData } from "codegen/tables/FoundryCraftingCount.sol";
import { FoundryUpgrade } from "codegen/tables/FoundryUpgrade.sol";
import { PlanetType, MaterialType, Biome, ArtifactRarity, SpaceType } from "codegen/common.sol";
import { PlanetBiomeConfig, PlanetBiomeConfigData } from "codegen/tables/PlanetBiomeConfig.sol";
import { IArtifactNFT } from "tokens/IArtifactNFT.sol";
import { Errors } from "interfaces/errors.sol";

contract FoundryCraftingSystem is BaseSystem {
  // ArtifactNFT will be accessed through the world contract
  // No constructor needed - follows the same pattern as other systems

  function craftSpaceship(
    uint256 foundryHash,
    uint8 spaceshipType,
    MaterialType[] memory materials,
    uint256[] memory amounts,
    Biome biome
  ) public entryFee requireSameOwnerAndJunkOwner(foundryHash) {
    _updateStats();
    _processSpaceshipCrafting(foundryHash, spaceshipType, materials, amounts, biome);
  }

  function _updateStats() internal {
    GlobalStats.setCraftSpaceshipCount(GlobalStats.getCraftSpaceshipCount() + 1);
    PlayerStats.setCraftSpaceshipCount(_msgSender(), PlayerStats.getCraftSpaceshipCount(_msgSender()) + 1);
  }

  function _processSpaceshipCrafting(
    uint256 foundryHash,
    uint8 spaceshipType,
    MaterialType[] memory materials,
    uint256[] memory amounts,
    Biome biome
  ) internal {
    address worldAddress = _world();
    DFUtils.tick(worldAddress);

    Planet memory foundry = DFUtils.readInitedPlanet(worldAddress, foundryHash);
    address executor = _msgSender();

    _validateCrafting(foundry, executor, spaceshipType, materials, amounts);
    _executeCrafting(foundry, executor, spaceshipType, materials, amounts, biome);
  }

  function _validateCrafting(
    Planet memory foundry,
    address executor,
    uint8 spaceshipType,
    MaterialType[] memory materials,
    uint256[] memory amounts
  ) internal view {
    if (foundry.owner != executor) revert Errors.NotPlanetOwner();
    if (foundry.planetType != PlanetType.FOUNDRY) revert Errors.InvalidPlanetType();
    if (foundry.level < 4) revert Errors.PlanetLevelTooLow();

    // Validate spaceship type
    if (spaceshipType < 1 || spaceshipType > 4) revert Errors.InvalidSpaceshipType();

    // Check crafting limit based on foundry upgrade level
    // Level 0 = 1 craft, Level 1 = 2 crafts, Level 2 = 3 crafts
    FoundryCraftingCountData memory craftingData = FoundryCraftingCount.get(bytes32(foundry.planetHash));
    uint8 upgradeLevel = FoundryUpgrade.getBranchLevel(bytes32(foundry.planetHash));
    uint8 maxCrafts = 1 + upgradeLevel; // Level 0 = 1, Level 1 = 2, Level 2 = 3

    if (craftingData.count >= maxCrafts) revert Errors.FoundryCraftingLimitReached();

    // Validate recipe matches spaceship type and foundry has sufficient materials
    uint256 craftingMultiplier = _getCraftingMultiplier(craftingData.count);
    _validateRecipe(foundry, spaceshipType, materials, amounts, craftingMultiplier);
  }

  /**
   * @notice Validates that materials and amounts match the recipe for the given spaceship type
   *         and that the foundry has sufficient materials (with crafting multiplier applied)
   * @param foundry The foundry planet to check materials against
   * @param spaceshipType The spaceship type (1=Scout, 2=Fighter, 3=Destroyer, 4=Carrier)
   * @param materials Array of material types provided
   * @param amounts Array of material amounts provided (amounts already include crafting multiplier from client)
   * @param craftingMultiplier The crafting multiplier (100, 150, or 225)
   */
  function _validateRecipe(
    Planet memory foundry,
    uint8 spaceshipType,
    MaterialType[] memory materials,
    uint256[] memory amounts,
    uint256 craftingMultiplier
  ) internal view {
    // Validate arrays match length
    if (materials.length != amounts.length) revert Errors.InvalidMaterialAmount();
    if (materials.length == 0) revert Errors.MissingRequiredMaterials();

    // Get expected recipe for this spaceship type
    MaterialType[] memory expectedMaterials;
    uint256[] memory expectedAmounts;
    // need to be aligned with client logic for spaceship crafting pane SpaceshipCraftingPane.tsx line 390
    if (spaceshipType == 1) {
      // Scout: Windsteel (100) + Aurorium (50)
      expectedMaterials = new MaterialType[](2);
      expectedMaterials[0] = MaterialType.WINDSTEEL;
      expectedMaterials[1] = MaterialType.AURORIUM;
      expectedAmounts = new uint256[](2);
      expectedAmounts[0] = 100;
      expectedAmounts[1] = 50;
    } else if (spaceshipType == 2) {
      // Fighter: Pyrosteel (150) + Scrapium (100)
      expectedMaterials = new MaterialType[](2);
      expectedMaterials[0] = MaterialType.PYROSTEEL;
      expectedMaterials[1] = MaterialType.SCRAPIUM;
      expectedAmounts = new uint256[](2);
      expectedAmounts[0] = 150;
      expectedAmounts[1] = 100;
    } else if (spaceshipType == 3) {
      // Destroyer: Blackalloy (200) + Corrupted Crystal (100)
      expectedMaterials = new MaterialType[](2);
      expectedMaterials[0] = MaterialType.BLACKALLOY;
      expectedMaterials[1] = MaterialType.CORRUPTED_CRYSTAL;
      expectedAmounts = new uint256[](2);
      expectedAmounts[0] = 200;
      expectedAmounts[1] = 100;
    } else if (spaceshipType == 4) {
      // Carrier: Living Wood (200) + Cryostone (150)
      expectedMaterials = new MaterialType[](2);
      expectedMaterials[0] = MaterialType.LIVING_WOOD;
      expectedMaterials[1] = MaterialType.CRYOSTONE;
      expectedAmounts = new uint256[](2);
      expectedAmounts[0] = 200;
      expectedAmounts[1] = 150;
    } else {
      revert Errors.InvalidSpaceshipType();
    }

    // Validate provided materials match expected recipe
    if (materials.length != expectedMaterials.length) revert Errors.MissingRequiredMaterials();

    // Create maps for easier lookup
    bool[12] memory materialFound; // MaterialType enum has 11 values (0-10)
    uint256[12] memory materialAmounts;

    // Store provided materials
    for (uint256 i = 0; i < materials.length; i++) {
      uint8 matType = uint8(materials[i]);
      if (matType > 12) revert Errors.InvalidMaterialType();
      if (materialFound[matType]) revert Errors.InvalidMaterialAmount(); // Duplicate material
      materialFound[matType] = true;
      materialAmounts[matType] = amounts[i];
    }

    // Validate all expected materials are present with correct amounts
    // Note: amounts parameter already includes crafting multiplier applied by client
    // Client uses Math.ceil() which can round up, so we need to allow some tolerance
    // Contract uses integer division which truncates: (expectedAmounts[i] * craftingMultiplier) / 100
    for (uint256 i = 0; i < expectedMaterials.length; i++) {
      uint8 expectedMatType = uint8(expectedMaterials[i]);
      if (!materialFound[expectedMatType]) revert Errors.MissingRequiredMaterials();

      // Calculate expected amount with multiplier (what contract would calculate)
      uint256 expectedAmountWithMultiplier = (expectedAmounts[i] * craftingMultiplier) / 100;
      // Client uses Math.ceil() which can round up, so allow +1 tolerance
      // e.g., (50 * 225) / 100 = 112.5 -> 112 (truncated), but client sends 113 (Math.ceil)
      uint256 providedAmount = materialAmounts[expectedMatType];

      // Allow tolerance of 1 unit difference due to rounding differences
      if (providedAmount < expectedAmountWithMultiplier || providedAmount > expectedAmountWithMultiplier + 1) {
        revert Errors.InvalidMaterialAmount();
      }
    }

    // Ensure no extra materials beyond recipe
    uint256 expectedMaterialCount = expectedMaterials.length;
    if (materials.length > expectedMaterialCount) revert Errors.InvalidMaterialAmount();

    // Validate foundry has sufficient materials (amounts already include multiplier from client)
    for (uint256 i = 0; i < expectedMaterials.length; i++) {
      uint8 matType = uint8(expectedMaterials[i]);
      uint256 requiredAmount = (expectedAmounts[i] * craftingMultiplier) / 100;
      uint256 currentAmount = foundry.getMaterial(MaterialType(matType));
      // requiredAmount is in wei, so we need to multiply by 1000 to get the actual amount
      if (currentAmount < requiredAmount * 1000) {
        revert Errors.InsufficientMaterialOnPlanet();
      }
    }
  }

  function _executeCrafting(
    Planet memory foundry,
    address executor,
    uint8 spaceshipType,
    MaterialType[] memory materials,
    uint256[] memory amounts,
    Biome biome
  ) internal {
    // Note: amounts already include crafting multiplier applied by client
    // So we consume the amounts directly without applying multiplier again

    // Consume materials (amounts already include multiplier)
    for (uint256 i = 0; i < materials.length; i++) {
      uint256 currentAmount = foundry.getMaterial(materials[i]);
      uint256 requiredAmount = amounts[i]; // amounts already include multiplier from client
      // requiredAmount is in wei, so we need to multiply by 1000 to get the actual amount
      foundry.setMaterial(materials[i], currentAmount - (requiredAmount * 1000));
    }

    // Get crafting count for incrementing (need this for the counter)
    FoundryCraftingCountData memory craftingData = FoundryCraftingCount.get(bytes32(foundry.planetHash));

    // Calculate rarity based on planet level (same as NewArtifact)
    ArtifactRarity rarity = _calculateSpaceshipRarity(
      foundry.level,
      uint256(keccak256(abi.encodePacked(block.timestamp, executor, foundry.planetHash)))
    );

    // Calculate biome from planet properties instead of relying on client-provided biome
    // This ensures admin-created planets get correct biome
    Biome calculatedBiome = _calculateBiomeFromPlanet(foundry);
    // Use calculated biome if provided biome is invalid (0 or out of range), otherwise use provided biome
    // This allows client to override if needed, but ensures valid biome for admin-created planets
    if (uint8(biome) == 0 || uint8(biome) > uint8(type(Biome).max)) {
      biome = calculatedBiome;
    }

    // Create spaceship artifact
    Artifact memory spaceshipArtifact = ArtifactLib.NewSpaceshipArtifact(
      uint256(keccak256(abi.encodePacked(block.timestamp, executor, foundry.planetHash))),
      foundry.planetHash,
      spaceshipType,
      biome,
      rarity
    );

    // Calculate bonuses and store spaceship data

    uint32 artifactId = uint32(spaceshipArtifact.id);
    // todo find how to use CraftedSpaceship.set instead step by step setSpaceShip setBiome setRarity setCraftedAt setNftTokenId setCrafter etc
    //  CraftedSpaceship.set(artifactId, spaceshipType, biome, rarity, uint64(block.timestamp), 0, executor);
    CraftedSpaceship.setSpaceshipType(artifactId, spaceshipType);
    CraftedSpaceship.setBiome(artifactId, biome);
    CraftedSpaceship.setRarity(artifactId, rarity);
    CraftedSpaceship.setCraftedAt(artifactId, uint64(block.timestamp));
    CraftedSpaceship.setNftTokenId(artifactId, 0); // Will be set after NFT minting
    CraftedSpaceship.setCrafter(artifactId, executor);
    // todo find how to use SpaceshipBonus.set instead step by step setAttackBonus setDefenseBonus setSpeedBonus setRangeBonus etc
    //    SpaceshipBonus.set(artifactId, _calculateAttackBonus(config.baseAttack, biome, rarity), _calculateDefenseBonus(config.baseDefense, biome, rarity), _calculateSpeedBonus(config.baseSpeed, biome, rarity), _calculateRangeBonus(config.baseRange, biome, rarity));
    SpaceshipBonus.setAttackBonus(artifactId, _calculateAttackBonus(biome, rarity, spaceshipType));
    SpaceshipBonus.setDefenseBonus(artifactId, _calculateDefenseBonus(biome, rarity, spaceshipType));
    SpaceshipBonus.setSpeedBonus(artifactId, _calculateSpeedBonus(biome, rarity, spaceshipType));
    SpaceshipBonus.setRangeBonus(artifactId, _calculateRangeBonus(biome, rarity, spaceshipType));

    // TODO: Mint ArtifactNFT and update spaceship data
    // For now, we'll skip NFT minting to avoid deployment issues
    // uint256 tokenId = _mintSpaceshipNFT(executor, spaceshipArtifact.id, spaceshipType, biome, rarity);
    // CraftedSpaceship.setNftTokenId(spaceshipType, biome, rarity, tokenId);

    // Store artifact and add to planet
    spaceshipArtifact.writeToStore();
    foundry.pushArtifact(spaceshipArtifact.id);
    foundry.writeToStore();

    // Increment crafting count for this foundry
    FoundryCraftingCount.set(
      bytes32(foundry.planetHash),
      FoundryCraftingCountData({ count: craftingData.count + 1, lastCraftTime: uint64(block.timestamp) })
    );

    // Update counter
    Counter.setArtifact(uint24(spaceshipArtifact.id));
  }

  // TODO: Re-enable NFT minting once ArtifactNFT is properly deployed
  function _mintSpaceshipNFT(
    address to,
    uint256 spaceshipId,
    uint8 spaceshipType,
    Biome biome,
    ArtifactRarity rarity
  ) internal returns (uint256) {
    uint256 tokenId = _generateSpaceshipTokenId(spaceshipId, spaceshipType);

    // TODO: Get ArtifactNFT from world contract and mint
    // artifactNFT.mint(
    //     to,
    //     tokenId,
    //     3, // artifactType = Spaceship (original Dark Forest ID)
    //     uint8(rarity),
    //     uint8(biome)
    // );

    return tokenId;
  }

  function _generateSpaceshipTokenId(uint256 spaceshipId, uint8 spaceshipType) internal view returns (uint256) {
    // Format: [Round(8 bits)][SpaceshipType(8 bits)][UniqueID(16 bits)][Timestamp(32 bits)]
    uint256 round = uint256(keccak256(abi.encodePacked(block.timestamp))) % 256;
    uint256 timestamp = block.timestamp;

    return (round << 248) | (uint256(spaceshipType) << 240) | (spaceshipId << 224) | timestamp;
  }

  function _calculateSpaceshipRarity(uint256 planetLevel, uint256 seed) internal pure returns (ArtifactRarity) {
    // Use the same rarity calculation as NewArtifact._initRarity
    uint256 lvlBonusSeed = seed & 0xfff000;
    if (lvlBonusSeed < 0x40000) {
      // possibility 1/64
      planetLevel += 2;
    } else if (lvlBonusSeed < 0x100000) {
      // possibility 1/16
      planetLevel += 1;
    }

    if (planetLevel <= 1) {
      return ArtifactRarity.COMMON;
    } else if (planetLevel <= 3) {
      return ArtifactRarity.RARE;
    } else if (planetLevel <= 5) {
      return ArtifactRarity.EPIC;
    } else if (planetLevel <= 7) {
      return ArtifactRarity.LEGENDARY;
    } else {
      return ArtifactRarity.MYTHIC;
    }
  }

  function _calculateAttackBonus(
    Biome biome,
    ArtifactRarity rarity,
    uint8 spaceshipType
  ) internal pure returns (uint16) {
    uint16 biomeBonus = _getBiomeBonus(biome);
    uint16 roleBonus = _getSpaceshipRoleAttackBonus(spaceshipType);
    uint16 rarityMultiplier = _getRarityMultiplier(rarity);

    // If role bonus is 0, then no biome bonus is added
    if (roleBonus == 0) {
      return 0;
    }

    uint16 totalBonus = biomeBonus + roleBonus;
    return ((totalBonus * rarityMultiplier) / 100);
  }

  function _calculateDefenseBonus(
    Biome biome,
    ArtifactRarity rarity,
    uint8 spaceshipType
  ) internal pure returns (uint16) {
    uint16 biomeBonus = _getBiomeBonus(biome);
    uint16 roleBonus = _getSpaceshipRoleDefenseBonus(spaceshipType);
    uint16 rarityMultiplier = _getRarityMultiplier(rarity);

    // If role bonus is 0, then no biome bonus is added
    if (roleBonus == 0) {
      return 0;
    }

    uint16 totalBonus = biomeBonus + roleBonus;
    return ((totalBonus * rarityMultiplier) / 100);
  }

  function _calculateSpeedBonus(
    Biome biome,
    ArtifactRarity rarity,
    uint8 spaceshipType
  ) internal pure returns (uint16) {
    uint16 biomeBonus = _getBiomeBonus(biome);
    uint16 roleBonus = _getSpaceshipRoleSpeedBonus(spaceshipType);
    uint16 rarityMultiplier = _getRarityMultiplier(rarity);

    // If role bonus is 0, then no biome bonus is added
    if (roleBonus == 0) {
      return 0;
    }

    uint16 totalBonus = biomeBonus + roleBonus;
    return ((totalBonus * rarityMultiplier) / 100);
  }

  function _calculateRangeBonus(
    Biome biome,
    ArtifactRarity rarity,
    uint8 spaceshipType
  ) internal pure returns (uint16) {
    uint16 biomeBonus = _getBiomeBonus(biome);
    uint16 roleBonus = _getSpaceshipRoleRangeBonus(spaceshipType);
    uint16 rarityMultiplier = _getRarityMultiplier(rarity);

    // If role bonus is 0, then no biome bonus is added
    if (roleBonus == 0) {
      return 0;
    }

    uint16 totalBonus = biomeBonus + roleBonus;
    return ((totalBonus * rarityMultiplier) / 100);
  }

  function _getRarityMultiplier(ArtifactRarity rarity) internal pure returns (uint16) {
    if (rarity == ArtifactRarity.COMMON) return 100;
    if (rarity == ArtifactRarity.RARE) return 120;
    if (rarity == ArtifactRarity.EPIC) return 150;
    if (rarity == ArtifactRarity.LEGENDARY) return 200;
    if (rarity == ArtifactRarity.MYTHIC) return 300;
    return 100;
  }

  function _getBiomeBonus(Biome biome) internal pure returns (uint16) {
    uint16 b = uint16(biome);
    if (b >= 1 && b <= 3) {
      return 1;
    } else if (b >= 4 && b <= 6) {
      return 2;
    } else if (b >= 7 && b <= 9) {
      return 4;
    } else if (b == 10) {
      return 8;
    }
    return 0;
  }

  // Spaceship role-specific bonus functions
  function _getSpaceshipRoleAttackBonus(uint8 spaceshipType) internal pure returns (uint16) {
    // Scout: 0, Fighter: 5, Destroyer: 10, Carrier: 5
    if (spaceshipType == 1) return 0; // Scout - no attack bonus
    if (spaceshipType == 2) return 5; // Fighter
    if (spaceshipType == 3) return 10; // Destroyer
    if (spaceshipType == 4) return 5; // Carrier
    return 0;
  }

  function _getSpaceshipRoleDefenseBonus(uint8 spaceshipType) internal pure returns (uint16) {
    // Scout: 0, Fighter: 5, Destroyer: 10, Carrier: 15
    if (spaceshipType == 1) return 0; // Scout
    if (spaceshipType == 2) return 5; // Fighter
    if (spaceshipType == 3) return 10; // Destroyer
    if (spaceshipType == 4) return 15; // Carrier
    return 0;
  }

  function _getSpaceshipRoleSpeedBonus(uint8 spaceshipType) internal pure returns (uint16) {
    // Scout: 10, Fighter: 0, Destroyer: 0, Carrier: 0
    if (spaceshipType == 1) return 10; // Scout
    if (spaceshipType == 2) return 0; // Fighter
    if (spaceshipType == 3) return 0; // Destroyer
    if (spaceshipType == 4) return 0; // Carrier
    return 0;
  }

  function _getSpaceshipRoleRangeBonus(uint8 spaceshipType) internal pure returns (uint16) {
    // Scout: 5, Fighter: 5, Destroyer: 0, Carrier: 3
    if (spaceshipType == 1) return 5; // Scout
    if (spaceshipType == 2) return 5; // Fighter
    if (spaceshipType == 3) return 0; // Destroyer - no range bonus
    if (spaceshipType == 4) return 3; // Carrier
    return 0;
  }

  function _getCraftingMultiplier(uint8 craftingCount) internal pure returns (uint256) {
    // 1st craft: 100% (1.0x), 2nd craft: 150% (1.5x), 3rd craft: 225% (2.25x)
    if (craftingCount == 0) return 100;
    if (craftingCount == 1) return 150;
    if (craftingCount == 2) return 225;
    return 100; // Should never reach here due to limit check
  }

  // Public function to get crafting count for a foundry
  function getFoundryCraftingCount(uint256 foundryHash) public view returns (uint8 count, uint64 lastCraftTime) {
    FoundryCraftingCountData memory data = FoundryCraftingCount.get(bytes32(foundryHash));
    return (data.count, data.lastCraftTime);
  }

  // Public function to get crafting multiplier for a foundry
  function getCraftingMultiplier(uint256 foundryHash) public view returns (uint256 multiplier) {
    FoundryCraftingCountData memory data = FoundryCraftingCount.get(bytes32(foundryHash));
    return _getCraftingMultiplier(data.count);
  }

  /**
   * @notice Calculate biome from planet properties (perlin, spaceType)
   * @param planet The planet to calculate biome for
   * @return biome The calculated biome
   */
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
}
