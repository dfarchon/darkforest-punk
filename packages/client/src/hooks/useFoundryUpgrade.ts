import { useMUD } from "@mud/MUDContext";
import { useComponentValue } from "@latticexyz/react";
import { encodeEntity } from "@latticexyz/store-sync/recs";
import { locationIdToHexStr } from "@df/serde";
import type { LocationId } from "../Shared/types/planet";

export interface FoundryUpgradeData {
  level: number;
  maxCrafts: number;
}

/**
 * Hook to get foundry upgrade level and max crafts capacity
 */
export function useFoundryUpgradeLevel(
  foundryHash: LocationId | undefined,
): FoundryUpgradeData {
  const { components } = useMUD();
  const { FoundryUpgrade } = components;

  if (!FoundryUpgrade || !foundryHash) {
    return { level: 0, maxCrafts: 1 };
  }

  // Convert LocationId to proper hex string format using serde function
  const foundryHashHex = locationIdToHexStr(foundryHash);

  const foundryEntity = encodeEntity(FoundryUpgrade.metadata.keySchema, {
    foundryHash: foundryHashHex,
  });

  const upgradeData = useComponentValue(FoundryUpgrade, foundryEntity);

  const level = upgradeData?.branchLevel || 0;
  const maxCrafts = 1 + level; // Level 0 = 1 craft, Level 1 = 2 crafts, Level 2 = 3 crafts

  return { level, maxCrafts };
}
