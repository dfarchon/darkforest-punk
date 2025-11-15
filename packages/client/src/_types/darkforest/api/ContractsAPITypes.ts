import type {
  ArtifactPointValues,
  EthAddress,
  MaterialTransfer,
  UpgradeBranches,
} from "@df/types";
import type { BigNumber as EthersBN } from "ethers";

export const enum ZKArgIdx {
  PROOF_A,
  PROOF_B,
  PROOF_C,
  DATA,
}

export const enum InitArgIdxs {
  LOCATION_ID,
  PERLIN,
  RADIUS,
  PLANETHASH_KEY,
  SPACETYPE_KEY,
  PERLIN_LENGTH_SCALE,
  PERLIN_MIRROR_X,
  PERLIN_MIRROR_Y,
  TARGET_DIST_FROM_ORIGIN_SQUARE,
}

export const enum MoveArgIdxs {
  FROM_ID,
  TO_ID,
  TO_PERLIN,
  TO_RADIUS,
  DIST_MAX,
  PLANETHASH_KEY,
  SPACETYPE_KEY,
  PERLIN_LENGTH_SCALE,
  PERLIN_MIRROR_X,
  PERLIN_MIRROR_Y,
  TARGET_DIST_FROM_ORIGIN_SQUARE,
}

export const enum UpgradeArgIdxs {
  LOCATION_ID,
  UPGRADE_BRANCH,
}

export const enum ContractEvent {
  PlayerInitialized = "PlayerInitialized",
  ArrivalQueued = "ArrivalQueued",
  PlanetUpgraded = "PlanetUpgraded",
  PlanetHatBought = "PlanetHatBought",
  PlanetTransferred = "PlanetTransferred",
  PlanetInvaded = "PlanetInvaded",
  PlanetCaptured = "PlanetCaptured",
  LocationRevealed = "LocationRevealed",
  LocationClaimed = "LocationClaimed",
  ArtifactFound = "ArtifactFound",
  ArtifactDeposited = "ArtifactDeposited",
  ArtifactWithdrawn = "ArtifactWithdrawn",
  ArtifactActivated = "ArtifactActivated",
  ArtifactDeactivated = "ArtifactDeactivated",
  PlanetSilverWithdrawn = "PlanetSilverWithdrawn",
  AdminOwnershipChanged = "AdminOwnershipChanged",
  AdminGiveSpaceship = "AdminGiveSpaceship",
  PauseStateChanged = "PauseStateChanged",
  HalfPriceChanged = "HalfPriceChanged",
  LobbyCreated = "LobbyCreated",
  LocationBurned = "LocationBurned",
  Kardashev = "Kardashev",
  LocationBlued = "LocationBlued",
  PlanetBought = "PlanetBought",
  SpaceshipBought = "SpaceshipBought",
  WorldRadiusUpdated = "WorldRadiusUpdated",
  InnerRadiusUpdated = "InnerRadiusUpdated",
  UnionCreated = "UnionCreated",
  InviteSent = "InviteSent",
  InviteCanceled = "InviteCanceled",
  InviteAccepted = "InviteAccepted",
  ApplicationSent = "ApplicationSent",
  ApplicationCanceled = "ApplicationCanceled",
  ApplicationAccepted = "ApplicationAccepted",
  ApplicationRejected = "ApplicationRejected",
  MemberLeft = "MemberLeft",
  MemberKicked = "MemberKicked",
  UnionTransferred = "UnionTransferred",
  UnionNameChanged = "UnionNameChanged",
  UnionDisbanded = "UnionDisbanded",
  UnionLeveledUp = "UnionLeveledUp",
  MemberAddedByAdmin = "MemberAddedByAdmin",
}

export const enum ContractsAPIEvent {
  PlayerUpdate = "PlayerUpdate",
  PlanetUpdate = "PlanetUpdate",
  PauseStateChanged = "PauseStateChanged",
  ArrivalQueued = "ArrivalQueued",
  ArtifactUpdate = "ArtifactUpdate",
  RadiusUpdated = "RadiusUpdated",
  LocationRevealed = "LocationRevealed",
  TickRateUpdate = "TickRateUpdate",
  /**
   * The transaction has been queued for future execution.
   */
  TxQueued = "TxQueued",
  /**
   * The transaction has been removed from the queue and is
   * calculating arguments in preparation for submission.
   */
  TxProcessing = "TxProcessing",
  /**
   * The transaction is queued, but is prioritized for execution
   * above other queued transactions.
   */
  TxPrioritized = "TxPrioritized",
  /**
   * The transaction has been submitted and we are awaiting
   * confirmation.
   */
  TxSubmitted = "TxSubmitted",
  /**
   * The transaction has been confirmed.
   */
  TxConfirmed = "TxConfirmed",
  /**
   * The transaction has failed for some reason. This
   * could either be a revert or a purely client side
   * error. In the case of a revert, the transaction hash
   * will be included in the transaction object.
   */
  TxErrored = "TxErrored",
  /**
   * The transaction was cancelled before it left the queue.
   */
  TxCancelled = "TxCancelled",
  PlanetTransferred = "PlanetTransferred",
  LocationClaimed = "LocationClaimed",
  LobbyCreated = "LobbyCreated",
  HalfPriceChanged = "HalfPriceChanged",
  GuildUpdate = "GuildUpdate",
}

// planet locationID(BigInt), branch number
export type UpgradeArgs = [string, string];

export type MoveArgs = [
  [string, string], // proofA
  [
    // proofB
    [string, string],
    [string, string],
  ],
  [string, string], // proofC
  [
    string, // from locationID (BigInt)
    string, // to locationID (BigInt)
    string, // perlin at to
    string, // radius at to
    string, // distMax
    string, // planetHashKey
    string, // spaceTypeKey
    string, // perlin lengthscale
    string, // perlin xmirror (1 true, 0 false)
    string, // perlin ymirror (1 true, 0 false)
    string, //targetDistFromOriginSquare
  ],
  string, // ships sent
  string, // silver sent
  string, // artifactId sent
  // string, // dist from origin
  string, // is planet being released (1 true, 0 false)
  `0x${string}`, // materials sent
];

// Same as reveal args with Explicit coords attached
export type ClaimArgs = [
  [string, string],
  [[string, string], [string, string]],
  [string, string],
  [string, string, string, string, string, string, string, string, string],
];

export type DepositArtifactArgs = [string, string]; // locationId, artifactId
export type WithdrawArtifactArgs = [string, string]; // locationId, artifactId
export type WhitelistArgs = [string, string]; // hashed whitelist key, recipient address

export type PlanetTypeWeights = [
  number,
  number,
  number,
  number,
  number,
  number,
]; // relative frequencies of the 6 planet types (PLANET, ASTEROID_FIELD, FOUNDRY, SPACETIME_RIP, QUASAR, SUN)
export type PlanetTypeWeightsByLevel = [
  PlanetTypeWeights,
  PlanetTypeWeights,
  PlanetTypeWeights,
  PlanetTypeWeights,
  PlanetTypeWeights,
  PlanetTypeWeights,
  PlanetTypeWeights,
  PlanetTypeWeights,
  PlanetTypeWeights,
  PlanetTypeWeights,
];
export type PlanetTypeWeightsBySpaceType = [
  PlanetTypeWeightsByLevel,
  PlanetTypeWeightsByLevel,
  PlanetTypeWeightsByLevel,
  PlanetTypeWeightsByLevel,
];

export interface ContractConstants {
  DISABLE_ZK_CHECKS: boolean;
  PLAYER_AMOUNT_LIMIT: number;
  INIT_PERLIN_MIN: number;
  INIT_PERLIN_MAX: number;
  LOCATION_REVEAL_COOLDOWN: number;

  PLANET_RARITY: number;
  WORLD_RADIUS_MIN: number;

  /**
   * The perlin value at each coordinate determines the space type. There are four space
   * types, which means there are four ranges on the number line that correspond to
   * each space type. This function returns the boundary values between each of these
   * four ranges: `PERLIN_THRESHOLD_1`, `PERLIN_THRESHOLD_2`, `PERLIN_THRESHOLD_3`.
   */
  PERLIN_THRESHOLD_1: number;
  PERLIN_THRESHOLD_2: number;
  PERLIN_THRESHOLD_3: number;
  SPACE_TYPE_PLANET_LEVEL_LIMITS: number[];
  SPACE_TYPE_PLANET_LEVEL_MIN_LIMITS: number[];
  SPACE_TYPE_PLANET_LEVEL_BONUS: number[];

  MAX_LEVEL_DIST: number[];
  MAX_LEVEL_LIMIT: number[];
  MIN_LEVEL_BIAS: number[];

  /**
     The chance for a planet to be a specific level.
     Each index corresponds to a planet level (index 5 is level 5 planet).
     The lower the number the lower the chance.
     Note: This does not control if a planet spawns or not, just the level
     when it spawns.
   */
  PLANET_LEVEL_THRESHOLDS: number[];

  BIOME_THRESHOLD_1: number;
  BIOME_THRESHOLD_2: number;

  upgrades: UpgradeBranches;

  PLANET_TYPE_WEIGHTS: PlanetTypeWeightsBySpaceType;

  PLANETHASH_KEY: number;
  BIOMEBASE_KEY: number;
  SPACETYPE_KEY: number;
  PERLIN_LENGTH_SCALE: number;
  PERLIN_MIRROR_X: boolean;
  PERLIN_MIRROR_Y: boolean;

  adminAddress: EthAddress;

  // TODO: Planet default state

  // defaultPopulationCap: number[];
  // defaultPopulationGrowth: number[];
  // defaultSilverCap: number[];
  // defaultSilverGrowth: number[];
  // defaultRange: number[];
  // defaultSpeed: number[];
  // defaultDefense: number[];
  // defaultBarbarianPercentage: number[];
  // planetCumulativeRarities: number[];

  //GameConstants
  // ADMIN_CAN_ADD_PLANETS: boolean;
  // WORLD_RADIUS_LOCKED: boolean;

  // MAX_NATURAL_PLANET_LEVEL: number;
  // MAX_ARTIFACT_PER_PLANET: number;

  // MAX_SENDING_PLANET: number;
  // MAX_RECEIVING_PLANET: number;
  // TIME_FACTOR_HUNDREDTHS: number;

  // SPAWN_RIM_AREA: number;

  // PLANET_TRANSFER_ENABLED: boolean;
  // PHOTOID_ACTIVATION_DELAY: number;
  // STELLAR_ACTIVATION_DELAY: number;

  // CLAIM_PLANET_COOLDOWN: number;
  // ACTIVATE_ARTIFACT_COOLDOWN: number;
  // BUY_ARTIFACT_COOLDOWN: number;

  /**
   * How much score silver gives when withdrawing.
   * Expressed as a percentage integer.
   * (100 is 100%)
   */
  // SILVER_SCORE_VALUE: number;

  // ARTIFACT_POINT_VALUES: ArtifactPointValues;
  // Space Junk
  SPACE_JUNK_ENABLED: boolean;
  /**
     Total amount of space junk a player can take on.
     This can be overridden at runtime by updating
     this value for a specific player in storage.
   */
  // SPACE_JUNK_LIMIT: number;
  SPACE_JUNK_FREE_ALLOCATION: number;
  SPACE_JUNK_LINEAR_MIN_PURCHASE: number;
  SPACE_JUNK_LINEAR_MAX_PURCHASE: number;
  SPACE_JUNK_LINEAR_BASE_PRICE: bigint;
  SPACE_JUNK_QUADRATIC_MIN_PURCHASE: number;
  SPACE_JUNK_QUADRATIC_MAX_PURCHASE: number;
  SPACE_JUNK_QUADRATIC_BASE_PRICE: bigint;

  /**
     The amount of junk that each level of planet
     gives the player when moving to it for the
     first time.
   */
  PLANET_LEVEL_JUNK: [
    number,
    number,
    number,
    number,
    number,
    number,
    number,
    number,
    number,
    number,
  ];

  /**
     The speed boost a movement receives when abandoning
     a planet.
   */
  ABANDON_SPEED_CHANGE_PERCENT: number;
  /**
     The range boost a movement receives when abandoning
     a planet.
   */
  ABANDON_RANGE_CHANGE_PERCENT: number;

  // Capture Zones
  // GAME_START_BLOCK: number;
  // CAPTURE_ZONES_ENABLED: boolean;
  // CAPTURE_ZONE_CHANGE_BLOCK_INTERVAL: number;
  // CAPTURE_ZONE_RADIUS: number;

  // CAPTURE_ZONE_PLANET_LEVEL_SCORE: [
  //   number,
  //   number,
  //   number,
  //   number,
  //   number,
  //   number,
  //   number,
  //   number,
  //   number,
  //   number,
  // ];
  // CAPTURE_ZONE_HOLD_BLOCKS_REQUIRED: number;
  // CAPTURE_ZONES_PER_5000_WORLD_RADIUS: number;

  //SpaceshipConstants
  SPACESHIPS: {
    GEAR: boolean;
    // MOTHERSHIP: boolean;
    // TITAN: boolean;
    // CRESCENT: boolean;
    // WHALE: boolean;
    // PINKSHIP: boolean;
  };

  // ROUND_END_REWARDS_BY_RANK: [
  //   number,
  //   number,
  //   number,
  //   number,
  //   number,
  //   number,
  //   number,
  //   number,
  //   number,
  //   number,
  //   number,
  //   number,
  //   number,
  //   number,
  //   number,
  //   number,
  //   number,
  //   number,
  //   number,
  //   number,
  //   number,
  //   number,
  //   number,
  //   number,
  //   number,
  //   number,
  //   number,
  //   number,
  //   number,
  //   number,
  //   number,
  //   number,
  //   number,
  //   number,
  //   number,
  //   number,
  //   number,
  //   number,
  //   number,
  //   number,
  //   number,
  //   number,
  //   number,
  //   number,
  //   number,
  //   number,
  //   number,
  //   number,
  //   number,
  //   number,
  //   number,
  //   number,
  //   number,
  //   number,
  //   number,
  //   number,
  //   number,
  //   number,
  //   number,
  //   number,
  //   number,
  //   number,
  //   number,
  //   number,
  // ];

  // TOKEN_MINT_END_TIMESTAMP: number;
  // CLAIM_END_TIMESTAMP: number;

  // BURN_END_TIMESTAMP: number;
  // BURN_PLANET_COOLDOWN: number;
  // PINK_PLANET_COOLDOWN: number;

  // BURN_PLANET_LEVEL_EFFECT_RADIUS: [
  //   number,
  //   number,
  //   number,
  //   number,
  //   number,
  //   number,
  //   number,
  //   number,
  //   number,
  //   number,
  // ];

  // BURN_PLANET_REQUIRE_SILVER_AMOUNTS: [
  //   number,
  //   number,
  //   number,
  //   number,
  //   number,
  //   number,
  //   number,
  //   number,
  //   number,
  //   number,
  // ];

  // ENTRY_FEE: number;
  // KARDASHEV_END_TIMESTAMP: number;
  // KARDASHEV_PLANET_COOLDOWN: number;
  // BLUE_PLANET_COOLDOWN: number;
  // KARDASHEV_EFFECT_RADIUS: [
  //   number,
  //   number,
  //   number,
  //   number,
  //   number,
  //   number,
  //   number,
  //   number,
  //   number,
  //   number,
  // ];
  // KARDASHEV_REQUIRE_SILVER_AMOUNTS: [
  //   number,
  //   number,
  //   number,
  //   number,
  //   number,
  //   number,
  //   number,
  //   number,
  //   number,
  //   number,
  // ];
  // BLUE_PANET_REQUIRE_SILVER_AMOUNTS: [
  //   number,
  //   number,
  //   number,
  //   number,
  //   number,
  //   number,
  //   number,
  //   number,
  //   number,
  //   number,
  // ];
}

export type ClientMockchainData =
  | null
  | undefined
  | number
  | string
  | boolean
  | EthersBN
  | ClientMockchainData[]
  | {
      [key in string | number]: ClientMockchainData;
    };

export const enum PlanetEventType {
  ARRIVAL,
}
