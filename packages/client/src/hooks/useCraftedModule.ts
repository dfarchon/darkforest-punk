import { useMUD } from "@mud/MUDContext";
import type { Artifact } from "@df/types";
import { ArtifactType } from "@df/types";

export interface CraftedModuleData {
  moduleType: number;
  biome: number;
  rarity: number;
  attackBonus: number;
  defenseBonus: number;
  speedBonus: number;
  rangeBonus: number;
  crafter: string;
  craftedAt: bigint;
}

export function useCraftedModuleByArtifact(
  artifact: Artifact,
): CraftedModuleData | undefined {
  const {
    components: { CraftedModules, ModuleBonus },
  } = useMUD();

  // Check if this is a module artifact
  if (artifact.artifactType !== ArtifactType.SpaceshipModule) {
    return undefined;
  }

  // Use artifact ID as the key for both tables
  const artifactId = Number(artifact.id);

  // Try direct map access like 3D viewport instead of useComponentValue
  const moduleTypeMap = CraftedModules?.values?.moduleType;
  let moduleType: number | undefined;

  if (moduleTypeMap) {
    // Find the correct key by iterating through all keys (same method as 3D viewport)
    for (const [key, value] of moduleTypeMap.entries()) {
      const keyString = key.toString();
      if (keyString.includes(artifactId.toString())) {
        moduleType = value as number;
        break;
      }
    }
  }

  if (!moduleType) {
    return undefined;
  }

  // Try direct map access for bonus data like we did for module type
  const attackBonusMap = ModuleBonus?.values?.attackBonus;
  const defenseBonusMap = ModuleBonus?.values?.defenseBonus;
  const speedBonusMap = ModuleBonus?.values?.speedBonus;
  const rangeBonusMap = ModuleBonus?.values?.rangeBonus;

  let attackBonus = 0;
  let defenseBonus = 0;
  let speedBonus = 0;
  let rangeBonus = 0;

  // Find bonus values by iterating through maps
  if (attackBonusMap) {
    for (const [key, value] of attackBonusMap.entries()) {
      const keyString = key.toString();
      if (keyString.includes(artifactId.toString())) {
        attackBonus = value as number;
        break;
      }
    }
  }

  if (defenseBonusMap) {
    for (const [key, value] of defenseBonusMap.entries()) {
      const keyString = key.toString();
      if (keyString.includes(artifactId.toString())) {
        defenseBonus = value as number;
        break;
      }
    }
  }

  if (speedBonusMap) {
    for (const [key, value] of speedBonusMap.entries()) {
      const keyString = key.toString();
      if (keyString.includes(artifactId.toString())) {
        speedBonus = value as number;
        break;
      }
    }
  }

  if (rangeBonusMap) {
    for (const [key, value] of rangeBonusMap.entries()) {
      const keyString = key.toString();
      if (keyString.includes(artifactId.toString())) {
        rangeBonus = value as number;
        break;
      }
    }
  }

  // Return module data with bonus data
  return {
    moduleType: moduleType,
    biome: 0, // We'll use artifact.planetBiome in the component
    rarity: 0, // Default rarity
    attackBonus: attackBonus,
    defenseBonus: defenseBonus,
    speedBonus: speedBonus,
    rangeBonus: rangeBonus,
    crafter: "0x0", // Default crafter
    craftedAt: BigInt(0), // Default craftedAt
  };
}
