import { CONTRACT_PRECISION } from "@df/constants";
import {
  address,
  artifactIdFromHexStr,
  locationIdFromHexStr,
  locationIdToHexStr,
} from "@df/serde";
import type {
  ArtifactId,
  EthAddress,
  LocationId,
  MaterialAmount,
  MaterialId,
  MaterialTransfer,
  QueuedArrival,
  VoyageId,
} from "@df/types";
import { ArrivalType, getMaxMaterialType } from "@df/types";
import { getComponentValue } from "@latticexyz/recs";
import { encodeEntity } from "@latticexyz/store-sync/recs";
import type { ClientComponents } from "@mud/createClientComponents";

interface MoveUtilsConfig {
  components: ClientComponents;
}

export class MoveUtils {
  private components: ClientComponents;

  public constructor({ components }: MoveUtilsConfig) {
    this.components = components;
  }

  public getArrivalsForPlanet(planetId: LocationId): QueuedArrival[] {
    const { Move, PendingMove, MoveMaterial } = this.components;
    const pendingMoveEntity = encodeEntity(PendingMove.metadata.keySchema, {
      to: locationIdToHexStr(planetId) as `0x${string}`,
    });
    const pendingMove = getComponentValue(PendingMove, pendingMoveEntity);
    const indexes = Array(30).fill(0);
    if (pendingMove) {
      let indexesBigInt = pendingMove.indexes;
      for (let i = 29; i >= 0; i--) {
        indexes[i] = indexesBigInt % 256n;
        indexesBigInt = indexesBigInt / 256n;
      }
      const res: QueuedArrival[] = [];
      for (
        let i = pendingMove.head;
        i < pendingMove.head + pendingMove.number;
        i++
      ) {
        const moveEntity = encodeEntity(Move.metadata.keySchema, {
          to: locationIdToHexStr(planetId) as `0x${string}`,
          index: indexes[i % 30],
        });
        const move = getComponentValue(Move, moveEntity);
        if (!move) {
          throw new Error("Move not found");
        }

        // Get all materials for this move
        const materialsMoved: MaterialTransfer[] = [];
        for (
          let resourceId = 1;
          resourceId <= getMaxMaterialType();
          resourceId++
        ) {
          // Assuming max 8 material types
          const moveMaterialEntity = encodeEntity(
            MoveMaterial.metadata.keySchema,
            {
              moveId: move.id,
              resourceId: resourceId as number,
            },
          );
          const moveMaterial = getComponentValue(
            MoveMaterial,
            moveMaterialEntity,
          );
          if (moveMaterial && moveMaterial.amount > 0n) {
            materialsMoved.push({
              materialId: resourceId as MaterialId,
              materialAmount: Math.floor(
                Number(moveMaterial.amount) / CONTRACT_PRECISION,
              ),
            });
          }
        }

        res.push({
          eventId: move.id.toString() as VoyageId,
          player: address(move.captain),
          fromPlanet: locationIdFromHexStr(move.from),
          toPlanet: planetId,
          energyArriving: Math.floor(
            Number(move.population) / CONTRACT_PRECISION,
          ),
          silverMoved: Math.floor(Number(move.silver) / CONTRACT_PRECISION),
          artifactId:
            move.artifact === 0n
              ? undefined
              : artifactIdFromHexStr(move.artifact.toString()),
          departureTick: Number(move.departureTick),
          distance: 0, // TODO: calculate distance
          arrivalTick: Number(move.arrivalTick),
          arrivalType: ArrivalType.Normal,
          materialsMoved: materialsMoved,
          // unionId: 0, // TODO: calculate unionId
          // name: "", // TODO: calculate name
          // leader: move.captain as EthAddress,
          // level: 0, // TODO: calculate level
          // members: [], // TODO: calculate members
          // invitees: [], // TODO: calculate invitees
        });
      }
      return res;
    } else {
      return [];
    }
  }

  public getAllArrivals(
    planetsToLoad: LocationId[],
    onProgress?: (fractionCompleted: number) => void,
  ): QueuedArrival[] {
    const res: QueuedArrival[] = [];
    for (let i = 0; i < planetsToLoad.length; i++) {
      const planetId = locationIdFromHexStr(planetsToLoad[i]);

      res.push(...this.getArrivalsForPlanet(planetId));
      if (onProgress) {
        onProgress((i + 1) / planetsToLoad.length);
      }
    }

    onProgress && onProgress(1);

    return res;
  }
}
