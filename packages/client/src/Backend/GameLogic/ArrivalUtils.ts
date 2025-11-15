import { cloneDeep } from "@backend/Utils/clone-deep";
import { CONTRACT_PRECISION } from "@df/constants";
import { hasOwner, isEmojiFlagMessage } from "@df/gamelogic";
import type {
  Artifact,
  EmojiFlagBody,
  Materials,
  Planet,
  PlanetMessage,
  QueuedArrival,
  Upgrade,
} from "@df/types";
import { getMaxMaterialType, MaterialType, PlanetType } from "@df/types";

import type { ContractConstants } from "../../_types/darkforest/api/ContractsAPITypes";
import type { GuildUtils } from "./GuildUtils";
// TODO: planet class, cmon, let's go
export const blocksLeftToProspectExpiration = (
  currentBlockNumber: number,
  prospectedBlockNumber?: number,
) => {
  return (prospectedBlockNumber || 0) + 255 - currentBlockNumber;
};

// TODO: Planet. Class.
export const prospectExpired = (
  currentBlockNumber: number,
  prospectedBlockNumber: number,
) => {
  return (
    blocksLeftToProspectExpiration(currentBlockNumber, prospectedBlockNumber) <=
    0
  );
};

export const isFindable = (
  planet: Planet,
  currentBlockNumber?: number,
): boolean => {
  return (
    currentBlockNumber !== undefined &&
    planet.planetType === PlanetType.RUINS &&
    planet.prospectedBlockNumber !== undefined &&
    !planet.hasTriedFindingArtifact &&
    !prospectExpired(currentBlockNumber, planet.prospectedBlockNumber)
  );
};

export const isProspectable = (planet: Planet): boolean => {
  return (
    planet.planetType === PlanetType.RUINS &&
    planet.prospectedBlockNumber === undefined
  );
};

const getSilverOverTick = (
  planet: Planet,
  startTick: number,
  endTick: number,
): number => {
  if (!hasOwner(planet)) {
    return planet.silver;
  }

  // SUN planets don't grow silver, only materialsStorage (SOLAR_ENERGY) grows
  if (planet.planetType === PlanetType.SUN) {
    return planet.silver;
  }

  if (planet.silver > planet.silverCap) {
    return planet.silverCap;
  }

  let tickElapsed = endTick - Math.max(startTick, planet.addJunkTick);
  if (planet.owner != planet.junkOwner) {
    tickElapsed = 0;
  }

  return Math.max(
    Math.min(
      tickElapsed * planet.silverGrowth + planet.silver,
      planet.silverCap,
    ),
    0,
  );
};

const getMaterialsOverTick = (
  planet: Planet,
  startTick: number,
  endTick: number,
): Materials[] => {
  if (!hasOwner(planet)) {
    return planet.materials;
  }
  let tickElapsed = endTick - Math.max(startTick, planet.addJunkTick);
  if (planet.owner != planet.junkOwner) {
    tickElapsed = 0;
  }

  // Create a copy of materials to avoid mutating the original
  const updatedMaterials = [...planet.materials];

  // Update materials growth, starting from index 1 (skipping index 0 which is UNKNOWN)
  for (let i = 1; i <= getMaxMaterialType(); i++) {
    // Find the material in the array by materialId, not by array index
    let materialIndex = updatedMaterials.findIndex(
      (mat) => mat.materialId === i,
    );

    // If material doesn't exist in array yet, add it (for SOLAR_ENERGY on SUN planets)
    if (materialIndex === -1) {
      // For SUN planets, SOLAR_ENERGY should have growth enabled by default
      const isSolarEnergyOnSun =
        planet.planetType === PlanetType.SUN && i === MaterialType.SOLAR_ENERGY;
      updatedMaterials.push({
        materialId: i as MaterialType,
        materialAmount: 0,
        cap: planet.silverCap,
        growthRate: planet.silverGrowth / (Number(i) * 2),
        growth: isSolarEnergyOnSun && planet.silverGrowth > 0, // Enable growth for SOLAR_ENERGY on SUN planets
        lastUpdateTick: planet.lastUpdated,
      });
      materialIndex = updatedMaterials.length - 1;
    }

    if (materialIndex !== -1 && updatedMaterials[materialIndex]) {
      let material = updatedMaterials[materialIndex];

      // For SUN planets, ensure SOLAR_ENERGY has growth enabled
      if (
        planet.planetType === PlanetType.SUN &&
        material.materialId === MaterialType.SOLAR_ENERGY &&
        planet.silverGrowth > 0
      ) {
        // Ensure growth is enabled and growth rate is correct
        material = {
          ...material,
          growth: true,
          growthRate:
            planet.silverGrowth / (Number(MaterialType.SOLAR_ENERGY) * 2),
        };
        updatedMaterials[materialIndex] = material;
      }

      // Only update if material has growth enabled (use updated material)
      const currentMaterial = updatedMaterials[materialIndex];
      if (
        currentMaterial.growth &&
        currentMaterial.materialAmount !== undefined
      ) {
        const amount = currentMaterial.materialAmount;
        const grown = tickElapsed * currentMaterial.growthRate;

        updatedMaterials[materialIndex] = {
          ...currentMaterial,
          materialAmount: Math.min(amount + grown, currentMaterial.cap),
        };
      }
    }
  }

  return updatedMaterials;
};

const getPopulationAtTick = (planet: Planet, atTick: number): number => {
  if (planet.population === 0) {
    return 0;
  }
  if (!hasOwner(planet)) {
    return planet.population;
  }

  if (planet.planetType === PlanetType.SILVER_BANK) {
    if (planet.population > planet.populationCap) {
      return planet.populationCap;
    }
  }

  let tickElapsed = atTick - Math.max(planet.lastUpdated, planet.addJunkTick);

  if (planet.owner != planet.junkOwner) {
    tickElapsed = 0;
  }

  const denominator =
    Math.exp(
      (-4 * planet.populationGrowth * tickElapsed) / planet.populationCap,
    ) *
      (planet.populationCap / planet.population - 1) +
    1;

  return planet.populationCap / denominator;
};

export const updatePlanetToTick = (
  planet: Planet,
  _planetArtifacts: Artifact[],
  atTick: number,
  _contractConstants: ContractConstants,
  setPlanet: (p: Planet) => void = () => {},
): void => {
  if (atTick < planet.lastUpdated) {
    return;
  }

  if (atTick <= planet.addJunkTick) {
    return;
  }

  // if (planet.pausers === 0) {
  planet.silver = getSilverOverTick(planet, planet.lastUpdated, atTick);

  planet.population = getPopulationAtTick(planet, atTick);

  planet.materials = getMaterialsOverTick(planet, planet.lastUpdated, atTick);

  // }
  planet.lastUpdated = atTick;

  // NOTE: please update to tick
  // const photoidActivationTime =
  //   contractConstants.PHOTOID_ACTIVATION_DELAY * 1000;
  // const activePhotoid = planetArtifacts.find(
  //   (a) =>
  //     a.artifactType === ArtifactType.PhotoidCannon &&
  //     isActivated(a) &&
  //     atTimeMillis - a.lastActivated * 1000 >= photoidActivationTime,
  // );

  // if (activePhotoid && !planet.localPhotoidUpgrade) {
  //   planet.localPhotoidUpgrade = activePhotoid.timeDelayedUpgrade;
  //   applyUpgrade(planet, activePhotoid.timeDelayedUpgrade);
  // }

  setPlanet(planet);
};

export const applyUpgrade = (
  planet: Planet,
  upgrade: Upgrade,
  unApply = false,
) => {
  if (unApply) {
    planet.speed /= upgrade.populationCapMultiplier / 100;
    planet.populationGrowth /= upgrade.populationGrowthMultiplier / 100;
    planet.range /= upgrade.rangeMultiplier / 100;
    planet.speed /= upgrade.speedMultiplier / 100;
    planet.defense /= upgrade.defMultiplier / 100;
  } else {
    planet.speed *= upgrade.populationCapMultiplier / 100;
    planet.populationGrowth *= upgrade.populationGrowthMultiplier / 100;
    planet.range *= upgrade.rangeMultiplier / 100;
    planet.speed *= upgrade.speedMultiplier / 100;
    planet.defense *= upgrade.defMultiplier / 100;
  }
};

/**
 * @param previous The previously calculated state of a planet
 * @param current The current calculated state of the planet
 * @param arrival The Arrival that caused the state change
 */
export interface PlanetDiff {
  previous: Planet;
  current: Planet;
  arrival: QueuedArrival;
}

export const arrive = (
  toPlanet: Planet,
  artifactsOnPlanet: Artifact[],
  arrival: QueuedArrival,
  arrivingArtifact: Artifact | undefined,
  contractConstants: ContractConstants,
  guildUtils: GuildUtils,
): PlanetDiff => {
  // this function optimistically simulates an arrival
  if (toPlanet.locationId !== arrival.toPlanet) {
    throw new Error(
      `attempted to apply arrival for wrong toPlanet ${toPlanet.locationId}`,
    );
  }

  // update toPlanet energy and silver right before arrival
  updatePlanetToTick(
    toPlanet,
    artifactsOnPlanet,
    arrival.arrivalTick,
    contractConstants,
  );

  const prevPlanet = cloneDeep(toPlanet);

  // if (toPlanet.destroyed || toPlanet.frozen) {
  //   return { arrival: arrival, previous: toPlanet, current: toPlanet };
  // }

  // apply energy
  const { energyArriving, arrivalTick } = arrival;

  const _activeArtifact = artifactsOnPlanet.find(
    (a) => a.lastActivated > a.lastDeactivated,
  );

  const inSameGuild =
    guildUtils.inSameGuildAtTick(arrival.player, toPlanet.owner, arrivalTick) &&
    arrival.player !== toPlanet.owner;

  if (arrival.player !== toPlanet.owner && !inSameGuild) {
    if (
      toPlanet.population >
      Math.floor(
        (energyArriving * CONTRACT_PRECISION * 100) / toPlanet.defense,
      ) /
        CONTRACT_PRECISION
    ) {
      // attack reduces target planet's garrison but doesn't conquer it
      toPlanet.population -=
        Math.floor(
          (energyArriving * CONTRACT_PRECISION * 100) / toPlanet.defense,
        ) / CONTRACT_PRECISION;
    } else {
      // conquers planet
      toPlanet.owner = arrival.player;
      toPlanet.population =
        energyArriving -
        Math.floor(
          (toPlanet.population * CONTRACT_PRECISION * toPlanet.defense) / 100,
        ) /
          CONTRACT_PRECISION;
    }
  } else {
    // moving between my own planets
    toPlanet.population += energyArriving;
  }

  if (
    toPlanet.planetType === PlanetType.SILVER_BANK
    //  || toPlanet.pausers !== 0
  ) {
    if (toPlanet.population > toPlanet.populationCap) {
      toPlanet.population = toPlanet.populationCap;
    }
  }

  // apply silver
  if (toPlanet.silver + arrival.silverMoved > toPlanet.silverCap) {
    toPlanet.silver = toPlanet.silverCap;
  } else {
    toPlanet.silver += arrival.silverMoved;
  }

  // transfer artifact if necessary
  if (arrival.artifactId) {
    toPlanet.heldArtifactIds.push(arrival.artifactId);
  }

  if (arrivingArtifact) {
    // if (arrivingArtifact.artifactType === ArtifactType.ShipMothership) {
    //   if (toPlanet.populationGroDoublers === 0) {
    //     toPlanet.populationGrowth *= 2;
    //   }
    //   toPlanet.populationGroDoublers++;
    // } else if (arrivingArtifact.artifactType === ArtifactType.ShipWhale) {
    //   if (toPlanet.silverGroDoublers === 0) {
    //     toPlanet.silverGrowth *= 2;
    //   }
    //   toPlanet.silverGroDoublers++;
    // } else if (arrivingArtifact.artifactType === ArtifactType.ShipTitan) {
    //   toPlanet.pausers++;
    // }
    arrivingArtifact.onPlanetId = toPlanet.locationId;
  }
  // materials moved with arrival
  if (arrival.materialsMoved) {
    for (const moved of arrival.materialsMoved) {
      const idx = toPlanet.materials.findIndex(
        (mat) => mat?.materialId === moved?.materialId,
      );
      if (idx !== -1 && toPlanet.materials[idx]) {
        const currentAmount =
          Number(toPlanet.materials[idx].materialAmount) || 0;
        const movedAmount = Number(moved.materialAmount) || 0;
        const cap = Number(toPlanet.materials[idx].cap) || 0;

        toPlanet.materials[idx] = {
          ...toPlanet.materials[idx],
          materialAmount: Math.min(currentAmount + movedAmount, cap),
        };
      }
    }
  }
  return { arrival, current: toPlanet, previous: prevPlanet };
};

/**
 * @todo ArrivalUtils has become a dumping ground for functions that should just live inside of a
 * `Planet` class.
 */

export function getEmojiMessage(
  planet: Planet | undefined,
): PlanetMessage<EmojiFlagBody> | undefined {
  // Note: messages property may not exist on Planet type
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (planet as any)?.messages?.find(isEmojiFlagMessage);
}
