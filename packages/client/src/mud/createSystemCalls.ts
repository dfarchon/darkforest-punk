/*
 * Create the system calls that the client can use to ask
 * for changes in the World state (using the System contracts).
 */

import type { MaterialTransfer } from "@df/types";
import { getComponentValue } from "@latticexyz/recs";
import { singletonEntity } from "@latticexyz/store-sync/recs";
import type { Address } from "viem";

import type { ClientComponents } from "./createClientComponents";
import type { SetupNetworkResult } from "./setupNetwork";

export type SystemCalls = ReturnType<typeof createSystemCalls>;

// PlanetType Enum
export enum PlanetType {
  PLANET = 0,
  ASTEROID_FIELD = 1,
  FOUNDRY = 2,
  SPACETIME_RIP = 3,
  QUASAR = 4,
}

// SpaceType Enum
export enum SpaceType {
  NEBULA = 0,
  SPACE = 1,
  DEEP_SPACE = 2,
  DEAD_SPACE = 3,
}

export function createSystemCalls(
  /*
   * The parameter list informs TypeScript that:
   *
   * - The first parameter is expected to be a
   *   SetupNetworkResult, as defined in setupNetwork.ts
   *
   *   Out of this parameter, we only care about two fields:
   *   - worldContract (which comes from getContract, see
   *     https://github.com/latticexyz/mud/blob/main/templates/react/packages/client/src/mud/setupNetwork.ts#L63-L69).
   *
   *   - waitForTransaction (which comes from syncToRecs, see
   *     https://github.com/latticexyz/mud/blob/main/templates/react/packages/client/src/mud/setupNetwork.ts#L77-L83).
   *
   * - From the second parameter, which is a ClientComponent,
   *   we only care about Counter. This parameter comes to use
   *   through createClientComponents.ts, but it originates in
   *   syncToRecs
   *   (https://github.com/latticexyz/mud/blob/main/templates/react/packages/client/src/mud/setupNetwork.ts#L77-L83).
   */
  { worldContract, waitForTransaction }: SetupNetworkResult,
  { Player, Move, Planet, Ticker }: ClientComponents,
) {
  // const increment = async () => {
  //   /*
  //    * Because IncrementSystem
  //    * (https://mud.dev/templates/typescript/contracts#incrementsystemsol)
  //    * is in the root namespace, `.increment` can be called directly
  //    * on the World contract.
  //    */
  //   const tx = await worldContract.write.df__increment();
  //   await waitForTransaction(tx);
  //   return getComponentValue(Counter, singletonEntity);
  // };

  const unPause = async () => {
    try {
      const tx = await worldContract.write.df__unpause();
      const receipt = await waitForTransaction(tx as `0x${string}`);

      // Log the receipt or trigger additional actions, e.g., update game state
      console.log("UnPaused:", receipt);
      getComponentValue(Ticker, singletonEntity);
    } catch (error) {
      console.error("Create UnPaused:", error);
      throw error; // Re-throw error to handle it higher up if needed
    }
  };

  // pause function call for game contract
  const pause = async () => {
    try {
      const tx = await worldContract.write.df__pause();
      const receipt = await waitForTransaction(tx as `0x${string}`);
      // Log the receipt or trigger additional actions, e.g., update game state
      console.log("Paused:", receipt);
      getComponentValue(Ticker, singletonEntity);
    } catch (error) {
      console.error("Create Paused:", error);
      throw error; // Re-throw error to handle it higher up if needed
    }
  };

  // tick function call for game contract
  const tick = async () => {
    try {
      const tx = await worldContract.write.df__tick();
      const receipt = await waitForTransaction(tx as `0x${string}`);
      // Log the receipt or trigger additional actions, e.g., update game state
      console.log("Tick:", receipt);
      getComponentValue(Ticker, singletonEntity);
    } catch (error) {
      console.error("Create Paused:", error);
      throw error; // Re-throw error to handle it higher up if needed
    }
  };

  // ADMIN Planets calls

  // Create planet
  const createPlanet = async (
    planetHash: bigint,
    owner: string,
    perlin: number,
    level: number,
    planetType: number,
    spaceType: number,
    population: number,
    silver: number,
    upgrade: number,
  ): Promise<void> => {
    try {
      // Call the createPlanet function on the contract

      const tx = await worldContract.write.df__createPlanet([
        planetHash,
        owner as `0x${string}`,
        perlin,
        level,
        planetType,
        spaceType,
        BigInt(population),
        BigInt(silver),
        upgrade,
      ]);
      // Wait for the transaction to be confirmed
      const receipt = await waitForTransaction(tx as `0x${string}`);

      // Log the receipt or trigger additional actions, e.g., update game state
      console.log("Planet created successfully:", receipt);
      getComponentValue(Planet, singletonEntity);
    } catch (error) {
      console.error("Create planet transaction failed:", error);
      throw error; // Re-throw error to handle it higher up if needed
    }
  };
  //
  // PLAYER CALLS
  //
  // Basic mint player to enter the game - TODO be as ERC20?

  const registerPlayer = async (name: string, burner: Address) => {
    try {
      const tx = await worldContract.write.df__registerPlayer([name, burner]);
      const receipt = await waitForTransaction(tx);
      // Log the receipt or trigger additional actions, e.g., update game state
      console.log("Register player successfully:", receipt);
      return getComponentValue(Player, singletonEntity);
    } catch (error) {
      console.error("Create planet transaction failed:", error);
      throw error; // Re-throw error to handle it higher up if needed
    }
  };

  // Function to change player name
  const changePlayerName = async (newName: string) => {
    const tx = await worldContract.write.df__changePlayerName([newName]);
    const receipt = await waitForTransaction(tx);
    // Log the receipt or trigger additional actions, e.g., update game state
    console.log("Change Player Name successfully:", receipt);
    return getComponentValue(Player, singletonEntity);
  };

  // Function to change burner wallet
  const changeBurnerWallet = async (newAddress: Address) => {
    const tx = await worldContract.write.df__changeBurnerWallet([newAddress]);
    const receipt = await waitForTransaction(tx);
    // Log the receipt or trigger additional actions, e.g., update game state
    console.log("Change Burner successfully:", receipt);
    return getComponentValue(Player, singletonEntity);
  };

  // Function to spawn a player
  const spawnPlayer = async (
    proof: {
      A: { X: bigint; Y: bigint };
      B: { X: readonly [bigint, bigint]; Y: readonly [bigint, bigint] };
      C: { X: bigint; Y: bigint };
    },
    SpawnInput: {
      planetHash: bigint;
      perlin: bigint;
      universeRadius: bigint;
      mimcHashKey: bigint;
      spaceTypeKey: bigint;
      perlinLengthScale: bigint;
      perlinMirrorX: bigint;
      perlinMirrorY: bigint;
      radiusSquare: bigint;
    },
  ) => {
    const tx = await worldContract.write.df__spawnPlayer([proof, SpawnInput]);
    const receipt = await waitForTransaction(tx);
    // Log the receipt or trigger additional actions, e.g., update game state
    console.log("Spawn Player successfully:", receipt);
    // Replace this with the actual method to get the newly spawned planet
    return getComponentValue(Player, singletonEntity);
  };
  // TODO CHECK FUNCTION !!!
  // // Function to spawn a player from burner
  const spawnPlayerFromBurner = async (
    proof: {
      A: { X: bigint; Y: bigint };
      B: { X: readonly [bigint, bigint]; Y: readonly [bigint, bigint] };
      C: { X: bigint; Y: bigint };
    },
    SpawnInput: {
      planetHash: bigint;
      perlin: bigint;
      universeRadius: bigint;
      mimcHashKey: bigint;
      spaceTypeKey: bigint;
      perlinLengthScale: bigint;
      perlinMirrorX: bigint;
      perlinMirrorY: bigint;
      radiusSquare: bigint;
    },
  ) => {
    const tx = await worldContract.write.callFrom(
      worldContract.address,
      "sy.df.PlayerSystem.spawnPlayer",
      [proof, SpawnInput],
    );
    const receipt = await waitForTransaction(tx);
    // Log the receipt or trigger additional actions, e.g., update game state
    console.log("Spawn Player from Burner successfully:", receipt);
    // Replace this with the actual method to get the newly spawned planet
    return getComponentValue(Player, singletonEntity);
  };

  const initializePlayer = async (
    proof: {
      A: [bigint, bigint];
      B: [readonly [bigint, bigint], readonly [bigint, bigint]];
      C: [bigint, bigint];
    },
    InitializeInput: [
      bigint,
      bigint,
      bigint,
      bigint,
      bigint,
      bigint,
      bigint,
      bigint,
      bigint,
    ],
  ) => {
    const tx = await worldContract.write.df__initializePlayer([
      proof.A,
      proof.B,
      proof.C,
      InitializeInput,
    ]);
    const receipt = await waitForTransaction(tx);
    // Log the receipt or trigger additional actions, e.g., update game state
    console.log("Spawn Player successfully:", receipt);
    // Replace this with the actual method to get the newly spawned planet
    return getComponentValue(Player, singletonEntity);
  };

  // PLANET
  // TODO test reveal location
  const revealLocation = async (
    proof: {
      A: { X: bigint; Y: bigint };
      B: { X: readonly [bigint, bigint]; Y: readonly [bigint, bigint] };
      C: { X: bigint; Y: bigint };
    },
    RevealInput: {
      planetHash: bigint;
      perlin: bigint;
      x: bigint;
      y: bigint;
      mimcHashKey: bigint;
      spaceTypeKey: bigint;
      perlinLengthScale: bigint;
      perlinMirrorX: bigint;
      perlinMirrorY: bigint;
    },
  ): Promise<void> => {
    try {
      // Call the reveal location function on the contract
      const tx = await worldContract.write.df__revealLocation([
        proof,
        RevealInput,
      ]);
      // Wait for the transaction to be confirmed
      const receipt = await waitForTransaction(tx as `0x${string}`);
      // Log the receipt or trigger additional actions, e.g., update game state
      console.log("Reveal location successfully:", receipt);
      getComponentValue(Planet, singletonEntity);
    } catch (error) {
      console.error("Reveal location transaction failed:", error);
      throw error; // Re-throw error to handle it higher up if needed
    }
  };

  const planetUpgrade = async (
    planetHash: bigint,
    rangeUpgrades: number,
    speedUpgrades: number,
    defenseUpgrades: number,
  ): Promise<void> => {
    try {
      // Call the upgradePlanet function on the contract

      const tx = await worldContract.write.df__upgradePlanet([
        planetHash,
        BigInt(rangeUpgrades),
        BigInt(speedUpgrades),
        BigInt(defenseUpgrades),
      ]);

      // Wait for the transaction to be confirmed
      const receipt = await waitForTransaction(tx as `0x${string}`);

      // Log the receipt or trigger additional actions, e.g., update game state
      console.log("Planet upgraded successfully:", receipt);
      getComponentValue(Planet, singletonEntity);
    } catch (error) {
      console.error("Upgrade planet transaction failed:", error);
      throw error; // Re-throw error to handle it higher up if needed
    }
  };

  const planetUpgradeBranch = async (
    planetHash: bigint,
    rangeUpgrades: number,
  ): Promise<void> => {
    try {
      // Call the upgradePlanet function on the contract

      const tx = await worldContract.write.df__upgradePlanet([
        planetHash,
        BigInt(rangeUpgrades),
      ]);

      // Wait for the transaction to be confirmed
      const receipt = await waitForTransaction(tx as `0x${string}`);

      // Log the receipt or trigger additional actions, e.g., update game state
      console.log("Planet upgraded successfully:", receipt);
      getComponentValue(Planet, singletonEntity);
    } catch (error) {
      console.error("Upgrade planet transaction failed:", error);
      throw error; // Re-throw error to handle it higher up if needed
    }
  };

  // MOVE call
  const move = async (
    proof: {
      A: [bigint, bigint];
      B: [[bigint, bigint], [bigint, bigint]];
      C: [bigint, bigint];
    },
    input: [
      bigint,
      bigint,
      bigint,
      bigint,
      bigint,
      bigint,
      bigint,
      bigint,
      bigint,
      bigint,
      bigint,
    ],
    population: bigint,
    silver: bigint,
    artifact: bigint,
    isAbandoning: boolean,
    materials: MaterialTransfer,
  ) => {
    try {
      // Transform the inputs to arguments
      const argsMove: [
        readonly [bigint, bigint],
        readonly [readonly [bigint, bigint], readonly [bigint, bigint]],
        readonly [bigint, bigint],
        readonly [
          bigint,
          bigint,
          bigint,
          bigint,
          bigint,
          bigint,
          bigint,
          bigint,
          bigint,
          bigint,
          bigint,
        ],
        bigint,
        bigint,
        bigint,
        bigint,
      ] = [
        proof.A, // [bigint, bigint]
        proof.B, // [[bigint, bigint], [bigint, bigint]]
        proof.C, // [bigint, bigint]
        input,
        population,
        silver,
        artifact,
        isAbandoning ? BigInt(1) : BigInt(0),
        materials,
      ];

      // Call the move function on the contract
      const tx = await worldContract.write.df__move(argsMove);

      const receipt = await waitForTransaction(tx);
      console.log("Move created successfully:", receipt);
      getComponentValue(Move, singletonEntity);
    } catch (error) {
      console.error("Move transaction failed:", error);
      throw error;
    }
  };

  // Player Read
  // Basic read function
  const readPlanetWithHash = async (planethash: bigint): Promise<void> => {
    try {
      // Call the readPlanet function on the contract with only planetHash
      const planet = await worldContract.read.df__readPlanet([
        planethash,
        BigInt(0),
        BigInt(0),
      ]);

      // Log the planet details or trigger additional actions, e.g., update game state
      console.log("Planet Details (Hash):", planet);

      getComponentValue(Planet, singletonEntity);

      return planet;
      // Optionally trigger updates or use the planet data for further actions
    } catch (error) {
      console.error("Error reading planet with hash:", error);
      throw error; // Re-throw error to handle it higher up if needed
    }
  };

  const readPlanetWithHashPerlinDistance = async (
    planetHash: bigint,
    perlin: bigint,
    distanceSquare: bigint,
  ): Promise<void> => {
    try {
      // Call the readPlanet function on the contract with planetHash, perlin, and distanceSquare
      const planet = await worldContract.read.df__readPlanet([
        planetHash,
        perlin,
        distanceSquare,
      ]);

      // Log the planet details or trigger additional actions, e.g., update game state

      console.log("Planet Details (Hash, Perlin, Distance):", planet);

      getComponentValue(Planet, singletonEntity);

      return planet;
      // Optionally trigger updates or use the planet data for further actions
    } catch (error) {
      console.error(
        "Error reading planet with hash, perlin, and distance:",
        error,
      );
      throw error; // Re-throw error to handle it higher up if needed
    }
  };

  const readPlanetAt = async (
    planetHash: bigint,
    tickNumber: number,
  ): Promise<void> => {
    try {
      // Call the readPlanet function on the contract with only planetHash
      const planet = await worldContract.read.df__readPlanetAt([
        planetHash,
        BigInt(tickNumber),
      ]);

      // Log the planet details or trigger additional actions, e.g., update game state
      console.log("Planet At Details :", planet);

      getComponentValue(Planet, singletonEntity);

      // Optionally trigger updates or use the planet data for further actions
    } catch (error) {
      console.error("Error reading planet at:", error);
      throw error; // Re-throw error to handle it higher up if needed
    }
  };

  // VERIFICATIONS FUNCTIONS
  // TODO test verification form!!
  const verifySpawnProof = async (
    proof: {
      A: { X: bigint; Y: bigint };
      B: { X: readonly [bigint, bigint]; Y: readonly [bigint, bigint] };
      C: { X: bigint; Y: bigint };
    },
    SpawnInput: {
      planetHash: bigint;
      perlin: bigint;
      universeRadius: bigint;
      mimcHashKey: bigint;
      spaceTypeKey: bigint;
      perlinLengthScale: bigint;
      perlinMirrorX: bigint;
      perlinMirrorY: bigint;
      radiusSquare: bigint;
    },
  ): Promise<boolean> => {
    try {
      const result = await worldContract.read.df__verifySpawnProof([
        proof,
        SpawnInput,
      ]);
      return result;
    } catch (error) {
      console.error("Error in df__verifyInitProof:", error);
      throw error;
    }
  };

  const verifyMoveProof = async (
    proof: {
      A: { X: bigint; Y: bigint };
      B: { X: readonly [bigint, bigint]; Y: readonly [bigint, bigint] };
      C: { X: bigint; Y: bigint };
    },
    MoveInput: {
      fromPlanetHash: bigint;
      toPlanetHash: bigint;
      toPerlin: bigint;
      universeRadius: bigint;
      distance: bigint;
      mimcHashKey: bigint;
      spaceTypeKey: bigint;
      perlinLengthScale: bigint;
      perlinMirrorX: bigint;
      perlinMirrorY: bigint;
      toRadiusSquare: bigint;
    },
  ): Promise<boolean> => {
    try {
      const result = await worldContract.read.df__verifyMoveProof([
        proof,
        MoveInput,
      ]);
      return result;
    } catch (error) {
      console.error("Error in df__verifyMoveProof:", error);
      throw error;
    }
  };

  const verifyBiomebaseProof = async (
    proof: {
      A: [bigint, bigint];
      B: readonly [readonly [bigint, bigint], readonly [bigint, bigint]];
      C: [bigint, bigint];
    },
    BiomaseInput: [bigint, bigint, bigint, bigint, bigint, bigint, bigint],
  ): Promise<boolean> => {
    try {
      const result = await worldContract.read.df__verifyBiomebaseProof([
        proof.A,
        proof.B,
        proof.C,
        BiomaseInput,
      ]);
      return result;
    } catch (error) {
      console.error("Error in df__verifyBiomebaseProof:", error);
      throw error;
    }
  };

  const verifyRevealProof = async (
    proof: {
      A: { X: bigint; Y: bigint };
      B: { X: readonly [bigint, bigint]; Y: readonly [bigint, bigint] };
      C: { X: bigint; Y: bigint };
    },
    RevealInput: {
      planetHash: bigint;
      perlin: bigint;
      x: bigint;
      y: bigint;
      mimcHashKey: bigint;
      spaceTypeKey: bigint;
      perlinLengthScale: bigint;
      perlinMirrorX: bigint;
      perlinMirrorY: bigint;
    },
  ): Promise<boolean> => {
    try {
      const result = await worldContract.read.df__verifyRevealProof([
        proof,
        RevealInput,
      ]);
      return result;
    } catch (error) {
      console.error("Error in df__verifyRevealProof:", error);
      throw error;
    }
  };

  const verifyWhitelistProof = async (
    proof: {
      A: [bigint, bigint];
      B: readonly [readonly [bigint, bigint], readonly [bigint, bigint]];
      C: [bigint, bigint];
    },
    WhitelistInput: [bigint, bigint],
  ): Promise<boolean> => {
    try {
      const result = await worldContract.read.df__verifyWhitelistProof([
        proof.A,
        proof.B,
        proof.C,
        WhitelistInput,
      ]);
      return result;
    } catch (error) {
      console.error("Error in df__verifyWhitelistProof:", error);
      throw error;
    }
  };

  // Define the system call for 'verify'
  const verify = async (
    delegator: Address, // Address type for the delegator
    resourceId: string, // String type for the resource ID
    dataBytes: string, // Byte array type for additional proof data  Uint8Array ??
  ): Promise<boolean> => {
    try {
      const result = await worldContract.read.df__verify([
        delegator as `0x${string}`,
        resourceId as `0x${string}`,
        dataBytes as `0x${string}`,
      ]);

      // Assuming the contract returns a boolean value
      return result;
    } catch (error) {
      console.error("Error in df__verifyWhitelistProof:", error);
      throw error;
    }
  };

  const getMsgSender = async (): Promise<Address> => {
    try {
      const result = await worldContract.read.df__getMsgSender();

      // Assuming the contract returns a boolean value
      return result;
    } catch (error) {
      console.error("Error in df__getMsgSender:", error);
      throw error;
    }
  };

  // Withdraw material system call
  const withdrawMaterial = async (
    planetHash: bigint,
    materialType: number,
    amount: bigint,
  ): Promise<void> => {
    try {
      const tx = await worldContract.write.df__withdrawMaterial([
        planetHash,
        materialType,
        amount,
      ]);
      const receipt = await waitForTransaction(tx as `0x${string}`);
      console.log("Withdraw material successfully:", receipt);
      getComponentValue(Planet, singletonEntity);
    } catch (error) {
      console.error("Withdraw material transaction failed:", error);
      throw error;
    }
  };

  // REVERT MOVE call
  const revertMove = async (
    moveId: bigint,
    toPlanetHash: bigint,
    moveIndex: number,
  ): Promise<void> => {
    try {
      const tx = await worldContract.write.df__revertMove([
        moveId,
        toPlanetHash,
        moveIndex,
      ]);
      const receipt = await waitForTransaction(tx as `0x${string}`);
      console.log("Move reverted successfully:", receipt);
      getComponentValue(Move, singletonEntity);
    } catch (error) {
      console.error("Revert move transaction failed:", error);
      throw error;
    }
  };

  // CHECK IF MOVE IS REVERTED call
  const isMoveReverted = async (moveId: bigint): Promise<boolean> => {
    try {
      const result = await worldContract.read.df__isMoveReverted([moveId]);
      return result as boolean;
    } catch (error) {
      console.error("Failed to check if move is reverted:", error);
      return false; // Default to false if we can't check
    }
  };

  // do not forget init function calls to be accessable in MUD systems calls
  return {
    registerPlayer,
    changePlayerName,
    changeBurnerWallet,
    spawnPlayer,
    spawnPlayerFromBurner,
    initializePlayer,
    createPlanet,
    move,
    revertMove,
    isMoveReverted,
    unPause,
    pause,
    tick,
    revealLocation,
    planetUpgrade,
    planetUpgradeBranch,
    verifySpawnProof,
    verifyMoveProof,
    verifyBiomebaseProof,
    verifyRevealProof,
    verifyWhitelistProof,
    verify,
    readPlanetWithHash,
    readPlanetWithHashPerlinDistance,
    readPlanetAt,
    getMsgSender,
    withdrawMaterial,
  };
}
