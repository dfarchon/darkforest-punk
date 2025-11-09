import {
  getRange,
  isActivated,
  isLocatable,
  isSpaceShip,
  timeUntilNextBroadcastAvailable,
} from "@df/gamelogic";
import type { EthConnection } from "@df/network";
import {
  createContract,
  ThrottledConcurrentQueue,
  verifySignature,
  weiToEth,
} from "@df/network";
import {
  address,
  addressToHex,
  artifactIdToDecStr,
  isUnconfirmedAcceptInvitationTx,
  isUnconfirmedActivateArtifactTx,
  isUnconfirmedApplyToGuildTx,
  isUnconfirmedApproveApplicationTx,
  isUnconfirmedBlueTx,
  isUnconfirmedBurnTx,
  isUnconfirmedBuyArtifactTx,
  isUnconfirmedBuyHatTx,
  isUnconfirmedBuyPlanetTx,
  isUnconfirmedBuySpaceshipTx,
  isUnconfirmedCapturePlanetTx,
  isUnconfirmedCraftSpaceshipTx,
  isUnconfirmedChangeArtifactImageTypeTx,
  isUnconfirmedChargeArtifactTx,
  isUnconfirmedClaimTx,
  isUnconfirmedCreateGuildTx,
  isUnconfirmedDeactivateArtifactTx,
  isUnconfirmedDepositArtifactTx,
  isUnconfirmedDisbandGuildTx,
  isUnconfirmedDonateTx,
  isUnconfirmedFindArtifactTx,
  isUnconfirmedInitTx,
  isUnconfirmedInstallModuleTx,
  isUnconfirmedInvadePlanetTx,
  isUnconfirmedInviteToGuildTx,
  isUnconfirmedKardashevTx,
  isUnconfirmedKickMemberTx,
  isUnconfirmedLeaveGuildTx,
  isUnconfirmedMoveTx,
  isUnconfirmedPinkTx,
  isUnconfirmedUninstallModuleTx,
  isUnconfirmedProspectPlanetTx,
  isUnconfirmedRefreshPlanetTx,
  isUnconfirmedRevealTx,
  isUnconfirmedSetGrantTx,
  isUnconfirmedSetMemberRoleTx,
  isUnconfirmedSetPlanetEmojiTx,
  isUnconfirmedShutdownArtifactTx,
  isUnconfirmedTransferGuildLeadershipTx,
  isUnconfirmedUpgradeTx,
  isUnconfirmedWithdrawArtifactTx,
  isUnconfirmedWithdrawSilverTx,
  locationIdFromBigInt,
  locationIdToDecStr,
} from "@df/serde";
import type { EthAddress, GuildId, VoyageId } from "@df/types";
import type {
  Artifact,
  ArtifactId,
  LocationId,
  Transaction,
  WorldLocation,
} from "@df/types";
import {
  ArtifactRarity,
  ArtifactType,
  HatType,
  PlanetMessageType,
  PlanetType,
  Setting,
  SpaceType,
} from "@df/types";
import type { ClientComponents } from "@mud/createClientComponents";
import delay from "delay";
import { getComponentValue } from "@latticexyz/recs";
import {
  decodeEntity,
  encodeEntity,
  singletonEntity,
} from "@latticexyz/store-sync/recs";

import { ContractsAPIEvent } from "../../_types/darkforest/api/ContractsAPITypes";
import type { HashConfig } from "../../_types/global/GlobalTypes";
import NotificationManager from "../../Frontend/Game/NotificationManager";
import { pollSetting } from "../../Frontend/Utils/SettingsHooks";
import type { TerminalHandle } from "../../Frontend/Views/Terminal";
import PersistentChunkStore from "../Storage/PersistentChunkStore";
import SnarkArgsHelper from "../Utils/SnarkArgsHelper";
import { makeContractsAPI } from "./ContractsAPI";
import { GameManager } from "./GameManager";
import { InitialGameStateDownloader } from "./InitialGameStateDownloader";

export enum GameManagerEvent {
  PlanetUpdate = "PlanetUpdate",
  DiscoveredNewChunk = "DiscoveredNewChunk",
  InitializedPlayer = "InitializedPlayer",
  InitializedPlayerError = "InitializedPlayerError",
  ArtifactUpdate = "ArtifactUpdate",
  Moved = "Moved",
}

export class GameManagerFactory {
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
    if (!terminal.current) {
      throw new Error("you must pass in a handle to a terminal");
    }

    const account = spectate
      ? <EthAddress>"0x0000000000000000000000000000000000000001"
      : mainAccount; // connection.getAddress();

    if (!account) {
      throw new Error("no account on eth connection");
    }

    const gameStateDownloader = new InitialGameStateDownloader(
      terminal.current,
    );
    const contractsAPI = await makeContractsAPI({
      connection,
      contractAddress,
      components,
    });

    terminal.current?.println("Loading game data from disk...");

    const persistentChunkStore = await PersistentChunkStore.create({
      account,
      contractAddress,
    });

    terminal.current?.println("Downloading data from Ethereum blockchain...");
    terminal.current?.println(
      "(the contract is very big. this may take a while)",
    );
    terminal.current?.newline();

    const initialState = await gameStateDownloader.download(
      contractsAPI,
      persistentChunkStore,
    );

    const possibleHomes = await persistentChunkStore.getHomeLocations();

    terminal.current?.println("");
    terminal.current?.println("Building Index...");

    await persistentChunkStore.saveTouchedPlanetIds(
      initialState.allTouchedPlanetIds,
    );
    await persistentChunkStore.saveRevealedCoords(
      initialState.allRevealedCoords,
    );
    // await persistentChunkStore.saveClaimedCoords(initialState.allClaimedCoords);

    const knownArtifacts = initialState.artifacts;
    const artifactsInWallet = await contractsAPI.getArtifactsInWallet(account);
    for (const artifact of artifactsInWallet.values()) {
      knownArtifacts.set(artifact.id, artifact);
    }

    for (let i = 0; i < initialState.loadedPlanets.length; i++) {
      const planet = initialState.touchedAndLocatedPlanets.get(
        initialState.loadedPlanets[i],
      );

      if (!planet) {
        continue;
      }

      // planet.heldArtifactIds = initialState.heldArtifacts[i].map((a) => a.id);

      // for (const heldArtifact of initialState.heldArtifacts[i]) {
      //   knownArtifacts.set(heldArtifact.id, heldArtifact);
      // }
    }

    // for (const myArtifact of initialState.myArtifacts) {
    //   knownArtifacts.set(myArtifact.id, myArtifact);
    // }

    // for (const artifact of initialState.artifactsOnVoyages) {
    //   knownArtifacts.set(artifact.id, artifact);
    // }

    // figure out what's my home planet
    let homeLocation: WorldLocation | undefined = undefined;
    for (const loc of possibleHomes) {
      if (initialState.allTouchedPlanetIds.includes(loc.hash)) {
        homeLocation = loc;
        await persistentChunkStore.confirmHomeLocation(loc);
        break;
      }
    }

    const hashConfig: HashConfig = {
      planetHashKey: initialState.contractConstants.PLANETHASH_KEY,
      spaceTypeKey: initialState.contractConstants.SPACETYPE_KEY,
      biomebaseKey: initialState.contractConstants.BIOMEBASE_KEY,
      perlinLengthScale: initialState.contractConstants.PERLIN_LENGTH_SCALE,
      perlinMirrorX: initialState.contractConstants.PERLIN_MIRROR_X,
      perlinMirrorY: initialState.contractConstants.PERLIN_MIRROR_Y,
      planetRarity: initialState.contractConstants.PLANET_RARITY,
    };

    const useMockHash = initialState.contractConstants.DISABLE_ZK_CHECKS;
    const snarkHelper = SnarkArgsHelper.create(
      hashConfig,
      terminal,
      useMockHash,
    );

    const gameManager = new GameManager(
      terminal,
      mainAccount,
      initialState.players,
      initialState.touchedAndLocatedPlanets,
      new Set(Array.from(initialState.allTouchedPlanetIds)),
      initialState.revealedCoordsMap,
      // initialState.claimedCoordsMap
      //   ? initialState.claimedCoordsMap
      //   : new Map<LocationId, ClaimedCoords>(),
      // initialState.burnedCoordsMap
      //   ? initialState.burnedCoordsMap
      //   : new Map<LocationId, BurnedCoords>(),
      // initialState.kardashevCoordsMap
      //   ? initialState.kardashevCoordsMap
      //   : new Map<LocationId, KardashevCoords>(),
      initialState.worldRadius,
      initialState.arrivals,
      initialState.planetVoyageIdMap,
      contractsAPI,
      initialState.contractConstants,
      persistentChunkStore,
      snarkHelper,
      homeLocation,
      useMockHash,
      knownArtifacts,
      connection,
      initialState.paused,
      // initialState.halfPrice,
      components,
    );

    // gameManager.setPlayerTwitters(initialState.twitters);

    const config = {
      contractAddress,
      account: gameManager.getEthConnection().getAddress(),
    };
    pollSetting(config, Setting.AutoApproveNonPurchaseTransactions);

    persistentChunkStore.setDiagnosticUpdater(gameManager);
    contractsAPI.setDiagnosticUpdater(gameManager);

    // important that this happens AFTER we load the game state from the blockchain. Otherwise our
    // 'loading game state' contract calls will be competing with events from the blockchain that
    // are happening now, which makes no sense.

    contractsAPI.setupEventListeners();

    // get twitter handles
    // gameManager.refreshTwitters();

    // gameManager.listenForNewBlock();

    // set up listeners: whenever ContractsAPI reports some game state update, do some logic
    gameManager.contractsAPI
      .on(ContractsAPIEvent.TickRateUpdate, async (newtickRate: number) => {
        const contractConstants = contractsAPI.getConstants();
        gameManager.updateContractConstants(contractConstants);
      })
      .on(ContractsAPIEvent.ArtifactUpdate, async (artifactId: ArtifactId) => {
        await gameManager.hardRefreshArtifact(artifactId);
        gameManager.emit(GameManagerEvent.ArtifactUpdate, artifactId);
      })
      .on(
        ContractsAPIEvent.PlanetTransferred,
        async (planetId: LocationId, newOwner: EthAddress) => {
          await gameManager.hardRefreshPlanet(planetId);
          const planetAfter = gameManager.getPlanetWithId(planetId);

          if (planetAfter && newOwner === gameManager.getAccount()) {
            NotificationManager.getInstance().receivedPlanet(planetAfter);
          }
        },
      )
      .on(ContractsAPIEvent.PlayerUpdate, async (playerId: EthAddress) => {
        await gameManager.hardRefreshPlayer(playerId);
      })
      .on(ContractsAPIEvent.PauseStateChanged, async (paused: boolean) => {
        gameManager.setPaused(paused);
      })
      // .on(ContractsAPIEvent.HalfPriceChanged, async (halfPrice: boolean) => {
      //   gameManager.halfPrice = halfPrice;
      //   gameManager.halfPrice$.publish(halfPrice);
      // })
      .on(ContractsAPIEvent.PlanetUpdate, async (planetId: LocationId) => {
        // PUNK
        // console.log("handle ContractsAPI.PlanetUpdate");
        // console.log(planetId);

        // don't reload planets that you don't have in your map. once a planet
        // is in your map it will be loaded from the contract.
        const localPlanet = gameManager.entityStore.getPlanetWithId(planetId);
        if (localPlanet && isLocatable(localPlanet)) {
          gameManager.hardRefreshPlanet(planetId);
          gameManager.emit(GameManagerEvent.PlanetUpdate);
        }
        await gameManager.refreshServerPlanetStates([planetId]);
      })
      .on(
        ContractsAPIEvent.ArrivalQueued,
        async (_arrivalId: VoyageId, fromId: LocationId, toId: LocationId) => {
          // PUNK
          // console.log("handle ContractsAPIEvent.ArrivalQueued");
          // console.log("arrivalId", _arrivalId);
          // console.log("fromId", fromId);
          // console.log("toId", toId);

          // only reload planets if the toPlanet is in the map
          const localToPlanet = gameManager.entityStore.getPlanetWithId(toId);
          if (localToPlanet && isLocatable(localToPlanet)) {
            gameManager.bulkHardRefreshPlanets([fromId, toId]);
            gameManager.emit(GameManagerEvent.PlanetUpdate);
          }
        },
      )
      .on(
        ContractsAPIEvent.LocationRevealed,
        async (planetId: LocationId, _revealer: EthAddress) => {
          // TODO: hook notifs or emit event to UI if you want
          await gameManager.hardRefreshPlanet(planetId);
          gameManager.emit(GameManagerEvent.PlanetUpdate);
        },
      )
      .on(
        ContractsAPIEvent.LocationClaimed,
        async (planetId: LocationId, _revealer: EthAddress) => {
          // TODO: hook notifs or emit event to UI if you want

          // console.log('[testInfo]: ContractsAPIEvent.LocationClaimed');
          await gameManager.hardRefreshPlanet(planetId);
          gameManager.emit(GameManagerEvent.PlanetUpdate);
        },
      )
      .on(ContractsAPIEvent.GuildUpdate, async (guildId: GuildId) => {
        await gameManager.hardRefreshGuild(guildId);
      })
      .on(ContractsAPIEvent.TxQueued, (tx: Transaction) => {
        gameManager.entityStore.onTxIntent(tx);
      })
      .on(ContractsAPIEvent.TxSubmitted, (tx: Transaction) => {
        gameManager.persistentChunkStore.onEthTxSubmit(tx);
        gameManager.onTxSubmit(tx);
      })
      // Warning:
      // Since we treat local mud table values as contract values and we rely on updates of
      // tables to do core update logics, we should not listen on tx confirmations any more.
      // Because there is a small delay between the tx confirmation and table updates from indexer.
      // This delay causes some update triggered by tx confirmations use outdated table values.
      // Of course, as long as we do update again when we receive table updates, there would
      // be no big problem.
      .on(ContractsAPIEvent.TxConfirmed, async (tx: Transaction) => {
        if (!tx.hash) {
          return;
        } // this should never happen
        gameManager.persistentChunkStore.onEthTxComplete(tx.hash);

        if (isUnconfirmedRevealTx(tx)) {
          await gameManager.hardRefreshPlanet(tx.intent.locationId);
        } else if (isUnconfirmedBurnTx(tx)) {
          await gameManager.hardRefreshPlanet(tx.intent.locationId);
          // await gameManager.hardRefreshPinkZones();
        } else if (isUnconfirmedPinkTx(tx)) {
          await gameManager.hardRefreshPlanet(tx.intent.locationId);
        }
        //  else if (isUnconfirmedKardashevTx(tx)) {
        //   await gameManager.hardRefreshPlanet(tx.intent.locationId);
        //   // await gameManager.hardRefreshBlueZones();
        // } else if (isUnconfirmedBlueTx(tx)) {
        //   const centerPlanetId = gameManager.getBlueZoneCenterPlanetId(
        //     tx.intent.locationId,
        //   );
        //   if (centerPlanetId) {
        //     await gameManager.bulkHardRefreshPlanets([
        //       tx.intent.locationId,
        //       centerPlanetId,
        //     ]);
        //   } else {
        //     // notice: this should never happen
        //     await gameManager.bulkHardRefreshPlanets([tx.intent.locationId]);
        //   }

        //   gameManager.emit(GameManagerEvent.PlanetUpdate);
        // }
        else if (isUnconfirmedInitTx(tx)) {
          terminal.current?.println("Loading Home Planet from Blockchain...");
          const retries = 5;
          for (let i = 0; i < retries; i++) {
            const planet = gameManager.contractsAPI.getPlanetById(
              tx.intent.locationId,
            );
            if (planet) {
              break;
            } else if (i === retries - 1) {
              console.error("couldn't load player's home planet");
            } else {
              await delay(2000);
            }
          }
          gameManager.hardRefreshPlanet(tx.intent.locationId);
          // mining manager should be initialized already via joinGame, but just in case...
          gameManager.initMiningManager(tx.intent.location.coords, 4);
        } else if (isUnconfirmedMoveTx(tx)) {
          const promises = [
            gameManager.bulkHardRefreshPlanets([tx.intent.from, tx.intent.to]),
          ];
          if (tx.intent.artifact) {
            // promises.push(gameManager.hardRefreshArtifact(tx.intent.artifact));
          }
          await Promise.all(promises);
        } else if (isUnconfirmedUpgradeTx(tx)) {
          await gameManager.hardRefreshPlanet(tx.intent.locationId);
        } else if (isUnconfirmedRefreshPlanetTx(tx)) {
          await gameManager.hardRefreshPlanet(tx.intent.locationId);
        } else if (isUnconfirmedBuyHatTx(tx)) {
          await gameManager.hardRefreshPlanet(tx.intent.locationId);
        } else if (isUnconfirmedBuyPlanetTx(tx)) {
          //todo
          await gameManager.hardRefreshPlanet(tx.intent.locationId);
        } else if (isUnconfirmedBuySpaceshipTx(tx)) {
          await gameManager.hardRefreshPlanet(tx.intent.locationId);
        } else if (isUnconfirmedCraftSpaceshipTx(tx)) {
          // Wait a bit for MUD components to sync after transaction confirmation
          // Materials are stored in MUD tables (PlanetMaterial), so we need to wait
          // for the store sync to complete before refreshing
          await delay(500);
          await gameManager.hardRefreshPlanet(tx.intent.foundryHash);
          // Force an update to ensure materials are refreshed in UI
          gameManager.getGameObjects().forceTick(tx.intent.foundryHash);
          // Emit planet update event to trigger UI refresh
          gameManager.emit(GameManagerEvent.PlanetUpdate);
        } else if (isUnconfirmedFindArtifactTx(tx)) {
          await gameManager.hardRefreshPlanet(tx.intent.planetId);
        } else if (isUnconfirmedDepositArtifactTx(tx)) {
          await Promise.all([
            gameManager.hardRefreshPlanet(tx.intent.locationId),
            gameManager.hardRefreshArtifact(tx.intent.artifactId),
          ]);
        } else if (isUnconfirmedWithdrawArtifactTx(tx)) {
          await Promise.all([
            await gameManager.hardRefreshPlanet(tx.intent.locationId),
            await gameManager.hardRefreshArtifact(tx.intent.artifactId),
          ]);
        } else if (isUnconfirmedProspectPlanetTx(tx)) {
          await gameManager.softRefreshPlanet(tx.intent.planetId);
        } else if (isUnconfirmedInstallModuleTx(tx)) {
          // Wait a bit for MUD components to sync after transaction confirmation
          // SpaceshipBonus table is updated in the contract, so we need to wait
          // for the store sync to complete before refreshing
          await delay(500);
          await gameManager.hardRefreshPlanet(tx.intent.planetHash);
          gameManager.hardRefreshArtifact(tx.intent.spaceshipId);
          gameManager.hardRefreshArtifact(tx.intent.moduleId);
          // Emit events to trigger UI refresh
          gameManager.emit(GameManagerEvent.PlanetUpdate);
          gameManager.emit(
            GameManagerEvent.ArtifactUpdate,
            tx.intent.spaceshipId,
          );
          gameManager.emit(GameManagerEvent.ArtifactUpdate, tx.intent.moduleId);
        } else if (isUnconfirmedUninstallModuleTx(tx)) {
          // Wait a bit for MUD components to sync after transaction confirmation
          // SpaceshipBonus table is updated in the contract, so we need to wait
          // for the store sync to complete before refreshing
          await delay(500);
          await gameManager.hardRefreshPlanet(tx.intent.planetHash);
          gameManager.hardRefreshArtifact(tx.intent.spaceshipId);
          gameManager.hardRefreshArtifact(tx.intent.moduleId);
          // Emit events to trigger UI refresh
          gameManager.emit(GameManagerEvent.PlanetUpdate);
          gameManager.emit(
            GameManagerEvent.ArtifactUpdate,
            tx.intent.spaceshipId,
          );
          gameManager.emit(GameManagerEvent.ArtifactUpdate, tx.intent.moduleId);
        } else if (
          isUnconfirmedChargeArtifactTx(tx) ||
          isUnconfirmedActivateArtifactTx(tx) ||
          isUnconfirmedShutdownArtifactTx(tx)
        ) {
          await gameManager.hardRefreshPlanet(tx.intent.locationId);
          await gameManager.hardRefreshArtifact(tx.intent.artifactId);
          // } else if (isUnconfirmedActivateArtifactTx(tx)) {
          //   let refreshFlag = true;
          //   const fromPlanet = await gameManager.getPlanetWithId(
          //     tx.intent.locationId,
          //   );
          //   const artifact = await gameManager.getArtifactWithId(
          //     tx.intent.artifactId,
          //   );

          //   if (artifact?.artifactType === ArtifactType.FireLink) {
          //     if (fromPlanet && fromPlanet.locationId && tx.intent.linkTo) {
          //       const toPlanet = await gameManager.getPlanetWithId(
          //         tx.intent.linkTo,
          //       );
          //       if (toPlanet) {
          //         const activeArtifactOnToPlanet =
          //           await gameManager.getActiveArtifact(toPlanet);
          //         if (
          //           activeArtifactOnToPlanet &&
          //           activeArtifactOnToPlanet.artifactType ===
          //             ArtifactType.IceLink &&
          //           activeArtifactOnToPlanet.linkTo
          //         ) {
          //           const toLinkPlanet = await gameManager.getPlanetWithId(
          //             activeArtifactOnToPlanet.linkTo,
          //           );
          //           if (toLinkPlanet) {
          //             await Promise.all([
          //               gameManager.bulkHardRefreshPlanets([
          //                 fromPlanet.locationId,
          //                 toPlanet.locationId,
          //                 toLinkPlanet.locationId,
          //               ]),
          //               // gameManager.hardRefreshArtifact(tx.intent.artifactId),
          //             ]);
          //             refreshFlag = false;
          //           }
          //         }
          //       }
          //     }
          //   }

          //   if (refreshFlag) {
          //     if (tx.intent.linkTo) {
          //       await Promise.all([
          //         gameManager.bulkHardRefreshPlanets([
          //           tx.intent.locationId,
          //           tx.intent.linkTo,
          //         ]),
          //         // gameManager.hardRefreshArtifact(tx.intent.artifactId),
          //       ]);
          //     } else {
          //       await Promise.all([
          //         gameManager.hardRefreshPlanet(tx.intent.locationId),
          //         // gameManager.hardRefreshArtifact(tx.intent.artifactId),
          //       ]);
          //     }
          //   }
        } else if (isUnconfirmedDeactivateArtifactTx(tx)) {
          // console.log(tx);
          if (tx.intent.linkTo) {
            await Promise.all([
              gameManager.bulkHardRefreshPlanets([
                tx.intent.locationId,
                tx.intent.linkTo,
              ]),
              gameManager.hardRefreshArtifact(tx.intent.artifactId),
            ]);
          } else {
            await Promise.all([
              gameManager.hardRefreshPlanet(tx.intent.locationId),
              gameManager.hardRefreshArtifact(tx.intent.artifactId),
            ]);
          }
        } else if (isUnconfirmedChangeArtifactImageTypeTx(tx)) {
          await Promise.all([
            gameManager.hardRefreshPlanet(tx.intent.locationId),
            gameManager.hardRefreshArtifact(tx.intent.artifactId),
          ]);
        } else if (isUnconfirmedBuyArtifactTx(tx)) {
          await Promise.all([
            gameManager.hardRefreshPlanet(tx.intent.locationId),
            gameManager.hardRefreshArtifact(tx.intent.artifactId),
          ]);
        } else if (isUnconfirmedWithdrawSilverTx(tx)) {
          await gameManager.hardRefreshPlanet(tx.intent.locationId);
        } else if (isUnconfirmedCapturePlanetTx(tx)) {
          await Promise.all([
            gameManager.hardRefreshPlayer(gameManager.getAccount()),
            gameManager.hardRefreshPlanet(tx.intent.locationId),
          ]);
        } else if (isUnconfirmedSetPlanetEmojiTx(tx)) {
          await gameManager.hardRefreshPlanet(tx.intent.locationId);
        } else if (isUnconfirmedInvadePlanetTx(tx)) {
          await Promise.all([
            gameManager.hardRefreshPlayer(gameManager.getAccount()),
            gameManager.hardRefreshPlanet(tx.intent.locationId),
          ]);
        } else if (isUnconfirmedClaimTx(tx)) {
          // gameManager.entityStore.updatePlanet(
          //   tx.intent.locationId,
          //   (p) => (p.claimer = gameManager.getAccount()),
          // );
        } else if (isUnconfirmedCreateGuildTx(tx)) {
          gameManager.hardRefreshGuild(tx.intent.guildId);
        } else if (isUnconfirmedInviteToGuildTx(tx)) {
          gameManager.hardRefreshGuild(tx.intent.guildId);
        } else if (isUnconfirmedAcceptInvitationTx(tx)) {
          gameManager.hardRefreshGuild(tx.intent.guildId);
        } else if (isUnconfirmedApplyToGuildTx(tx)) {
          gameManager.hardRefreshGuild(tx.intent.guildId);
        } else if (isUnconfirmedApproveApplicationTx(tx)) {
          gameManager.hardRefreshGuild(tx.intent.guildId);
        } else if (isUnconfirmedLeaveGuildTx(tx)) {
          gameManager.hardRefreshGuild(tx.intent.guildId);
        } else if (isUnconfirmedTransferGuildLeadershipTx(tx)) {
          gameManager.hardRefreshGuild(tx.intent.guildId);
        } else if (isUnconfirmedDisbandGuildTx(tx)) {
          gameManager.hardRefreshGuild(tx.intent.guildId);
        } else if (isUnconfirmedSetGrantTx(tx)) {
          gameManager.hardRefreshGuild(tx.intent.guildId);
        } else if (isUnconfirmedSetMemberRoleTx(tx)) {
          gameManager.hardRefreshGuild(tx.intent.guildId);
        } else if (isUnconfirmedKickMemberTx(tx)) {
          gameManager.hardRefreshGuild(tx.intent.guildId);
        }

        gameManager.entityStore.clearUnconfirmedTxIntent(tx);
        gameManager.onTxConfirmed(tx);
      })
      .on(ContractsAPIEvent.TxErrored, async (tx: Transaction) => {
        gameManager.entityStore.clearUnconfirmedTxIntent(tx);
        if (tx.hash) {
          gameManager.persistentChunkStore.onEthTxComplete(tx.hash);
        }
        gameManager.onTxReverted(tx);
      })
      .on(ContractsAPIEvent.TxCancelled, async (tx: Transaction) => {
        gameManager.onTxCancelled(tx);
      })
      .on(ContractsAPIEvent.RadiusUpdated, async () => {
        const newRadius = gameManager.contractsAPI.getWorldRadius();
        gameManager.setRadius(newRadius);
      });

    const unconfirmedTxs =
      await persistentChunkStore.getUnconfirmedSubmittedEthTxs();
    const confirmationQueue = new ThrottledConcurrentQueue({
      invocationIntervalMs: 1000,
      maxInvocationsPerIntervalMs: 10,
      maxConcurrency: 1,
    });

    for (const unconfirmedTx of unconfirmedTxs) {
      confirmationQueue.add(async () => {
        const tx =
          gameManager.contractsAPI.txExecutor.waitForTransaction(unconfirmedTx);
        gameManager.contractsAPI.emitTransactionEvents(tx);
        return tx.confirmedPromise;
      });
    }

    // we only want to initialize the mining manager if the player has already joined the game
    // if they haven't, we'll do this once the player has joined the game
    if (!!homeLocation && initialState.players.has(account as string)) {
      gameManager.initMiningManager(homeLocation.coords);
    }

    return gameManager;
  }
}
