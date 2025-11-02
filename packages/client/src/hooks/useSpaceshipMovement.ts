import { useMUD } from "@mud/MUDContext";
import { isArtifactSpaceShip } from "@df/gamelogic";
import type { Artifact, LocationId } from "@df/types";
import { getSpaceshipBonuses } from "../Utils/SpaceshipBonusUtils";
import type { GameUIManager } from "@backend/GameLogic/GameUIManager";
import type { GameManager } from "@backend/GameLogic/GameManager";

/**
 * Hook to get movement calculations with spaceship bonuses applied
 */
export function useSpaceshipMovement() {
  const { components } = useMUD();

  const getEnergyArrivingForMoveWithBonuses = (
    uiManager: GameUIManager,
    from: LocationId,
    to: LocationId | undefined,
    dist: number | undefined,
    energy: number,
  ): number => {
    const artifactSending = uiManager.getArtifactSending(from);
    let spaceshipBonuses;

    if (artifactSending && isArtifactSpaceShip(artifactSending.artifactType)) {
      spaceshipBonuses = getSpaceshipBonuses(artifactSending, components);
    }

    return uiManager.getEnergyArrivingForMove(
      from,
      to,
      dist,
      energy,
      components,
    );
  };

  const getTimeForMoveWithBonuses = (
    gameManager: GameManager,
    fromId: LocationId,
    toId: LocationId,
    abandoning: boolean,
    artifactSending?: Artifact,
  ): number => {
    let spaceshipBonuses;

    if (artifactSending && isArtifactSpaceShip(artifactSending.artifactType)) {
      spaceshipBonuses = getSpaceshipBonuses(artifactSending, components);
    }

    return gameManager.getTimeForMove(
      fromId,
      toId,
      abandoning,
      spaceshipBonuses,
    );
  };

  const getSpaceshipBonusesForArtifact = (artifact: Artifact) => {
    // console.log(
    //   "useSpaceshipMovement - getSpaceshipBonusesForArtifact called:",
    //   {
    //     artifact,
    //     components: components.SpaceshipBonus,
    //     componentsKeys: Object.keys(components),
    //   },
    // );
    return getSpaceshipBonuses(artifact, components);
  };

  return {
    getEnergyArrivingForMoveWithBonuses,
    getTimeForMoveWithBonuses,
    getSpaceshipBonusesForArtifact,
  };
}
