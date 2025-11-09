import { useState, useCallback } from "react";
import { useMUD } from "@mud/MUDContext";
import type { LocationId, MaterialType, Biome } from "@df/types";
import type { ModuleType } from "../Shared/types/artifact";

export interface ModuleCraftingParams {
  foundryHash: LocationId;
  moduleType: ModuleType; // 1=Engine, 2=Weapon, 3=Hull, 4=Shield
  materials: MaterialType[];
  amounts: bigint[];
  biome: Biome;
}

export interface CraftingState {
  isCrafting: boolean;
  error: string | null;
  success: boolean;
}

export function useModuleCrafting() {
  const mud = useMUD();
  // systems comes from MUD's auto-generated types - use type assertion until ABI is regenerated
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const systems = (mud as any).systems as {
    craftModule: (
      foundryHash: bigint,
      moduleType: number,
      materials: MaterialType[],
      amounts: bigint[],
      biome: Biome,
    ) => Promise<void>;
  };
  const [craftingState, setCraftingState] = useState<CraftingState>({
    isCrafting: false,
    error: null,
    success: false,
  });

  const craftModule = useCallback(
    async (params: ModuleCraftingParams) => {
      setCraftingState({
        isCrafting: true,
        error: null,
        success: false,
      });

      try {
        await systems.craftModule(
          BigInt(params.foundryHash),
          params.moduleType,
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
    craftModule,
    craftingState,
    resetCraftingState,
  };
}
