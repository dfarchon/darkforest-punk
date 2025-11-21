import { locationIdFromHexStr } from "@df/serde";
import type {
  Artifact,
  ArtifactId,
  BurnedCoords,
  ClaimedCoords,
  KardashevCoords,
  LocationId,
  Planet,
  Player,
  QueuedArrival,
  RevealedCoords,
  VoyageId,
} from "@df/types";
import React from "react";

import type { ContractConstants } from "../../_types/darkforest/api/ContractsAPITypes";
import type { AddressTwitterMap } from "../../_types/darkforest/api/UtilityServerAPITypes";
import { Link } from "../../Frontend/Components/CoreUI";
import type { LoadingBarHandle } from "../../Frontend/Components/TextLoadingBar";
import { DarkForestTips } from "../../Frontend/Views/DarkForestTips";
import type { TerminalHandle } from "../../Frontend/Views/Terminal";
import { tryGetAllTwitters } from "../Network/UtilityServerAPI";
import type PersistentChunkStore from "../Storage/PersistentChunkStore";
import type { ContractsAPI } from "./ContractsAPI";
import { WORLD_NAME } from "@df/constants";

export interface InitialGameState {
  contractConstants: ContractConstants;
  players: Map<string, Player>;
  worldRadius: number;
  allTouchedPlanetIds: LocationId[];
  allRevealedCoords: RevealedCoords[];
  // allClaimedCoords: ClaimedCoords[];
  // allBurnedCoords: BurnedCoords[];
  // allKardashevCoords: KardashevCoords[];
  pendingMoves: QueuedArrival[];
  touchedAndLocatedPlanets: Map<LocationId, Planet>;
  artifacts: Map<ArtifactId, Artifact>;
  // artifactsOnVoyages: Artifact[];
  // myArtifacts: Artifact[];
  // heldArtifacts: Artifact[][];
  loadedPlanets: LocationId[];
  revealedCoordsMap: Map<LocationId, RevealedCoords>;
  // claimedCoordsMap: Map<LocationId, ClaimedCoords>;
  // burnedCoordsMap: Map<LocationId, BurnedCoords>;
  // kardashevCoordsMap: Map<LocationId, KardashevCoords>;
  planetVoyageIdMap: Map<LocationId, VoyageId[]>;
  arrivals: Map<VoyageId, QueuedArrival>;
  // twitters: AddressTwitterMap;
  paused: boolean;
  // halfPrice: boolean;
}

export class InitialGameStateDownloader {
  private terminal: TerminalHandle;

  public constructor(terminal: TerminalHandle) {
    this.terminal = terminal;
  }

  private makeProgressListener(prettyEntityName: string) {
    const ref = React.createRef<LoadingBarHandle>();
    this.terminal.printLoadingBar(prettyEntityName, ref);
    this.terminal.newline();

    return (percent: number) => {
      ref.current?.setFractionCompleted(percent);
    };
  }

  async download(
    contractsAPI: ContractsAPI,
    persistentChunkStore: PersistentChunkStore,
  ): Promise<InitialGameState> {
    const isDev = import.meta.env.VITE_NODE_ENV !== "production";

    /**
     * In development we use the same contract address every time we deploy,
     * so storage is polluted with the IDs of old universes.
     */
    // const storedTouchedPlanetIds = isDev
    //   ? []
    //   : await persistentChunkStore.getSavedTouchedPlanetIds();
    // const storedRevealedCoords = isDev
    //   ? []
    //   : await persistentChunkStore.getSavedRevealedCoords();
    // const storedClaimedCoords =
    //   await persistentChunkStore.getSavedClaimedCoords();
    // const storedBurnedCoords =
    //   await persistentChunkStore.getSavedBurnedCoords();
    // const storedKardashevCoords: KardashevCoords[] = [];
    //TODO: fix this
    // await persistentChunkStore.getSavedKardashevCoords();

    // this.terminal.printElement(<DarkForestTips tips={tips} />);
    this.terminal.newline();

    const planetIdsLoadingBar = this.makeProgressListener("Planet IDs");
    const playersLoadingBar = this.makeProgressListener("Players");
    // const revealedPlanetsLoadingBar = this.makeProgressListener(
    //   "Revealed Planet IDs",
    // );
    const revealedPlanetsCoordsLoadingBar = this.makeProgressListener(
      "Revealed Planet Coordinates",
    );
    // const claimedPlanetsLoadingBar =
    //   this.makeProgressListener("Claimed Planet IDs");
    // const claimedPlanetsCoordsLoadingBar = this.makeProgressListener(
    //   "Claimed Planet Coordinates",
    // );
    // const burnedPlanetsLoadingBar =
    //   this.makeProgressListener("Burned Planet IDs");
    // const burnedPlanetsCoordsLoadingBar = this.makeProgressListener(
    //   "Burned Planet Coordinates",
    // );
    // const kardashevPlanetsLoadingBar = this.makeProgressListener(
    //   "Kardashev Planet IDs",
    // );
    // const kardashevPlanetsCoordsLoadingBar = this.makeProgressListener(
    //   "Kardashev Planet Coordinates",
    // );

    const pendingMovesLoadingBar = this.makeProgressListener("Pending Moves");
    const planetsLoadingBar = this.makeProgressListener("Planets");
    const artifactsLoadingBar = this.makeProgressListener("Artifacts");
    // const artifactsOnPlanetsLoadingBar = this.makeProgressListener(
    //   "Artifacts On Planets",
    // );
    // const artifactsInFlightLoadingBar =
    //   this.makeProgressListener("Artifacts On Moves");
    // const yourArtifactsLoadingBar = this.makeProgressListener("Your Artifacts");

    const contractConstants = contractsAPI.getConstants();
    const worldRadius = contractsAPI.getWorldRadius();

    const players = await contractsAPI.getPlayers(playersLoadingBar);

    const arrivals: Map<VoyageId, QueuedArrival> = new Map();
    const planetVoyageIdMap: Map<LocationId, VoyageId[]> = new Map();

    const minedChunks = Array.from(await persistentChunkStore.allChunks());
    const minedPlanetIds = new Set(
      minedChunks.flatMap((c) => c.planetLocations).map((l) => l.hash),
    );

    const loadedTouchedPlanetIds = await contractsAPI.getTouchedPlanetIds(
      // storedTouchedPlanetIds.length,
      planetIdsLoadingBar,
    );

    const loadedRevealedCoords = contractsAPI.getRevealedPlanetsCoords(
      // storedRevealedCoords.length,
      // revealedPlanetsLoadingBar,
      revealedPlanetsCoordsLoadingBar,
    );

    // const loadedClaimedCoords = contractsAPI.getClaimedPlanetsCoords(
    //   0,
    //   claimedPlanetsLoadingBar,
    //   claimedPlanetsCoordsLoadingBar,
    // );

    // const loadedBurnedCoords = contractsAPI.getBurnedPlanetsCoords(
    //   0,
    //   burnedPlanetsLoadingBar,
    //   burnedPlanetsCoordsLoadingBar,
    // );

    // const loadedKardashevCoords = contractsAPI.getKardashevPlanetsCoords(
    //   0,
    //   kardashevPlanetsLoadingBar,
    //   kardashevPlanetsCoordsLoadingBar,
    // );

    // const allTouchedPlanetIds = storedTouchedPlanetIds.concat(
    //   await loadedTouchedPlanetIds,
    // );

    const allTouchedPlanetIds = loadedTouchedPlanetIds;

    // const allRevealedCoords = storedRevealedCoords.concat(
    //   await loadedRevealedCoords,
    // );
    const allRevealedCoords = loadedRevealedCoords;

    // console.log("All Revealed Coords");
    // for (let i = 0; i < allRevealedCoords.length; i++) {
    //  console. log(i, allRevealedCoords[i]);
    // }

    // const allClaimedCoords = storedClaimedCoords.concat(
    //   await loadedClaimedCoords,
    // );

    // const allClaimedCoords = loadedClaimedCoords;

    // const allBurnedCoords = storedBurnedCoords.concat(await loadedBurnedCoords);
    // const allKardashevCoords = storedKardashevCoords.concat(
    //   await loadedKardashevCoords,
    // );

    const revealedCoordsMap = new Map<LocationId, RevealedCoords>();

    for (const revealedCoords of allRevealedCoords) {
      revealedCoordsMap.set(revealedCoords.hash, revealedCoords);
    }

    // const claimedCoordsMap = new Map<LocationId, ClaimedCoords>();
    // for (const claimedCoords of allClaimedCoords) {
    //   claimedCoordsMap.set(claimedCoords.hash, claimedCoords);
    // }

    // const burnedCoordsMap = new Map<LocationId, BurnedCoords>();
    // for (const burnedCoords of allBurnedCoords) {
    //   burnedCoordsMap.set(burnedCoords.hash, burnedCoords);
    // }

    // const kardashevCoordsMap = new Map<LocationId, KardashevCoords>();
    // for (const kardashevCoords of allKardashevCoords) {
    //   kardashevCoordsMap.set(kardashevCoords.hash, kardashevCoords);
    // }

    // Include starbases from chunks and revealed coords that are not in allTouchedPlanetIds
    // (starbases are excluded from getTouchedPlanetIds because their hashes may exceed LOCATION_ID_UB)
    const starbaseIds = new Set<LocationId>();
    for (const chunk of minedChunks) {
      for (const planetLocation of chunk.planetLocations) {
        // Check if this is a starbase by checking if it's in revealed coords but not in touched planets
        if (
          revealedCoordsMap.has(planetLocation.hash) &&
          !allTouchedPlanetIds.includes(planetLocation.hash)
        ) {
          // This might be a starbase - add it to planets to load
          starbaseIds.add(planetLocation.hash);
        }
      }
    }
    // Also check revealed coords that aren't in touched planets (these might be starbases)
    for (const [locationId] of revealedCoordsMap) {
      if (!allTouchedPlanetIds.includes(locationId)) {
        starbaseIds.add(locationId);
      }
    }

    let planetsToLoad = allTouchedPlanetIds.filter(
      (id) => minedPlanetIds.has(id) || revealedCoordsMap.has(id), //||
      // claimedCoordsMap.has(id) ||
      // burnedCoordsMap.has(id) ||
      // kardashevCoordsMap.has(id),
    );

    // Add starbases to planets to load
    planetsToLoad = [...planetsToLoad, ...Array.from(starbaseIds)];

    const pendingMoves = contractsAPI.getAllArrivals(
      planetsToLoad,
      pendingMovesLoadingBar,
    );

    // add origin points of voyages to known planets, because we need to know origin owner to render
    // the shrinking / incoming circle
    for (const arrival of pendingMoves) {
      planetsToLoad.push(arrival.fromPlanet);
    }

    // Filter out starbases and convert valid planet IDs
    // Starbases can have hashes that exceed LOCATION_ID_UB, so locationIdFromHexStr will fail
    const validPlanetIds: LocationId[] = [];
    for (const id of [...new Set(planetsToLoad)]) {
      try {
        const planetId = locationIdFromHexStr(id);
        validPlanetIds.push(planetId);
      } catch (error) {
        // If conversion fails, it might be a starbase or invalid planet
        // Skip it - starbases are handled separately and don't need to be in bulkGetPlanets
        console.warn(
          `Skipping planet ${id} in InitialGameStateDownloader: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }
    planetsToLoad = validPlanetIds;

    const touchedAndLocatedPlanets = contractsAPI.bulkGetPlanets(
      planetsToLoad,
      planetsLoadingBar,
    );

    touchedAndLocatedPlanets.forEach((_planet, locId) => {
      if (touchedAndLocatedPlanets.has(locId)) {
        planetVoyageIdMap.set(locId, []);
      }
    });

    for (const arrival of pendingMoves) {
      const voyageIds = planetVoyageIdMap.get(arrival.toPlanet);
      if (voyageIds) {
        voyageIds.push(arrival.eventId);
        planetVoyageIdMap.set(arrival.toPlanet, voyageIds);
      }
      arrivals.set(arrival.eventId, arrival);
    }

    const artifactIds = await contractsAPI.getTouchedArtifactIds();
    const artifacts = await contractsAPI.bulkGetArtifacts(
      artifactIds,
      artifactsLoadingBar,
    );

    // const artifactIdsOnVoyages: ArtifactId[] = [];
    // for (const arrival of pendingMoves) {
    //   if (arrival.artifactId) {
    //     artifactIdsOnVoyages.push(arrival.artifactId);
    //   }
    // }

    // const artifactsOnVoyages = await contractsAPI.bulkGetArtifacts(
    //   artifactIdsOnVoyages,
    //   artifactsInFlightLoadingBar,
    // );

    // const heldArtifacts = contractsAPI.bulkGetArtifactsOnPlanets(
    //   planetsToLoad,
    //   artifactsOnPlanetsLoadingBar,
    // );
    // const myArtifacts = contractsAPI.getPlayerArtifacts(
    //   contractsAPI.getAddress(),
    //   yourArtifactsLoadingBar,
    // );

    // const twitters = await tryGetAllTwitters();
    const paused = contractsAPI.getIsPaused();
    // const halfPrice = contractsAPI.getIsHalfPrice();

    const initialState: InitialGameState = {
      contractConstants: contractConstants,
      players: players,
      worldRadius: await worldRadius,
      allTouchedPlanetIds,
      allRevealedCoords,
      // allClaimedCoords,
      // allBurnedCoords,
      // allKardashevCoords,
      pendingMoves,
      touchedAndLocatedPlanets,
      artifacts,
      // artifactsOnVoyages,
      // myArtifacts: await myArtifacts,
      // heldArtifacts: await heldArtifacts,
      loadedPlanets: planetsToLoad,
      revealedCoordsMap,
      // claimedCoordsMap,
      // burnedCoordsMap,
      // kardashevCoordsMap,
      planetVoyageIdMap,
      arrivals,
      // twitters,
      paused: paused,
      // halfPrice: await halfPrice,
    };

    return initialState;
  }
}

const tips = [
  "Beware of pirates! To capture a planet with pirates, simply send an attack large enough to overcome its current energy.",
  <>
    Navigate the {WORLD_NAME} with allies (and enemies) - join the{" "}
    <Link to="https://discord.com/invite/f3FrFA4T25">DFArchon Discord</Link>!
    <br />
    <br />
    {WORLD_NAME} is a community-driven development of{" "}
    <Link to="https://zkga.me/">Dark Forest</Link> based on the{" "}
    <Link to="https://mud.dev">MUD</Link> engine.
    <br />
    DFArchon is a dev team focused on fully onchain games.
  </>,
  "There are many different artifact types, each with unique properties... try activating one on a planet!",
  "The top players get special rewards at the end of each " +
    WORLD_NAME +
    " round!",
  "There are many different ways to enjoy " +
    WORLD_NAME +
    " - as long as you're having fun, you're doing it right.",
  "Be careful when capturing planets - if you attack a player-owned planet, it may look like an act of war!",
  "A planet can have at most one active artifact.",
  "Withdrawing an artifact (via a Spacetime Rip) gives you full control of that artifact as an ERC 721 token. You can deposit artifacts you have withdrawn back into the universe via Spacetime Rips.",
  "You can use plugins to enhance your capabilities by automating repetitive tasks. The top players are probably using plugins (:",
  "Quasars can store lots of energy and silver, at the expense of being able to generate neither.",
  "Never share your private key with anyone else!",
  "Broadcasting a planet reveals its location to ALL other players!",
  "Claiming a planet reveals its location to ALL other players!",
  "You can spend silver to upgrade your planets.",
  "Planets in Nebula are more difficult to capture than planets in Deep Space.",
  "Some of the universe is corrupted, and contains special versions of the artifacts.",
  "You can import and export maps! Be careful importing maps from others, they may contain fabricated map data.",
  <>
    If mining the universe is slow on your computer, you can try the Remote
    Miner plugin. Find that and other plugins on{" "}
    <Link to="https://dfares-plugins.netlify.app/">
      dfares-plugins.netlify.app
    </Link>
    .
  </>,
  "A planet can only have 6 artifacts on it at any given time. Sometimes more if you get lucky. It's the blockchain, after all.",
  'A foundry must be prospected before you can attempt to find an artifact, but make sure to click "Find" before 256 blocks or it will be lost forever.',
  "Defense upgrades make your planets less vulnerable to attack, Range upgrades make your voyages go further and decay less, and Speed upgrades make your voyages go much faster.",
  "Wormhole artifacts reduce the effective distance between 2 planets. Try using them to link 2 planets very far apart!",
  "Upon deactivation, some artifacts must cooldown for a period before they can be activated again.",
  "Photoid Cannon artifacts will debuff your planet on activation, but get a massive stat boost for the first voyage from the planet after that a charging period. Photoid Cannon artifacts are destroyed upon use.",
  "Planetary Shield artifacts will massively boost a planet's defense, but at the cost of energy and energy growth stats. Planetary Shield artifacts are destroyed upon deactivation.",
  "Bloom Filter artifacts instantly set a planet's energy and silver to full, but are destroyed upon activation. Try using them on a Quasar!",
  WORLD_NAME +
    " exists on the blockchain, so you can play with an entirely different client if you want.",
  <>
    Writing plugins? Check out some documentation{" "}
    <Link to="https://github.com/dfarchon/DFARES-v0.1/blob/main/client/docs/classes/Backend_GameLogic_GameManager.default.md">
      here
    </Link>{" "}
    and{" "}
    <Link to="https://github.com/dfarchon/DFARES-v0.1/blob/main/client/docs/classes/Backend_GameLogic_GameUIManager.default.md">
      here
    </Link>
    .
  </>,
];
