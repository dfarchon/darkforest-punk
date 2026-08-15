// SPDX-License-Identifier: GPL-3.0
pragma solidity >=0.8.24;

import { BaseSystem } from "systems/internal/BaseSystem.sol";
import { IEffectSystem } from "codegen/world/IEffectSystem.sol";
import { Errors } from "interfaces/errors.sol";
import { Proof } from "libraries/SnarkProof.sol";
import { MoveInput } from "libraries/VerificationInput.sol";
import { Planet } from "libraries/Planet.sol";
import { Counter } from "codegen/tables/Counter.sol";
import { MoveData, Move } from "codegen/tables/Move.sol";
import { MoveLib } from "libraries/Move.sol";
import { UniverseLib } from "libraries/Universe.sol";
import { EffectLib } from "libraries/Effect.sol";
import { Artifact } from "libraries/Artifact.sol";
import { DFUtils } from "libraries/DFUtils.sol";
import { GlobalStats } from "codegen/tables/GlobalStats.sol";
import { PlayerStats } from "codegen/tables/PlayerStats.sol";
import { JunkConfig } from "codegen/tables/JunkConfig.sol";
import { MoveMaterial } from "codegen/tables/MoveMaterial.sol";
import { MaterialMove } from "libraries/Material.sol";
import { Ticker } from "codegen/tables/Ticker.sol";
import { PendingMoveQueue, PendingMoveQueueLib } from "libraries/Move.sol";
import { MaterialType } from "codegen/common.sol";

contract MoveSystem is BaseSystem {
  using MoveLib for MoveData;

  // Events
  event MoveReverted(uint64 moveId, address captain, bytes32 fromPlanet, bytes32 toPlanet);

  // Track which moves have been reverted (persistent across all blocks)
  mapping(uint64 => bool) private revertedMoves;

  // Small, view-only helper to keep codegen tight
  function _readAndCheckPlanets(
    address w,
    MoveInput memory input
  ) private returns (Planet memory fromP, Planet memory toP) {
    fromP = DFUtils.readInitedPlanet(w, input.fromPlanetHash);
    if (input.toPlanetHash == input.fromPlanetHash) revert MoveToSamePlanet();
    if (JunkConfig.getSPACE_JUNK_ENABLED() && fromP.owner != fromP.junkOwner) revert PlanetOwnershipMismatch();

    toP = DFUtils.readAnyPlanet(w, input.toPlanetHash, input.toPerlin, input.toRadiusSquare);

    if (fromP.owner != toP.owner && toP.owner != address(0)) {
      GlobalStats.setAttackCount(GlobalStats.getAttackCount() + 1);
      PlayerStats.setAttackCount(_msgSender(), PlayerStats.getAttackCount(_msgSender()) + 1);
    }
  }

  function move(
    Proof memory _proof,
    MoveInput memory _input,
    uint256 _population,
    uint256 _silver,
    uint256 _artifact,
    MaterialMove[] calldata _materials
  ) public entryFee {
    GlobalStats.setMoveCount(GlobalStats.getMoveCount() + 1);
    PlayerStats.setMoveCount(_msgSender(), PlayerStats.getMoveCount(_msgSender()) + 1);

    // delegate to the internal function, where we’ll do the rest
    _move(_proof, _input, _population, _silver, _artifact, _materials);
  }

  function _move(
    Proof memory _proof,
    MoveInput memory _input,
    uint256 _population,
    uint256 _silver,
    uint256 _artifact,
    MaterialMove[] memory _materials
  ) internal {
    address w = _world();
    DFUtils.tick(w);
    DFUtils.verify(w, _proof, _input);

    (Planet memory fromPlanet, Planet memory toPlanet) = _readAndCheckPlanets(w, _input);

    fromPlanet = IEffectSystem(w).df__beforeMove(fromPlanet);

    (fromPlanet, toPlanet) = _createAndDispatchMove(
      fromPlanet,
      toPlanet,
      _input.distance,
      _population,
      _silver,
      _artifact,
      _materials
    );

    fromPlanet = IEffectSystem(w).df__afterMove(fromPlanet);

    DFUtils.writePlanet(w, fromPlanet);
    DFUtils.writePlanet(w, toPlanet);
  }

  function _createAndDispatchMove(
    Planet memory fromPlanet,
    Planet memory toPlanet,
    uint256 distanceParam,
    uint256 pop,
    uint256 silv,
    uint256 artifactId,
    MaterialMove[] memory mats
  ) private returns (Planet memory, Planet memory) {
    MoveData memory shipping = MoveLib.NewMove(fromPlanet, _msgSender());

    uint256 d = UniverseLib.distance(fromPlanet, toPlanet, distanceParam);
    (shipping, fromPlanet) = shipping.loadArtifact(fromPlanet, artifactId);
    (shipping, fromPlanet) = shipping.loadPopulation(fromPlanet, pop, d);
    (shipping, fromPlanet) = shipping.loadSilver(fromPlanet, silv);
    (shipping, fromPlanet) = shipping.loadMaterials(fromPlanet, mats);
    (shipping, toPlanet) = shipping.headTo(toPlanet, d, fromPlanet.speed);

    Counter.setMove(shipping.id);

    return (fromPlanet, toPlanet);
  }

  /**
   * @notice For backward compatibility, we keep the old move function signature.
   */

  function legacyMove(
    uint256[2] memory _a,
    uint256[2][2] memory _b,
    uint256[2] memory _c,
    uint256[11] memory _input,
    uint256 popMoved,
    uint256 silverMoved,
    uint256 movedArtifactId,
    uint256, // isAbandoning
    bytes calldata movedMaterials
  ) public {
    Proof memory proof;
    proof.genFrom(_a, _b, _c);
    MoveInput memory input;
    input.genFrom(_input);

    MaterialMove[] memory mats = abi.decode(movedMaterials, (MaterialMove[]));

    _move(proof, input, popMoved, silverMoved, movedArtifactId, mats);
  }

  /**
   * @notice Reverts a movement if the caller is the captain and the move is within the first half of its journey
   * @param moveId The ID of the move to revert
   * @param toPlanetHash The destination planet hash of the move
   * @param moveIndex The index of the move in the destination planet's queue
   */
  function revertMove(uint64 moveId, bytes32 toPlanetHash, uint8 moveIndex) public entryFee {
    address w = _world();
    DFUtils.tick(w);

    // Get the move data
    MoveData memory moveData = Move.get(toPlanetHash, moveIndex);

    // Verify the move exists and caller is the captain
    if (moveData.id != moveId) {
      revert Errors.MoveNotFound();
    }
    if (moveData.captain != _msgSender()) {
      revert Errors.NotMoveCaptain();
    }

    // Check if move is within first half of journey
    uint256 currentTick = Ticker.getTickNumber();
    uint256 elapsedTime = currentTick - moveData.departureTick;

    // Allow revert only if less than half the journey is completed
    if (elapsedTime >= (moveData.arrivalTick - moveData.departureTick) / 2) {
      revert Errors.MoveTooFarToRevert();
    }

    // Check if this move has already been reverted (persistent check)
    if (revertedMoves[moveId]) {
      revert Errors.MoveAlreadyReverted();
    }

    // Get source planet and check ownership
    Planet memory fromPlanet = DFUtils.readInitedPlanet(w, uint256(moveData.from));
    if (fromPlanet.owner != moveData.captain) {
      revert Errors.NotPlanetOwner();
    }

    // Remove original move from destination planet's queue
    PendingMoveQueue memory queue;
    queue.ReadFromStore(uint256(toPlanetHash));
    PendingMoveQueueLib.RemoveMove(queue, moveIndex);
    queue.WriteToStore();

    // Create new move with reduced variables
    _createReversedMove(moveData, toPlanetHash, moveIndex, currentTick, elapsedTime);
    // Delete original move
    Move.deleteRecord(toPlanetHash, moveIndex);

    // Update materials (50% of original amounts)
    for (uint8 rid = 1; rid <= uint8(type(MaterialType).max); rid++) {
      uint256 originalAmount = MoveMaterial.getAmount(moveData.id, rid);
      if (originalAmount > 0) {
        MoveMaterial.setAmount(moveId, rid, originalAmount / 2);
      }
    }
    // MaterialMove.deleteRecord(moveData.id);
    // Write planets back to storage
    DFUtils.writePlanet(w, fromPlanet);
    DFUtils.writePlanet(w, DFUtils.readInitedPlanet(w, uint256(toPlanetHash)));

    // Mark this move as permanently reverted
    revertedMoves[moveId] = true;

    // Emit revert event with new direction
    emit MoveReverted(moveId, moveData.captain, toPlanetHash, moveData.from);
  }

  /**
   * @notice Check if a move has been reverted
   * @param moveId The ID of the move to check
   * @return true if the move has been reverted, false otherwise
   */
  function isMoveReverted(uint64 moveId) public view returns (bool) {
    return revertedMoves[moveId];
  }

  function _createReversedMove(
    MoveData memory moveData,
    bytes32 toPlanetHash,
    uint8 moveIndex,
    uint256 currentTick,
    uint256 elapsedTime
  ) internal {
    // Backdate departure so the fleet stays at its current path position and only
    // reverses direction. At currentTick, proportion becomes (1 - oldProportion):
    //   departureTick = 2 * currentTick - oldArrivalTick
    //   arrivalTick   = currentTick + elapsedTime  (same remaining travel time)
    Move.set(
      moveData.from,
      moveIndex,
      MoveData({
        from: toPlanetHash,
        id: moveData.id,
        captain: moveData.captain,
        departureTick: uint64(2 * currentTick - moveData.arrivalTick),
        arrivalTick: uint64(currentTick + elapsedTime),
        population: uint64(moveData.population / 2),
        silver: uint64(moveData.silver / 2),
        artifact: moveData.artifact
      })
    );

    // Add to original source planet's queue
    PendingMoveQueue memory newQueue;
    newQueue.ReadFromStore(uint256(moveData.from));
    PendingMoveQueueLib.PushMove(newQueue, Move.get(moveData.from, moveIndex));
    newQueue.WriteToStore();
  }
}
