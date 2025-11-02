import {
  BLOCK_EXPLORER_URL,
  CONTRACT_PRECISION,
  EMPTY_ADDRESS,
  MIN_PLANET_LEVEL,
} from "@df/constants";
import type { Monomitter, Subscription } from "@df/events";
import { monomitter } from "@df/events";
import {
  getRange,
  isActivated,
  isLocatable,
  isSpaceShip,
  timeUntilNextBroadcastAvailable,
} from "@df/gamelogic";
import { fakeHash, mimcHash, perlin } from "@df/hashing";
import type { EthConnection } from "@df/network";
import {
  createContract,
  ThrottledConcurrentQueue,
  verifySignature,
  weiToEth,
} from "@df/network";
import { getPlanetName } from "@df/procedural";
import {
  address,
  artifactIdToDecStr,
  isUnconfirmedActivateArtifactTx,
  isUnconfirmedAddJunkTx,
  isUnconfirmedBlueTx,
  isUnconfirmedBurnTx,
  isUnconfirmedBuyArtifactTx,
  isUnconfirmedBuyGPTTokensTx,
  isUnconfirmedBuyHatTx,
  isUnconfirmedBuyPlanetTx,
  isUnconfirmedBuySpaceshipTx,
  isUnconfirmedCapturePlanetTx,
  isUnconfirmedChangeArtifactImageTypeTx,
  isUnconfirmedChargeArtifactTx,
  isUnconfirmedClaimTx,
  isUnconfirmedClearJunkTx,
  isUnconfirmedDeactivateArtifactTx,
  isUnconfirmedDepositArtifactTx,
  isUnconfirmedDonateTx,
  isUnconfirmedFindArtifactTx,
  isUnconfirmedInitTx,
  isUnconfirmedInvadePlanetTx,
  isUnconfirmedKardashevTx,
  isUnconfirmedMoveTx,
  isUnconfirmedPinkTx,
  isUnconfirmedProspectPlanetTx,
  isUnconfirmedRefreshPlanetTx,
  isUnconfirmedRevealTx,
  isUnconfirmedSendGPTTokensTx,
  isUnconfirmedSetPlanetEmojiTx,
  isUnconfirmedShutdownArtifactTx,
  isUnconfirmedSpendGPTTokensTx,
  isUnconfirmedUpgradeTx,
  isUnconfirmedWithdrawArtifactTx,
  isUnconfirmedWithdrawMaterialTx,
  isUnconfirmedWithdrawSilverTx,
  locationIdFromBigInt,
  locationIdFromHexStr,
  locationIdToDecStr,
  locationIdToHexStr,
} from "@df/serde";
import type {
  RevealInput,
  RevealSnarkContractCallArgs,
  SnarkProof,
} from "@df/snarks";
import type {
  AIZone,
  Artifact,
  ArtifactId,
  Biome,
  BurnedCoords,
  BurnedLocation,
  CaptureZone,
  Chunk,
  ClaimedCoords,
  ClaimedLocation,
  Diagnostics,
  EthAddress,
  KardashevCoords,
  KardashevLocation,
  Link,
  LocatablePlanet,
  LocationId,
  MaterialAmount,
  MaterialAmount,
  MaterialTransfer,
  MaterialType,
  NetworkHealthSummary,
  PinkZone,
  Planet,
  PlanetLevel,
  Player,
  QueuedArrival,
  Radii,
  Rectangle,
  RevealedCoords,
  RevealedLocation,
  SignedMessage,
  Transaction,
  TxIntent,
  UnconfirmedAcceptInvitation,
  UnconfirmedActivateArtifact,
  UnconfirmedAddJunk,
  UnconfirmedApplyToGuild,
  UnconfirmedApproveApplication,
  UnconfirmedBlue,
  UnconfirmedBurn,
  UnconfirmedBuyArtifact,
  UnconfirmedBuyGPTTokens,
  UnconfirmedBuyHat,
  UnconfirmedBuyPlanet,
  UnconfirmedBuySpaceship,
  UnconfirmedCapturePlanet,
  UnconfirmedChangeArtifactImageType,
  UnconfirmedChargeArtifact,
  UnconfirmedClaim,
  UnconfirmedClearJunk,
  UnconfirmedBuyJunk,
  UnconfirmedCreateGuild,
  UnconfirmedDeactivateArtifact,
  UnconfirmedDepositArtifact,
  UnconfirmedDisbandGuild,
  UnconfirmedDonate,
  UnconfirmedFindArtifact,
  UnconfirmedInit,
  UnconfirmedInvadePlanet,
  UnconfirmedInviteToGuild,
  UnconfirmedKardashev,
  UnconfirmedKickMember,
  UnconfirmedLeaveGuild,
  UnconfirmedMove,
  UnconfirmedPink,
  UnconfirmedPlanetTransfer,
  UnconfirmedProspectPlanet,
  UnconfirmedRefreshPlanet,
  UnconfirmedRevertMove,
  UnconfirmedReveal,
  UnconfirmedSendGPTTokens,
  UnconfirmedSetGrant,
  UnconfirmedSetMemberRole,
  UnconfirmedSetPlanetEmoji,
  UnconfirmedShutdownArtifact,
  UnconfirmedSpendGPTTokens,
  UnconfirmedTransferGuildLeadership,
  UnconfirmedUpgrade,
  UnconfirmedWithdrawArtifact,
  UnconfirmedWithdrawMaterial,
  UnconfirmedWithdrawSilver,
  Upgrade,
  VoyageId,
  WorldCoords,
  WorldLocation,
} from "@df/types";
import type { Guild, GuildId } from "@df/types";
import {
  ArtifactRarity,
  ArtifactType,
  GuildRole,
  GuildStatus,
  HatType,
  PlanetMessageType,
  PlanetType,
  Setting,
  SpaceType,
} from "@df/types";
import type { NumberType } from "@latticexyz/recs";
import { getComponentValue } from "@latticexyz/recs";
import { encodeEntity, singletonEntity } from "@latticexyz/store-sync/recs";
import type { ClientComponents } from "@mud/createClientComponents";
import type { BigInteger } from "big-integer";
import bigInt from "big-integer";
import PlanetRevealSystemAbi from "contracts/out/PlanetRevealSystem.sol/PlanetRevealSystem.abi.json";
import delay from "delay";
import type { Contract, ContractInterface, providers } from "ethers";
import { BigNumber } from "ethers";
import { utils } from "ethers";
import { EventEmitter } from "events";
import type { Hex } from "viem";
import { encodeAbiParameters, encodeFunctionData, toBytes } from "viem";

import type {
  ContractConstants,
  MoveArgs,
} from "../../_types/darkforest/api/ContractsAPITypes";
import {
  ContractsAPIEvent,
  ZKArgIdx,
} from "../../_types/darkforest/api/ContractsAPITypes";
import type { AddressTwitterMap } from "../../_types/darkforest/api/UtilityServerAPITypes";
import type {
  BurnCountdownInfo,
  ClaimCountdownInfo,
  HashConfig,
  KardashevCountdownInfo,
  RevealCountdownInfo,
} from "../../_types/global/GlobalTypes";
import NotificationManager from "../../Frontend/Game/NotificationManager";
import { MIN_CHUNK_SIZE } from "../../Frontend/Utils/constants";
import type { Diff } from "../../Frontend/Utils/EmitterUtils";
import {
  generateDiffEmitter,
  getDisposableEmitter,
} from "../../Frontend/Utils/EmitterUtils";
import {
  getBooleanSetting,
  getNumberSetting,
  pollSetting,
  setBooleanSetting,
  setSetting,
  settingChanged$,
} from "../../Frontend/Utils/SettingsHooks";
import { TerminalTextStyle } from "../../Frontend/Utils/TerminalTypes";
import UIEmitter from "../../Frontend/Utils/UIEmitter";
import type { TerminalHandle } from "../../Frontend/Views/Terminal";
import MinerManager, {
  HomePlanetMinerChunkStore,
  MinerManagerEvent,
} from "../Miner/MinerManager";
import type { MiningPattern } from "../Miner/MiningPatterns";
import {
  SpiralPattern,
  SwissCheesePattern,
  TowardsCenterPattern,
  TowardsCenterPatternV2,
} from "../Miner/MiningPatterns";
import {
  addMessage,
  deleteMessages,
  getMessagesOnPlanets,
} from "../Network/MessageAPI";
import {
  disconnectTwitter,
  getAllTwitters,
  verifyTwitterHandle,
} from "../Network/UtilityServerAPI";
import type { SerializedPlugin } from "../Plugins/SerializedPlugin";
import type PersistentChunkStore from "../Storage/PersistentChunkStore";
import { easeInAnimation, emojiEaseOutAnimation } from "../Utils/Animation";
import type SnarkArgsHelper from "../Utils/SnarkArgsHelper";
import { hexifyBigIntNestedArray } from "../Utils/Utils";
import { prospectExpired } from "./ArrivalUtils";
// import { getEmojiMessage } from "./ArrivalUtils";
import type { CaptureZonesGeneratedEvent } from "./CaptureZoneGenerator";
import { CaptureZoneGenerator } from "./CaptureZoneGenerator";
import type { ContractsAPI } from "./ContractsAPI";
import { makeContractsAPI } from "./ContractsAPI";
import { GameManagerFactory } from "./GameManagerFactory";
import { GameObjects } from "./GameObjects";
import { InitialGameStateDownloader } from "./InitialGameStateDownloader";
export enum GameManagerEvent {
  PlanetUpdate = "PlanetUpdate",
  DiscoveredNewChunk = "DiscoveredNewChunk",
  InitializedPlayer = "InitializedPlayer",
  InitializedPlayerError = "InitializedPlayerError",
  ArtifactUpdate = "ArtifactUpdate",
  Moved = "Moved",
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export class GameManager extends EventEmitter {
  private readonly components: ClientComponents;
  /**
   * This variable contains the internal state of objects that live in the game world.
   */
  public readonly entityStore: GameObjects;

  /**
   * Kind of hacky, but we store a reference to the terminal that the player sees when the initially
   * load into the game. This is the same exact terminal that appears inside the collapsable right
   * bar of the game.
   */
  private readonly terminal: React.MutableRefObject<TerminalHandle | undefined>;

  /**
   * The ethereum address of the player who is currently logged in. We support 'no account',
   * represented by `undefined` in the case when you want to simply load the game state from the
   * contract and view it without be able to make any moves.
   */
  private readonly account: EthAddress | undefined;

  /**
   * Map from ethereum addresses to player objects. This isn't stored in {@link GameObjects},
   * because it's not techincally an entity that exists in the world. A player just controls planets
   * and artifacts that do exist in the world.
   *
   * @todo move this into a new `Players` class.
   */
  private readonly players: Map<string, Player>;

  /**
   * Map from guild IDs to Guild objects. This isn't stored in {@link GameObjects},
   * because it's not technically an entity that exists in the world. A player just controls planets
   * and artifacts that do exist in the world.
   *
   * @todo move this into a new `Guild` class.
   */
  private readonly guilds: Map<GuildId, Guild>;

  /**
   * Allows us to make contract calls, and execute transactions. Be careful about how you use this
   * guy. You don't want to cause your client to send an excessive amount of traffic to whatever
   * node you're connected to.
   *
   * Interacting with the blockchain isn't free, and we need to be mindful about about the way our
   * application interacts with the blockchain. The current rate limiting strategy consists of three
   * points:
   *
   * - data that needs to be fetched often should be fetched in bulk.
   * - rate limit smart contract calls (reads from the blockchain), implemented by
   *   {@link ContractCaller} and transactions (writes to the blockchain on behalf of the player),
   *   implemented by {@link TxExecutor} via two separately tuned {@link ThrottledConcurrentQueue}s.
   */
  public readonly contractsAPI: ContractsAPI;

  /**
   * An object that syncs any newly added or deleted chunks to the player's IndexedDB.
   *
   * @todo it also persists other game data to IndexedDB. This class needs to be renamed `GameSaver`
   * or something like that.
   */
  public readonly persistentChunkStore: PersistentChunkStore;

  /**
   * Responsible for generating snark proofs.
   */
  private readonly snarkHelper: SnarkArgsHelper;

  /**
   * In debug builds of the game, we can connect to a set of contracts deployed to a local
   * blockchain, which are tweaked to not verify planet hashes, meaning we can use a faster hash
   * function with similar properties to mimc. This allows us to mine the map faster in debug mode.
   *
   * @todo move this into a separate `GameConfiguration` class.
   */
  private readonly useMockHash: boolean;

  /**
   * Game parameters set by the contract. Stuff like perlin keys, which are important for mining the
   * correct universe, or the time multiplier, which allows us to tune how quickly voyages go.
   *
   * @todo move this into a separate `GameConfiguration` class.
   */
  private contractConstants: ContractConstants;

  private paused: boolean;

  // private halfPrice: boolean;

  /**
   * @todo change this to the correct timestamp each round.
   */
  private readonly endTimeSeconds: number = 1800000000;
  //1948939200; // new Date("2031-10-05T04:00:00.000Z").getTime() / 1000

  /**
   * An interface to the blockchain that is a little bit lower-level than {@link ContractsAPI}. It
   * allows us to do basic operations such as wait for a transaction to complete, check the player's
   * address and balance, etc.
   */
  private readonly ethConnection: EthConnection;

  /**
   * Each round we change the hash configuration of the game. The hash configuration is download
   * from the blockchain, and essentially acts as a salt, permuting the universe into a unique
   * configuration for each new round.
   *
   * @todo deduplicate this and `useMockHash` somehow.
   */
  private readonly hashConfig: HashConfig;

  /**
   * The aforementioned hash function. In debug mode where `DISABLE_ZK_CHECKS` is on, we use a
   * faster hash function. Othewise, in production mode, use MiMC hash (https://byt3bit.github.io/primesym/).
   */
  private readonly planetHashMimc: (...inputs: number[]) => BigInteger;

  /**
   * Whenever we refresh the players twitter accounts or scores, we publish an event here.
   */
  public readonly playersUpdated$: Monomitter<void>;

  /**
   * Whenever we refresh the guilds, we publish an event here.
   */
  public readonly guildsUpdated$: Monomitter<void>;

  /**
   * Handle to an interval that periodically uploads diagnostic information from this client.
   */
  // private diagnosticsInterval: ReturnType<typeof setInterval>;

  /**
   * Handle to an interval that periodically refreshes some information about the player from the
   * blockchain.
   *
   * @todo move this into a new `PlayerState` class.
   */
  private playerInterval: ReturnType<typeof setInterval>;

  /**
   * Handle to an interval that periodically refreshes the scoreboard from our webserver.
   */
  // private scoreboardInterval: ReturnType<typeof setInterval>;

  /**
   * Handle to an interval that periodically refreshes the network's health from our webserver.
   */
  // private networkHealthInterval: ReturnType<typeof setInterval>;

  /**
   * Handle to an interval that periodically refreshes pinkZones.
   */
  // private pinkZoneInterval: ReturnType<typeof setInterval>;

  /**
   * Handle to an interval that periodically refreshes blueZones.
   */
  // private blueZoneInterval: ReturnType<typeof setInterval>;

  /**
   * Manages the process of mining new space territory.
   */
  private minerManager?: MinerManager;

  /**
   * Continuously updated value representing the total hashes per second that the game is currently
   * mining the universe at.
   *
   * @todo keep this in {@link MinerManager}
   */
  private hashRate: number;

  /**
   * The spawn location of the current player.
   *
   * @todo, make this smarter somehow. It's really annoying to have to import world coordinates, and
   * get them wrong or something. Maybe we need to mark a planet, once it's been initialized
   * contract-side, as the homeworld of the user who initialized on it. That way, when you import a
   * new account into the game, and you import map data that contains your home planet, the client
   * would be able to automatically detect which planet is the player's home planet.
   *
   * @todo move this into a new `PlayerState` class.
   */
  private homeLocation: WorldLocation | undefined;

  /**
   * Sometimes the universe gets bigger... Sometimes it doesn't.
   *
   * @todo move this into a new `GameConfiguration` class.
   */
  private worldRadius: number;

  /**
   * Emits whenever we load the network health summary from the webserver, which is derived from
   * diagnostics that the client sends up to the webserver as well.
   */
  // public networkHealth$: Monomitter<NetworkHealthSummary>;

  public paused$: Monomitter<boolean>;

  // public halfPrice$: Monomitter<boolean>;

  /**
   * Diagnostic information about the game.
   */
  private diagnostics: Diagnostics;

  /**
   * Subscription to act on setting changes
   */
  private settingsSubscription: Subscription | undefined;

  /**
   * Setting to allow players to start game without plugins that were running during the previous
   * run of the game client. By default, the game launches plugins that were running that were
   * running when the game was last closed.
   */
  private safeMode: boolean;

  public get planetRarity(): number {
    return this.contractConstants.PLANET_RARITY;
  }

  /**
   * Generates capture zones.
   */
  // private captureZoneGenerator: CaptureZoneGenerator | undefined;

  public constructor(
    terminal: React.MutableRefObject<TerminalHandle | undefined>,
    mainAccount: EthAddress | undefined,
    players: Map<string, Player>,
    touchedPlanets: Map<LocationId, Planet>,
    allTouchedPlanetIds: Set<LocationId>,
    revealedCoords: Map<LocationId, RevealedCoords>,
    // claimedCoords: Map<LocationId, ClaimedCoords>,
    // burnedCoords: Map<LocationId, BurnedCoords>,
    // kardashevCoords: Map<LocationId, KardashevCoords>,
    worldRadius: number,
    unprocessedArrivals: Map<VoyageId, QueuedArrival>,
    unprocessedPlanetArrivalIds: Map<LocationId, VoyageId[]>,
    contractsAPI: ContractsAPI,
    contractConstants: ContractConstants,
    persistentChunkStore: PersistentChunkStore,
    snarkHelper: SnarkArgsHelper,
    homeLocation: WorldLocation | undefined,
    useMockHash: boolean,
    artifacts: Map<ArtifactId, Artifact>,
    ethConnection: EthConnection,
    paused: boolean,
    // halfPrice: boolean,
    components: ClientComponents,
  ) {
    super();

    this.diagnostics = {
      rpcUrl: "unknown",
      totalPlanets: 0,
      visiblePlanets: 0,
      visibleChunks: 0,
      fps: 0,
      chunkUpdates: 0,
      callsInQueue: 0,
      totalCalls: 0,
      totalTransactions: 0,
      transactionsInQueue: 0,
      totalChunks: 0,
      width: 0,
      height: 0,
    };
    this.components = components;
    this.terminal = terminal;
    this.account = mainAccount;
    this.players = players;
    this.worldRadius = worldRadius;
    // this.networkHealth$ = monomitter(true);
    this.paused$ = monomitter(true);
    // this.halfPrice$ = monomitter(true);
    this.playersUpdated$ = monomitter();
    this.guildsUpdated$ = monomitter();

    // if (contractConstants.CAPTURE_ZONES_ENABLED) {
    //   this.captureZoneGenerator = new CaptureZoneGenerator(
    //     this,
    //     contractConstants.GAME_START_BLOCK,
    //     contractConstants.CAPTURE_ZONE_CHANGE_BLOCK_INTERVAL,
    //   );
    // }

    this.hashConfig = {
      planetHashKey: contractConstants.PLANETHASH_KEY,
      spaceTypeKey: contractConstants.SPACETYPE_KEY,
      biomebaseKey: contractConstants.BIOMEBASE_KEY,
      perlinLengthScale: contractConstants.PERLIN_LENGTH_SCALE,
      perlinMirrorX: contractConstants.PERLIN_MIRROR_X,
      perlinMirrorY: contractConstants.PERLIN_MIRROR_Y,
      planetRarity: contractConstants.PLANET_RARITY,
    };
    this.planetHashMimc = useMockHash
      ? fakeHash(this.hashConfig.planetRarity)
      : mimcHash(this.hashConfig.planetHashKey);

    this.contractConstants = contractConstants;
    this.homeLocation = homeLocation;

    const revealedLocations = new Map<LocationId, RevealedLocation>();
    for (const [locationId, coords] of revealedCoords) {
      const planet = touchedPlanets.get(locationId);
      if (planet) {
        const location: WorldLocation = {
          hash: locationId,
          coords,
          perlin: planet.perlin,
          biomebase: this.biomebasePerlin(coords, true),
        };
        revealedLocations.set(locationId, {
          ...location,
          revealer: coords.revealer,
        });
      }
    }

    // const claimedLocations = new Map<LocationId, ClaimedLocation>();

    // for (const [locationId, coords] of claimedCoords) {
    //   const planet = touchedPlanets.get(locationId);

    //   if (planet) {
    //     const location: WorldLocation = {
    //       hash: locationId,
    //       coords,
    //       perlin: planet.perlin,
    //       biomebase: this.biomebasePerlin(coords, true),
    //     };

    //     const revealedLocation = { ...location, revealer: coords.claimer };

    //     revealedLocations.set(locationId, revealedLocation);
    //     const claimedLocation = { ...location, claimer: coords.claimer };
    //     claimedLocations.set(locationId, claimedLocation);
    //   }
    // }

    // const burnedLocations = new Map<LocationId, BurnedLocation>();

    // for (const [locationId, coords] of burnedCoords) {
    //   const planet = touchedPlanets.get(locationId);

    //   if (planet) {
    //     const location: WorldLocation = {
    //       hash: locationId,
    //       coords,
    //       perlin: planet.perlin,
    //       biomebase: this.biomebasePerlin(coords, true),
    //     };

    //     const revealedLocation = { ...location, revealer: coords.operator };
    //     revealedLocations.set(locationId, revealedLocation);
    //     const burnedLocation = {
    //       ...location,
    //       operator: coords.operator,
    //       radius:
    //         this.getContractConstants().BURN_PLANET_LEVEL_EFFECT_RADIUS[
    //           planet.planetLevel
    //         ],
    //     };
    //     burnedLocations.set(locationId, burnedLocation);
    //   }
    // }

    // const kardashevLocations = new Map<LocationId, KardashevLocation>();
    // for (const [locationId, coords] of kardashevCoords) {
    //   const planet = touchedPlanets.get(locationId);
    //   if (planet) {
    //     const location: WorldLocation = {
    //       hash: locationId,
    //       coords,
    //       perlin: planet.perlin,
    //       biomebase: this.biomebasePerlin(coords, true),
    //     };
    //     const revealedLocation = { ...location, revealer: coords.operator };
    //     revealedLocations.set(locationId, revealedLocation);

    //     const kardashevLocation = {
    //       ...location,
    //       operator: coords.operator,
    //       radius:
    //         this.getContractConstants().KARDASHEV_EFFECT_RADIUS[
    //           planet.planetLevel
    //         ],
    //     };
    //     kardashevLocations.set(locationId, kardashevLocation);
    //   }
    // }

    this.entityStore = new GameObjects(
      mainAccount,
      touchedPlanets,
      allTouchedPlanetIds,
      revealedLocations,
      // claimedLocations,
      // burnedLocations,
      // kardashevLocations,
      artifacts,
      persistentChunkStore.allChunks(),
      unprocessedArrivals,
      unprocessedPlanetArrivalIds,
      contractConstants,
      worldRadius,
      components,
    );

    this.contractsAPI = contractsAPI;

    this.guilds = this.getInitGuilds();

    this.persistentChunkStore = persistentChunkStore;
    this.snarkHelper = snarkHelper;
    this.useMockHash = useMockHash;
    this.paused = paused;
    // this.halfPrice = halfPrice;

    this.ethConnection = ethConnection;
    // NOTE: event
    // this.diagnosticsInterval = setInterval(this.uploadDiagnostics.bind(this), 10_000);
    // this.scoreboardInterval = setInterval(
    //   this.refreshScoreboard.bind(this),
    //   10_000,
    // );

    //NOTE: network health
    // this.networkHealthInterval = setInterval(this.refreshNetworkHealth.bind(this), 10_000);
    // this.pinkZoneInterval = setInterval(
    //   this.hardRefreshPinkZones.bind(this),
    //   10_000,
    // );
    // this.blueZoneInterval = setInterval(
    //   this.hardRefreshBlueZones.bind(this),
    //   10_000,
    // );
    this.playerInterval = setInterval(() => {
      if (this.account) {
        this.hardRefreshPlayer(this.account);
        // this.hardRefreshPlayerSpaceships(this.account);
        this.updateMinerManagerInnerRadius();
      }
    }, 10_000);

    this.hashRate = 0;

    this.settingsSubscription = settingChanged$.subscribe(
      (setting: Setting) => {
        if (setting === Setting.MiningCores) {
          if (this.minerManager) {
            const config = {
              contractAddress: this.getContractAddress(),
              account: this.ethConnection.getAddress(),
            };
            const cores = getNumberSetting(config, Setting.MiningCores);
            this.minerManager.setCores(cores);
          }
        }
      },
    );

    // this.refreshScoreboard();
    // NOTE: network health
    // this.refreshNetworkHealth();
    // this.hardRefreshPinkZones();
    // this.hardRefreshBlueZones();
    // this.getSpaceships();

    this.safeMode = false;

    allTouchedPlanetIds.forEach((planetId) => {
      this.hardRefreshPlanet(planetId);
    });
  }

  // private async uploadDiagnostics() {
  //   // eventLogger.logEvent(EventType.Diagnostics, this.diagnostics);
  // }

  // private async refreshNetworkHealth() {
  //   try {
  //     this.networkHealth$.publish(await loadNetworkHealth());
  //   } catch (e) {
  //     // @todo - what do we do if we can't connect to the webserver
  //     console.error(e);
  //   }
  // }

  // private async refreshScoreboard() {
  //   if (process.env.LEADER_BOARD_URL) {
  //     // try {
  //     //   const leaderboard = await loadLeaderboard();
  //     //   for (const entry of leaderboard.entries) {
  //     //     const player = this.players.get(entry.ethAddress);
  //     //     if (player) {
  //     //       // current player's score is updated via `this.playerInterval`
  //     //       if (player.address !== this.account && entry.score !== undefined) {
  //     //         player.score = entry.score;
  //     //       }
  //     //     }
  //     //   }
  //     //   this.playersUpdated$.publish();
  //     // } catch (e) {
  //     //   // @todo - what do we do if we can't connect to the webserver? in general this should be a
  //     //   // valid state of affairs because arenas is a thing.
  //     // }
  //   } else {
  //     try {
  //       //myTodo: use claimedLocations
  //       // const claimedLocations = this.getClaimedLocations();
  //       // const cntMap = new Map<string, number>();
  //       // for (const claimedLocation of claimedLocations) {
  //       //   const claimer = claimedLocation.claimer;
  //       //   const score = claimedLocation.score;
  //       //   const player = this.players.get(claimer);
  //       //   if (player === undefined) continue;
  //       //   let cnt = cntMap.get(claimer);
  //       //   if (cnt === undefined) cnt = 0;
  //       //   if (cnt === 0) player.score = score;
  //       // }

  //       const knownScoringPlanets = [];
  //       for (const planet of this.getAllPlanets()) {
  //         if (!isLocatable(planet)) {
  //           continue;
  //         }
  //         if (planet.destroyed || planet.frozen) {
  //           continue;
  //         }
  //         if (planet.planetLevel < 3) {
  //           continue;
  //         }
  //         if (!planet?.location?.coords) {
  //           continue;
  //         }
  //         if (planet.claimer === EMPTY_ADDRESS) {
  //           continue;
  //         }
  //         if (planet.claimer === undefined) {
  //           continue;
  //         }
  //         knownScoringPlanets.push({
  //           locationId: planet.locationId,
  //           claimer: planet.claimer,
  //           score: Math.floor(
  //             this.getDistCoords(planet.location.coords, { x: 0, y: 0 }),
  //           ),
  //         });
  //       }

  //       // console.log('knownScoringPlanets');
  //       // console.log(knownScoringPlanets);

  //       const cntMap = new Map<string, number>();
  //       const haveScorePlayersMap = new Map<string, boolean>();

  //       for (const planet of knownScoringPlanets) {
  //         const claimer = planet.claimer;
  //         if (claimer === undefined) {
  //           continue;
  //         }
  //         const player = this.players.get(claimer);
  //         if (player === undefined) {
  //           continue;
  //         }

  //         const cnt = cntMap.get(claimer);
  //         let cntNextValue = undefined;

  //         if (cnt === undefined || cnt === 0) {
  //           cntNextValue = 1;
  //         } else {
  //           cntNextValue = cnt + 1;
  //         }
  //         cntMap.set(claimer, cntNextValue);

  //         if (player.score === undefined || cntNextValue === 1) {
  //           player.score = planet.score;
  //           haveScorePlayersMap.set(claimer, true);
  //         } else {
  //           player.score = Math.min(player.score, planet.score);
  //           haveScorePlayersMap.set(claimer, true);
  //         }
  //       }
  //       for (const playerItem of this.getAllPlayers()) {
  //         const result = haveScorePlayersMap.get(playerItem.address);

  //         const player = this.players.get(playerItem.address);
  //         if (player === undefined) {
  //           continue;
  //         }

  //         if (result === false || result === undefined) {
  //           player.score = undefined;
  //         }
  //       }

  //       this.playersUpdated$.publish();
  //     } catch (e) {
  //       // @todo - what do we do if we can't connect to the webserver? in general this should be a
  //       // valid state of affairs because arenas is a thing.
  //     }
  //   }
  // }

  public getEthConnection() {
    return this.ethConnection;
  }

  public destroy(): void {
    // removes singletons of ContractsAPI, LocalStorageManager, MinerManager
    if (this.minerManager) {
      this.minerManager.removeAllListeners(
        MinerManagerEvent.DiscoveredNewChunk,
      );
      this.minerManager.destroy();
    }
    this.contractsAPI.destroy();
    this.persistentChunkStore.destroy();
    clearInterval(this.playerInterval);
    // NOTE: event
    // clearInterval(this.diagnosticsInterval);
    // clearInterval(this.scoreboardInterval);
    // NOTE: network health
    // clearInterval(this.networkHealthInterval);
    // clearInterval(this.pinkZoneInterval);
    // clearInterval(this.blueZoneInterval);
    this.settingsSubscription?.unsubscribe();
  }

  public updateContractConstants(contractConstants: ContractConstants) {
    this.contractConstants = contractConstants;
  }

  public getTransactionFee() {
    const { EntryFee } = this.components;
    const entryFee = getComponentValue(EntryFee, singletonEntity);
    if (!entryFee) return 0n;
    else return entryFee.fee;
  }

  static async create({
    mainAccount,
    connection,
    terminal,
    contractAddress,
    components,
    spectate = false,
  }: {
    mainAccount: EthAddress | undefined;
    connection: EthConnection;
    terminal: React.MutableRefObject<TerminalHandle | undefined>;
    contractAddress: EthAddress;
    components: ClientComponents;
    spectate: boolean;
  }): Promise<GameManager> {
    return GameManagerFactory.create({
      mainAccount,
      connection,
      terminal,
      contractAddress,
      components,
      spectate,
    });
  }

  public hardRefreshPlayer(address?: EthAddress): void {
    if (!address) {
      return;
    }
    const playerFromBlockchain = this.contractsAPI.getPlayerById(address);
    if (!playerFromBlockchain) {
      return;
    }

    // const localPlayer = this.getPlayer(address);
    // if (localPlayer?.twitter) {
    //   playerFromBlockchain.twitter = localPlayer.twitter;
    // }

    this.players.set(address, playerFromBlockchain);
    this.playersUpdated$.publish();
  }

  public updateMinerManagerInnerRadius() {
    if (this.minerManager) {
      // console.log("updateMinerManagerInnerRadius", this.getInnerRadius());
      this.minerManager.setInnerRadius(this.getInnerRadius());
    }
  }

  // private async hardRefreshPlayerSpaceships(
  //   address?: EthAddress,
  //   show?: boolean,
  // ): Promise<void> {
  //   if (!address) {
  //     return;
  //   }
  //   const spaceships = await this.contractsAPI.getPlayerSpaceships(address);
  //   if (show) {
  //     console.log(spaceships.length);
  //   }
  //   for (let i = 0; i < spaceships.length; i++) {
  //     if (show) {
  //       console.log("--- spaceship ", i, " ---");
  //       console.log("ship id:", spaceships[i].id);
  //       console.log("onPlanet: ", spaceships[i].onPlanetId);
  //     }

  //     await this.hardRefreshArtifact(spaceships[i].id);
  //     const voyageId = spaceships[i].onVoyageId;

  //     if (voyageId !== undefined) {
  //       const arrival = await this.contractsAPI.getArrival(Number(voyageId));
  //       if (show) {
  //         console.log("voyageId:", voyageId);
  //       }
  //       // console.log(arrival);
  //       if (arrival) {
  //         const fromPlanet = arrival.fromPlanet;
  //         const toPlanet = arrival.toPlanet;
  //         if (show) {
  //           console.log("Source Planet :", fromPlanet);
  //           console.log("Target Planet :", toPlanet);
  //         }
  //         await Promise.all([
  //           this.hardRefreshPlanet(fromPlanet),
  //           this.hardRefreshPlanet(toPlanet),
  //         ]);
  //         if (show) {
  //           console.log("[OK] finish hard refresh from & to planets");
  //         }
  //       }
  //     }
  //   }
  // }

  // public async getArrival(arrivalId: number): Promise<void> {
  //   const arrival = this.contractsAPI.getArrival(arrivalId);
  //   console.log(arrival);
  // }

  public getArrivalsForPlanet(planetId: LocationId): void {
    const events = this.contractsAPI.getArrivalsForPlanet(planetId);
    console.log(events);
  }

  public updateArrival(planetId: LocationId, arrival: QueuedArrival): void {
    this.entityStore.updateArrival(planetId, arrival);
  }

  public getPlanetEmoji(planetId: LocationId): string | undefined {
    return this.contractsAPI.getPlanetEmoji(planetId);
  }

  // Dirty hack for only refreshing properties on a planet and nothing else
  public softRefreshPlanet(planetId: LocationId): void {
    const planet = this.contractsAPI.getPlanetById(planetId);
    if (!planet) {
      return;
    }
    this.entityStore.replacePlanetFromContractData(planet);
  }

  public hardRefreshPlanet(planetId: LocationId): void {
    let planet = this.contractsAPI.getPlanetById(planetId);

    if (!planet) {
      // in some cases, the planet is not entirely initialized in the contract, but only some crucial table fields are set
      // in this case, we still need to generate the planet from contract side and update it into the entity store
      const location = this.entityStore.getLocationOfPlanet(planetId);
      if (location) {
        planet = this.contractsAPI.getDefaultPlanetByLocation(location);
      } else {
        return;
      }
    }

    const arrivals = this.contractsAPI.getArrivalsForPlanet(planetId);

    // const artifactsOnPlanets =
    //   await this.contractsAPI.bulkGetArtifactsOnPlanets([planetId]);
    // const artifactsOnPlanet = artifactsOnPlanets[0];

    const revealedCoords =
      this.contractsAPI.getRevealedCoordsByIdIfExists(planetId);

    // const claimedCoords =
    //   await this.contractsAPI.getClaimedCoordsByIdIfExists(planetId);
    // const burnedCoords =
    //   await this.contractsAPI.getBurnedCoordsByIdIfExists(planetId);
    // const kardashevCoords =
    //   await this.contractsAPI.getKardashevCoordsByIdIfExists(planetId);

    let revealedLocation: RevealedLocation | undefined;
    // let claimedLocation: ClaimedLocation | undefined;
    // let burnedLocation: BurnedLocation | undefined;
    // let kardashevLocation: KardashevLocation | undefined;

    if (revealedCoords) {
      revealedLocation = {
        ...this.locationFromCoords(revealedCoords),
        revealer: revealedCoords.revealer,
      };
    }

    // if (claimedCoords) {
    //   claimedLocation = {
    //     ...this.locationFromCoords(claimedCoords),
    //     claimer: claimedCoords.claimer,
    //   };
    //   this.getGameObjects().setClaimedLocation(claimedLocation);

    //   //to show planet in map
    //   revealedLocation = {
    //     ...this.locationFromCoords(claimedCoords),
    //     revealer: claimedCoords.claimer,
    //   };
    // } else if (revealedCoords) {
    //   revealedLocation = {
    //     ...this.locationFromCoords(revealedCoords),
    //     revealer: revealedCoords.revealer,
    //   };
    // } else if (burnedCoords) {
    //   burnedLocation = {
    //     ...this.locationFromCoords(burnedCoords),
    //     operator: burnedCoords.operator,
    //     radius:
    //       this.getContractConstants().BURN_PLANET_LEVEL_EFFECT_RADIUS[
    //         planet.planetLevel
    //       ],
    //   };

    //   //to show planet in map
    //   revealedLocation = {
    //     ...this.locationFromCoords(burnedCoords),
    //     revealer: burnedCoords.operator,
    //   };
    //   this.getGameObjects().setBurnedLocation(burnedLocation);
    // } else if (kardashevCoords) {
    //   kardashevLocation = {
    //     ...this.locationFromCoords(kardashevCoords),
    //     operator: kardashevCoords.operator,
    //     radius:
    //       this.getContractConstants().KARDASHEV_EFFECT_RADIUS[
    //         planet.planetLevel
    //       ],
    //   };

    //   //to show planet in map
    //   revealedLocation = {
    //     ...this.locationFromCoords(kardashevCoords),
    //     revealer: kardashevCoords.operator,
    //   };
    //   this.getGameObjects().setKardashevLocation(kardashevLocation);
    // }

    this.entityStore.replacePlanetFromContractData(
      planet,
      arrivals,
      planet.heldArtifactIds, // artifactsOnPlanet.map((a) => a.id),
      revealedLocation,
      // claimedCoords?.claimer,
      // burnedCoords?.operator,
      // kardashevCoords?.operator,
    );

    // it's important that we reload the artifacts that are on the planet after the move
    // completes because this move could have been a photoid canon move. one of the side
    // effects of this type of move is that the active photoid canon deactivates upon a move
    // meaning we need to reload its data from the blockchain.

    planet.heldArtifactIds.forEach((a) => this.hardRefreshArtifact(a));
  }

  public bulkHardRefreshPlanets(planetIds: LocationId[]): void {
    const total = planetIds.length;
    let completed = 0;
    let lastProgressShown = 0; // Track last shown progress

    for (const planetId of planetIds) {
      this.hardRefreshPlanet(planetId);
      completed++;
      // Calculate current progress
      const progress = Math.floor((completed / total) * 100);

      // Show progress every 10%
      if (progress >= lastProgressShown + 10) {
        console.log(`Bulk refresh planets progress: ${progress}%`);
        lastProgressShown = progress;
      }
    }
    console.log("Bulk refresh planets completed: 100%");

    return;
    const planetVoyageMap: Map<LocationId, QueuedArrival[]> = new Map();

    const allVoyages = this.contractsAPI.getAllArrivals(planetIds);

    const planetsToUpdateMap = this.contractsAPI.bulkGetPlanets(planetIds);

    // const artifactsOnPlanets =
    //   await this.contractsAPI.bulkGetArtifactsOnPlanets(planetIds);
    planetsToUpdateMap.forEach((planet, locId) => {
      if (planetsToUpdateMap.has(locId)) {
        planetVoyageMap.set(locId, []);
      }
    });

    for (const voyage of allVoyages) {
      const voyagesForToPlanet = planetVoyageMap.get(voyage.toPlanet);
      if (voyagesForToPlanet) {
        voyagesForToPlanet.push(voyage);
        planetVoyageMap.set(voyage.toPlanet, voyagesForToPlanet);
      }
    }

    for (let i = 0; i < planetIds.length; i++) {
      const planetId = planetIds[i];
      const planet = planetsToUpdateMap.get(planetId);

      // This shouldn't really happen, but we are better off being safe - opposed to throwing
      if (!planet) {
        continue;
      }

      const voyagesForPlanet = planetVoyageMap.get(planet.locationId);
      if (voyagesForPlanet) {
        this.entityStore.replacePlanetFromContractData(
          planet,
          voyagesForPlanet,
          undefined, //  artifactsOnPlanets[i].map((a) => a.id),
        );
      }
    }

    // for (const artifacts of artifactsOnPlanets) {
    //   this.entityStore.replaceArtifactsFromContractData(artifacts);
    // }
  }

  public hardRefreshArtifact(artifactId: ArtifactId): void {
    const artifacts = this.contractsAPI.bulkGetArtifacts([artifactId]);
    const artifact = artifacts.get(artifactId);
    if (!artifact) {
      this.entityStore.handleMissingArtifactOnChain(artifactId);
      return;
    }
    this.entityStore.replaceArtifactFromContractData(artifact);
  }

  //mytodo: test more
  // public async hardRefreshPinkZones(): Promise<void> {
  //   const loadedBurnedCoords =
  //     await this.contractsAPI.getBurnedPlanetsCoords(0);

  //   for (const item of loadedBurnedCoords) {
  //     const locationId = item.hash;
  //     const planet = this.getPlanetWithId(locationId);
  //     if (planet === undefined) {
  //       continue;
  //     }

  //     const burnedLocation = {
  //       ...this.locationFromCoords(item),
  //       operator: item.operator,
  //       radius:
  //         this.getContractConstants().BURN_PLANET_LEVEL_EFFECT_RADIUS[
  //           planet.planetLevel
  //         ],
  //     };

  //     this.getGameObjects().setBurnedLocation(burnedLocation);
  //   }
  // }

  //mytodo: test more
  // public async hardRefreshBlueZones(): Promise<void> {
  //   const loadedKardashevCoords =
  //     await this.contractsAPI.getKardashevPlanetsCoords(0);

  //   for (const item of loadedKardashevCoords) {
  //     const locationId = item.hash;
  //     const planet = this.getPlanetWithId(locationId);
  //     if (planet === undefined) {
  //       continue;
  //     }

  //     const kardashevLocation = {
  //       ...this.locationFromCoords(item),
  //       operator: item.operator,
  //       radius:
  //         this.getContractConstants().KARDASHEV_EFFECT_RADIUS[
  //           planet.planetLevel
  //         ],
  //     };

  //     this.getGameObjects().setKardashevLocation(kardashevLocation);
  //   }
  // }

  public onTxSubmit(tx: Transaction): void {
    this.terminal.current?.print(
      `${tx.intent.methodName} transaction (`,
      TerminalTextStyle.Blue,
    );
    this.terminal.current?.printLink(
      `${tx.hash?.slice(0, 6) ?? ""}`,
      () => {
        window.open(`${BLOCK_EXPLORER_URL}/tx/${tx.hash ?? ""}`);
      },
      TerminalTextStyle.White,
    );
    this.terminal.current?.println(`) submitted`, TerminalTextStyle.Blue);
  }

  public onTxConfirmed(tx: Transaction) {
    this.terminal.current?.print(
      `${tx.intent.methodName} transaction (`,
      TerminalTextStyle.Green,
    );
    this.terminal.current?.printLink(
      `${tx.hash?.slice(0, 6) ?? ""}`,
      () => {
        window.open(`${BLOCK_EXPLORER_URL}/tx/${tx.hash ?? ""}`);
      },
      TerminalTextStyle.White,
    );
    this.terminal.current?.println(`) confirmed`, TerminalTextStyle.Green);
  }

  public onTxReverted(tx: Transaction) {
    this.terminal.current?.print(
      `${tx.intent.methodName} transaction (`,
      TerminalTextStyle.Red,
    );
    this.terminal.current?.printLink(
      `${tx.hash?.slice(0, 6) ?? ""}`,
      () => {
        window.open(`${BLOCK_EXPLORER_URL}/tx/${tx.hash ?? ""}`);
      },
      TerminalTextStyle.White,
    );

    this.terminal.current?.println(`) reverted`, TerminalTextStyle.Red);
  }

  public onTxCancelled(tx: Transaction) {
    this.entityStore.clearUnconfirmedTxIntent(tx);
    this.terminal.current?.print(
      `${tx.intent.methodName} transaction (`,
      TerminalTextStyle.Red,
    );
    this.terminal.current?.printLink(
      `${tx.hash?.slice(0, 6) ?? ""}`,
      () => {
        window.open(`${BLOCK_EXPLORER_URL}/tx/${tx.hash ?? ""}`);
      },
      TerminalTextStyle.White,
    );

    this.terminal.current?.println(`) cancelled`, TerminalTextStyle.Red);
  }

  /**
   * Gets the address of the player logged into this game manager.
   */
  public getAccount(): EthAddress | undefined {
    return this.account;
  }

  public getMainAccount(): EthAddress | undefined {
    return this.account;
  }

  public getGameAccount(): EthAddress | undefined {
    return this.ethConnection.getAddress();
  }

  public isOwnedByMe(planet: Planet): boolean {
    return planet.owner === this.getAccount();
  }

  /**
   * Get the thing that handles contract interaction.
   */
  public getContractAPI(): ContractsAPI {
    return this.contractsAPI;
  }

  /**
   * Gets the address of the `DarkForest` contract, which is the 'backend' of the game.
   */
  public getContractAddress(): EthAddress {
    return this.contractsAPI.getContractAddress();
  }

  public getCurrentTick(): number {
    return this.contractsAPI.getCurrentTick();
  }

  public getCurrentTickerRate(): number {
    return this.contractsAPI.getCurrentTickerRate();
  }

  public convertTickToMs(tick: number): number {
    return this.contractsAPI.convertTickToMs(tick);
  }

  /**
   * Gets the twitter handle of the given ethereum account which is associated
   * with Dark Forest.
   */
  // public getTwitter(address: EthAddress | undefined): string | undefined {
  //   let myAddress;
  //   if (!address) {
  //     myAddress = this.getAccount();
  //   } else {
  //     myAddress = address;
  //   }

  //   if (!myAddress) {
  //     return undefined;
  //   }
  //   const twitter = this.players.get(myAddress)?.twitter;
  //   return twitter;
  // }

  /**
   * The game ends at a particular time in the future - get this time measured
   * in seconds from the epoch.
   */
  // public getEndTimeSeconds(): number {
  //   return this.endTimeSeconds;
  // }

  /**
   * Dark Forest tokens can only be minted up to a certain time - get this time measured in seconds from epoch.
   */
  // public getTokenMintEndTimeSeconds(): number {
  //   return this.contractConstants.TOKEN_MINT_END_TIMESTAMP;
  // }

  /**
   * Dark Forest planets can only be claimed to a certain time - get this time measured in seconds from epoch.
   */
  // public getClaimEndTimeSeconds(): number {
  //   return this.contractConstants.CLAIM_END_TIMESTAMP;
  // }

  /**
   * Gets the rarity of planets in the universe
   */
  public getPlanetRarity(): number {
    return this.contractConstants.PLANET_RARITY;
  }

  /**
   * returns timestamp (seconds) that planet will reach percent% of energycap
   * time may be in the past
   */
  public getEnergyCurveAtPercent(planet: Planet, percent: number): number {
    return this.entityStore.getEnergyCurveAtPercent(planet, percent);
  }

  /**
   * returns timestamp (seconds) that planet will reach percent% of silcap if
   * doesn't produce silver, returns undefined if already over percent% of silcap,
   */
  public getSilverCurveAtPercent(
    planet: Planet,
    percent: number,
  ): number | undefined {
    return this.entityStore.getSilverCurveAtPercent(planet, percent);
  }

  /**
   * Returns the upgrade that would be applied to a planet given a particular
   * upgrade branch (defense, range, speed) and level of upgrade.
   */
  public getUpgrade(branch: number, level: number): Upgrade {
    return this.contractConstants.upgrades[branch][level];
  }

  /**
   * Gets a list of all the players in the game (not just the ones you've
   * encounterd)
   */
  public getAllPlayers(): Player[] {
    return Array.from(this.players.values());
  }

  /**
   * Gets either the given player, or if no address was provided, gets the player that is logged
   * this client.
   */
  public getPlayer(address?: EthAddress): Player | undefined {
    address = address || this.account;

    if (!address) {
      return undefined;
    }

    return this.players.get(address);
  }

  /**
   * Gets all the map chunks that this client is aware of. Chunks may have come from
   * mining, or from importing map data.
   */
  public getExploredChunks(): Iterable<Chunk> {
    return this.persistentChunkStore.allChunks();
  }

  /**
   * Gets the ids of all the planets that are both within the given bounding box (defined by its bottom
   * left coordinate, width, and height) in the world and of a level that was passed in via the
   * `planetLevels` parameter.
   */
  public getPlanetsInWorldRectangle(
    worldX: number,
    worldY: number,
    worldWidth: number,
    worldHeight: number,
    levels: number[],
    planetLevelToRadii: Map<number, Radii>,
    updateIfStale = true,
  ): LocatablePlanet[] {
    return this.entityStore.getPlanetsInWorldRectangle(
      worldX,
      worldY,
      worldWidth,
      worldHeight,
      levels,
      planetLevelToRadii,
      updateIfStale,
    );
  }

  /**
   * Returns whether or not the current round has ended.
   */
  public isRoundOver(): boolean {
    return false;
    // return Date.now() / 1000 > this.getTokenMintEndTimeSeconds();
  }

  /**
   * Gets the radius of the playable area of the universe.
   */
  public getWorldRadius(): number {
    return this.worldRadius;
  }

  public getInnerRadius(): number {
    return this.contractsAPI.getCurrentInnerRadius();
  }

  /**
   * Gets the total amount of silver that lives on a planet that somebody owns.
   */
  public getWorldSilver(): number {
    return this.getAllOwnedPlanets().reduce(
      (totalSoFar: number, nextPlanet: Planet) =>
        totalSoFar + nextPlanet.silver,
      0,
    );
  }

  /**
   * Gets the total amount of energy that lives on a planet that somebody owns.
   */
  public getUniverseTotalEnergy(): number {
    return this.getAllOwnedPlanets().reduce(
      (totalSoFar: number, nextPlanet: Planet) =>
        totalSoFar + nextPlanet.energy,
      0,
    );
  }

  /**
   * Gets the total amount of silver that lives on planets that the given player owns.
   */
  public getSilverOfPlayer(player: EthAddress): number {
    return this.getAllOwnedPlanets()
      .filter((planet) => planet.owner === player)
      .reduce(
        (totalSoFar: number, nextPlanet: Planet) =>
          totalSoFar + nextPlanet.silver,
        0,
      );
  }

  /**
   * Gets the total amount of energy that lives on planets that the given player owns.
   */
  public getEnergyOfPlayer(player: EthAddress): number {
    return this.getAllOwnedPlanets()
      .filter((planet) => planet.owner === player)
      .reduce(
        (totalSoFar: number, nextPlanet: Planet) =>
          totalSoFar + nextPlanet.energy,
        0,
      );
  }

  public getPlayerScore(addr: EthAddress): number | undefined {
    const player = this.players.get(addr);
    if (!player) {
      return undefined;
    }

    return player?.score;
  }

  public getPlayerSpaceJunk(addr: EthAddress): number | undefined {
    const player = this.players.get(addr);
    return player?.junk;
  }

  public getPlayerSpaceJunkLimit(
    addr: EthAddress | undefined,
  ): number | undefined {
    if (addr === undefined) return undefined;

    const player = this.players.get(addr);
    return player?.junkLimit;
  }

  // public getPlayerActivateArtifactAmount(addr: EthAddress): number | undefined {
  //   const player = this.players.get(addr);
  //   return player?.activateArtifactAmount;
  // }

  // public getPlayerBuyArtifactAmount(addr: EthAddress): number | undefined {
  //   const player = this.players.get(addr);
  //   return player?.buyArtifactAmount;
  // }

  // public getPlayerSilver(addr: EthAddress): number | undefined {
  //   const player = this.players.get(addr);
  //   return player?.silver;
  // }

  // public getDefaultSpaceJunkForPlanetLevel(level: number) {
  //   return this.contractConstants.PLANET_LEVEL_JUNK[level];
  // }

  public initMiningManager(homeCoords: WorldCoords, cores?: number): void {
    if (this.minerManager) {
      return;
    }

    const myPattern: MiningPattern = new SpiralPattern(
      homeCoords,
      MIN_CHUNK_SIZE,
    );

    this.minerManager = MinerManager.create(
      this.persistentChunkStore,
      myPattern,
      this.worldRadius,
      this.getInnerRadius(),
      this.planetRarity,
      this.hashConfig,
      this.useMockHash,
    );

    const config = {
      contractAddress: this.getContractAddress(),
      account: this.ethConnection.getAddress(),
    };

    this.minerManager.setCores(
      cores || getNumberSetting(config, Setting.MiningCores),
    );

    this.minerManager.on(
      MinerManagerEvent.DiscoveredNewChunk,
      (chunk: Chunk, miningTimeMillis: number) => {
        this.addNewChunk(chunk);
        this.hashRate =
          chunk.chunkFootprint.sideLength ** 2 / (miningTimeMillis / 1000);
        this.emit(GameManagerEvent.DiscoveredNewChunk, chunk);
      },
    );

    const isMining = getBooleanSetting(config, Setting.IsMining);
    if (isMining) {
      this.minerManager.startExplore();
    }
  }

  /**
   * Sets the mining pattern of the miner. This kills the old miner and starts this one.
   */
  setMiningPattern(pattern: MiningPattern): void {
    if (this.minerManager) {
      this.minerManager.setMiningPattern(pattern);
    }
  }

  /**
   * Gets the mining pattern that the miner is currently using.
   */
  getMiningPattern(): MiningPattern | undefined {
    if (this.minerManager) {
      return this.minerManager.getMiningPattern();
    } else {
      return undefined;
    }
  }

  /**
   * Set the amount of cores to mine the universe with. More cores equals faster!
   */
  setMinerCores(nCores: number): void {
    const config = {
      contractAddress: this.getContractAddress(),
      account: this.ethConnection.getAddress(),
    };
    setSetting(config, Setting.MiningCores, nCores + "");
  }

  /**
   * Whether or not the miner is currently exploring space.
   */
  isMining(): boolean {
    return this.minerManager?.isMining() || false;
  }

  /**
   * Changes the amount of move snark proofs that are cached.
   */
  setSnarkCacheSize(size: number): void {
    this.snarkHelper.setSnarkCacheSize(size);
  }

  /**
   * Gets the rectangle bounding the chunk that the miner is currently in the process
   * of hashing.
   */
  getCurrentlyExploringChunk(): Rectangle | undefined {
    if (this.minerManager) {
      return this.minerManager.getCurrentlyExploringChunk();
    }
    return undefined;
  }

  /**
   * Whether or not this client has successfully found and landed on a home planet.
   */
  hasJoinedGame(): boolean {
    const account = this.getAccount();
    if (!account) {
      return false;
    }

    const player = this.players.get(account);
    if (!player) {
      return false;
    }

    return this.contractsAPI.hasJoinedGame(player.address);
  }

  /**
   * Returns info about the next time you can broadcast coordinates
   */
  getNextRevealCountdownInfo(): RevealCountdownInfo {
    if (!this.account) {
      throw new Error("no account set");
    }

    const myLastRevealTick = this.players.get(this.account)?.lastRevealTick;

    const myLastRevealTimestamp = myLastRevealTick
      ? Math.floor(this.convertTickToMs(myLastRevealTick) / 1000)
      : undefined;

    return {
      myLastRevealTimestamp: myLastRevealTimestamp || undefined,
      currentlyRevealing: this.entityStore.transactions.hasTransaction(
        isUnconfirmedRevealTx,
      ),
      revealCooldownTime: this.contractConstants.LOCATION_REVEAL_COOLDOWN,
    };
  }

  /**
   * Returns info about the next time you can claim a Planet
   */
  // getNextClaimCountdownInfo(): ClaimCountdownInfo {
  //   if (!this.account) {
  //     throw new Error("no account set");
  //   }
  //   const myLastClaimTimestamp = this.players.get(
  //     this.account,
  //   )?.lastClaimTimestamp;
  //   return {
  //     myLastClaimTimestamp: myLastClaimTimestamp || undefined,
  //     currentlyClaiming:
  //       !!this.entityStore.transactions.hasTransaction(isUnconfirmedClaimTx),
  //     claimCooldownTime: this.contractConstants.CLAIM_PLANET_COOLDOWN,
  //   };
  // }

  /**
   * Returns info about the next time you can burn a Planet
   */
  // getNextBurnCountdownInfo(): BurnCountdownInfo {
  //   if (!this.account) {
  //     throw new Error("no account set");
  //   }
  //   const myLastBurnTimestamp = this.players.get(
  //     this.account,
  //   )?.lastBurnTimestamp;
  //   return {
  //     myLastBurnTimestamp: myLastBurnTimestamp || undefined,
  //     currentlyBurning:
  //       !!this.entityStore.transactions.hasTransaction(isUnconfirmedBurnTx),
  //     burnCooldownTime: this.contractConstants.BURN_PLANET_COOLDOWN,
  //   };
  // }

  /**
   * Returns info about the next time you can burn a Planet
   */
  // getNextKardashevCountdownInfo(): KardashevCountdownInfo {
  //   if (!this.account) {
  //     throw new Error("no account set");
  //   }
  //   const myLastKardashevTimestamp = this.players.get(
  //     this.account,
  //   )?.lastKardashevTimestamp;
  //   return {
  //     myLastKardashevTimestamp: myLastKardashevTimestamp || undefined,
  //     currentlyKardasheving: !!this.entityStore.transactions.hasTransaction(
  //       isUnconfirmedKardashevTx,
  //     ),
  //     kardashevCooldownTime: this.contractConstants.KARDASHEV_PLANET_COOLDOWN,
  //   };
  // }

  /**
   * gets both deposited artifacts that are on planets i own as well as artifacts i own
   */
  getMyArtifacts(): Artifact[] {
    if (!this.account) {
      return [];
    }
    const ownedByMe = this.entityStore.getArtifactsOwnedBy(this.account);
    return ownedByMe;
    // const onPlanetsOwnedByMe = this.entityStore
    //   .getArtifactsOnPlanetsOwnedBy(this.account)
    //   // filter out space ships because they always show up
    //   // in the `ownedByMe` array.
    //   .filter((a) => !isSpaceShip(a.artifactType));

    // return [...ownedByMe, ...onPlanetsOwnedByMe];
  }

  /**
   * Gets the planet that is located at the given coordinates. Returns undefined if not a valid
   * location or if no planet exists at location. If the planet needs to be updated (because
   * some time has passed since we last updated the planet), then updates that planet first.
   */
  getPlanetWithCoords(coords: WorldCoords): LocatablePlanet | undefined {
    return this.entityStore.getPlanetWithCoords(coords);
  }

  /**
   * Gets the planet with the given hash. Returns undefined if the planet is neither in the contract
   * nor has been discovered locally. If the planet needs to be updated (because some time has
   * passed since we last updated the planet), then updates that planet first.
   */
  getPlanetWithId(planetId: LocationId | undefined): Planet | undefined {
    return planetId && this.entityStore.getPlanetWithId(planetId);
  }

  /**
   * Gets a list of planets in the client's memory with the given ids. If a planet with the given id
   * doesn't exist, no entry for that planet will be returned in the result.
   */
  getPlanetsWithIds(planetId: LocationId[]): Planet[] {
    return planetId
      .map((id) => this.getPlanetWithId(id))
      .filter((p) => !!p) as Planet[];
  }

  getStalePlanetWithId(planetId: LocationId): Planet | undefined {
    return this.entityStore.getPlanetWithId(planetId, false);
  }

  /**
   * Get the score of the currently logged-in account.
   */
  getMyScore(): number | undefined {
    return undefined;
    // if (!this.account) {
    //   return undefined;
    // }
    // const player = this.players.get(this.account);
    // return player?.score;
  }

  /**
   * Gets the artifact with the given id. Null if no artifact with id exists.
   */
  getArtifactWithId(artifactId?: ArtifactId): Artifact | undefined {
    return this.entityStore.getArtifactById(artifactId);
  }

  /**
   * Gets the artifacts with the given ids, including ones we know exist but haven't been loaded,
   * represented by `undefined`.
   */
  getArtifactsWithIds(
    artifactIds: ArtifactId[] = [],
  ): Array<Artifact | undefined> {
    return artifactIds.map((id) => this.getArtifactWithId(id));
  }

  /**
   * Gets the level of the given planet. Returns undefined if the planet does not exist. Does
   * NOT update the planet if the planet is stale, which means this function is fast.
   */
  getPlanetLevel(planetId: LocationId): PlanetLevel | undefined {
    return this.entityStore.getPlanetLevel(planetId);
  }

  /**
   * Gets the location of the given planet. Returns undefined if the planet does not exist, or if
   * we do not know the location of this planet NOT update the planet if the planet is stale,
   * which means this function is fast.
   */
  getLocationOfPlanet(planetId: LocationId): WorldLocation | undefined {
    return this.entityStore.getLocationOfPlanet(planetId);
  }

  /**
   * Gets all voyages that have not completed.
   */
  getAllVoyages(): QueuedArrival[] {
    return this.entityStore.getAllVoyages();
  }

  /**
   * Gets all planets. This means all planets that are in the contract, and also all
   * planets that have been mined locally. Does not update planets if they are stale.
   * NOT PERFORMANT - for scripting only.
   */
  getAllPlanets(): Iterable<Planet> {
    return this.entityStore.getAllPlanets();
  }

  /**
   * Gets a list of planets that have an owner.
   */
  getAllOwnedPlanets(): Planet[] {
    return this.entityStore.getAllOwnedPlanets();
  }

  /**
   * Gets a list of the planets that the player logged into this `GameManager` owns.
   */
  getMyPlanets(): Planet[] {
    return this.getAllOwnedPlanets().filter(
      (planet) => planet.owner === this.account,
    );
  }

  /**
   * Gets a map of all location IDs whose coords have been publically revealed
   */
  getRevealedLocations(): Map<LocationId, RevealedLocation> {
    return this.entityStore.getRevealedLocations();
  }

  /**
   * Gets a map of all location IDs which have been claimed.
   */
  // getClaimedLocations(): Map<LocationId, ClaimedLocation> {
  //   return this.entityStore.getClaimedLocations();
  // }

  /**
   * Gets a map of all location IDs which have been claimed.
   */
  // getBurnedLocations(): Map<LocationId, BurnedLocation> {
  //   return this.entityStore.getBurnedLocations();
  // }

  getPinkZones(): Set<PinkZone> {
    const pinkZonesMap = this.entityStore.getPinkZones();
    return new Set(pinkZonesMap.values());
  }
  // getAIZones(begin: WorldCoords, end: WorldCoords): Set<AIZone> {
  getAIZones(): Set<AIZone> {
    const savedRange = localStorage.getItem("aiselectedRange");

    const selectedCoords = JSON.parse(savedRange);
    const _: AIZone = {
      beginCoords: selectedCoords.begin,
      endCoords: selectedCoords.end,
    };

    return new Set([_]);
  }

  getPinkZoneByArtifactId(artifactId: ArtifactId): PinkZone | undefined {
    return this.entityStore.getPinkZones().get(artifactId);
  }

  // getKardashevLocations(): Map<LocationId, BurnedLocation> {
  //   return this.entityStore.getKardashevLocations();
  // }

  /**
   * Each coordinate lives in a particular type of space, determined by a smooth random
   * function called 'perlin noise.
   */
  spaceTypeFromPerlin(perlin: number, distFromOrigin: number): SpaceType {
    return this.entityStore.spaceTypeFromPerlin(perlin, distFromOrigin);
  }

  /**
   * Gets the amount of hashes per second that the miner manager is calculating.
   */
  getHashesPerSec(): number {
    return this.hashRate;
  }

  /**
   * Signs the given twitter handle with the private key of the current user. Used to
   * verify that the person who owns the Dark Forest account was the one that attempted
   * to link a twitter to their account.
   */
  async getSignedTwitter(twitter: string): Promise<string> {
    return this.ethConnection.signMessage(twitter);
  }

  /**
   * Gets the private key of the burner wallet used by this account.
   */
  getPrivateKey(): string | undefined {
    return this.ethConnection.getPrivateKey();
  }

  /**
   * Gets the balance of the account measured in Eth (i.e. in full units of the chain).
   */
  getMyBalanceEth(): number {
    if (!this.account) {
      return 0;
    }
    return weiToEth(this.getMyBalance());
  }

  /**
   * Gets the balance of the account
   */
  getMyBalance(): BigNumber {
    return this.ethConnection.getMyBalance() || BigNumber.from("0");
  }

  /**
   * Returns the monomitter which publishes events whenever the player's balance changes.
   */
  getMyBalance$(): Monomitter<BigNumber> {
    return this.ethConnection.myBalance$;
  }

  /**
   * Gets all moves that this client has queued to be uploaded to the contract, but
   * have not been successfully confirmed yet.
   */
  getUnconfirmedMoves(): Transaction<UnconfirmedMove>[] {
    return this.entityStore.transactions.getTransactions(isUnconfirmedMoveTx);
  }

  /**
   * Gets all upgrades that this client has queued to be uploaded to the contract, but
   * have not been successfully confirmed yet.
   */
  getUnconfirmedUpgrades(): Transaction<UnconfirmedUpgrade>[] {
    return this.entityStore.transactions.getTransactions(
      isUnconfirmedUpgradeTx,
    );
  }

  getUnconfirmedRefreshPlanets(): Transaction<UnconfirmedRefreshPlanet>[] {
    return this.entityStore.transactions.getTransactions(
      isUnconfirmedRefreshPlanetTx,
    );
  }

  getUnconfirmedLinkActivations(): Transaction<UnconfirmedActivateArtifact>[] {
    return this.entityStore.transactions
      .getTransactions(isUnconfirmedActivateArtifactTx)
      .filter((tx) => tx.intent.linkTo !== undefined);
  }

  /**
   * Gets the location of your home planet.
   */
  getHomeCoords(): WorldCoords | undefined {
    if (!this.homeLocation) {
      return undefined;
    }
    return {
      x: this.homeLocation.coords.x,
      y: this.homeLocation.coords.y,
    };
  }

  /**
   * Gets the hash of the location of your home planet.
   */
  getHomeHash(): LocationId | undefined {
    return this.homeLocation?.hash;
  }

  /**
   * Gets the HASH CONFIG
   */
  getHashConfig(): HashConfig {
    return { ...this.hashConfig };
  }

  /**
   * Whether or not the given rectangle has been mined.
   */
  hasMinedChunk(chunkLocation: Rectangle): boolean {
    return this.persistentChunkStore.hasMinedChunk(chunkLocation);
  }

  getChunk(chunkFootprint: Rectangle): Chunk | undefined {
    return this.persistentChunkStore.getChunkByFootprint(chunkFootprint);
  }

  getChunkStore(): PersistentChunkStore {
    return this.persistentChunkStore;
  }

  /**
   * The perlin value at each coordinate determines the space type. There are four space
   * types, which means there are four ranges on the number line that correspond to
   * each space type. This function returns the boundary values between each of these
   * four ranges: `PERLIN_THRESHOLD_1`, `PERLIN_THRESHOLD_2`, `PERLIN_THRESHOLD_3`.
   */
  getPerlinThresholds(): [number, number, number] {
    return [
      this.contractConstants.PERLIN_THRESHOLD_1,
      this.contractConstants.PERLIN_THRESHOLD_2,
      this.contractConstants.PERLIN_THRESHOLD_3,
    ];
  }

  /**
   * Starts the miner.
   */
  startExplore(): void {
    if (this.minerManager) {
      const config = {
        contractAddress: this.getContractAddress(),
        account: this.ethConnection.getAddress(),
      };
      setBooleanSetting(config, Setting.IsMining, true);
      this.minerManager.startExplore();
    }
  }

  /**
   * Stops the miner.
   */
  stopExplore(): void {
    if (this.minerManager) {
      const config = {
        contractAddress: this.getContractAddress(),
        account: this.ethConnection.getAddress(),
      };
      setBooleanSetting(config, Setting.IsMining, false);
      this.hashRate = 0;
      this.minerManager.stopExplore();
    }
  }

  public setRadius(worldRadius: number) {
    this.worldRadius = worldRadius;

    if (this.minerManager) {
      this.minerManager.setRadius(this.worldRadius);
    }
  }

  // private async refreshTwitters(): Promise<void> {
  //   const addressTwitters = await getAllTwitters();
  //   this.setPlayerTwitters(addressTwitters);
  // }

  // private setPlayerTwitters(twitters: AddressTwitterMap): void {
  //   for (const [address, player] of this.players.entries()) {
  //     const newPlayerTwitter = twitters[address];
  //     // player.twitter = newPlayerTwitter;
  //   }
  //   this.playersUpdated$.publish();
  // }

  /**
   * Once you have posted the verification tweet - complete the twitter-account-linking
   * process by telling the Dark Forest webserver to look at that tweet.
   */
  // async submitVerifyTwitter(twitter: string): Promise<boolean> {
  //   if (!this.account) {
  //     return Promise.resolve(false);
  //   }
  //   const success = await verifyTwitterHandle(
  //     await this.ethConnection.signMessageObject({ twitter }),
  //   );
  //   await this.refreshTwitters();
  //   return success;
  // }

  private checkGameHasEnded(): boolean {
    if (Date.now() / 1000 > this.endTimeSeconds) {
      this.terminal.current?.println("[ERROR] Game has ended.");
      return true;
    }
    return false;
  }

  /**
   * Gets the timestamp (ms) of the next time that we can broadcast the coordinates of a planet.
   */
  public getNextBroadcastAvailableTimestamp() {
    return Date.now() + this.timeUntilNextBroadcastAvailable();
  }

  /**
   * Gets the amount of time (ms) until the next time the current player can broadcast a planet.
   */
  public timeUntilNextBroadcastAvailable() {
    if (!this.account) {
      throw new Error("no account set");
    }

    const myLastRevealTick = this.players.get(this.account)?.lastRevealTick;

    const myLastRevealTimestamp = myLastRevealTick
      ? Math.floor(this.convertTickToMs(myLastRevealTick) / 1000)
      : undefined;

    return timeUntilNextBroadcastAvailable(
      myLastRevealTimestamp,
      this.contractConstants.LOCATION_REVEAL_COOLDOWN,
    );
  }

  /**
   * Gets the timestamp (ms) of the next time that we can claim a planet.
   */
  // public getNextClaimAvailableTimestamp() {
  //   // both the variables in the next line are denominated in seconds
  //   return Date.now() + this.timeUntilNextClaimAvailable();
  // }

  /**
   * Gets the amount of time (ms) until the next time the current player can claim a planet.
   */
  // public timeUntilNextClaimAvailable() {
  //   if (!this.account) {
  //     throw new Error("no account set");
  //   }

  //   const myLastClaimTimestamp = this.players.get(
  //     this.account,
  //   )?.lastClaimTimestamp;

  //   // Calculation formula is the same
  //   return timeUntilNextBroadcastAvailable(
  //     myLastClaimTimestamp,
  //     this.contractConstants.CLAIM_PLANET_COOLDOWN,
  //   );
  // }

  /**
   * Gets the timestamp (ms) of the next time that we can burn a planet.
   */
  // public getNextBurnAvailableTimestamp() {
  //   return Date.now() + this.timeUntilNextBurnAvailable();
  // }

  /**
   * Gets the amount of time (ms) until the next time the current player can burn a planet.
   */
  // public timeUntilNextBurnAvailable() {
  //   if (!this.account) {
  //     throw new Error("no account set");
  //   }

  //   const myLastBurnTimestamp = this.players.get(
  //     this.account,
  //   )?.lastBurnTimestamp;

  //   // Calculation formula is the same
  //   return timeUntilNextBroadcastAvailable(
  //     myLastBurnTimestamp,
  //     this.contractConstants.BURN_PLANET_COOLDOWN,
  //   );
  // }

  /**
   * Gets the timestamp (ms) of the next time that we can pink a planet.
   */
  // public getNextPinkAvailableTimestamp(planetId: LocationId) {
  //   if (!this.account) {
  //     throw new Error("no account set");
  //   }
  //   const planet = this.getPlanetWithId(planetId);
  //   if (!isLocatable(planet)) {
  //     return 0;
  //   }
  //   const myPinkZones = this.getMyPinkZones();
  //   let result = -1;
  //   for (const pinkZone of myPinkZones) {
  //     const burnPlanetId = pinkZone.locationId;
  //     const coords = pinkZone.coords;
  //     const radius = pinkZone.radius;
  //     const burnPlanet = this.getPlanetWithId(burnPlanetId);
  //     if (!burnPlanet) {
  //       continue;
  //     }
  //     if (!burnPlanet.burnStartTimestamp) {
  //       continue;
  //     }

  //     const dis = this.getDistCoords(coords, planet.location.coords);

  //     if (dis <= radius) {
  //       if (result === -1) {
  //         result = burnPlanet.burnStartTimestamp;
  //       } else {
  //         result = result = Math.min(result, burnPlanet.burnStartTimestamp);
  //       }
  //     }
  //   }

  //   if (result === 1) {
  //     return 0;
  //   } else {
  //     return (result + this.contractConstants.PINK_PLANET_COOLDOWN) * 1000;
  //   }
  // }

  /**
   * Gets the center planet for blueLocation
   */
  // public getBlueZoneCenterPlanetId(planetId: LocationId) {
  //   let centerPlanetId = undefined;
  //   let dis = undefined;
  //   if (!this.account) {
  //     throw new Error("no account set");
  //   }
  //   const planet = this.getPlanetWithId(planetId);
  //   if (!isLocatable(planet)) {
  //     return undefined;
  //   }
  //   const myBlueZones = this.getMyBlueZones();

  //   for (const blueZone of myBlueZones) {
  //     const blueZoneCenterPlanetId = blueZone.locationId;
  //     const coords = blueZone.coords;

  //     const centerPlanet = this.getPlanetWithId(blueZoneCenterPlanetId);
  //     if (!centerPlanet) {
  //       continue;
  //     }
  //     if (!centerPlanet.kardashevTimestamp) {
  //       continue;
  //     }
  //     const distanceToZone = this.getDistCoords(coords, planet.location.coords);
  //     if (
  //       distanceToZone <=
  //       this.contractConstants.KARDASHEV_EFFECT_RADIUS[centerPlanet.planetLevel]
  //     ) {
  //       if (centerPlanetId === undefined || dis === undefined) {
  //         centerPlanetId = centerPlanet.locationId;
  //         dis = distanceToZone;
  //       } else if (distanceToZone < dis) {
  //         centerPlanetId = centerPlanet.locationId;
  //         dis = distanceToZone;
  //       } else if (distanceToZone === dis) {
  //         const tmp = this.getPlanetWithId(centerPlanetId);
  //         if (!tmp) {
  //           continue;
  //         }
  //         if (!tmp.kardashevTimestamp) {
  //           continue;
  //         }
  //         if (!centerPlanet.kardashevTimestamp) {
  //           continue;
  //         }
  //         if (tmp.kardashevTimestamp > centerPlanet.kardashevTimestamp) {
  //           centerPlanetId = centerPlanet.locationId;
  //           dis = distanceToZone;
  //         }
  //       }
  //     }
  //   }
  //   return centerPlanetId;
  // }

  // public getNextKardashevAvailableTimestamp() {
  //   return Date.now() + this.timeUntilNextKardashevAvailable();
  // }

  /**
   * Gets the amount of time (ms) until the next time the current player can kardashv a planet.
   */
  // public timeUntilNextKardashevAvailable() {
  //   if (!this.account) {
  //     throw new Error("no account set");
  //   }

  //   const myLastKardashevTimestamp = this.players.get(
  //     this.account,
  //   )?.lastKardashevTimestamp;

  //   // Calculation formula is the same
  //   return timeUntilNextBroadcastAvailable(
  //     myLastKardashevTimestamp,
  //     this.contractConstants.KARDASHEV_PLANET_COOLDOWN,
  //   );
  // }

  // public getNextBlueAvailableTimestamp(planetId: LocationId) {
  //   if (!this.account) {
  //     throw new Error("no account set");
  //   }
  //   const planet = this.getPlanetWithId(planetId);
  //   if (!isLocatable(planet)) {
  //     return 0;
  //   }

  //   const centerPlanetId = this.getBlueZoneCenterPlanetId(planetId);
  //   if (centerPlanetId === undefined) {
  //     return 0;
  //   }
  //   const centerPlanet = this.getPlanetWithId(centerPlanetId);
  //   if (!centerPlanet) {
  //     return 0;
  //   }
  //   if (!centerPlanet.kardashevTimestamp) {
  //     return 0;
  //   }
  //   return (
  //     (centerPlanet.kardashevTimestamp +
  //       this.contractConstants.BLUE_PLANET_COOLDOWN) *
  //     1000
  //   );
  // }
  /**
  /**
   * Gets the timestamp (ms) of the next time that we can activate artifact.
   */
  // public getNextActivateArtifactAvailableTimestamp() {
  //   return Date.now() + this.timeUntilNextActivateArtifactAvailable();
  // }

  /**
   * Gets the amount of time (ms) until the next time the current player can activate artifact.
   */
  // public timeUntilNextActivateArtifactAvailable() {
  //   if (!this.account) {
  //     throw new Error("no account set");
  //   }

  //   const myLastActivateArtifactTimestamp = this.players.get(
  //     this.account,
  //   )?.lastActivateArtifactTimestamp;

  //   // Calculation formula is the same
  //   return timeUntilNextBroadcastAvailable(
  //     myLastActivateArtifactTimestamp,
  //     this.contractConstants.ACTIVATE_ARTIFACT_COOLDOWN,
  //   );
  // }

  /**
   * Gets the timestamp (ms) of the next time that we can activate artifact.
   */
  // public getNextBuyArtifactAvailableTimestamp() {
  //   return Date.now() + this.timeUntilNextBuyArtifactAvailable();
  // }

  /**
   * Gets the amount of time (ms) until the next time the current player can activate artifact.
   */
  // public timeUntilNextBuyArtifactAvailable() {
  //   if (!this.account) {
  //     throw new Error("no account set");
  //   }

  //   const myLastBuyArtifactTimestamp = this.players.get(
  //     this.account,
  //   )?.lastBuyArtifactTimestamp;

  //   // Calculation formula is the same
  //   return timeUntilNextBroadcastAvailable(
  //     myLastBuyArtifactTimestamp,
  //     this.contractConstants.BUY_ARTIFACT_COOLDOWN,
  //   );
  // }

  // public getCaptureZones(): Set<CaptureZone> {
  //   return this.captureZoneGenerator?.getZones() || new Set();
  // }

  // public getPinkZones(): Set<PinkZone> {
  //   const pinkZones = new Set<PinkZone>();
  //   const burnedLocations = this.getBurnedLocations();
  //   const allBurnedLocationsValues = Array.from(burnedLocations.values());

  //   for (const item of allBurnedLocationsValues) {
  //     const planet = this.getPlanetWithId(item.hash);
  //     if (planet === undefined) {
  //       continue;
  //     }
  //     const locationId = planet.locationId;
  //     const coords = { x: item.coords.x, y: item.coords.y };
  //     const operator = item.operator;
  //     const radius =
  //       this.getContractConstants().BURN_PLANET_LEVEL_EFFECT_RADIUS[
  //         planet.planetLevel
  //       ];

  //     pinkZones.add({
  //       locationId: locationId,
  //       coords: coords,
  //       operator: operator,
  //       radius: radius,
  //     });
  //   }

  //   return pinkZones || new Set();
  // }

  // public getMyPinkZones(): Set<PinkZone> {
  //   const pinkZones = new Set<PinkZone>();
  //   const burnedLocations = this.getBurnedLocations();
  //   const allBurnedLocationsValues = Array.from(burnedLocations.values());

  //   for (const item of allBurnedLocationsValues) {
  //     const planet = this.getPlanetWithId(item.hash);
  //     if (planet === undefined) {
  //       continue;
  //     }
  //     if (planet.burnOperator !== this.account) {
  //       continue;
  //     }
  //     const locationId = planet.locationId;
  //     const coords = { x: item.coords.x, y: item.coords.y };
  //     const operator = item.operator;
  //     const radius =
  //       this.getContractConstants().BURN_PLANET_LEVEL_EFFECT_RADIUS[
  //         planet.planetLevel
  //       ];

  //     pinkZones.add({
  //       locationId: locationId,
  //       coords: coords,
  //       operator: operator,
  //       radius: radius,
  //     });
  //   }

  //   return pinkZones || new Set();
  // }

  // public getBlueZones(): Set<PinkZone> {
  //   const blueZones = new Set<PinkZone>();
  //   const kardashevLocations = this.getKardashevLocations();
  //   const allKardashevLocationsValues = Array.from(kardashevLocations.values());

  //   for (const item of allKardashevLocationsValues) {
  //     const planet = this.getPlanetWithId(item.hash);
  //     if (planet === undefined) {
  //       continue;
  //     }
  //     const locationId = planet.locationId;
  //     const coords = { x: item.coords.x, y: item.coords.y };
  //     const operator = item.operator;
  //     const radius =
  //       this.getContractConstants().KARDASHEV_EFFECT_RADIUS[planet.planetLevel];

  //     blueZones.add({
  //       locationId: locationId,
  //       coords: coords,
  //       operator: operator,
  //       radius: radius,
  //     });
  //   }

  //   return blueZones || new Set();
  // }

  // public getMyBlueZones(): Set<PinkZone> {
  //   const blueZones = new Set<PinkZone>();
  //   const kardashevLocations = this.getKardashevLocations();
  //   const allKardashevLocationsValues = Array.from(kardashevLocations.values());

  //   for (const item of allKardashevLocationsValues) {
  //     const planet = this.getPlanetWithId(item.hash);
  //     if (planet === undefined) {
  //       continue;
  //     }
  //     if (planet.kardashevOperator !== this.account) {
  //       continue;
  //     }
  //     const locationId = planet.locationId;
  //     const coords = { x: item.coords.x, y: item.coords.y };
  //     const operator = item.operator;
  //     const radius =
  //       this.getContractConstants().BURN_PLANET_LEVEL_EFFECT_RADIUS[
  //         planet.planetLevel
  //       ];

  //     blueZones.add({
  //       locationId: locationId,
  //       coords: coords,
  //       operator: operator,
  //       radius: radius,
  //     });
  //   }

  //   return blueZones || new Set();
  // }

  private transformRevealArgs(
    args: RevealSnarkContractCallArgs,
  ): [SnarkProof, RevealInput] {
    return [[args[0], args[1], args[2]], args[3]];
  }

  /**
   * Reveals a planet's location on-chain.
   */
  public async revealLocation(
    planetId: LocationId,
  ): Promise<Transaction<UnconfirmedReveal>> {
    try {
      if (!this.account) {
        throw new Error("no account set");
      }

      const planet = this.entityStore.getPlanetWithId(planetId);

      if (!planet) {
        throw new Error("you can't reveal a planet you haven't discovered");
      }

      if (!isLocatable(planet)) {
        throw new Error(
          "you can't reveal a planet whose coordinates you don't know",
        );
      }

      if (planet.coordsRevealed) {
        throw new Error("this planet's location is already revealed");
      }

      if (planet.transactions?.hasTransaction(isUnconfirmedRevealTx)) {
        throw new Error("you're already revealing this planet's location");
      }

      if (this.entityStore.transactions.hasTransaction(isUnconfirmedRevealTx)) {
        throw new Error("you're already broadcasting coordinates");
      }

      const myLastRevealTick = this.players.get(this.account)?.lastRevealTick;
      if (
        myLastRevealTick &&
        Date.now() < this.getNextBroadcastAvailableTimestamp()
      ) {
        throw new Error("still on cooldown for broadcasting");
      }

      // this is shitty. used for the popup window
      localStorage.setItem(
        `${this.ethConnection.getAddress()?.toLowerCase()}-revealLocationId`,
        planetId,
      );

      const getArgs = async () => {
        const revealArgs = await this.snarkHelper.getRevealArgs(
          planet.location.coords.x,
          planet.location.coords.y,
        );

        this.terminal.current?.println(
          "REVEAL: calculated SNARK with args:",
          TerminalTextStyle.Sub,
        );
        this.terminal.current?.println(
          JSON.stringify(hexifyBigIntNestedArray(revealArgs.slice(0, 3))),
          TerminalTextStyle.Sub,
        );
        this.terminal.current?.newline();

        return revealArgs;
      };

      const delegator = this.getAccount();
      if (!delegator) {
        throw Error("no main account");
      }

      const txIntent: UnconfirmedReveal = {
        delegator: delegator,
        methodName: "df__legacyRevealLocation",
        contract: this.contractsAPI.contract,
        locationId: planetId,
        location: planet.location,
        args: getArgs(),
      };

      // console.log(txIntent);

      const transactionFee = this.getTransactionFee();

      // Always await the submitTransaction so we can catch rejections
      const tx = await this.contractsAPI.submitTransaction(txIntent, {
        value: transactionFee,
      });

      return tx;
    } catch (e) {
      this.getNotificationsManager().txInitError(
        "df__legacyRevealLocation",
        (e as Error).message,
      );
      throw e;
    }
  }

  /**
   * claimLocation reveals a planet's location on-chain.
   */
  // public async claimLocation(
  //   planetId: LocationId,
  // ): Promise<Transaction<UnconfirmedClaim>> {
  //   try {
  //     if (!this.account) {
  //       throw new Error("no account set");
  //     }

  //     if (this.checkGameHasEnded()) {
  //       throw new Error("game has ended");
  //     }

  //     const planet = this.entityStore.getPlanetWithId(planetId);

  //     if (!planet) {
  //       throw new Error("you can't claim a planet you haven't discovered");
  //     }

  //     if (planet.owner !== this.account) {
  //       throw new Error("you can't claim a planet you down't own");
  //     }

  //     if (planet.claimer === this.account) {
  //       throw new Error("you've already claimed this planet");
  //     }

  //     if (!isLocatable(planet)) {
  //       throw new Error(
  //         "you can't reveal a planet whose coordinates you don't know",
  //       );
  //     }

  //     if (planet.transactions?.hasTransaction(isUnconfirmedClaimTx)) {
  //       throw new Error("you're already claiming this planet's location");
  //     }

  //     if (planet.planetLevel < PLANET_CLAIM_MIN_LEVEL) {
  //       throw new Error(
  //         `you can't claim a planet whose level is less than ${PLANET_CLAIM_MIN_LEVEL}`,
  //       );
  //     }

  //     if (this.entityStore.transactions.hasTransaction(isUnconfirmedClaimTx)) {
  //       throw new Error("you're already broadcasting coordinates");
  //     }

  //     const myLastClaimTimestamp = this.players.get(
  //       this.account,
  //     )?.lastClaimTimestamp;
  //     if (
  //       myLastClaimTimestamp &&
  //       Date.now() < this.getNextClaimAvailableTimestamp()
  //     ) {
  //       throw new Error("still on cooldown for claiming");
  //     }

  //     // this is shitty. used for the popup window
  //     localStorage.setItem(
  //       `${this.ethConnection.getAddress()?.toLowerCase()}-claimLocationId`,
  //       planetId,
  //     );

  //     const getArgs = async () => {
  //       const revealArgs = await this.snarkHelper.getRevealArgs(
  //         planet.location.coords.x,
  //         planet.location.coords.y,
  //       );
  //       this.terminal.current?.println(
  //         "REVEAL: calculated SNARK with args:",
  //         TerminalTextStyle.Sub,
  //       );
  //       this.terminal.current?.println(
  //         JSON.stringify(hexifyBigIntNestedArray(revealArgs.slice(0, 3))),
  //         TerminalTextStyle.Sub,
  //       );
  //       this.terminal.current?.newline();

  //       return revealArgs;
  //     };

  //     const txIntent: UnconfirmedClaim = {
  //       methodName: "claimLocation",
  //       locationId: planetId,
  //       location: planet.location,
  //       contract: this.contractsAPI.contract,
  //       args: getArgs(),
  //     };

  //     // Always await the submitTransaction so we can catch rejections
  //     const tx = await this.contractsAPI.submitTransaction(txIntent);

  //     return tx;
  //   } catch (e) {
  //     this.getNotificationsManager().txInitError(
  //       "claimLocation",
  //       (e as Error).message,
  //     );
  //     throw e;
  //   }
  // }

  /**
   * burnLocation reveals a planet's location on-chain.
   */

  // public async burnLocation(
  //   planetId: LocationId,
  // ): Promise<Transaction<UnconfirmedBurn>> {
  //   try {
  //     if (!this.account) {
  //       throw new Error("no account set");
  //     }

  //     if (this.checkGameHasEnded()) {
  //       throw new Error("game has ended");
  //     }

  //     const planet = this.entityStore.getPlanetWithId(planetId);

  //     if (!planet) {
  //       throw new Error("you can't burn a planet you haven't discovered");
  //     }

  //     if (!isLocatable(planet)) {
  //       throw new Error(
  //         "you can't reveal a planet whose coordinates you don't know",
  //       );
  //     }

  //     if (planet.destroyed || planet.frozen) {
  //       throw new Error("you can't burn destroyed/frozen planets");
  //     }

  //     if (planet.planetLevel <= 2) {
  //       throw new Error("require planetLevel>=3");
  //     }

  //     if (planet.owner !== this.account) {
  //       throw new Error("you don't own this planet");
  //     }

  //     if (
  //       planet.burnOperator !== undefined &&
  //       planet.burnOperator !== EMPTY_ADDRESS
  //     ) {
  //       throw new Error("someone already burn this planet");
  //     }

  //     if (planet.transactions?.hasTransaction(isUnconfirmedBurnTx)) {
  //       throw new Error("you're already burning this planet's location");
  //     }

  //     if (this.entityStore.transactions.hasTransaction(isUnconfirmedBurnTx)) {
  //       throw new Error("you're already burning this planet's location");
  //     }

  //     const myLastBurnTimestamp = this.players.get(
  //       this.account,
  //     )?.lastBurnTimestamp;

  //     if (
  //       myLastBurnTimestamp &&
  //       Date.now() < this.getNextBurnAvailableTimestamp()
  //     ) {
  //       throw new Error("still on cooldown for burning");
  //     }

  //     const playerSilver = this.players.get(this.account)?.silver;
  //     if (
  //       playerSilver &&
  //       playerSilver <
  //         this.contractConstants.BURN_PLANET_REQUIRE_SILVER_AMOUNTS[
  //           planet.planetLevel
  //         ]
  //     ) {
  //       throw new Error("player silver is not enough");
  //     }

  //     const activeArtifact = this.getActiveArtifact(planet);
  //     if (
  //       !activeArtifact ||
  //       activeArtifact.artifactType !== ArtifactType.Bomb
  //     ) {
  //       throw new Error("no active bomb on this planet");
  //     }

  //     // this is shitty. used for the popup window
  //     localStorage.setItem(
  //       `${this.ethConnection.getAddress()?.toLowerCase()}-burnLocationId`,
  //       planetId,
  //     );

  //     const getArgs = async () => {
  //       const revealArgs = await this.snarkHelper.getRevealArgs(
  //         planet.location.coords.x,
  //         planet.location.coords.y,
  //       );
  //       this.terminal.current?.println(
  //         "REVEAL: calculated SNARK with args:",
  //         TerminalTextStyle.Sub,
  //       );
  //       this.terminal.current?.println(
  //         JSON.stringify(hexifyBigIntNestedArray(revealArgs.slice(0, 3))),
  //         TerminalTextStyle.Sub,
  //       );
  //       this.terminal.current?.newline();

  //       return revealArgs;
  //     };

  //     const txIntent: UnconfirmedBurn = {
  //       methodName: "burnLocation",
  //       locationId: planetId,
  //       location: planet.location,
  //       contract: this.contractsAPI.contract,
  //       args: getArgs(),
  //     };

  //     // Always await the submitTransaction so we can catch rejections
  //     const tx = await this.contractsAPI.submitTransaction(txIntent);

  //     return tx;
  //   } catch (e) {
  //     this.getNotificationsManager().txInitError(
  //       "burnLocation",
  //       (e as Error).message,
  //     );
  //     throw e;
  //   }
  // }
  public checkPlanetCanPink(planetId: LocationId): {
    canPink: boolean;
    artifactId?: ArtifactId;
  } {
    if (!this.account) {
      return { canPink: false };
    }
    const planet = this.getPlanetWithId(planetId);
    if (!planet) {
      return { canPink: false };
    }
    if (!isLocatable(planet)) {
      return { canPink: false };
    }
    const pinkZones = this.getPinkZones();
    const curTick = this.getCurrentTick();
    for (const pinkZone of pinkZones) {
      if (
        pinkZone.arrivalTick === 0 ||
        curTick < pinkZone.arrivalTick ||
        curTick >= pinkZone.arrivalTick + 300
      ) {
        continue;
      }
      const coords = pinkZone.coords;
      const radius = pinkZone.radius;

      const dis = this.getDistCoords(coords, planet.location.coords);

      if (dis <= radius) {
        return { canPink: true, artifactId: pinkZone.artifactId };
      }
    }
    return { canPink: false };
  }

  /**
   * return isCurrentlyPinking
   */
  // public isCurrentlyPinking(): boolean {
  //   return !!this.entityStore.transactions.hasTransaction(isUnconfirmedPinkTx);
  // }
  /**
   * pinkLocation reveals a planet's location on-chain.
   */

  public async pinkLocation(
    planetId: LocationId,
  ): Promise<Transaction<UnconfirmedPink>> {
    try {
      if (!this.account) {
        throw new Error("no account set");
      }

      // if (this.checkGameHasEnded()) {
      //   throw new Error("game has ended");
      // }

      const planet = this.entityStore.getPlanetWithId(planetId);

      if (!planet) {
        throw new Error("you can't pink a planet you haven't discovered");
      }

      if (!isLocatable(planet)) {
        throw new Error(
          "you can't pink a planet whose coordinates you don't know",
        );
      }

      if (planet.destroyed || planet.frozen) {
        throw new Error("you can't pink destroyed/frozen planets");
      }

      // if (planet.operator !== undefined && planet.operator !== EMPTY_ADDRESS) {
      //   throw new Error('someone already burn this planet');
      // }

      if (planet.transactions?.hasTransaction(isUnconfirmedPinkTx)) {
        throw new Error("you're already pinking this planet's location 1");
      }

      if (this.entityStore.transactions.hasTransaction(isUnconfirmedPinkTx)) {
        throw new Error("you're already pinking this planet's location 2");
      }

      // const myLastBurnTimestamp = this.players.get(this.account)?.lastBurnTimestamp;

      // if (myLastBurnTimestamp && Date.now() < this.getNextBurnAvailableTimestamp()) {
      //   throw new Error('still on cooldown for burning');
      // }
      const { canPink, artifactId } = this.checkPlanetCanPink(
        planet.locationId,
      );
      if (!canPink || !artifactId) {
        throw new Error("this planet don't in your pink zones");
      }

      // this is shitty. used for the popup window
      localStorage.setItem(
        `${this.getAccount()?.toLowerCase()}-pinkLocationId`,
        planetId,
      );

      const getArgs = async () => {
        const revealArgs = await this.snarkHelper.getRevealArgs(
          planet.location.coords.x,
          planet.location.coords.y,
        );
        this.terminal.current?.println(
          "REVEAL: calculated SNARK with args:",
          TerminalTextStyle.Sub,
        );
        this.terminal.current?.println(
          JSON.stringify(hexifyBigIntNestedArray(revealArgs.slice(0, 3))),
          TerminalTextStyle.Sub,
        );
        this.terminal.current?.newline();

        return this.transformRevealArgs(revealArgs);
      };

      const txIntent: UnconfirmedPink = {
        methodName: "destroy",
        locationId: planetId,
        location: planet.location,
        contract: this.contractsAPI.contract,
        args: Promise.resolve([
          artifactIdToDecStr(artifactId),
          ...(await getArgs()),
        ]),
        artifactId: artifactId,
        delegator: this.getAccount(),
      };

      // Always await the submitTransaction so we can catch rejections
      const tx = await this.contractsAPI.submitTransaction(txIntent);

      return tx;
    } catch (e) {
      this.getNotificationsManager().txInitError(
        "pinkLocation",
        (e as Error).message,
      );
      throw e;
    }
  }

  // public async kardashev(
  //   planetId: LocationId,
  // ): Promise<Transaction<UnconfirmedKardashev>> {
  //   try {
  //     if (!this.account) {
  //       throw new Error("no account set");
  //     }

  //     if (this.checkGameHasEnded()) {
  //       throw new Error("game has ended");
  //     }

  //     const planet = this.entityStore.getPlanetWithId(planetId);

  //     if (!planet) {
  //       throw new Error("you can't kardashev a planet you haven't discovered");
  //     }

  //     if (!isLocatable(planet)) {
  //       throw new Error(
  //         "you can't reveal a planet whose coordinates you don't know",
  //       );
  //     }

  //     if (planet.destroyed || planet.frozen) {
  //       throw new Error("you can't kardashev destroyed/frozen planets");
  //     }

  //     if (planet.planetLevel <= 2) {
  //       throw new Error("require planet level>=3");
  //     }

  //     if (
  //       planet.kardashevOperator !== undefined &&
  //       planet.kardashevOperator !== EMPTY_ADDRESS
  //     ) {
  //       throw new Error("someone already kardashev this planet");
  //     }

  //     if (planet.transactions?.hasTransaction(isUnconfirmedKardashevTx)) {
  //       throw new Error("you're already kardasheving this planet's location");
  //     }

  //     if (
  //       this.entityStore.transactions.hasTransaction(isUnconfirmedKardashevTx)
  //     ) {
  //       throw new Error("you're already kardasheving coordinates");
  //     }

  //     const myLastKardashevTimestamp = this.players.get(
  //       this.account,
  //     )?.lastKardashevTimestamp;

  //     if (
  //       myLastKardashevTimestamp &&
  //       Date.now() < this.getNextKardashevAvailableTimestamp()
  //     ) {
  //       throw new Error("still on cooldown for kardasheving");
  //     }

  //     const playerSilver = this.players.get(this.account)?.silver;
  //     if (
  //       playerSilver &&
  //       playerSilver <
  //         this.contractConstants.KARDASHEV_REQUIRE_SILVER_AMOUNTS[
  //           planet.planetLevel
  //         ]
  //     ) {
  //       throw new Error("player silver is not enough");
  //     }

  //     const activeArtifact = this.getActiveArtifact(planet);
  //     if (
  //       !activeArtifact ||
  //       activeArtifact.artifactType !== ArtifactType.Kardashev
  //     ) {
  //       throw new Error("no active kardashev on this planet");
  //     }

  //     if (
  //       Date.now() - 1000 * activeArtifact.lastActivated <=
  //       1000 * this.contractConstants.KARDASHEV_PLANET_COOLDOWN
  //     ) {
  //       throw new Error("still on cooldown for kardasheving");
  //     }

  //     // this is shitty. used for the popup window
  //     localStorage.setItem(
  //       `${this.ethConnection.getAddress()?.toLowerCase()}-kardashevLocationId`,
  //       planetId,
  //     );

  //     const getArgs = async () => {
  //       const revealArgs = await this.snarkHelper.getRevealArgs(
  //         planet.location.coords.x,
  //         planet.location.coords.y,
  //       );
  //       this.terminal.current?.println(
  //         "REVEAL: calculated SNARK with args:",
  //         TerminalTextStyle.Sub,
  //       );
  //       this.terminal.current?.println(
  //         JSON.stringify(hexifyBigIntNestedArray(revealArgs.slice(0, 3))),
  //         TerminalTextStyle.Sub,
  //       );
  //       this.terminal.current?.newline();

  //       return revealArgs;
  //     };

  //     const txIntent: UnconfirmedKardashev = {
  //       methodName: "kardashev",
  //       locationId: planetId,
  //       location: planet.location,
  //       contract: this.contractsAPI.contract,
  //       args: getArgs(),
  //     };

  //     // Always await the submitTransaction so we can catch rejections
  //     const tx = await this.contractsAPI.submitTransaction(txIntent);

  //     return tx;
  //   } catch (e) {
  //     this.getNotificationsManager().txInitError(
  //       "kardashev",
  //       (e as Error).message,
  //     );
  //     throw e;
  //   }
  // }

  // public checkPlanetCanBlue(planetId: LocationId): boolean {
  //   if (!this.account) {
  //     return false;
  //   }
  //   const planet = this.getPlanetWithId(planetId);
  //   if (!planet) {
  //     return false;
  //   }
  //   if (!isLocatable(planet)) {
  //     return false;
  //   }
  //   const centerPlanetId = this.getBlueZoneCenterPlanetId(planetId);

  //   if (!centerPlanetId) {
  //     return false;
  //   }
  //   if (centerPlanetId === planetId) {
  //     return false;
  //   }
  //   return true;
  // }

  /**
   * return isCurrentlyBlueing
   */
  // public isCurrentlyBlueing(): boolean {
  //   return !!this.entityStore.transactions.hasTransaction(isUnconfirmedBlueTx);
  // }

  /**
   * blueLocation reveals a planet's location on-chain.
   */

  // public async blueLocation(
  //   planetId: LocationId,
  // ): Promise<Transaction<UnconfirmedBlue>> {
  //   try {
  //     if (!this.account) {
  //       throw new Error("no account set");
  //     }

  //     if (this.checkGameHasEnded()) {
  //       throw new Error("game has ended");
  //     }

  //     const planet = this.entityStore.getPlanetWithId(planetId);

  //     if (!planet) {
  //       throw new Error("you can't blue a planet you haven't discovered");
  //     }

  //     if (!isLocatable(planet)) {
  //       throw new Error(
  //         "you can't blue a planet whose coordinates you don't know",
  //       );
  //     }

  //     if (planet.destroyed || planet.frozen) {
  //       throw new Error("you can't blue destroyed/frozen planets");
  //     }

  //     if (planet.planetLevel < 3) {
  //       throw new Error("planet level requires >= 3");
  //     }

  //     const centerPlanetId = this.getBlueZoneCenterPlanetId(planetId);
  //     if (centerPlanetId === undefined) {
  //       throw new Error("this planet is not in your blue zones");
  //     }

  //     const centerPlanet = this.getPlanetWithId(centerPlanetId);

  //     if (
  //       centerPlanet === undefined ||
  //       centerPlanet.kardashevTimestamp === undefined
  //     ) {
  //       throw new Error("can't blue this planet");
  //     }

  //     if (centerPlanetId === planetId) {
  //       throw new Error("can't blue center planet");
  //     }

  //     const timeCheckPassed =
  //       this.getNextBlueAvailableTimestamp(planetId) <= Date.now();

  //     if (!timeCheckPassed) {
  //       throw new Error("still in cooldown time");
  //     }

  //     if (
  //       centerPlanet.owner !== planet.owner ||
  //       centerPlanet.owner !== this.account
  //     ) {
  //       throw new Error("center planet need to be yours");
  //     }

  //     if (planet.transactions?.hasTransaction(isUnconfirmedBlueTx)) {
  //       throw new Error("you're already blueing this planet's location 1");
  //     }

  //     if (this.entityStore.transactions.hasTransaction(isUnconfirmedBlueTx)) {
  //       throw new Error("you're already blueing this planet's location 2");
  //     }

  //     // this is shitty. used for the popup window
  //     localStorage.setItem(
  //       `${this.ethConnection.getAddress()?.toLowerCase()}-blueLocationId`,
  //       planetId,
  //     );

  //     const getArgs = async () => {
  //       const revealArgs = await this.snarkHelper.getRevealArgs(
  //         planet.location.coords.x,
  //         planet.location.coords.y,
  //       );
  //       this.terminal.current?.println(
  //         "REVEAL: calculated SNARK with args:",
  //         TerminalTextStyle.Sub,
  //       );
  //       this.terminal.current?.println(
  //         JSON.stringify(hexifyBigIntNestedArray(revealArgs.slice(0, 3))),
  //         TerminalTextStyle.Sub,
  //       );
  //       this.terminal.current?.newline();

  //       return revealArgs;
  //     };

  //     const txIntent: UnconfirmedBlue = {
  //       methodName: "blueLocation",
  //       locationId: planetId,
  //       location: planet.location,
  //       contract: this.contractsAPI.contract,
  //       args: getArgs(),
  //     };

  //     // Always await the submitTransaction so we can catch rejections
  //     const tx = await this.contractsAPI.submitTransaction(txIntent);

  //     return tx;
  //   } catch (e) {
  //     this.getNotificationsManager().txInitError(
  //       "blueLocation",
  //       (e as Error).message,
  //     );
  //     throw e;
  //   }
  // }

  // public async invadePlanet(locationId: LocationId) {
  //   try {
  //     if (!this.captureZoneGenerator) {
  //       throw new Error("Capture zones are not enabled in this game");
  //     }

  //     const planet = this.entityStore.getPlanetWithId(locationId);

  //     if (!planet || !isLocatable(planet)) {
  //       throw new Error("you can't invade a planet you haven't discovered");
  //     }

  //     if (planet.destroyed || planet.frozen) {
  //       throw new Error("you can't invade destroyed/frozen planets");
  //     }

  //     if (planet.invader !== EMPTY_ADDRESS) {
  //       throw new Error(
  //         "you can't invade planets that have already been invaded",
  //       );
  //     }

  //     if (planet.owner !== this.account) {
  //       throw new Error("you can only invade planets you own");
  //     }

  //     if (!this.captureZoneGenerator.isInZone(planet.locationId)) {
  //       throw new Error(
  //         "you can't invade planets that are not in a capture zone",
  //       );
  //     }

  //     localStorage.setItem(
  //       `${this.ethConnection.getAddress()?.toLowerCase()}-invadePlanet`,
  //       locationId,
  //     );

  //     const getArgs = async () => {
  //       const revealArgs = await this.snarkHelper.getRevealArgs(
  //         planet.location.coords.x,
  //         planet.location.coords.y,
  //       );

  //       this.terminal.current?.println(
  //         "REVEAL: calculated SNARK with args:",
  //         TerminalTextStyle.Sub,
  //       );
  //       this.terminal.current?.println(
  //         JSON.stringify(hexifyBigIntNestedArray(revealArgs.slice(0, 3))),
  //         TerminalTextStyle.Sub,
  //       );
  //       this.terminal.current?.newline();

  //       return revealArgs;
  //     };

  //     const txIntent: UnconfirmedInvadePlanet = {
  //       methodName: "invadePlanet",
  //       contract: this.contractsAPI.contract,
  //       locationId,
  //       args: getArgs(),
  //     };

  //     const tx = await this.contractsAPI.submitTransaction(txIntent);
  //     return tx;
  //   } catch (e) {
  //     this.getNotificationsManager().txInitError(
  //       "invadePlanet",
  //       (e as Error).message,
  //     );
  //     throw e;
  //   }
  // }

  // public async capturePlanet(locationId: LocationId) {
  //   try {
  //     const planet = this.entityStore.getPlanetWithId(locationId);

  //     if (!planet) {
  //       throw new Error("planet is not loaded");
  //     }

  //     if (planet.destroyed || planet.frozen) {
  //       throw new Error("you can't capture destroyed/frozen planets");
  //     }

  //     if (planet.capturer !== EMPTY_ADDRESS) {
  //       throw new Error(
  //         "you can't capture planets that have already been captured",
  //       );
  //     }

  //     if (planet.owner !== this.account) {
  //       throw new Error("you can only capture planets you own");
  //     }

  //     if (planet.energy < planet.energyCap * 0.8) {
  //       throw new Error("the planet needs >80% energy before capturing");
  //     }

  //     if (
  //       !planet.invadeStartBlock ||
  //       this.ethConnection.getCurrentBlockNumber() <
  //         planet.invadeStartBlock +
  //           this.contractConstants.CAPTURE_ZONE_HOLD_BLOCKS_REQUIRED
  //     ) {
  //       throw new Error(
  //         `you need to hold a planet for ${this.contractConstants.CAPTURE_ZONE_HOLD_BLOCKS_REQUIRED} blocks before capturing`,
  //       );
  //     }

  //     localStorage.setItem(
  //       `${this.ethConnection.getAddress()?.toLowerCase()}-capturePlanet`,
  //       locationId,
  //     );

  //     const txIntent: UnconfirmedCapturePlanet = {
  //       methodName: "capturePlanet",
  //       contract: this.contractsAPI.contract,
  //       locationId,
  //       args: Promise.resolve([locationIdToDecStr(locationId)]),
  //     };

  //     const tx = await this.contractsAPI.submitTransaction(txIntent);
  //     return tx;
  //   } catch (e) {
  //     this.getNotificationsManager().txInitError(
  //       "capturePlanet",
  //       (e as Error).message,
  //     );
  //     throw e;
  //   }
  // }

  /**
   * Attempts to join the game. Should not be called once you've already joined.
   */
  public async joinGame(
    beforeRetry: (e: Error) => Promise<boolean>,
    _selectedCoords: { x: number; y: number },
    spectate: boolean,
  ): Promise<void> {
    if (spectate) {
      this.initMiningManager({ x: 0, y: 0 });
      this.emit(GameManagerEvent.InitializedPlayer);
    }

    try {
      // if (this.checkGameHasEnded()) {
      //   throw new Error('game has ended');
      // }

      const planet = await this.findRandomHomePlanet(_selectedCoords);

      console.log(
        "home coords:",
        planet.location.coords.x,
        planet.location.coords.y,
      );

      this.homeLocation = planet.location;
      this.terminal.current?.println("");
      this.terminal.current?.println(
        `Found Suitable Home Planet: ${getPlanetName(planet)}, coordinates: (${
          planet.location.coords.x
        }, ${planet.location.coords.y})`,
        TerminalTextStyle.Pink,
      );
      this.terminal.current?.newline();

      await this.persistentChunkStore.addHomeLocation(planet.location);

      let txIntentCompleted = false;
      const getArgs = async () => {
        const args = await this.snarkHelper.getInitArgs(
          planet.location.coords.x,
          planet.location.coords.y,
          Math.floor(
            Math.sqrt(
              planet.location.coords.x ** 2 + planet.location.coords.y ** 2,
            ),
          ) + 1,
        );

        this.terminal.current?.println(
          "INIT: calculated SNARK with args:",
          TerminalTextStyle.Sub,
        );
        this.terminal.current?.println(
          JSON.stringify(
            hexifyBigIntNestedArray(args.slice(0, 3) as unknown as string[]),
          ),
          TerminalTextStyle.Text,
        );
        this.terminal.current?.newline();

        txIntentCompleted = true;

        return args;
        // return [...args, distFromOriginSquare];
      };

      const delegator = this.getAccount();
      if (!delegator) {
        throw Error("no main account");
      }

      const txIntent: UnconfirmedInit = {
        methodName: "df__initializePlayer",
        contract: this.contractsAPI.contract,
        locationId: planet.location.hash,
        location: planet.location,
        args: getArgs(),
        delegator: delegator,
      };

      this.terminal.current?.println(
        "INIT: proving that planet exists",
        TerminalTextStyle.Sub,
      );

      this.initMiningManager(planet.location.coords); // get an early start

      // if player initialization causes an error, give the caller an opportunity
      // to resolve that error. if the asynchronous `beforeRetry` function returns
      // true, retry initializing the player. if it returns false, or if the
      // `beforeRetry` is undefined, then don't retry and throw an exception.

      while (true) {
        try {
          const entryFee = 0; //await this.contractsAPI.getEntryFee();
          // console.log("entry fee: ", entryFee.toString());
          localStorage.setItem(
            `${this.ethConnection.getAddress()?.toLowerCase()}-entryFee`,
            entryFee.toString(),
          );

          const tx = await this.contractsAPI.submitTransaction(txIntent, {
            value: entryFee.toString(),
          });
          await tx.confirmedPromise;
          break;
        } catch (e) {
          if (beforeRetry) {
            // make sure the tx intent has completed so all the message are printed together.
            while (!txIntentCompleted) {
              await sleep(100);
            }

            if (await beforeRetry(e as Error)) {
              continue;
            }
          } else {
            throw e;
          }
        }
      }

      // await this.getSpaceships();
      await this.hardRefreshPlanet(planet.locationId);

      alert("download coords & game account private key");

      // Auto download private key and home planet coordinates
      const gameAccount = this.ethConnection.getAddress();

      const privateKey = this.ethConnection.getPrivateKey();
      const homePlanetCoords = this.homeLocation?.coords;

      const txtContent = `Game Address:${gameAccount}\nPrivate Key: ${privateKey}\nHome Planet Coordinates: (${homePlanetCoords.x}, ${homePlanetCoords.y})`;
      const element = document.createElement("a");
      element.setAttribute(
        "href",
        "data:text/plain;charset=utf-8," + encodeURIComponent(txtContent),
      );
      element.setAttribute(
        "download",
        this.getMainAccount() + "privateKeyAndHomePlanetCoords.txt",
      );
      element.style.display = "none";
      document.body.appendChild(element);
      element.click();
      document.body.removeChild(element);

      this.emit(GameManagerEvent.InitializedPlayer);
    } catch (e) {
      this.getNotificationsManager().txInitError(
        "df__initializePlayer",
        (e as Error).message,
      );
      throw e;
    }
  }
  // mytodo: some player can't get spaceships, the homeLocation.hash is not right
  // private async getSpaceships() {
  //   if (!this.account) {
  //     return;
  //   }
  //   if (
  //     !Object.values(this.contractConstants.SPACESHIPS).some((a) => a === true)
  //   ) {
  //     console.log("all spaceships disabled, not calling the tx");
  //     return;
  //   }

  //   const player = await this.contractsAPI.getPlayerById(this.account);
  //   if (!player) {
  //     return;
  //   }
  //   if (player?.claimedShips) {
  //     return;
  //   }

  //   if (this.getGameObjects().isGettingSpaceships()) {
  //     return;
  //   }

  //   const homePlanetLocationId = "0x" + player.homePlanetId;

  //   console.log("fix: getSpaceships");
  //   console.log("  homeLocation.hash :", "0x" + this.homeLocation?.hash);
  //   console.log("player.homePlanetId :", homePlanetLocationId);

  //   const tx = await this.contractsAPI.submitTransaction({
  //     methodName: "giveSpaceShips",
  //     contract: this.contractsAPI.contract,
  //     args: Promise.resolve([homePlanetLocationId]),
  //   });
  //   await tx.confirmedPromise;
  //   this.hardRefreshPlanet(player.homePlanetId);
  // }

  // private async getSpaceships() {
  //   if (!this.account || !this.homeLocation?.hash) return;
  //   if (!Object.values(this.contractConstants.SPACESHIPS).some((a) => a === true)) {
  //     console.log('all spaceships disabled, not calling the tx');
  //     return;
  //   }

  //   const player = await this.contractsAPI.getPlayerById(this.account);
  //   if (player?.claimedShips) return;

  //   if (this.getGameObjects().isGettingSpaceships()) return;

  //   console.log('function: getSpaceships');
  //   console.log('0x' + this.homeLocation?.hash);

  //   const tx = await this.contractsAPI.submitTransaction({
  //     methodName: 'giveSpaceShips',
  //     contract: this.contractsAPI.contract,
  //     args: Promise.resolve(['0x' + this.homeLocation?.hash]),
  //   });
  //   await tx.confirmedPromise;
  //   this.hardRefreshPlanet(this.homeLocation?.hash);
  // }

  // this is slow, do not call in i.e. render/draw loop
  /**
   *
   * computes the WorldLocation object corresponding to a set of coordinates
   * very slow since it actually calculates the hash; do not use in render loop
   */

  private locationFromCoords(coords: WorldCoords): WorldLocation {
    return {
      coords,
      hash: locationIdFromBigInt(this.planetHashMimc(coords.x, coords.y)),
      perlin: this.spaceTypePerlin(coords, true),
      biomebase: this.biomebasePerlin(coords, true),
    };
  }

  /**
   * Initializes a new player's game to start at the given home planet. Must have already
   * initialized the player on the contract.
   */
  async addAccount(coords: WorldCoords): Promise<boolean> {
    const loc: WorldLocation = this.locationFromCoords(coords);
    await this.persistentChunkStore.addHomeLocation(loc);
    this.initMiningManager(coords);
    this.homeLocation = loc;
    return true;
  }

  private async findRandomHomePlanet(_selectedCoords: {
    x: number;
    y: number;
  }): Promise<LocatablePlanet> {
    this.terminal.current?.newline();
    this.terminal.current?.println(`Initializing Home Planet Search...`);
    this.terminal.current?.println(
      "This may take up to 120s, and will consume a lot of CPU.",
    );

    // let other things happen in the bg.
    await sleep(10);

    return new Promise<LocatablePlanet>((resolve, reject) => {
      const initPerlinMin = this.contractConstants.INIT_PERLIN_MIN;
      const initPerlinMax = this.contractConstants.INIT_PERLIN_MAX;
      let minedChunksCount = 0;

      const x: number = _selectedCoords.x;
      const y: number = _selectedCoords.y;
      const d: number = Math.sqrt(x ** 2 + y ** 2);
      // const p: number = this.spaceTypePerlin({ x, y }, false);

      // if this.contractConstants.SPAWN_RIM_AREA is non-zero, then players must spawn in that
      // area, distributed evenly in the inner perimeter of the world
      // let spawnInnerRadius = Math.sqrt(
      //   Math.max(Math.PI * this.worldRadius ** 2 - this.contractConstants.SPAWN_RIM_AREA, 0) /
      //     Math.PI
      // );

      // if (this.contractConstants.SPAWN_RIM_AREA === 0) {
      //   spawnInnerRadius = 0;
      // }

      const requireRadiusMin = this.contractConstants.MAX_LEVEL_DIST[1];
      // const requireRadiusMax = this.contractConstants.MAX_LEVEL_DIST[0];
      const checkCoords = () => {
        console.log(d);
        console.log("[" + requireRadiusMin + ",+)");
        return d >= requireRadiusMin;
      };

      //NOTE: check coords
      console.log(checkCoords());

      // do {
      //   // sample from square
      //   x = Math.random() * this.worldRadius * 2 - this.worldRadius;
      //   y = Math.random() * this.worldRadius * 2 - this.worldRadius;
      //   d = Math.sqrt(x ** 2 + y ** 2);
      //   p = this.spaceTypePerlin({ x, y }, false);
      // } while (
      //   p >= initPerlinMax || // keep searching if above or equal to the max
      //   p < initPerlinMin || // keep searching if below the minimum
      //   d >= this.worldRadius || // can't be out of bound
      //   d <= spawnInnerRadius // can't be inside spawn area ring
      // );

      // when setting up a new account in development mode, you can tell
      // the game where to start searching for planets using this query
      // string parameter. for example:
      //
      // ?searchCenter=2866,5627
      //

      const pattern: MiningPattern = new SpiralPattern(
        { x, y },
        MIN_CHUNK_SIZE,
      );

      const chunkStore = new HomePlanetMinerChunkStore(
        initPerlinMin,
        initPerlinMax,
        this.hashConfig,
      );
      const homePlanetFinder = MinerManager.create(
        chunkStore,
        pattern,
        this.worldRadius,
        this.getInnerRadius(),
        this.planetRarity,
        this.hashConfig,
        this.useMockHash,
      );

      this.terminal.current?.println(``);
      this.terminal.current?.println(`Chunked explorer: start!`);
      this.terminal.current?.println(
        `Each chunk contains ${MIN_CHUNK_SIZE}x${MIN_CHUNK_SIZE} coordinates.`,
      );
      const percentSpawn = (1 / this.contractConstants.PLANET_RARITY) * 100;
      const printProgress = 4;
      this.terminal.current?.print(`Each coordinate has a`);
      this.terminal.current?.print(` ${percentSpawn}%`, TerminalTextStyle.Text);
      this.terminal.current?.print(` chance of spawning a planet.`);
      this.terminal.current?.println("");

      this.terminal.current?.newline();
      this.terminal.current?.println(
        "It may take a long time to wait here. You can choose to wait for a while or refresh the web page.",
        TerminalTextStyle.Pink,
      );
      this.terminal.current?.newline();

      this.terminal.current?.println(
        `Hashing first ${MIN_CHUNK_SIZE ** 2 * printProgress} potential home planets...`,
      );

      let done = false;
      let index = 1;
      const values = [".", "..", "...", "....", ".....", "......"];
      let lastChunkSize: number | undefined;
      let chunkSize: number | undefined;
      const printProgressFn = () => {
        if (done) {
          return;
        }

        if (chunkSize) {
          if (lastChunkSize) {
            this.terminal.current?.removeLast(2);
          }
          if (lastChunkSize && lastChunkSize !== chunkSize) {
            this.terminal.current?.println(
              `Hashed ${lastChunkSize * MIN_CHUNK_SIZE ** 2} potential home planets${
                values[index - 1]
              }`,
            );
            index = 1;
          }

          this.terminal.current?.println(
            `Hashed ${chunkSize * MIN_CHUNK_SIZE ** 2} potential home planets${values[index - 1]}`,
          );
          index = (index % 6) + 1;
          lastChunkSize = chunkSize;
        }
        setTimeout(printProgressFn, 180);
      };
      printProgressFn();

      homePlanetFinder.on(
        MinerManagerEvent.DiscoveredNewChunk,
        (chunk: Chunk) => {
          chunkStore.addChunk(chunk);
          minedChunksCount++;

          if (minedChunksCount % printProgress === 0) {
            chunkSize = minedChunksCount;
          }
          for (const homePlanetLocation of chunk.planetLocations) {
            const planetPerlin = homePlanetLocation.perlin;
            const planetX = homePlanetLocation.coords.x;
            const planetY = homePlanetLocation.coords.y;
            const distFromOrigin = Math.sqrt(planetX ** 2 + planetY ** 2);

            //###############
            //  NEW MAP ALGO
            //###############
            const planetLevel = this.entityStore.planetLevelFromHexPerlin(
              homePlanetLocation.hash,
              homePlanetLocation.perlin,
              distFromOrigin,
            );
            const planetType = this.entityStore.planetTypeFromHexPerlin(
              homePlanetLocation.hash,
              homePlanetLocation.perlin,
              distFromOrigin,
            );

            const spaceType = this.spaceTypeFromPerlin(
              planetPerlin,
              Math.floor(distFromOrigin),
            );

            const planet = this.getPlanetWithId(homePlanetLocation.hash);
            console.log("possible home planet");
            console.log(planet);

            if (
              spaceType === SpaceType.NEBULA && //only NEBULA
              planetPerlin < initPerlinMax &&
              planetPerlin >= initPerlinMin &&
              distFromOrigin < this.worldRadius &&
              distFromOrigin >= this.getInnerRadius() &&
              // distFromOrigin >= spawnInnerRadius &&
              distFromOrigin >= requireRadiusMin &&
              // distFromOrigin < requireRadiusMax &&
              planetLevel === MIN_PLANET_LEVEL &&
              planetType === PlanetType.PLANET &&
              (!planet || !planet.isInContract) // init will fail if planet has been initialized in contract already
            ) {
              // valid home planet
              homePlanetFinder.stopExplore();
              homePlanetFinder.destroy();

              const homePlanet =
                this.getGameObjects().getPlanetWithLocation(homePlanetLocation);

              if (!homePlanet) {
                reject(
                  new Error(
                    "Unable to create default planet for your home planet's location.",
                  ),
                );
              } else {
                // tell the printProgressFn to stop
                done = true;
                // can cast to `LocatablePlanet` because we know its location, as we just mined it.
                resolve(homePlanet as LocatablePlanet);
              }

              break;
            }
          }
        },
      );
      homePlanetFinder.startExplore();
    });
  }

  public async prospectPlanet(
    planetId: LocationId,
    bypassChecks = false,
  ): Promise<Transaction<UnconfirmedProspectPlanet>> {
    const planet = this.entityStore.getPlanetWithId(planetId);

    try {
      if (!planet || !isLocatable(planet)) {
        throw new Error("you can't prospect a planet you haven't discovered");
      }

      if (!bypassChecks) {
        // if (this.checkGameHasEnded()) {
        //   throw new Error("game ended");
        // }

        if (!planet) {
          throw new Error("you can't prospect a planet you haven't discovered");
        }

        if (!isLocatable(planet)) {
          throw new Error("you don't know this planet's location");
        }

        if (
          planet.prospectedBlockNumber !== undefined &&
          !prospectExpired(
            this.ethConnection.getCurrentBlockNumber(),
            planet.prospectedBlockNumber,
          )
        ) {
          throw new Error("someone already prospected this planet");
        }

        if (
          planet.transactions?.hasTransaction(isUnconfirmedProspectPlanetTx)
        ) {
          throw new Error("you're already looking bro...");
        }

        if (planet.planetType !== PlanetType.RUINS) {
          throw new Error("this planet doesn't have an artifact on it.");
        }
      }

      localStorage.setItem(
        `${this.ethConnection.getAddress()?.toLowerCase()}-prospectPlanet`,
        planetId,
      );

      const delegator = planet.owner;
      const myAccount = this.getAccount();

      if (!delegator || !myAccount) {
        throw Error("account error");
      }

      if (
        delegator !== myAccount &&
        !this.checkDelegateCondition(delegator, myAccount)
      ) {
        throw new Error("delegation error");
      }

      const txIntent: UnconfirmedProspectPlanet = {
        methodName: "df__prospectPlanet",
        contract: this.contractsAPI.contract,
        planetId: planetId,
        args: Promise.resolve([locationIdToDecStr(planetId)]),
        delegator: delegator,
      };

      const transactionFee = this.getTransactionFee();

      const tx = await this.contractsAPI.submitTransaction(txIntent, {
        value: transactionFee,
      });

      tx.confirmedPromise.then(() =>
        NotificationManager.getInstance().artifactProspected(
          planet as LocatablePlanet,
        ),
      );

      return tx;
    } catch (e) {
      this.getNotificationsManager().txInitError(
        "df__prospectPlanet",
        (e as Error).message,
      );
      throw e;
    }
  }

  /**
   * Calls the contract to find an artifact on the given planet.
   */
  public async findArtifact(
    planetId: LocationId,
    bypassChecks = false,
  ): Promise<Transaction<UnconfirmedFindArtifact>> {
    const planet = this.entityStore.getPlanetWithId(planetId);

    try {
      if (!planet) {
        throw new Error(
          "you can't find artifacts on a planet you haven't discovered",
        );
      }

      if (!isLocatable(planet)) {
        throw new Error("you don't know the biome of this planet");
      }

      if (!bypassChecks) {
        // if (this.checkGameHasEnded()) {
        //   throw new Error("game has ended");
        // }

        if (planet.hasTriedFindingArtifact) {
          throw new Error(
            "someone already tried finding an artifact on this planet",
          );
        }

        if (planet.transactions?.hasTransaction(isUnconfirmedFindArtifactTx)) {
          throw new Error("you're already looking bro...");
        }

        if (planet.planetType !== PlanetType.RUINS) {
          throw new Error("this planet doesn't have an artifact on it.");
        }
      }

      // this is shitty. used for the popup window
      localStorage.setItem(
        `${this.ethConnection.getAddress()?.toLowerCase()}-findArtifactOnPlanet`,
        planetId,
      );

      const delegator = planet.owner;
      const myAccount = this.getAccount();

      if (!delegator || !myAccount) {
        throw Error("account error");
      }

      if (
        delegator !== myAccount &&
        !this.checkDelegateCondition(delegator, myAccount)
      ) {
        throw new Error("delegation error");
      }

      const txIntent: UnconfirmedFindArtifact = {
        methodName: "df__findArtifact",
        contract: this.contractsAPI.contract,
        planetId: planet.locationId,
        args: this.snarkHelper.getFindArtifactArgs(
          planet.location.coords.x,
          planet.location.coords.y,
        ),
        delegator: delegator,
      };

      const transactionFee = this.getTransactionFee();

      const tx =
        await this.contractsAPI.submitTransaction<UnconfirmedFindArtifact>(
          txIntent,
          {
            value: transactionFee,
          },
        );

      tx.confirmedPromise
        .then(() => {
          return this.waitForPlanet<Artifact>(
            planet.locationId,
            ({ current }: Diff<Planet>) => {
              return current.heldArtifactIds
                .map(this.getArtifactWithId.bind(this))
                .find(
                  (a: Artifact | undefined) =>
                    a?.planetDiscoveredOn === planet.locationId,
                ) as Artifact;
            },
          ).then((foundArtifact) => {
            if (!foundArtifact) {
              throw new Error("Artifact not found?");
            }
            const notifManager = NotificationManager.getInstance();

            notifManager.artifactFound(
              planet as LocatablePlanet,
              foundArtifact,
            );
          });
        })
        .catch(console.log);

      return tx;
    } catch (e) {
      this.getNotificationsManager().txInitError(
        "df__findArtifact",
        (e as Error).message,
      );
      throw e;
    }
  }

  getContractConstants(): ContractConstants {
    return this.contractConstants;
  }

  public getArtifactWithdrawalDisabled(): boolean {
    const { ArtifactWithdrawal } = this.components;
    const value = getComponentValue(ArtifactWithdrawal, singletonEntity);
    return value?.disabled ?? false;
  }

  /**
   * Submits a transaction to the blockchain to deposit an artifact on a given planet.
   * You must own the planet and you must own the artifact directly (can't be locked in contract)
   */
  public async depositArtifact(
    locationId: LocationId,
    artifactId: ArtifactId,
  ): Promise<Transaction<UnconfirmedDepositArtifact>> {
    try {
      localStorage.setItem(
        `${this.ethConnection.getAddress()?.toLowerCase()}-depositPlanet`,
        locationId,
      );
      localStorage.setItem(
        `${this.ethConnection.getAddress()?.toLowerCase()}-depositArtifact`,
        artifactId,
      );

      // if (this.checkGameHasEnded()) {
      //   const error = new Error('game has ended');
      //   this.getNotificationsManager().txInitError('depositArtifact', error.message);
      //   throw error;
      // }

      const planet = this.entityStore.getPlanetWithId(locationId);
      if (!planet) {
        throw new Error("tried to deposit on unknown planet");
      }
      if (planet.planetType !== PlanetType.TRADING_POST) {
        throw new Error("tried to deposit on a non-trading post planet");
      }
      const delegator = planet.owner;
      const myAccount = this.getAccount();

      if (!delegator || !myAccount) {
        throw Error("account error");
      }

      if (
        delegator !== myAccount &&
        !this.checkDelegateCondition(delegator, myAccount)
      ) {
        throw new Error("delegation error");
      }

      const txIntent: UnconfirmedDepositArtifact = {
        methodName: "depositArtifact",
        contract: this.contractsAPI.contract,
        locationId,
        artifactId,
        args: Promise.resolve([
          locationIdToDecStr(locationId),
          artifactIdToDecStr(artifactId),
        ]),
        delegator,
      };

      const tx = await this.contractsAPI.submitTransaction(txIntent);

      tx.confirmedPromise.then(() =>
        this.getGameObjects().updateArtifact(
          artifactId,
          (a) => (a.onPlanetId = locationId),
        ),
      );

      return tx;
    } catch (e) {
      this.getNotificationsManager().txInitError(
        "depositArtifact",
        (e as Error).message,
      );
      throw e;
    }
  }

  /**
   * Withdraws the artifact that is locked up on the given planet.
   */
  public async withdrawArtifact(
    locationId: LocationId,
    artifactId: ArtifactId,
  ): Promise<Transaction<UnconfirmedWithdrawArtifact>> {
    console.log("withdrawArtifact", locationId, artifactId);
    const planet = this.entityStore.getPlanetWithId(locationId);
    try {
      if (!planet) {
        throw new Error("tried to withdraw from unknown planet");
      }
      if (!artifactId) {
        throw new Error("must supply an artifact id");
      }
      if (planet.planetType !== PlanetType.TRADING_POST) {
        throw new Error("tried to withdraw from a non-trading post planet");
      }

      // this is shitty. used for the popup window
      localStorage.setItem(
        `${this.ethConnection.getAddress()?.toLowerCase()}-withdrawPlanet`,
        locationId,
      );
      localStorage.setItem(
        `${this.ethConnection.getAddress()?.toLowerCase()}-withdrawArtifact`,
        artifactId,
      );

      const delegator = planet.owner;
      const myAccount = this.getAccount();

      if (!delegator || !myAccount) {
        throw Error("account error");
      }

      if (
        delegator !== myAccount &&
        !this.checkDelegateCondition(delegator, myAccount)
      ) {
        throw new Error("delegation error");
      }

      const txIntent: UnconfirmedWithdrawArtifact = {
        methodName: "withdrawArtifact",
        contract: this.contractsAPI.contract,
        args: Promise.resolve([
          locationIdToDecStr(locationId),
          artifactIdToDecStr(artifactId),
        ]),
        locationId,
        artifactId,
        delegator,
      };

      this.terminal.current?.println(
        "WITHDRAW_ARTIFACT: sending withdrawal to blockchain",
        TerminalTextStyle.Sub,
      );
      this.terminal.current?.newline();

      const tx = await this.contractsAPI.submitTransaction(txIntent);

      tx.confirmedPromise.then(() =>
        this.getGameObjects().updateArtifact(
          artifactId,
          (a) => (a.onPlanetId = undefined),
        ),
      );

      return tx;
    } catch (e) {
      this.getNotificationsManager().txInitError(
        "withdrawArtifact",
        (e as Error).message,
      );
      throw e;
    }
  }

  public async chargeArtifact(
    locationId: LocationId,
    artifactId: ArtifactId,
    data: Hex,
  ): Promise<Transaction<UnconfirmedChargeArtifact>> {
    try {
      localStorage.setItem(
        `${this.getAccount()?.toLowerCase()}-chargeArtifact`,
        artifactId,
      );
      const artifact = this.getArtifactWithId(artifactId);
      if (!artifact) {
        throw new Error("artifact not found");
      }
      const getArgs = async () => {
        if (artifact.artifactType !== ArtifactType.Bomb) {
          return "";
        }
        const targetPlanet = this.entityStore.getPlanetWithId(
          locationIdFromHexStr(data),
        );
        if (!targetPlanet) {
          throw new Error("target planet not found");
        }
        if (!isLocatable(targetPlanet)) {
          throw new Error("target planet not locatable");
        }
        const revealArgs = await this.snarkHelper.getRevealArgs(
          targetPlanet.location.coords.x,
          targetPlanet.location.coords.y,
        );

        this.terminal.current?.println(
          "REVEAL: calculated SNARK with args:",
          TerminalTextStyle.Sub,
        );
        this.terminal.current?.println(
          JSON.stringify(hexifyBigIntNestedArray(revealArgs.slice(0, 3))),
          TerminalTextStyle.Sub,
        );
        this.terminal.current?.newline();

        const encoded = encodeFunctionData({
          abi: PlanetRevealSystemAbi,
          functionName: "revealLocation",
          args: this.transformRevealArgs(revealArgs),
        });
        return `0x${encoded.slice(10)}` as Hex;
      };

      const planet = this.getPlanetWithId(locationId);

      if (!planet) {
        throw Error("no planet");
      }

      const delegator = planet.owner;
      const myAccount = this.getAccount();

      if (!delegator || !myAccount) {
        throw Error("account error");
      }

      if (
        delegator !== myAccount &&
        !this.checkDelegateCondition(delegator, myAccount)
      ) {
        throw new Error("delegation error");
      }

      const txIntent: UnconfirmedChargeArtifact = {
        methodName: "df__chargeArtifact",
        contract: this.contractsAPI.contract,
        args: Promise.resolve([
          locationIdToDecStr(locationId),
          artifactIdToDecStr(artifactId),
          await getArgs(),
        ]),
        delegator: delegator,
        locationId,
        artifactId,
      };

      const transactionFee = this.getTransactionFee();

      return this.contractsAPI.submitTransaction(txIntent, {
        value: transactionFee,
      });
    } catch (e) {
      this.getNotificationsManager().txInitError(
        "df__chargeArtifact",
        (e as Error).message,
      );
      throw e;
    }
  }

  public async shutdownArtifact(
    locationId: LocationId,
    artifactId: ArtifactId,
  ): Promise<Transaction<UnconfirmedShutdownArtifact>> {
    try {
      localStorage.setItem(
        `${this.getAccount()?.toLowerCase()}-shutdownArtifact`,
        artifactId,
      );

      const planet = this.getPlanetWithId(locationId);
      if (!planet) {
        throw Error("no planet");
      }

      const delegator = planet.owner;
      const myAccount = this.getAccount();

      if (!delegator || !myAccount) {
        throw Error("account error");
      }

      if (
        delegator !== myAccount &&
        !this.checkDelegateCondition(delegator, myAccount)
      ) {
        throw new Error("delegation error");
      }

      const txIntent: UnconfirmedShutdownArtifact = {
        methodName: "df__shutdownArtifact",
        contract: this.contractsAPI.contract,
        args: Promise.resolve([
          locationIdToDecStr(locationId),
          artifactIdToDecStr(artifactId),
        ]),
        delegator: delegator,
        locationId,
        artifactId,
      };

      const transactionFee = this.getTransactionFee();
      return this.contractsAPI.submitTransaction(txIntent, {
        value: transactionFee,
      });
    } catch (e) {
      this.getNotificationsManager().txInitError(
        "df__shutdownArtifact",
        (e as Error).message,
      );
      throw e;
    }
  }

  public async activateArtifact(
    locationId: LocationId,
    artifactId: ArtifactId,
    linkTo: LocationId | undefined,
    bypassChecks = false,
  ): Promise<Transaction<UnconfirmedActivateArtifact>> {
    try {
      // if (this.checkGameHasEnded()) {
      //   throw new Error('game has ended');
      // }

      if (!this.account) {
        throw new Error("no account set");
      }

      if (!bypassChecks) {
        const planet = this.entityStore.getPlanetWithId(locationId);
        // if (this.checkGameHasEnded()) {
        //   throw new Error('game has ended');
        // }

        if (!planet) {
          throw new Error("tried to activate on an unknown planet");
        }
        if (!artifactId) {
          throw new Error("must supply an artifact id");
        }
        // const myLastActivateArtifactTimestamp = this.players.get(
        //   this.account
        // )?.lastActivateArtifactTimestamp;

        // if (
        //   myLastActivateArtifactTimestamp &&
        //   Date.now() < this.getNextActivateArtifactAvailableTimestamp()
        // ) {
        //   throw new Error('still on cooldown for activating artifact');
        // }
      }

      localStorage.setItem(
        `${this.ethConnection.getAddress()?.toLowerCase()}-activatePlanet`,
        locationId,
      );
      localStorage.setItem(
        `${this.ethConnection.getAddress()?.toLowerCase()}-activateArtifact`,
        artifactId,
      );

      console.log(
        "activateArtifact",
        locationId,
        artifactId,
        linkTo ? locationIdToHexStr(linkTo) : "",
      );

      const artifact = this.getArtifactWithId(artifactId);
      if (!artifact) {
        throw new Error("artifact not found");
      }

      const getArgs = async () => {
        if (artifact.artifactType === ArtifactType.Wormhole) {
          if (!linkTo) {
            throw new Error("linkTo not found");
          }
          return locationIdToHexStr(linkTo);
        } else if (artifact.artifactType !== ArtifactType.Bomb) {
          return "";
        }
        const launchPlanet = this.entityStore.getPlanetWithId(locationId);
        if (!launchPlanet) {
          throw new Error("launch planet not found");
        }
        if (!isLocatable(launchPlanet)) {
          throw new Error("launch planet not locatable");
        }
        const revealArgs = await this.snarkHelper.getRevealArgs(
          launchPlanet.location.coords.x,
          launchPlanet.location.coords.y,
        );

        this.terminal.current?.println(
          "REVEAL: calculated SNARK with args:",
          TerminalTextStyle.Sub,
        );
        this.terminal.current?.println(
          JSON.stringify(hexifyBigIntNestedArray(revealArgs.slice(0, 3))),
          TerminalTextStyle.Sub,
        );
        this.terminal.current?.newline();

        const encoded = encodeFunctionData({
          abi: PlanetRevealSystemAbi,
          functionName: "revealLocation",
          args: this.transformRevealArgs(revealArgs),
        });
        return `0x${encoded.slice(10)}` as Hex;
      };

      const planet = this.getPlanetWithId(locationId);
      if (!planet) {
        throw Error("no planet");
      }

      const delegator = planet.owner;
      const myAccount = this.getAccount();

      if (!delegator || !myAccount) {
        throw Error("account error");
      }

      if (
        delegator !== myAccount &&
        !this.checkDelegateCondition(delegator, myAccount)
      ) {
        throw new Error("delegation error");
      }

      const txIntent: UnconfirmedActivateArtifact = {
        methodName: "df__activateArtifact",
        contract: this.contractsAPI.contract,
        delegator: delegator,
        args: Promise.resolve([
          locationIdToDecStr(locationId),
          artifactIdToDecStr(artifactId),
          await getArgs(),
        ]),
        locationId,
        artifactId,
        linkTo,
      };

      const transactionFee = this.getTransactionFee();

      // Always await the submitTransaction so we can catch rejections
      const tx = await this.contractsAPI.submitTransaction(txIntent, {
        value: transactionFee,
      });

      return tx;
    } catch (e) {
      this.getNotificationsManager().txInitError(
        "df__activateArtifact",
        (e as Error).message,
      );
      throw e;
    }
  }

  public async deactivateArtifact(
    locationId: LocationId,
    artifactId: ArtifactId,
    linkTo: LocationId | undefined,
    bypassChecks = false,
  ): Promise<Transaction<UnconfirmedDeactivateArtifact>> {
    try {
      if (!bypassChecks) {
        const planet = this.entityStore.getPlanetWithId(locationId);
        if (!planet) {
          throw new Error("tried to deactivate on an unknown planet");
        }
      }

      localStorage.setItem(
        `${this.ethConnection.getAddress()?.toLowerCase()}-deactivatePlanet`,
        locationId,
      );
      localStorage.setItem(
        `${this.ethConnection.getAddress()?.toLowerCase()}-deactivateArtifact`,
        artifactId,
      );

      const txIntent: UnconfirmedDeactivateArtifact = {
        methodName: "deactivateArtifact",
        contract: this.contractsAPI.contract,
        args: Promise.resolve([locationIdToDecStr(locationId)]),
        locationId,
        artifactId,
        linkTo,
      };

      // Always await the submitTransaction so we can catch rejections
      const tx = await this.contractsAPI.submitTransaction(txIntent);

      return tx;
    } catch (e) {
      this.getNotificationsManager().txInitError(
        "deactivateArtifact",
        (e as Error).message,
      );
      throw e;
    }
  }

  public async changeArtifactImageType(
    locationId: LocationId,
    artifactId: ArtifactId,
    newImageType: number,
    bypassChecks = false,
  ): Promise<Transaction<UnconfirmedChangeArtifactImageType>> {
    try {
      if (!bypassChecks) {
        const planet = this.entityStore.getPlanetWithId(locationId);
        if (!planet) {
          throw new Error(
            "tried to changeArtrtifactImageType on an unknown planet",
          );
        }
      }

      localStorage.setItem(
        `${this.ethConnection.getAddress()?.toLowerCase()}-changeArtifactImageType-locationId`,
        locationId,
      );
      localStorage.setItem(
        `${this.ethConnection.getAddress()?.toLowerCase()}-changeArtifactImageType-artifactId`,
        artifactId,
      );
      localStorage.setItem(
        `${this.ethConnection.getAddress()?.toLowerCase()}-changeArtifactImageType-newImageType`,
        newImageType.toString(),
      );

      const txIntent: UnconfirmedChangeArtifactImageType = {
        methodName: "changeArtifactImageType",
        contract: this.contractsAPI.contract,
        args: Promise.resolve([
          locationIdToDecStr(locationId),
          artifactIdToDecStr(artifactId),
          newImageType,
        ]),
        locationId,
        artifactId,
        newImageType,
      };

      // Always await the submitTransaction so we can catch rejections
      const tx = await this.contractsAPI.submitTransaction(txIntent);

      return tx;
    } catch (e) {
      this.getNotificationsManager().txInitError(
        "deactivateArtifact",
        (e as Error).message,
      );
      throw e;
    }
  }

  // public async buyArtifact(
  //   locationId: LocationId,
  //   rarity: ArtifactRarity,
  //   biome: Biome,
  //   type: ArtifactType,
  //   bypassChecks = false,
  // ): Promise<Transaction<UnconfirmedBuyArtifact>> {
  //   try {
  //     if (!bypassChecks) {
  //       const planet = this.entityStore.getPlanetWithId(locationId);
  //       if (!planet) {
  //         throw new Error("tried to buy artifact on an unknown planet");
  //       }
  //     }

  //     const halfPrice = this.getHalfPrice();

  //     localStorage.setItem(
  //       `${this.ethConnection.getAddress()?.toLowerCase()}-buyArtifactOnPlanet`,
  //       locationId,
  //     );

  //     localStorage.setItem(
  //       `${this.ethConnection.getAddress()?.toLowerCase()}-buyArtifactType`,
  //       Number(type).toString(),
  //     );

  //     localStorage.setItem(
  //       `${this.ethConnection.getAddress()?.toLowerCase()}-buyArtifactRarity`,
  //       Number(rarity).toString(),
  //     );

  //     localStorage.setItem(
  //       `${this.ethConnection.getAddress()?.toLowerCase()}-halfPrice`,
  //       halfPrice.toString(),
  //     );

  //     // localStorage.setItem(`${this.ethConnection.getAddress()?.toLowerCase()}-buyArtifact`, artifactId);

  //     // eslint-disable-next-line no-inner-declarations
  //     function random256Id() {
  //       const alphabet = "0123456789ABCDEF".split("");
  //       let result = "0x";
  //       for (let i = 0; i < 256 / 4; i++) {
  //         result += alphabet[Math.floor(Math.random() * alphabet.length)];
  //       }
  //       result = result.toLowerCase();
  //       return result;
  //     }

  //     // eslint-disable-next-line no-inner-declarations
  //     function isTypeOK() {
  //       const val = Number(type);
  //       if (val === Number(ArtifactType.Wormhole)) {
  //         return true;
  //       }
  //       if (val === Number(ArtifactType.PlanetaryShield)) {
  //         return true;
  //       }
  //       if (val === Number(ArtifactType.BloomFilter)) {
  //         return true;
  //       }
  //       if (val === Number(ArtifactType.FireLink)) {
  //         return true;
  //       }
  //       if (val === Number(ArtifactType.StellarShield)) {
  //         return true;
  //       }
  //       if (val === Number(ArtifactType.Avatar)) {
  //         return true;
  //       }

  //       return false;
  //     }

  //     // eslint-disable-next-line no-inner-declarations
  //     function price() {
  //       return 50;
  //       const rarityVal = parseInt(rarity.toString());
  //       const typeVal = parseInt(type.toString());

  //       if (rarityVal === 0 || rarityVal >= 5) {
  //         return 0;
  //       }
  //       if (isTypeOK() === false) {
  //         return 0;
  //       }
  //       if (
  //         typeVal === Number(ArtifactType.Wormhole) ||
  //         typeVal === Number(ArtifactType.PlanetaryShield) ||
  //         typeVal === Number(ArtifactType.BloomFilter) ||
  //         typeVal === Number(ArtifactType.FireLink)
  //       ) {
  //         return 2 ** (parseInt(rarity.toString()) - 1);
  //       } else if (typeVal === Number(ArtifactType.Avatar)) {
  //         return 1;
  //       } else if (typeVal === Number(ArtifactType.StellarShield)) {
  //         return 8;
  //       } else {
  //         return 0;
  //       }
  //     }

  //     //NOTE: this will not be the true artifactId
  //     const artifactId: ArtifactId = random256Id() as ArtifactId;

  //     const args = Promise.resolve([
  //       {
  //         tokenId: artifactId,
  //         discoverer: this.account,
  //         planetId: locationIdToDecStr(locationId),
  //         rarity,
  //         biome,
  //         artifactType: type,
  //         owner: this.account,
  //         controller: "0x0000000000000000000000000000000000000000",
  //         imageType: 0,
  //       },
  //     ]);

  //     const txIntent: UnconfirmedBuyArtifact = {
  //       methodName: "buyArtifact",
  //       contract: this.contractsAPI.contract,
  //       args: args,
  //       locationId,
  //       artifactId,
  //     };

  //     // Always await the submitTransaction so we can catch rejections

  //     const tx = await this.contractsAPI.submitTransaction(txIntent, {
  //       // NOTE: when change gasLimit, need change the value in TxConfirmPopup.tsx
  //       gasLimit: 2000000,
  //       value: halfPrice
  //         ? bigInt(500_000_000_000_000).toString()
  //         : bigInt(1_000_000_000_000_000).toString(), //0.001eth
  //     });

  //     return tx;
  //   } catch (e) {
  //     this.getNotificationsManager().txInitError(
  //       "buyArtifact",
  //       (e as Error).message,
  //     );
  //     throw e;
  //   }
  // }

  public async withdrawSilver(
    locationId: LocationId,
    amount: number,
  ): Promise<Transaction<UnconfirmedWithdrawSilver>> {
    try {
      if (!this.account) {
        throw new Error("no account");
      }
      // if (this.checkGameHasEnded()) {
      //   throw new Error('game has ended');
      // }
      const planet = this.entityStore.getPlanetWithId(locationId);
      if (!planet) {
        throw new Error("tried to withdraw silver from an unknown planet");
      }
      if (planet.planetType !== PlanetType.TRADING_POST) {
        throw new Error("can only withdraw silver from spacetime rips");
      }
      if (!this.checkDelegateCondition(planet.owner, this.getAccount())) {
        throw new Error("can only withdraw silver from a planet you own");
      }
      if (planet.transactions?.hasTransaction(isUnconfirmedWithdrawSilverTx)) {
        throw new Error(
          "a withdraw silver action is already in progress for this planet",
        );
      }
      if (amount > planet.silver) {
        throw new Error("not enough silver to withdraw!");
      }

      if (amount * 5 < planet.silverCap) {
        throw new Error("require silverAmount >= silverCap * 0.2");
      }

      if (amount === 0) {
        throw new Error("must withdraw more than 0 silver!");
      }

      // if (planet.destroyed || planet.frozen) {
      //   throw new Error(
      //     "can't withdraw silver from a destroyed/frozen planet",
      //   );
      // }

      localStorage.setItem(
        `${this.ethConnection.getAddress()?.toLowerCase()}-withdrawSilverPlanet`,
        locationId,
      );

      const delegator = planet.owner;

      if (!delegator) {
        throw Error("no delegator account");
      }

      const txIntent: UnconfirmedWithdrawSilver = {
        delegator: delegator,
        methodName: "df__withdrawSilver",
        contract: this.contractsAPI.contract,
        args: Promise.resolve([
          locationIdToDecStr(locationId),
          amount * CONTRACT_PRECISION,
        ]),
        locationId,
        amount,
      };

      const transactionFee = this.getTransactionFee();

      // Always await the submitTransaction so we can catch rejections
      const tx = await this.contractsAPI.submitTransaction(txIntent, {
        value: transactionFee,
      });

      return tx;
    } catch (e) {
      this.getNotificationsManager().txInitError(
        "df__withdrawSilver",
        (e as Error).message,
      );
      throw e;
    }
  }

  public async withdrawMaterial(
    locationId: LocationId,
    materialType: MaterialType,
    amount: number,
  ): Promise<Transaction<UnconfirmedWithdrawMaterial>> {
    try {
      if (!this.account) {
        throw new Error("no account");
      }

      const planet = this.entityStore.getPlanetWithId(locationId);
      if (!planet) {
        throw new Error("tried to withdraw material from an unknown planet");
      }
      if (planet.planetType !== PlanetType.TRADING_POST) {
        throw new Error("can only withdraw material from spacetime rips");
      }
      if (!this.checkDelegateCondition(planet.owner, this.getAccount())) {
        throw new Error("can only withdraw material from a planet you own");
      }
      if (
        planet.transactions?.hasTransaction(isUnconfirmedWithdrawMaterialTx)
      ) {
        throw new Error(
          "a withdraw material action is already in progress for this planet",
        );
      }

      // Check if planet has the material
      const material = planet.materials?.find(
        (m) => m?.materialId === materialType,
      );
      if (!material || Number(material.materialAmount) < amount) {
        throw new Error("not enough material to withdraw!");
      }
      if (amount * 5 < Number(material.cap)) {
        throw new Error("require materialAmount >= materialCap * 0.2");
      }

      if (amount === 0) {
        throw new Error("must withdraw more than 0 material!");
      }

      localStorage.setItem(
        `${this.ethConnection.getAddress()?.toLowerCase()}-withdrawMaterialPlanet`,
        locationId,
      );

      const delegator = planet.owner;

      if (!delegator) {
        throw Error("no delegator account");
      }
      const txIntent: UnconfirmedWithdrawMaterial = {
        delegator: delegator,
        methodName: "df__withdrawMaterial",
        contract: this.contractsAPI.contract,
        args: Promise.resolve([
          locationIdToDecStr(locationId),
          materialType,
          Number(amount * CONTRACT_PRECISION),
        ]),
        locationId,
        materialType,
        amount,
      };

      const transactionFee = this.getTransactionFee();

      // Always await the submitTransaction so we can catch rejections
      const tx = await this.contractsAPI.submitTransaction(txIntent, {
        value: transactionFee,
      });

      return tx;
    } catch (e) {
      this.getNotificationsManager().txInitError(
        "df__withdrawMaterial",
        (e as Error).message,
      );
      throw e;
    }
  }

  public async revertMove(
    moveId: string,
    toPlanetHash: LocationId,
    moveIndex: number,
  ): Promise<Transaction<UnconfirmedRevertMove>> {
    try {
      if (!this.account) {
        throw new Error("no account");
      }

      const delegator = this.account;
      if (!delegator) {
        throw Error("no delegator account");
      }

      const txIntent: UnconfirmedRevertMove = {
        delegator: delegator,
        methodName: "df__revertMove",
        contract: this.contractsAPI.contract,
        args: Promise.resolve([
          moveId, // Keep as string for JSON serialization
          locationIdToHexStr(toPlanetHash),
          moveIndex,
        ]),
        moveId: moveId,
        toPlanetHash,
        moveIndex,
      };

      const transactionFee = this.getTransactionFee();

      const tx = await this.contractsAPI.submitTransaction(txIntent, {
        value: transactionFee,
      });

      return tx;
    } catch (e) {
      this.getNotificationsManager().txInitError(
        "df__revertMove",
        (e as Error).message,
      );
      throw e;
    }
  }

  public async addJunk(
    locationId: LocationId,
    biomeBase?: number,
  ): Promise<Transaction<UnconfirmedAddJunk>> {
    try {
      if (!this.account) {
        throw new Error("no account");
      }
      // if (this.checkGameHasEnded()) {
      //   throw new Error('game has ended');
      // }
      const planet = this.entityStore.getPlanetWithId(locationId);
      if (!planet) {
        throw new Error("unknown planet");
      }

      if (!this.checkDelegateCondition(planet.owner, this.getAccount())) {
        throw new Error("can only add junk from a planet you own");
      }

      if (planet.transactions?.hasTransaction(isUnconfirmedAddJunkTx)) {
        throw new Error(
          "another add junk action is already in progress for this planet",
        );
      }

      // if (planet.destroyed || planet.frozen) {
      //   throw new Error(
      //     "can't withdraw silver from a destroyed/frozen planet",
      //   );
      // }

      if (!this.contractsAPI.getConstants().SPACE_JUNK_ENABLED) {
        throw new Error("space junk is disabled");
      }

      if (planet.owner !== this.getAccount()) {
        throw new Error("can only add junk to your own planet");
      }

      if (!isLocatable(planet)) {
        throw new Error("you don't know the coordinates of this planet");
      }

      const player = this.getPlayer(this.getAccount());

      if (!player) {
        throw new Error("player not found");
      }

      if (
        player.junk +
          this.contractsAPI.getConstants().PLANET_LEVEL_JUNK[
            planet.planetLevel
          ] >
        player.junkLimit
      ) {
        throw new Error("junk limit exceeded");
      }

      localStorage.setItem(
        `${this.ethConnection.getAddress()?.toLowerCase()}-addJunkPlanet`,
        locationId,
      );

      const delegator = planet.owner;

      if (!delegator) {
        throw Error("no delegator account");
      }

      // Generate proof for biome base verification
      const locatablePlanet = planet as LocatablePlanet;
      const proof = await this.snarkHelper.getFindArtifactArgs(
        locatablePlanet.location.coords.x,
        locatablePlanet.location.coords.y,
      );

      const txIntent: UnconfirmedAddJunk = {
        delegator: delegator,
        methodName: "df__addJunk",
        contract: this.contractsAPI.contract,
        args: Promise.resolve([
          locationIdToDecStr(locationId),
          biomeBase || 0, // Use provided biomeBase or default to 0
          proof, // ZK proof for biome base verification
        ]),
        locationId,
        biomeBase: biomeBase || 0,
        proof,
      };

      const transactionFee = this.getTransactionFee();

      // Always await the submitTransaction so we can catch rejections
      const tx = await this.contractsAPI.submitTransaction(txIntent, {
        value: transactionFee,
      });

      return tx;
    } catch (e) {
      this.getNotificationsManager().txInitError(
        "df__addJunk",
        (e as Error).message,
      );
      throw e;
    }
  }

  public async clearJunk(
    locationId: LocationId,
  ): Promise<Transaction<UnconfirmedClearJunk>> {
    try {
      if (!this.account) {
        throw new Error("no account");
      }
      // if (this.checkGameHasEnded()) {
      //   throw new Error('game has ended');
      // }
      const planet = this.entityStore.getPlanetWithId(locationId);
      if (!planet) {
        throw new Error("unknown planet");
      }

      if (!this.checkDelegateCondition(planet.junkOwner, this.getAccount())) {
        throw new Error("planet junk owner is not you");
      }

      if (planet.transactions?.hasTransaction(isUnconfirmedClearJunkTx)) {
        throw new Error(
          "another clearJunk action is already in progress for this planet",
        );
      }

      // if (planet.destroyed || planet.frozen) {
      //   throw new Error(
      //     "can't withdraw silver from a destroyed/frozen planet",
      //   );
      // }

      if (!this.contractsAPI.getConstants().SPACE_JUNK_ENABLED) {
        throw new Error("space junk is disabled");
      }

      localStorage.setItem(
        `${this.ethConnection.getAddress()?.toLowerCase()}-addJunkPlanet`,
        locationId,
      );

      const delegator = this.getAccount();

      if (!delegator) {
        throw Error("no delegator account");
      }

      const txIntent: UnconfirmedClearJunk = {
        delegator: delegator,
        methodName: "df__clearJunk",
        contract: this.contractsAPI.contract,
        args: Promise.resolve([locationIdToDecStr(locationId)]),
        locationId,
      };

      const transactionFee = this.getTransactionFee();

      // Always await the submitTransaction so we can catch rejections
      const tx = await this.contractsAPI.submitTransaction(txIntent, {
        value: transactionFee,
      });

      return tx;
    } catch (e) {
      this.getNotificationsManager().txInitError(
        "df__clearJunk",
        (e as Error).message,
      );
      throw e;
    }
  }

  // PUNK

  public getBuyJunkFee(amount: number): bigint {
    const config = this.contractsAPI.getConstants();

    const SPACE_JUNK_FREE_ALLOCATION = config.SPACE_JUNK_FREE_ALLOCATION;
    const SPACE_JUNK_LINEAR_MIN_PURCHASE =
      config.SPACE_JUNK_LINEAR_MIN_PURCHASE;
    const SPACE_JUNK_LINEAR_MAX_PURCHASE =
      config.SPACE_JUNK_LINEAR_MAX_PURCHASE;
    const SPACE_JUNK_LINEAR_BASE_PRICE = config.SPACE_JUNK_LINEAR_BASE_PRICE;
    const SPACE_JUNK_QUADRATIC_MIN_PURCHASE =
      config.SPACE_JUNK_QUADRATIC_MIN_PURCHASE;

    const SPACE_JUNK_QUADRATIC_BASE_PRICE =
      config.SPACE_JUNK_QUADRATIC_BASE_PRICE;

    let fee = 0n;
    if (amount < SPACE_JUNK_FREE_ALLOCATION) {
      fee = 0n;
    } else if (amount <= SPACE_JUNK_LINEAR_MAX_PURCHASE) {
      fee +=
        BigInt(amount - SPACE_JUNK_LINEAR_MIN_PURCHASE + 1) *
        SPACE_JUNK_LINEAR_BASE_PRICE;
    } else if (amount >= SPACE_JUNK_QUADRATIC_MIN_PURCHASE) {
      fee +=
        BigInt(
          SPACE_JUNK_LINEAR_MAX_PURCHASE - SPACE_JUNK_LINEAR_MIN_PURCHASE + 1,
        ) * SPACE_JUNK_LINEAR_BASE_PRICE;
      const t = BigInt(amount - SPACE_JUNK_QUADRATIC_MIN_PURCHASE + 1);
      fee += t * t * SPACE_JUNK_QUADRATIC_BASE_PRICE;
    }
    return fee;
  }

  public getBuyJunkFeeByAddr(address: EthAddress) {
    const player = this.getPlayer(address);
    if (!player) return 0n;

    const playerSpaceJunkLimit = this.getPlayerSpaceJunkLimit(address);

    if (playerSpaceJunkLimit === 0) {
      return 0n;
    }

    const amount = playerSpaceJunkLimit
      ? Math.round(playerSpaceJunkLimit / 1000)
      : 0;
    const fee = this.getBuyJunkFee(amount);
    return fee;
  }

  public getFeeAnalysis() {
    const players = this.getAllPlayers();
    let sum = 0n;
    for (let i = 0; i < players.length; i++) {
      const player = players[i];
      const fee = this.getBuyJunkFeeByAddr(player.address);
      sum += fee;

      const showFee = utils.formatEther(fee.toString());

      console.log(player.address, showFee);
    }

    const showSum = utils.formatEther(sum.toString());
    console.log("sum:", showSum);
  }

  public async buyJunk(
    inputAmount: number,
  ): Promise<Transaction<UnconfirmedBuyJunk>> {
    const amount = Math.round(inputAmount / 1000);

    console.log("buy junk amount:", amount);
    try {
      if (!this.account) {
        throw new Error("no account");
      }
      // if (this.checkGameHasEnded()) {
      //   throw new Error('game has ended');
      // }

      if (!this.contractsAPI.getConstants().SPACE_JUNK_ENABLED) {
        throw new Error("space junk is disabled");
      }

      const playerJunkLimit = this.getPlayerSpaceJunkLimit(this.account);

      const preAmount = playerJunkLimit
        ? Math.round(playerJunkLimit / 1000)
        : 0;

      if (amount < preAmount) {
        throw new Error("need buy more");
      }

      const transactionFee =
        this.getBuyJunkFee(amount) - this.getBuyJunkFee(preAmount);

      localStorage.setItem(
        `${this.ethConnection.getAddress()?.toLowerCase()}-buySpaceJunk-amount`,
        amount.toString(),
      );

      const transactionFeeETH = utils.formatEther(transactionFee);

      localStorage.setItem(
        `${this.ethConnection.getAddress()?.toLowerCase()}-buySpaceJunk-fee`,
        transactionFeeETH.toString(),
      );

      // PUNK Test
      console.log("fee", transactionFee);
      console.log("fee (ETH):", utils.formatEther(transactionFee));

      const delegator = this.getAccount();

      if (!delegator) {
        throw Error("no delegator account");
      }

      const txIntent: UnconfirmedBuyJunk = {
        delegator: delegator,
        methodName: "df__buyJunk",
        contract: this.contractsAPI.contract,
        args: Promise.resolve([amount]),
        amount: amount,
      };

      // Always await the submitTransaction so we can catch rejections
      const tx = await this.contractsAPI.submitTransaction(txIntent, {
        value: transactionFee,
      });

      return tx;
    } catch (e) {
      this.getNotificationsManager().txInitError(
        "df__buyJunk",
        (e as Error).message,
      );
      throw e;
    }
  }

  public async setPlanetEmoji(
    locationId: LocationId,
    emoji: string,
  ): Promise<Transaction<UnconfirmedSetPlanetEmoji>> {
    try {
      if (!this.account) {
        throw new Error("no account");
      }
      // if (this.checkGameHasEnded()) {
      //   throw new Error('game has ended');
      // }
      const planet = this.entityStore.getPlanetWithId(locationId);
      if (!planet) {
        throw new Error("tried to set emoji to an unknown planet");
      }

      const canDelegate = this.checkDelegateCondition(
        planet.owner,
        this.getAccount(),
      );

      if (planet.owner !== this.getAccount() && !canDelegate) {
        throw new Error("can only set emoji to your planet");
      }
      if (planet.transactions?.hasTransaction(isUnconfirmedSetPlanetEmojiTx)) {
        throw new Error(
          "a set emoji action is already in progress for this planet",
        );
      }

      if (planet.destroyed || planet.frozen) {
        throw new Error("can't set emoji to a destroyed/frozen planet");
      }

      localStorage.setItem(
        `${this.ethConnection.getAddress()?.toLowerCase()}-setPlanetEmoji-planetId`,
        locationId,
      );

      const delegator = planet.owner; //this.getAccount();

      if (!delegator) {
        throw Error("no delegator account");
      }

      const txIntent: UnconfirmedSetPlanetEmoji = {
        delegator: delegator,
        methodName: "df__setPlanetEmoji",
        contract: this.contractsAPI.contract,
        args: Promise.resolve([locationIdToDecStr(locationId), emoji]),
        locationId,
        emoji,
      };

      // Always await the submitTransaction so we can catch rejections
      const tx = await this.contractsAPI.submitTransaction(txIntent);

      return tx;
    } catch (e) {
      this.getNotificationsManager().txInitError(
        "df__setPlanetEmoji",
        (e as Error).message,
      );
      throw e;
    }
  }

  /**
   * We have two locations which planet state can live: on the server, and on the blockchain. We use
   * the blockchain for the 'physics' of the universe, and the webserver for optional 'add-on'
   * features, which are cryptographically secure, but live off-chain.
   *
   * This function loads the planet states which live on the server. Plays nicely with our
   * notifications system and sets the appropriate loading state values on the planet.
   */
  public async refreshServerPlanetStates(planetIds: LocationId[]) {
    const planets = this.getPlanetsWithIds(planetIds);

    planetIds.forEach((id) =>
      this.getGameObjects().updatePlanet(id, (p) => {
        p.loadingServerState = true;
      }),
    );

    // const messages = await getMessagesOnPlanets({ planets: planetIds });

    planets.forEach((planet) => {
      const previousPlanetEmoji =
        !planet.emoji || planet.emoji === "" ? undefined : planet.emoji;

      planet.emoji = this.contractsAPI.getPlanetEmoji(planet.locationId);

      const nowPlanetEmoji = planet.emoji;

      // an emoji was added
      if (previousPlanetEmoji === undefined && nowPlanetEmoji !== undefined) {
        planet.emojiZoopAnimation = easeInAnimation(2000);
        // an emoji was removed
      } else if (
        nowPlanetEmoji === undefined &&
        previousPlanetEmoji !== undefined
      ) {
        planet.emojiZoopAnimation = undefined;
        planet.emojiZoopOutAnimation = emojiEaseOutAnimation(
          3000,
          previousPlanetEmoji,
        );
      }
    });

    planetIds.forEach((id) =>
      this.getGameObjects().updatePlanet(id, (p) => {
        p.loadingServerState = false;
        p.needsServerRefresh = false;
      }),
    );
  }

  /**
   * If you are the owner of this planet, you can set an 'emoji' to hover above the planet.
   * `emojiStr` must be a string that contains a single emoji, otherwise this function will throw an
   * error.
   *
   * The emoji is stored off-chain in a postgres database. We verify planet ownership via a contract
   * call from the webserver, and by verifying that the request to add (or remove) an emoji from a
   * planet was signed by the owner.
   */
  // public async setPlanetEmoji(locationId: LocationId, emojiStr: string) {
  //   const res = await this.submitPlanetMessage(
  //     locationId,
  //     PlanetMessageType.EmojiFlag,
  //     {
  //       emoji: emojiStr,
  //     },
  //   );
  //   return res;
  // }

  /**
   * If you are the owner of this planet, you can delete the emoji that is hovering above the
   * planet.
   */
  // public async clearEmoji(locationId: LocationId) {
  //   if (this.account === undefined) {
  //     throw new Error("can't clear emoji: not logged in");
  //   }

  //   if (this.getPlanetWithId(locationId)?.unconfirmedClearEmoji) {
  //     throw new Error(
  //       `can't clear emoji: alreading clearing emoji from ${locationId}`,
  //     );
  //   }

  //   this.getGameObjects().updatePlanet(locationId, (p) => {
  //     p.unconfirmedClearEmoji = true;
  //   });

  //   const request = await this.ethConnection.signMessageObject({
  //     locationId,
  //     ids: this.getPlanetWithId(locationId)?.messages?.map((m) => m.id) || [],
  //   });

  //   try {
  //     await deleteMessages(request);
  //   } catch (e) {
  //     throw e as Error;
  //   } finally {
  //     this.getGameObjects().updatePlanet(locationId, (p) => {
  //       p.needsServerRefresh = true;
  //       p.unconfirmedClearEmoji = false;
  //     });
  //   }

  //   await this.refreshServerPlanetStates([locationId]);
  // }

  // public async submitDisconnectTwitter(twitter: string) {
  //   await disconnectTwitter(
  //     await this.ethConnection.signMessageObject({ twitter }),
  //   );
  //   await this.refreshTwitters();
  // }

  /**
   * The planet emoji feature is built on top of a more general 'Planet Message' system, which
   * allows players to upload pieces of data called 'Message's to planets that they own. Emojis are
   * just one type of message. Their implementation leaves the door open to more off-chain data.
   */
  // private async submitPlanetMessage(
  //   locationId: LocationId,
  //   type: PlanetMessageType,
  //   body: unknown,
  // ) {
  //   if (this.account === undefined) {
  //     throw new Error("can't submit planet message not logged in");
  //   }

  //   if (this.getPlanetWithId(locationId)?.unconfirmedAddEmoji) {
  //     throw new Error(
  //       `can't submit planet message: already submitting for planet ${locationId}`,
  //     );
  //   }

  //   this.getGameObjects().updatePlanet(locationId, (p) => {
  //     p.unconfirmedAddEmoji = true;
  //   });

  //   const request = await this.ethConnection.signMessageObject({
  //     locationId,
  //     sender: this.account,
  //     type,
  //     body,
  //   });

  //   try {
  //     await addMessage(request);
  //   } catch (e) {
  //     throw e as Error;
  //   } finally {
  //     this.getGameObjects().updatePlanet(locationId, (p) => {
  //       p.unconfirmedAddEmoji = false;
  //       p.needsServerRefresh = true;
  //     });
  //   }

  //   await this.refreshServerPlanetStates([locationId]);
  // }

  /**
   * Checks that a message signed by {@link GameManager#signMessage} was signed by the address that
   * it claims it was signed by.
   */
  // private async verifyMessage(
  //   message: SignedMessage<unknown>,
  // ): Promise<boolean> {
  //   const preSigned = JSON.stringify(messag(e as Error).message);

  //   return verifySignature(
  //     preSigned,
  //     message.signature as string,
  //     message.sender,
  //   );
  // }

  /**
   * Submits a transaction to the blockchain to move the given amount of resources from
   * the given planet to the given planet.
   */

  public async move(
    from: LocationId,
    to: LocationId,
    forces: number,
    silver: number,
    artifactMoved?: ArtifactId,
    abandoning = false,
    materials?: MaterialTransfer[],
  ): Promise<Transaction<UnconfirmedMove>> {
    localStorage.setItem(
      `${this.ethConnection.getAddress()?.toLowerCase()}-fromPlanet`,
      from,
    );
    localStorage.setItem(
      `${this.ethConnection.getAddress()?.toLowerCase()}-toPlanet`,
      to,
    );

    try {
      // if (!bypassChecks && this.checkGameHasEnded()) {
      //   throw new Error('game has ended');
      // }
      function encodeMovedMaterials(
        mats?: readonly {
          materialId: number | bigint;
          materialAmount: number | bigint;
        }[],
      ): `0x${string}` {
        if (!mats || mats.length === 0)
          return "0x00000000000000000000000000000000000000000000000000000000000000200000000000000000000000000000000000000000000000000000000000000000";

        console.log("mats", mats);
        const norm = mats.map((m) => ({
          resourceId: Number(m.materialId) & 0xff, // uint8
          amount: BigInt(m.materialAmount) & ((1n << 256n) - 1n), // uint256
        }));
        return encodeAbiParameters(
          [
            {
              type: "tuple[]",
              components: [
                { name: "resourceId", type: "uint8" },
                { name: "amount", type: "uint256" },
              ],
            },
          ],
          [norm],
        ) as `0x${string}`;
      }
      const arrivalsToOriginPlanet =
        this.entityStore.getArrivalIdsForLocation(from);
      const hasIncomingVoyage =
        arrivalsToOriginPlanet && arrivalsToOriginPlanet.length > 0;
      if (abandoning && hasIncomingVoyage) {
        throw new Error("cannot abandon a planet that has incoming voyages");
      }

      const oldLocation = this.entityStore.getLocationOfPlanet(from);
      const newLocation = this.entityStore.getLocationOfPlanet(to);
      if (!oldLocation) {
        throw new Error("tried to move from planet that does not exist");
      }
      if (!newLocation) {
        throw new Error("tried to move from planet that does not exist");
      }

      const oldX = oldLocation.coords.x;
      const oldY = oldLocation.coords.y;
      const newX = newLocation.coords.x;
      const newY = newLocation.coords.y;
      const xDiff = newX - oldX;
      const yDiff = newY - oldY;

      //###############
      //  NEW MAP ALGO
      //###############
      // const distFromOriginSquare = newX ** 2 + newY ** 2;

      const distMax = Math.ceil(Math.sqrt(xDiff ** 2 + yDiff ** 2));

      // Contract will automatically send full forces/silver on abandon
      const shipsMoved = !abandoning ? forces : 0;
      const silverMoved = !abandoning ? silver : 0;
      let materialsMoved: MaterialTransfer[] = [];
      // Auto-pack all materials on abandon
      if (abandoning && materials) {
        materialsMoved = materials.map((mat) => ({
          materialId: mat.materialId,
          materialAmount: Number(mat.materialAmount) as MaterialAmount,
        }));
      } else if (materials) {
        materialsMoved = materials;
      }
      materialsMoved = materialsMoved.map((mat) => ({
        materialId: mat.materialId,
        materialAmount: Number(
          mat.materialAmount * CONTRACT_PRECISION,
        ) as MaterialAmount,
      }));

      if (newX ** 2 + newY ** 2 >= this.worldRadius ** 2) {
        throw new Error("attempted to move out of bounds");
      }

      if (newX ** 2 + newY ** 2 < this.getInnerRadius() ** 2) {
        throw new Error("attempted to move into inner circle");
      }

      const oldPlanet = this.entityStore.getPlanetWithLocation(oldLocation);

      if (!this.account) {
        throw new Error("no account");
      }

      if (!oldPlanet) {
        throw new Error("no old planet");
      }

      if (
        oldPlanet.owner !== this.getAccount() &&
        !this.checkDelegateCondition(oldPlanet.owner, this.getAccount())
        //  || !isSpaceShip(this.getArtifactWithId(artifactMoved)?.artifactType)
      ) {
        throw new Error("attempted to move from a planet not owned by player");
      }

      const getArgs = async (): Promise<unknown[]> => {
        const snarkArgs = await this.snarkHelper.getMoveArgs(
          oldX,
          oldY,
          newX,
          newY,
          this.worldRadius,
          distMax,
        );

        const movedMaterials = encodeMovedMaterials(materialsMoved);
        const args: MoveArgs = [
          snarkArgs[ZKArgIdx.PROOF_A],
          snarkArgs[ZKArgIdx.PROOF_B],
          snarkArgs[ZKArgIdx.PROOF_C],
          snarkArgs[ZKArgIdx.DATA],
          (shipsMoved * CONTRACT_PRECISION).toString(),
          (silverMoved * CONTRACT_PRECISION).toString(),
          "0",
          abandoning ? "1" : "0",
          movedMaterials,
        ] as unknown as MoveArgs;

        this.terminal.current?.println(
          "MOVE: calculated SNARK with args:",
          TerminalTextStyle.Sub,
        );
        // this.terminal.current?.println(
        //   JSON.stringify(hexifyBigIntNestedArray(args)),
        //   TerminalTextStyle.Sub,
        // );
        this.terminal.current?.newline();

        if (artifactMoved) {
          args[6] = artifactIdToDecStr(artifactMoved);
        }
        console.log("move args");
        console.log(args);
        return args;
      };

      const delegator = oldPlanet?.owner; // this.getAccount();
      if (!delegator) {
        throw Error("no delegator account");
      }

      const txIntent: UnconfirmedMove = {
        delegator: delegator,
        methodName: "df__legacyMove",
        contract: this.contractsAPI.contract,
        args: getArgs(),
        from: oldLocation.hash,
        to: newLocation.hash,
        forces: shipsMoved,
        silver: silverMoved,
        artifact: artifactMoved,
        abandoning,
        materials: materialsMoved,
      };

      if (artifactMoved) {
        const artifact = this.entityStore.getArtifactById(artifactMoved);

        if (!artifact) {
          throw new Error("couldn't find this artifact");
        }
        if (isActivated(artifact)) {
          throw new Error("can't move an activated artifact");
        }
        if (!oldPlanet?.heldArtifactIds?.includes(artifactMoved)) {
          throw new Error("that artifact isn't on this planet!");
        }
      }

      const transactionFee = this.getTransactionFee();
      console.log("args tx", txIntent);
      // debugger;
      // Always await the submitTransaction so we can catch rejections
      const tx = await this.contractsAPI.submitTransaction(txIntent, {
        value: transactionFee,
      });

      return tx;
    } catch (e) {
      this.getNotificationsManager().txInitError(
        "df__legacyMove",
        (e as Error).message,
      );
      throw e;
    }
  }

  /**
   * Submits a transaction to the blockchain to upgrade the given planet with the given
   * upgrade branch. You must own the planet, and have enough silver on it to complete
   * the upgrade.
   */
  public async upgrade(
    planetId: LocationId,
    branch: number,
  ): Promise<Transaction<UnconfirmedUpgrade>> {
    try {
      // this is shitty
      localStorage.setItem(
        `${this.ethConnection.getAddress()?.toLowerCase()}-upPlanet`,
        planetId,
      );
      localStorage.setItem(
        `${this.ethConnection.getAddress()?.toLowerCase()}-branch`,
        branch.toString(),
      );

      const planet = this.entityStore.getPlanetWithId(planetId);
      if (!planet) {
        throw new Error("planet not found");
      }

      const delegator = planet.owner; // this.getAccount();
      if (!delegator) {
        throw Error("no delegator account");
      }

      const txIntent: UnconfirmedUpgrade = {
        delegator: delegator,
        methodName: "df__legacyUpgradePlanet",
        contract: this.contractsAPI.contract,
        args: Promise.resolve([
          locationIdToDecStr(planetId),
          branch.toString(),
        ]),
        locationId: planetId,
        upgradeBranch: branch,
      };

      const transactionFee = this.getTransactionFee();

      // Always await the submitTransaction so we can catch rejections
      const tx = await this.contractsAPI.submitTransaction(txIntent, {
        value: transactionFee,
      });
      return tx;
    } catch (e) {
      this.getNotificationsManager().txInitError(
        "df__legacyUpgradePlanet",
        (e as Error).message,
      );
      throw e;
    }
  }

  /**
   * Submits a transaction to the blockchain to refreshPlanet.
   */
  public async refreshPlanet(
    planetId: LocationId,
    _bypassChecks = false,
  ): Promise<Transaction<UnconfirmedRefreshPlanet>> {
    try {
      // this is shitty
      localStorage.setItem(
        `${this.ethConnection.getAddress()?.toLowerCase()}-refreshPlanet`,
        planetId,
      );

      const txIntent: UnconfirmedRefreshPlanet = {
        methodName: "refreshPlanet",
        contract: this.contractsAPI.contract,
        args: Promise.resolve([locationIdToDecStr(planetId)]),
        locationId: planetId,
      };

      // Always await the submitTransaction so we can catch rejections
      const tx = await this.contractsAPI.submitTransaction(txIntent);

      return tx;
    } catch (e) {
      this.getNotificationsManager().txInitError(
        "refreshPlanet",
        (e as Error).message,
      );
      throw e;
    }
  }

  /**
   * Submits a transaction to the blockchain to buy a hat for the given planet. You must own the
   * planet. Warning costs real token. Hats are permanently locked to a planet. They are purely
   * cosmetic and a great way to BM your opponents or just look your best. Just like in the real
   * world, more money means more hat.
   */
  // public async buySkin(
  //   planetId: LocationId,
  //   hatType: number,
  //   _bypassChecks = false,
  // ): Promise<Transaction<UnconfirmedBuyHat>> {
  //   const planetLoc = this.entityStore.getLocationOfPlanet(planetId);
  //   const planet = this.entityStore.getPlanetWithLocation(planetLoc);
  //   const halfPrice = this.getHalfPrice();

  //   try {
  //     if (!planetLoc) {
  //       console.error("planet not found");
  //       throw new Error("[TX ERROR] Planet not found");
  //     }
  //     if (!planet) {
  //       console.error("planet not found");
  //       throw new Error("[TX ERROR] Planet not found");
  //     }

  //     if (hatType === HatType.Unknown) {
  //       console.error("hatTpye === 0");
  //       throw new Error("[TX ERROR] hatType Error");
  //     }

  //     // price requirements
  //     const balanceEth = this.getMyBalanceEth();
  //     let hatCostEth = planet.hatLevel === 0 ? 0.002 : 0;
  //     if (halfPrice) {
  //       hatCostEth *= 0.5;
  //     }

  //     if (balanceEth < hatCostEth) {
  //       throw new Error("you don't have enough ETH");
  //     }

  //     localStorage.setItem(
  //       `${this.ethConnection.getAddress()?.toLowerCase()}-hatPlanet`,
  //       planetId,
  //     );
  //     localStorage.setItem(
  //       `${this.ethConnection.getAddress()?.toLowerCase()}-hatLevel`,
  //       planet.hatLevel.toString(),
  //     );

  //     localStorage.setItem(
  //       `${this.ethConnection.getAddress()?.toLowerCase()}-hatType`,
  //       planet.hatType.toString(),
  //     );

  //     localStorage.setItem(
  //       `${this.ethConnection.getAddress()?.toLowerCase()}-halfPrice`,
  //       halfPrice.toString(),
  //     );

  //     localStorage.setItem(
  //       `${this.ethConnection.getAddress()?.toLowerCase()}-hatCostEth`,
  //       hatCostEth.toString(),
  //     );

  //     const txIntent: UnconfirmedBuyHat = {
  //       methodName: "buySkin",
  //       contract: this.contractsAPI.contract,
  //       args: Promise.resolve([locationIdToDecStr(planetId), hatType]),
  //       locationId: planetId,
  //       hatType: hatType,
  //     };

  //     // Always await the submitTransaction so we can catch rejections

  //     const tx = await this.contractsAPI.submitTransaction(txIntent, {
  //       value:
  //         planet.hatLevel === 0
  //           ? halfPrice
  //             ? bigInt(1_000_000_000_000_000).toString()
  //             : bigInt(2_000_000_000_000_000).toString()
  //           : "0", //0.001eth
  //     });

  //     return tx;
  //   } catch (e) {
  //     this.getNotificationsManager().txInitError(
  //       "buySkin",
  //       (e as Error).message,
  //     );
  //     throw e;
  //   }
  // }
  /**
   * Submits a transaction to the blockchain to buy a planet.
   * Warning costs real token.
   */
  // public async buyPlanet(
  //   planetId: LocationId,
  // ): Promise<Transaction<UnconfirmedBuyPlanet>> {
  //   try {
  //     if (!this.account) {
  //       throw new Error("no account set");
  //     }
  //     // if (this.checkGameHasEnded()) {
  //     //   throw new Error('game has ended');
  //     // }

  //     const planet = this.entityStore.getPlanetWithId(planetId);

  //     // planet requirements
  //     if (!planet) {
  //       throw new Error("you can't buy a planet you haven't discovered");
  //     }

  //     if (!isLocatable(planet)) {
  //       throw new Error(
  //         "you can't buy a planet whose coordinates you don't know",
  //       );
  //     }

  //     if (planet.destroyed || planet.frozen) {
  //       throw new Error("you can't buy destroyed/frozen planets");
  //     }

  //     if (planet.planetLevel !== 0) {
  //       throw new Error("only level 0");
  //     }

  //     if (planet.owner !== EMPTY_ADDRESS) {
  //       throw new Error("you can only buy planet without owner");
  //     }

  //     const x: number = planet.location.coords.x;
  //     const y: number = planet.location.coords.y;
  //     const radius: number = Math.sqrt(x ** 2 + y ** 2);

  //     const MAX_LEVEL_DIST = this.contractConstants.MAX_LEVEL_DIST;
  //     if (!(radius > MAX_LEVEL_DIST[1])) {
  //       throw new Error("Player can only spawn at the edge of universe");
  //     }
  //     const spaceType = this.spaceTypeFromPerlin(
  //       planet.perlin,
  //       Math.floor(Math.sqrt(x * x + y * y)),
  //     );

  //     if (spaceType !== SpaceType.NEBULA) {
  //       throw new Error("Only NEBULA");
  //     }

  //     // const INIT_PERLIN_MIN = this.contractConstants.INIT_PERLIN_MIN;

  //     // if (planet.perlin >= INIT_PERLIN_MIN) {
  //     //   throw new Error('Init not allowed in perlin value less than INIT_PERLIN_MIN');
  //     // }

  //     //player requirements
  //     const player = this.players.get(this.account);
  //     if (!player) {
  //       throw new Error("no player");
  //     }
  //     const MAX_BUY_PLANET_AMOUNT = 6;
  //     if (player.buyPlanetAmount >= MAX_BUY_PLANET_AMOUNT) {
  //       throw new Error("buy planet amount limit");
  //     }

  //     // price requirements
  //     const balanceEth = this.getMyBalanceEth();
  //     const halfPrice = this.getHalfPrice();
  //     const planetCostEth = halfPrice
  //       ? 0.5 * 0.003 * 2 ** player.buyPlanetAmount
  //       : 0.003 * 2 ** player.buyPlanetAmount;
  //     if (balanceEth < planetCostEth) {
  //       throw new Error("you don't have enough ETH");
  //     }

  //     if (planet.transactions?.hasTransaction(isUnconfirmedBuyPlanetTx)) {
  //       // transaction requirements
  //       throw new Error("you're already buying this planet");
  //     }
  //     if (
  //       this.entityStore.transactions.hasTransaction(isUnconfirmedBuyPlanetTx)
  //     ) {
  //       throw new Error("you're already buying this planet");
  //     }

  //     const getArgs = async () => {
  //       const args = await this.snarkHelper.getInitArgs(
  //         planet.location.coords.x,
  //         planet.location.coords.y,
  //         Math.floor(
  //           Math.sqrt(
  //             planet.location.coords.x ** 2 + planet.location.coords.y ** 2,
  //           ),
  //         ) + 1,
  //       );

  //       return args;
  //     };

  //     const txIntent: UnconfirmedBuyPlanet = {
  //       methodName: "buyPlanet",
  //       contract: this.contractsAPI.contract,
  //       locationId: planet.location.hash,
  //       location: planet.location,
  //       args: getArgs(),
  //     };

  //     localStorage.setItem(
  //       `${this.ethConnection.getAddress()?.toLowerCase()}-buyPlanet`,
  //       planetId,
  //     );

  //     // localStorage.setItem(
  //     //   `${this.ethConnection.getAddress()?.toLowerCase()}-buyPlanetAmountBefore`,
  //     //   player.buyPlanetAmount.toString()
  //     // );

  //     localStorage.setItem(
  //       `${this.ethConnection.getAddress()?.toLowerCase()}-halfPrice`,
  //       halfPrice.toString(),
  //     );

  //     localStorage.setItem(
  //       `${this.getAccount()?.toLocaleLowerCase()}-planetCostEth`,
  //       planetCostEth.toString(),
  //     );

  //     const fee_delete = 2 ** player.buyPlanetAmount;

  //     // 0.003 *(2**(num-1)) eth
  //     let fee = bigInt(3_000_000_000_000_000).multiply(fee_delete);
  //     if (halfPrice) {
  //       fee = bigInt(1_500_000_000_000_000).multiply(fee_delete);
  //     }

  //     const tx = await this.contractsAPI.submitTransaction(txIntent, {
  //       value: fee.toString(),
  //     });

  //     return tx;
  //   } catch (e) {
  //     this.getNotificationsManager().txInitError(
  //       "buyPlanet",
  //       (e as Error).message,
  //     );
  //     throw e;
  //   }
  // }

  // public async buySpaceship(
  //   planetId: LocationId,
  // ): Promise<Transaction<UnconfirmedBuySpaceship>> {
  //   try {
  //     if (!this.account) {
  //       throw new Error("no account set");
  //     }
  //     // if (this.checkGameHasEnded()) {
  //     //   throw new Error('game has ended');
  //     // }

  //     const planet = this.entityStore.getPlanetWithId(planetId);

  //     // planet requirements
  //     if (!planet) {
  //       throw new Error("you should know this planet");
  //     }

  //     if (!isLocatable(planet)) {
  //       throw new Error("planet is not Locatable");
  //     }

  //     if (planet.destroyed || planet.frozen) {
  //       throw new Error("planet destoryed / frozen");
  //     }

  //     //player requirements
  //     const player = this.players.get(this.account);
  //     if (!player) {
  //       throw new Error("no player");
  //     }

  //     const halfPrice = this.getHalfPrice();
  //     // price requirements
  //     const balanceEth = this.getMyBalanceEth();
  //     const spaceshipCostEth = halfPrice ? 0.0005 : 0.001;
  //     if (balanceEth < spaceshipCostEth) {
  //       throw new Error("you don't have enough ETH");
  //     }

  //     if (player.buySpaceshipAmount >= 3) {
  //       throw new Error(" you can only buy 3 spaceships");
  //     }

  //     // transaction requirements
  //     if (planet.transactions?.hasTransaction(isUnconfirmedBuySpaceshipTx)) {
  //       throw new Error("you're already buying this planet");
  //     }
  //     if (
  //       this.entityStore.transactions.hasTransaction(
  //         isUnconfirmedBuySpaceshipTx,
  //       )
  //     ) {
  //       throw new Error("you're already buying this planet");
  //     }

  //     const spaceshipType = ArtifactType.ShipWhale;

  //     const txIntent: UnconfirmedBuySpaceship = {
  //       methodName: "buySpaceship",
  //       contract: this.contractsAPI.contract,
  //       locationId: planet.location.hash,
  //       location: planet.location,
  //       args: Promise.resolve([locationIdToDecStr(planetId), spaceshipType]),
  //     };

  //     let fee = bigInt(1_000_000_000_000_000).toString(); //0.001 eth
  //     if (halfPrice) {
  //       fee = bigInt(500_000_000_000_000).toString();
  //     }

  //     localStorage.setItem(
  //       `${this.ethConnection.getAddress()?.toLowerCase()}-buySpaceshipOnPlanetId`,
  //       planetId,
  //     );
  //     localStorage.setItem(
  //       `${this.ethConnection.getAddress()?.toLowerCase()}-halfPrice`,
  //       halfPrice.toString(),
  //     );

  //     const tx = await this.contractsAPI.submitTransaction(txIntent, {
  //       value: fee, //0.001 eth
  //     });

  //     return tx;
  //   } catch (e) {
  //     this.getNotificationsManager().txInitError(
  //       "buySpaceship",
  //       (e as Error).message,
  //     );
  //     throw e;
  //   }
  // }

  public async donate(amount: number): Promise<Transaction<UnconfirmedDonate>> {
    try {
      if (!this.account) {
        throw new Error("no account set");
      }
      // if (this.checkGameHasEnded()) {
      //   throw new Error('game has ended');
      // }

      //player requirements
      const player = this.players.get(this.account);
      if (!player) {
        throw new Error("no player");
      }

      // price requirements
      const balanceEth = this.getMyBalanceEth();
      const donationCostEth = amount * 0.001;
      if (balanceEth < donationCostEth) {
        throw new Error("you don't have enough ETH");
      }

      // transaction requirements
      if (this.entityStore.transactions.hasTransaction(isUnconfirmedDonateTx)) {
        throw new Error("you're donating");
      }

      const txIntent: UnconfirmedDonate = {
        methodName: "donate",
        contract: this.contractsAPI.contract,
        amount: amount,
        args: Promise.resolve([amount]),
      };

      const fee = bigInt(1_000_000_000_000_000).multiply(amount).toString();

      localStorage.setItem(
        `${this.ethConnection.getAddress()?.toLowerCase()}-donateAmount`,
        amount.toString(),
      );
      const tx = await this.contractsAPI.submitTransaction(txIntent, {
        value: fee,
      });
      return tx;
    } catch (e) {
      this.getNotificationsManager().txInitError(
        "donate",
        (e as Error).message,
      );
      throw e;
    }
  }

  // TODO: Change this to transferPlanet in a breaking release
  public async transferOwnership(
    planetId: LocationId,
    newOwner: EthAddress,
    bypassChecks = false,
  ): Promise<Transaction<UnconfirmedPlanetTransfer>> {
    try {
      if (!bypassChecks) {
        // if (this.checkGameHasEnded()) {
        //   throw new Error('game has ended');
        // }
        const planetLoc = this.entityStore.getLocationOfPlanet(planetId);
        if (!planetLoc) {
          console.error("planet not found");
          throw new Error("[TX ERROR] Planet not found");
        }
        const planet = this.entityStore.getPlanetWithLocation(planetLoc);
        if (!planet) {
          console.error("planet not found");
          throw new Error("[TX ERROR] Planet not found");
        }
      }

      localStorage.setItem(
        `${this.ethConnection.getAddress()?.toLowerCase()}-transferPlanet`,
        planetId,
      );
      localStorage.setItem(
        `${this.ethConnection.getAddress()?.toLowerCase()}-transferOwner`,
        newOwner,
      );

      const txIntent: UnconfirmedPlanetTransfer = {
        methodName: "transferPlanet",
        contract: this.contractsAPI.contract,
        args: Promise.resolve([locationIdToDecStr(planetId), newOwner]),
        planetId,
        newOwner,
      };

      // Always await the submitTransaction so we can catch rejections
      const tx = await this.contractsAPI.submitTransaction(txIntent);

      return tx;
    } catch (e) {
      this.getNotificationsManager().txInitError(
        "transferPlanet",
        (e as Error).message,
      );
      throw e;
    }
  }

  // NOTE: get claimRoundEndReward back
  // /**
  //  * Receive XDAI for the claiming player based on their score rank at the end of the round.
  //  */
  // async claimRoundEndReward(bypassChecks = false): Promise<Transaction<UnconfirmedClaimReward>> {
  //   try {
  //     if (!bypassChecks) {
  //       if (!this.checkGameHasEnded()) {
  //         throw new Error('game has not ended');
  //       }
  //     }

  //     const allPlayers = await this.contractsAPI.getPlayers();
  //     const sortedPlayers = Array.from(allPlayers.values()).sort((a, b) => b.score - a.score);
  //     const sortedPlayerAddresses = sortedPlayers.map((p) => p.address);
  //     const sortedScores = sortedPlayers.map((p) => p.score);

  //     const txIntent: UnconfirmedClaimReward = {
  //       methodName: 'claimReward',
  //       contract: this.contractsAPI.contract,
  //       args: Promise.resolve([sortedPlayerAddresses, sortedScores]),
  //       sortedPlayerAddresses,
  //       sortedScores,
  //     };

  //     // Always await the submitTransaction so we can catch rejections
  //     const tx = await this.contractsAPI.submitTransaction(txIntent);

  //     return tx;
  //   } catch (e) {
  //     this.getNotificationsManager().txInitError('claimReward', (e as Error).message);
  //     throw e;
  //   }
  // }

  /**
   * Makes this game manager aware of a new chunk - which includes its location, size,
   * as well as all of the planets contained in that chunk. Causes the client to load
   * all of the information about those planets from the blockchain.
   */
  addNewChunk(chunk: Chunk): GameManager {
    this.persistentChunkStore.addChunk(chunk, true);
    for (const planetLocation of chunk.planetLocations) {
      this.entityStore.addPlanetLocation(planetLocation);

      if (this.entityStore.isPlanetInContract(planetLocation.hash)) {
        this.hardRefreshPlanet(planetLocation.hash); // don't need to await, just start the process of hard refreshing
      }
    }
    return this;
  }

  /**
   * Removes a chunk from the game manager's awareness - which includes its location, size,
   * and all planets contained within that chunk. This does not delete the planets' data
   * from the blockchain, only from the client's local storage.
   */
  deleteChunk(chunk: Chunk): GameManager {
    // Remove chunk from persistent storage
    this.persistentChunkStore.deleteChunk(chunk, true);

    // Remove planet locations from entity store
    for (const planetLocation of chunk.planetLocations) {
      this.entityStore.deletePlanetLocation(planetLocation);

      // PUNK TODO: think about this
      // If the planet exists in contract, we might want to keep its data
      // but mark it as not discovered/visible
      // if (this.entityStore.isPlanetInContract(planetLocation.hash)) {
      //   this.entityStore.markPlanetNotDiscovered(planetLocation.hash);
      // }
    }

    return this;
  }

  // listenForNewBlock() {
  //   this.getEthConnection().blockNumber$.subscribe((blockNumber) => {
  //     if (this.captureZoneGenerator) {
  //       this.captureZoneGenerator.generate(blockNumber);
  //     }
  //   });
  // }

  /**
   * To add multiple chunks at once, use this function rather than `addNewChunk`, in order
   * to load all of the associated planet data in an efficient manner.
   */
  async bulkAddNewChunks(chunks: Chunk[]): Promise<void> {
    this.terminal.current?.println(
      "IMPORTING MAP: if you are importing a large map, this may take a while...",
    );
    const planetIdsToUpdate: LocationId[] = [];
    for (const chunk of chunks) {
      this.persistentChunkStore.addChunk(chunk, true);
      for (const planetLocation of chunk.planetLocations) {
        this.entityStore.addPlanetLocation(planetLocation);

        if (this.entityStore.isPlanetInContract(planetLocation.hash)) {
          // Await this so we don't crash the game
          planetIdsToUpdate.push(planetLocation.hash);
        }
      }
    }
    this.terminal.current?.println(
      `downloading data for ${planetIdsToUpdate.length} planets...`,
      TerminalTextStyle.Sub,
    );
    this.bulkHardRefreshPlanets(planetIdsToUpdate);
  }

  /**
   * To delete multiple chunks at once, use this function rather than `deleteChunk`, in order
   * to handle all of the associated planet data cleanup in an efficient manner.
   */
  async bulkDeleteChunks(chunks: Chunk[]): Promise<void> {
    this.terminal.current?.println(
      "DELETING CHUNKS: if you are deleting a large area, this may take a while...",
    );

    const planetIdsToUpdate: LocationId[] = [];

    // First pass: collect all planet IDs and remove chunks
    for (const chunk of chunks) {
      this.persistentChunkStore.deleteChunk(chunk, true);

      for (const planetLocation of chunk.planetLocations) {
        this.entityStore.deletePlanetLocation(planetLocation);
        // if (this.entityStore.isPlanetInContract(planetLocation.hash)) {
        //   // For planets in contract, we'll update their visibility status
        //   planetIdsToUpdate.push(planetLocation.hash);
        // }
      }
    }

    if (planetIdsToUpdate.length > 0) {
      this.terminal.current?.println(
        `updating visibility for ${planetIdsToUpdate.length} planets...`,
        TerminalTextStyle.Sub,
      );
    }

    // Update game state and UI
    this.terminal.current?.println(
      `successfully deleted ${chunks.length} chunks...`,
      TerminalTextStyle.Sub,
    );

    // this.bulkHardRefreshPlanets(planetIdsToUpdate);
  }

  // utils - scripting only

  /**
   * Gets the maximuim distance that you can send your energy from the given planet,
   * using the given percentage of that planet's current silver.
   */
  getMaxMoveDist(
    planetId: LocationId,
    sendingPercent: number,
    abandoning: boolean,
  ): number {
    const planet = this.getPlanetWithId(planetId);
    if (!planet) {
      throw new Error("origin planet unknown");
    }
    return getRange(planet, sendingPercent, this.getRangeBuff(abandoning));
  }

  /**
   * Gets the distance between two planets. Throws an exception if you don't
   * know the location of either planet. Takes into account links.
   */
  getDist(fromId: LocationId, toId: LocationId): number {
    const planetFrom = this.entityStore.getPlanetWithId(fromId);
    if (!isLocatable(planetFrom)) {
      throw new Error(
        `origin planet not locatable (fromId: ${fromId}) (locationId: ${planetFrom?.locationId})`,
      );
    }

    const planetTo = this.entityStore.getPlanetWithId(toId);
    if (!isLocatable(planetTo)) {
      throw new Error(
        `origin planet not locatable (toId: ${fromId}) (locationId: ${planetTo?.locationId})`,
      );
    }

    const { DistanceMultiplier } = this.components;
    const [left, right] =
      BigInt(locationIdToDecStr(fromId)) < BigInt(locationIdToDecStr(toId))
        ? [fromId, toId]
        : [toId, fromId];

    const key = encodeEntity(DistanceMultiplier.metadata.keySchema, {
      from: locationIdToHexStr(left) as `0x${string}`,
      to: locationIdToHexStr(right) as `0x${string}`,
    });
    const value = getComponentValue(DistanceMultiplier, key);

    const distance = this.getDistCoords(
      planetFrom.location.coords,
      planetTo.location.coords,
    );
    const distanceFactor = value ? value.multiplier / 1000 : 1;

    return distance * distanceFactor;
  }

  /**
   * Gets the distance between two coordinates in space using manhattan geometry
   *
   * @see https://en.wikipedia.org/wiki/Taxicab_geometry
   */
  getDistCoords(fromCoords: WorldCoords, toCoords: WorldCoords) {
    return Math.sqrt(
      (fromCoords.x - toCoords.x) ** 2 + (fromCoords.y - toCoords.y) ** 2,
    );
  }

  /**
   * Gets all the planets that you can reach with at least 1 energy from
   * the given planet. Does not take into account wormholes.
   */
  getPlanetsInRange(
    planetId: LocationId,
    sendingPercent: number,
    abandoning: boolean,
  ): Planet[] {
    const planet = this.entityStore.getPlanetWithId(planetId);
    if (!planet) {
      throw new Error("planet unknown");
    }
    if (!isLocatable(planet)) {
      throw new Error("planet location unknown");
    }

    // Performance improvements originally suggested by [@modokon](https://github.com/modukon)
    // at https://github.com/darkforest-eth/client/issues/15
    // Improved by using `planetMap` by [@phated](https://github.com/phated)
    const result = [];
    const range = getRange(
      planet,
      sendingPercent,
      this.getRangeBuff(abandoning),
    );
    for (const p of this.getPlanetMap().values()) {
      if (isLocatable(p)) {
        if (
          this.getDistCoords(planet.location.coords, p.location.coords) < range
        ) {
          result.push(p);
        }
      }
    }

    return result;
  }

  /**
   * Gets the amount of energy needed in order for a voyage from the given to the given
   * planet to arrive with your desired amount of energy.
   */
  getEnergyNeededForMove(
    fromId: LocationId,
    toId: LocationId,
    arrivingEnergy: number,
    abandoning = false,
    upgrade: Upgrade = {
      energyCapMultiplier: 100,
      energyGroMultiplier: 100,
      rangeMultiplier: 100,
      speedMultiplier: 100,
      defMultiplier: 100,
    },
  ): number {
    const from = this.getPlanetWithId(fromId);
    if (!from) {
      throw new Error("origin planet unknown");
    }
    const upgradedPlanet = {
      ...from,
      range: (from.range * upgrade.rangeMultiplier) / 100,
      energyCap: (from.energyCap * upgrade.energyCapMultiplier) / 100,
    };
    const dist = this.getDist(fromId, toId);
    const range = upgradedPlanet.range * this.getRangeBuff(abandoning);
    const rangeSteps = dist / range;

    const arrivingProp = arrivingEnergy / upgradedPlanet.energyCap + 0.05;

    return arrivingProp * Math.pow(2, rangeSteps) * upgradedPlanet.energyCap;
  }

  /**
   * Gets the amount of energy that would arrive if a voyage with the given parameters
   * was to occur. The toPlanet is optional, in case you want an estimate that doesn't include
   * wormhole speedups.
   */
  getEnergyArrivingForMove(
    fromId: LocationId,
    toId: LocationId | undefined,
    distance: number | undefined,
    sentEnergy: number,
    abandoning: boolean,
  ) {
    const from = this.getPlanetWithId(fromId);
    const to = this.getPlanetWithId(toId);

    if (!from) {
      throw new Error(`unknown planet`);
    }
    if (distance === undefined && toId === undefined) {
      throw new Error(`you must provide either a target planet or a distance`);
    }

    const dist = (toId && this.getDist(fromId, toId)) || (distance as number);

    // if (to && toId) {
    //   const wormholeFactors = this.getWormholeFactors(from, to);
    //   if (wormholeFactors !== undefined) {
    //     if (to.owner !== from.owner) {
    //       return 0;
    //     }
    //   }
    // }

    const range = from.range * this.getRangeBuff(abandoning);
    const scale = (1 / 2) ** (dist / range);
    let ret = scale * sentEnergy - 0.05 * from.energyCap;
    if (ret < 0) {
      ret = 0;
    }

    return ret;
  }

  /**
   * Gets the active artifact on this planet, if one exists.
   */
  getActiveArtifacts(planet: Planet): Artifact[] {
    const artifacts = this.getArtifactsWithIds(planet.heldArtifactIds);
    const active = artifacts.filter((a) => a && isActivated(a)) as Artifact[];

    return active;
  }

  /**
   * If there's an active artifact on either of these planets which happens to be a wormhole which
   * is active and targetting the other planet, return the wormhole boost which is greater. Values
   * represent a multiplier.
   */
  // getWormholeFactors(
  //   fromPlanet: Planet,
  //   toPlanet: Planet,
  // ): { distanceFactor: number; speedFactor: number } | undefined {
  //   const fromActiveArtifact = this.getActiveArtifact(fromPlanet);
  //   const toActiveArtifact = this.getActiveArtifact(toPlanet);

  //   const fromHasActiveWormhole =
  //     fromActiveArtifact?.artifactType === ArtifactType.Wormhole &&
  //     fromActiveArtifact.linkTo === toPlanet.locationId;
  //   const toHasActiveWormhole =
  //     toActiveArtifact?.artifactType === ArtifactType.Wormhole &&
  //     toActiveArtifact.linkTo === fromPlanet.locationId;

  //   let greaterRarity: ArtifactRarity | undefined = undefined;
  //   switch (true) {
  //     // active wormhole on both from and to planets choose the biggest rarity
  //     case fromHasActiveWormhole && toHasActiveWormhole: {
  //       greaterRarity = Math.max(
  //         fromActiveArtifact.rarity,
  //         toActiveArtifact.rarity,
  //       ) as ArtifactRarity;
  //       break;
  //     }
  //     // only from planet has active wormhole, use that one

  //     case fromHasActiveWormhole: {
  //       greaterRarity = fromActiveArtifact.rarity;
  //       break;
  //     }
  //     // only destination planet has active wormhole, use that one
  //     case toHasActiveWormhole: {
  //       greaterRarity = toActiveArtifact.rarity;
  //       break;
  //     }
  //   }

  //   if (
  //     greaterRarity === undefined ||
  //     greaterRarity <= ArtifactRarity.Unknown
  //   ) {
  //     return undefined;
  //   }

  //   const rangeUpgradesPerRarity = [0, 2, 4, 6, 8, 10];
  //   const speedUpgradesPerRarity = [0, 10, 20, 30, 40, 50];
  //   return {
  //     distanceFactor: rangeUpgradesPerRarity[greaterRarity],
  //     speedFactor: speedUpgradesPerRarity[greaterRarity],
  //   };
  // }

  /**
   * Gets the amount of time, in seconds that a voyage between from the first to the
   * second planet would take.
   */
  getTimeForMove(
    fromId: LocationId,
    toId: LocationId,
    abandoning = false,
  ): number {
    const from = this.getPlanetWithId(fromId);
    if (!isLocatable(from)) {
      throw new Error(`Could not find planet from (fromId: ${fromId})`);
    }

    const to = this.getPlanetWithId(toId);
    if (!isLocatable(to)) {
      throw new Error(`Could not find planet to (toId: ${to})`);
    }

    // NOTE: The get distance will throw if both the fromId and toId planets are not located.
    const dist = this.getDist(fromId, toId);

    // NOTE: The speed factor will always be 1 when SPACE_JUNK_ENABLED=false
    const speedFactor = this.getSpeedBuff(abandoning);
    const speed = from.speed * speedFactor;

    let deltaTime = dist / (speed / 100);

    // NOTE: We have disabled the change the photoid travel time in seconds here
    // all photoid travel same time
    // if (this.getActiveArtifact(from)?.artifactType === ArtifactType.PhotoidCannon:) {
    //     deltaTime = 600;
    // }

    // Destination planet is a silver bank, we travel twice as fast to these.
    if (to.planetType === PlanetType.SILVER_BANK) {
      deltaTime = deltaTime / 2;
    }

    const tickerRate = this.getCurrentTickerRate();

    return deltaTime / tickerRate;
  }

  /**
   * Gets the temperature of a given location.
   */
  getTemperature(coords: WorldCoords): number {
    const p = this.spaceTypePerlin(coords, false);
    return (16 - p) * 16;
  }

  /**
   * Load the serialized versions of all the plugins that this player has.
   */
  public async loadPlugins(): Promise<SerializedPlugin[]> {
    return this.persistentChunkStore.loadPlugins();
  }

  /**
   * Overwrites all the saved plugins to equal the given array of plugins.
   */
  public async savePlugins(savedPlugins: SerializedPlugin[]): Promise<void> {
    await this.persistentChunkStore.savePlugins(savedPlugins);
  }

  /**
   * Whether or not the given planet is capable of minting an artifact.
   */
  public isPlanetMineable(p: Planet): boolean {
    return p.planetType === PlanetType.RUINS;
  }

  /**
   * Returns constructors of classes that may be useful for developing plugins.
   */

  public getConstructors() {
    return {
      MinerManager,
      SpiralPattern,
      SwissCheesePattern,
      TowardsCenterPattern,
      TowardsCenterPatternV2,
    };
  }

  /**
   * Gets the perlin value at the given location in the world. SpaceType is based
   * on this value.
   */
  public spaceTypePerlin(coords: WorldCoords, floor: boolean): number {
    return perlin(coords, {
      key: this.hashConfig.spaceTypeKey,
      scale: this.hashConfig.perlinLengthScale,
      mirrorX: this.hashConfig.perlinMirrorX,
      mirrorY: this.hashConfig.perlinMirrorY,
      floor,
    });
  }

  /**
   * Gets the biome perlin valie at the given location in the world.
   */
  public biomebasePerlin(coords: WorldCoords, floor: boolean): number {
    return perlin(coords, {
      key: this.hashConfig.biomebaseKey,
      scale: this.hashConfig.perlinLengthScale,
      mirrorX: this.hashConfig.perlinMirrorX,
      mirrorY: this.hashConfig.perlinMirrorY,
      floor,
    });
  }

  public locationBigIntFromCoords(coords: WorldCoords): BigInteger {
    return this.planetHashMimc(coords.x, coords.y);
  }

  /**
   * Helpful for listening to user input events.
   */
  public getUIEventEmitter() {
    return UIEmitter.getInstance();
  }

  // public getCaptureZoneGenerator() {
  //   return this.captureZoneGenerator;
  // }

  /**
   * Emits when new capture zones are generated.
   */
  // public get captureZoneGeneratedEmitter():
  //   | Monomitter<CaptureZonesGeneratedEvent>
  //   | undefined {
  //   return this.captureZoneGenerator?.generated$;
  // }

  public getNotificationsManager() {
    return NotificationManager.getInstance();
  }

  getLinks(): Iterable<Link> {
    return this.entityStore.getLinks();
  }

  /** Return a reference to the planet map */
  public getPlanetMap(): Map<LocationId, Planet> {
    return this.entityStore.getPlanetMap();
  }

  /** Return a reference to the artifact map */
  public getArtifactMap(): Map<ArtifactId, Artifact> {
    return this.entityStore.getArtifactMap();
  }

  /** Return a reference to the map of my planets */
  public getMyPlanetMap(): Map<LocationId, Planet> {
    return this.entityStore.getMyPlanetMap();
  }

  /** Return a reference to the map of my artifacts */
  public getMyArtifactMap(): Map<ArtifactId, Artifact> {
    return this.entityStore.getMyArtifactMap();
  }

  public getPlanetUpdated$(): Monomitter<LocationId> {
    return this.entityStore.planetUpdated$;
  }

  public getArtifactUpdated$(): Monomitter<ArtifactId> {
    return this.entityStore.artifactUpdated$;
  }

  public getMyPlanetsUpdated$(): Monomitter<Map<LocationId, Planet>> {
    return this.entityStore.myPlanetsUpdated$;
  }

  public getMyArtifactsUpdated$(): Monomitter<Map<ArtifactId, Artifact>> {
    return this.entityStore.myArtifactsUpdated$;
  }

  /**
   * Returns an instance of a `Contract` from the ethersjs library. This is the library we use to
   * connect to the blockchain. For documentation about how `Contract` works, see:
   * https://docs.ethers.io/v5/api/contract/contract/
   *
   * Also, registers your contract in the system to make calls against it and to reload it when
   * necessary (such as the RPC endpoint changing).
   */
  public loadContract<T extends Contract>(
    contractAddress: string,
    contractABI: ContractInterface,
  ): Promise<T> {
    return this.ethConnection.loadContract(
      contractAddress,
      async (address, provider, signer) =>
        createContract<T>(address, contractABI, provider, signer),
    );
  }

  public testNotification() {
    NotificationManager.getInstance().reallyLongNotification();
  }

  /**
   * Gets a reference to the game's internal representation of the world state. This includes
   * voyages, planets, artifacts, and active links,
   */
  public getGameObjects(): GameObjects {
    return this.entityStore;
  }

  public forceTick(locationId: LocationId) {
    this.getGameObjects().forceTick(locationId);
  }

  /**
   * Gets some diagnostic information about the game. Returns a copy, you can't modify it.
   */
  public getDiagnostics(): Diagnostics {
    return { ...this.diagnostics };
  }

  /**
   * Updates the diagnostic info of the game using the supplied function. Ideally, each spot in the
   * codebase that would like to record a metric is able to update its specific metric in a
   * convenient manner.
   */
  public updateDiagnostics(updateFn: (d: Diagnostics) => void): void {
    updateFn(this.diagnostics);
  }

  /**
   * Listen for changes to a planet take action,
   * eg.
   * waitForPlanet("yourAsteroidId", ({current}) => current.silverCap / current.silver > 90)
   * .then(() => {
   *  // Send Silver to nearby planet
   * })
   *
   * @param locationId A locationId to watch for updates
   * @param predicate a function that accepts a Diff and should return a truth-y value, value will be passed to promise.resolve()
   * @returns a promise that will resolve with results returned from the predicate function
   */
  public waitForPlanet<T>(
    locationId: LocationId,
    predicate: ({ current, previous }: Diff<Planet>) => T | undefined,
  ): Promise<T> {
    const disposableEmitter = getDisposableEmitter<Planet, LocationId>(
      this.getPlanetMap(),
      locationId,
      this.getPlanetUpdated$(),
    );
    const diffEmitter = generateDiffEmitter(disposableEmitter);

    return new Promise((resolve, reject) => {
      diffEmitter.subscribe((data: Diff<Planet> | undefined) => {
        try {
          if (data) {
            // check if data is undefined
            const { current, previous } = data;
            const predicateResults = predicate({ current, previous });
            if (predicateResults) {
              disposableEmitter.clear();
              diffEmitter.clear();
              resolve(predicateResults);
            }
          }
        } catch (err) {
          disposableEmitter.clear();
          diffEmitter.clear();
          reject(err);
        }
      });
    });

    // return new Promise((resolve, reject) => {
    //   diffEmitter.subscribe(({ current, previous }: Diff<Planet>) => {
    //     try {
    //       const predicateResults = predicate({ current, previous });
    //       if (predicateResults) {
    //         disposableEmitter.clear();
    //         diffEmitter.clear();
    //         resolve(predicateResults);
    //       }
    //     } catch (err) {
    //       disposableEmitter.clear();
    //       diffEmitter.clear();
    //       reject(err);
    //     }
    //   });
    // });
  }

  public getSafeMode() {
    return this.safeMode;
  }

  public setSafeMode(safeMode: boolean) {
    this.safeMode = safeMode;
  }

  public getAddress() {
    return this.ethConnection.getAddress();
  }

  public isAdmin(): boolean {
    return this.getAccount() === this.contractConstants.adminAddress;
  }

  /**
   * Right now the only buffs supported in this way are
   * speed/range buffs from Abandoning a planet.
   *
   * The abandoning argument is used when interacting with
   * this function programmatically.
   */
  public getSpeedBuff(abandoning: boolean): number {
    // const { SPACE_JUNK_ENABLED, ABANDON_SPEED_CHANGE_PERCENT } =
    //   this.contractConstants;
    // if (SPACE_JUNK_ENABLED && abandoning) {
    //   return ABANDON_SPEED_CHANGE_PERCENT / 100;
    // }

    return 1;
  }

  public getRangeBuff(abandoning: boolean): number {
    // const { SPACE_JUNK_ENABLED, ABANDON_RANGE_CHANGE_PERCENT } =
    //   this.contractConstants;
    // if (SPACE_JUNK_ENABLED && abandoning) {
    //   return ABANDON_RANGE_CHANGE_PERCENT / 100;
    // }

    return 1;
  }

  public getSnarkHelper(): SnarkArgsHelper {
    return this.snarkHelper;
  }

  public async submitTransaction<T extends TxIntent>(
    txIntent: T,
    overrides?: providers.TransactionRequest,
  ): Promise<Transaction<T>> {
    return this.contractsAPI.submitTransaction(txIntent, overrides);
  }

  public getContract() {
    return this.contractsAPI.contract;
  }

  public getPaused(): boolean {
    return this.paused;
  }

  public setPaused(paused: boolean) {
    this.paused = paused;
    this.paused$.publish(paused);
  }

  public getPaused$(): Monomitter<boolean> {
    return this.paused$;
  }

  public async buyGPTTokens(
    amount: number,
  ): Promise<Transaction<UnconfirmedBuyGPTTokens>> {
    try {
      if (!this.account) {
        throw new Error("No account connected");
      }
      if (amount <= 0) {
        throw new Error("Amount to buy must be greater than 0");
      }

      const delegator = this.getAccount();
      if (!delegator) {
        throw new Error("No main account found");
      }

      localStorage.setItem(
        `${this.ethConnection.getAddress()?.toLowerCase()}-buyGPTTokens-amount`,
        amount.toString(),
      );

      const txIntent: UnconfirmedBuyGPTTokens = {
        delegator,
        methodName: "df__buyGPTTokens",
        contract: this.contractsAPI.contract,
        args: Promise.resolve([amount]),
        amount,
      };

      const price = BigInt(10_000_000_000_000);
      const value = price * BigInt(amount);
      const tx = await this.contractsAPI.submitTransaction(txIntent, {
        //  NOTE: when change gasLimit, need change the value in TxConfirmPopup.tsx
        //
        //  halfPrice
        // ? bigInt(500_000_000_000_000).toString()
        // : bigInt(1_000_000_000_000_000).toString(), //0.001eth
        gasLimit: 3000000,
        value: value.toString(), //0.0000 5eth
      });
      return tx;
    } catch (e) {
      this.getNotificationsManager().txInitError(
        "df__buyGPTTokens",
        (e as Error).message,
      );
      throw e;
    }
  }

  public async spendGPTTokens(
    amount: number,
  ): Promise<Transaction<UnconfirmedSpendGPTTokens>> {
    try {
      if (!this.account) {
        throw new Error("No account connected");
      }

      const delegator = this.getAccount();
      if (!delegator) {
        throw new Error("No main account found");
      }

      const txIntent: UnconfirmedSpendGPTTokens = {
        delegator,
        methodName: "df__spendGPTTokens",
        contract: this.contractsAPI.contract,
        args: Promise.resolve([amount]),
        amount,
      };

      const tx = await this.contractsAPI.submitTransaction(txIntent);
      return tx;
    } catch (e) {
      this.getNotificationsManager().txInitError(
        "df__spendGPTTokens",
        (e as Error).message,
      );
      throw e;
    }
  }

  public async sendGPTTokens(
    player: EthAddress,
    amount: number,
  ): Promise<Transaction<UnconfirmedSendGPTTokens>> {
    try {
      if (!this.account) {
        throw new Error("No account connected");
      }
      if (!player) {
        throw new Error("Player address is required");
      }
      if (amount <= 0) {
        throw new Error("Amount to send must be greater than 0");
      }

      const delegator = this.getAccount();
      if (!delegator) {
        throw new Error("No main account found");
      }

      const txIntent: UnconfirmedSendGPTTokens = {
        delegator,
        methodName: "df__sendGPTTokens",
        contract: this.contractsAPI.contract,
        args: Promise.resolve([player, amount]),
        player,
        amount,
      };

      const tx = await this.contractsAPI.submitTransaction(txIntent);
      return tx;
    } catch (e) {
      this.getNotificationsManager().txInitError(
        "df__sendGPTTokens",
        (e as Error).message,
      );
      throw e;
    }
  }

  // public getHalfPrice(): boolean {
  //   return this.halfPrice;
  // }

  // public getHalfPrice$(): Monomitter<boolean> {
  //   return this.halfPrice$;
  // }

  // Guild Stuff

  public getGuild(guildId?: GuildId): Guild | undefined {
    return this.contractsAPI.getGuildUtils().getGuildById(guildId);
  }

  public getPlayerGuildId(addr: EthAddress): GuildId | undefined {
    return this.contractsAPI.getGuildUtils().getGuildIdByPlayer(addr);
  }

  public getAllGuildIds(): GuildId[] {
    return this.contractsAPI.getGuildUtils().getGuildIds();
  }

  public getNextGuildId(): GuildId {
    const guildIds = this.contractsAPI.getGuildUtils().getGuildIds();
    const result: GuildId = (guildIds.length + 1) as GuildId;
    return result;
  }

  public getAllGuilds(): Guild[] {
    const guildIds = this.contractsAPI.getGuildUtils().getGuildIds();
    const res: Guild[] = [];

    for (let i = 0; i < guildIds.length; i++) {
      const guildId = guildIds[i];
      const guild = this.getGuild(guildId);
      if (!guild) continue;
      if (guild.status !== GuildStatus.ACTIVE) continue;
      res.push(guild);
    }
    return res;
  }

  public getGuildRole(addr: EthAddress) {
    return this.contractsAPI.getGuildUtils().getGuildRole(addr);
  }

  public getPlayerGrant(addr: EthAddress) {
    return this.contractsAPI.getGuildUtils().getPlayerGrant(addr);
  }

  public getGrantedAddresses(account: EthAddress) {
    const guildId = this.getPlayerGuildId(account);
    if (!guildId) return [];

    const guild = this.getGuild(guildId);
    if (!guild) return [];

    if (!account) return [];

    const grant = this.getPlayerGrant(account);

    if (grant === GuildRole.NONE) return [];

    const result = [];

    for (let i = 0; i < guild.members.length; i++) {
      const member = guild.members[i];
      const role = this.getGuildRole(member);

      if (grant === GuildRole.NONE) continue;

      if (grant === GuildRole.MEMBER) {
        result.push(member);
      } else if (grant === GuildRole.OFFICER) {
        if (role === GuildRole.OFFICER || role === GuildRole.LEADER) {
          result.push(member);
        }
      } else if (grant === GuildRole.LEADER) {
        if (role === GuildRole.LEADER) {
          result.push(member);
        }
      }
    }

    return result;
  }

  public getAuthorizedByAddresses(account: EthAddress) {
    const guildId = this.getPlayerGuildId(account);
    if (!guildId) return [];
    const guild = this.getGuild(guildId);
    if (!guild) return [];
    if (!account) return [];

    const role = this.getGuildRole(account);

    const result = [];

    for (let i = 0; i < guild.members.length; i++) {
      const member = guild.members[i];
      const grant = this.getPlayerGrant(member);

      if (grant === GuildRole.NONE) continue;

      if (grant === GuildRole.MEMBER) {
        result.push(member);
      } else if (grant === GuildRole.OFFICER) {
        if (role === GuildRole.OFFICER || role === GuildRole.LEADER) {
          result.push(member);
        }
      } else if (grant === GuildRole.LEADER) {
        if (role === GuildRole.LEADER) {
          result.push(member);
        }
      }
    }

    return result;
  }

  public checkDelegateCondition(delegator?: EthAddress, delegate?: EthAddress) {
    if (!delegator || !delegate) return false;
    return this.contractsAPI
      .getGuildUtils()
      .checkDelegateCondition(delegator, delegate);
  }

  public getPlayerGuildIdAtTick(
    player: EthAddress,
    tick: number,
  ): GuildId | undefined {
    return this.contractsAPI
      .getGuildUtils()
      .getPlayerGuildIdAtTick(player, tick);
  }

  public inSameGuildAtTick(
    player1: EthAddress,
    player2: EthAddress,
    tick: number,
  ) {
    return this.contractsAPI
      .getGuildUtils()
      .inSameGuildAtTick(player1, player2, tick);
  }

  public inSameGuildRightNow(
    player1?: EthAddress,
    player2?: EthAddress,
  ): boolean {
    if (!player1 || !player2) return false;
    return this.contractsAPI
      .getGuildUtils()
      .inSameGuildRightNow(player1, player2);
  }

  public getGuildRejoinCooldownTicks(): number {
    return this.contractsAPI.getGuildUtils().getGuildRejoinCooldownTicks();
  }

  public getGuildRejoinCooldownTime(): number {
    const cooldownTicks = this.getGuildRejoinCooldownTicks();
    return Math.ceil(cooldownTicks / this.getCurrentTickerRate());
  }

  public timeUntilNextApplyGuildAvaiable(_account?: EthAddress) {
    const account = _account ?? this.account;
    if (!account) {
      throw new Error("no account set");
    }

    const myLastLeaveGuildTick = this.contractsAPI
      .getGuildUtils()
      .getPlayerLastLeaveGuildTick(account);

    const myLastLeaveGuildTimestamp = myLastLeaveGuildTick
      ? Math.ceil(this.convertTickToMs(myLastLeaveGuildTick) / 1000)
      : undefined;

    if (!myLastLeaveGuildTimestamp) return 0;

    const cooldownTicks = this.contractsAPI
      .getGuildUtils()
      .getGuildRejoinCooldownTicks();

    const cooldownDuration = Math.ceil(
      cooldownTicks / this.getCurrentTickerRate(),
    );

    return (myLastLeaveGuildTimestamp + cooldownDuration) * 1000 - Date.now();
  }

  public getNextApplyGuildAvailableTimestamp(_account?: EthAddress) {
    const account = _account ?? this.account;
    const _ = this.timeUntilNextApplyGuildAvaiable(account);
    return Date.now() + _;
  }

  public getInitGuilds(): Map<GuildId, Guild> {
    const guildIds = this.contractsAPI.getGuildUtils().getGuildIds();
    const res: Map<GuildId, Guild> = new Map();
    for (let i = 0; i < guildIds.length; i++) {
      const guildId = guildIds[i];
      const guild = this.getGuild(guildId);
      if (!guild) continue;
      res.set(guildId, guild);
    }
    return res;
  }

  public hardRefreshGuild(guildId?: GuildId): void {
    if (!guildId) return;

    const guildFromBlockchain = this.contractsAPI
      .getGuildUtils()
      .getGuildById(guildId);
    if (!guildFromBlockchain) return;

    this.guilds.set(guildId, guildFromBlockchain);

    this.guildsUpdated$.publish();
  }

  public getGuildCreateFee(): number {
    const result = this.contractsAPI.getGuildUtils().getCreateGuildFee();
    if (!result) throw Error("Create Fee Error");
    return Number(result);
  }

  public async createGuild(
    guildName: string,
  ): Promise<Transaction<UnconfirmedCreateGuild>> {
    try {
      if (!this.account) throw new Error("no account");
      const player = this.getPlayer(this.account);
      if (!player) throw new Error("no player");

      const guildId = this.getPlayerGuildId(this.account);
      if (guildId) throw Error("you are already in a guild");

      const unionCreationFee = this.getGuildCreateFee();

      const unionCreationFeeETH = utils.formatEther(unionCreationFee);

      localStorage.setItem(
        `${this.ethConnection.getAddress()?.toLowerCase()}-createGuild-guildName`,
        guildName,
      );

      localStorage.setItem(
        `${this.ethConnection.getAddress()?.toLowerCase()}-createGuild-fee`,
        unionCreationFeeETH.toString(),
      );

      console.log(
        `${this.ethConnection.getAddress()?.toLowerCase()}-createGuild-unionName`,
      );
      console.log(guildName);
      console.log(unionCreationFeeETH);

      const delegator = this.getAccount();
      if (!delegator) {
        throw Error("no main account");
      }

      const txIntent: UnconfirmedCreateGuild = {
        delegator: delegator,
        methodName: "df__createGuild",
        contract: this.contractsAPI.contract,
        args: Promise.resolve([guildName]),
        name: guildName,
        guildId: this.getNextGuildId(),
      };

      const tx = await this.submitTransaction(txIntent, {
        value: unionCreationFee.toString(),
      });

      return tx;
    } catch (e) {
      this.getNotificationsManager().txInitError(
        "df__createGuild",
        (e as Error).message,
      );
      throw e;
    }
  }

  public async inviteToGuild(
    invitee: EthAddress,
  ): Promise<Transaction<UnconfirmedInviteToGuild>> {
    try {
      if (!this.account) throw new Error("no account");
      const player = this.getPlayer(this.account);
      if (!player) throw new Error("no player");
      const inviter = this.account;

      const inviterGuildId = this.getPlayerGuildId(inviter);
      if (!inviterGuildId) throw Error("no inviter guildId");

      const inviterRole = this.contractsAPI
        .getGuildUtils()
        .getGuildRole(inviter);

      if (inviterRole === GuildRole.NONE || inviterRole === GuildRole.MEMBER)
        throw Error("no inviter role");

      const inviteePlayer = this.getPlayer(invitee);
      if (!inviteePlayer) throw Error("no invitee player");

      const invitee_guildId = this.getPlayerGuildId(invitee);

      if (invitee_guildId) throw Error("invitee is already in a guild");

      localStorage.setItem(
        `${this.ethConnection.getAddress()?.toLowerCase()}--inviteToGuild-guildId`,
        inviterGuildId.toString(),
      );

      localStorage.setItem(
        `${this.ethConnection.getAddress()?.toLowerCase()}--inviteToGuild-invitee`,
        invitee.toString(),
      );

      const txIntent: UnconfirmedInviteToGuild = {
        delegator: this.account,
        methodName: "df__inviteToGuild",
        contract: this.contractsAPI.contract,
        args: Promise.resolve([invitee]),
        guildId: inviterGuildId,
        invitee: invitee,
      };

      return await this.submitTransaction(txIntent);
    } catch (e) {
      this.getNotificationsManager().txInitError(
        "df__inviteToGuild",
        (e as Error).message,
      );
      throw e;
    }
  }

  public async acceptInvitation(
    guildId: GuildId,
  ): Promise<Transaction<UnconfirmedAcceptInvitation>> {
    try {
      if (!this.account) throw new Error("no account");
      const player = this.getPlayer(this.account);
      if (!player) throw new Error("no player");

      const playerGuildId = this.getPlayerGuildId(this.account);
      if (playerGuildId) throw Error("you are already in a guild");

      const guild = this.getGuild(guildId);
      if (!guild) throw Error("no guild");
      if (guild.status !== GuildStatus.ACTIVE)
        throw Error("guild is not active");

      const maxMembers = this.contractsAPI.getGuildUtils().getMaxGuildMembers();
      if (!maxMembers) throw Error("no max members");
      if (guild.number >= maxMembers) {
        throw Error("guild member limit reached");
      }

      const isInvited = this.contractsAPI
        .getGuildUtils()
        .isInvitedToGuild(this.account, guildId);
      if (!isInvited) throw Error("you are not invited to this guild");

      const isOnLeaveCooldown = this.contractsAPI
        .getGuildUtils()
        .checkGuildLeaveCooldown(this.account);
      if (!isOnLeaveCooldown) throw Error("you are on leave cooldown");

      localStorage.setItem(
        `${this.ethConnection.getAddress()?.toLowerCase()}---acceptInvitation-guildId`,
        guildId.toString(),
      );

      const txIntent: UnconfirmedAcceptInvitation = {
        delegator: this.account,
        methodName: "df__acceptInvitation",
        contract: this.contractsAPI.contract,
        args: Promise.resolve([guildId]),
        guildId: guildId,
      };

      return await this.submitTransaction(txIntent);
    } catch (e) {
      this.getNotificationsManager().txInitError(
        "df__acceptInvitation",
        (e as Error).message,
      );
      throw e;
    }
  }

  public async applyToGuild(
    guildId: GuildId,
  ): Promise<Transaction<UnconfirmedApplyToGuild>> {
    try {
      if (!this.account) throw new Error("no account");
      const player = this.getPlayer(this.account);
      if (!player) throw new Error("no player");

      const playerGuild = this.getPlayerGuildId(this.account);
      if (playerGuild) throw Error("you are already in a guild");

      const guild = this.getGuild(guildId);
      if (!guild) throw Error("no guild");
      if (guild.status !== GuildStatus.ACTIVE)
        throw Error("guild is not active");

      const isOnLeaveCooldown = this.contractsAPI
        .getGuildUtils()
        .checkGuildLeaveCooldown(this.account);
      if (!isOnLeaveCooldown) throw Error("you are on leave cooldown");

      localStorage.setItem(
        `${this.ethConnection.getAddress()?.toLowerCase()}---applyToGuild-guildId`,
        guildId.toString(),
      );

      const txIntent: UnconfirmedApplyToGuild = {
        delegator: this.account,
        methodName: "df__applyToGuild",
        contract: this.contractsAPI.contract,
        args: Promise.resolve([guildId]),
        guildId: guildId,
      };

      return await this.submitTransaction(txIntent);
    } catch (e) {
      this.getNotificationsManager().txInitError(
        "df__applyToGuild",
        (e as Error).message,
      );
      throw e;
    }
  }

  public async approveApplication(
    player: EthAddress,
  ): Promise<Transaction<UnconfirmedApproveApplication>> {
    try {
      if (!this.account) throw new Error("no account");
      const operator = this.account;
      const operatorInfo = this.getPlayer(operator);
      if (!operatorInfo) throw Error("no operatorInfo");

      const playerInfo = this.getPlayer(player);
      if (!playerInfo) throw Error("no playerInfo");

      const guildId = this.getPlayerGuildId(operator);
      if (!guildId) throw Error("no guildId");

      const guild = this.getGuild(guildId);
      if (!guild) throw Error("no guild");
      if (guild.status !== GuildStatus.ACTIVE)
        throw Error("guild is not active");

      const maxMembers = this.contractsAPI.getGuildUtils().getMaxGuildMembers();
      if (!maxMembers) throw Error("no max members");
      if (guild.number >= maxMembers) {
        throw Error("guild member limit reached");
      }

      const guildRole = this.contractsAPI
        .getGuildUtils()
        .getGuildRole(operator);

      if (guildRole !== GuildRole.OFFICER && guildRole !== GuildRole.LEADER)
        throw Error("not an officer or leader");

      const playerGuild = this.getPlayerGuildId(player);
      if (playerGuild) throw Error("you are already in a guild");

      const txIntent: UnconfirmedApproveApplication = {
        delegator: operator,
        methodName: "df__approveApplication",
        contract: this.contractsAPI.contract,
        args: Promise.resolve([player]),
        guildId: guildId,
        applicant: player,
      };

      return await this.submitTransaction(txIntent);
    } catch (e) {
      this.getNotificationsManager().txInitError(
        "df__approveApplication",
        (e as Error).message,
      );
      throw e;
    }
  }

  public async leaveGuild(): Promise<Transaction<UnconfirmedLeaveGuild>> {
    try {
      if (!this.account) throw new Error("no account");
      const player = this.getPlayer(this.account);
      if (!player) throw new Error("no player");

      const guildId = this.getPlayerGuildId(this.account);
      if (!guildId) throw Error("no guildId");

      const guildRole = this.contractsAPI
        .getGuildUtils()
        .getGuildRole(this.account);
      if (guildRole === GuildRole.NONE || guildRole === GuildRole.LEADER)
        throw Error("guild role unexpected");

      const txIntent: UnconfirmedLeaveGuild = {
        delegator: this.account,
        methodName: "df__leaveGuild",
        contract: this.contractsAPI.contract,
        args: Promise.resolve([]),
        guildId: guildId,
      };

      return await this.submitTransaction(txIntent);
    } catch (e) {
      this.getNotificationsManager().txInitError(
        "df__leaveGuild",
        (e as Error).message,
      );
      throw e;
    }
  }

  public async transferGuildLeadership(
    newOwner: EthAddress,
  ): Promise<Transaction<UnconfirmedTransferGuildLeadership>> {
    try {
      if (!this.account) throw new Error("no account");
      const player = this.getPlayer(this.account);
      if (!player) throw new Error("no player");

      const guildId = this.getPlayerGuildId(this.account);
      if (!guildId) throw Error("no guildId");

      const guild = this.getGuild(guildId);
      if (!guild) throw Error("no guild");
      if (guild.status !== GuildStatus.ACTIVE)
        throw Error("guild is not active");

      const newOwnerPlayer = this.getPlayer(newOwner);
      if (!newOwnerPlayer) throw Error("no newOwnerPlayer");

      const newOwnerGuildId = this.getPlayerGuildId(newOwner);
      if (!newOwnerGuildId) throw Error("no newOwnerGuildId");

      if (newOwnerGuildId !== guildId)
        throw Error("newOwner is not in the guild");

      const txIntent: UnconfirmedTransferGuildLeadership = {
        delegator: this.account,
        methodName: "df__transferGuildLeadership",
        contract: this.contractsAPI.contract,
        args: Promise.resolve([newOwner]),
        guildId: guildId,
        newOwner: newOwner,
      };

      return await this.submitTransaction(txIntent);
    } catch (e) {
      this.getNotificationsManager().txInitError(
        "df__transferGuildLeadership",
        (e as Error).message,
      );
      throw e;
    }
  }

  public async disbandGuild(): Promise<Transaction<UnconfirmedDisbandGuild>> {
    try {
      if (!this.account) throw new Error("no account");
      const player = this.getPlayer(this.account);
      if (!player) throw new Error("no player");

      const guildId = this.getPlayerGuildId(this.account);
      if (!guildId) throw Error("no guildId");

      const guild = this.getGuild(guildId);
      if (!guild) throw Error("no guild");

      if (guild.status === GuildStatus.DISBANDED)
        throw Error("guild is disbanded");

      if (guild.number > 1) {
        throw Error("guild has members");
      }

      if (guild.owner !== this.account) {
        throw Error("not the guild leader");
      }

      alert(
        "This is a dangerous operation. Are you sure you want to disband the guild?",
      );

      localStorage.setItem(
        `${this.ethConnection.getAddress()?.toLowerCase()}--disbandGuild-guildId`,
        guildId.toString(),
      );

      const txIntent: UnconfirmedDisbandGuild = {
        delegator: this.account,
        methodName: "df__disbandGuild",
        contract: this.contractsAPI.contract,
        args: Promise.resolve([]),
        guildId: guildId,
      };

      return await this.submitTransaction(txIntent);
    } catch (e) {
      this.getNotificationsManager().txInitError(
        "df__disbandGuild",
        (e as Error).message,
      );
      throw e;
    }
  }

  public async setGrant(
    newGrant: GuildRole,
  ): Promise<Transaction<UnconfirmedSetGrant>> {
    try {
      if (!this.account) throw new Error("no account");
      const player = this.getPlayer(this.account);
      if (!player) throw new Error("no player");

      const guildId = this.getPlayerGuildId(this.account);
      if (!guildId) throw Error("no guildId");

      const guild = this.getGuild(guildId);
      if (!guild) throw Error("no guild");
      if (guild.status !== GuildStatus.ACTIVE)
        throw Error("guild is not active");

      const txIntent: UnconfirmedSetGrant = {
        delegator: this.account,
        methodName: "df__setGrant",
        contract: this.contractsAPI.contract,
        args: Promise.resolve([newGrant]),
        guildId: guildId,
        newGrant: newGrant,
      };

      return await this.submitTransaction(txIntent);
    } catch (e) {
      this.getNotificationsManager().txInitError(
        "df__setGrant",
        (e as Error).message,
      );
      throw e;
    }
  }

  public async setMemberRole(
    member: EthAddress,
    newRole: GuildRole,
  ): Promise<Transaction<UnconfirmedSetMemberRole>> {
    try {
      if (!this.account) throw new Error("no account");
      const player = this.getPlayer(this.account);
      if (!player) throw new Error("no player");

      const memberPlayer = this.getPlayer(member);
      if (!memberPlayer) throw Error("no memberPlayer");

      const guildId = this.getPlayerGuildId(this.account);
      if (!guildId) throw Error("no guildId");

      const memberGuildId = this.getPlayerGuildId(member);
      if (!memberGuildId) throw Error("no memberGuildId");

      if (memberGuildId !== guildId) throw Error("member is not in the guild");

      const operatorGuildRole = this.contractsAPI
        .getGuildUtils()
        .getGuildRole(this.account);
      if (operatorGuildRole !== GuildRole.LEADER) throw Error("not a leader");

      const memberGuildRole = this.contractsAPI
        .getGuildUtils()
        .getGuildRole(member);
      if (memberGuildRole === GuildRole.NONE)
        throw Error("member is not in the guild");

      if (newRole === GuildRole.LEADER || newRole === GuildRole.NONE)
        throw Error("new role unexpected");

      if (memberGuildRole === GuildRole.LEADER)
        throw Error("cannot change role of current leader");

      const txIntent: UnconfirmedSetMemberRole = {
        delegator: this.account,
        methodName: "df__setMemberRole",
        contract: this.contractsAPI.contract,
        args: Promise.resolve([member, newRole]),
        guildId: guildId,
        member: member,
        newRole: newRole,
      };

      return await this.submitTransaction(txIntent);
    } catch (e) {
      this.getNotificationsManager().txInitError(
        "df__setMemberRole",
        (e as Error).message,
      );
      throw e;
    }
  }

  public async kickMember(
    member: EthAddress,
  ): Promise<Transaction<UnconfirmedKickMember>> {
    try {
      if (!this.account) throw new Error("no account");
      const player = this.getPlayer(this.account);
      if (!player) throw new Error("no player");

      const memberPlayer = this.getPlayer(member);
      if (!memberPlayer) throw Error("no memberPlayer");

      const guildId = this.getPlayerGuildId(this.account);
      if (!guildId) throw Error("no guildId");

      const memberGuildId = this.getPlayerGuildId(member);
      if (!memberGuildId) throw Error("no memberGuildId");

      if (memberGuildId !== guildId) throw Error("member is not in the guild");

      const operatorGuildRole = this.contractsAPI
        .getGuildUtils()
        .getGuildRole(this.account);
      if (operatorGuildRole !== GuildRole.LEADER) throw Error("not a leader");

      const txIntent: UnconfirmedKickMember = {
        delegator: this.account,
        methodName: "df__kickMember",
        contract: this.contractsAPI.contract,
        args: Promise.resolve([member]),
        guildId: guildId,
        member: member,
      };

      return await this.submitTransaction(txIntent);
    } catch (e) {
      this.getNotificationsManager().txInitError(
        "df__kickMember",
        (e as Error).message,
      );
      throw e;
    }
  }
  public printSpawnPlanet() {
    const { SpawnPlanet } = this.components;
    console.log(SpawnPlanet);
  }
}
