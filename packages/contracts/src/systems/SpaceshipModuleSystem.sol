// SPDX-License-Identifier: GPL-3.0
pragma solidity >=0.8.24;

import { BaseSystem } from "systems/internal/BaseSystem.sol";
import { Planet } from "libraries/Planet.sol";
import { Artifact } from "libraries/Artifact.sol";
import { DFUtils } from "libraries/DFUtils.sol";
import { GlobalStats } from "codegen/tables/GlobalStats.sol";
import { PlayerStats } from "codegen/tables/PlayerStats.sol";
import { CraftedSpaceship, CraftedSpaceshipData } from "codegen/tables/CraftedSpaceship.sol";
import { CraftedModules, CraftedModulesData } from "codegen/tables/CraftedModules.sol";
import { SpaceshipSlot, SpaceshipSlotData } from "codegen/tables/SpaceshipSlot.sol";
import { SpaceshipModuleInstalled } from "codegen/tables/SpaceshipModuleInstalled.sol";
import { SpaceshipModuleInstalledData } from "codegen/tables/SpaceshipModuleInstalled.sol";
import { Artifact as ArtifactTable, ArtifactData } from "codegen/tables/Artifact.sol";
import { ArtifactOwner } from "codegen/tables/ArtifactOwner.sol";
import { SpaceshipBonus, SpaceshipBonusData } from "codegen/tables/SpaceshipBonus.sol";
import { ModuleBonus, ModuleBonusData } from "codegen/tables/ModuleBonus.sol";
import { Errors } from "interfaces/errors.sol";

contract SpaceshipModuleSystem is BaseSystem {
  // Module slot types (matching constants.sol)
  uint8 constant ENGINES_SLOT = 1;
  uint8 constant WEAPONS_SLOT = 2;
  uint8 constant HULL_SLOT = 3;
  uint8 constant SHIELD_SLOT = 4;

  // Module slot index mapping (for SpaceshipSlot table key)
  // moduleSlotType -> moduleSlotindex: 1=ENGINES->1, 2=WEAPONS->2, 3=HULL->3, 4=SHIELD->3
  function _getSlotIndexForSlotType(uint8 slotType) internal pure returns (uint8) {
    if (slotType == ENGINES_SLOT) return 1;
    if (slotType == WEAPONS_SLOT) return 2;
    if (slotType == HULL_SLOT || slotType == SHIELD_SLOT) return 3;
    revert Errors.InvalidModuleType();
  }

  // Module type to slot type mapping
  // Module types: 1=Engine, 2=Weapon, 3=Hull, 4=Shield
  // Slot types: 1=ENGINES, 2=WEAPONS, 3=HULL, 4=SHIELD
  function _getSlotTypeForModuleType(uint8 moduleType) internal pure returns (uint8) {
    if (moduleType == 1) return ENGINES_SLOT;
    if (moduleType == 2) return WEAPONS_SLOT;
    if (moduleType == 3) return HULL_SLOT;
    if (moduleType == 4) return SHIELD_SLOT;
    revert Errors.InvalidModuleType();
  }

  // Module limits per spaceship type (from constants.sol)
  function _getModuleLimit(uint8 spaceshipType, uint8 slotType) internal pure returns (uint8) {
    if (spaceshipType == 1) {
      // Scout
      if (slotType == ENGINES_SLOT) return 1;
      if (slotType == WEAPONS_SLOT) return 1;
      if (slotType == HULL_SLOT) return 1;
      if (slotType == SHIELD_SLOT) return 1;
    } else if (spaceshipType == 2) {
      // Fighter
      if (slotType == ENGINES_SLOT) return 2;
      if (slotType == WEAPONS_SLOT) return 2;
      if (slotType == HULL_SLOT) return 2;
      if (slotType == SHIELD_SLOT) return 2;
    } else if (spaceshipType == 3) {
      // Destroyer
      if (slotType == ENGINES_SLOT) return 3;
      if (slotType == WEAPONS_SLOT) return 4;
      if (slotType == HULL_SLOT) return 2;
      if (slotType == SHIELD_SLOT) return 2;
    } else if (spaceshipType == 4) {
      // Carrier
      if (slotType == ENGINES_SLOT) return 4;
      if (slotType == WEAPONS_SLOT) return 2;
      if (slotType == HULL_SLOT) return 4;
      if (slotType == SHIELD_SLOT) return 4;
    }
    revert Errors.InvalidSpaceshipType();
  }

  function _countInstalledModules(uint32 spaceshipId, uint8 slotType) internal view returns (uint8) {
    uint8 count = 0;
    // Iterate through all SpaceshipSlot entries to count modules in this slot
    // Note: This is a simplified approach. In production, you might want to maintain a counter table
    // For now, we'll check if there's a module installed in this specific slot
    uint8 slotIndex = _getSlotIndexForSlotType(slotType);
    SpaceshipSlotData memory slot = SpaceshipSlot.get(spaceshipId, slotIndex);
    // Check if the slot has a module and if it matches the slotType
    if (slot.moduleId > 0 && slot.moduleSlotType == slotType) {
      count = 1;
    }
    // TODO: Support multiple modules per slot (for spaceships that allow >1 module per slot type)
    // This would require iterating through all entries or maintaining a better data structure
    return count;
  }

  /**
   * @notice Install a module on a spaceship
   * @param spaceshipId The spaceship artifact ID
   * @param moduleId The module artifact ID
   * @param planetHash The planet hash where the spaceship is located
   */
  function installModule(
    uint32 spaceshipId,
    uint32 moduleId,
    uint256 planetHash
  ) public entryFee requireSameOwnerAndJunkOwner(planetHash) {
    _updateStats();
    _processInstallModule(spaceshipId, moduleId, planetHash);
  }

  function _updateStats() internal {
    GlobalStats.setMoveCount(GlobalStats.getMoveCount() + 1); // Reuse move count for now
    PlayerStats.setMoveCount(_msgSender(), PlayerStats.getMoveCount(_msgSender()) + 1);
  }

  function _processInstallModule(uint32 spaceshipId, uint32 moduleId, uint256 planetHash) internal {
    address worldAddress = _world();
    DFUtils.tick(worldAddress);

    Planet memory planet = DFUtils.readInitedPlanet(worldAddress, planetHash);
    address executor = _msgSender();

    _validateInstallModule(planet, executor, spaceshipId, moduleId);
    _executeInstallModule(spaceshipId, moduleId, planet);
  }

  function _validateInstallModule(
    Planet memory planet,
    address executor,
    uint32 spaceshipId,
    uint32 moduleId
  ) internal view {
    // Check planet ownership
    if (planet.owner != executor) revert Errors.NotPlanetOwner();

    // Verify spaceship artifact exists and is on this planet
    // ArtifactOwner is the source of truth for artifact location
    bytes32 spaceshipPlanetHash = ArtifactOwner.get(spaceshipId);
    if (spaceshipPlanetHash == bytes32(0)) {
      revert Errors.ArtifactNotOnPlanet1();
    }
    if (uint256(spaceshipPlanetHash) != planet.planetHash) {
      revert Errors.ArtifactNotOnPlanet1();
    }

    // Verify spaceship is actually a spaceship (artifactIndex = 3)
    ArtifactData memory spaceshipArtifactData = ArtifactTable.get(spaceshipId);
    if (spaceshipArtifactData.artifactIndex != 3) {
      revert Errors.InvalidSpaceshipArtifact();
    }

    // Verify module artifact exists and is on this planet
    // ArtifactOwner is the source of truth for artifact location
    bytes32 modulePlanetHash = ArtifactOwner.get(moduleId);
    if (modulePlanetHash == bytes32(0)) {
      revert Errors.ArtifactNotOnPlanet2();
    }
    if (uint256(modulePlanetHash) != planet.planetHash) {
      revert Errors.ArtifactNotOnPlanet2();
    }

    // Verify module is actually a module (artifactIndex = 23)
    ArtifactData memory moduleArtifactData = ArtifactTable.get(moduleId);
    if (moduleArtifactData.artifactIndex != 23) {
      revert Errors.InvalidModuleArtifact();
    }

    // Check if module is already installed
    SpaceshipModuleInstalledData memory installed = SpaceshipModuleInstalled.get(moduleId);
    if (installed.installed && installed.artifactId > 0) {
      if (installed.artifactId != spaceshipId) {
        // Module is installed on a different spaceship
        revert Errors.ModuleAlreadyInstalled();
      }
      // Module is already installed on this spaceship - allow replacement
      // (validation will continue to check slot limits if needed)
    }

    // Get spaceship type from CraftedSpaceship table
    CraftedSpaceshipData memory spaceshipData = CraftedSpaceship.get(spaceshipId);
    if (spaceshipData.spaceshipType == 0) {
      revert Errors.InvalidSpaceshipArtifact();
    }

    // Get module type from CraftedModules table
    CraftedModulesData memory moduleData = CraftedModules.get(moduleId);
    if (moduleData.moduleType == 0) {
      revert Errors.InvalidModuleArtifact();
    }

    // Determine slot type from module type
    uint8 slotType = _getSlotTypeForModuleType(moduleData.moduleType);

    // Check if slot is already occupied
    uint8 slotIndex = _getSlotIndexForSlotType(slotType);
    SpaceshipSlotData memory slot = SpaceshipSlot.get(spaceshipId, slotIndex);

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
        uint8 currentCount = _countInstalledModules(spaceshipId, slotType);
        uint8 limit = _getModuleLimit(spaceshipData.spaceshipType, slotType);
        if (currentCount >= limit) {
          revert Errors.ModuleSlotFull();
        }
      }
      // If slot.moduleSlotType != slotType, it means we're installing a different type
      // in the same slotIndex (e.g., HULL vs SHIELD), which should be allowed
    }
    // If slot.moduleId == 0, slot is empty, allow installation
  }

  function _executeInstallModule(uint32 spaceshipId, uint32 moduleId, Planet memory planet) internal {
    // Get module type to determine slot type
    CraftedModulesData memory moduleData = CraftedModules.get(moduleId);
    uint8 slotType = _getSlotTypeForModuleType(moduleData.moduleType);

    // Get slot index for this slot type
    uint8 slotIndex = _getSlotIndexForSlotType(slotType);

    // If slot is empty or we're replacing, update SpaceshipSlot table
    SpaceshipSlot.set(spaceshipId, slotIndex, SpaceshipSlotData({ moduleSlotType: slotType, moduleId: moduleId }));

    // Update SpaceshipModuleInstalled table (keyed by moduleId)
    SpaceshipModuleInstalled.set(
      moduleId,
      SpaceshipModuleInstalledData({ artifactId: spaceshipId, moduleSlotType: slotType, installed: true })
    );

    // Get current spaceship bonuses
    SpaceshipBonusData memory spaceshipBonuses = SpaceshipBonus.get(spaceshipId);
    ModuleBonusData memory newModuleBonuses = ModuleBonus.get(moduleId);
    // Calculate new bonuses (add new module bonuses to current spaceship bonuses)
    uint16 newAttackBonus = spaceshipBonuses.attackBonus + newModuleBonuses.attackBonus;
    uint16 newDefenseBonus = spaceshipBonuses.defenseBonus + newModuleBonuses.defenseBonus;
    uint16 newSpeedBonus = spaceshipBonuses.speedBonus + newModuleBonuses.speedBonus;
    uint16 newRangeBonus = spaceshipBonuses.rangeBonus + newModuleBonuses.rangeBonus;

    // Update spaceship bonuses
    SpaceshipBonus.setAttackBonus(spaceshipId, newAttackBonus);
    SpaceshipBonus.setDefenseBonus(spaceshipId, newDefenseBonus);
    SpaceshipBonus.setSpeedBonus(spaceshipId, newSpeedBonus);
    SpaceshipBonus.setRangeBonus(spaceshipId, newRangeBonus);

    // Remove module from planet's artifact storage
    planet.removeArtifact(moduleId);

    // Persist planet changes to storage
    planet.writeToStore();

    // Delete ArtifactOwner record since module is no longer on the planet
    ArtifactOwner.deleteRecord(moduleId);
  }

  /**
   * @notice Uninstall a module from a spaceship
   * @param spaceshipId The spaceship artifact ID
   * @param moduleId The module artifact ID
   * @param planetHash The planet hash where the spaceship is located
   */
  function uninstallModule(
    uint32 spaceshipId,
    uint32 moduleId,
    uint256 planetHash
  ) public entryFee requireSameOwnerAndJunkOwner(planetHash) {
    _updateStats();
    _processUninstallModule(spaceshipId, moduleId, planetHash);
  }

  function _processUninstallModule(uint32 spaceshipId, uint32 moduleId, uint256 planetHash) internal {
    address worldAddress = _world();
    DFUtils.tick(worldAddress);

    Planet memory planet = DFUtils.readInitedPlanet(worldAddress, planetHash);
    address executor = _msgSender();

    _validateUninstallModule(planet, executor, spaceshipId, moduleId);
    _executeUninstallModule(spaceshipId, moduleId, planet);
  }

  function _validateUninstallModule(
    Planet memory planet,
    address executor,
    uint32 spaceshipId,
    uint32 moduleId
  ) internal view {
    // Check planet ownership
    if (planet.owner != executor) revert Errors.NotPlanetOwner();

    // Verify spaceship artifact exists on this planet
    if (!planet.artifactStorage.Has(uint256(spaceshipId))) {
      revert Errors.ArtifactNotOnPlanet3();
    }

    // Verify module is installed on this spaceship
    SpaceshipModuleInstalledData memory installed = SpaceshipModuleInstalled.get(moduleId);
    if (installed.artifactId != spaceshipId) {
      revert Errors.ModuleNotInstalled();
    }
  }

  function _executeUninstallModule(uint32 spaceshipId, uint32 moduleId, Planet memory planet) internal {
    // Get slot type from SpaceshipModuleInstalled
    SpaceshipModuleInstalledData memory installed = SpaceshipModuleInstalled.get(moduleId);
    uint8 slotType = installed.moduleSlotType;

    // Subtract module bonuses from spaceship bonuses
    SpaceshipBonusData memory spaceshipBonuses = SpaceshipBonus.get(spaceshipId);
    ModuleBonusData memory moduleBonuses = ModuleBonus.get(moduleId);

    // Calculate new bonuses (subtract module bonuses from current spaceship bonuses)
    // Use underflow protection: if result would be negative, set to 0
    uint16 newAttackBonus = spaceshipBonuses.attackBonus >= moduleBonuses.attackBonus
      ? spaceshipBonuses.attackBonus - moduleBonuses.attackBonus
      : 0;
    uint16 newDefenseBonus = spaceshipBonuses.defenseBonus >= moduleBonuses.defenseBonus
      ? spaceshipBonuses.defenseBonus - moduleBonuses.defenseBonus
      : 0;
    uint16 newSpeedBonus = spaceshipBonuses.speedBonus >= moduleBonuses.speedBonus
      ? spaceshipBonuses.speedBonus - moduleBonuses.speedBonus
      : 0;
    uint16 newRangeBonus = spaceshipBonuses.rangeBonus >= moduleBonuses.rangeBonus
      ? spaceshipBonuses.rangeBonus - moduleBonuses.rangeBonus
      : 0;

    // Update spaceship bonuses
    SpaceshipBonus.setAttackBonus(spaceshipId, newAttackBonus);
    SpaceshipBonus.setDefenseBonus(spaceshipId, newDefenseBonus);
    SpaceshipBonus.setSpeedBonus(spaceshipId, newSpeedBonus);
    SpaceshipBonus.setRangeBonus(spaceshipId, newRangeBonus);

    // Clear SpaceshipSlot entry
    uint8 slotIndex = _getSlotIndexForSlotType(slotType);
    SpaceshipSlot.set(spaceshipId, slotIndex, SpaceshipSlotData({ moduleSlotType: slotType, moduleId: 0 }));

    // Clear SpaceshipModuleInstalled entry
    SpaceshipModuleInstalled.set(
      moduleId,
      SpaceshipModuleInstalledData({ artifactId: 0, moduleSlotType: 0, installed: false })
    );

    // Check if planet has space for the module
    if (!planet.hasArtifactSlot()) {
      revert Errors.ArtifactStorageFull();
    }

    // Add module back to planet's artifact storage
    planet.pushArtifact(moduleId);

    // Persist planet changes to storage
    planet.writeToStore();

    // ArtifactOwner is automatically set by planet.writeToStore() via ArtifactStorage.WriteToStore()
  }
}
