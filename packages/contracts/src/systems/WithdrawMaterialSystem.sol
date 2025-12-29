// SPDX-License-Identifier: GPL-3.0
pragma solidity >=0.8.24;

import { BaseSystem } from "systems/internal/BaseSystem.sol";
import { Planet } from "libraries/Planet.sol";
import { PlanetType, MaterialType, Biome } from "codegen/common.sol";
import { PlayerWithdrawMaterial } from "codegen/tables/PlayerWithdrawMaterial.sol";
import { PlayerScore } from "codegen/tables/PlayerScore.sol";
import { DFUtils } from "libraries/DFUtils.sol";
import { GuildUtils } from "libraries/GuildUtils.sol";
import { Guild } from "codegen/tables/Guild.sol";
import { GlobalStats } from "codegen/tables/GlobalStats.sol";
import { PlayerStats } from "codegen/tables/PlayerStats.sol";
import { Errors } from "interfaces/errors.sol";
import { IMaterialToken } from "tokens/IMaterialToken.sol";
import { MaterialToken } from "codegen/tables/MaterialToken.sol";
import { MaterialToken as MaterialTokenContract } from "tokens/MaterialToken.sol";

contract WithdrawMaterialSystem is BaseSystem {
  /**
   * @notice Withdraw material on Spacetime RIP with biome-based scoring.
   * @param planetHash Planet hash
   * @param materialType Material type to withdraw
   * @param materialToWithdraw Material amount to withdraw
   */
  function withdrawMaterial(
    uint256 planetHash,
    MaterialType materialType,
    uint256 materialToWithdraw
  ) public entryFee requireSameOwnerAndJunkOwner(planetHash) {
    _updateStats();
    _processWithdrawal(planetHash, materialType, materialToWithdraw);
  }

  /**
   * @notice Update global and player statistics for material withdrawal
   */
  function _updateStats() internal {
    GlobalStats.setWithdrawMaterialCount(GlobalStats.getWithdrawMaterialCount() + 1);
    PlayerStats.setWithdrawMaterialCount(_msgSender(), PlayerStats.getWithdrawMaterialCount(_msgSender()) + 1);
  }

  /**
   * @notice Process material withdrawal by validating and executing the withdrawal
   * @param planetHash Planet hash to withdraw material from
   * @param materialType Material type to withdraw
   * @param materialToWithdraw Amount of material to withdraw
   */
  function _processWithdrawal(uint256 planetHash, MaterialType materialType, uint256 materialToWithdraw) internal {
    address worldAddress = _world();
    DFUtils.tick(worldAddress);

    Planet memory planet = DFUtils.readInitedPlanet(worldAddress, planetHash);
    address executor = _msgSender();

    _validateWithdrawal(planet, executor, materialType, materialToWithdraw);
    _executeWithdrawal(planet, executor, materialType, materialToWithdraw);
  }

  /**
   * @notice Validate that material withdrawal is allowed
   * @param planet Planet data structure
   * @param executor Address attempting to withdraw material
   * @param materialType Material type to withdraw
   * @param materialToWithdraw Amount of material to withdraw
   */
  function _validateWithdrawal(
    Planet memory planet,
    address executor,
    MaterialType materialType,
    uint256 materialToWithdraw
  ) internal view {
    if (planet.owner != executor) revert Errors.NotPlanetOwner();
    if (planet.planetType != PlanetType.SPACETIME_RIP) revert Errors.InvalidPlanetType();

    uint256 currentMaterial = planet.getMaterial(materialType);
    if (currentMaterial < materialToWithdraw) revert Errors.InsufficientMaterialOnPlanet();

    uint256 materialCap = planet.getMaterialCap(materialType);
    if (materialCap > materialToWithdraw * 5) revert Errors.WithdrawAmountTooLow();
  }

  /**
   * @notice Execute material withdrawal: remove material from planet, mint ERC1155 tokens, and update scores
   * @param planet Planet data structure
   * @param executor Address withdrawing the material
   * @param materialType Material type being withdrawn
   * @param materialToWithdraw Amount of material to withdraw
   */
  function _executeWithdrawal(
    Planet memory planet,
    address executor,
    MaterialType materialType,
    uint256 materialToWithdraw
  ) internal {
    uint256 currentMaterial = planet.getMaterial(materialType);
    uint256 playerWithdrawMaterialAmount = PlayerWithdrawMaterial.get(executor, uint8(materialType));

    // Calculate biome-based score multiplier
    uint256 scoreMultiplier = getBiomeScoreMultiplier(materialType);
    uint256 scorePoints = (materialToWithdraw * scoreMultiplier);

    // Remove material from planet
    planet.setMaterial(materialType, currentMaterial - materialToWithdraw);

    // ============ ERC1155 MINTING ============
    // Get MaterialToken contract address from MUD table
    address materialTokenAddress = MaterialToken.get();
    if (materialTokenAddress != address(0)) {
      IMaterialToken materialToken = IMaterialToken(materialTokenAddress);
      // Mint ERC1155 tokens to player
      // Note: The system (address(this)) must be registered as a minter in MaterialToken
      // This should be done during deployment via addSystemMinter(address(this))
      materialToken.mint(
        executor,
        materialType,
        materialToWithdraw / 1000,
        abi.encodePacked("DFMATERIAL_", materialToken.getMaterialName(materialType))
      );
    }
    // =========================================

    // Add to player's withdrawn material amount
    playerWithdrawMaterialAmount += materialToWithdraw;

    // Add score points to player's score
    uint256 currentPlayerScore = PlayerScore.get(executor);
    PlayerScore.set(executor, currentPlayerScore + scorePoints);

    // Add score points to guild if player is in a guild
    uint8 guildId = GuildUtils.getCurrentGuildId(executor);
    if (guildId != 0) {
      uint256 currentGuildSilver = Guild.getSilver(guildId);
      Guild.setSilver(guildId, currentGuildSilver + scorePoints);
    }

    planet.writeToStore();
    PlayerWithdrawMaterial.set(executor, uint8(materialType), playerWithdrawMaterialAmount);
  }

  /**
   * @notice Get material-specific score multiplier for material withdrawal
   * @param materialType The material being withdrawn
   * @return multiplier The score multiplier
   * @dev Uses efficient switch-like pattern matching for gas optimization
   */
  function getBiomeScoreMultiplier(MaterialType materialType) internal pure returns (uint256 multiplier) {
    // Material type to score multiplier mapping (gas-optimized)
    if (materialType == MaterialType.CORRUPTED_CRYSTAL) return 600; // 6x (highest value)
    if (materialType == MaterialType.BLACKALLOY) return 400; // 4x
    if (materialType == MaterialType.PYROSTEEL) return 300; // 3x
    if (materialType == MaterialType.SCRAPIUM) return 250; // 2.5x (will be divided by 10)
    if (materialType == MaterialType.CRYOSTONE) return 200; // 2x
    if (materialType == MaterialType.SANDGLASS) return 180; // 1.8x (will be divided by 10)
    if (materialType == MaterialType.MYCELIUM) return 150; // 1.5x (will be divided by 10)
    if (materialType == MaterialType.AURORIUM) return 130; // 1.3x (will be divided by 10)
    if (materialType == MaterialType.SOLAR_ENERGY) return 100; // 1x (default)
    if (materialType == MaterialType.WINDSTEEL) return 120; // 1.2x (will be divided by 10)
    if (materialType == MaterialType.LIVING_WOOD) return 110; // 1.1x (will be divided by 10)
    if (materialType == MaterialType.WATER_CRYSTALS) return 105; // 1.05x (will be divided by 100)
    if (materialType == MaterialType.UNKNOWN) return 100; // 1x
    return 100; // Default multiplier for any other materials
  }

  /**
   * @notice Burn material tokens after validation
   * @param materialToken MaterialToken contract interface
   * @param executor Player address
   * @param materialType Material type to burn
   * @param amount Amount to burn
   */
  function _burnMaterialTokens(
    IMaterialToken materialToken,
    address executor,
    MaterialType materialType,
    uint256 amount
  ) internal {
    uint256 tokenId = materialToken.getTokenId(materialType);
    require(materialToken.balanceOf(executor, tokenId) >= amount, "Insufficient material tokens");
    materialToken.burn(executor, materialType, amount);
  }

  /**
   * @notice Deposit ERC1155 material tokens back to planet (convert tokens to in-game materials)
   * @param planetHash Planet hash to deposit materials to
   * @param materialType Material type to deposit
   * @param amount Amount of material to deposit
   */
  function depositMaterial(
    uint256 planetHash,
    MaterialType materialType,
    uint256 amount
  ) public entryFee requireSameOwnerAndJunkOwner(planetHash) {
    address worldAddress = _world();
    DFUtils.tick(worldAddress);

    Planet memory planet = DFUtils.readInitedPlanet(worldAddress, planetHash);
    address executor = _msgSender();

    if (planet.owner != executor) revert Errors.NotPlanetOwner();

    address materialTokenAddress = MaterialToken.get();
    require(materialTokenAddress != address(0), "MaterialToken not set");

    IMaterialToken materialToken = IMaterialToken(materialTokenAddress);
    _burnMaterialTokens(materialToken, executor, materialType, amount);

    _reduceScoreAndGuildSilver(executor, amount * getBiomeScoreMultiplier(materialType));

    planet.setMaterial(materialType, planet.getMaterial(materialType) + amount);
    planet.writeToStore();
  }

  /**
   * @notice Reduce both player score and guild silver when depositing materials
   * @param executor Player address whose score and guild silver will be reduced
   * @param scorePoints Score points to reduce from both player score and guild silver
   */
  function _reduceScoreAndGuildSilver(address executor, uint256 scorePoints) internal {
    _reduceScore(executor, scorePoints);
    _reduceGuildSilver(executor, scorePoints);
  }

  /**
   * @notice Reduce guild silver if player is in a guild (prevents underflow by setting to 0 if needed)
   * @param executor Player address to check for guild membership
   * @param scorePoints Score points to reduce from guild silver
   */
  function _reduceGuildSilver(address executor, uint256 scorePoints) internal {
    uint8 guildId = GuildUtils.getCurrentGuildId(executor);
    if (guildId != 0) {
      uint256 currentGuildSilver = Guild.getSilver(guildId);
      if (currentGuildSilver >= scorePoints) {
        Guild.setSilver(guildId, currentGuildSilver - scorePoints);
      } else {
        Guild.setSilver(guildId, 0);
      }
    }
  }
  /**
   * @notice Reduce player score when depositing materials (reverts if insufficient score)
   * @param executor Player address whose score will be reduced
   * @param scorePoints Score points to reduce from player score
   */
  function _reduceScore(address executor, uint256 scorePoints) internal {
    // Reduce player's score - revert if insufficient
    uint256 currentPlayerScore = PlayerScore.get(executor);
    if (currentPlayerScore >= scorePoints) {
      PlayerScore.set(executor, currentPlayerScore - scorePoints);
    } else {
      revert Errors.InsufficientScore();
    }
  }
}
