import { locationIdToHexStr } from "@df/serde";
import type { QueuedArrival } from "@df/types";
import { useUIManager } from "@frontend/Utils/AppHooks";
import { getComponentValue } from "@latticexyz/recs";
import { encodeEntity } from "@latticexyz/store-sync/recs";
import { useMUD } from "@mud/MUDContext";
import { useCallback, useEffect, useState } from "react";

/**
 * Hook for handling move revert functionality
 */
export function useMoveRevert() {
  const { components, systemCalls } = useMUD();
  const gameUIManager = useUIManager();

  // Track reverted moves locally
  const [revertedMoves, setRevertedMoves] = useState<Set<string>>(new Set());
  // Track moves that are being checked for revert status
  const [checkingReverted, setCheckingReverted] = useState<Set<string>>(
    new Set(),
  );

  // Load reverted moves from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem("revertedMoves");
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        setRevertedMoves(new Set(parsed));
      } catch (error) {
        console.error(
          "Failed to parse reverted moves from localStorage:",
          error,
        );
      }
    }
  }, []);

  // Save reverted moves to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem(
      "revertedMoves",
      JSON.stringify(Array.from(revertedMoves)),
    );
  }, [revertedMoves]);

  // Helper function to find the move index for a specific voyage
  const findMoveIndex = useCallback(
    (voyage: QueuedArrival): number => {
      const { Move, PendingMove } = components;

      // Get the pending move data for the destination planet
      const pendingMoveEntity = encodeEntity(PendingMove.metadata.keySchema, {
        to: locationIdToHexStr(voyage.toPlanet) as `0x${string}`,
      });

      const pendingMove = getComponentValue(PendingMove, pendingMoveEntity);
      if (!pendingMove) {
        return -1;
      }

      // Extract indexes from the pending move data
      const indexes = Array(30).fill(0);
      let indexesBigInt = pendingMove.indexes;
      for (let i = 29; i >= 0; i--) {
        indexes[i] = Number(indexesBigInt % 256n);
        indexesBigInt = indexesBigInt / 256n;
      }

      // Search through the move queue to find the matching move
      for (
        let i = pendingMove.head;
        i < pendingMove.head + pendingMove.number;
        i++
      ) {
        const moveEntity = encodeEntity(Move.metadata.keySchema, {
          to: locationIdToHexStr(voyage.toPlanet) as `0x${string}`,
          index: indexes[i % 30],
        });

        const move = getComponentValue(Move, moveEntity);

        if (move && move.id.toString() === voyage.eventId) {
          return indexes[i % 30];
        }
      }

      return -1;
    },
    [components],
  );

  // Helper function to check if a voyage has already been reverted
  const alreadyReverted = useCallback(
    async (voyage: QueuedArrival): Promise<boolean> => {
      // Check if this voyage is in our local reverted moves set
      if (revertedMoves.has(voyage.eventId)) {
        return true;
      }

      // Check if the voyage has been reverted on-chain by calling the contract
      try {
        // Convert voyage.eventId to bigint for the contract call
        const moveId = BigInt(voyage.eventId);

        // Call the contract to check if the move has been reverted
        const isReverted = await systemCalls.isMoveReverted(moveId);

        if (isReverted) {
          // Update local storage to avoid future contract calls for this move
          setRevertedMoves((prev) => new Set(prev).add(voyage.eventId));
          return true;
        }

        return false;
      } catch (error) {
        console.error("Error checking if voyage was already reverted:", error);
        // If we can't determine the state, assume it might be reverted to be safe
        return true;
      }
    },
    [revertedMoves, systemCalls],
  );

  // Function to check revert status from contract
  const checkRevertStatus = useCallback(
    async (voyage: QueuedArrival): Promise<void> => {
      if (
        revertedMoves.has(voyage.eventId) ||
        checkingReverted.has(voyage.eventId)
      ) {
        return;
      }

      setCheckingReverted((prev) => new Set(prev).add(voyage.eventId));

      try {
        const moveId = BigInt(voyage.eventId);
        const isReverted = await systemCalls.isMoveReverted(moveId);

        if (isReverted) {
          setRevertedMoves((prev) => new Set(prev).add(voyage.eventId));
        }
      } catch (error) {
        console.error("Error checking revert status:", error);
      } finally {
        setCheckingReverted((prev) => {
          const newSet = new Set(prev);
          newSet.delete(voyage.eventId);
          return newSet;
        });
      }
    },
    [revertedMoves, checkingReverted, systemCalls],
  );

  const canRevertMove = useCallback(
    (voyage: QueuedArrival): boolean => {
      // Check if this move has already been reverted
      if (revertedMoves.has(voyage.eventId)) {
        return false;
      }

      // Trigger async check if not already checking
      if (!checkingReverted.has(voyage.eventId)) {
        checkRevertStatus(voyage);
      }

      // Check if the voyage is owned by the current player
      const isMyVoyage =
        voyage.player === gameUIManager.getAccount() ||
        gameUIManager.getArtifactWithId(voyage.artifactId)?.controller ===
          gameUIManager.getPlayer()?.address;

      if (!isMyVoyage) {
        return false;
      }

      // Check if the original source planet is still owned by the player
      const sourcePlanet = gameUIManager.getPlanetWithId(voyage.fromPlanet);

      if (!sourcePlanet || sourcePlanet.owner !== gameUIManager.getAccount()) {
        return false;
      }

      // Check if the voyage is within the first half of its journey
      const currentTime = Date.now();
      const departureTime = gameUIManager.convertTickToMs(voyage.departureTick);
      const arrivalTime = gameUIManager.convertTickToMs(voyage.arrivalTick);

      const totalJourneyTime = arrivalTime - departureTime;
      const elapsedTime = currentTime - departureTime;

      const isInFirstHalf = elapsedTime < totalJourneyTime / 2;

      // Allow revert only if less than half the journey is completed
      return isInFirstHalf;
    },
    [gameUIManager, revertedMoves, checkingReverted, checkRevertStatus],
  );

  const revertMove = useCallback(
    async (voyage: QueuedArrival): Promise<void> => {
      if (!canRevertMove(voyage)) {
        throw new Error("Cannot revert this move");
      }

      // Find the move index for this voyage
      const moveIndex = findMoveIndex(voyage);

      if (moveIndex === -1) {
        throw new Error("Move not found in destination planet's queue");
      }

      try {
        // Call the revertMove function using GameUIManager (transaction-based approach)
        // This will reverse the direction, set travel time to elapsed time,
        // and reduce resources by 50%
        // voyage.toPlanet is already a LocationId (64-char hex string without 0x prefix)
        const toPlanetHash = voyage.toPlanet;

        await gameUIManager.revertMove(
          voyage.eventId, // moveId (string)
          toPlanetHash, // toPlanetHash (LocationId)
          moveIndex, // moveIndex (number)
        );

        // Track this move as reverted
        setRevertedMoves((prev) => new Set(prev).add(voyage.eventId));
      } catch (error: unknown) {
        console.error("Revert move failed:", error);

        // Enhanced error handling for specific revert reasons
        const errorMessage =
          error instanceof Error ? error.message : String(error);

        if (errorMessage.includes("0x8415c69c")) {
          throw new Error(
            "Move revert failed: Unknown contract error. This may be due to move timing, ownership, or state changes.",
          );
        }

        if (errorMessage.includes("MoveNotFound")) {
          throw new Error(
            "Move not found: The move may have already been processed or doesn't exist.",
          );
        }

        if (errorMessage.includes("NotMoveCaptain")) {
          throw new Error(
            "Not authorized: You are not the captain of this move.",
          );
        }

        if (errorMessage.includes("MoveTooFarToRevert")) {
          throw new Error(
            "Move too far: The move has progressed more than halfway and cannot be reverted.",
          );
        }

        if (errorMessage.includes("NotPlanetOwner")) {
          throw new Error(
            "Not planet owner: You no longer own the source planet.",
          );
        }

        if (errorMessage.includes("MoveAlreadyReverted")) {
          throw new Error(
            "Move already reverted: This move has already been reverted and cannot be reverted again.",
          );
        }

        // Generic error handling
        if (errorMessage.includes("ContractFunctionExecutionError")) {
          throw new Error(
            "Contract execution failed: The move revert transaction was rejected by the contract.",
          );
        }

        if (errorMessage.includes("ContractFunctionRevertedError")) {
          throw new Error(
            "Contract reverted: The move revert was rejected. This could be due to timing, ownership, or state issues.",
          );
        }

        // Re-throw the original error if we can't provide a better message
        throw error;
      }
    },
    [gameUIManager, canRevertMove, findMoveIndex],
  );

  return {
    canRevertMove,
    revertMove,
  };
}
