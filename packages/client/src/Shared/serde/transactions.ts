import type {
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
  UnconfirmedBuyJunk,
  UnconfirmedBuyPlanet,
  UnconfirmedBuySpaceship,
  UnconfirmedCapturePlanet,
  UnconfirmedChangeArtifactImageType,
  UnconfirmedChargeArtifact,
  UnconfirmedClaim,
  UnconfirmedClearJunk,
  UnconfirmedCreateGuild,
  UnconfirmedDeactivateArtifact,
  UnconfirmedDepositArtifact,
  UnconfirmedDisbandGuild,
  UnconfirmedDonate,
  UnconfirmedFindArtifact,
  UnconfirmedGetShips,
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
  UnconfirmedReveal,
  UnconfirmedRevertMove,
  UnconfirmedSendApplication,
  UnconfirmedSendGPTTokens,
  UnconfirmedSetGrant,
  UnconfirmedSetMemberRole,
  UnconfirmedSetPlanetEmoji,
  UnconfirmedShutdownArtifact,
  UnconfirmedSpendGPTTokens,
  UnconfirmedTransferGuildLeadership,
  UnconfirmedTransferLeaderRole,
  UnconfirmedUpgrade,
  UnconfirmedUseKey,
  UnconfirmedWithdrawArtifact,
  UnconfirmedWithdrawMaterial,
  UnconfirmedWithdrawSilver,
} from "@df/types";

// @todo:
// - these `isUnconfirmedX` should be named something that matches the naming convention of the
//   `TxIntent` subtypes - `isXIntent`
// - these `isUnconfirmedX` should check something more than the method name

export function isUnconfirmedReveal(
  txIntent: TxIntent,
): txIntent is UnconfirmedReveal {
  return txIntent.methodName === "df__legacyRevealLocation";
}

export function isUnconfirmedClaim(
  txIntent: TxIntent,
): txIntent is UnconfirmedClaim {
  return txIntent.methodName === "claimLocation";
}

export function isUnconfirmedInit(
  txIntent: TxIntent,
): txIntent is UnconfirmedInit {
  return txIntent.methodName === "df__initializePlayer";
}

export function isUnconfirmedMove(
  txIntent: TxIntent,
): txIntent is UnconfirmedMove {
  return txIntent.methodName === "df__legacyMove";
}

export function isUnconfirmedRelease(
  txIntent: TxIntent,
): txIntent is UnconfirmedMove {
  return isUnconfirmedMove(txIntent) && txIntent.abandoning;
}

export function isUnconfirmedUpgrade(
  txIntent: TxIntent,
): txIntent is UnconfirmedUpgrade {
  return txIntent.methodName === "df__legacyUpgradePlanet";
}

export function isUnconfirmedRefreshPlanet(
  txIntent: TxIntent,
): txIntent is UnconfirmedRefreshPlanet {
  return txIntent.methodName === "refreshPlanet";
}

export function isUnconfirmedBuyHat(
  txIntent: TxIntent,
): txIntent is UnconfirmedBuyHat {
  return txIntent.methodName === "buySkin";
}

export function isUnconfirmedTransfer(
  txIntent: TxIntent,
): txIntent is UnconfirmedPlanetTransfer {
  return txIntent.methodName === "transferPlanet";
}

export function isUnconfirmedFindArtifact(
  txIntent: TxIntent,
): txIntent is UnconfirmedFindArtifact {
  return txIntent.methodName === "df__findArtifact";
}

export function isUnconfirmedDepositArtifact(
  txIntent: TxIntent,
): txIntent is UnconfirmedDepositArtifact {
  return txIntent.methodName === "depositArtifact";
}

export function isUnconfirmedWithdrawArtifact(
  txIntent: TxIntent,
): txIntent is UnconfirmedWithdrawArtifact {
  return txIntent.methodName === "withdrawArtifact";
}

export function isUnconfirmedProspectPlanet(
  txIntent: TxIntent,
): txIntent is UnconfirmedProspectPlanet {
  return txIntent.methodName === "df__prospectPlanet";
}

export function isUnconfirmedActivateArtifact(
  txIntent: TxIntent,
): txIntent is UnconfirmedActivateArtifact {
  return txIntent.methodName === "df__activateArtifact";
}

export function isUnconfirmedShutdownArtifact(
  txIntent: TxIntent,
): txIntent is UnconfirmedShutdownArtifact {
  return txIntent.methodName === "df__shutdownArtifact";
}

export function isUnconfirmedChargeArtifact(
  txIntent: TxIntent,
): txIntent is UnconfirmedChargeArtifact {
  return txIntent.methodName === "df__chargeArtifact";
}

export function isUnconfirmedDeactivateArtifact(
  txIntent: TxIntent,
): txIntent is UnconfirmedDeactivateArtifact {
  return txIntent.methodName === "deactivateArtifact";
}

export function isUnconfirmedChangeArtifactImageType(
  txIntent: TxIntent,
): txIntent is UnconfirmedChangeArtifactImageType {
  return txIntent.methodName === "changeArtifactImageType";
}

export function isUnconfirmedBuyArtifact(
  txIntent: TxIntent,
): txIntent is UnconfirmedBuyArtifact {
  return txIntent.methodName === "buyArtifact";
}

export function isUnconfirmedWithdrawSilver(
  txIntent: TxIntent,
): txIntent is UnconfirmedWithdrawSilver {
  return txIntent.methodName === "df__withdrawSilver";
}

export function isUnconfirmedWithdrawMaterial(
  txIntent: TxIntent,
): txIntent is UnconfirmedWithdrawMaterial {
  return txIntent.methodName === "df__withdrawMaterial";
}

export function isUnconfirmedAddJunk(
  txIntent: TxIntent,
): txIntent is UnconfirmedAddJunk {
  return txIntent.methodName === "df__addJunk";
}

export function isUnconfirmedClearJunk(
  txIntent: TxIntent,
): txIntent is UnconfirmedClearJunk {
  return txIntent.methodName === "df__clearJunk";
}

export function isUnconfirmedBuyJunk(
  txIntent: TxIntent,
): txIntent is UnconfirmedBuyJunk {
  return txIntent.methodName === "df__buyJunk";
}

export function isUnconfirmedSetPlanetEmoji(
  txIntent: TxIntent,
): txIntent is UnconfirmedSetPlanetEmoji {
  return txIntent.methodName === "df__setPlanetEmoji";
}

export function isUnconfirmedGetShips(
  txIntent: TxIntent,
): txIntent is UnconfirmedGetShips {
  return txIntent.methodName === "giveSpaceShips";
}

export function isUnconfirmedCapturePlanet(
  txIntent: TxIntent,
): txIntent is UnconfirmedCapturePlanet {
  return txIntent.methodName === "capturePlanet";
}

export function isUnconfirmedBurn(
  txIntent: TxIntent,
): txIntent is UnconfirmedBurn {
  return txIntent.methodName === "burnLocation";
}

export function isUnconfirmedPink(
  txIntent: TxIntent,
): txIntent is UnconfirmedPink {
  return txIntent.methodName === "pinkLocation";
}

export function isUnconfirmedKardashev(
  txIntent: TxIntent,
): txIntent is UnconfirmedKardashev {
  return txIntent.methodName === "kardashev";
}

export function isUnconfirmedBlue(
  txIntent: TxIntent,
): txIntent is UnconfirmedBlue {
  return txIntent.methodName === "blueLocation";
}

export function isUnconfirmedBuyPlanet(
  txIntent: TxIntent,
): txIntent is UnconfirmedBuyPlanet {
  return txIntent.methodName === "buyPlanet";
}

export function isUnconfirmedBuySpaceship(
  txIntent: TxIntent,
): txIntent is UnconfirmedBuySpaceship {
  return txIntent.methodName === "buySpaceship";
}

export function isUnconfirmedDonate(
  txIntent: TxIntent,
): txIntent is UnconfirmedDonate {
  return txIntent.methodName === "donate";
}

export function isUnconfirmedInvadePlanet(
  txIntent: TxIntent,
): txIntent is UnconfirmedInvadePlanet {
  return txIntent.methodName === "invadePlanet";
}

export function isUnconfirmedUseKey(
  txIntent: TxIntent,
): txIntent is UnconfirmedUseKey {
  return txIntent.methodName === "useKey";
}

export function isUnconfirmedCreateGuild(
  txIntent: TxIntent,
): txIntent is UnconfirmedCreateGuild {
  return txIntent.methodName === "df__createGuild";
}

export function isUnconfirmedInviteToGuild(
  txIntent: TxIntent,
): txIntent is UnconfirmedInviteToGuild {
  return txIntent.methodName === "df__inviteToGuild";
}

export function isUnconfirmedAcceptInvitation(
  txIntent: TxIntent,
): txIntent is UnconfirmedAcceptInvitation {
  return txIntent.methodName === "df__acceptInvitation";
}

export function isUnconfirmedApplyToGuild(
  txIntent: TxIntent,
): txIntent is UnconfirmedApplyToGuild {
  return txIntent.methodName === "df__applyToGuild";
}

export function isUnconfirmedApproveApplication(
  txIntent: TxIntent,
): txIntent is UnconfirmedApproveApplication {
  return txIntent.methodName === "df__approveApplication";
}

export function isUnconfirmedLeaveGuild(
  txIntent: TxIntent,
): txIntent is UnconfirmedLeaveGuild {
  return txIntent.methodName === "df__leaveGuild";
}

export function isUnconfirmedTransferGuildLeadership(
  txIntent: TxIntent,
): txIntent is UnconfirmedTransferGuildLeadership {
  return txIntent.methodName === "df__transferGuildLeadership";
}

export function isUnconfirmedDisbandGuild(
  txIntent: TxIntent,
): txIntent is UnconfirmedDisbandGuild {
  return txIntent.methodName === "df__disbandGuild";
}

export function isUnconfirmedSetGrant(
  txIntent: TxIntent,
): txIntent is UnconfirmedSetGrant {
  return txIntent.methodName === "df__setGrant";
}

export function isUnconfirmedSetMemberRole(
  txIntent: TxIntent,
): txIntent is UnconfirmedSetMemberRole {
  return txIntent.methodName === "df__setMemberRole";
}

export function isUnconfirmedKickMember(
  txIntent: TxIntent,
): txIntent is UnconfirmedKickMember {
  return txIntent.methodName === "df__kickMember";
}

export function isUnconfirmedBuyGPTTokens(
  txIntent: TxIntent,
): txIntent is UnconfirmedBuyGPTTokens {
  return txIntent.methodName === "buyGPTTokens";
}

export function isUnconfirmedSpendGPTTokens(
  txIntent: TxIntent,
): txIntent is UnconfirmedSpendGPTTokens {
  return txIntent.methodName === "spendGPTTokens";
}

export function isUnconfirmedSendGPTTokens(
  txIntent: TxIntent,
): txIntent is UnconfirmedSendGPTTokens {
  return txIntent.methodName === "sendGPTTokens";
}

export function isUnconfirmedRevealTx(
  tx: Transaction,
): tx is Transaction<UnconfirmedReveal> {
  return isUnconfirmedReveal(tx.intent);
}

export function isUnconfirmedClaimTx(
  tx: Transaction,
): tx is Transaction<UnconfirmedReveal> {
  return isUnconfirmedClaim(tx.intent);
}

export function isUnconfirmedInitTx(
  tx: Transaction,
): tx is Transaction<UnconfirmedInit> {
  return isUnconfirmedInit(tx.intent);
}

export function isUnconfirmedMoveTx(
  tx: Transaction,
): tx is Transaction<UnconfirmedMove> {
  return isUnconfirmedMove(tx.intent);
}

export function isUnconfirmedReleaseTx(
  tx: Transaction,
): tx is Transaction<UnconfirmedMove> {
  return isUnconfirmedRelease(tx.intent);
}

export function isUnconfirmedUpgradeTx(
  tx: Transaction,
): tx is Transaction<UnconfirmedUpgrade> {
  return isUnconfirmedUpgrade(tx.intent);
}

export function isUnconfirmedRefreshPlanetTx(
  tx: Transaction,
): tx is Transaction<UnconfirmedRefreshPlanet> {
  return isUnconfirmedRefreshPlanet(tx.intent);
}

export function isUnconfirmedBuyHatTx(
  tx: Transaction,
): tx is Transaction<UnconfirmedBuyHat> {
  return isUnconfirmedBuyHat(tx.intent);
}

export function isUnconfirmedTransferTx(
  tx: Transaction,
): tx is Transaction<UnconfirmedPlanetTransfer> {
  return isUnconfirmedTransfer(tx.intent);
}

export function isUnconfirmedFindArtifactTx(
  tx: Transaction,
): tx is Transaction<UnconfirmedFindArtifact> {
  return isUnconfirmedFindArtifact(tx.intent);
}

export function isUnconfirmedDepositArtifactTx(
  tx: Transaction,
): tx is Transaction<UnconfirmedDepositArtifact> {
  return isUnconfirmedDepositArtifact(tx.intent);
}

export function isUnconfirmedWithdrawArtifactTx(
  tx: Transaction,
): tx is Transaction<UnconfirmedWithdrawArtifact> {
  return isUnconfirmedWithdrawArtifact(tx.intent);
}

export function isUnconfirmedProspectPlanetTx(
  tx: Transaction,
): tx is Transaction<UnconfirmedProspectPlanet> {
  return isUnconfirmedProspectPlanet(tx.intent);
}

export function isUnconfirmedActivateArtifactTx(
  tx: Transaction,
): tx is Transaction<UnconfirmedActivateArtifact> {
  return isUnconfirmedActivateArtifact(tx.intent);
}

export function isUnconfirmedShutdownArtifactTx(
  tx: Transaction,
): tx is Transaction<UnconfirmedShutdownArtifact> {
  return isUnconfirmedShutdownArtifact(tx.intent);
}

export function isUnconfirmedChargeArtifactTx(
  tx: Transaction,
): tx is Transaction<UnconfirmedChargeArtifact> {
  return isUnconfirmedChargeArtifact(tx.intent);
}

export function isUnconfirmedDeactivateArtifactTx(
  tx: Transaction,
): tx is Transaction<UnconfirmedDeactivateArtifact> {
  return isUnconfirmedDeactivateArtifact(tx.intent);
}

export function isUnconfirmedChangeArtifactImageTypeTx(
  tx: Transaction,
): tx is Transaction<UnconfirmedDeactivateArtifact> {
  return isUnconfirmedChangeArtifactImageType(tx.intent);
}

export function isUnconfirmedBuyArtifactTx(
  tx: Transaction,
): tx is Transaction<UnconfirmedBuyArtifact> {
  return isUnconfirmedBuyArtifact(tx.intent);
}

export function isUnconfirmedWithdrawSilverTx(
  tx: Transaction,
): tx is Transaction<UnconfirmedWithdrawSilver> {
  return isUnconfirmedWithdrawSilver(tx.intent);
}

export function isUnconfirmedWithdrawMaterialTx(
  tx: Transaction,
): tx is Transaction<UnconfirmedWithdrawMaterial> {
  return isUnconfirmedWithdrawMaterial(tx.intent);
}

export function isUnconfirmedAddJunkTx(
  tx: Transaction,
): tx is Transaction<UnconfirmedAddJunk> {
  return isUnconfirmedAddJunk(tx.intent);
}

export function isUnconfirmedClearJunkTx(
  tx: Transaction,
): tx is Transaction<UnconfirmedClearJunk> {
  return isUnconfirmedClearJunk(tx.intent);
}

export function isUnconfirmedBuyJunkTx(
  tx: Transaction,
): tx is Transaction<UnconfirmedBuyJunk> {
  return isUnconfirmedBuyJunk(tx.intent);
}

export function isUnconfirmedSetPlanetEmojiTx(
  tx: Transaction,
): tx is Transaction<UnconfirmedSetPlanetEmoji> {
  return isUnconfirmedSetPlanetEmoji(tx.intent);
}

export function isUnconfirmedGetShipsTx(
  tx: Transaction,
): tx is Transaction<UnconfirmedGetShips> {
  return isUnconfirmedGetShips(tx.intent);
}

export function isUnconfirmedInvadePlanetTx(
  tx: Transaction,
): tx is Transaction<UnconfirmedInvadePlanet> {
  return isUnconfirmedInvadePlanet(tx.intent);
}

export function isUnconfirmedCapturePlanetTx(
  tx: Transaction,
): tx is Transaction<UnconfirmedCapturePlanet> {
  return isUnconfirmedCapturePlanet(tx.intent);
}

export function isUnconfirmedBurnTx(
  tx: Transaction,
): tx is Transaction<UnconfirmedBurn> {
  return isUnconfirmedBurn(tx.intent);
}

export function isUnconfirmedPinkTx(
  tx: Transaction,
): tx is Transaction<UnconfirmedPink> {
  return isUnconfirmedPink(tx.intent);
}

export function isUnconfirmedUseKeyTx(
  tx: Transaction,
): tx is Transaction<UnconfirmedUseKey> {
  return isUnconfirmedUseKey(tx.intent);
}

export function isUnconfirmedKardashevTx(
  tx: Transaction,
): tx is Transaction<UnconfirmedKardashev> {
  return isUnconfirmedKardashev(tx.intent);
}

export function isUnconfirmedBlueTx(
  tx: Transaction,
): tx is Transaction<UnconfirmedBlue> {
  return isUnconfirmedBlue(tx.intent);
}

export function isUnconfirmedBuyPlanetTx(
  tx: Transaction,
): tx is Transaction<UnconfirmedBuyPlanet> {
  return isUnconfirmedBuyPlanet(tx.intent);
}

export function isUnconfirmedBuySpaceshipTx(
  tx: Transaction,
): tx is Transaction<UnconfirmedBuySpaceship> {
  return isUnconfirmedBuySpaceship(tx.intent);
}

export function isUnconfirmedDonateTx(
  tx: Transaction,
): tx is Transaction<UnconfirmedDonate> {
  return isUnconfirmedDonate(tx.intent);
}

export function isUnconfirmedCreateGuildTx(
  tx: Transaction,
): tx is Transaction<UnconfirmedCreateGuild> {
  return isUnconfirmedCreateGuild(tx.intent);
}

export function isUnconfirmedInviteToGuildTx(
  tx: Transaction,
): tx is Transaction<UnconfirmedInviteToGuild> {
  return isUnconfirmedInviteToGuild(tx.intent);
}

export function isUnconfirmedAcceptInvitationTx(
  tx: Transaction,
): tx is Transaction<UnconfirmedAcceptInvitation> {
  return isUnconfirmedAcceptInvitation(tx.intent);
}

export function isUnconfirmedApplyToGuildTx(
  tx: Transaction,
): tx is Transaction<UnconfirmedApplyToGuild> {
  return isUnconfirmedApplyToGuild(tx.intent);
}

export function isUnconfirmedApproveApplicationTx(
  tx: Transaction,
): tx is Transaction<UnconfirmedApproveApplication> {
  return isUnconfirmedApproveApplication(tx.intent);
}

export function isUnconfirmedLeaveGuildTx(
  tx: Transaction,
): tx is Transaction<UnconfirmedLeaveGuild> {
  return isUnconfirmedLeaveGuild(tx.intent);
}

export function isUnconfirmedTransferGuildLeadershipTx(
  tx: Transaction,
): tx is Transaction<UnconfirmedTransferGuildLeadership> {
  return isUnconfirmedTransferGuildLeadership(tx.intent);
}

export function isUnconfirmedDisbandGuildTx(
  tx: Transaction,
): tx is Transaction<UnconfirmedDisbandGuild> {
  return isUnconfirmedDisbandGuild(tx.intent);
}

export function isUnconfirmedSetGrantTx(
  tx: Transaction,
): tx is Transaction<UnconfirmedSetGrant> {
  return isUnconfirmedSetGrant(tx.intent);
}

export function isUnconfirmedSetMemberRoleTx(
  tx: Transaction,
): tx is Transaction<UnconfirmedSetMemberRole> {
  return isUnconfirmedSetMemberRole(tx.intent);
}

export function isUnconfirmedKickMemberTx(
  tx: Transaction,
): tx is Transaction<UnconfirmedKickMember> {
  return isUnconfirmedKickMember(tx.intent);
}

export function isUnconfirmedBuyGPTTokensTx(
  tx: Transaction,
): tx is Transaction<UnconfirmedBuyGPTTokens> {
  return isUnconfirmedBuyGPTTokens(tx.intent);
}
export function isUnconfirmedSendGPTTokensTx(
  tx: Transaction,
): tx is Transaction<UnconfirmedSendGPTTokens> {
  return isUnconfirmedSendGPTTokens(tx.intent);
}
export function isUnconfirmedSpendGPTTokensTx(
  tx: Transaction,
): tx is Transaction<UnconfirmedSpendGPTTokens> {
  return isUnconfirmedSpendGPTTokens(tx.intent);
}

export function isUnconfirmedRevertMove(
  txIntent: TxIntent,
): txIntent is UnconfirmedRevertMove {
  return txIntent.methodName === "df__revertMove";
}

export function isUnconfirmedRevertMoveTx(
  tx: Transaction,
): tx is Transaction<UnconfirmedRevertMove> {
  return isUnconfirmedRevertMove(tx.intent);
}
