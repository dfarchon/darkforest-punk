import { useMUD } from "@mud/MUDContext";
import { getComponentValue } from "@latticexyz/recs";
import { encodeEntity } from "@latticexyz/store-sync/recs";
import { locationIdToHexStr } from "@df/serde";
import type { LocationId } from "@df/types";

export interface FoundryCraftingData {
  count: number;
  lastCraftTime: number;
}

export function useFoundryCraftingCount(foundryHash: LocationId | undefined) {
  const { components } = useMUD();

  // Try to get the FoundryCraftingCount component
  const FoundryCraftingCount = components.FoundryCraftingCount;

  if (!FoundryCraftingCount || !foundryHash) {
    // Component not available or foundryHash is undefined, return default values
    return {
      count: 0,
      lastCraftTime: 0,
      isAvailable: false,
    };
  }

  // Create entity key for the foundry
  // Convert LocationId to proper hex string format using serde function
  const foundryHashHex = locationIdToHexStr(foundryHash);

  const foundryEntity = encodeEntity(FoundryCraftingCount.metadata.keySchema, {
    foundryHash: foundryHashHex,
  });

  // Get the crafting data
  const craftingData = getComponentValue(FoundryCraftingCount, foundryEntity);

  return {
    count: craftingData?.count || 0,
    lastCraftTime: craftingData?.lastCraftTime || 0,
    isAvailable: true,
  };
}
