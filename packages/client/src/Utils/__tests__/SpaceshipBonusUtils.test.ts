import { describe, expect, test } from "vitest";
import type { Artifact } from "@df/types";
import { ArtifactType, ArtifactRarity } from "@df/types";
import {
  getSpaceshipBonuses,
  applySpaceshipBonuses,
  type SpaceshipBonuses,
} from "../SpaceshipBonusUtils";

describe("SpaceshipBonusUtils", () => {
  describe("getSpaceshipBonuses", () => {
    test("returns undefined for non-spaceship artifacts", () => {
      const artifact: Artifact = {
        id: "1",
        artifactType: ArtifactType.Bomb,
        rarity: ArtifactRarity.COMMON,
      } as Artifact;

      const mudComponents = {
        SpaceshipBonus: {
          values: {
            attackBonus: new Map([["1", 10]]),
          },
        },
      };

      const result = getSpaceshipBonuses(artifact, mudComponents);
      expect(result).toBeUndefined();
    });

    test("returns bonuses for spaceship artifact", () => {
      const artifact: Artifact = {
        id: "123456789",
        artifactType: ArtifactType.Spaceship,
        rarity: ArtifactRarity.COMMON,
      } as Artifact;

      const artifactIdKey = "123456789"; // uint32 key
      const mudComponents = {
        SpaceshipBonus: {
          values: {
            attackBonus: new Map([[`prefix_${artifactIdKey}_suffix`, 10]]),
            defenseBonus: new Map([[`prefix_${artifactIdKey}_suffix`, 5]]),
            speedBonus: new Map([[`prefix_${artifactIdKey}_suffix`, 15]]),
            rangeBonus: new Map([[`prefix_${artifactIdKey}_suffix`, 8]]),
          },
        },
      };

      const result = getSpaceshipBonuses(artifact, mudComponents);
      expect(result).toBeDefined();
      expect(result?.attackBonus).toBe(10);
      expect(result?.defenseBonus).toBe(5);
      expect(result?.speedBonus).toBe(15);
      expect(result?.rangeBonus).toBe(8);
    });

    test("returns zeros when bonuses not found", () => {
      const artifact: Artifact = {
        id: "999999999",
        artifactType: ArtifactType.Spaceship,
        rarity: ArtifactRarity.COMMON,
      } as Artifact;

      const mudComponents = {
        SpaceshipBonus: {
          values: {
            attackBonus: new Map([["other_key", 10]]),
          },
        },
      };

      const result = getSpaceshipBonuses(artifact, mudComponents);
      expect(result).toBeDefined();
      expect(result?.attackBonus).toBe(0);
      expect(result?.defenseBonus).toBe(0);
      expect(result?.speedBonus).toBe(0);
      expect(result?.rangeBonus).toBe(0);
    });

    test("returns undefined when SpaceshipBonus component missing", () => {
      const artifact: Artifact = {
        id: "1",
        artifactType: ArtifactType.Spaceship,
        rarity: ArtifactRarity.COMMON,
      } as Artifact;

      const mudComponents = {};

      const result = getSpaceshipBonuses(artifact, mudComponents);
      expect(result).toBeUndefined();
    });

    test("handles bigint artifact IDs correctly", () => {
      const artifact: Artifact = {
        id: "18446744073709551615", // Large uint256
        artifactType: ArtifactType.Spaceship,
        rarity: ArtifactRarity.COMMON,
      } as Artifact;

      // Extract uint32 key (lower 32 bits)
      const uint32Id = BigInt(artifact.id) & BigInt("0xFFFFFFFF");
      const artifactIdKey = uint32Id.toString();

      const mudComponents = {
        SpaceshipBonus: {
          values: {
            attackBonus: new Map([[`key_${artifactIdKey}`, 20]]),
          },
        },
      };

      const result = getSpaceshipBonuses(artifact, mudComponents);
      expect(result).toBeDefined();
      expect(result?.attackBonus).toBe(20);
    });

    test("handles invalid artifact ID gracefully", () => {
      const artifact: Artifact = {
        id: "invalid",
        artifactType: ArtifactType.Spaceship,
        rarity: ArtifactRarity.COMMON,
      } as Artifact;

      const mudComponents = {
        SpaceshipBonus: {
          values: {
            attackBonus: new Map([["1", 10]]),
          },
        },
      };

      const result = getSpaceshipBonuses(artifact, mudComponents);
      expect(result).toBeUndefined();
    });
  });

  describe("applySpaceshipBonuses", () => {
    test("applies speed bonus correctly", () => {
      const planet = { speed: 100, range: 50 };
      const bonuses: SpaceshipBonuses = {
        attackBonus: 0,
        defenseBonus: 0,
        speedBonus: 10, // 10% bonus
        rangeBonus: 0,
      };

      const result = applySpaceshipBonuses(planet, bonuses);
      expect(result.speed).toBe(110); // 100 * 1.1
      expect(result.range).toBe(50); // Unchanged
    });

    test("applies range bonus correctly", () => {
      const planet = { speed: 100, range: 50 };
      const bonuses: SpaceshipBonuses = {
        attackBonus: 0,
        defenseBonus: 0,
        speedBonus: 0,
        rangeBonus: 20, // 20% bonus
      };

      const result = applySpaceshipBonuses(planet, bonuses);
      expect(result.speed).toBe(100); // Unchanged
      expect(result.range).toBe(60); // 50 * 1.2
    });

    test("applies both speed and range bonuses", () => {
      const planet = { speed: 100, range: 50 };
      const bonuses: SpaceshipBonuses = {
        attackBonus: 0,
        defenseBonus: 0,
        speedBonus: 15, // 15% bonus
        rangeBonus: 25, // 25% bonus
      };

      const result = applySpaceshipBonuses(planet, bonuses);
      expect(result.speed).toBe(115); // 100 * 1.15
      expect(result.range).toBe(62.5); // 50 * 1.25
    });

    test("does not apply bonuses when values are zero", () => {
      const planet = { speed: 100, range: 50 };
      const bonuses: SpaceshipBonuses = {
        attackBonus: 0,
        defenseBonus: 0,
        speedBonus: 0,
        rangeBonus: 0,
      };

      const result = applySpaceshipBonuses(planet, bonuses);
      expect(result.speed).toBe(100);
      expect(result.range).toBe(50);
    });

    test("handles negative bonuses (should not apply)", () => {
      const planet = { speed: 100, range: 50 };
      const bonuses: SpaceshipBonuses = {
        attackBonus: 0,
        defenseBonus: 0,
        speedBonus: -5, // Negative bonus
        rangeBonus: 0,
      };

      const result = applySpaceshipBonuses(planet, bonuses);
      expect(result.speed).toBe(100); // Should not apply negative bonus
      expect(result.range).toBe(50);
    });

    test("handles fractional results correctly", () => {
      const planet = { speed: 100, range: 33 };
      const bonuses: SpaceshipBonuses = {
        attackBonus: 0,
        defenseBonus: 0,
        speedBonus: 7, // 7% bonus
        rangeBonus: 3, // 3% bonus
      };

      const result = applySpaceshipBonuses(planet, bonuses);
      expect(result.speed).toBe(107); // 100 * 1.07
      expect(result.range).toBeCloseTo(33.99, 1); // 33 * 1.03
    });
  });
});
