import { EMPTY_ADDRESS } from "@df/constants";
import { formatNumber, hasOwner } from "@df/gamelogic";
import { getOwnerColorVec } from "@df/procedural";
import type {
  LocationId,
  MaterialType,
  Planet,
  Player,
  QueuedArrival,
  VoyageRendererType,
} from "@df/types";
import {
  ArtifactType,
  RendererType,
  RenderZIndex,
  TextAlign,
  TextAnchor,
} from "@df/types";
import { getMaterialColor } from "@frontend/Panes/PlanetMaterialsPane";

import { engineConsts } from "../EngineConsts";
import type { Renderer } from "../Renderer";
import type { GameGLManager } from "../WebGL/GameGLManager";

const { white, gold } = engineConsts.colors;
const { enemyA, mineA, shipA, supportA } = engineConsts.colors.voyage;

function getVoyageColor(
  fromPlanet: Planet,
  toPlanet: Planet,
  isMine: boolean,
  isShip: boolean,
  isSupport: boolean,
) {
  if (isMine) {
    return mineA;
  }

  if (isSupport) {
    return supportA;
  }

  const isAttack = hasOwner(toPlanet) && fromPlanet.owner !== toPlanet.owner;

  if (isAttack) {
    if (isShip) {
      return shipA;
    } else {
      return enemyA;
    }
  }

  return getOwnerColorVec(fromPlanet);
}

/* responsible for calling renderers in order to draw voyages */
export class VoyageRenderer implements VoyageRendererType {
  renderer: Renderer;

  rendererType = RendererType.Voyager;
  constructor(gl: GameGLManager) {
    this.renderer = gl.renderer;
  }

  drawFleet(
    voyage: QueuedArrival,
    _player: Player | undefined,
    isMyVoyage: boolean,
    isShipVoyage: boolean,
    isSupportVoyage: boolean,
  ) {
    const {
      now: nowMs,
      context: gameUIManager,
      circleRenderer: cR,
      textRenderer: tR,
      spriteRenderer: sR,
      planetRenderManager: pRM,
    } = this.renderer;

    const fromLoc = gameUIManager.getLocationOfPlanet(voyage.fromPlanet);
    const fromPlanet = gameUIManager.getPlanetWithId(voyage.fromPlanet);
    const toLoc = gameUIManager.getLocationOfPlanet(voyage.toPlanet);
    const toPlanet = gameUIManager.getPlanetWithId(voyage.toPlanet);

    if (!fromPlanet || !toLoc) {
      // not enough info to draw anything
      return;
    } else if (!fromLoc && fromPlanet && toLoc && toPlanet) {
      // can draw a ring around dest, but don't know source location
      const myMove = voyage.player === gameUIManager.getAccount();
      const shipMove = voyage.player === EMPTY_ADDRESS;
      const supportMove =
        gameUIManager.inSameGuildAtTick(
          voyage.player,
          toPlanet.owner,
          voyage.arrivalTick,
        ) && voyage.player !== toPlanet.owner;

      // console.log("PUNK");
      // console.log("supportMove");
      // console.log(supportMove);

      const now = nowMs / 1000;

      const timeLeft = Math.floor(
        gameUIManager.convertTickToMs(voyage.arrivalTick) / 1000 - now,
      );

      const radius = (timeLeft * fromPlanet.speed) / 100;

      const color = getVoyageColor(
        fromPlanet,
        toPlanet,
        myMove,
        shipMove,
        supportMove,
      );

      const text = shipMove ? "Ship" : `${Math.floor(voyage.energyArriving)}`;

      cR.queueCircleWorld(toLoc.coords, radius, color, 0.7, 1, true);
      tR.queueTextWorld(
        `${text} in ${Math.floor(timeLeft)}s`,
        { x: toLoc.coords.x, y: toLoc.coords.y + radius },
        color,
        undefined,
        TextAlign.Center,
        TextAnchor.Bottom,
      );
    } else if (fromLoc && fromPlanet && toLoc && toPlanet) {
      // know source and destination locations

      const departureTime = gameUIManager.convertTickToMs(voyage.departureTick);
      const arrivalTime = gameUIManager.convertTickToMs(voyage.arrivalTick);

      let proportion = (nowMs - departureTime) / (arrivalTime - departureTime);

      proportion = Math.max(proportion, 0.01);
      proportion = Math.min(proportion, 0.99);

      const shipsLocationX =
        (1 - proportion) * fromLoc.coords.x + proportion * toLoc.coords.x;
      const shipsLocationY =
        (1 - proportion) * fromLoc.coords.y + proportion * toLoc.coords.y;
      const shipsLocation = { x: shipsLocationX, y: shipsLocationY };

      const timeLeftSeconds = Math.floor((arrivalTime - nowMs) / 1000);

      const voyageColor = getVoyageColor(
        fromPlanet,
        toPlanet,
        isMyVoyage,
        isShipVoyage,
        isSupportVoyage,
      );

      // alpha calculation
      const viewport = this.renderer.getViewport();
      const dx = fromLoc.coords.x - toLoc.coords.x;
      const dy = fromLoc.coords.y - toLoc.coords.y;
      const distWorld = Math.sqrt(dx ** 2 + dy ** 2);
      const dist = viewport.worldToCanvasDist(distWorld);
      let alpha = 255;
      if (dist < 300) {
        alpha = (dist / 300) * 255;
      }

      voyageColor[3] = alpha;
      const fleetRadius = 4;
      const artifactSizePixels = 20;
      cR.queueCircleWorldCenterOnly(shipsLocation, fleetRadius, voyageColor);
      if (voyage.artifactId) {
        const artifact = gameUIManager.getArtifactWithId(voyage.artifactId);
        if (artifact) {
          // const viewport = this.renderer.getViewport();
          const screenCoords = viewport.worldToCanvasCoords(shipsLocation);
          const distanceFromCenterOfFleet =
            fleetRadius * 1.5 + artifactSizePixels;
          const x = distanceFromCenterOfFleet + screenCoords.x;
          const y = screenCoords.y;

          const k = 40;
          const size = (k * 20.0) / (1.0 * viewport.worldToCanvasDist(20));

          if (artifact.artifactType === ArtifactType.Spaceship) {
            // Handle custom spaceship sprites in voyages
            const fromLoc = gameUIManager.getLocationOfPlanet(
              voyage.fromPlanet,
            );
            const toLoc = gameUIManager.getLocationOfPlanet(voyage.toPlanet);

            pRM.queueCustomSpaceshipSprite(
              artifact,
              viewport.canvasToWorldCoords({ x, y }),
              viewport.canvasToWorldDist(artifactSizePixels),
              255,
              fromLoc?.coords,
              toLoc?.coords,
            );
          } else if (artifact.artifactType !== ArtifactType.Avatar) {
            sR.queueArtifact(artifact, { x, y }, artifactSizePixels);
          } else {
            pRM.queueArtifactImage(
              viewport.canvasToWorldCoords({ x, y }),
              size,
              artifact,
            );
          }
        }
      }

      // queue text
      tR.queueTextWorld(
        `${timeLeftSeconds.toString()}s`,
        {
          x: shipsLocationX,
          y: shipsLocationY - 0.5,
        },
        [...white, alpha],
        0,
        TextAlign.Center,
        TextAnchor.Top,
      );
      if (voyage.energyArriving > 0) {
        tR.queueTextWorld(
          `${formatNumber(voyage.energyArriving)}`,
          {
            x: shipsLocationX,
            y: shipsLocationY + 0.5,
          },
          [...white, alpha],
          -0,
          TextAlign.Center,
          TextAnchor.Bottom,
        );
      }
      if (voyage.silverMoved > 0) {
        tR.queueTextWorld(
          `${formatNumber(voyage.silverMoved)}`,
          {
            x: shipsLocationX,
            y: shipsLocationY + 0.5,
          },
          [...gold, alpha],
          -1,
          TextAlign.Center,
          TextAnchor.Bottom,
        );
      }

      // Display materials if being moved
      if (voyage.materialsMoved && voyage.materialsMoved.length > 0) {
        let materialOffset = 0;
        for (const mat of voyage.materialsMoved) {
          const materialColor = getMaterialColor(
            mat.materialId as MaterialType,
          );
          // Convert hex color to RGB array
          const r = parseInt(materialColor.slice(1, 3), 16);
          const g = parseInt(materialColor.slice(3, 5), 16);
          const b = parseInt(materialColor.slice(5, 7), 16);

          tR.queueTextWorld(
            `${formatNumber(mat.materialAmount, 0)}`,
            {
              x: shipsLocationX,
              y: shipsLocationY + 0.5,
            },
            [r, g, b, alpha],
            (voyage.silverMoved ? -2 : -1) - materialOffset,
            TextAlign.Center,
            TextAnchor.Bottom,
          );
          materialOffset++;
        }
      }
    }
  }

  queueVoyages(): void {
    const { context: gameUIManager, currentTick } = this.renderer;
    const voyages = gameUIManager.getAllVoyages();
    const selectedVoyage = (gameUIManager as unknown).getSelectedVoyage?.();
    const hoveredVoyage = (gameUIManager as unknown).getHoveringVoyage?.();

    for (const voyage of voyages) {
      if (currentTick < voyage.arrivalTick) {
        const isMyVoyage =
          voyage.player === gameUIManager.getAccount() ||
          gameUIManager.getArtifactWithId(voyage.artifactId)?.controller ===
            gameUIManager.getPlayer()?.address;
        const isShipVoyage = voyage.player === EMPTY_ADDRESS;
        const sender = gameUIManager.getPlayer(voyage.player);

        const toPlanet = gameUIManager.getPlanetWithId(voyage.toPlanet);

        if (!toPlanet) continue;
        const isSupportVoyage =
          gameUIManager.inSameGuildAtTick(
            voyage.player,
            toPlanet.owner,
            voyage.arrivalTick,
          ) && voyage.player !== toPlanet.owner;

        // Check if this voyage is selected or hovered
        const isSelected = Boolean(
          selectedVoyage && selectedVoyage.eventId === voyage.eventId,
        );
        const isHovered = Boolean(
          hoveredVoyage && hoveredVoyage.eventId === voyage.eventId,
        );

        this.drawVoyagePath(
          voyage.fromPlanet,
          voyage.toPlanet,
          true,
          isMyVoyage,
          isShipVoyage,
          isSupportVoyage,
          isSelected,
          isHovered,
        );

        this.drawFleet(
          voyage,
          sender,
          isMyVoyage,
          isShipVoyage,
          isSupportVoyage,
        );
      } else {
        // this move arrived, apply it to target planet and remove it
        gameUIManager.updateArrival(voyage.toPlanet, voyage);
      }
    }

    const unconfirmedDepartures = gameUIManager.getUnconfirmedMoves();
    for (const unconfirmedMove of unconfirmedDepartures) {
      this.drawVoyagePath(
        unconfirmedMove.intent.from,
        unconfirmedMove.intent.to,
        false,
        true,
        // This false doesn't matter because we force isMyVoyage to true
        false,
        false, // unconfirmed moves are always white
        false, // unconfirmed moves are never selected
        false, // unconfirmed moves are never hovered
      );
    }
  }

  private drawVoyagePath(
    from: LocationId,
    to: LocationId,
    confirmed: boolean,
    isMyVoyage: boolean,
    isShipVoyage: boolean,
    isSupportVoyage: boolean,
    isSelected: boolean = false,
    isHovered: boolean = false,
  ) {
    const { context: gameUIManager } = this.renderer;

    const fromLoc = gameUIManager.getLocationOfPlanet(from);
    const fromPlanet = gameUIManager.getPlanetWithId(from);
    const toLoc = gameUIManager.getLocationOfPlanet(to);
    const toPlanet = gameUIManager.getPlanetWithId(to);

    if (!fromPlanet || !fromLoc || !toLoc || !toPlanet) {
      return;
    }

    const voyageColor = getVoyageColor(
      fromPlanet,
      toPlanet,
      isMyVoyage,
      isShipVoyage,
      isSupportVoyage,
    );

    // Draw the normal voyage line
    this.renderer.lineRenderer.queueLineWorld(
      fromLoc.coords,
      toLoc.coords,
      voyageColor,
      confirmed ? 2 : 1,
      RenderZIndex.Voyages,
      confirmed ? false : true,
    );

    // If hovered, draw a subtle highlight
    if (isHovered && !isSelected) {
      const hoverColor: [number, number, number, number] = [0, 255, 255, 150]; // White with transparency
      this.renderer.lineRenderer.queueLineWorld(
        fromLoc.coords,
        toLoc.coords,
        hoverColor,
        3, // Slightly thicker line for hover
        RenderZIndex.Voyages + 0.5, // Draw above normal but below selected
        false, // Solid line
      );
    }

    // If selected, draw a highlighted line on top
    if (isSelected) {
      const highlightColor: [number, number, number, number] = [
        0, 255, 255, 255,
      ]; // Cyan highlight
      this.renderer.lineRenderer.queueLineWorld(
        fromLoc.coords,
        toLoc.coords,
        highlightColor,
        4, // Thicker line for selected voyage
        RenderZIndex.Voyages + 1, // Draw on top
        false, // Solid line
      );
    }
  }

  flush() {}

  /**
   * Gets voyage data for rendering UI components
   */
  getVoyageData() {
    const { context: gameUIManager, now } = this.renderer;
    const voyages = gameUIManager.getAllVoyages();
    const voyageData: Array<{
      voyage: QueuedArrival;
      position: { x: number; y: number };
      isMyVoyage: boolean;
      canRevert: boolean;
    }> = [];

    console.log("Getting voyage data for", voyages.length, "voyages");

    for (const voyage of voyages) {
      if (currentTick < voyage.arrivalTick) {
        const isMyVoyage =
          voyage.player === gameUIManager.getAccount() ||
          gameUIManager.getArtifactWithId(voyage.artifactId)?.controller ===
            gameUIManager.getPlayer()?.address;

        const fromLoc = gameUIManager.getLocationOfPlanet(voyage.fromPlanet);
        const toLoc = gameUIManager.getLocationOfPlanet(voyage.toPlanet);

        if (fromLoc && toLoc) {
          const departureTime = gameUIManager.convertTickToMs(
            voyage.departureTick,
          );
          const arrivalTime = gameUIManager.convertTickToMs(voyage.arrivalTick);
          const nowMs = now;

          let proportion =
            (nowMs - departureTime) / (arrivalTime - departureTime);
          proportion = Math.max(proportion, 0.01);
          proportion = Math.min(proportion, 0.99);

          const shipsLocationX =
            (1 - proportion) * fromLoc.coords.x + proportion * toLoc.coords.x;
          const shipsLocationY =
            (1 - proportion) * fromLoc.coords.y + proportion * toLoc.coords.y;
          const shipsLocation = { x: shipsLocationX, y: shipsLocationY };

          // Check if can revert using proper logic
          let canRevert = false;
          if (isMyVoyage && proportion < 0.5) {
            // Check if the original source planet is still owned by the player
            const sourcePlanet = gameUIManager.getPlanetWithId(
              voyage.fromPlanet,
            );
            canRevert =
              sourcePlanet && sourcePlanet.owner === gameUIManager.getAccount();
          }

          voyageData.push({
            voyage,
            position: shipsLocation,
            isMyVoyage,
            canRevert,
          });
        }
      }
    }

    console.log("Total voyage data entries:", voyageData.length);
    return voyageData;
  }
}
