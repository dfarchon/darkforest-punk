import type { Biome } from "./game_types";
import type {
  ArtifactId,
  EthAddress,
  LocationId,
  VoyageId,
} from "./identifier";
import type { TransactionCollection } from "./transaction";
import type { Upgrade } from "./upgrade";
import type { Abstract } from "./utility";

/**
 * Abstract type representing an artifact type.
 */
export type ArtifactType = Abstract<number, "ArtifactType">;

/**
 * Enumeration of artifact types.
 */
export const ArtifactType = {
  Unknown: 0 as ArtifactType,
  Monolith: 1 as ArtifactType,
  Colossus: 2 as ArtifactType,
  Spaceship: 3 as ArtifactType,
  Pyramid: 4 as ArtifactType,
  Wormhole: 5 as ArtifactType,
  PlanetaryShield: 6 as ArtifactType,
  PhotoidCannon: 7 as ArtifactType,
  BloomFilter: 8 as ArtifactType,
  BlackDomain: 9 as ArtifactType,
  IceLink: 10 as ArtifactType,
  FireLink: 11 as ArtifactType,
  Kardashev: 12 as ArtifactType,
  Bomb: 13 as ArtifactType,
  StellarShield: 14 as ArtifactType,
  BlindBox: 15 as ArtifactType,
  Avatar: 16 as ArtifactType,
  ShipMothership: 17 as ArtifactType,
  ShipCrescent: 18 as ArtifactType,
  ShipWhale: 19 as ArtifactType,
  ShipGear: 20 as ArtifactType,
  ShipTitan: 21 as ArtifactType,
  ShipPink: 22 as ArtifactType,

  // Don't forget to update MIN_ARTIFACT_TYPE and/or MAX_ARTIFACT_TYPE in the `constants` package
} as const;

/**
 * Spaceship types for crafted spaceships
 */
export type SpaceshipType = Abstract<number, "SpaceshipType">;

export const SpaceshipType = {
  Unknown: 0 as SpaceshipType,
  Scout: 1 as SpaceshipType,
  Fighter: 2 as SpaceshipType,
  Destroyer: 3 as SpaceshipType,
  Carrier: 4 as SpaceshipType,
} as const;

/**
 * Mapping from SpaceshipType to pretty-printed names.
 */
export const SpaceshipTypeNames = {
  [SpaceshipType.Unknown]: "Unknown",
  [SpaceshipType.Scout]: "Scout",
  [SpaceshipType.Fighter]: "Fighter",
  [SpaceshipType.Destroyer]: "Destroyer",
  [SpaceshipType.Carrier]: "Carrier",
} as const;

/**
 * Mapping from ArtifactType to pretty-printed names.
 */
export const ArtifactTypeNames = {
  [ArtifactType.Unknown]: "Unknown",
  [ArtifactType.Monolith]: "Monolith",
  [ArtifactType.Colossus]: "Colossus",
  [ArtifactType.Spaceship]: "Spaceship",
  [ArtifactType.Pyramid]: "Pyramid",
  [ArtifactType.Wormhole]: "Wormhole",
  [ArtifactType.PlanetaryShield]: "Planetary Shield",
  [ArtifactType.BlackDomain]: "Black Domain",
  [ArtifactType.PhotoidCannon]: "Photoid Cannon",
  [ArtifactType.BloomFilter]: "Bloom Filter",
  [ArtifactType.IceLink]: "Ice Link",
  [ArtifactType.FireLink]: "Fire Link",
  [ArtifactType.Kardashev]: "Kardashev",
  [ArtifactType.Bomb]: "Bomb",
  [ArtifactType.StellarShield]: "Stellar Shield",
  [ArtifactType.BlindBox]: "Blind Box",
  [ArtifactType.Avatar]: "Avatar",
  [ArtifactType.ShipMothership]: "Mothership",
  [ArtifactType.ShipCrescent]: "Crescent",
  [ArtifactType.ShipWhale]: "Whale",
  [ArtifactType.ShipGear]: "Gear",
  [ArtifactType.ShipTitan]: "Titan",
  [ArtifactType.ShipPink]: "Pinkship",
} as const;

/**
 * Abstract type representing an artifact rarity level.
 */
export type ArtifactRarity = Abstract<number, "ArtifactRarity">;

/**
 * Enumeration of artifact rarity levels. Common = 1, Mythic = 5
 */
export const ArtifactRarity = {
  Unknown: 0 as ArtifactRarity,
  Common: 1 as ArtifactRarity,
  Rare: 2 as ArtifactRarity,
  Epic: 3 as ArtifactRarity,
  Legendary: 4 as ArtifactRarity,
  Mythic: 5 as ArtifactRarity,
  // Don't forget to update MIN_ARTIFACT_RARITY and/or MAX_ARTIFACT_RARITY in the `constants` package
} as const;

/**
 * Mapping from ArtifactRarity to pretty-printed names.
 */
export const ArtifactRarityNames = {
  [ArtifactRarity.Unknown]: "Unknown",
  [ArtifactRarity.Common]: "Common",
  [ArtifactRarity.Rare]: "Rare",
  [ArtifactRarity.Epic]: "Epic",
  [ArtifactRarity.Legendary]: "Legendary",
  [ArtifactRarity.Mythic]: "Mythic",
} as const;

/**
 * Abstract type representing an artifact status.
 */
export type ArtifactStatus = Abstract<number, "ArtifactStatus">;

/**
 * Enumeration of possible artifact statuses
 */
export const ArtifactStatus = {
  Default: 0 as ArtifactStatus,
  Cooldown: 1 as ArtifactStatus,
  Charging: 2 as ArtifactStatus,
  Ready: 3 as ArtifactStatus,
  Active: 4 as ArtifactStatus,
  Broken: 5 as ArtifactStatus,
} as const;

/**
 * Mapping from ArtifactStatus to pretty-printed names.
 */
export const ArtifactStatusNames = {
  [ArtifactStatus.Default]: "Default",
  [ArtifactStatus.Cooldown]: "Cooldown",
  [ArtifactStatus.Charging]: "Charging",
  [ArtifactStatus.Ready]: "Ready",
  [ArtifactStatus.Active]: "Active",
  [ArtifactStatus.Broken]: "Broken",
} as const;
/**
 * Abstract type representing an artifact genre.
 */
export type ArtifactGenre = Abstract<number, "ArtifactGenre">;

/**
 * Enumeration of possible artifact genres
 */
export const ArtifactGenre = {
  Unknown: 0 as ArtifactGenre,
  Defensive: 1 as ArtifactGenre,
  Offensive: 2 as ArtifactGenre,
  Productive: 3 as ArtifactGenre,
  General: 4 as ArtifactGenre,
} as const;

/**
 * Mapping from ArtifactGenre to pretty-printed names.
 */
export const ArtifactGenreNames = {
  [ArtifactGenre.Unknown]: "Unknown",
  [ArtifactGenre.Defensive]: "Defensive",
  [ArtifactGenre.Offensive]: "Offensive",
  [ArtifactGenre.Productive]: "Productive",
  [ArtifactGenre.General]: "General",
} as const;

/**
 * mapping from ArtifactRarity to points earned for finding this artifact.
 */
export type ArtifactPointValues = { [ArtifactRarity: number]: number };

/**
 * Represents data associated with a Dark Forest artifact NFT. Note
 * that some `Artifact` fields store client-specific data that the blockchain is
 * not aware of, such as `unconfirmedDepositArtifact` (tracks pending
 * depositArtifact transaction that involves this artifact). If you're using a
 * client that can't send transactions, these fields should be ignored.
 */
export type Artifact = {
  isInititalized: boolean;
  id: ArtifactId;
  planetDiscoveredOn: LocationId;
  rarity: ArtifactRarity;
  planetBiome: Biome;
  mintedAtTimestamp: number;
  discoverer: EthAddress;
  artifactType: ArtifactType;
  activations: number;
  lastActivated: number;
  lastDeactivated: number;
  controller: EthAddress;
  imageType: number;

  upgrade?: Upgrade;
  timeDelayedUpgrade?: Upgrade;
  currentOwner: EthAddress; // owner of the NFT - can be the contract
  linkTo?: LocationId;
  onPlanetId?: LocationId;
  onVoyageId?: VoyageId;

  transactions?: TransactionCollection;

  // mud version
  artifactIndex?: number;
  status?: ArtifactStatus;
  genre?: ArtifactGenre;
  chargeTick?: number;
  activateTick?: number;
  cooldownTick?: number;
  charge?: number;
  cooldown?: number;
  durable?: boolean;
  reusable?: boolean;
  reqLevel?: number;
  reqPopulation?: bigint;
  reqSilver?: bigint;
  chargeUpgrade?: Upgrade;
  activateUpgrade?: Upgrade;

  // Spaceship-specific properties
  spaceshipType?: SpaceshipType;
  attackBonus?: number;
  defenseBonus?: number;
  speedBonus?: number;
  rangeBonus?: number;
  crafter?: EthAddress;
  craftedAt?: number;
  nftTokenId?: number;
};

// TODO: get this out of here

const godGrammar = {
  god1: [
    "c'",
    "za",
    "ry'",
    "ab'",
    "bak'",
    "dt'",
    "ek'",
    "fah'",
    "q'",
    "qo",
    "van",
    "bow",
    "gui",
    "si",
  ],
  god2: [
    "thun",
    "tchalla",
    "thovo",
    "saron",
    "zoth",
    "sharrj",
    "thulu",
    "ra",
    "wer",
    "doin",
    "renstad",
    "nevere",
    "goth",
    "anton",
    "layton",
  ],
};

/**
 * Deterministically generates the name of the artifact from its ID.
 *
 * @param artifact The artifact to generate a name for
 */
export function artifactNameFromArtifact(artifact: Artifact) {
  const idNum = parseInt(artifact.id, 16);

  const roll1 = (idNum % 7919) % godGrammar.god1.length; // 7919 is a big prime
  const roll2 = (idNum % 7883) % godGrammar.god2.length; // 7883 is a big prime

  const name = godGrammar.god1[roll1] + godGrammar.god2[roll2];
  const nameCapitalized = name.charAt(0).toUpperCase() + name.slice(1);

  return nameCapitalized;
}

/**
 * type interface for ERC721 metadata.
 */

type NFTAttribute = {
  trait_type: string;
  value: string | number;
  display_type?: string;
};
export type NFTMetadata = {
  name: string;
  description: string;
  image: string;
  attributes: NFTAttribute[];
};

export interface RenderedArtifact extends Partial<Artifact> {
  artifactType: ArtifactType;
  planetBiome: Biome;
  rarity: ArtifactRarity;
  id: ArtifactId; // for rolls
}

export type Link = {
  from: LocationId;
  to: LocationId;
  artifactId: ArtifactId;
};
