// SPDX-License-Identifier: GPL-3.0
pragma solidity >=0.8.24;

import { BaseSystem } from "systems/internal/BaseSystem.sol";
import { Planet } from "libraries/Planet.sol";
import { Artifact } from "libraries/Artifact.sol";
import { PlanetType } from "codegen/common.sol";
import { DFUtils } from "libraries/DFUtils.sol";
import { GlobalStats } from "codegen/tables/GlobalStats.sol";
import { PlayerStats } from "codegen/tables/PlayerStats.sol";
import { CraftedModules, CraftedModulesData } from "codegen/tables/CraftedModules.sol";
import { Artifact as ArtifactTable, ArtifactData } from "codegen/tables/Artifact.sol";
import { ArtifactOwner } from "codegen/tables/ArtifactOwner.sol";
import { ModuleBonus, ModuleBonusData } from "codegen/tables/ModuleBonus.sol";
import { StarBaseModuleInstalled, StarBaseModuleInstalledData } from "codegen/tables/StarBaseModuleInstalled.sol";
import { StarbaseSlot, StarbaseSlotData } from "codegen/tables/StarbaseSlot.sol";
import { Errors } from "interfaces/errors.sol";

/**
 * @title StarbaseModuleSystem
 * @notice Minimal modular system for starbases, mirroring SpaceshipModuleSystem behavior.
 *         Supports 3 logical slots (ENGINES, WEAPONS, HULL/SHIELD share index 3) with a single module each.
 *         Installing/uninstalling updates StarbaseBonus by adding/removing ModuleBonus.
 */
contract StarbaseModuleSystem is BaseSystem {
  // Slot types
  uint8 constant ENGINES_SLOT = 0;
  uint8 constant WEAPONS_SLOT = 1;
  uint8 constant HULL_SLOT = 3;
  uint8 constant SHIELD_SLOT = 4;
  uint8 constant ENGINES_LIMIT = 0;
  uint8 constant WEAPONS_LIMIT = 4;
  uint8 constant HULL_LIMIT = 4;
  uint8 constant SHIELD_LIMIT = 4;

  // moduleSlotType -> moduleSlotindex
  function _getSlotIndexForSlotType(uint8 slotType) internal pure returns (uint8) {
    if (slotType == ENGINES_SLOT) return 1;
    if (slotType == WEAPONS_SLOT) return 2;
    if (slotType == HULL_SLOT || slotType == SHIELD_SLOT) return 3;
    revert Errors.InvalidModuleType();
  }

  // Module types: 1=Engine, 2=Weapon, 3=Hull, 4=Shield
  function _getSlotTypeForModuleType(uint8 moduleType) internal pure returns (uint8) {
    if (moduleType == 1) return ENGINES_SLOT;
    if (moduleType == 2) return WEAPONS_SLOT;
    if (moduleType == 3) return HULL_SLOT;
    if (moduleType == 4) return SHIELD_SLOT;
    revert Errors.InvalidModuleType();
  }

  // Slot limits
  function _getSlotLimit(uint8 slotType) internal pure returns (uint8) {
    if (slotType == ENGINES_SLOT) return ENGINES_LIMIT;
    if (slotType == WEAPONS_SLOT) return WEAPONS_LIMIT;
    if (slotType == HULL_SLOT) return HULL_LIMIT;
    if (slotType == SHIELD_SLOT) return SHIELD_LIMIT;
    revert Errors.InvalidModuleType();
  }

  // Count installed modules in the logical slot (MVP: single StarbaseSlot entry per index)
  function _countInstalledModules(uint256 starbaseHash, uint8 slotType) internal view returns (uint8) {
    uint8 slotIndex = _getSlotIndexForSlotType(slotType);
    StarbaseSlotData memory slot = StarbaseSlot.get(bytes32(starbaseHash), slotIndex);
    if (slot.moduleId > 0 && slot.moduleSlotType == slotType) {
      return 1;
    }
    return 0;
  }

  function _updateStats() internal {
    GlobalStats.setMoveCount(GlobalStats.getMoveCount() + 1); // reuse stat counter
    PlayerStats.setMoveCount(_msgSender(), PlayerStats.getMoveCount(_msgSender()) + 1);
  }

  /**
   * @notice Install a module onto a starbase
   * @param starbaseHash The starbase planet hash
   * @param moduleId The module artifact ID
   */
  function installStarbaseModule(
    uint256 starbaseHash,
    uint32 moduleId
  ) public entryFee requireSameOwnerAndJunkOwner(starbaseHash) {
    _updateStats();
    _processInstallStarbaseModule(starbaseHash, moduleId);
  }

  function _processInstallStarbaseModule(uint256 starbaseHash, uint32 moduleId) internal {
    address worldAddress = _world();
    DFUtils.tick(worldAddress);

    Planet memory starbase = DFUtils.readInitedPlanet(worldAddress, starbaseHash);
    address executor = _msgSender();

    _validateInstall(starbase, executor, starbaseHash, moduleId);
    _executeInstall(starbase, starbaseHash, moduleId);
  }

  function _validateInstall(
    Planet memory starbase,
    address executor,
    uint256 starbaseHash,
    uint32 moduleId
  ) internal view {
    if (starbase.owner != executor) revert Errors.NotPlanetOwner();
    if (starbase.planetType != PlanetType.STARBASE) revert Errors.InvalidPlanetType();

    // Verify module artifact exists and is on this starbase
    // Verify module artifact exists and is on this planet
    if (!starbase.artifactStorage.Has(uint256(moduleId))) {
      revert Errors.ArtifactNotOnPlanet();
    }

    // Verify module artifact type (artifactIndex = 23)
    ArtifactData memory moduleArtifactData = ArtifactTable.get(moduleId);
    if (moduleArtifactData.artifactIndex != 23) revert Errors.InvalidModuleArtifact();

    // Verify module data exists
    CraftedModulesData memory moduleData = CraftedModules.get(moduleId);
    if (moduleData.moduleType == 0) revert Errors.InvalidModuleArtifact();

    // Determine slot type and index
    uint8 slotType = _getSlotTypeForModuleType(moduleData.moduleType);
    uint8 slotIndex = _getSlotIndexForSlotType(slotType);
    StarbaseSlotData memory slot = StarbaseSlot.get(bytes32(starbaseHash), slotIndex);

    // If slot has a module installed
    if (slot.moduleId > 0) {
      // If it's the same module, allow (replacement scenario)
      if (slot.moduleId == moduleId) {
        // Allow replacement - no need to check limits
        return;
      }

      // If it's a different module, check if we've reached the limit
      // Note: For slots that share the same slotIndex (HULL and SHIELD both use index 3),
      // we need to check if the existing module is of the same slotType
      if (slot.moduleSlotType == slotType) {
        // Same slot type - check limit
        uint8 currentCount = _countInstalledModules(starbaseHash, slotType);
        uint8 limit = _getSlotLimit(slotType);
        if (currentCount >= limit) {
          revert Errors.ModuleSlotFull();
        }
      }
      // If slot.moduleSlotType != slotType, it means we're installing a different type
      // in the same slotIndex (e.g., HULL vs SHIELD), which should be allowed
    }
  }

  function _executeInstall(Planet memory starbase, uint256 starbaseHash, uint32 moduleId) internal {
    // Get module and slot info
    CraftedModulesData memory moduleData = CraftedModules.get(moduleId);
    uint8 slotType = _getSlotTypeForModuleType(moduleData.moduleType);
    uint8 slotIndex = _getSlotIndexForSlotType(slotType);

    // Update StarbaseSlot
    StarbaseSlot.set(
      bytes32(starbaseHash),
      slotIndex,
      StarbaseSlotData({ moduleSlotType: slotType, moduleId: moduleId })
    );

    // Mark as installed
    StarBaseModuleInstalled.set(
      moduleId,
      StarBaseModuleInstalledData({ starbaseHash: bytes32(starbaseHash), moduleSlotType: slotType, installed: true })
    );

    // Apply bonuses
    ModuleBonusData memory modBonus = ModuleBonus.get(moduleId);
    starbase.defense = (starbase.defense * (100 + modBonus.defenseBonus)) / 100;
    starbase.speed = (starbase.speed * (100 + modBonus.speedBonus + (modBonus.attackBonus / 2))) / 100;
    starbase.range = (starbase.range * (100 + modBonus.rangeBonus + (modBonus.attackBonus / 2))) / 100;
    // Mark props for update so PlanetProps table gets updated
    starbase.updateProps = true;
    // Remove module from planet storage
    starbase.removeArtifact(moduleId);
    starbase.writeToStore();
    ArtifactOwner.deleteRecord(moduleId);
  }

  /**
   * @notice Uninstall a module from a starbase
   * @param starbaseHash The starbase planet hash
   * @param moduleId The module artifact ID
   */
  function uninstallStarbaseModule(
    uint256 starbaseHash,
    uint32 moduleId
  ) public entryFee requireSameOwnerAndJunkOwner(starbaseHash) {
    _updateStats();
    _processUninstallStarbaseModule(starbaseHash, moduleId);
  }

  function _processUninstallStarbaseModule(uint256 starbaseHash, uint32 moduleId) internal {
    address worldAddress = _world();
    DFUtils.tick(worldAddress);

    Planet memory starbase = DFUtils.readInitedPlanet(worldAddress, starbaseHash);
    address executor = _msgSender();

    _validateUninstall(starbase, executor, starbaseHash, moduleId);
    _executeUninstall(starbase, starbaseHash, moduleId);
  }

  function _validateUninstall(
    Planet memory starbase,
    address executor,
    uint256 starbaseHash,
    uint32 moduleId
  ) internal view {
    if (starbase.owner != executor) revert Errors.NotPlanetOwner();
    if (starbase.planetType != PlanetType.STARBASE) revert Errors.InvalidPlanetType();

    StarBaseModuleInstalledData memory installed = StarBaseModuleInstalled.get(moduleId);
    if (!installed.installed || uint256(installed.starbaseHash) != starbaseHash) {
      revert Errors.ModuleNotInstalled();
    }
  }

  function _executeUninstall(Planet memory starbase, uint256 starbaseHash, uint32 moduleId) internal {
    // Determine slotType from installed record
    StarBaseModuleInstalledData memory installed = StarBaseModuleInstalled.get(moduleId);
    uint8 slotType = installed.moduleSlotType;
    uint8 slotIndex = _getSlotIndexForSlotType(slotType);

    // Remove bonuses (apply inverse of multiplicative factors)
    ModuleBonusData memory modBonus = ModuleBonus.get(moduleId);

    // Defense inverse: current = current * 100 / defenseFactor
    uint256 defFactor = 100 + uint256(modBonus.defenseBonus);
    if (defFactor == 0) defFactor = 100; // guard: treat 0 as 100%
    starbase.defense = uint16((uint256(starbase.defense) * 100) / defFactor);

    // Speed inverse: factor = speedBonus + (attackBonus / 2)
    uint256 spdFactor = 100 + uint256(modBonus.speedBonus) + (uint256(modBonus.attackBonus) / 2);
    if (spdFactor == 0) spdFactor = 100;
    starbase.speed = uint16((uint256(starbase.speed) * 100) / spdFactor);

    // Range inverse: factor = rangeBonus + (attackBonus / 2)
    uint256 rngFactor = 100 + uint256(modBonus.rangeBonus) + (uint256(modBonus.attackBonus) / 2);
    if (rngFactor == 0) rngFactor = 100;
    starbase.range = uint32((uint256(starbase.range) * 100) / rngFactor);
    // Mark props for update so PlanetProps table gets updated
    starbase.updateProps = true;
    // Clear StarbaseSlot entry
    StarbaseSlot.set(bytes32(starbaseHash), slotIndex, StarbaseSlotData({ moduleSlotType: slotType, moduleId: 0 }));
    StarBaseModuleInstalled.set(
      moduleId,
      StarBaseModuleInstalledData({ starbaseHash: bytes32(0), moduleSlotType: 0, installed: false })
    );

    // Ensure storage space then add back to planet artifacts
    if (!starbase.hasArtifactSlot()) revert Errors.ArtifactStorageFull();
    starbase.pushArtifact(moduleId);
    starbase.writeToStore();
    // ArtifactOwner set via writeToStore()
  }
}
