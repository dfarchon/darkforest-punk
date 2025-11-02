import type { Artifact } from "@df/types";

export interface SpaceshipBonuses {
  attackBonus: number;
  defenseBonus: number;
  speedBonus: number;
  rangeBonus: number;
}

/**
 * Gets spaceship bonuses for a given spaceship artifact from MUD store
 */
export function getSpaceshipBonuses(
  artifact: Artifact,
  mudComponents: {
    SpaceshipBonus?: {
      values?: {
        attackBonus?: Map<string, number>;
        defenseBonus?: Map<string, number>;
        speedBonus?: Map<string, number>;
        rangeBonus?: Map<string, number>;
      };
    };
  },
): SpaceshipBonuses | undefined {
  //   console.log("getSpaceshipBonuses called:", {
  //     artifactId: artifact.id,
  //     artifactType: artifact.artifactType,
  //     mudComponents: mudComponents.SpaceshipBonus,
  //     bonusMaps: mudComponents.SpaceshipBonus?.values,
  //   });

  if (artifact.artifactType !== 3) {
    console.log("Not a spaceship artifact (type 3), returning undefined");
    return undefined;
  }

  // Convert artifact.id (uint256) to uint32 key for SpaceshipBonus table
  // The SpaceshipBonus table is keyed by artifactId: "uint32"
  let spaceshipArtifactIdKey: string;
  try {
    const fullArtifactId = BigInt(artifact.id);
    const uint32Mask = BigInt("0xFFFFFFFF"); // Mask for the lower 32 bits
    const uint32Id = fullArtifactId & uint32Mask;
    spaceshipArtifactIdKey = uint32Id.toString();
  } catch (e) {
    console.error("Error converting artifact.id to uint32 key:", e);
    return undefined;
  }

  const bonusMaps = mudComponents.SpaceshipBonus?.values;

  if (!bonusMaps) {
    console.log("No bonus maps found, returning undefined");
    return undefined;
  }

  let attackBonus = 0;
  let defenseBonus = 0;
  let speedBonus = 0;
  let rangeBonus = 0;

  // Find bonus values by iterating through maps
  if (bonusMaps.attackBonus) {
    for (const [key, value] of bonusMaps.attackBonus.entries()) {
      const keyString = key.toString();
      if (keyString.includes(spaceshipArtifactIdKey)) {
        attackBonus = value;
        break;
      }
    }
  }

  if (bonusMaps.defenseBonus) {
    for (const [key, value] of bonusMaps.defenseBonus.entries()) {
      const keyString = key.toString();
      if (keyString.includes(spaceshipArtifactIdKey)) {
        defenseBonus = value;
        break;
      }
    }
  }

  if (bonusMaps.speedBonus) {
    for (const [key, value] of bonusMaps.speedBonus.entries()) {
      const keyString = key.toString();
      if (keyString.includes(spaceshipArtifactIdKey)) {
        speedBonus = value;
        break;
      }
    }
  }

  if (bonusMaps.rangeBonus) {
    for (const [key, value] of bonusMaps.rangeBonus.entries()) {
      const keyString = key.toString();
      if (keyString.includes(spaceshipArtifactIdKey)) {
        rangeBonus = value;
        break;
      }
    }
  }

  const result = {
    attackBonus,
    defenseBonus,
    speedBonus,
    rangeBonus,
  };

  //   console.log("getSpaceshipBonuses result:", {
  //     spaceshipArtifactIdKey,
  //     result,
  //   });

  return result;
}

/**
 * Applies spaceship bonuses to planet stats for movement calculations
 */
export function applySpaceshipBonuses(
  planet: { speed: number; range: number },
  bonuses: SpaceshipBonuses,
): { speed: number; range: number } {
  let modifiedSpeed = planet.speed;
  let modifiedRange = planet.range;

  if (bonuses.speedBonus > 0) {
    modifiedSpeed = planet.speed * ((100 + bonuses.speedBonus) / 100);
  }

  if (bonuses.rangeBonus > 0) {
    modifiedRange = planet.range * ((100 + bonuses.rangeBonus) / 100);
  }

  return {
    speed: modifiedSpeed,
    range: modifiedRange,
  };
}
