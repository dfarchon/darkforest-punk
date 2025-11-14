import { useMUD } from "@mud/MUDContext";
import type { Artifact, ArtifactId } from "@df/types";
import { artifactIdFromHexStr } from "@df/serde";
import { useMemo } from "react";

export interface InstalledModuleInfo {
  moduleId: ArtifactId;
  moduleType: number;
  moduleSlotType: number;
}

/**
 * Hook to get installed modules for a spaceship artifact
 * Returns array of installed module information
 */
export function useInstalledModules(
  spaceshipArtifact: Artifact | undefined,
): InstalledModuleInfo[] {
  const {
    components: { SpaceshipModuleInstalled, CraftedModules },
  } = useMUD();

  return useMemo(() => {
    if (
      !spaceshipArtifact ||
      !SpaceshipModuleInstalled?.values ||
      !CraftedModules?.values
    ) {
      return [];
    }

    const modules: InstalledModuleInfo[] = [];
    // Convert artifact ID to number for comparison
    // artifact.id is a hex string (padded to 64 chars), need to parse as hex
    const artifactIdStr = spaceshipArtifact.id.toString();
    // Remove 0x prefix if present, then parse as hex
    const cleanHex = artifactIdStr.startsWith("0x")
      ? artifactIdStr.slice(2)
      : artifactIdStr;
    const spaceshipIdNum = parseInt(cleanHex, 16);
    // Get all maps from SpaceshipModuleInstalled component
    const installedMap = SpaceshipModuleInstalled.values.artifactId;
    const slotTypeMap = SpaceshipModuleInstalled.values.moduleSlotType;
    const installedFlagMap = SpaceshipModuleInstalled.values.installed;
    const moduleTypeMap = CraftedModules.values.moduleType;

    if (!installedMap || !slotTypeMap || !installedFlagMap || !moduleTypeMap) {
      return [];
    }

    // Iterate through all entries in SpaceshipModuleInstalled
    // Filter where artifactId matches spaceship ID
    for (const [moduleIdKey, storedSpaceshipId] of installedMap.entries()) {
      // Get installed flag
      const installedFlag = installedFlagMap.get(moduleIdKey);
      const isInstalled = installedFlag === true;

      // Compare stored spaceshipId with our spaceship ID
      // storedSpaceshipId is already a number/bigint from MUD, convert to number
      const sourceSpaceshipId =
        typeof storedSpaceshipId === "bigint"
          ? Number(storedSpaceshipId)
          : Number(storedSpaceshipId);

      // Direct numeric comparison (both should be decimal numbers now)
      const matchesSpaceship = sourceSpaceshipId === spaceshipIdNum;

      // Only include if matches spaceship and installed flag is true
      if (matchesSpaceship && isInstalled) {
        // Extract moduleId from Symbol key
        const keyString = moduleIdKey.toString();
        const hexMatch = keyString.match(/0x([0-9a-fA-F]+)/);
        if (hexMatch) {
          const hexValue = hexMatch[1];
          const slotType = slotTypeMap.get(moduleIdKey);
          if (hexValue && slotType !== undefined && Number(slotType) > 0) {
            // Convert hex string to full ArtifactId format (properly padded hex string)
            const moduleIdStr = artifactIdFromHexStr("0x" + hexValue);

            // Get module type from CraftedModules using the full artifact ID
            // Use the same lookup pattern as useCraftedModuleByArtifact
            let moduleType: number | undefined;
            // Convert artifact ID to number for lookup (same as useCraftedModuleByArtifact)
            // Note: useCraftedModuleByArtifact uses Number(artifact.id) which treats hex strings as decimal
            // So we need to parse the hex string to get the actual numeric value
            const moduleIdNum = parseInt(moduleIdStr, 16);

            // Find module type by iterating through CraftedModules
            // Match the pattern used in useCraftedModuleByArtifact
            // The key might contain the numeric ID as a string, so we check both formats
            for (const [key, value] of moduleTypeMap.entries()) {
              const moduleKeyString = key.toString();
              // Check if the key contains the module ID (same approach as useCraftedModuleByArtifact)
              // Try both the numeric string and the hex string representation
              const numericStr = moduleIdNum.toString();
              const hexStr = moduleIdNum.toString(16);
              if (
                moduleKeyString.includes(numericStr) ||
                moduleKeyString.includes(hexStr) ||
                moduleKeyString.includes(moduleIdStr)
              ) {
                moduleType = value as number;
                let matchType = "fullId";
                if (moduleKeyString.includes(numericStr)) {
                  matchType = "numeric";
                } else if (moduleKeyString.includes(hexStr)) {
                  matchType = "hex";
                }
                break;
              }
            }

            // If module type found and valid, add to modules list
            if (
              moduleType !== undefined &&
              moduleType >= 1 &&
              moduleType <= 4
            ) {
              modules.push({
                moduleId: moduleIdStr,
                moduleType: moduleType,
                moduleSlotType: Number(slotType),
              });
            }
          }
        }
      }
    }

    return modules;
  }, [spaceshipArtifact, SpaceshipModuleInstalled, CraftedModules]);
}
