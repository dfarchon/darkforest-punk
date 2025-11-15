import { EMPTY_ADDRESS } from "@df/constants";
import type { Monomitter } from "@df/events";
import { monomitter } from "@df/events";
import { hasOwner, isActivated, isLocatable } from "@df/gamelogic";
import { TxCollection } from "@df/network";
import {
  artifactIdToDecStr,
  isUnconfirmedActivateArtifact,
  isUnconfirmedActivateArtifactTx,
  isUnconfirmedBlue,
  isUnconfirmedBlueTx,
  isUnconfirmedBurn,
  isUnconfirmedBurnTx,
  isUnconfirmedBuyArtifact,
  isUnconfirmedBuyArtifactTx,
  isUnconfirmedBuyHat,
  isUnconfirmedBuyHatTx,
  isUnconfirmedCapturePlanetTx,
  isUnconfirmedChangeArtifactImageType,
  isUnconfirmedChangeArtifactImageTypeTx,
  isUnconfirmedChargeArtifact,
  isUnconfirmedChargeArtifactTx,
  isUnconfirmedClaim,
  isUnconfirmedClaimTx,
  isUnconfirmedDeactivateArtifact,
  isUnconfirmedDeactivateArtifactTx,
  isUnconfirmedDepositArtifact,
  isUnconfirmedDepositArtifactTx,
  isUnconfirmedFindArtifact,
  isUnconfirmedFindArtifactTx,
  isUnconfirmedGetShipsTx,
  isUnconfirmedInvadePlanetTx,
  isUnconfirmedKardashev,
  isUnconfirmedKardashevTx,
  isUnconfirmedMove,
  isUnconfirmedMoveTx,
  isUnconfirmedPink,
  isUnconfirmedPinkTx,
  isUnconfirmedProspectPlanet,
  isUnconfirmedProspectPlanetTx,
  isUnconfirmedRefreshPlanet,
  isUnconfirmedRefreshPlanetTx,
  isUnconfirmedReveal,
  isUnconfirmedRevealTx,
  isUnconfirmedShutdownArtifact,
  isUnconfirmedShutdownArtifactTx,
  isUnconfirmedTransfer,
  isUnconfirmedTransferTx,
  isUnconfirmedUpgrade,
  isUnconfirmedUpgradeTx,
  isUnconfirmedWithdrawArtifact,
  isUnconfirmedWithdrawArtifactTx,
  isUnconfirmedWithdrawSilver,
  isUnconfirmedWithdrawSilverTx,
  locationIdFromHexStr,
  locationIdToHexStr,
} from "@df/serde";
import type {
  Abstract,
  ArrivalWithTimer,
  Artifact,
  ArtifactId,
  BurnedLocation,
  Chunk,
  EthAddress,
  Link,
  LocatablePlanet,
  LocationId,
  PinkZone,
  AIZone,
  Planet,
  QueuedArrival,
  Radii,
  RevealedLocation,
  Transaction,
  TransactionCollection,
  VoyageId,
  WorldCoords,
  WorldLocation,
} from "@df/types";
import type { PlanetLevel } from "@df/types";
import type { Biome } from "@df/types";
import { ArtifactStatus, ArtifactType, PlanetType, SpaceType } from "@df/types";
import { getComponentValue } from "@latticexyz/recs";
import { encodeEntity } from "@latticexyz/store-sync/recs";
import type { ClientComponents } from "@mud/createClientComponents";
import autoBind from "auto-bind";
import { ethers } from "ethers";

import type { ContractConstants } from "../../_types/darkforest/api/ContractsAPITypes";
import NotificationManager from "../../Frontend/Game/NotificationManager";
import {
  getArtifactId,
  getArtifactOwner,
  getPlanetId,
  getPlanetOwner,
  setObjectSyncState,
} from "../../Frontend/Utils/EmitterUtils";
import type { PlanetDiff } from "./ArrivalUtils";
import { arrive, updatePlanetToTick } from "./ArrivalUtils";
import { updateArtifactStatus } from "./ArtifactUtils";
import { GuildUtils } from "./GuildUtils";
import { LayeredMap } from "./LayeredMap";
import { PlanetUtils } from "./PlanetUtils";
import { TickerUtils } from "./TickerUtils";

type CoordsString = Abstract<string, "CoordString">;

const getCoordsString = (coords: WorldCoords): CoordsString => {
  return `${coords.x},${coords.y}` as CoordsString;
};

/**
 * Representation of the objects which exist in the world.
 */
export class GameObjects {
  /**
   * This is a data structure that allows us to efficiently calculate which planets are visible on
   * the player's screen given the viewport's position and size.
   */
  private readonly layeredMap: LayeredMap;

  /**
   * This address of the player that is currently logged in.
   *
   * @todo move this, along with all other objects relating to the currently logged-on player into a
   * new field: {@code player: PlayerInfo}
   */
  private readonly address: EthAddress | undefined;

  /**
   * Cached index of all known planet data.
   *
   * Warning!
   *
   * This should NEVER be set to directly! Any time you want to update a planet, you must call the
   * {@link GameObjects#setPlanet()} function. Following this rule enables us to reliably notify
   * other parts of the client when a particular object has been updated. TODO: what is the best way
   * to do this?
   *
   * @todo extract the pattern we're using for the field tuples
   *   - {planets, myPlanets, myPlanetsUpdated, planetUpdated$}
   *   - {artifacts, myArtifacts, myArtifactsUpdated, artifactUpdated$}
   *
   *   into some sort of class.
   */
  private readonly planets: Map<LocationId, Planet>;

  /**
   * Cached index of planets owned by the player.
   *
   * @see The same warning applys as the one on {@link GameObjects.planets}
   */
  private readonly myPlanets: Map<LocationId, Planet>;

  /**
   * Cached index of all known artifact data.
   *
   * @see The same warning applys as the one on {@link GameObjects.planets}
   */
  private readonly artifacts: Map<ArtifactId, Artifact>;

  /**
   * Cached index of artifacts owned by the player.
   *
   * @see The same warning applys as the one on {@link GameObjects.planets}
   */
  private readonly myArtifacts: Map<ArtifactId, Artifact>;

  /**
   * Map from artifact ids to links.
   */
  private readonly links: Map<ArtifactId, Link>;

  /**
   * Set of all planet ids that we know have been interacted-with on-chain.
   */
  private readonly touchedPlanetIds: Set<LocationId>;

  /**
   * Map of arrivals to timers that fire when an arrival arrives, in case that handler needs to be
   * cancelled for whatever reason.
   */
  private readonly arrivals: Map<VoyageId, ArrivalWithTimer>;

  /**
   * Map from a location id (think of it as the unique id of each planet) to all the ids of the
   * voyages that are arriving on that planet. These include both the player's own voyages, and also
   * any potential invader's voyages.
   */
  private readonly planetArrivalIds: Map<LocationId, VoyageId[]>;

  /**
   * Map from location id (unique id of each planet) to some information about the location at which
   * this planet is located, if this client happens to know the coordinates of this planet.
   */
  private readonly planetLocationMap: Map<LocationId, WorldLocation>;

  /**
   * Map from location ids to, if that location id has been revealed on-chain, the world coordinates
   * of that location id, as well as some extra information regarding the circumstances of the
   * revealing of this planet.
   */
  private readonly revealedLocations: Map<LocationId, RevealedLocation>;

  // private readonly claimedLocations: Map<LocationId, ClaimedLocation>;
  // private readonly burnedLocations: Map<LocationId, BurnedLocation>;
  // private readonly kardashevLocations: Map<LocationId, BurnedLocation>;
  private readonly pinkZones: Map<ArtifactId, PinkZone>;

  private aiZones: Set<AIZone>;

  /**
   * Some of the game's parameters are downloaded from the blockchain. This allows the client to be
   * flexible, and connect to any compatible set of Dark Forest contracts, download the parameters,
   * and join the game, taking into account the unique configuration of those specific Dark Forest
   * contracts.
   */
  private readonly contractConstants: ContractConstants;

  /**
   * Map from a stringified representation of an x-y coordinate to an object that contains some more
   * information about the world at that location.
   */
  private readonly coordsToLocation: Map<CoordsString, WorldLocation>;

  /**
   * Transactions that are currently in flight.
   */
  public readonly transactions: TransactionCollection;

  /**
   * Event emitter which publishes whenever a planet is updated.
   */
  public readonly planetUpdated$: Monomitter<LocationId>;

  /**
   * Event emitter which publishes whenever an artifact has been updated.
   */
  public readonly artifactUpdated$: Monomitter<ArtifactId>;

  /**
   * Whenever a planet is updated, we publish to this event with a reference to a map from location
   * id to planet. We need to rethink this event emitter because it currently publishes every time
   * that any planet is updated, and if a lot of them are updated at once (which i think is the case
   * once every two minutes) then this event emitter will publish a shitton of events.
   * TODO: rethink this
   */
  public readonly myPlanetsUpdated$: Monomitter<Map<LocationId, Planet>>;

  /**
   * Whenever one of the player's artifacts are updated, this event emitter publishes. See
   * {@link GameObjects.myPlanetsUpdated$} for more info.
   */
  public readonly myArtifactsUpdated$: Monomitter<Map<ArtifactId, Artifact>>;

  private planetUtils: PlanetUtils;
  private tickerUtils: TickerUtils;
  private components: ClientComponents;
  private guildUtils: GuildUtils;
  constructor(
    address: EthAddress | undefined,
    touchedPlanets: Map<LocationId, Planet>,
    allTouchedPlanetIds: Set<LocationId>,
    revealedLocations: Map<LocationId, RevealedLocation>,
    // claimedLocations: Map<LocationId, ClaimedLocation>,
    // burnedLocations: Map<LocationId, BurnedLocation>,
    // kardashevLocations: Map<LocationId, KardashevLocation>,
    artifacts: Map<ArtifactId, Artifact>,
    allChunks: Iterable<Chunk>,
    unprocessedArrivals: Map<VoyageId, QueuedArrival>,
    unprocessedPlanetArrivalIds: Map<LocationId, VoyageId[]>,
    contractConstants: ContractConstants,
    worldRadius: number,
    components: ClientComponents,
  ) {
    autoBind(this);

    this.address = address;
    this.planets = touchedPlanets;
    this.myPlanets = new Map();
    this.touchedPlanetIds = allTouchedPlanetIds;
    this.revealedLocations = revealedLocations;
    // this.claimedLocations = claimedLocations;
    // this.burnedLocations = burnedLocations;
    // this.kardashevLocations = kardashevLocations;
    this.pinkZones = new Map();
    this.artifacts = artifacts;
    this.myArtifacts = new Map();
    this.contractConstants = contractConstants;
    this.coordsToLocation = new Map();
    this.planetLocationMap = new Map();
    this.planetArrivalIds = new Map();
    this.arrivals = new Map();
    this.transactions = new TxCollection();
    this.links = new Map();
    this.layeredMap = new LayeredMap(worldRadius);
    this.planetUtils = new PlanetUtils({
      components: components,
      contractConstants: contractConstants,
    });
    this.tickerUtils = new TickerUtils({ components });
    this.components = components;

    this.guildUtils = new GuildUtils({ components });
    this.planetUpdated$ = monomitter();
    this.artifactUpdated$ = monomitter();
    this.myArtifactsUpdated$ = monomitter();
    this.myPlanetsUpdated$ = monomitter();

    for (const chunk of allChunks) {
      for (const planetLocation of chunk.planetLocations) {
        this.addPlanetLocation(planetLocation);
      }
    }

    for (const location of revealedLocations.values()) {
      this.markLocationRevealed(location);
      this.addPlanetLocation(location);
    }

    this.replaceArtifactsFromContractData(artifacts.values());

    touchedPlanets.forEach((planet, planetId) => {
      const arrivalIds = unprocessedPlanetArrivalIds.get(planetId);

      if (planet && arrivalIds) {
        const arrivalsForPlanetNull: (QueuedArrival | undefined)[] =
          arrivalIds.map((arrivalId) => unprocessedArrivals.get(arrivalId));
        const arrivalsForPlanet: QueuedArrival[] = arrivalsForPlanetNull.filter(
          (x) => !!x,
        ) as QueuedArrival[];

        const revealedLocation = revealedLocations.get(planetId);
        if (revealedLocation) {
          planet.coordsRevealed = true;
          planet.revealer = revealedLocation.revealer;
        }
        const arrivalsWithTimers = this.processArrivalsForPlanet(
          planet.locationId,
          arrivalsForPlanet,
        );

        this.planetArrivalIds.set(
          planetId,
          arrivalsWithTimers.map((arrival) => arrival.arrivalData.eventId),
        );
        for (const arrivalWithTimer of arrivalsWithTimers) {
          const arrivalId = arrivalWithTimer.arrivalData.eventId;
          this.arrivals.set(arrivalId, arrivalWithTimer);
        }
        const planetLocation = this.planetLocationMap.get(planetId);
        if (planet && planetLocation) {
          (planet as LocatablePlanet).location = planetLocation;
          (planet as LocatablePlanet).biome = this.getBiome(planetLocation);
        }

        this.setPlanet(planet);
        this.updateScore(planetId as LocationId);
      }
    });

    // for (const [_locId, claimedLoc] of claimedLocations) {
    //   this.updatePlanet(claimedLoc.hash, (p) => {
    //     p.claimer = claimedLoc.claimer;
    //   });
    // }

    // for (const [_locId, burnedLoc] of burnedLocations) {
    //   this.updatePlanet(burnedLoc.hash, (p) => {
    //     p.burnOperator = burnedLoc.operator;
    //   });
    // }

    // for (const [_locId, kardashevLoc] of kardashevLocations) {
    //   this.updatePlanet(kardashevLoc.hash, (p) => {
    //     p.kardashevOperator = kardashevLoc.operator;
    //   });
    // }

    // TODO: do this better...
    // set interval to update all planets every 120s
    //
    // PUNK
    // setInterval(() => {
    //   this.planets.forEach((planet) => {
    //     if (planet && hasOwner(planet)) {
    //       updatePlanetToTick(
    //         planet,
    //         this.getPlanetArtifacts(planet.locationId),
    //         this.tickerUtils.getCurrentTick(),
    //         this.contractConstants,
    //       );
    //     }
    //   });
    // }, 120 * 1000);
  }

  public getLinks(): Iterable<Link> {
    return this.links.values();
  }

  public getArtifactById(artifactId?: ArtifactId): Artifact | undefined {
    if (artifactId) {
      const artifact = this.artifacts.get(artifactId);
      if (artifact) {
        const curTick = this.tickerUtils.getCurrentTick();
        updateArtifactStatus(artifact, curTick);
      }
      return artifact;
    }
    return artifactId ? this.artifacts.get(artifactId) : undefined;
  }

  public getArtifactsOwnedBy(addr: EthAddress): Artifact[] {
    const ret: Artifact[] = [];
    this.artifacts.forEach((artifact) => {
      if (artifact.currentOwner === addr || artifact.controller === addr) {
        ret.push(artifact);
      }
    });
    return ret;
  }

  public getPlanetArtifacts(planetId: LocationId): Artifact[] {
    return (this.planets.get(planetId)?.heldArtifactIds || [])
      .map((id) => this.artifacts.get(id))
      .filter((a) => !!a) as Artifact[];
  }

  public getArtifactsOnPlanetsOwnedBy(addr: EthAddress): Artifact[] {
    const ret: Artifact[] = [];
    this.artifacts.forEach((artifact) => {
      if (artifact.onPlanetId) {
        const planet = this.getPlanetWithId(artifact.onPlanetId, false);
        if (planet && planet.owner === addr) {
          ret.push(artifact);
        }
      }
    });
    return ret;
  }

  // get planet by ID - must be in contract or known chunks
  public getPlanetWithId(
    planetId: LocationId,
    updateIfStale = true,
  ): Planet | undefined {
    const planet = this.planets.get(planetId);
    if (planet) {
      if (updateIfStale) {
        this.updatePlanetIfStale(planet);
      }
      planet.owner = planet.owner.toLowerCase() as EthAddress;
      return planet;
    }
    const loc = this.getLocationOfPlanet(planetId);
    if (!loc) {
      return undefined;
    }

    return this.getPlanetWithLocation(loc);
  }

  // returns undefined if this planet is neither in contract nor in known chunks
  // fast query that doesn't update planet if stale
  public getPlanetLevel(planetId: LocationId): PlanetLevel | undefined {
    const planet = this.planets.get(planetId);
    if (planet) {
      return planet.planetLevel;
    }
    return undefined;
  }

  // returns undefined if this planet is neither in contract nor in known chunks
  // fast query that doesn't update planet if stale
  public getPlanetDetailLevel(planetId: LocationId): number | undefined {
    const planet = this.planets.get(planetId);
    if (planet) {
      let detailLevel = planet.planetLevel as number;
      if (hasOwner(planet)) {
        detailLevel += 1;
      }
      return detailLevel;
    } else {
      return undefined;
    }
  }

  /**
   * This function is called when an artifact is missing from the contract.
   * This is only caused by player's withdrawal of his artifact.
   * In above case, we should set the artifact's onPlanetId to undefined.
   */
  public handleMissingArtifactOnChain(artifactId: ArtifactId): void {
    const artifact = this.artifacts.get(artifactId);
    if (artifact) {
      artifact.onPlanetId = undefined;
      this.setArtifact(artifact);
    }
  }

  /**
   * received some artifact data from the contract. update our stores
   */
  public replaceArtifactFromContractData(artifact: Artifact): void {
    const localArtifact = this.artifacts.get(artifact.id);
    if (localArtifact) {
      artifact.transactions = localArtifact.transactions;
      // artifact.onPlanetId = localArtifact.onPlanetId;
    }

    this.setArtifact(artifact);
  }

  public replaceArtifactsFromContractData(artifacts: Iterable<Artifact>) {
    for (const artifact of artifacts) {
      this.replaceArtifactFromContractData(artifact);
    }
  }

  /**
   * Given a planet id, update the state of the given planet by calling the given update function.
   * If the planet was updated, then also publish the appropriate event.
   */
  public updatePlanet(id: LocationId, updateFn: (p: Planet) => void) {
    const planet = this.getPlanetWithId(id);

    if (planet !== undefined) {
      updateFn(planet);
      this.setPlanet(planet);
    }
  }

  /**
   * Given a planet id, update the state of the given planet by calling the given update function.
   * If the planet was updated, then also publish the appropriate event.
   */
  public updateArtifact(
    id: ArtifactId | undefined,
    updateFn: (p: Artifact) => void,
  ) {
    const artifact = this.getArtifactById(id);

    if (artifact !== undefined) {
      updateFn(artifact);
      this.setArtifact(artifact);
    }
  }

  /**
   * received some planet data from the contract. update our stores
   */
  public replacePlanetFromContractData(
    planet: Planet,
    updatedArrivals?: QueuedArrival[],
    updatedArtifactsOnPlanet?: ArtifactId[],
    revealedLocation?: RevealedLocation,
    // claimerEthAddress?: EthAddress, // TODO: Remove this
    // burnOperator?: EthAddress,
    // kardashevOperator?: EthAddress,
  ): void {
    this.touchedPlanetIds.add(planet.locationId);
    // does not modify unconfirmed txs
    // that is handled by onTxConfirm
    const localPlanet = this.planets.get(planet.locationId);
    if (localPlanet) {
      const {
        transactions,
        loadingServerState,
        needsServerRefresh,
        lastLoadedServerState,
        emojiBobAnimation,
        emojiZoopAnimation,
        emojiZoopOutAnimation,
        // messages,
        emoji,
      } = localPlanet;
      planet.transactions = transactions;
      planet.loadingServerState = loadingServerState;
      planet.needsServerRefresh = needsServerRefresh;
      planet.lastLoadedServerState = lastLoadedServerState;
      planet.emojiBobAnimation = emojiBobAnimation;
      planet.emojiZoopAnimation = emojiZoopAnimation;
      planet.emojiZoopOutAnimation = emojiZoopOutAnimation;
      // planet.messages = messages;
      planet.emoji = emoji;

      // Possibly non updated props
      planet.heldArtifactIds = localPlanet.heldArtifactIds;
    } else {
      this.planets.set(planet.locationId, planet);
    }

    if (updatedArtifactsOnPlanet) {
      planet.heldArtifactIds = updatedArtifactsOnPlanet;
    }
    // make planet Locatable if we know its location
    const loc =
      this.planetLocationMap.get(planet.locationId) || revealedLocation;
    if (loc) {
      (planet as LocatablePlanet).location = loc;
      (planet as LocatablePlanet).biome = this.getBiome(loc);

      // For SUN planets, always read materials from contract to ensure SOLAR_ENERGY is visible
      if (planet.planetType === PlanetType.SUN) {
        planet.materials = this.planetUtils.readMaterials(planet);
      } else if (planet.addJunkTick === 0) {
        const materials = this.planetUtils.getDefaultMaterials(
          (planet as LocatablePlanet).biome,
          planet,
        );

        planet.materials = planet.materials.map((existing) => {
          const defaultMaterial = materials.find(
            (mat) => mat.materialId === existing.materialId,
          );

          if (defaultMaterial && defaultMaterial.materialAmount > 0) {
            const newAmount =
              existing.materialAmount + defaultMaterial.materialAmount;
            console.log(
              `Adding ${defaultMaterial.materialAmount} to ${existing.materialAmount} = ${newAmount}`,
            );
            return {
              ...existing,
              materialAmount: newAmount,
            };
          }
          return existing;
        });
      } else {
        // After junk is added for other planet types, read materials from contract
        planet.materials = this.planetUtils.readMaterials(planet);
      }
    }
    if (revealedLocation) {
      this.markLocationRevealed(revealedLocation);
      this.addPlanetLocation(revealedLocation);
      planet.coordsRevealed = true;
      planet.revealer = revealedLocation.revealer;
    }

    // if (claimerEthAddress) {
    //   planet.claimer = claimerEthAddress;
    // }
    // if (burnOperator) {
    //   planet.burnOperator = burnOperator;
    // }

    // if (kardashevOperator) {
    //   planet.kardashevOperator = kardashevOperator;
    // }
    this.setPlanet(planet);

    if (updatedArrivals) {
      // apply arrivals
      this.clearOldArrivals(planet);
      const updatedAwts = this.processArrivalsForPlanet(
        planet.locationId,
        updatedArrivals,
      );
      for (const awt of updatedAwts) {
        const arrivalId = awt.arrivalData.eventId;
        this.arrivals.set(arrivalId, awt);
        const arrivalIds = this.planetArrivalIds.get(planet.locationId);
        if (arrivalIds) {
          arrivalIds.push(arrivalId);
          this.planetArrivalIds.set(planet.locationId, arrivalIds);
        }
      }
    }
    this.updateScore(planet.locationId);
  }

  // returns an empty planet if planet is not in contract
  // returns undefined if this isn't a planet, according to hash and coords
  public getPlanetWithCoords(coords: WorldCoords): LocatablePlanet | undefined {
    const str = getCoordsString(coords);

    const location = this.coordsToLocation.get(str);
    if (!location) {
      return undefined;
    }

    return this.getPlanetWithLocation(location) as LocatablePlanet;
  }

  // - returns an empty planet if planet is not in contract
  // - returns undefined if this isn't a planet, according to hash and coords
  // - if this planet hasn't been initialized in the client yet, initializes it
  public getPlanetWithLocation(
    location: WorldLocation | undefined,
  ): Planet | undefined {
    if (!location) {
      return undefined;
    }

    const planet = this.planets.get(location.hash);
    if (planet) {
      this.updatePlanetIfStale(planet);
      return planet;
    }

    // return a default unowned planet
    const defaultPlanet = this.defaultPlanetFromLocation(location);
    this.setPlanet(defaultPlanet);

    return defaultPlanet;
  }

  public isPlanetInContract(planetId: LocationId): boolean {
    return this.touchedPlanetIds.has(planetId);
  }

  /**
   * Called when we load chunk data into memory (on startup), when we're loading all revealed locations (on startup),
   * when miner has mined a new chunk while exploring, and when a planet's location is revealed onchain during the course of play
   * Adds a WorldLocation to the planetLocationMap, making it known to the player locally
   * Sets an unsynced default planet in the PlanetMap this.planets
   * IMPORTANT: This is the only way a LocatablePlanet gets constructed
   * IMPORTANT: Idempotent
   */
  public addPlanetLocation(planetLocation: WorldLocation): void {
    //###############
    //  NEW MAP ALGO
    //###############
    const planetX = planetLocation.coords.x;
    const planetY = planetLocation.coords.y;
    const distFromOrigin = Math.sqrt(planetX ** 2 + planetY ** 2);

    this.layeredMap.insertPlanet(
      planetLocation,
      this.getPlanetWithId(planetLocation.hash, false)?.planetLevel ??
        this.planetLevelFromHexPerlin(
          planetLocation.hash,
          planetLocation.perlin,
          distFromOrigin,
        ),
    );

    this.planetLocationMap.set(planetLocation.hash, planetLocation);
    const str = getCoordsString(planetLocation.coords);

    if (!this.coordsToLocation.has(str)) {
      this.coordsToLocation.set(str, planetLocation);
    }

    if (!this.planets.get(planetLocation.hash)) {
      this.setPlanet(this.defaultPlanetFromLocation(planetLocation));
    }

    const planet = this.planets.get(planetLocation.hash);

    if (planet) {
      (planet as LocatablePlanet).location = planetLocation;
      (planet as LocatablePlanet).biome = this.getBiome(planetLocation);
    }
  }

  // marks that a location is revealed on-chain
  public markLocationRevealed(revealedLocation: RevealedLocation): void {
    this.revealedLocations.set(revealedLocation.hash, revealedLocation);
  }

  public getLocationOfPlanet(planetId: LocationId): WorldLocation | undefined {
    return this.planetLocationMap.get(planetId) || undefined;
  }

  /**
   * Returns all planets in the game.
   *
   * Warning! Simply iterating over this is not performant, and is meant for scripting.
   *
   * @tutorial For plugin developers!
   */
  public getAllPlanets(): Iterable<Planet> {
    return this.planets.values();
  }

  /**
   * Returns all planets in the game, as a map from their location id to the planet.
   *
   * @tutorial For plugin developers!
   * @see Warning in {@link GameObjects.getAllPlanets()}
   */
  public getAllPlanetsMap(): Map<LocationId, Planet> {
    return this.planets;
  }

  /**
   * Returns all the planets in the game which this client is aware of that have an owner, as a map
   * from their id to the planet
   *
   * @tutorial For plugin developers!
   * @see Warning in {@link GameObjects.getAllPlanets()}
   */
  public getAllOwnedPlanets(): Planet[] {
    const ownedPlanet = [];
    for (const planet of this.planets.values()) {
      if (hasOwner(planet)) {
        ownedPlanet.push(planet);
      }
    }
    return ownedPlanet;
  }

  /**
   * Returns all voyages that are scheduled to arrive at some point in the future.
   *
   * @tutorial For plugin developers!
   * @see Warning in {@link GameObjects.getAllPlanets()}
   */
  public getAllVoyages(): QueuedArrival[] {
    return Array.from(this.arrivals.values()).map((awt) => awt.arrivalData);
  }

  /**
   * We call this function whenever the user requests that we send a transaction to the blockchain
   * with their localstorage wallet. You can think of it as one of the hubs which connects
   * `GameObjects` to the rest of the world.
   *
   * Inside this function, we update the relevant internal game objects to reflect that the user has
   * requested a particular action. Additionally, we publish the appropriate events to the relevant
   * {@link Monomitter} instances that are stored in this class.
   *
   * In the case of something like prospecting for an artifact, this allows us to display a spinner
   * text which says "Prospecting..."
   *
   * In the case of the user sending energy from one planet to another planet, this allows us to
   * display a dashed line between the two planets in their new voyage.
   *
   * Whenever we update an entity, we must do it via that entity's type's corresponding
   * `set<EntityType>` function, in order for us to publish these events.
   *
   * @todo: this entire function could be automated by implementing a new interface called
   * {@code TxFilter}.
   */
  public onTxIntent(tx: Transaction) {
    this.transactions.addTransaction(tx);

    if (isUnconfirmedClaimTx(tx)) {
      const planet = this.getPlanetWithId(tx.intent.locationId);
      if (planet) {
        planet.transactions?.addTransaction(tx);
        this.setPlanet(planet);
      }
    } else if (isUnconfirmedRevealTx(tx)) {
      const planet = this.getPlanetWithId(tx.intent.locationId);
      if (planet) {
        planet.transactions?.addTransaction(tx);
        this.setPlanet(planet);
      }
    } else if (isUnconfirmedMoveTx(tx)) {
      const planet = this.getPlanetWithId(tx.intent.from);
      if (planet) {
        planet.transactions?.addTransaction(tx);
        this.setPlanet(planet);
      }
      if (tx.intent.artifact) {
        const artifact = this.getArtifactById(tx.intent.artifact);
        if (artifact) {
          artifact.transactions?.addTransaction(tx);
          this.setArtifact(artifact);
        }
      }
    } else if (isUnconfirmedUpgradeTx(tx)) {
      const planet = this.getPlanetWithId(tx.intent.locationId);
      if (planet) {
        planet.transactions?.addTransaction(tx);
        this.setPlanet(planet);
      }
    } else if (isUnconfirmedRefreshPlanetTx(tx)) {
      const planet = this.getPlanetWithId(tx.intent.locationId);
      if (planet) {
        planet.transactions?.addTransaction(tx);
        this.setPlanet(planet);
      }
    } else if (isUnconfirmedBuyHatTx(tx)) {
      const planet = this.getPlanetWithId(tx.intent.locationId);
      if (planet) {
        planet.transactions?.addTransaction(tx);
        this.setPlanet(planet);
      }
    } else if (isUnconfirmedTransferTx(tx)) {
      const planet = this.getPlanetWithId(tx.intent.planetId);
      if (planet) {
        planet.transactions?.addTransaction(tx);
        this.setPlanet(planet);
      }
    } else if (isUnconfirmedProspectPlanetTx(tx)) {
      const planet = this.getPlanetWithId(tx.intent.planetId);
      if (planet) {
        planet.transactions?.addTransaction(tx);
        this.setPlanet(planet);
      }
    } else if (isUnconfirmedFindArtifactTx(tx)) {
      const planet = this.getPlanetWithId(tx.intent.planetId);
      if (planet) {
        planet.transactions?.addTransaction(tx);
        this.setPlanet(planet);
      }
    } else if (isUnconfirmedDepositArtifactTx(tx)) {
      const planet = this.getPlanetWithId(tx.intent.locationId);
      const artifact = this.getArtifactById(tx.intent.artifactId);
      if (planet) {
        planet.transactions?.addTransaction(tx);
        this.setPlanet(planet);
      }
      if (artifact) {
        artifact.transactions?.addTransaction(tx);
        this.setArtifact(artifact);
      }
    } else if (isUnconfirmedWithdrawArtifactTx(tx)) {
      const planet = this.getPlanetWithId(tx.intent.locationId);
      const artifact = this.getArtifactById(tx.intent.artifactId);
      if (planet) {
        planet.transactions?.addTransaction(tx);
        this.setPlanet(planet);
      }
      if (artifact) {
        artifact.transactions?.addTransaction(tx);
        this.setArtifact(artifact);
      }
    } else if (isUnconfirmedChargeArtifactTx(tx)) {
      const planet = this.getPlanetWithId(tx.intent.locationId);
      const artifact = this.getArtifactById(tx.intent.artifactId);
      if (planet) {
        planet.transactions?.addTransaction(tx);
        this.setPlanet(planet);
      }
      if (artifact) {
        artifact.transactions?.addTransaction(tx);
        this.setArtifact(artifact);
      }
    } else if (isUnconfirmedShutdownArtifactTx(tx)) {
      const planet = this.getPlanetWithId(tx.intent.locationId);
      const artifact = this.getArtifactById(tx.intent.artifactId);
      if (planet) {
        planet.transactions?.addTransaction(tx);
        this.setPlanet(planet);
      }
      if (artifact) {
        artifact.transactions?.addTransaction(tx);
        this.setArtifact(artifact);
      }
    } else if (isUnconfirmedActivateArtifactTx(tx)) {
      const planet = this.getPlanetWithId(tx.intent.locationId);
      const artifact = this.getArtifactById(tx.intent.artifactId);
      if (planet) {
        planet.transactions?.addTransaction(tx);
        this.setPlanet(planet);
      }
      if (artifact) {
        artifact.transactions?.addTransaction(tx);
        this.setArtifact(artifact);
      }
    } else if (isUnconfirmedDeactivateArtifactTx(tx)) {
      const planet = this.getPlanetWithId(tx.intent.locationId);
      const artifact = this.getArtifactById(tx.intent.artifactId);
      if (planet) {
        planet.transactions?.addTransaction(tx);
        this.setPlanet(planet);
      }
      if (artifact) {
        artifact.transactions?.addTransaction(tx);
        this.setArtifact(artifact);
      }
    } else if (isUnconfirmedChangeArtifactImageTypeTx(tx)) {
      const planet = this.getPlanetWithId(tx.intent.locationId);
      const artifact = this.getArtifactById(tx.intent.artifactId);
      if (planet) {
        planet.transactions?.addTransaction(tx);
        this.setPlanet(planet);
      }
      if (artifact) {
        artifact.transactions?.addTransaction(tx);
        this.setArtifact(artifact);
      }
    } else if (isUnconfirmedBuyArtifactTx(tx)) {
      const planet = this.getPlanetWithId(tx.intent.locationId);
      const artifact = this.getArtifactById(tx.intent.artifactId);
      if (planet) {
        planet.transactions?.addTransaction(tx);
        this.setPlanet(planet);
      }
      if (artifact) {
        artifact.transactions?.addTransaction(tx);
        this.setArtifact(artifact);
      }
    } else if (isUnconfirmedWithdrawSilverTx(tx)) {
      const planet = this.getPlanetWithId(tx.intent.locationId);
      if (planet) {
        planet.transactions?.addTransaction(tx);
        this.setPlanet(planet);
      }
    } else if (isUnconfirmedCapturePlanetTx(tx)) {
      const planet = this.getPlanetWithId(tx.intent.locationId);
      if (planet) {
        planet.transactions?.addTransaction(tx);
        this.setPlanet(planet);
      }
    } else if (isUnconfirmedInvadePlanetTx(tx)) {
      const planet = this.getPlanetWithId(tx.intent.locationId);
      if (planet) {
        planet.transactions?.addTransaction(tx);
        this.setPlanet(planet);
      }
    } else if (isUnconfirmedBurnTx(tx)) {
      const planet = this.getPlanetWithId(tx.intent.locationId);
      if (planet) {
        planet.transactions?.addTransaction(tx);
        this.setPlanet(planet);
      }
    } else if (isUnconfirmedPinkTx(tx)) {
      const planet = this.getPlanetWithId(tx.intent.locationId);
      if (planet) {
        planet.transactions?.addTransaction(tx);
        this.setPlanet(planet);
      }
    } else if (isUnconfirmedKardashevTx(tx)) {
      const planet = this.getPlanetWithId(tx.intent.locationId);
      if (planet) {
        planet.transactions?.addTransaction(tx);
        this.setPlanet(planet);
      }
    } else if (isUnconfirmedBlueTx(tx)) {
      const planet = this.getPlanetWithId(tx.intent.locationId);
      if (planet) {
        planet.transactions?.addTransaction(tx);
        this.setPlanet(planet);
      }
    }
  }

  /**
   * Whenever a transaction that the user initiated either succeeds or fails, we need to clear the
   * fact that it was in progress from the event's corresponding entities. For example, whenever a
   * transaction that sends a voyage from one planet to another either succeeds or fails, we need to
   * remove the dashed line that connected them.
   *
   * Making sure that we never miss something here is very tedious.
   *
   * @todo Make this less tedious.
   */
  public clearUnconfirmedTxIntent(tx: Transaction) {
    this.transactions.removeTransaction(tx);

    if (isUnconfirmedReveal(tx.intent)) {
      const planet = this.getPlanetWithId(tx.intent.locationId);

      if (planet) {
        planet.transactions?.removeTransaction(tx);
        this.setPlanet(planet);
      }
    } else if (isUnconfirmedClaim(tx.intent)) {
      const planet = this.getPlanetWithId(tx.intent.locationId);
      if (planet) {
        planet.transactions?.removeTransaction(tx);
        this.setPlanet(planet);
      }
    } else if (isUnconfirmedMove(tx.intent)) {
      const planet = this.getPlanetWithId(tx.intent.from);
      if (planet) {
        planet.transactions?.removeTransaction(tx);
        this.setPlanet(planet);
      }
      if (tx.intent.artifact) {
        const artifact = this.getArtifactById(tx.intent.artifact);
        if (artifact) {
          artifact.transactions?.removeTransaction(tx);
          this.setArtifact(artifact);
        }
      }
    } else if (isUnconfirmedUpgrade(tx.intent)) {
      const planet = this.getPlanetWithId(tx.intent.locationId);
      if (planet) {
        planet.transactions?.removeTransaction(tx);
        this.setPlanet(planet);
      }
    } else if (isUnconfirmedRefreshPlanet(tx.intent)) {
      const planet = this.getPlanetWithId(tx.intent.locationId);
      if (planet) {
        planet.transactions?.removeTransaction(tx);
        this.setPlanet(planet);
      }
    } else if (isUnconfirmedBuyHat(tx.intent)) {
      const planet = this.getPlanetWithId(tx.intent.locationId);
      if (planet) {
        planet.transactions?.removeTransaction(tx);
        this.setPlanet(planet);
      }
    } else if (isUnconfirmedFindArtifact(tx.intent)) {
      const planet = this.getPlanetWithId(tx.intent.planetId);

      if (planet) {
        planet.transactions?.removeTransaction(tx);
        this.setPlanet(planet);
      }
    } else if (isUnconfirmedDepositArtifact(tx.intent)) {
      const planet = this.getPlanetWithId(tx.intent.locationId);
      const artifact = this.getArtifactById(tx.intent.artifactId);

      if (planet) {
        planet.transactions?.removeTransaction(tx);
        this.setPlanet(planet);
      }
      if (artifact) {
        artifact.transactions?.removeTransaction(tx);
        this.setArtifact(artifact);
      }
    } else if (isUnconfirmedWithdrawArtifact(tx.intent)) {
      const planet = this.getPlanetWithId(tx.intent.locationId);
      const artifact = this.getArtifactById(tx.intent.artifactId);

      if (planet) {
        planet.transactions?.removeTransaction(tx);
        this.setPlanet(planet);
      }
      if (artifact) {
        artifact.transactions?.removeTransaction(tx);
        this.setArtifact(artifact);
      }
    } else if (isUnconfirmedTransfer(tx.intent)) {
      const planet = this.getPlanetWithId(tx.intent.planetId);
      if (planet) {
        planet.transactions?.removeTransaction(tx);
        this.setPlanet(planet);
      }
    } else if (isUnconfirmedProspectPlanet(tx.intent)) {
      const planet = this.getPlanetWithId(tx.intent.planetId);
      if (planet) {
        planet.transactions?.removeTransaction(tx);
        this.setPlanet(planet);
      }
    } else if (isUnconfirmedChargeArtifact(tx.intent)) {
      const planet = this.getPlanetWithId(tx.intent.locationId);
      const artifact = this.getArtifactById(tx.intent.artifactId);
      if (planet) {
        planet.transactions?.removeTransaction(tx);
        this.setPlanet(planet);
      }
      if (artifact) {
        artifact.transactions?.removeTransaction(tx);
        this.setArtifact(artifact);
      }
    } else if (isUnconfirmedShutdownArtifact(tx.intent)) {
      const planet = this.getPlanetWithId(tx.intent.locationId);
      const artifact = this.getArtifactById(tx.intent.artifactId);
      if (planet) {
        planet.transactions?.removeTransaction(tx);
        this.setPlanet(planet);
      }
      if (artifact) {
        artifact.transactions?.removeTransaction(tx);
        this.setArtifact(artifact);
      }
    } else if (isUnconfirmedActivateArtifact(tx.intent)) {
      const planet = this.getPlanetWithId(tx.intent.locationId);
      const artifact = this.getArtifactById(tx.intent.artifactId);
      if (planet) {
        planet.transactions?.removeTransaction(tx);
        this.setPlanet(planet);
      }
      if (artifact) {
        artifact.transactions?.removeTransaction(tx);
        this.setArtifact(artifact);
      }
    } else if (isUnconfirmedDeactivateArtifact(tx.intent)) {
      const planet = this.getPlanetWithId(tx.intent.locationId);
      const artifact = this.getArtifactById(tx.intent.artifactId);
      if (planet) {
        planet.transactions?.removeTransaction(tx);
        this.setPlanet(planet);
      }
      if (artifact) {
        artifact.transactions?.removeTransaction(tx);
        this.setArtifact(artifact);
      }
    } else if (isUnconfirmedChangeArtifactImageType(tx.intent)) {
      const planet = this.getPlanetWithId(tx.intent.locationId);
      const artifact = this.getArtifactById(tx.intent.artifactId);
      if (planet) {
        planet.transactions?.removeTransaction(tx);
        this.setPlanet(planet);
      }
      if (artifact) {
        artifact.transactions?.removeTransaction(tx);
        this.setArtifact(artifact);
      }
    } else if (isUnconfirmedBuyArtifact(tx.intent)) {
      const planet = this.getPlanetWithId(tx.intent.locationId);
      const artifact = this.getArtifactById(tx.intent.artifactId);
      if (planet) {
        planet.transactions?.removeTransaction(tx);
        this.setPlanet(planet);
      }
      if (artifact) {
        artifact.transactions?.removeTransaction(tx);
        this.setArtifact(artifact);
      }
    } else if (isUnconfirmedWithdrawSilver(tx.intent)) {
      const planet = this.getPlanetWithId(tx.intent.locationId);
      if (planet) {
        planet.transactions?.removeTransaction(tx);
        this.setPlanet(planet);
      }
    } else if (isUnconfirmedCapturePlanetTx(tx)) {
      const planet = this.getPlanetWithId(tx.intent.locationId);
      if (planet) {
        planet.transactions?.removeTransaction(tx);
        this.setPlanet(planet);
      }
    } else if (isUnconfirmedInvadePlanetTx(tx)) {
      const planet = this.getPlanetWithId(tx.intent.locationId);
      if (planet) {
        planet.transactions?.removeTransaction(tx);
        this.setPlanet(planet);
      }
    } else if (isUnconfirmedBurn(tx.intent)) {
      const planet = this.getPlanetWithId(tx.intent.locationId);
      if (planet) {
        planet.transactions?.removeTransaction(tx);
        this.setPlanet(planet);
      }
    } else if (isUnconfirmedPink(tx.intent)) {
      const planet = this.getPlanetWithId(tx.intent.locationId);
      if (planet) {
        planet.transactions?.removeTransaction(tx);
        this.setPlanet(planet);
      }
    } else if (isUnconfirmedKardashev(tx.intent)) {
      const planet = this.getPlanetWithId(tx.intent.locationId);
      if (planet) {
        planet.transactions?.removeTransaction(tx);
        this.setPlanet(planet);
      }
    } else if (isUnconfirmedBlue(tx.intent)) {
      const planet = this.getPlanetWithId(tx.intent.locationId);
      if (planet) {
        planet.transactions?.removeTransaction(tx);
        this.setPlanet(planet);
      }
    }
  }

  public getPlanetMap(): Map<LocationId, Planet> {
    return this.planets;
  }

  public getArtifactMap(): Map<ArtifactId, Artifact> {
    return this.artifacts;
  }

  public getMyPlanetMap(): Map<LocationId, Planet> {
    return this.myPlanets;
  }

  public getMyArtifactMap(): Map<ArtifactId, Artifact> {
    return this.myArtifacts;
  }

  public getRevealedLocations(): Map<LocationId, RevealedLocation> {
    return this.revealedLocations;
  }

  // public getClaimedLocations(): Map<LocationId, ClaimedLocation> {
  //   return this.claimedLocations;
  // }

  // public setClaimedLocation(claimedLocation: ClaimedLocation) {
  //   this.claimedLocations.set(claimedLocation.hash, claimedLocation);
  // }

  // public getBurnedLocations(): Map<LocationId, BurnedLocation> {
  //   return this.burnedLocations;
  // }

  // public setBurnedLocation(burnedLocation: BurnedLocation) {
  //   this.burnedLocations.set(burnedLocation.hash, burnedLocation);
  // }

  public getPinkZones(): Map<ArtifactId, PinkZone> {
    return this.pinkZones;
  }

  public setPinkZone(pinkZone: PinkZone) {
    this.pinkZones.set(pinkZone.artifactId, pinkZone);
  }

  public getAIZones(): Set<AIZone> {
    return this.aiZones;
  }

  public setAIZone(aizones: Set<AIZone>) {
    this.aiZones = aizones;
  }

  // public getKardashevLocations(): Map<LocationId, KardashevLocation> {
  //   return this.kardashevLocations;
  // }
  // public setKardashevLocation(kardashevLocation: KardashevLocation) {
  //   this.kardashevLocations.set(kardashevLocation.hash, kardashevLocation);
  // }

  /**
   * Gets all the planets with the given ids, giltering out the ones that we don't have.
   */
  public getPlanetsWithIds(
    locationIds: LocationId[],
    updateIfStale = true,
  ): Planet[] {
    return locationIds
      .map((id) => this.getPlanetWithId(id, updateIfStale))
      .filter((p) => p !== undefined) as Planet[];
  }

  /**
   * Gets all the planets that are within {@code radius} world units from the given coordinate. Fast
   * because it uses {@link LayeredMap}.
   */
  public getPlanetsInWorldCircle(
    coords: WorldCoords,
    radius: number,
  ): LocatablePlanet[] {
    const locationIds = this.layeredMap.getPlanetsInCircle(coords, radius);
    return this.getPlanetsWithIds(locationIds) as LocatablePlanet[];
  }

  /**
   * Gets the ids of all the planets that are both within the given bounding box (defined by its
   * bottom left coordinate, width, and height) in the world and of a level that was passed in via
   * the `planetLevels` parameter. Fast because it uses {@link LayeredMap}.
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
    const locationIds = this.layeredMap.getPlanets(
      worldX,
      worldY,
      worldWidth,
      worldHeight,
      levels,
      planetLevelToRadii,
    );
    return this.getPlanetsWithIds(
      locationIds,
      updateIfStale,
    ) as LocatablePlanet[];
  }

  public forceTick(locationId: LocationId) {
    const planet = this.getPlanetWithId(locationId);
    if (planet) {
      this.setPlanet(planet);
    }
  }

  /**
   * Set a planet into our cached store. Should ALWAYS call this when setting a planet.
   * `this.planets` and `this.myPlanets` should NEVER be accessed directly!
   * This function also handles managing planet update messages and indexing the map of owned planets.
   * @param planet the planet to set
   */
  private setPlanet(planet: Planet) {
    if (isLocatable(planet)) {
      this.layeredMap.insertPlanet(planet.location, planet.planetLevel);
    }

    setObjectSyncState<Planet, LocationId>(
      this.planets,
      this.myPlanets,
      this.address,
      this.planetUpdated$,
      this.myPlanetsUpdated$,
      getPlanetId,
      getPlanetOwner,
      planet,
    );
  }

  /**
   * Set an artifact into our cached store. Should ALWAYS call this when setting an artifact.
   * `this.artifacts` and `this.myArtifacts` should NEVER be accessed directly!
   * This function also handles managing artifact update messages and indexing the map of owned artifacts.
   * @param artifact the artifact to set
   */
  private setArtifact(artifact: Artifact) {
    if (
      artifact.artifactType === ArtifactType.Wormhole &&
      artifact.onPlanetId
    ) {
      if (artifact.status === ArtifactStatus.Active) {
        const { WormholeDest } = this.components;
        const artifactEntity = encodeEntity(
          { wormholeId: "uint32" },
          {
            wormholeId: Number(artifactIdToDecStr(artifact.id)),
          },
        );
        const wormholeDest = getComponentValue(WormholeDest, artifactEntity);
        if (wormholeDest) {
          this.links.set(artifact.id, {
            from: artifact.onPlanetId,
            to: locationIdFromHexStr(wormholeDest.to.toString()),
            artifactId: artifact.id,
          });
        }
      } else {
        this.links.delete(artifact.id);
      }
    }

    if (artifact.artifactType === ArtifactType.IceLink && artifact.onPlanetId) {
      if (artifact.linkTo && isActivated(artifact)) {
        this.links.set(artifact.id, {
          from: artifact.onPlanetId,
          to: artifact.linkTo,
          artifactId: artifact.id,
        });
      } else {
        this.links.delete(artifact.id);
      }
    }

    if (
      artifact.artifactType === ArtifactType.FireLink &&
      artifact.onPlanetId
    ) {
      if (artifact.linkTo && isActivated(artifact)) {
        this.links.set(artifact.id, {
          from: artifact.onPlanetId,
          to: artifact.linkTo,
          artifactId: artifact.id,
        });
      } else {
        this.links.delete(artifact.id);
      }
    }

    if (artifact.artifactType === ArtifactType.Bomb && artifact.onPlanetId) {
      if (isActivated(artifact)) {
        const { PinkBomb } = this.components;
        const artifactEntity = encodeEntity(PinkBomb.metadata.keySchema, {
          bombId: Number(artifactIdToDecStr(artifact.id)),
        });
        const bomb = getComponentValue(PinkBomb, artifactEntity);
        if (!bomb) {
          throw new Error("bomb launch data not found");
        }
        const targetLocation = this.getLocationOfPlanet(
          locationIdFromHexStr(bomb.target.toString()),
        );
        if (targetLocation) {
          this.setPinkZone({
            locationId: targetLocation.hash,
            coords: targetLocation.coords,
            operator: artifact.currentOwner,
            radius: Number(artifact.rarity) * 500,
            artifactId: artifact.id,
            launchTick: Number(bomb.departureTick),
            arrivalTick: Number(bomb.arrivalTick),
            launchPlanet: artifact.onPlanetId,
          });
        }
      } else {
        this.pinkZones.delete(artifact.id);
      }
    }

    setObjectSyncState<Artifact, ArtifactId>(
      this.artifacts,
      this.myArtifacts,
      this.address,
      this.artifactUpdated$,
      this.myArtifactsUpdated$,
      getArtifactId,
      getArtifactOwner,
      artifact,
    );
  }
  /**
   * Emit notifications based on a planet's state change
   */
  private emitArrivalNotifications({ previous, current, arrival }: PlanetDiff) {
    const notifManager = NotificationManager.getInstance();
    if (
      !GameObjects.planetCanUpgrade(previous) &&
      GameObjects.planetCanUpgrade(current) &&
      current.owner === this.address
    ) {
      notifManager.planetCanUpgrade(current);
    }
    if (
      previous.owner !== this.address &&
      previous.owner !== ethers.constants.AddressZero &&
      current.owner === this.address
    ) {
      notifManager.planetConquered(current as LocatablePlanet);
    }
    if (previous.owner === this.address && current.owner !== this.address) {
      notifManager.planetLost(current as LocatablePlanet);
    }

    const inSameGuild =
      this.guildUtils.inSameGuildAtTick(
        arrival.player,
        this.address,
        arrival.arrivalTick,
      ) && arrival.player !== this.address;

    if (
      inSameGuild === false &&
      arrival.player !== this.address &&
      current.owner === this.address &&
      arrival.energyArriving !== 0
    ) {
      notifManager.planetAttacked(current as LocatablePlanet);
    }

    if (
      inSameGuild &&
      arrival.player !== this.address &&
      current.owner === this.address &&
      arrival.energyArriving !== 0
    ) {
      notifManager.planetSupportedByGuild(current as LocatablePlanet);
    }
  }

  private removeArrival(planetId: LocationId, arrivalId: VoyageId) {
    this.arrivals.delete(arrivalId);
    const planetArrivalIds = this.planetArrivalIds.get(planetId) ?? [];
    if (planetArrivalIds.length === 0) {
      // NOTE: perhaps we should delete the reference here or set to undefined use WeakMap to automatically GC
      //       since this will just acumulate pointers to empty arrays in memory the longer the gameplay is
      // this.planetArrivalIds?.delete(planetId);
      // this.planetArrivalIds?.set(planetId, undefined);
      return;
    }

    this.planetArrivalIds.set(
      planetId,
      // filter out planet arrival by id, and keep rest
      planetArrivalIds.filter((id) => id !== arrivalId),
    );
  }

  public updateArrival(planetId: LocationId, arrival: QueuedArrival): void {
    const planet = this.planets.get(planetId);
    if (!planet) {
      console.error(
        `attempted to process arrivals for planet not in memory: ${planetId}`,
      );
      return;
    }
    const update = arrive(
      planet,
      this.getPlanetArtifacts(planet.locationId),
      arrival,
      this.getArtifactById(arrival.artifactId),
      this.contractConstants,
      this.guildUtils,
    );

    this.removeArrival(planetId, update.arrival.eventId);
    this.emitArrivalNotifications(update);
  }

  private processArrivalsForPlanet(
    planetId: LocationId,
    arrivals: QueuedArrival[],
  ): ArrivalWithTimer[] {
    const planet = this.planets.get(planetId);

    if (!planet) {
      console.error(
        `attempted to process arrivals for planet not in memory: ${planetId}`,
      );
      return [];
    }
    // process the QueuedArrival[] for a single planet
    const arrivalsWithTimers: ArrivalWithTimer[] = [];

    // sort arrivals by timestamp
    arrivals.sort((a, b) => a.arrivalTick - b.arrivalTick);

    const nowTick = this.tickerUtils.getCurrentTick();

    for (const arrival of arrivals) {
      try {
        if (nowTick - arrival.arrivalTick > 0) {
          // if arrival happened in the past, run this arrival
          const update = arrive(
            planet,
            this.getPlanetArtifacts(planet.locationId),
            arrival,
            this.getArtifactById(arrival.artifactId),
            this.contractConstants,
            this.guildUtils,
          );

          this.removeArrival(planetId, update.arrival.eventId);

          this.emitArrivalNotifications(update);
        } else {
          // otherwise, set a timer to do this arrival in the future
          // and append it to arrivalsWithTimers

          // PUNK
          // const applyFutureArrival = setTimeout(
          //   () => {
          //     const update = arrive(
          //       planet,
          //       this.getPlanetArtifacts(planet.locationId),
          //       arrival,
          //       this.getArtifactById(arrival.artifactId),
          //       this.contractConstants,
          //     );

          //     this.removeArrival(planetId, update.arrival.eventId);
          //     this.emitArrivalNotifications(update);
          //   },
          //   this.tickerUtils.convertTickToMs(arrival.arrivalTick) - Date.now(),
          // );

          const arrivalWithTimer = {
            arrivalData: arrival,
            // timer: applyFutureArrival,
          };

          arrivalsWithTimers.push(arrivalWithTimer);
        }
      } catch (e) {
        console.error(
          `error occurred processing arrival for updated planet ${planetId}: ${e}`,
        );
      }
    }

    this.updateScore(planetId);
    return arrivalsWithTimers;
  }

  private clearOldArrivals(planet: Planet): void {
    const planetId = planet.locationId;
    // clear old timeouts
    const arrivalIds = this.planetArrivalIds.get(planetId);
    if (arrivalIds) {
      // clear if the planet already had stored arrivals
      for (const arrivalId of arrivalIds) {
        const arrivalWithTimer = this.arrivals.get(arrivalId);
        if (!arrivalWithTimer) {
          console.error(`arrival with id ${arrivalId} wasn't found`);
        }
        this.arrivals.delete(arrivalId);
      }
    }
    this.planetArrivalIds.set(planetId, []);
  }

  public planetLevelFromHexPerlin(
    hex: LocationId,
    perlin: number,
    distFromOrigin: number,
  ): PlanetLevel {
    const spaceType = this.spaceTypeFromPerlin(perlin, distFromOrigin);

    const distSquare = distFromOrigin ** 2;

    const universeZone = this.planetUtils._initZone(distSquare);

    return this.planetUtils._initLevel(hex, spaceType, universeZone);
  }

  public spaceTypeFromPerlin(
    perlin: number,
    distFromOrigin: number,
  ): SpaceType {
    const distSquare = distFromOrigin ** 2;
    const universeZone = this.planetUtils._initZone(distSquare);

    const spaceType = this.planetUtils._initSpaceType(universeZone, perlin);
    return spaceType;
  }

  public static getSilverNeeded(planet: Planet): number {
    const totalLevel = planet.upgradeState.reduce((a, b) => a + b);
    return (totalLevel + 1) * 0.2 * planet.silverCap;
  }

  public static planetCanUpgrade(planet: Planet): boolean {
    const totalRank = planet.upgradeState.reduce((a, b) => a + b);
    if (planet.spaceType === SpaceType.NEBULA && totalRank >= 3) {
      return false;
    }
    if (planet.spaceType === SpaceType.SPACE && totalRank >= 4) {
      return false;
    }
    if (planet.spaceType === SpaceType.DEEP_SPACE && totalRank >= 5) {
      return false;
    }
    if (planet.spaceType === SpaceType.DEAD_SPACE && totalRank >= 5) {
      return false;
    }
    return (
      planet.planetLevel !== 0 &&
      planet.planetType === PlanetType.PLANET &&
      planet.silver >= this.getSilverNeeded(planet)
    );
  }

  public planetTypeFromHexPerlin(
    hex: LocationId,
    perlin: number,
    distFromOrigin: number,
  ): PlanetType {
    // level must be sufficient - too low level planets have 0 silver growth

    //###############
    //  NEW MAP ALGO
    //###############
    const planetLevel = this.planetLevelFromHexPerlin(
      hex,
      perlin,
      distFromOrigin,
    );
    const spaceType = this.spaceTypeFromPerlin(perlin, distFromOrigin);

    const planetType = this.planetUtils._initPlanetType(
      hex,
      spaceType,
      planetLevel,
    );
    return planetType;
  }

  private getBiome(loc: WorldLocation): Biome {
    return this.planetUtils.getBiome(loc);
  }

  /**
   * returns the data for an unowned, untouched planet at location
   * most planets in the game are untouched and not stored in the contract,
   * so we need to generate their data optimistically in the client
   */
  private defaultPlanetFromLocation(location: WorldLocation): LocatablePlanet {
    return this.planetUtils.defaultPlanetFromLocation(location);
  }

  private updatePlanetIfStale(planet: Planet): void {
    const curTick = this.tickerUtils.getCurrentTick();
    if (curTick - planet.lastUpdated > 1) {
      updatePlanetToTick(
        planet,
        this.getPlanetArtifacts(planet.locationId),
        curTick,
        this.contractConstants,
        this.setPlanet,
      );
    }
  }

  /**
   * returns timestamp (seconds) that planet will reach percent% of populationCap
   * time may be in the past
   */
  public getEnergyCurveAtPercent(planet: Planet, percent: number): number {
    const p1 = (percent / 100) * planet.populationCap;
    const c = planet.populationCap;
    const p0 = planet.population;
    const g = planet.populationGrowth;
    const t0 = planet.lastUpdated;

    const t1 = (c / (4 * g)) * Math.log((p1 * (c - p0)) / (p0 * (c - p1))) + t0;

    return t1;
  }

  /**
   * returns timestamp (seconds) that planet will reach percent% of silcap if
   * doesn't produce silver, returns undefined if already over percent% of silcap,
   * returns undefined
   */
  public getSilverCurveAtPercent(
    planet: Planet,
    percent: number,
  ): number | undefined {
    if (planet.silverGrowth <= 0) {
      return undefined;
    }
    const silverTarget = (percent / 100) * planet.silverCap;
    const silverDiff = silverTarget - planet.silver;
    if (silverDiff <= 0) {
      return undefined;
    }
    let timeToTarget = 0;
    timeToTarget += silverDiff / planet.silverGrowth;
    return planet.lastUpdated + timeToTarget;
  }

  /**
   * Returns the EthAddress of the player who can control the owner:
   * if the artifact is on a planet, this is the owner of the planet
   * if the artifact is on a voyage, this is the initiator of the voyage
   * if the artifact is not on either, then it is the owner of the artifact NFT
   */
  public getArtifactController(artifactId: ArtifactId): EthAddress | undefined {
    const artifact = this.getArtifactById(artifactId);
    if (!artifact) {
      return undefined;
    }

    if (artifact.onPlanetId) {
      const planet = this.getPlanetWithId(artifact.onPlanetId);
      if (!planet) {
        return undefined;
      }
      return planet.owner === EMPTY_ADDRESS ? undefined : planet.owner;
    } else if (artifact.onVoyageId) {
      const arrival = this.arrivals.get(artifact.onVoyageId);
      return arrival?.arrivalData.player || undefined;
    } else {
      return artifact.currentOwner === EMPTY_ADDRESS
        ? undefined
        : artifact.currentOwner;
    }
  }

  /**
   * Get all of the incoming voyages for a given location.
   */
  public getArrivalIdsForLocation(
    location: LocationId | undefined,
  ): VoyageId[] | undefined {
    if (!location) {
      return [];
    }

    return this.planetArrivalIds.get(location);
  }

  /**
   * Whether or not we're already asking the game to give us spaceships.
   */
  public isGettingSpaceships(): boolean {
    return this.transactions.hasTransaction(isUnconfirmedGetShipsTx);
  }

  private calculateSilverSpent(planet: Planet): number {
    const upgradeCosts = [20, 40, 60, 80, 100];
    let totalUpgrades = 0;
    for (let i = 0; i < planet.upgradeState.length; i++) {
      totalUpgrades += planet.upgradeState[i];
    }
    let totalUpgradeCostPercent = 0;
    for (let i = 0; i < totalUpgrades; i++) {
      totalUpgradeCostPercent += upgradeCosts[i];
    }
    return (totalUpgradeCostPercent / 100) * planet.silverCap;
  }

  private updateScore(planetId: LocationId) {
    const planet = this.planets.get(planetId);
    if (!planet) {
      return;
    }
    planet.silverSpent = this.calculateSilverSpent(planet);
  }

  /**
   * Called when we want to remove a planet's location from memory, when clearing chunks or map data.
   * Removes a WorldLocation from the planetLocationMap, making it unknown to the player locally.
   * IMPORTANT: This is the only way a LocatablePlanet gets removed
   * IMPORTANT: Idempotent
   */
  public deletePlanetLocation(planetLocation: WorldLocation): void {
    const planet = this.planets.get(planetLocation.hash);

    // Skip if planet's coords are revealed on-chain
    if (planet?.coordsRevealed) {
      return;
    }

    //###############
    //  MAP ALGO
    //###############
    const planetX = planetLocation.coords.x;
    const planetY = planetLocation.coords.y;
    const distFromOrigin = Math.sqrt(planetX ** 2 + planetY ** 2);

    this.layeredMap.removePlanet(
      planetLocation,
      this.getPlanetWithId(planetLocation.hash, false)?.planetLevel ??
        this.planetLevelFromHexPerlin(
          planetLocation.hash,
          planetLocation.perlin,
          distFromOrigin,
        ),
    );

    // Remove from location maps
    this.planetLocationMap.delete(planetLocation.hash);
    const str = getCoordsString(planetLocation.coords);
    this.coordsToLocation.delete(str);

    // Update planet data
    if (planet) {
      const planetId = planetLocation.hash;
      // 1. Clear all arrivals related to this planet
      const arrivalIds = this.planetArrivalIds.get(planetId);
      if (arrivalIds) {
        for (const arrivalId of arrivalIds) {
          this.arrivals.delete(arrivalId);
        }
        this.planetArrivalIds.delete(planetId);
      }
      // 2. Clear all artifacts on this planet
      const artifacts = this.getPlanetArtifacts(planetId);
      for (const artifact of artifacts) {
        if (artifact.onPlanetId === planetId) {
          this.artifacts.delete(artifact.id);
          this.artifactUpdated$.publish(artifact.id);
        }
      }
      // 3. Remove from myPlanets if owned
      if (this.myPlanets.has(planetId)) {
        this.myPlanets.delete(planetId);
        this.myPlanetsUpdated$.publish(this.myPlanets);
      }

      // 4. Remove from planets map
      this.planets.delete(planetId);
      // 5. Notify subscribers
      this.planetUpdated$.publish(planetId);
    }
  }
}
