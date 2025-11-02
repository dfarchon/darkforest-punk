import { useMUD } from "@mud/MUDContext";
import type { Artifact } from "@df/types";

export interface CraftedSpaceshipData {
  spaceshipType: number;
  biome: number;
  rarity: number;
  attackBonus: number;
  defenseBonus: number;
  speedBonus: number;
  rangeBonus: number;
  crafter: string;
  craftedAt: bigint;
  nftTokenId: bigint;
}

export function useCraftedSpaceshipByArtifact(
  artifact: Artifact,
): CraftedSpaceshipData | undefined {
  const {
    components: { CraftedSpaceship, SpaceshipBonus },
  } = useMUD();

  // Check if this is a spaceship artifact
  if (artifact.artifactType !== 3) {
    return undefined;
  }

  // Use artifact ID as the key for both tables
  const artifactId = Number(artifact.id);

  // Try direct map access like 3D viewport instead of useComponentValue
  const spaceshipTypeMap = CraftedSpaceship?.values?.spaceshipType;
  let spaceshipType: number | undefined;

  if (spaceshipTypeMap) {
    // Find the correct key by iterating through all keys (same method as 3D viewport)
    for (const [key, value] of spaceshipTypeMap.entries()) {
      const keyString = key.toString();
      if (keyString.includes(artifactId.toString())) {
        spaceshipType = value as number;
        break;
      }
    }
  }

  if (!spaceshipType) {
    return undefined;
  }

  // Try direct map access for bonus data like we did for spaceship type
  const attackBonusMap = SpaceshipBonus?.values?.attackBonus;
  const defenseBonusMap = SpaceshipBonus?.values?.defenseBonus;
  const speedBonusMap = SpaceshipBonus?.values?.speedBonus;
  const rangeBonusMap = SpaceshipBonus?.values?.rangeBonus;

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

  // Return spaceship data with bonus data
  return {
    spaceshipType: spaceshipType,
    biome: 0, // We'll use artifact.planetBiome in the component
    rarity: 0, // Default rarity
    attackBonus: attackBonus,
    defenseBonus: defenseBonus,
    speedBonus: speedBonus,
    rangeBonus: rangeBonus,
    crafter: "0x0", // Default crafter
    craftedAt: BigInt(0), // Default craftedAt
    nftTokenId: BigInt(0), // Default nftTokenId
  };
}
