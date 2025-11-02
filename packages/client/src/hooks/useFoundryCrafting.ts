import { useState, useEffect, useCallback } from "react";
import { useMUD } from "@mud/MUDContext";
import type { LocationId } from "@df/types";

export interface FoundryCraftingData {
  count: number;
  lastCraftTime: number;
  multiplier: number;
}

export function useFoundryCrafting(foundryHash: LocationId | undefined) {
  const { worldContract } = useMUD();
  const [craftingData, setCraftingData] = useState<FoundryCraftingData>({
    count: 0,
    lastCraftTime: 0,
    multiplier: 1.0,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchCraftingData = useCallback(async () => {
    if (!foundryHash || !worldContract) return;

    setLoading(true);
    setError(null);

    try {
      // Get crafting count
      const [count, lastCraftTime] =
        await worldContract.read.getFoundryCraftingCount([BigInt(foundryHash)]);

      // Get crafting multiplier
      const multiplier = await worldContract.read.getCraftingMultiplier([
        BigInt(foundryHash),
      ]);

      setCraftingData({
        count: Number(count),
        lastCraftTime: Number(lastCraftTime),
        multiplier: Number(multiplier) / 100, // Convert from percentage to decimal
      });
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to fetch crafting data";
      setError(errorMessage);
      console.error("Error fetching foundry crafting data:", err);
    } finally {
      setLoading(false);
    }
  }, [foundryHash, worldContract]);

  useEffect(() => {
    fetchCraftingData();
  }, [fetchCraftingData]);

  const canCraftMore = craftingData.count < 3;

  return {
    craftingData,
    loading,
    error,
    canCraftMore,
    refetch: fetchCraftingData,
  };
}
