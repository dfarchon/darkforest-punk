import { EMPTY_ADDRESS } from "@df/constants";
import type { Monomitter } from "@df/events";
import { monomitter } from "@df/events";
import {
  biomeName,
  isArtifactSpaceShip,
  isLocatable,
  isSpaceShip,
} from "@df/gamelogic";
import { isBroken } from "@df/gamelogic";
import { planetHasBonus } from "@df/hexgen";
import type { EthConnection } from "@df/network";
import type { GameGLManager } from "@df/renderer";
import { Renderer } from "@df/renderer";
import { isUnconfirmedMoveTx } from "@df/serde";
import type {
  Artifact,
  ArtifactId,
  BaseRenderer,
  Biome,
  Chunk,
  Diagnostics,
  EthAddress,
  Link,
  LocatablePlanet,
  LocationId,
  MaterialAmount,
  MaterialId,
  MaterialType,
  PerlinConfig,
  Planet,
  Player,
  QueuedArrival,
  Rectangle,
  Transaction,
  UnconfirmedActivateArtifact,
  UnconfirmedMove,
  UnconfirmedRefreshPlanet,
  UnconfirmedRevertMove,
  UnconfirmedSpendGPTTokens,
  UnconfirmedUpgrade,
  Upgrade,
  UpgradeBranchName,
  WorldCoords,
  WorldLocation,
} from "@df/types";
import {
  ArtifactRarity,
  ArtifactType,
  CursorState,
  PlanetLevel,
  PlanetType,
  Setting,
  SpaceType,
} from "@df/types";
import autoBind from "auto-bind";
import type { BigNumber } from "ethers";
import EventEmitter from "events";
import { Howl } from "howler";
import deferred from "p-defer";
import type React from "react";
import type { Hex } from "viem";

import type { ContractConstants } from "../../_types/darkforest/api/ContractsAPITypes";
import type { HashConfig } from "../../_types/global/GlobalTypes";
import ModalManager from "../../Frontend/Game/ModalManager";
import NotificationManager from "../../Frontend/Game/NotificationManager";
import Viewport from "../../Frontend/Game/Viewport";
import { getObjectWithIdFromMap } from "../../Frontend/Utils/EmitterUtils";
import {
  listenForKeyboardEvents,
  unlinkKeyboardEvents,
} from "../../Frontend/Utils/KeyEmitters";
import {
  getBooleanSetting,
  getNumberSetting,
  getSetting,
  setBooleanSetting,
  settingChanged$,
} from "../../Frontend/Utils/SettingsHooks";
import UIEmitter, { UIEmitterEvent } from "../../Frontend/Utils/UIEmitter";
import type { TerminalHandle } from "../../Frontend/Views/Terminal";
import { getSpaceshipBonuses } from "../../Utils/SpaceshipBonusUtils";
import type { MiningPattern } from "../Miner/MiningPatterns";
import { coordsEqual } from "../Utils/Coordinates";
import type { GameManager } from "./GameManager";
import { GameManagerEvent } from "./GameManager";
import type { GameObjects } from "./GameObjects";
import type { GuildUtils } from "./GuildUtils";
import { PluginManager } from "./PluginManager";
import TutorialManager, { TutorialState } from "./TutorialManager";
import { ViewportEntities } from "./ViewportEntities";

// Hover delay in milliseconds
const MULTI_MOVE_HOVER_DELAY = 500;

export const enum GameUIManagerEvent {
  InitializedPlayer = "InitializedPlayer",
  InitializedPlayerError = "InitializedPlayerError",
}

export class GameUIManager extends EventEmitter {
  private readonly radiusMap: { [PlanetLevel: number]: number };
  private readonly gameManager: GameManager;
  private modalManager: ModalManager;

  private terminal: React.MutableRefObject<TerminalHandle | undefined>;

  /**
   * In order to render React on top of the game, we need to insert React nodes into an overlay
   * container. We keep a reference to this container, so that our React components can optionally
   * choose to render themselves into this overlay container using React Portals.
   */
  private overlayContainer?: HTMLDivElement;
  private previousSelectedPlanetId: LocationId | undefined;
  private selectedPlanetId: LocationId | undefined;
  private selectedCoords: WorldCoords | undefined;
  private mouseDownOverPlanet: LocatablePlanet | undefined;
  private mouseDownOverCoords: WorldCoords | undefined;
  private mouseHoveringOverPlanet: LocatablePlanet | undefined;
  private mouseHoveringOverCoords: WorldCoords | undefined;
  private mouseHoveringOverArtifactId: ArtifactId | undefined;
  private mouseHoveringOverVoyage: QueuedArrival | undefined;
  private selectedVoyage: QueuedArrival | undefined;
  private multipleMovesAtCoords: QueuedArrival[] | undefined;
  private showMultiMoveSelector: boolean = false;
  private multiMoveSelectorPosition: { x: number; y: number } = { x: 0, y: 0 };
  private multiMoveHoverTimeout: NodeJS.Timeout | null = null;
  private sendingPlanet: LocatablePlanet | undefined;
  private sendingCoords: WorldCoords | undefined;
  private isSending = false;
  private abandoning = false;
  private viewportEntities: ViewportEntities;

  /**
   * The Link artifact requires you to choose a target planet. This value
   * indicates whether or not the player is currently selecting a target planet.
   */
  private isChoosingTargetPlanet = false;

  private onChooseTargetPlanet?: (planet: LocatablePlanet | undefined) => void;

  private linkSourceArtifactType = ArtifactType.Unknown;
  private linkSourceArtifactRarity = ArtifactRarity.Unknown;

  // TODO: Remove later and just use minerLocations array
  private minerLocation: WorldCoords | undefined;
  private extraMinerLocations: WorldCoords[] = [];

  private forcesSending: { [key: string]: number } = {}; // this is a percentage
  private silverSending: { [key: string]: number } = {}; // this is a percentage
  private materialSending: { [key: string]: number } = {}; // this is a percentage

  private artifactSending: { [key: string]: Artifact | undefined } = {};

  private plugins: PluginManager;

  public readonly selectedPlanetId$: Monomitter<LocationId | undefined>;
  public readonly hoverPlanetId$: Monomitter<LocationId | undefined>;
  public readonly hoverPlanet$: Monomitter<Planet | undefined>;
  public readonly hoverArtifactId$: Monomitter<ArtifactId | undefined>;
  public readonly hoverArtifact$: Monomitter<Artifact | undefined>;
  public readonly hoverVoyage$: Monomitter<QueuedArrival | undefined>;
  public readonly selectedVoyage$: Monomitter<QueuedArrival | undefined>;
  public readonly multipleMoves$: Monomitter<QueuedArrival[] | undefined>;
  public readonly showMultiMoveSelector$: Monomitter<boolean>;
  public readonly multiMoveSelectorPosition$: Monomitter<{
    x: number;
    y: number;
  }>;
  public readonly myArtifacts$: Monomitter<Map<ArtifactId, Artifact>>;

  public readonly isSending$: Monomitter<boolean>;
  public readonly isAbandoning$: Monomitter<boolean>;
  public readonly artifactSending$: Monomitter<
    { planetId: LocationId; artifact: Artifact | undefined } | undefined
  >;

  private planetHoveringInRenderer = false;
  private mudComponents: any = null; // eslint-disable-line @typescript-eslint/no-explicit-any

  // lifecycle methods

  private constructor(
    gameManager: GameManager,
    terminalHandle: React.MutableRefObject<TerminalHandle | undefined>,
  ) {
    super();

    this.gameManager = gameManager;
    this.terminal = terminalHandle;

    // if planets are more dense, make radii smaller
    // if planets are less dense, make radii larger
    // the default radii are tuned for a default planet rarity of 16384
    const scaleFactor = Math.sqrt(this.gameManager.getPlanetRarity() / 16384);

    // TODO: will radii this large degrade performance?
    this.radiusMap = {
      [PlanetLevel.ZERO]: 1 * scaleFactor,
      [PlanetLevel.ONE]: 3 * scaleFactor,
      [PlanetLevel.TWO]: 9 * scaleFactor,
      [PlanetLevel.THREE]: 27 * scaleFactor,
      [PlanetLevel.FOUR]: 81 * scaleFactor,
      [PlanetLevel.FIVE]: 243 * scaleFactor,
      [PlanetLevel.SIX]: 486 * scaleFactor,
      [PlanetLevel.SEVEN]: 729 * scaleFactor,
      [PlanetLevel.EIGHT]: 972 * scaleFactor,
      [PlanetLevel.NINE]: 1215 * scaleFactor,
    } as const;

    this.plugins = new PluginManager(gameManager);

    this.selectedPlanetId$ = monomitter<LocationId | undefined>(true);
    this.hoverPlanetId$ = monomitter<LocationId | undefined>();
    this.hoverPlanet$ = getObjectWithIdFromMap<Planet, LocationId>(
      this.getPlanetMap(),
      this.hoverPlanetId$,
      this.gameManager.getPlanetUpdated$(),
    );

    this.hoverArtifactId$ = monomitter<ArtifactId | undefined>();
    this.hoverArtifact$ = getObjectWithIdFromMap<Artifact, ArtifactId>(
      this.getArtifactMap(),
      this.hoverArtifactId$,
      this.gameManager.getArtifactUpdated$(),
    );
    this.hoverVoyage$ = monomitter<QueuedArrival | undefined>();
    this.selectedVoyage$ = monomitter<QueuedArrival | undefined>();
    this.multipleMoves$ = monomitter<QueuedArrival[] | undefined>();
    this.showMultiMoveSelector$ = monomitter<boolean>();
    this.multiMoveSelectorPosition$ = monomitter<{ x: number; y: number }>();
    this.myArtifacts$ = this.gameManager.getMyArtifactsUpdated$();
    this.viewportEntities = new ViewportEntities(this.gameManager, this);

    this.isSending$ = monomitter(true);
    this.isAbandoning$ = monomitter(true);
    this.artifactSending$ = monomitter<
      { planetId: LocationId; artifact: Artifact | undefined } | undefined
    >();

    settingChanged$.subscribe((setting) => {
      // If user selects to always use the default energy level, we need to clear existing energy send level values set.
      if (
        setting === Setting.PlanetDefaultEnergyLevelToSendReset &&
        this.getBooleanSetting(Setting.PlanetDefaultEnergyLevelToSendReset)
      ) {
        for (const id of Object.keys(this.forcesSending)) {
          delete this.forcesSending[id];
        }
      }
    });

    autoBind(this);
  }

  /**
   * Sets the overlay container. See {@link GameUIManger.overlayContainer} for more information
   * about what the overlay container is.
   */
  public setOverlayContainer(randomContainer?: HTMLDivElement) {
    this.overlayContainer = randomContainer;
  }

  /**
   * Gets the overlay container. See {@link GameUIManger.overlayContainer} for more information
   * about what the overlay container is.
   */
  public getOverlayContainer(): HTMLDivElement | undefined {
    return this.overlayContainer;
  }

  public static async create(
    gameManager: GameManager,
    terminalHandle: React.MutableRefObject<TerminalHandle | undefined>,
  ) {
    listenForKeyboardEvents();
    const uiEmitter = UIEmitter.getInstance();

    const uiManager = new GameUIManager(gameManager, terminalHandle);
    const modalManager = await ModalManager.create(gameManager.getChunkStore());

    uiManager.setModalManager(modalManager);

    uiEmitter.on(UIEmitterEvent.WorldMouseDown, uiManager.onMouseDown);
    uiEmitter.on(UIEmitterEvent.WorldMouseClick, uiManager.onMouseClick);
    uiEmitter.on(UIEmitterEvent.WorldMouseMove, uiManager.onMouseMove);
    uiEmitter.on(UIEmitterEvent.WorldMouseUp, uiManager.onMouseUp);
    uiEmitter.on(UIEmitterEvent.WorldMouseOut, uiManager.onMouseOut);

    uiEmitter.on(UIEmitterEvent.SendInitiated, uiManager.onSendInit);
    uiEmitter.on(UIEmitterEvent.SendCancelled, uiManager.onSendCancel);
    uiEmitter.on(UIEmitterEvent.SendCompleted, uiManager.onSendComplete);

    gameManager.on(GameManagerEvent.PlanetUpdate, uiManager.updatePlanets);
    gameManager.on(
      GameManagerEvent.DiscoveredNewChunk,
      uiManager.onDiscoveredChunk,
    );

    return uiManager;
  }

  public destroy(): void {
    unlinkKeyboardEvents();
    const uiEmitter = UIEmitter.getInstance();

    uiEmitter.removeListener(UIEmitterEvent.WorldMouseDown, this.onMouseDown);
    uiEmitter.removeListener(UIEmitterEvent.WorldMouseClick, this.onMouseClick);
    uiEmitter.removeListener(UIEmitterEvent.WorldMouseMove, this.onMouseMove);
    uiEmitter.removeListener(UIEmitterEvent.WorldMouseUp, this.onMouseUp);
    uiEmitter.removeListener(UIEmitterEvent.WorldMouseOut, this.onMouseOut);

    uiEmitter.removeListener(UIEmitterEvent.SendInitiated, this.onSendInit);
    uiEmitter.removeListener(UIEmitterEvent.SendCancelled, this.onSendCancel);
    uiEmitter.removeListener(UIEmitterEvent.SendCompleted, this.onSendComplete);

    this.gameManager.removeListener(
      GameManagerEvent.PlanetUpdate,
      this.updatePlanets,
    );
    this.gameManager.removeListener(
      GameManagerEvent.InitializedPlayer,
      this.onEmitInitializedPlayer,
    );
    this.gameManager.removeListener(
      GameManagerEvent.InitializedPlayerError,
      this.onEmitInitializedPlayerError,
    );
    this.gameManager.removeListener(
      GameManagerEvent.DiscoveredNewChunk,
      this.onDiscoveredChunk,
    );

    this.gameManager.destroy();
    this.selectedPlanetId$.clear();
    this.hoverArtifactId$.clear();
    this.hoverVoyage$.clear();
    this.selectedVoyage$.clear();
    this.multipleMoves$.clear();
    this.showMultiMoveSelector$.clear();
    this.multiMoveSelectorPosition$.clear();
  }

  public getStringSetting(setting: Setting): string | undefined {
    const account = this.getEthConnection().getAddress();
    const config = {
      contractAddress: this.getContractAddress(),
      account,
    };

    return account && getSetting(config, setting);
  }

  public getBooleanSetting(setting: Setting): boolean {
    const account = this.getEthConnection().getAddress();

    if (!account) {
      return false;
    }

    const config = { contractAddress: this.getContractAddress(), account };

    return getBooleanSetting(config, setting);
  }

  public getDiagnostics(): Diagnostics {
    return this.gameManager.getDiagnostics();
  }

  public updateDiagnostics(updateFn: (d: Diagnostics) => void) {
    this.gameManager.updateDiagnostics(updateFn);
  }

  public getEthConnection(): EthConnection {
    return this.gameManager.getEthConnection();
  }

  public getContractAddress(): EthAddress {
    return this.gameManager.getContractAddress();
  }

  // actions

  public centerPlanet(planet: LocatablePlanet | undefined) {
    if (planet) {
      Viewport.getInstance().centerPlanet(planet);
      this.setSelectedPlanet(planet);
    }
  }

  public centerCoords(coords: WorldCoords) {
    const planet = this.gameManager.getPlanetWithCoords(coords);
    if (planet && isLocatable(planet)) {
      this.centerPlanet(planet);
    } else {
      Viewport.getInstance().centerCoords(coords);
    }
  }

  public centerLocationId(planetId: LocationId) {
    const planet = this.getPlanetWithId(planetId);
    if (planet && isLocatable(planet)) {
      this.centerPlanet(planet);
    }
  }

  public getCurrentTick(): number {
    return this.gameManager.getCurrentTick();
  }

  public getCurrentTickerRate(): number {
    return this.gameManager.getCurrentTickerRate();
  }

  public convertTickToMs(tick: number): number {
    return this.gameManager.convertTickToMs(tick);
  }

  public joinGame(
    beforeRetry: (e: Error) => Promise<boolean>,
    _selectedCoords: { x: number; y: number },
    spectate: boolean,
  ): Promise<void> {
    this.playClickSound();
    return this.gameManager.joinGame(beforeRetry, _selectedCoords, spectate);
  }

  public addAccount(coords: WorldCoords): Promise<boolean> {
    return this.gameManager.addAccount(coords);
  }

  // public verifyTwitter(twitter: string): Promise<boolean> {
  //   return this.gameManager.submitVerifyTwitter(twitter);
  // }

  // public disconnectTwitter(twitter: string) {
  //   return this.gameManager.submitDisconnectTwitter(twitter);
  // }

  public getPluginManager(): PluginManager {
    return this.plugins;
  }

  public getPrivateKey(): string | undefined {
    return this.gameManager.getPrivateKey();
  }

  public getMyBalance(): number {
    return this.gameManager.getMyBalanceEth();
  }

  public getMyBalanceBn(): BigNumber {
    return this.gameManager.getMyBalance();
  }

  public getMyBalance$(): Monomitter<BigNumber> {
    return this.gameManager.getMyBalance$();
  }

  public findArtifact(planetId: LocationId) {
    if (this.gameManager.isRoundOver()) {
      alert("This round has ended, and you can no longer find artifacts!");
      return;
    }
    this.gameManager.findArtifact(planetId);
  }

  public prospectPlanet(planetId: LocationId) {
    if (this.gameManager.isRoundOver()) {
      alert("This round has ended, and you can no longer find artifacts!");
      return;
    }
    this.playClickSound();
    this.gameManager.prospectPlanet(planetId);
  }

  public withdrawArtifact(locationId: LocationId, artifactId: ArtifactId) {
    this.playClickSound();
    this.gameManager.withdrawArtifact(locationId, artifactId);
  }

  public depositArtifact(locationId: LocationId, artifactId: ArtifactId) {
    this.playClickSound();
    this.gameManager.depositArtifact(locationId, artifactId);
  }

  public drawAllRunningPlugins(ctx: CanvasRenderingContext2D) {
    this.getPluginManager().drawAllRunningPlugins(ctx);
  }

  public chargeArtifact(locationId: LocationId, id: ArtifactId, data: Hex) {
    this.playClickSound();
    this.gameManager.chargeArtifact(locationId, id, data);
  }

  public activateArtifact(
    locationId: LocationId,
    id: ArtifactId,
    linkTo?: LocationId,
  ) {
    const confirmationText =
      `Are you sure you want to activate this artifact? ` +
      `You can only have one artifact active at time. After` +
      ` deactivation, you must wait for a long cooldown` +
      ` before you can activate it again. Some artifacts (bloom filter, black domain, photoid cannon, fire link) are consumed on usage.`;

    if (!confirm(confirmationText)) {
      return;
    }

    this.playClickSound();
    this.gameManager.activateArtifact(locationId, id, linkTo);
  }

  public shutdownArtifact(locationId: LocationId, id: ArtifactId) {
    this.playClickSound();
    this.gameManager.shutdownArtifact(locationId, id);
  }

  public deactivateArtifact(
    locationId: LocationId,
    artifactId: ArtifactId,
    linkTo: LocationId | undefined,
  ) {
    const confirmationText =
      `Are you sure you want to deactivate this artifact? ` +
      `After deactivation, you must wait for a long cooldown` +
      ` before you can activate it again. Some artifacts (planetary shield, ice link) are consumed on deactivation.`;

    if (!confirm(confirmationText)) {
      return;
    }
    this.playClickSound();
    this.gameManager.deactivateArtifact(locationId, artifactId, linkTo);
  }

  public async changeArtifactImageType(
    locationId: LocationId,
    artifactId: ArtifactId,
    newImageType: number,
  ) {
    this.playClickSound();
    this.gameManager.changeArtifactImageType(
      locationId,
      artifactId,
      newImageType,
    );
  }

  public buyArtifact(
    locationId: LocationId,
    rarity: ArtifactRarity,
    biome: Biome,
    type: ArtifactType,
  ) {
    //TODO: fix here
    return;
    this.terminal.current?.printShellLn(
      `df.buyArtifact('${locationId}','${rarity}','${biome}','${type}')`,
    );
    this.gameManager.buyArtifact(locationId, rarity, biome, type);
  }

  public withdrawSilver(locationId: LocationId, amount: number) {
    const dontShowWarningStorageKey = `${this.getAccount()?.toLowerCase()}-withdrawnWarningAcked`;

    if (localStorage.getItem(dontShowWarningStorageKey) !== "true") {
      localStorage.setItem(dontShowWarningStorageKey, "true");
      const confirmationText =
        `Are you sure you want withdraw this silver? Once you withdraw it, you ` +
        `cannot deposit it again. Your withdrawn silver amount will be added to your score. You'll only see this warning once!`;
      if (!confirm(confirmationText)) {
        return;
      }
    }
    this.playClickSound();

    this.gameManager.withdrawSilver(locationId, amount);
  }

  public withdrawMaterial(
    locationId: LocationId,
    materialType: MaterialType,
    amount: number,
  ) {
    const dontShowWarningStorageKey = `${this.getAccount()?.toLowerCase()}-withdrawMaterialWarningAcked`;

    if (localStorage.getItem(dontShowWarningStorageKey) !== "true") {
      localStorage.setItem(dontShowWarningStorageKey, "true");
      const confirmationText =
        `Are you sure you want withdraw this material? Once you withdraw it, you ` +
        `cannot deposit it again. Your withdrawn material amount will be added to your score with biome-based multipliers. You'll only see this warning once!`;
      if (!confirm(confirmationText)) {
        return;
      }
    }
    this.playClickSound();

    this.gameManager.withdrawMaterial(locationId, materialType, amount);
  }

  public revertMove(
    moveId: string,
    toPlanetHash: LocationId,
    moveIndex: number,
  ): Promise<Transaction<UnconfirmedRevertMove>> {
    this.playClickSound();
    return this.gameManager.revertMove(moveId, toPlanetHash, moveIndex);
  }

  public addJunk(locationId: LocationId, biomeBase?: number) {
    this.playClickSound();
    console.log("addJunk", locationId, biomeBase);
    this.gameManager.addJunk(locationId, biomeBase);
  }

  public clearJunk(locationId: LocationId) {
    this.playClickSound();
    this.gameManager.clearJunk(locationId);
  }

  public setPlanetEmoji(locationId: LocationId, emoji: string) {
    this.playClickSound();
    this.gameManager.setPlanetEmoji(locationId, emoji);
  }

  public async buyGPTTokens(amount: number) {
    this.playClickSound();
    await this.gameManager.buyGPTTokens(amount);
  }

  public async spendGPTTokens(amount: number) {
    this.playClickSound();
    await this.gameManager.spendGPTTokens(amount);
  }

  public startLinkFrom(
    planet: LocatablePlanet,
    artifact: Artifact,
  ): Promise<LocatablePlanet | undefined> {
    this.isChoosingTargetPlanet = true;
    this.mouseDownOverCoords = planet.location.coords;
    this.mouseDownOverPlanet = planet;

    this.linkSourceArtifactType = artifact.artifactType;
    this.linkSourceArtifactRarity = artifact.rarity;
    const { resolve, promise } = deferred<LocatablePlanet | undefined>();

    this.onChooseTargetPlanet = resolve;

    return promise;
  }

  public revealLocation(locationId: LocationId) {
    this.playClickSound();
    this.gameManager.revealLocation(locationId);
  }

  public claimLocation(locationId: LocationId) {
    //TODO: fix here
    return;
    this.gameManager.claimLocation(locationId);
  }

  public burnLocation(locationId: LocationId) {
    //TODO: fix here
    return;
    // this.gameManager.burnLocation(locationId);
  }

  public checkPlanetCanPink(planetId: LocationId): boolean {
    //TODO: fix here
    const { canPink } = this.gameManager.checkPlanetCanPink(planetId);
    return canPink;
  }

  public pinkLocation(locationId: LocationId) {
    // TODO: fix here
    this.playClickSound();
    this.gameManager.pinkLocation(locationId);
  }

  public kardashev(locationId: LocationId) {
    //TODO: fix here
    return;
    this.gameManager.kardashev(locationId);
  }

  public checkPlanetCanBlue(planetId: LocationId): boolean {
    //TODO: fix here
    return false;
    // return this.gameManager.checkPlanetCanBlue(planetId);
  }

  public blueLocation(locationId: LocationId) {
    //TODO: fix here
    return;
    // this.gameManager.blueLocation(locationId);
  }

  public getNextBroadcastAvailableTimestamp() {
    return this.gameManager.getNextBroadcastAvailableTimestamp();
  }

  public timeUntilNextBroadcastAvailable() {
    return this.gameManager.timeUntilNextBroadcastAvailable();
  }

  // public getNextClaimAvailableTimestamp() {
  //   return this.gameManager.getNextClaimAvailableTimestamp();
  // }

  // public timeUntilNextClaimAvailable() {
  //   return this.gameManager.timeUntilNextClaimAvailable();
  // }

  // public getNextBurnAvailableTimestamp() {
  //   return this.gameManager.getNextBurnAvailableTimestamp();
  // }

  // public timeUntilNextBurnAvailable() {
  //   return this.gameManager.timeUntilNextBurnAvailable();
  // }

  // public getNextPinkAvailableTimestamp(planetId: LocationId) {
  //   return this.gameManager.getNextPinkAvailableTimestamp(planetId);
  // }

  // public getBlueZoneCenterPlanetId(planetId: LocationId) {
  //   return this.gameManager.getBlueZoneCenterPlanetId(planetId);
  // }

  // public getNextKardashevAvailableTimestamp() {
  //   return this.gameManager.getNextKardashevAvailableTimestamp();
  // }

  // public getNextBlueAvailableTimestamp(planetId: LocationId) {
  //   return this.gameManager.getNextBlueAvailableTimestamp(planetId);
  // }

  // public getNextActivateArtifactAvailableTimestamp() {
  //   return this.gameManager.getNextActivateArtifactAvailableTimestamp();
  // }

  // public timeUntilNextActivateArtifactAvailable() {
  //   return this.gameManager.timeUntilNextBuyArtifactAvailable();
  // }

  // public getNextBuyArtifactAvailableTimestamp() {
  //   return this.gameManager.getNextBuyArtifactAvailableTimestamp();
  // }

  // public timeUntilNextBuyArtifactAvailable() {
  //   return this.gameManager.timeUntilNextBuyArtifactAvailable();
  // }

  public getEnergyArrivingForMove(
    from: LocationId,
    to: LocationId | undefined,
    dist: number | undefined,
    energy: number,
    mudComponents?: unknown,
  ) {
    return this.gameManager.getEnergyArrivingForMove(
      from,
      to,
      dist,
      energy,
      this.abandoning,
    );
  }

  public getTimeForMove(
    fromId: LocationId,
    toId: LocationId,
    abandoning = false,
  ): number {
    return this.gameManager.getTimeForMove(fromId, toId, abandoning);
  }

  public getEnergyNeededForMove(
    fromId: LocationId,
    toId: LocationId,
    energy: number,
    upgrade: Upgrade,
  ): number {
    return this.gameManager.getEnergyNeededForMove(
      fromId,
      toId,
      energy,
      false,
      upgrade,
    );
  }

  getIsChoosingTargetPlanet() {
    return this.isChoosingTargetPlanet;
  }

  getLinkSourceArtifactType() {
    return this.linkSourceArtifactType;
  }

  getLinkSourceArtifactRarity() {
    return this.linkSourceArtifactRarity;
  }

  public onMouseDown(coords: WorldCoords) {
    if (this.sendingPlanet) {
      return;
    }

    const hoveringOverCoords = this.updateMouseHoveringOverCoords(coords);
    const hoveringOverPlanet =
      this.gameManager.getPlanetWithCoords(hoveringOverCoords);

    if (this.getIsChoosingTargetPlanet()) {
      this.isChoosingTargetPlanet = false;
      this.linkSourceArtifactType = ArtifactType.Unknown;
      this.linkSourceArtifactRarity = ArtifactRarity.Unknown;
      if (this.onChooseTargetPlanet) {
        this.onChooseTargetPlanet(hoveringOverPlanet as LocatablePlanet);
        this.mouseDownOverPlanet = undefined;
        this.mouseDownOverCoords = undefined;
      }
    } else {
      this.mouseDownOverPlanet = hoveringOverPlanet;
      this.mouseDownOverCoords = this.mouseHoveringOverCoords;
    }
  }

  public onMouseClick(coords: WorldCoords) {
    // Check for multiple voyages at the same coordinates
    const voyagesAtCoords = this.getVoyagesAtCoords(coords);

    if (voyagesAtCoords.length > 1) {
      // Clear any existing timeout since we're clicking
      if (this.multiMoveHoverTimeout) {
        clearTimeout(this.multiMoveHoverTimeout);
        this.multiMoveHoverTimeout = null;
      }

      // Always show/update the multi-move selector for multiple moves on click
      this.setMultipleMoves(voyagesAtCoords);
      this.setShowMultiMoveSelector(true);

      // Convert world coordinates to screen coordinates for the selector
      const screenCoords = this.worldToScreenCoords(coords);
      this.setMultiMoveSelectorPosition(screenCoords);

      // Select the first move by default so the line is selected
      this.setSelectedVoyage(voyagesAtCoords[0]);
      return;
    } else if (voyagesAtCoords.length === 1) {
      // Single voyage - handle as before
      const clickedVoyage = voyagesAtCoords[0];

      // If clicking on the same voyage, deselect it
      if (
        this.selectedVoyage &&
        this.selectedVoyage.eventId === clickedVoyage.eventId
      ) {
        this.setSelectedVoyage(undefined);
      } else {
        // Select the clicked voyage
        this.setSelectedVoyage(clickedVoyage);
      }

      // Hide multi-move selector when selecting a single voyage
      this.setShowMultiMoveSelector(false);
      return;
    }

    // If clicking on empty space, deselect voyage and hide multi-move selector
    if (!this.mouseDownOverPlanet && !this.mouseHoveringOverPlanet) {
      // Clear any existing timeout
      if (this.multiMoveHoverTimeout) {
        clearTimeout(this.multiMoveHoverTimeout);
        this.multiMoveHoverTimeout = null;
      }

      this.setSelectedPlanet(undefined);
      this.selectedCoords = undefined;
      this.setSelectedVoyage(undefined);
      this.setMultipleMoves(undefined);
      this.setShowMultiMoveSelector(false);
    }
  }

  public onMouseMove(coords: WorldCoords) {
    this.updateMouseHoveringOverCoords(coords);

    // Check for multiple voyages at the coordinates
    const voyagesAtCoords = this.getVoyagesAtCoords(coords);

    // Clear any existing timeout
    if (this.multiMoveHoverTimeout) {
      clearTimeout(this.multiMoveHoverTimeout);
      this.multiMoveHoverTimeout = null;
    }

    if (voyagesAtCoords.length > 1) {
      // For multiple moves, show the multi-move selector with delay
      this.setMultipleMoves(voyagesAtCoords);

      // Set timeout to show selector after delay
      this.multiMoveHoverTimeout = setTimeout(() => {
        this.setShowMultiMoveSelector(true);

        // Convert world coordinates to screen coordinates for the selector
        const screenCoords = this.worldToScreenCoords(coords);
        this.setMultiMoveSelectorPosition(screenCoords);
      }, MULTI_MOVE_HOVER_DELAY);

      // Don't show a single voyage hover when multiple moves are detected
      this.setHoveringOverVoyage(undefined);
    } else if (voyagesAtCoords.length === 1) {
      // Single voyage - show normally
      this.setHoveringOverVoyage(voyagesAtCoords[0]);
      // Only hide multi-move selector if no move is currently selected
      if (!this.selectedVoyage) {
        this.setShowMultiMoveSelector(false);
      }
    } else {
      // No voyages - only hide if no move is currently selected
      this.setHoveringOverVoyage(undefined);
      if (!this.selectedVoyage) {
        this.setShowMultiMoveSelector(false);
      }
    }
  }

  public onMouseUp(coords: WorldCoords) {
    const mouseUpOverCoords = this.updateMouseHoveringOverCoords(coords);
    const mouseUpOverPlanet =
      this.gameManager.getPlanetWithCoords(mouseUpOverCoords);

    const mouseDownPlanet = this.getMouseDownPlanet();
    const tutorialManager = TutorialManager.getInstance(this);

    const uiEmitter = UIEmitter.getInstance();

    if (mouseUpOverPlanet) {
      if (
        this.mouseDownOverPlanet &&
        mouseUpOverPlanet.locationId === this.mouseDownOverPlanet.locationId
      ) {
        // select planet
        this.setSelectedPlanet(mouseUpOverPlanet);
        this.selectedCoords = mouseUpOverCoords;
        this.terminal.current?.println(
          `Selected: ${mouseUpOverPlanet.locationId}`,
        );
        this.terminal.current?.println(``);
      } else if (
        mouseDownPlanet &&
        (mouseDownPlanet.owner === this.gameManager.getAccount() ||
          this.gameManager.checkDelegateCondition(
            mouseDownPlanet.owner,
            this.gameManager.getAccount(),
          ) ||
          this.isSendingShip(mouseDownPlanet.locationId))
      ) {
        // move initiated if enough forces
        const from = mouseDownPlanet;
        const to = mouseUpOverPlanet;

        // TODO: the following code block needs to be in a Planet class
        let effectiveEnergy = from.energy;
        for (const unconfirmedMove of from.transactions?.getTransactions(
          isUnconfirmedMoveTx,
        ) ?? []) {
          effectiveEnergy -= unconfirmedMove.intent.forces;
        }
        const effPercent = Math.min(this.getForcesSending(from.locationId), 98);
        let forces = Math.floor((effectiveEnergy * effPercent) / 100);

        // make it so you leave one force behind
        if (this.isSendingShip(mouseDownPlanet.locationId)) {
          tutorialManager.acceptInput(TutorialState.Spaceship);
          forces = 0;
        } else if (forces >= from.energy) {
          forces = from.energy - 1;
          if (forces < 1) {
            return;
          }
        }

        const dist = this.gameManager.getDist(from.locationId, to.locationId);

        const myAtk: number = this.gameManager.getEnergyArrivingForMove(
          from.locationId,
          to.locationId,
          dist,
          forces,
          this.abandoning,
        );

        let effPercentSilver = this.getSilverSending(from.locationId);

        if (
          effPercentSilver > 98 &&
          from.planetType === PlanetType.SILVER_MINE &&
          from.silver < from.silverCap
        ) {
          // player is trying to send 100% silver from a silver mine that is not at cap
          // Date.now() and block.timestamp are occasionally a bit out of sync, so clip
          effPercentSilver = 98;
        }

        if (myAtk > 0 || this.isSendingShip(from.locationId)) {
          const abandoning = this.isAbandoning();
          const silver = Math.floor((from.silver * effPercentSilver) / 100);
          const materials = this.getMaterialsSending(from.locationId) ?? [];
          // TODO: do something like JSON.stringify(args) so we know formatting is correct
          this.terminal.current?.printShellLn(
            `df.move('${from.locationId}', '${to.locationId}', ${forces}, ${silver}, ${JSON.stringify(materials ?? [])})`,
          );
          const artifact = this.getArtifactSending(from.locationId);

          this.playClickSound();
          this.gameManager.move(
            from.locationId,
            to.locationId,
            forces,
            silver,
            artifact?.id,
            abandoning,
            materials,
          );
          tutorialManager.acceptInput(TutorialState.SendFleet);
        }

        if (
          this.getBooleanSetting(Setting.PlanetDefaultEnergyLevelToSendReset)
        ) {
          delete this.forcesSending[from.locationId];
        }

        uiEmitter.emit(UIEmitterEvent.SendCompleted, from.locationId);
      }

      this.isChoosingTargetPlanet = false;

      this.linkSourceArtifactType = ArtifactType.Unknown;
      this.linkSourceArtifactRarity = ArtifactRarity.Unknown;
    } else {
      uiEmitter.emit(UIEmitterEvent.SendCancelled);
    }

    this.mouseDownOverPlanet = undefined;
    this.mouseDownOverCoords = undefined;
  }

  public onMouseOut() {
    this.mouseDownOverPlanet = undefined;
    this.mouseDownOverCoords = undefined;
    this.setHoveringOverPlanet(undefined, true);
    this.mouseHoveringOverCoords = undefined;
    this.mouseHoveringOverArtifactId = undefined;
  }

  public startExplore() {
    this.gameManager.startExplore();
  }

  public stopExplore() {
    this.gameManager.stopExplore();
    this.minerLocation = undefined;
  }

  public toggleExplore() {
    if (this.isMining()) {
      this?.stopExplore();
      TutorialManager.getInstance(this).acceptInput(TutorialState.MinerPause);
    } else {
      this?.startExplore();
    }
  }

  public toggleTargettingExplorer() {
    const modalManager = this.modalManager;
    if (modalManager.getCursorState() === CursorState.TargetingExplorer) {
      modalManager.setCursorState(CursorState.Normal);
    } else {
      modalManager.setCursorState(CursorState.TargetingExplorer);
    }
  }

  public setForcesSending(planetId: LocationId, percentage: number) {
    if (percentage < 0) {
      percentage = 0;
    }
    if (percentage > 100) {
      percentage = 100;
    }
    this.forcesSending[planetId] = percentage;
    this.gameManager.getGameObjects().forceTick(planetId);
  }

  public setSilverSending(planetId: LocationId, percentage: number) {
    if (percentage < 0) {
      percentage = 0;
    }
    if (percentage > 100) {
      percentage = 100;
    }
    this.silverSending[planetId] = percentage;
    this.gameManager.getGameObjects().forceTick(planetId);
  }

  public setMaterialSending(
    planetId: LocationId,
    materialId: number,
    percentage: number,
  ) {
    if (percentage < 0) {
      percentage = 0;
    }
    if (percentage > 100) {
      percentage = 100;
    }

    const key = `${planetId},${materialId}`;
    this.materialSending[key] = percentage;
    this.gameManager.getGameObjects().forceTick(planetId);
  }

  public setSending(sending: boolean): void {
    this.isSending = sending;
    this.isSending$.publish(sending);
  }

  public setAbandoning(abandoning: boolean): void {
    return;
    // if (!this.gameManager.getContractConstants().SPACE_JUNK_ENABLED) {
    //   return;
    // }

    // const planet = this.getSelectedPlanet();
    // if (planet?.isHomePlanet) {
    //   return;
    // }
    // if (this.isSendingShip(planet?.locationId)) {
    //   return;
    // }

    // // An abandon is always a send
    // this.isSending = abandoning;
    // this.abandoning = abandoning;
    // this.isSending$.publish(abandoning);
    // this.isAbandoning$.publish(abandoning);
  }

  public setArtifactSending(planetId: LocationId, artifact?: Artifact) {
    this.artifactSending[planetId] = artifact;
    if (this.isSendingShip(planetId)) {
      this.abandoning = false;
      this.isAbandoning$.publish(false);
    }
    this.artifactSending$.publish({ planetId, artifact });
    this.gameManager.getGameObjects().forceTick(planetId);
  }

  public isOwnedByMe(planet: Planet): boolean {
    return this.gameManager.isOwnedByMe(planet);
  }

  public addNewChunk(chunk: Chunk) {
    this.gameManager.addNewChunk(chunk);
  }

  public bulkAddNewChunks(chunks: Chunk[]): Promise<void> {
    return this.gameManager.bulkAddNewChunks(chunks);
  }

  // mining stuff
  public setMiningPattern(pattern: MiningPattern) {
    this.gameManager.setMiningPattern(pattern);
  }

  public getMiningPattern(): MiningPattern | undefined {
    return this.gameManager.getMiningPattern();
  }

  public isMining(): boolean {
    return this.gameManager.isMining();
  }

  // getters

  public getAccount(): EthAddress | undefined {
    return this.gameManager.getAccount();
  }

  public getMainAccount(): EthAddress | undefined {
    return this.gameManager.getMainAccount();
  }

  public getGameAccount(): EthAddress | undefined {
    return this.gameManager.getGameAccount();
  }

  public isAdmin(): boolean {
    return this.gameManager.isAdmin();
  }

  // public getTwitter(address: EthAddress | undefined): string | undefined {
  //   return this.gameManager.getTwitter(address);
  // }

  // public getEndTimeSeconds(): number {
  //   return this.gameManager.getEndTimeSeconds();
  // }

  public isRoundOver(): boolean {
    return this.gameManager.isRoundOver();
  }

  public getUpgrade(branch: UpgradeBranchName, level: number): Upgrade {
    return this.gameManager.getUpgrade(branch, level);
  }

  private getBiomeKey(biome: Biome) {
    return `${this.gameManager.getContractAddress()}-${this.getAccount()?.toLowerCase()}-biome-${biome}`;
  }

  public getDiscoverBiomeName(biome: Biome): string {
    const item = localStorage.getItem(this.getBiomeKey(biome));
    if (item === "true") {
      return biomeName(biome);
    }
    return "Undiscovered";
  }

  public getDistCoords(from: WorldCoords, to: WorldCoords) {
    return this.gameManager.getDistCoords(from, to);
  }

  public discoverBiome(planet: LocatablePlanet): void {
    const key = this.getBiomeKey(planet.biome);
    const item = localStorage.getItem(key);
    if (item !== "true") {
      const notifManager = NotificationManager.getInstance();
      localStorage.setItem(key, "true");
      notifManager.foundBiome(planet);
    }
  }

  public getAllPlayers(): Player[] {
    return this.gameManager.getAllPlayers();
  }

  public getSelectedPlanet(): LocatablePlanet | undefined {
    const planet = this.getPlanetWithId(this.selectedPlanetId);

    if (isLocatable(planet)) {
      return planet;
    }

    return undefined;
  }

  public getPreviousSelectedPlanet(): Planet | undefined {
    return this.getPlanetWithId(this.previousSelectedPlanetId);
  }

  public setSelectedId(id: LocationId): void {
    const planet = this.getPlanetWithId(id);
    if (planet && isLocatable(planet)) {
      this.setSelectedPlanet(planet);
    }
  }

  public setSelectedPlanet(planet: LocatablePlanet | undefined): void {
    this.previousSelectedPlanetId = this.selectedPlanetId;

    if (!planet) {
      const tutorialManager = TutorialManager.getInstance(this);
      tutorialManager.acceptInput(TutorialState.Deselect);
    }

    const uiEmitter = UIEmitter.getInstance();
    this.selectedPlanetId = planet?.locationId;
    if (!planet) {
      this.selectedCoords = undefined;
    } else {
      const loc = this.getLocationOfPlanet(planet.locationId);
      if (!loc) {
        this.selectedCoords = undefined;
      } else {
        // loc is not undefined
        this.selectedCoords = loc.coords;

        if (coordsEqual(loc.coords, this.getHomeCoords())) {
          const tutorialManager = TutorialManager.getInstance(this);
          tutorialManager.acceptInput(TutorialState.HomePlanet);
        }
      }
    }
    uiEmitter.emit(UIEmitterEvent.GamePlanetSelected);

    if (planet?.locationId) this.playClickSound();

    this.selectedPlanetId$.publish(planet?.locationId);
  }

  public getSelectedCoords(): WorldCoords | undefined {
    return this.selectedCoords;
  }

  public getMouseDownPlanet(): LocatablePlanet | undefined {
    if (this.isSending && this.sendingPlanet) {
      return this.sendingPlanet;
    }
    return this.mouseDownOverPlanet;
  }

  public onSendInit(planet: LocatablePlanet | undefined): void {
    this.modalManager.setCursorState(CursorState.TargetingForces);
    this.isSending = true;
    this.sendingPlanet = planet;
    const loc = planet && this.getLocationOfPlanet(planet.locationId);
    this.sendingCoords = loc ? loc.coords : { x: 0, y: 0 };
  }

  public onSendComplete(locationId: LocationId): void {
    this.modalManager.setCursorState(CursorState.Normal);

    // Set to undefined after SendComplete so it can send another one
    this.artifactSending[locationId] = undefined;

    this.sendingPlanet = undefined;
    // Done at the end so they clear the artifact
    this.setSending(false);
    this.setAbandoning(false);
  }

  public onSendCancel(): void {
    this.modalManager.setCursorState(CursorState.Normal);

    this.sendingPlanet = undefined;
    this.sendingCoords = undefined;

    this.setSending(false);
    this.setAbandoning(false);
  }

  public hasMinedChunk(chunkLocation: Rectangle): boolean {
    return this.gameManager.hasMinedChunk(chunkLocation);
  }

  public getChunk(chunkFootprint: Rectangle): Chunk | undefined {
    return this.gameManager.getChunk(chunkFootprint);
  }

  public spaceTypeFromPerlin(
    perlin: number,
    distFromOrigin: number,
  ): SpaceType {
    return this.gameManager.spaceTypeFromPerlin(perlin, distFromOrigin);
  }

  public getSpaceTypePerlin(coords: WorldCoords, floor: boolean): number {
    return this.gameManager.spaceTypePerlin(coords, floor);
  }

  public getBiomePerlin(coords: WorldCoords, floor: boolean): number {
    return this.gameManager.biomebasePerlin(coords, floor);
  }

  public onDiscoveredChunk(chunk: Chunk): void {
    const res = this.gameManager.getCurrentlyExploringChunk();
    const account = this.getEthConnection().getAddress();
    const config = {
      contractAddress: this.getContractAddress(),
      account,
    };

    if (res) {
      const { bottomLeft, sideLength } = res;
      this.minerLocation = {
        x: bottomLeft.x + sideLength / 2,
        y: bottomLeft.y + sideLength / 2,
      };
    } else {
      this.minerLocation = undefined;
    }

    const notifManager = NotificationManager.getInstance();

    for (const loc of chunk.planetLocations) {
      const planet = this.getPlanetWithId(loc.hash);
      if (!planet || !account) {
        break;
      }

      if (planet.owner === EMPTY_ADDRESS && planet.energy > 0) {
        if (
          !this.getBooleanSetting(Setting.FoundPirates) &&
          this.getBooleanSetting(Setting.TutorialCompleted)
        ) {
          notifManager.foundPirates(planet);
          setBooleanSetting(config, Setting.FoundPirates, true);
        }
      }

      if (planet.planetType === PlanetType.SILVER_MINE) {
        if (
          !this.getBooleanSetting(Setting.FoundSilver) &&
          this.getBooleanSetting(Setting.TutorialCompleted)
        ) {
          notifManager.foundSilver(planet);
          setBooleanSetting(config, Setting.FoundSilver, true);
        }
      }
      if (planet.planetType === PlanetType.SILVER_BANK) {
        if (
          !this.getBooleanSetting(Setting.FoundSilverBank) &&
          this.getBooleanSetting(Setting.TutorialCompleted)
        ) {
          notifManager.foundSilverBank(planet);
          setBooleanSetting(config, Setting.FoundSilverBank, true);
        }
      }
      if (planet.planetType === PlanetType.TRADING_POST) {
        if (
          !this.getBooleanSetting(Setting.FoundTradingPost) &&
          this.getBooleanSetting(Setting.TutorialCompleted)
        ) {
          notifManager.foundTradingPost(planet);
          setBooleanSetting(config, Setting.FoundTradingPost, true);
        }
      }
      if (planetHasBonus(planet)) {
        if (
          !this.getBooleanSetting(Setting.FoundComet) &&
          this.getBooleanSetting(Setting.TutorialCompleted)
        ) {
          notifManager.foundComet(planet);
          setBooleanSetting(config, Setting.FoundComet, true);
        }
      }
      if (isLocatable(planet) && planet.planetType === PlanetType.PLANET) {
        this.discoverBiome(planet);
      }
      if (isLocatable(planet) && planet.planetType === PlanetType.RUINS) {
        if (
          !this.getBooleanSetting(Setting.FoundArtifact) &&
          this.getBooleanSetting(Setting.TutorialCompleted)
        ) {
          notifManager.foundFoundry(planet);
          setBooleanSetting(config, Setting.FoundArtifact, true);
        }
      }
    }

    if (account !== undefined) {
      const distFromOrigin = chunk.planetLocations[0]
        ? Math.floor(
            Math.sqrt(
              chunk.planetLocations[0].coords.x ** 2 +
                chunk.planetLocations[0].coords.y ** 2,
            ),
          )
        : 1;
      if (
        this.spaceTypeFromPerlin(chunk.perlin, distFromOrigin) ===
        SpaceType.DEEP_SPACE
      ) {
        if (
          !this.getBooleanSetting(Setting.FoundDeepSpace) &&
          this.getBooleanSetting(Setting.TutorialCompleted)
        ) {
          notifManager.foundDeepSpace(chunk);
          setBooleanSetting(config, Setting.FoundDeepSpace, true);
        }
      } else if (
        this.spaceTypeFromPerlin(chunk.perlin, distFromOrigin) ===
        SpaceType.SPACE
      ) {
        if (
          !this.getBooleanSetting(Setting.FoundSpace) &&
          this.getBooleanSetting(Setting.TutorialCompleted)
        ) {
          notifManager.foundSpace(chunk);
          setBooleanSetting(config, Setting.FoundSpace, true);
        }
      } else if (
        this.spaceTypeFromPerlin(chunk.perlin, distFromOrigin) ===
        SpaceType.DEAD_SPACE
      ) {
        if (
          !this.getBooleanSetting(Setting.FoundDeepSpace) &&
          this.getBooleanSetting(Setting.TutorialCompleted)
        ) {
          notifManager.foundDeadSpace(chunk);
          setBooleanSetting(config, Setting.FoundDeepSpace, true);
        }
      }
    }
  }

  public getMinerLocation(): WorldCoords | undefined {
    return this.minerLocation;
  }

  public setExtraMinerLocation(idx: number, coords: WorldCoords): void {
    this.extraMinerLocations[idx] = coords;
  }

  public removeExtraMinerLocation(idx: number): void {
    this.extraMinerLocations.splice(idx, 1);
  }

  public getAllMinerLocations(): WorldCoords[] {
    if (this.minerLocation) {
      return [this.minerLocation, ...this.extraMinerLocations];
    } else {
      return this.extraMinerLocations;
    }
  }

  public getMouseDownCoords(): WorldCoords | undefined {
    if (this.isSending && this.sendingPlanet) {
      return this.sendingCoords;
    }
    return this.mouseDownOverCoords;
  }

  public setHoveringOverPlanet(
    planet: LocatablePlanet | undefined,
    inRenderer: boolean,
  ) {
    const lastHover = this.mouseHoveringOverPlanet;

    this.mouseHoveringOverPlanet = planet;

    if (lastHover?.locationId !== planet?.locationId) {
      if (planet?.locationId) this.playHoverSound();
      this.hoverPlanetId$.publish(planet?.locationId);
      this.planetHoveringInRenderer = inRenderer;
    }
  }

  public setHoveringOverArtifact(artifactId?: ArtifactId) {
    this.mouseHoveringOverArtifactId = artifactId;
    this.hoverArtifactId$.publish(artifactId);
    this.hoverArtifact$.publish(
      artifactId ? this.getArtifactWithId(artifactId) : undefined,
    );
  }

  public setHoveringOverVoyage(voyage?: QueuedArrival) {
    this.mouseHoveringOverVoyage = voyage;
    this.hoverVoyage$.publish(voyage);
  }

  public setSelectedVoyage(voyage?: QueuedArrival) {
    this.selectedVoyage = voyage;
    this.selectedVoyage$.publish(voyage);
  }

  public getHoveringOverPlanet(): Planet | undefined {
    return this.mouseHoveringOverPlanet;
  }

  public getHoveringVoyage(): QueuedArrival | undefined {
    return this.mouseHoveringOverVoyage;
  }

  public setMultipleMoves(moves: QueuedArrival[] | undefined) {
    this.multipleMovesAtCoords = moves;
    this.multipleMoves$.publish(moves);
  }

  public getMultipleMoves(): QueuedArrival[] | undefined {
    return this.multipleMovesAtCoords;
  }

  public setShowMultiMoveSelector(show: boolean) {
    this.showMultiMoveSelector = show;
    this.showMultiMoveSelector$.publish(show);
  }

  public getShowMultiMoveSelector(): boolean {
    return this.showMultiMoveSelector;
  }

  public setMultiMoveSelectorPosition(position: { x: number; y: number }) {
    this.multiMoveSelectorPosition = position;
    this.multiMoveSelectorPosition$.publish(position);
  }

  public getMultiMoveSelectorPosition(): { x: number; y: number } {
    return this.multiMoveSelectorPosition;
  }

  public selectMoveFromMultiple(move: QueuedArrival) {
    this.setSelectedVoyage(move);
    // Keep the multi-move selector open so user can see details and select other moves
    // Only close when clicking outside or selecting a different move line
  }

  private worldToScreenCoords(worldCoords: WorldCoords): {
    x: number;
    y: number;
  } {
    // Convert world coordinates to screen coordinates
    const viewport = this.getViewport();

    // Get the viewport bounds in world coordinates
    const leftBound = viewport.getLeftBound();
    const topBound = viewport.getTopBound();
    const rightBound = viewport.getRightBound();
    const bottomBound = viewport.getBottomBound();

    // Get viewport dimensions in pixels
    const viewportWidth = viewport.viewportWidth;
    const viewportHeight = viewport.viewportHeight;

    // Calculate the scale factor
    const worldWidth = rightBound - leftBound;
    const worldHeight = topBound - bottomBound;

    // Convert world coordinates to screen coordinates
    const screenX = ((worldCoords.x - leftBound) / worldWidth) * viewportWidth;
    const screenY = ((topBound - worldCoords.y) / worldHeight) * viewportHeight;

    // Ensure we return valid numbers and clamp to viewport bounds
    return {
      x: Math.max(0, Math.min(viewportWidth, isNaN(screenX) ? 0 : screenX)),
      y: Math.max(0, Math.min(viewportHeight, isNaN(screenY) ? 0 : screenY)),
    };
  }

  public getSelectedVoyage(): QueuedArrival | undefined {
    return this.selectedVoyage;
  }

  public getHoveringOverVoyage(): QueuedArrival | undefined {
    return this.hoveringOverVoyage;
  }

  public getHoveringOverCoords(): WorldCoords | undefined {
    return this.mouseHoveringOverCoords;
  }

  public getHoveringOverArtifactId(): ArtifactId | undefined {
    return this.mouseHoveringOverArtifactId;
  }

  public isSendingForces(): boolean {
    return this.isSending;
  }

  /**
   * Percent from 0 to 100.
   */
  public getForcesSending(planetId?: LocationId): number {
    const config = {
      contractAddress: this.getContractAddress(),
      account: this.getEthConnection().getAddress(),
    };
    const defaultSending = getNumberSetting(
      config,
      Setting.PlanetDefaultEnergyLevelToSend,
    );
    if (!planetId) {
      return defaultSending;
    }

    if (this.isAbandoning()) {
      return 100;
    }
    if (this.isSendingShip(planetId)) {
      return 0;
    }

    const forces = this.forcesSending[planetId];
    return forces ?? defaultSending;
  }

  /**
   * Percent from 0 to 100.
   */
  public getSilverSending(planetId?: LocationId): number {
    const defaultSending = 0;
    if (!planetId) {
      return defaultSending;
    }

    if (this.isAbandoning()) {
      return 100;
    }
    if (this.isSendingShip(planetId)) {
      return 0;
    }

    return this.silverSending[planetId] ?? defaultSending;
  }

  public getMaterialSending(
    planetId?: LocationId,
    materialId?: number,
  ): number {
    const defaultSending = 0;
    if (!planetId || !materialId) {
      return defaultSending;
    }
    const key = `${planetId},${materialId}`;
    return this.materialSending[key] ?? defaultSending;
  }

  public getMaterialsSending(
    locationId?: LocationId,
  ): { materialId: MaterialId; materialAmount: MaterialAmount }[] {
    if (!locationId) return [];
    const planet = this.getPlanetWithId(locationId);
    if (!planet?.materials?.length) return [];

    const results: {
      materialId: MaterialId;
      materialAmount: MaterialAmount;
    }[] = [];

    for (const mat of planet.materials) {
      if (!mat) continue;
      const percent = this.getMaterialSending(locationId, mat.materialId);
      if (percent && percent > 0) {
        results.push({
          materialId: mat.materialId as MaterialId,
          materialAmount: Math.floor(
            (mat.materialAmount * percent) / 100,
          ) as MaterialAmount,
        });
      }
    }
    return results;
  }

  public isAbandoning(): boolean {
    return this.abandoning;
  }

  public getArtifactSending(planetId?: LocationId): Artifact | undefined {
    if (!planetId) {
      return undefined;
    }
    return this.artifactSending[planetId];
  }

  public getAbandonSpeedChangePercent(): number {
    return 100;
    // const { SPACE_JUNK_ENABLED, ABANDON_SPEED_CHANGE_PERCENT } =
    //   this.contractConstants;
    // if (SPACE_JUNK_ENABLED) {
    //   return ABANDON_SPEED_CHANGE_PERCENT;
    // } else {
    //   return 100;
    // }
  }

  public getAbandonRangeChangePercent(): number {
    return 100;
    // const { SPACE_JUNK_ENABLED, ABANDON_RANGE_CHANGE_PERCENT } =
    //   this.contractConstants;
    // if (SPACE_JUNK_ENABLED) {
    //   return ABANDON_RANGE_CHANGE_PERCENT;
    // } else {
    //   return 100;
    // }
  }

  public isSendingShip(planetId?: LocationId): boolean {
    if (!planetId) {
      return false;
    }
    // KEEP THIS its for artifact types 17 - 22 not for artifact type 3 artifact.spaceship
    return isSpaceShip(this.artifactSending[planetId]?.artifactType);
  }
  m;

  public setMUDComponents(components: unknown): void {
    this.mudComponents = components;
  }

  public getVoyageAtCoords(coords: WorldCoords): QueuedArrival | undefined {
    const voyages = this.getVoyagesAtCoords(coords);
    return voyages.length > 0 ? voyages[0] : undefined;
  }

  public getVoyagesAtCoords(coords: WorldCoords): QueuedArrival[] {
    const voyages = this.getAllVoyages();
    const currentTick = this.getCurrentTick();
    const foundVoyages: QueuedArrival[] = [];

    for (const voyage of voyages) {
      if (currentTick < voyage.arrivalTick) {
        const fromLoc = this.getLocationOfPlanet(voyage.fromPlanet);
        const toLoc = this.getLocationOfPlanet(voyage.toPlanet);

        if (!fromLoc || !toLoc) continue;

        // Check if click is near the voyage line (increased threshold for better detection)
        if (this.isPointNearLine(coords, fromLoc.coords, toLoc.coords, 50)) {
          foundVoyages.push(voyage);
        }
      }
    }

    return foundVoyages;
  }

  private isPointNearLine(
    point: WorldCoords,
    lineStart: WorldCoords,
    lineEnd: WorldCoords,
    threshold: number,
  ): boolean {
    const A = point.x - lineStart.x;
    const B = point.y - lineStart.y;
    const C = lineEnd.x - lineStart.x;
    const D = lineEnd.y - lineStart.y;

    const dot = A * C + B * D;
    const lenSq = C * C + D * D;

    if (lenSq === 0) {
      // Line is actually a point
      const dist = Math.sqrt(A * A + B * B);
      return dist <= threshold;
    }

    const param = dot / lenSq;
    let xx, yy;

    if (param < 0) {
      xx = lineStart.x;
      yy = lineStart.y;
    } else if (param > 1) {
      xx = lineEnd.x;
      yy = lineEnd.y;
    } else {
      xx = lineStart.x + param * C;
      yy = lineStart.y + param * D;
    }

    const dx = point.x - xx;
    const dy = point.y - yy;
    const distance = Math.sqrt(dx * dx + dy * dy);

    return distance <= threshold;
  }

  public isOverOwnPlanet(coords: WorldCoords): Planet | undefined {
    const res = this.viewportEntities.getNearestVisiblePlanet(coords);
    const planet: LocatablePlanet | undefined = res;
    if (!planet) {
      return undefined;
    }

    return this.gameManager.checkDelegateCondition(
      planet.owner,
      this.gameManager.getAccount(),
    )
      ? planet
      : undefined;
    return planet.owner === this.gameManager.getAccount() ? planet : undefined;
  }

  public getMyArtifacts(): Artifact[] {
    return this.gameManager.getMyArtifacts();
  }

  public getMyArtifactsNotBroken(): Artifact[] {
    return this.getMyArtifacts().filter((a) => !isBroken(a));
  }

  public getMyArtifactsNotOnPlanet(): Artifact[] {
    return this.getMyArtifacts().filter((a) => !a.onPlanetId);
  }

  public getPlanetWithId(planetId: LocationId | undefined): Planet | undefined {
    return this.gameManager.getPlanetWithId(planetId);
  }

  public updateArrival(planetId: LocationId, arrival: QueuedArrival): void {
    return this.gameManager.updateArrival(planetId, arrival);
  }

  public getMyScore(): number | undefined {
    return this.gameManager.getMyScore();
  }

  public getPlayer(address?: EthAddress): Player | undefined {
    return this.gameManager.getPlayer(address);
  }

  public getArtifactWithId(
    artifactId: ArtifactId | undefined,
  ): Artifact | undefined {
    return this.gameManager.getArtifactWithId(artifactId);
  }

  public getPlanetWithCoords(
    coords: WorldCoords | undefined,
  ): Planet | undefined {
    return coords && this.gameManager.getPlanetWithCoords(coords);
  }

  public getArtifactsWithIds(
    artifactIds?: ArtifactId[],
  ): Array<Artifact | undefined> {
    return this.gameManager.getArtifactsWithIds(artifactIds);
  }

  public getArtifactPlanet(artifact: Artifact): Planet | undefined {
    if (!artifact.onPlanetId) {
      return undefined;
    }
    return this.getPlanetWithId(artifact.onPlanetId);
  }

  public getArtifactWithdrawalDisabled(): boolean {
    return this.gameManager.getArtifactWithdrawalDisabled();
  }

  public getPlanetLevel(planetId: LocationId): PlanetLevel | undefined {
    return this.gameManager.getPlanetLevel(planetId);
  }

  public getAllOwnedPlanets(): Planet[] {
    return this.gameManager.getAllOwnedPlanets();
  }

  public getAllVoyages(): QueuedArrival[] {
    return this.gameManager.getAllVoyages();
  }

  public getSpeedBuff(): number {
    return this.gameManager.getSpeedBuff(this.abandoning);
  }

  public getRangeBuff(): number {
    return this.gameManager.getRangeBuff(this.abandoning);
  }

  /**
   * @todo delete this. now that {@link GameObjects} is publically accessible, we shouldn't need to
   * drill fields like this anymore.
   * @tutorial Plugin developers, please access fields like this with something like {@code df.getGameObjects().}
   * @deprecated
   */
  public getUnconfirmedMoves(): Transaction<UnconfirmedMove>[] {
    return this.gameManager.getUnconfirmedMoves();
  }

  public getUnconfirmedUpgrades(): Transaction<UnconfirmedUpgrade>[] {
    return this.gameManager.getUnconfirmedUpgrades();
  }

  public getUnconfirmedRefreshPlanets(): Transaction<UnconfirmedRefreshPlanet>[] {
    return this.gameManager.getUnconfirmedRefreshPlanets();
  }

  public isCurrentlyRevealing(): boolean {
    return this.gameManager.getNextRevealCountdownInfo().currentlyRevealing;
  }

  // public isCurrentlyClaiming(): boolean {
  //   return this.gameManager.getNextClaimCountdownInfo().currentlyClaiming;
  // }

  // public isCurrentlyBurning(): boolean {
  //   return this.gameManager.getNextBurnCountdownInfo().currentlyBurning;
  // }

  // public isCurrentlyKardasheving(): boolean {
  //   return this.gameManager.getNextKardashevCountdownInfo()
  //     .currentlyKardasheving;
  // }

  // public isCurrentlyPinking(): boolean {
  //   return this.gameManager.isCurrentlyPinking();
  // }

  // public isCurrentlyBlueing(): boolean {
  //   return this.gameManager.isCurrentlyBlueing();
  // }

  public getUnconfirmedLinkActivations(): Transaction<UnconfirmedActivateArtifact>[] {
    return this.gameManager.getUnconfirmedLinkActivations();
  }

  public getLinks(): Iterable<Link> {
    return this.gameManager.getLinks();
  }

  public getLocationOfPlanet(planetId: LocationId): WorldLocation | undefined {
    return this.gameManager.getLocationOfPlanet(planetId);
  }

  public getActiveArtifacts(planet: Planet): Artifact[] {
    return this.gameManager.getActiveArtifacts(planet);
  }

  public getExploredChunks(): Iterable<Chunk> {
    return this.gameManager.getExploredChunks();
  }

  public getLocationsAndChunks() {
    return this.viewportEntities.getPlanetsAndChunks();
  }

  public getCaptureZones() {
    return [];
    // return this.gameManager.getCaptureZones();
  }

  public getPinkZones() {
    return this.gameManager.getPinkZones();
  }

  public getAIZones() {
    return this.gameManager.getAIZones();
  }

  public getPinkZoneByArtifactId(artifactId: ArtifactId) {
    return this.gameManager.getPinkZoneByArtifactId(artifactId);
  }

  public getMyPinkZones() {
    return [];
    // return this.gameManager.getMyPinkZones();
  }

  public getBlueZones() {
    return [];
    // return this.gameManager.getBlueZones();
  }

  public getMyBlueZones() {
    return [];
    // return this.gameManager.getMyBlueZones();
  }

  // public getCaptureZoneGenerator() {
  //   return this.gameManager.getCaptureZoneGenerator();
  // }

  public getIsHighPerfMode(): boolean {
    const account = this.getAccount();

    if (account === undefined) {
      return false;
    }

    return this.getBooleanSetting(Setting.HighPerformanceRendering);
  }

  public getPlanetsInViewport(): Planet[] {
    return Array.from(
      this.viewportEntities.getPlanetsAndChunks().cachedPlanets.values(),
    ).map((p) => p.planet);
  }

  public getWorldRadius(): number {
    return this.gameManager.getWorldRadius();
  }

  public getInnerRadius(): number {
    return this.gameManager.getInnerRadius();
  }

  public getWorldSilver(): number {
    return this.gameManager.getWorldSilver();
  }

  public getUniverseTotalEnergy(): number {
    return this.gameManager.getUniverseTotalEnergy();
  }

  public getSilverOfPlayer(player: EthAddress): number {
    return this.gameManager.getSilverOfPlayer(player);
  }

  public getEnergyOfPlayer(player: EthAddress): number {
    return this.gameManager.getEnergyOfPlayer(player);
  }

  public getPlayerScore(player: EthAddress): number | undefined {
    return this.gameManager.getPlayerScore(player);
  }

  // public getPlayerActivateArtifactAmount(
  //   player: EthAddress,
  // ): number | undefined {
  //   return this.gameManager.getPlayerActivateArtifactAmount(player);
  // }
  // public getPlayerBuyArtifactAmount(player: EthAddress): number | undefined {
  //   return this.gameManager.getPlayerBuyArtifactAmount(player);
  // }

  // public getPlayerSilver(player: EthAddress): number | undefined {
  //   return this.gameManager.getPlayerSilver(player);
  // }

  public upgrade(planet: Planet, branch: number): void {
    // TODO: do something like JSON.stringify(args) so we know formatting is correct
    this.terminal.current?.printShellLn(
      `df.upgrade('${planet.locationId}', ${branch})`,
    );
    this.gameManager.upgrade(planet.locationId, branch);
  }

  public refreshPlanet(planet: Planet): void {
    // TODO: do something like JSON.stringify(args) so we know formatting is correct
    this.terminal.current?.printShellLn(
      `df.refreshPlanet('${planet.locationId})`,
    );
    this.gameManager.refreshPlanet(planet.locationId);
  }

  // public buySkin(planet: Planet, hatType: number): void {
  //   // TODO: do something like JSON.stringify(args) so we know formatting is correct
  //   this.terminal.current?.printShellLn(
  //     `df.buySkin('${planet.locationId}','${hatType}')`,
  //   );
  //   this.gameManager.buySkin(planet.locationId, hatType);
  // }

  // public buyPlanet(planet: Planet): void {
  //   this.terminal.current?.printShellLn(`df.buyPlanet('${planet.locationId}')`);
  //   this.gameManager.buyPlanet(planet.locationId);
  // }

  // public buySpaceship(planet: Planet): void {
  //   this.terminal.current?.printShellLn(
  //     `df.buySpaceship('${planet.locationId}')`,
  //   );
  //   this.gameManager.buySpaceship(planet.locationId);
  // }

  public donate(amount: number): void {
    // this.terminal.current?.printShellLn(`df.donate('${amount}')`);
    this.playClickSound();
    this.gameManager.donate(amount);
  }

  // non-nullable
  public getHomeCoords(): WorldCoords {
    return this.gameManager.getHomeCoords() || { x: 0, y: 0 };
  }

  public getHomeHash(): LocationId | undefined {
    return this.gameManager.getHomeHash();
  }

  public getHomePlanet(): Planet | undefined {
    const homeHash = this.getHomeHash();
    if (!homeHash) {
      return undefined;
    }
    return this.getPlanetWithId(homeHash);
  }

  public getRadiusOfPlanetLevel(planetRarity: PlanetLevel): number {
    return this.radiusMap[planetRarity];
  }

  public getEnergyCurveAtPercent(planet: Planet, percent: number): number {
    return this.gameManager.getEnergyCurveAtPercent(planet, percent);
  }

  public getSilverCurveAtPercent(
    planet: Planet,
    percent: number,
  ): number | undefined {
    return this.gameManager.getSilverCurveAtPercent(planet, percent);
  }

  public getHashesPerSec(): number {
    return this.gameManager.getHashesPerSec();
  }

  public generateVerificationTweet(twitter: string): Promise<string> {
    return this.gameManager.getSignedTwitter(twitter);
  }

  public getPerlinThresholds(): [number, number, number] {
    return this.gameManager.getPerlinThresholds();
  }

  public getHashConfig(): HashConfig {
    return this.gameManager.getHashConfig();
  }

  public getViewport(): Viewport {
    return Viewport.getInstance();
  }

  public getPlanetMap(): Map<LocationId, Planet> {
    return this.gameManager.getPlanetMap();
  }

  public getArtifactMap(): Map<ArtifactId, Artifact> {
    return this.gameManager.getArtifactMap();
  }

  public getMyPlanetMap(): Map<LocationId, Planet> {
    return this.gameManager.getMyPlanetMap();
  }

  public getMyArtifactMap(): Map<ArtifactId, Artifact> {
    return this.gameManager.getMyArtifactMap();
  }

  public getTerminal(): TerminalHandle | undefined {
    return this.terminal.current;
  }

  public get contractConstants(): ContractConstants {
    return this.gameManager.getContractConstants();
  }

  public getSpaceJunkEnabled(): boolean {
    return this.contractConstants.SPACE_JUNK_ENABLED;
  }

  public getGuildUtils(): GuildUtils {
    return this.gameManager.getContractAPI().getGuildUtils();
  }

  public inSameGuildAtTick(
    player1: EthAddress,
    player2: EthAddress,
    tick: number,
  ) {
    return this.getGuildUtils().inSameGuildAtTick(player1, player2, tick);
  }

  public inSameGuildRightNow(
    player1?: EthAddress,
    player2?: EthAddress,
  ): boolean {
    if (!player1) return false;
    if (!player2) return false;
    return this.getGuildUtils().inSameGuildRightNow(player1, player2);
  }
  // public get captureZonesEnabled(): boolean {
  //   return this.contractConstants.CAPTURE_ZONES_ENABLED;
  // }

  // public potentialCaptureScore(planetLevel: number): number {
  //   return this.contractConstants.CAPTURE_ZONE_PLANET_LEVEL_SCORE[planetLevel];
  // }

  // public getRadiusOfPinkCircle(planetLevel: number): number {
  //   return this.contractConstants.BURN_PLANET_LEVEL_EFFECT_RADIUS[planetLevel];
  // }

  // public getSilverOfBurnPlanet(
  //   account: EthAddress,
  //   planetLevel: number,
  // ): number | undefined {
  //   // const silverAmount = 10 ** this.player.dropBombAmount;
  //   const player = this.getPlayer(account);
  //   if (!player) {
  //     return undefined;
  //   }
  //   const silverAmount =
  //     this.contractConstants.BURN_PLANET_REQUIRE_SILVER_AMOUNTS[planetLevel] *
  //     10 ** player.dropBombAmount;

  //   return silverAmount;
  // }

  // public getKardashevRequireSilverAmount(planetLevel: number): number {
  //   return this.contractConstants.KARDASHEV_REQUIRE_SILVER_AMOUNTS[planetLevel];
  // }

  // public getBlueRequireSilverAmount(planetLevel: number): number {
  //   return this.contractConstants.BLUE_PANET_REQUIRE_SILVER_AMOUNTS[
  //     planetLevel
  //   ];
  // }

  // public getDefaultSpaceJunkForPlanetLevel(level: number): number {
  //   return this.contractConstants.PLANET_LEVEL_JUNK[level];
  // }

  public getPerlinConfig(isBiome = false): PerlinConfig {
    const hashConfig = this.gameManager.getHashConfig();
    const key = isBiome ? hashConfig.biomebaseKey : hashConfig.spaceTypeKey;

    return {
      key,
      scale: hashConfig.perlinLengthScale,
      mirrorX: hashConfig.perlinMirrorX,
      mirrorY: hashConfig.perlinMirrorY,
      floor: false,
    };
  }

  /**
   * Gets a reference to the game's internal representation of the world state. Beware! Use this for
   * reading only, otherwise you might mess up the state of the game. You can try modifying the game
   * state in some way
   */
  public getGameObjects(): GameObjects {
    return this.gameManager.getGameObjects();
  }

  // internal utils

  private updatePlanets() {
    if (this.mouseDownOverPlanet) {
      this.mouseDownOverPlanet = this.gameManager.getPlanetWithId(
        this.mouseDownOverPlanet.locationId,
      ) as LocatablePlanet;
    }
    if (this.mouseHoveringOverPlanet) {
      this.setHoveringOverPlanet(
        this.gameManager.getPlanetWithId(
          this.mouseHoveringOverPlanet.locationId,
        ) as LocatablePlanet,
        true,
      );
    }
  }

  private updateMouseHoveringOverCoords(coords: WorldCoords): WorldCoords {
    // if the mouse is inside hitbox of a planet, snaps the mouse to center of planet
    this.mouseHoveringOverCoords = coords;
    let hoveringPlanet = undefined;

    const res = this.viewportEntities.getNearestVisiblePlanet(coords);
    if (res) {
      hoveringPlanet = res;
      this.mouseHoveringOverCoords = res.location.coords;
    }

    this.setHoveringOverPlanet(hoveringPlanet, true);

    this.mouseHoveringOverCoords = {
      x: Math.round(this.mouseHoveringOverCoords.x),
      y: Math.round(this.mouseHoveringOverCoords.y),
    };
    return this.mouseHoveringOverCoords;
  }

  private onEmitInitializedPlayer() {
    this.emit(GameUIManagerEvent.InitializedPlayer);
  }

  private onEmitInitializedPlayerError(err: React.ReactNode) {
    this.emit(GameUIManagerEvent.InitializedPlayerError, err);
  }

  public getGameManager(): GameManager {
    return this.gameManager;
  }

  private setModalManager(modalManager: ModalManager) {
    this.modalManager = modalManager;
  }

  public getModalManager(): ModalManager {
    return this.modalManager;
  }

  /**
   * If there is a planet being hovered over, returns whether or not it's being hovered
   * over in the renderer.
   */
  public getPlanetHoveringInRenderer() {
    return this.planetHoveringInRenderer;
  }

  public getRenderer(): Renderer | null {
    return Renderer.instance;
  }

  getPaused(): boolean {
    return this.gameManager.getPaused();
  }

  getPaused$(): Monomitter<boolean> {
    return this.gameManager.getPaused$();
  }

  // getHalfPrice(): boolean {
  //   return this.gameManager.getHalfPrice();
  // }

  // getHalfPrice$(): Monomitter<boolean> {
  //   return this.gameManager.getHalfPrice$();
  // }

  // public getSilverScoreValue(): number {
  //   return this.contractConstants.SILVER_SCORE_VALUE;
  // }

  // public getArtifactPointValues() {
  //   return this.contractConstants.ARTIFACT_POINT_VALUES;
  // }

  // public getCaptureZonePointValues() {
  //   return this.contractConstants.CAPTURE_ZONE_PLANET_LEVEL_SCORE;
  // }

  public getArtifactUpdated$() {
    return this.gameManager.getArtifactUpdated$();
  }

  public getUIEmitter() {
    return UIEmitter.getInstance();
  }

  /**
   * @returns - A wrapper class for the WebGL2RenderingContext.
   */
  public getGlManager(): GameGLManager | null {
    const renderer = this.getRenderer();
    if (renderer) {
      return renderer.glManager;
    }
    return null;
  }

  /**
   * @returns the CanvasRenderingContext2D for the game canvas.
   */
  public get2dRenderer(): CanvasRenderingContext2D | null {
    const renderer = this.getRenderer();
    if (renderer) {
      return renderer.get2DRenderer();
    }
    return null;
  }

  /**
   * Replaces the current renderer with the passed in custom renderer and adds the renderer
   * to the rendering stack. The function will automatically determine which renderer it is
   * by the rendererType and the methods in the renderer.
   * @param customRenderer - a Renderer that follows one of the 23 renderer tempaltes
   */
  public setCustomRenderer(customRenderer: BaseRenderer) {
    const renderer = this.getRenderer();
    if (renderer) {
      renderer.addCustomRenderer(customRenderer);
    }
  }

  /**
   * This function will remove the passed in renderer from the renderering stack. If the
   * renderer is on top of the renderering stack the next renderer will be the one bellow it.
   * @param customRenderer - a Renderer that follows one of the 23 renderer tempaltes
   */
  public disableCustomRenderer(customRenderer: BaseRenderer) {
    const renderer = this.getRenderer();
    if (renderer) {
      renderer.removeCustomRenderer(customRenderer);
    }
  }

  public playHoverSound() {
    const backgroundMusicEnabled = this.getBooleanSetting(
      Setting.BackgroundMusicEnabled,
    );

    if (!backgroundMusicEnabled) return;

    const backgroundMusicVolume = this.getStringSetting(
      Setting.BackgroundMusicVolume,
    );

    const hoverSound = new Howl({
      src: ["/sounds/hover.ogg"],
      volume: Math.round(Number(backgroundMusicVolume) / 10),
      html5: true,
      onload: () => {
        // console.log("Hover sound loaded");
      },
      onplay: () => {
        // console.log("Hover sound playing");
      },
    });
    hoverSound.play();
  }

  public playClickSound() {
    const backgroundMusicEnabled = this.getBooleanSetting(
      Setting.BackgroundMusicEnabled,
    );

    if (!backgroundMusicEnabled) return;

    const backgroundMusicVolume = this.getStringSetting(
      Setting.BackgroundMusicVolume,
    );

    const clickSound = new Howl({
      src: ["/sounds/click.ogg"],
      volume: Math.round(Number(backgroundMusicVolume) / 10),
      html5: true,
      onload: () => {
        // console.log("Click sound loaded");
      },
      onplay: () => {
        // console.log("Click sound playing");
      },
    });
    clickSound.play();
  }
}
