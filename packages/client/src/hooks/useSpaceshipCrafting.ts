import { useState, useCallback } from "react";
import { useMUD } from "@mud/MUDContext";
import type { LocationId, MaterialType, Biome } from "@df/types";
import type { SpaceshipType } from "../Shared/types/artifact";

export interface SpaceshipCraftingParams {
  foundryHash: LocationId;
  spaceshipType: SpaceshipType;
  materials: MaterialType[];
  amounts: bigint[];
  biome: Biome;
}

export interface CraftingState {
  isCrafting: boolean;
  error: string | null;
  success: boolean;
}

export function useSpaceshipCrafting() {
  const { systems } = useMUD();
  const [craftingState, setCraftingState] = useState<CraftingState>({
    isCrafting: false,
    error: null,
    success: false,
  });

  const craftSpaceship = useCallback(
    async (params: SpaceshipCraftingParams) => {
      setCraftingState({
        isCrafting: true,
        error: null,
        success: false,
      });

      try {
        await systems.craftSpaceship(
          BigInt(params.foundryHash),
          params.spaceshipType,
          params.materials,
          params.amounts,
          params.biome,
        );

        setCraftingState({
          isCrafting: false,
          error: null,
          success: true,
        });

        return { success: true };
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "Unknown error occurred";

        setCraftingState({
          isCrafting: false,
          error: errorMessage,
          success: false,
        });

        return { success: false, error: errorMessage };
      }
    },
    [systems],
  );

  const resetCraftingState = useCallback(() => {
    setCraftingState({
      isCrafting: false,
      error: null,
      success: false,
    });
  }, []);

  return {
    craftSpaceship,
    craftingState,
    resetCraftingState,
  };
}
