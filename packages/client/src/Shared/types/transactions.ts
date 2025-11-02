import type { Contract } from "ethers";

import type { BiomebaseSnarkContractCallArgs } from "../snarks";
import type { GuildRole } from "./guild";
import type {
  ArtifactId,
  EthAddress,
  GuildId,
  LocationId,
  MaterialTransfer,
} from "./identifier";
import type { Materials } from "./planet";
import type { WorldLocation } from "./world";

// import type { LiteralUnion } from "type-fest";
//
type LiteralUnion<T extends U, U = string> = T | (U & Record<never, never>);

export type ContractMethodName =
  | "df__legacyRevealLocation"
  | "claimLocation"
  | "df__initializePlayer"
  | "df__legacyMove"
  | "df__legacyUpgradePlanet"
  | "buySkin"
  | "transferPlanet"
  | "df__findArtifact"
  | "df__prospectPlanet"
  | "depositArtifact"
  | "withdrawArtifact"
  | "df__activateArtifact"
  | "df__shutdownArtifact"
  | "df__chargeArtifact"
  | "deactivateArtifact"
  | "changeArtifactImageType"
  | "buyArtifact"
  | "df__withdrawSilver"
  | "df__withdrawMaterial"
  | "df__addJunk"
  | "df__clearJunk"
  | "df__buyJunk"
  | "df__setPlanetEmoji"
  | "df__revertMove"
  | "useKey"
  | "adminUseKey"
  | "addKeys"
  | "giveSpaceShips"
  | "createLobby"
  | "invadePlanet"
  | "capturePlanet"
  | "claimReward"
  | "burnLocation"
  | "pinkLocation"
  | "kardashev"
  | "blueLocation"
  | "refreshPlanet"
  | "buyPlanet"
  | "buySpaceship"
  | "donate"
  | "addMemberByAdmin"
  | "createUnion"
  | "inviteMember"
  | "cancelInvite"
  | "acceptInvite"
  | "sendApplication"
  | "cancelApplication"
  | "rejectApplication"
  | "acceptApplication"
  | "leaveUnion"
  | "kickMember"
  | "transferLeaderRole"
  | "changeUnionName"
  | "disbandUnion"
  | "levelUpUnion"
  | "df__buyGPTTokens"
  | "df__spendGPTTokens"
  | "df__sendGPTTokens"
  | "df__createGuild"
  | "df__inviteToGuild"
  | "df__acceptInvitation"
  | "df__applyToGuild"
  | "df__approveApplication"
  | "df__leaveGuild"
  | "df__transferGuildLeadership"
  | "df__disbandGuild"
  | "df__setGrant"
  | "df__setMemberRole"
  | "df__kickMember";

export type EthTxStatus =
  | "Init"
  | "Processing"
  | "Prioritized"
  | "Submit"
  | "Confirm"
  | "Fail"
  | "Cancel";

/**
 * The intent of this type is to represent a transaction that will occur on the blockchain in a way
 * that the game understands. This should usually be accessed as a member of {@link Transaction}.
 * @hidden
 */
export type TxIntent = {
  contract: Contract;
  methodName: LiteralUnion<ContractMethodName, string>;
  args: Promise<unknown[]>;
  delegator: EthAddress;
};

/**
 * @hidden
 */
export type UnconfirmedInit = TxIntent & {
  methodName: "df__initializePlayer";
  locationId: LocationId;
  location: WorldLocation;
};

/**
 * @hidden
 */
export type UnconfirmedMove = TxIntent & {
  methodName: "df__legacyMove";
  from: LocationId;
  to: LocationId;
  forces: number;
  silver: number;
  abandoning: boolean;
  artifact?: ArtifactId;
  materials?: MaterialTransfer[];
};

/**
 * @hidden
 */
export type UnconfirmedFindArtifact = TxIntent & {
  methodName: "df__findArtifact";
  planetId: LocationId;
};

/**
 * @hidden
 */
export type UnconfirmedProspectPlanet = TxIntent & {
  methodName: "df__prospectPlanet";
  planetId: LocationId;
};

/**
 * @hidden
 */
export type UnconfirmedPlanetTransfer = TxIntent & {
  methodName: "transferPlanet";
  planetId: LocationId;
  newOwner: EthAddress;
};

/**
 * @hidden
 */
export type UnconfirmedClaimReward = TxIntent & {
  methodName: "claimReward";
  sortedPlayerAddresses: EthAddress[];
  sortedScores: number[];
};

/**
 * @hidden
 */
export type UnconfirmedUpgrade = TxIntent & {
  methodName: "df__legacyUpgradePlanet";
  locationId: LocationId;
  upgradeBranch: number; // 0, 1, or 2
};

/**
 * @hidden
 */
export type UnconfirmedRefreshPlanet = TxIntent & {
  methodName: "refreshPlanet";
  locationId: LocationId;
};

/**
 * @hidden
 */
export type UnconfirmedBuyHat = TxIntent & {
  methodName: "buySkin";
  locationId: LocationId;
  hatType: number;
};

/**
 * @hidden
 */
export type UnconfirmedDepositArtifact = TxIntent & {
  methodName: "depositArtifact";
  locationId: LocationId;
  artifactId: ArtifactId;
};

/**
 * @hidden
 */
export type UnconfirmedWithdrawArtifact = TxIntent & {
  methodName: "withdrawArtifact";
  locationId: LocationId;
  artifactId: ArtifactId;
};

/**
 * @hidden
 */
export type UnconfirmedActivateArtifact = TxIntent & {
  methodName: "df__activateArtifact";
  locationId: LocationId;
  artifactId: ArtifactId;
  linkTo?: LocationId;
};

/**
 * @hidden
 */
export type UnconfirmedShutdownArtifact = TxIntent & {
  methodName: "df__shutdownArtifact";
  locationId: LocationId;
  artifactId: ArtifactId;
};

/**
 * @hidden
 */
export type UnconfirmedChargeArtifact = TxIntent & {
  methodName: "df__chargeArtifact";
  locationId: LocationId;
  artifactId: ArtifactId;
};

/**
 * @hidden
 */
export type UnconfirmedDeactivateArtifact = TxIntent & {
  methodName: "deactivateArtifact";
  locationId: LocationId;
  artifactId: ArtifactId;
  linkTo: LocationId | undefined;
};

/**
 * @hidden
 */
export type UnconfirmedChangeArtifactImageType = TxIntent & {
  methodName: "changeArtifactImageType";
  locationId: LocationId;
  artifactId: ArtifactId;
  newImageType: number;
};

/**
 * @hidden
 */
export type UnconfirmedBuyArtifact = TxIntent & {
  methodName: "buyArtifact";
  locationId: LocationId;
  artifactId: ArtifactId;
};

/**
 * @hidden
 */
export type UnconfirmedWithdrawSilver = TxIntent & {
  methodName: "df__withdrawSilver";
  locationId: LocationId;
  amount: number;
};

/**
 * @hidden
 */
export type UnconfirmedWithdrawMaterial = TxIntent & {
  methodName: "df__withdrawMaterial";
  locationId: LocationId;
  materialType: MaterialType;
  amount: number;
};

/**
 * @hidden
 */
export type UnconfirmedAddJunk = TxIntent & {
  methodName: "df__addJunk";
  locationId: LocationId;
  biomeBase: number;
  proof: BiomebaseSnarkContractCallArgs;
};

/**
 * @hidden
 */
export type UnconfirmedClearJunk = TxIntent & {
  methodName: "df__clearJunk";
  locationId: LocationId;
};

/**
 * @hidden
 */
export type UnconfirmedBuyJunk = TxIntent & {
  methodName: "df__buyJunk";
  amount: number;
};

/**
 * @hidden
 */
export type UnconfirmedSetPlanetEmoji = TxIntent & {
  methodName: "df__setPlanetEmoji";
  locationId: LocationId;
  emoji: string;
};

/**
 * @hidden
 */
export type UnconfirmedReveal = TxIntent & {
  methodName: "df__legacyRevealLocation";
  locationId: LocationId;
  location: WorldLocation;
};

/**
 * @hidden
 */
export type UnconfirmedClaim = TxIntent & {
  methodName: "claimLocation";
  locationId: LocationId;
  location: WorldLocation;
};

/**
 * @hidden
 */
export type UnconfirmedAddKeys = TxIntent & {
  methodName: "addKeys";
};

/**
 * @hidden
 */
export type UnconfirmedUseKey = TxIntent & {
  methodName: "useKey";
};

/**
 * @hidden
 */
export type UnconfirmedAdminUseKey = TxIntent & {
  methodName: "adminUseKey";
};

/**
 * @hidden
 */
export type UnconfirmedGetShips = TxIntent & {
  methodName: "giveSpaceShips";
  locationId: LocationId;
};

/**
 * @hidden
 */
export type UnconfirmedCreateLobby = TxIntent & {
  methodName: "createLobby";
};

/**
 * @hidden
 */
export type UnconfirmedInvadePlanet = TxIntent & {
  methodName: "invadePlanet";
  locationId: LocationId;
};

/**
 * @hidden
 */
export type UnconfirmedCapturePlanet = TxIntent & {
  methodName: "capturePlanet";
  locationId: LocationId;
};

/**
 * @hidden
 */
export type UnconfirmedBurn = TxIntent & {
  methodName: "burnLocation";
  locationId: LocationId;
  location: WorldLocation;
};

/**
 * @hidden
 */
export type UnconfirmedPink = TxIntent & {
  methodName: "destroy";
  locationId: LocationId;
  location: WorldLocation;
  artifactId: ArtifactId;
};

/**
 * @hidden
 */
export type UnconfirmedKardashev = TxIntent & {
  methodName: "kardashev";
  locationId: LocationId;
  location: WorldLocation;
};

/**
 * @hidden
 */
export type UnconfirmedBlue = TxIntent & {
  methodName: "blueLocation";
  locationId: LocationId;
  location: WorldLocation;
};

/**
 * @hidden
 */
export type UnconfirmedBuyPlanet = TxIntent & {
  methodName: "buyPlanet";
  locationId: LocationId;
  location: WorldLocation;
};

/**
 * @hidden
 */
export type UnconfirmedBuySpaceship = TxIntent & {
  methodName: "buySpaceship";
  locationId: LocationId;
  location: WorldLocation;
};

/**
 * @hidden
 */
export type UnconfirmedDonate = TxIntent & {
  methodName: "donate";
  amount: number;
};

/**
 * @hidden
 *
 */
export type UnconfirmedCreateGuild = TxIntent & {
  methodName: "df__createGuild";
  name: string;
  guildId: GuildId;
};

/**
 * @hidden
 *
 */
export type UnconfirmedInviteToGuild = TxIntent & {
  methodName: "df__inviteToGuild";
  guildId: GuildId;
  invitee: EthAddress;
};

/**
 * @hidden
 */
export type UnconfirmedAcceptInvitation = TxIntent & {
  methodName: "df__acceptInvitation";
  guildId: GuildId;
};

/**
 * @hidden
 */
export type UnconfirmedApplyToGuild = TxIntent & {
  methodName: "df__applyToGuild";
  guildId: GuildId;
};

/**
 * @hidden
 */
export type UnconfirmedApproveApplication = TxIntent & {
  methodName: "df__approveApplication";
  guildId: GuildId;
  applicant: EthAddress;
};

/**
 * @hidden
 */
export type UnconfirmedLeaveGuild = TxIntent & {
  methodName: "df__leaveGuild";
  guildId: GuildId;
};

/**
 * @hidden
 */
export type UnconfirmedTransferGuildLeadership = TxIntent & {
  methodName: "df__transferGuildLeadership";
  guildId: GuildId;
  newOwner: EthAddress;
};

/**
 * @hidden
 */
export type UnconfirmedDisbandGuild = TxIntent & {
  methodName: "df__disbandGuild";
  guildId: GuildId;
};

/**
 * @hidden
 */
export type UnconfirmedSetGrant = TxIntent & {
  methodName: "df__setGrant";
  guildId: GuildId;
  newGrant: GuildRole;
};

/**
 * @hidden
 */
export type UnconfirmedSetMemberRole = TxIntent & {
  methodName: "df__setMemberRole";
  guildId: GuildId;
  newRole: GuildRole;
  member: EthAddress;
};

/**
 * @hidden
 */
export type UnconfirmedKickMember = TxIntent & {
  methodName: "df__kickMember";
  guildId: GuildId;
  member: EthAddress;
};

/**
 * @hidden
 */
export type UnconfirmedBuyGPTTokens = TxIntent & {
  methodName: "df__buyGPTTokens";
  amount: number;
};

/**
 * @hidden
 */
export type UnconfirmedSpendGPTTokens = TxIntent & {
  methodName: "df__spendGPTTokens";
  amount: number;
};

/**
 * @hidden
 */
export type UnconfirmedSendGPTTokens = TxIntent & {
  methodName: "df__sendGPTTokens";
  player: EthAddress;
  amount: number;
};

/**
 * @hidden
 */
export type UnconfirmedRevertMove = TxIntent & {
  methodName: "df__revertMove";
  moveId: string;
  toPlanetHash: LocationId;
  moveIndex: number;
};
