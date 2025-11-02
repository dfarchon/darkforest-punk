import { LOW_BALANCE_THRESHOLD, RECOMMENDED_BALANCE } from "@bluepill/utils";
import {
  BLOCK_EXPLORER_URL,
  BLOCKCHAIN_NAME,
  BLOCKCHAIN_BRIDGE,
  HOW_TO_ENABLE_POPUPS,
  HOW_TO_TRANSFER_ETH_FROM_L2_TO_REDSTONE,
  PLAYER_GUIDE,
  TOKEN_NAME,
  VERSION,
} from "@df/constants";
import type { EthConnection } from "@df/network";
import { neverResolves, weiToEth } from "@df/network";
import { address } from "@df/serde";
import { addressToHex } from "@df/serde";
import type { UnconfirmedUseKey } from "@df/types";
import { reversed } from "@df/utils/list";
import { bigIntFromKey } from "@df/whitelist";
import { RegisterPlayerComponent } from "@frontend/Components/RegisterPlayerComponent";
import { WalletModal } from "@frontend/Components/WalletModal";
import { useBurnerBalance, useMainWalletBalance } from "@hooks/useBalance";
import { useStore as useStoreHook } from "@hooks/useStore";
import { useComponentValue } from "@latticexyz/react";
import { getComponentValue } from "@latticexyz/recs";
import {
  decodeEntity,
  encodeEntity,
  singletonEntity,
} from "@latticexyz/store-sync/recs";
import { useMUD } from "@mud/MUDContext";
import { utils, Wallet } from "ethers";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import styled from "styled-components";
import { zeroAddress } from "viem";
import { useWalletClient, useAccount } from "wagmi";

import { ZKArgIdx } from "../../_types/darkforest/api/ContractsAPITypes";
import { makeContractsAPI } from "../../Backend/GameLogic/ContractsAPI";
import { GameManager } from "../../Backend/GameLogic/GameManager";
import { GameManagerEvent } from "../../Backend/GameLogic/GameManager";
import { GameUIManager } from "../../Backend/GameLogic/GameUIManager";
import TutorialManager, {
  TutorialState,
} from "../../Backend/GameLogic/TutorialManager";
import { addAccount, getAccounts } from "../../Backend/Network/AccountManager";
import {
  getEthConnection,
  loadDiamondContract,
} from "../../Backend/Network/Blockchain";
import type { RegisterConfirmationResponse } from "../../Backend/Network/UtilityServerAPI";
import {
  callRegisterAndWaitForConfirmation,
  EmailResponse,
  requestDevFaucet,
  submitInterestedEmail,
  submitPlayerEmail,
} from "../../Backend/Network/UtilityServerAPI";
import { getWhitelistArgs } from "../../Backend/Utils/WhitelistSnarkArgsHelper";
import type { BrowserCompatibleState } from "../Components/BrowserIssues";
import { BrowserIssues } from "../Components/BrowserIssues";
import {
  GameWindowWrapper,
  InitRenderState,
  TerminalToggler,
  TerminalWrapper,
  Wrapper,
} from "../Components/GameLandingPageComponents";
import { MythicLabelText } from "../Components/Labels/MythicLabel";
import type { MiniMapHandle } from "../Components/MiniMap";
import { MiniMap } from "../Components/MiniMap";
import { TextMask } from "../Components/TextMask";
import dfstyles from "../Styles/dfstyles";
import { TopLevelDivProvider, UIManagerProvider } from "../Utils/AppHooks";
import type { Incompatibility } from "../Utils/BrowserChecks";
import { unsupportedFeatures } from "../Utils/BrowserChecks";
import { TerminalTextStyle } from "../Utils/TerminalTypes";
import UIEmitter, { UIEmitterEvent } from "../Utils/UIEmitter";
import { GameWindowLayout } from "../Views/GameWindowLayout";
import type { TerminalHandle } from "../Views/Terminal";
import { Terminal } from "../Views/Terminal";
import { WORLD_NAME } from "@df/constants";

const enum TerminalPromptStep {
  NONE,
  COMPATIBILITY_CHECKS_PASSED,
  DISPLAY_ACCOUNTS,
  GENERATE_ACCOUNT,
  IMPORT_ACCOUNT,
  ACCOUNT_SET,
  ASKING_HAS_WHITELIST_KEY,
  ASKING_WAITLIST_EMAIL,
  ASKING_WHITELIST_KEY,
  ASKING_PLAYER_EMAIL,
  FETCHING_ETH_DATA,
  ASK_ADD_ACCOUNT,
  ADD_ACCOUNT,
  NO_HOME_PLANET,
  SEARCHING_FOR_HOME_PLANET,
  ALL_CHECKS_PASS,
  COMPLETE,
  TERMINATED,
  ERROR,
  SPECTATING,
}

type TerminalStateOptions = {
  showHelp: boolean;
};

// GM Blue Pill
import { BluePillBurnerWallet } from "@bluepill/BluePillBurnerWallet";
import { BluePillRegisterPlayer } from "@bluepill/BluePillRegisterPlayer";
import { BluePillWalletButton } from "@bluepill/BluePillWalletButton";
import { BluePillMapGuide } from "@bluepill/BluePillMapGuide";
import { PinkButton } from "../../BluePill/PinkButton";

export function BluePillLandingPage() {
  const navigate = useNavigate();
  const { contract } = useParams();
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const { chain } = useAccount();
  const { data: walletClient } = useWalletClient();
  const {
    network: {
      walletClient: burnerWalletClient,
      playerEntity,
      waitForTransaction,
    },
    components: components, //{ SyncProgress },
  } = useMUD();

  const { Player } = components;

  const syncProgress = useComponentValue(
    components.SyncProgress,
    singletonEntity,
    {
      message: "Connecting",
      percentage: 0,
      step: "Initialize",
      latestBlockNumber: 0n,
      lastBlockNumberProcessed: 0n,
    },
  );

  const mainAccount = walletClient?.account?.address ?? zeroAddress;
  const gameAccount = burnerWalletClient.account?.address ?? zeroAddress;

  const terminalHandle = useRef<TerminalHandle>(null);
  const gameUIManagerRef = useRef<GameUIManager | null>(null);
  const topLevelContainer = useRef<HTMLDivElement>(null);
  const miniMapRef = useRef<MiniMapHandle>();

  const { value: burnerBalanceValue, refetch: refetchBurnerBalance } =
    useBurnerBalance();

  const [isDataLoaded, setIsDataLoaded] = useState(false);

  useEffect(() => {
    const fetchBalances = async () => {
      await refetchBurnerBalance();
      setIsDataLoaded(true);
    };

    fetchBalances();
  }, [refetchBurnerBalance]);

  const [gameManager, setGameManager] = useState<GameManager | undefined>();
  const [terminalVisible, setTerminalVisible] = useState(true);
  const [initRenderState, setInitRenderState] = useState(InitRenderState.NONE);
  const [ethConnection, setEthConnection] = useState<
    EthConnection | undefined
  >();
  const [step, setStep] = useState(TerminalPromptStep.NONE);

  const [browserCompatibleState, setBrowserCompatibleState] =
    useState<BrowserCompatibleState>("unknown");
  const [browserIssues, setBrowserIssues] = useState<Incompatibility[]>([]);
  const [isMiniMapOn, setMiniMapOn] = useState(false);
  const [spectate, setSpectate] = useState(false);

  // NOTE: round 2
  const useZkWhitelist = true;
  // const useZkWhitelist = params.has('zkWhitelist');
  const selectedAddress = params.get("account");
  const contractAddress = contract ? address(contract) : address(zeroAddress);
  const isLobby = false; // NOTE: contractAddress !== address(CONTRACT_ADDRESS);

  const [isPlayerRegistered, setIsPlayerRegistered] = useState(false);

  const syncSign = useMemo(() => {
    console.log(syncProgress.step, syncProgress.percentage);
    return syncProgress.step === "live" && syncProgress.percentage == 100;
  }, [syncProgress]);

  useEffect(() => {
    const checkPlayerRegistration = async () => {
      if (playerEntity && walletClient?.account) {
        const mainAccount = address(walletClient.account.address);
        const playerKey = encodeEntity(Player.metadata.keySchema, {
          owner: addressToHex(mainAccount),
        });
        const rawPlayer = getComponentValue(Player, playerKey);
        setIsPlayerRegistered(!!rawPlayer);
      }
    };

    checkPlayerRegistration();

    const intervalId = setInterval(() => {
      checkPlayerRegistration();
    }, 2000);

    return () => clearInterval(intervalId);
  }, [playerEntity, Player, walletClient]);

  useEffect(() => {
    getEthConnection()
      .then((ethConnection) => setEthConnection(ethConnection))
      .catch((e) => {
        alert("error connecting to blockchain");
        console.log(e);
      });
  }, []);

  useEffect(() => {
    unsupportedFeatures().then((issues) => {
      const supported = issues.length === 0;
      setBrowserIssues(issues);
      if (supported) {
        setBrowserCompatibleState("supported");
        // setStep(TerminalPromptStep.COMPATIBILITY_CHECKS_PASSED);
      } else {
        setBrowserCompatibleState("unsupported");
      }
    });
  }, []);

  const isProd = import.meta.env.VITE_NODE_ENV === "production";

  //GM Blue Pill

  const [updateTrigger, setUpdateTrigger] = useState(0);

  useEffect(() => {
    const intervalId = setInterval(() => {
      setUpdateTrigger((prev) => prev + 1);
    }, 3000);

    return () => clearInterval(intervalId);
  }, []);

  const indexerLoaded = useMemo(() => {
    console.log(syncProgress.step, syncProgress.percentage);
    return syncProgress.step === "live" && syncProgress.percentage == 100;
  }, [syncProgress]);

  const walletLinked = useMemo(() => {
    const account = walletClient?.account?.address;
    if (!account) return false;

    if (walletClient.chain?.id !== chain?.id) return false;
    if (walletClient.chain?.id !== burnerWalletClient.chain?.id) return false;

    return account !== zeroAddress;
  }, [walletClient, chain]);

  const playerRegistered = useMemo(() => {
    if (playerEntity && walletClient?.account) {
      const account = address(walletClient.account.address);
      const playerKey = encodeEntity(Player.metadata.keySchema, {
        owner: addressToHex(account),
      });
      const rawPlayer = getComponentValue(Player, playerKey);
      return !!rawPlayer;
    } else return false;
  }, [playerEntity, walletClient, Player, updateTrigger]);

  const burnerHasFunds = useMemo(() => {
    return burnerBalanceValue > LOW_BALANCE_THRESHOLD;
  }, [burnerBalanceValue]);

  const spawnAreaSelected = useMemo(() => {
    const selectedSpawnArea = miniMapRef.current?.getSelectedSpawnArea();
    return selectedSpawnArea !== undefined;
  }, [miniMapRef, updateTrigger]);

  const setAccount = async () => {
    console.log("setAccount");
    console.log(gameAccount);
    const privateKey = localStorage.getItem("mud:burnerWallet");

    if (!privateKey) return;

    await ethConnection?.setAccount(privateKey);
    const terminal = terminalHandle;

    try {
      const playerAddress = ethConnection?.getAddress();
      if (!playerAddress || !ethConnection) {
        throw new Error("not logged in");
      }

      terminal.current?.println("Checking account balance... ");

      const balance = BigInt(await ethConnection.loadBalance(playerAddress));

      console.log("---------------------------------");
      console.log(balance);
      console.log(LOW_BALANCE_THRESHOLD);
      console.log("---------------------------------");

      if (balance < LOW_BALANCE_THRESHOLD) {
        terminal.current?.printElement(<BluePillBurnerWallet />);
      }

      terminal.current?.println("");

      terminal.current?.print("Checking if whitelisted... ");

      const isWhitelisted = true;
      // TODO(#2329): isWhitelisted should just check the contractOwner
      // if (isWhitelisted || playerAddress === adminAddress) {
      if (isWhitelisted) {
        terminal.current?.println("Player whitelisted.");
        terminal.current?.println("");
        terminal.current?.println(`Welcome, player ${playerAddress}.`);

        // TODO: Provide own env variable for this feature
        if (!isProd) {
          // in development, automatically get some ether from faucet
          const balance = weiToEth(
            await ethConnection?.loadBalance(playerAddress),
          );
          if (balance === 0) {
            await requestDevFaucet(playerAddress);
          }
        }
        setStep(TerminalPromptStep.FETCHING_ETH_DATA);
      } else {
        setStep(TerminalPromptStep.ASKING_HAS_WHITELIST_KEY);
      }
    } catch (e) {
      console.error(`error connecting to whitelist: ${e}`);
      terminal.current?.println(
        "ERROR: Could not connect to whitelist contract. Please refresh and try again in a few minutes.",
        TerminalTextStyle.Red,
      );
    }
  };

  const searchHomePlanet = async () => {
    const terminal = terminalHandle;
    const gameUIManager = gameUIManagerRef.current;

    const selectedSpawnArea = miniMapRef.current?.getSelectedSpawnArea();

    // disable reselect of spawn posistion when we start searching
    miniMapRef.current?.setSelectable(false);

    const coords = selectedSpawnArea?.worldPoint;

    if (!terminal || !gameUIManager || !coords) {
      return;
    }

    const distFromOrigin = Math.sqrt(coords.x ** 2 + coords.y ** 2);
    terminal.current?.println(
      `Spawn coordinates: (${coords.x.toFixed(0)},${coords.y.toFixed(0)}) were selected, distance from center: ${distFromOrigin.toFixed(0)}.`,
    );

    gameUIManager
      .getGameManager()
      .on(GameManagerEvent.InitializedPlayer, () => {
        setTimeout(() => {
          setMiniMapOn(false);

          terminal.current?.println("Initializing game...");
          setStep(TerminalPromptStep.ALL_CHECKS_PASS);
        });
      });

    gameUIManager
      .joinGame(
        async (e) => {
          // TODO: Handle 2min timeout error
          setMiniMapOn(false);

          console.error(e);

          terminal.current?.println("Error Joining Game:");
          terminal.current?.println(e.message, TerminalTextStyle.Red);
          terminal.current?.newline();

          console.log(e.message.slice(0, 20));

          if (e.message.slice(0, 20) === "Please enable popups") {
            terminal.current?.print("Player guide: ", TerminalTextStyle.Pink);

            terminal.current?.printLink(
              "How to enable popups",
              () => {
                window.open(HOW_TO_ENABLE_POPUPS);
              },
              TerminalTextStyle.Green,
            );
            terminal.current?.println(
              " <= New player please check this guide!!!",
              TerminalTextStyle.Pink,
            );

            terminal.current?.println("");
          } else if (e.message === "transaction reverted") {
            terminal.current?.println(
              "Please refresh the client, choose another area and try again.",
              TerminalTextStyle.Pink,
            );

            terminal.current?.println("");
          }

          // terminal.current?.println(
          //   "Don't worry :-) you can get more ETH on Redstone this way 😘",
          //   TerminalTextStyle.Pink
          // );

          // terminal.current?.newline();
          // terminal.current?.printLink(
          //   'Deposit ETH to Redstone',
          //   () => {
          //     window.open(BLOCKCHAIN_BRIDGE);
          //   },
          //   TerminalTextStyle.Pink
          // );
          // terminal.current?.newline();
          // terminal.current?.newline();

          terminal.current?.println("Press [enter] to Try Again:");

          await terminal.current?.getInput();
          return true;
        },
        coords,
        spectate,
      )
      .catch((error: Error) => {
        terminal.current?.println(
          `[ERROR] An error occurred: ${error.toString().slice(0, 10000)}`,
          TerminalTextStyle.Red,
        );
        terminal.current?.println(
          "please refresh client to try again.",
          TerminalTextStyle.Pink,
        );
      });
  };

  const enterGame = async () => {
    const terminal = terminalHandle;
    if (!terminal) return;

    setMiniMapOn(false);

    terminal.current?.println("Initializing game...");
    terminal.current?.println("Enter game.", TerminalTextStyle.Green);
    terminal.current?.println("Press [enter] to begin");
    terminal.current?.println(
      "Press [s] then [enter] to begin in SAFE MODE - plugins disabled",
    );

    setStep(TerminalPromptStep.COMPLETE);
    setInitRenderState(InitRenderState.COMPLETE);
    terminal.current?.clear();

    terminal.current?.println(
      "Welcome to the " + WORLD_NAME,
      TerminalTextStyle.Green,
    );
    terminal.current?.println("");
    terminal.current?.println(
      "This is the Dark Forest interactive JavaScript terminal. Only use this if you know exactly what you're doing.",
    );
    terminal.current?.println("");
    terminal.current?.println("Try running: df.getAccount()");
    terminal.current?.println("");
  };

  useEffect(() => {
    if (indexerLoaded && walletLinked && playerRegistered && burnerHasFunds) {
      setAccount();
    }
  }, [indexerLoaded, walletLinked, playerRegistered, burnerHasFunds]);

  useEffect(() => {
    console.log("---------------------------------");
    console.log("indexerLoaded", indexerLoaded);
    console.log("walletLinked", walletLinked);
    console.log("playerRegistered", playerRegistered);
    console.log("burnerHasFunds", burnerHasFunds);
    console.log("spawnAreaSelected", spawnAreaSelected);
    if (
      indexerLoaded &&
      walletLinked &&
      playerRegistered &&
      burnerHasFunds &&
      spawnAreaSelected
    ) {
      terminalHandle.current?.printElement(
        <PinkButton
          onClick={() => {
            searchHomePlanet();
          }}
        >
          Search Home Planet
        </PinkButton>,
      );
      terminalHandle.current?.println("");
    }
  }, [
    indexerLoaded,
    walletLinked,
    playerRegistered,
    burnerHasFunds,
    spawnAreaSelected,
  ]);

  const advanceStateFromCompatibilityPassed = useCallback(
    async (
      terminal: React.MutableRefObject<TerminalHandle | undefined>,
      { showHelp }: TerminalStateOptions = {
        showHelp: true,
      },
    ) => {
      const accounts = getAccounts();
      const totalAccounts = accounts.length;

      if (showHelp) {
        terminal.current?.newline();
        terminal.current?.newline();

        terminal.current?.print("Player guide: ", TerminalTextStyle.Pink);

        terminal.current?.printLink(
          "Please Click Here",
          () => {
            window.open(PLAYER_GUIDE);
          },
          TerminalTextStyle.Blue,
        );

        terminal.current?.println(
          " <= New player please check this guide !!!",
          TerminalTextStyle.Pink,
        );

        terminal.current?.newline();

        if (isLobby) {
          terminal.current?.newline();
          terminal.current?.printElement(
            <MythicLabelText text={`You are joining a ${WORLD_NAME} lobby`} />,
          );
          terminal.current?.newline();
          terminal.current?.newline();
        } else {
          terminal.current?.newline();
          terminal.current?.println(
            "Login or create an account.",
            TerminalTextStyle.Green,
          );
          terminal.current?.println(
            "Choose an option, type its symbol and press ENTER.",
          );
          terminal.current?.newline();
        }
        if (totalAccounts > 0) {
          terminal.current?.println(
            `Found ${totalAccounts} account${totalAccounts > 1 ? "s" : ""} on this device.`,
          );
          terminal.current?.println(``);
          terminal.current?.println(
            "(a) Login with existing account.",
            TerminalTextStyle.Sub,
          );
        }

        terminal.current?.println(
          "(n) Generate new burner wallet account.",
          TerminalTextStyle.Sub,
        );
        terminal.current?.println(`(i) Import private key.`);

        terminal.current?.println(`(s) Spectate.`, TerminalTextStyle.Sub);
        terminal.current?.println(``);

        terminal.current?.println(
          totalAccounts > 0
            ? "Select one of the options above [a], [n], [i] or [s], then press [enter]."
            : "Select one of the options above [n], [i] or [s], then press [enter].",
          TerminalTextStyle.Sub,
        );
      }

      if (selectedAddress !== null) {
        terminal.current?.println(
          `Selecting account ${selectedAddress} from url...`,
          TerminalTextStyle.Green,
        );

        // Search accounts backwards in case a player has used a private key more than once.
        // In that case, we want to take the most recently created account.
        const account = reversed(getAccounts()).find(
          (a) => a.address === selectedAddress,
        );
        if (!account) {
          terminal.current?.println(
            "Unrecognized account found in url.",
            TerminalTextStyle.Red,
          );
          return;
        }

        try {
          await ethConnection?.setAccount(account.privateKey);
          setStep(TerminalPromptStep.ACCOUNT_SET);
        } catch (e) {
          // unwanted state, client will need to reload browser here
          terminal.current?.println(
            "An unknown error occurred. please refresh the client",
            TerminalTextStyle.Red,
          );
        }
        return;
      }

      const userInput = (await terminal.current?.getInput())?.trim() ?? "";

      // stop options, go to next step
      switch (true) {
        case userInput === "a" && totalAccounts > 0:
          setStep(TerminalPromptStep.DISPLAY_ACCOUNTS);
          return;
        case userInput === "n":
          setStep(TerminalPromptStep.GENERATE_ACCOUNT);
          return;
        case userInput === "i":
          setStep(TerminalPromptStep.IMPORT_ACCOUNT);
          return;
        case userInput === "s":
          setStep(TerminalPromptStep.SPECTATING);
          return;
      }

      // continue waiting for user input
      switch (true) {
        case userInput === "clear": {
          terminal.current?.clear();
          showHelp = false;
          advanceStateFromCompatibilityPassed(terminal, {
            showHelp,
          });
          break;
        }
        case userInput === "h" || userInput === "help": {
          showHelp = true;
          advanceStateFromCompatibilityPassed(terminal, {
            showHelp,
          });
          break;
        }
        default: {
          terminal.current?.println(
            "Invalid option, please try press [help]",
            TerminalTextStyle.Pink,
          );
          showHelp = false;
          advanceStateFromCompatibilityPassed(terminal, {
            showHelp,
          });
        }
      }
    },
    [isLobby, ethConnection, selectedAddress],
  );

  const advanceStateFromDisplayAccounts = useCallback(
    async (
      terminal: React.MutableRefObject<TerminalHandle | undefined>,
      { showHelp }: TerminalStateOptions = {
        showHelp: true,
      },
    ) => {
      const accounts = getAccounts();
      const totalAccounts = accounts.length;
      if (showHelp) {
        terminal.current?.println(
          "Login with existing account.",
          TerminalTextStyle.Green,
        );
        terminal.current?.println("select account.", TerminalTextStyle.Sub);
        terminal.current?.println("");

        for (let i = 0; i < accounts.length; i += 1) {
          const rawResult = await ethConnection?.loadBalance(
            accounts[i].address,
          );
          const balance = rawResult ? weiToEth(rawResult) : 0;

          terminal.current?.print(
            `(${i + 1}): ${accounts[i].address}  `,
            TerminalTextStyle.Sub,
          );
          if (balance < 0.00001) {
            terminal.current?.print(
              balance.toFixed(9) + " " + TOKEN_NAME,
              TerminalTextStyle.Red,
            );
            terminal.current?.println(
              " => select this account to know how to get enough ETH",
            );
          } else {
            terminal.current?.println(
              balance.toFixed(9) + " " + TOKEN_NAME,
              TerminalTextStyle.Green,
            );
          }
        }
        terminal.current?.println("");

        let accountsMessage = "Select account option [1], then press [enter].";
        if (totalAccounts > 1) {
          const args = [...Array(totalAccounts - 1)].map(
            (_, i) => `[${i + 1}]`,
          );
          accountsMessage = `Select one of the account options ${args.join(
            ", ",
          )} or [${totalAccounts}], then press [enter].`;
        }

        terminal.current?.println(accountsMessage, TerminalTextStyle.Sub);
      }

      const userInput = (await terminal.current?.getInput())?.trim() ?? "";
      const selection = userInput !== "" ? Number(userInput) : NaN;

      // stop option, go to next step
      if (
        Number.isInteger(selection) &&
        accounts[selection - 1] !== undefined
      ) {
        const account = accounts[selection - 1];
        try {
          await ethConnection?.setAccount(account.privateKey);
          setStep(TerminalPromptStep.ACCOUNT_SET);
        } catch (e) {
          terminal.current?.println(
            "An unknown error occurred. please refresh the client.",
            TerminalTextStyle.Red,
          );
          advanceStateFromDisplayAccounts(terminal, {
            showHelp: false,
          });
        }
        return;
      }

      // continue waiting for user input
      switch (true) {
        case userInput === "clear": {
          terminal.current?.clear();
          showHelp = false;
          break;
        }
        case userInput === "h" || userInput === "help": {
          showHelp = true;
          break;
        }
        default: {
          terminal.current?.println(
            "Invalid option, please try press [help].",
            TerminalTextStyle.Pink,
          );
          showHelp = false;
        }
      }

      advanceStateFromDisplayAccounts(terminal, { showHelp });
    },
    [ethConnection],
  );

  const advanceStateFromGenerateAccount = useCallback(
    async (terminal: React.MutableRefObject<TerminalHandle | undefined>) => {
      const newWallet = Wallet.createRandom();
      const newSKey = newWallet.privateKey;
      const newAddr = address(newWallet.address);

      try {
        addAccount(newSKey);
        ethConnection?.setAccount(newSKey);

        terminal.current?.println(``);
        terminal.current?.print(`Created new burner wallet account `);
        terminal.current?.print(newAddr, TerminalTextStyle.Pink);

        terminal.current?.println(``);
        terminal.current?.println("");
        terminal.current?.println(
          "NOTE: Burner wallets are stored in local storage.",
          TerminalTextStyle.Pink,
        );
        terminal.current?.println(
          "They are relatively insecure and you should avoid ",
        );
        terminal.current?.println("storing substantial funds in them.");
        terminal.current?.println("");
        terminal.current?.println(
          "Also, clearing browser local storage/cache will render your",
        );
        terminal.current?.println(
          "burner wallets inaccessible, unless you export your private keys.",
        );
        terminal.current?.println("");
        terminal.current?.println("Press [enter] to continue.");

        await terminal.current?.getInput();
        setStep(TerminalPromptStep.ACCOUNT_SET);
      } catch (e) {
        // unwanted state, user will need to reload browser here
        terminal.current?.println(
          "An unknown error occurred. please refresh the client.",
          TerminalTextStyle.Red,
        );
      }
    },
    [ethConnection],
  );

  const advanceStateFromImportAccount = useCallback(
    async (
      terminal: React.MutableRefObject<TerminalHandle | undefined>,
      { showHelp }: TerminalStateOptions = {
        showHelp: true,
      },
    ) => {
      if (showHelp) {
        terminal.current?.println(
          "Import private key.",
          TerminalTextStyle.Green,
        );
        terminal.current?.println(
          "Enter the 0x-prefixed private key of the account you wish to import",
          TerminalTextStyle.Text,
        );
        terminal.current?.println(
          "NOTE: THIS WILL STORE THE PRIVATE KEY IN YOUR BROWSER'S LOCAL STORAGE",
          TerminalTextStyle.Text,
        );
        terminal.current?.println(
          "Local storage is relatively insecure. We recommend only importing accounts with zero-to-no funds.",
        );
      }

      const userInput = (await terminal.current?.getInput())?.trim() ?? "";
      const validSkeyPattern = /^0x[0-9a-fA-F]{64}$/;
      if (validSkeyPattern.test(userInput)) {
        try {
          const newSKey = userInput;
          const newAddr = address(utils.computeAddress(newSKey));

          addAccount(newSKey);

          ethConnection?.setAccount(newSKey);
          terminal.current?.println(
            `Imported account with address ${newAddr}.`,
          );
          setStep(TerminalPromptStep.ACCOUNT_SET);
          return;
        } catch (e) {
          terminal.current?.println(
            "An unknown error occurred. please refresh the page.",
            TerminalTextStyle.Red,
          );
          advanceStateFromImportAccount(terminal, { showHelp: false });
          return;
        }
      }

      // continue waiting for user input
      switch (true) {
        case userInput === "clear": {
          terminal.current?.clear();
          showHelp = false;
          break;
        }
        case userInput === "h" || userInput === "help": {
          showHelp = true;
          break;
        }
        default: {
          terminal.current?.println(
            "Invalid option, please try again.",
            TerminalTextStyle.Red,
          );
          showHelp = false;
        }
      }

      advanceStateFromImportAccount(terminal, { showHelp });
    },
    [ethConnection],
  );

  const advanceStateFromAccountSet = useCallback(
    async (terminal: React.MutableRefObject<TerminalHandle | undefined>) => {
      try {
        const playerAddress = ethConnection?.getAddress();
        if (!playerAddress || !ethConnection) {
          throw new Error("not logged in");
        }

        terminal.current?.println("Checking account balance... ");

        const balance = weiToEth(
          await ethConnection.loadBalance(playerAddress),
        );

        if (balance < 0.00001) {
          terminal.current?.print(`   Your account: `);
          terminal.current?.println(
            `${playerAddress}`,
            TerminalTextStyle.Green,
          );

          terminal.current?.print("    Private Key: ");
          terminal.current?.printElement(
            <TextMask
              maskText="Click here to get private key"
              text={ethConnection.getPrivateKey()}
              noticeText="<= click here to copy private key"
              unFocusedWidth={"150px"}
              focusedWidth={"150px"}
              style={{ color: "#00DC82" }}
            />,
          );

          terminal.current?.println("");

          terminal.current?.print(`   Your balance: `);
          terminal.current?.print(
            `${balance.toFixed(9)} ${TOKEN_NAME}`,
            TerminalTextStyle.Red,
          );

          terminal.current?.println(" <= recommend depositing 0.001 ETH");

          terminal.current?.print(`           NOTE: `, TerminalTextStyle.Pink);

          terminal.current?.println(
            "You can use bridge to transfer ETH to " + BLOCKCHAIN_NAME,
            TerminalTextStyle.Pink,
          );

          terminal.current?.print("   L2-L2 bridge: ");

          terminal.current?.printLink(
            BLOCKCHAIN_BRIDGE,
            () => {
              window.open(BLOCKCHAIN_BRIDGE);
            },
            TerminalTextStyle.Green,
          );

          terminal.current?.println(
            " <= transfer ETH from L2 (e.g. optimism) to " + BLOCKCHAIN_NAME,
          );

          terminal.current?.print("   Player guide: ");

          terminal.current?.printLink(
            "How to get ETH on the " +
              BLOCKCHAIN_NAME +
              " mainnet for your account",
            () => {
              window.open(HOW_TO_TRANSFER_ETH_FROM_L2_TO_REDSTONE);
            },
            TerminalTextStyle.Green,
          );
          terminal.current?.println(
            " <= New player please check this guide !!!",
            TerminalTextStyle.Pink,
          );

          terminal.current?.println("");

          terminal.current?.println(
            "After your account get ETH on " +
              BLOCKCHAIN_NAME +
              " Mainnet, press [enter] to continue.",
            TerminalTextStyle.Pink,
          );
          const userInput = (await terminal.current?.getInput())?.trim() ?? "";
          let showHelp = true;

          // continue waiting for user input
          switch (true) {
            case userInput === "": {
              advanceStateFromAccountSet(terminal);
              return;
            }
            case userInput === "clear": {
              terminal.current?.clear();
              showHelp = false;
              advanceStateFromCompatibilityPassed(terminal, {
                showHelp,
              });
              break;
            }
            case userInput === "h" || userInput === "help": {
              showHelp = true;
              advanceStateFromCompatibilityPassed(terminal, {
                showHelp,
              });
              break;
            }
            default: {
              terminal.current?.println(
                "Invalid option, please try press [help].",
                TerminalTextStyle.Pink,
              );
              showHelp = false;
              advanceStateFromCompatibilityPassed(terminal, {
                showHelp,
              });
            }
          }
          return;
        }

        // const whitelist = await ethConnection.loadContract(
        //   contractAddress,
        //   loadDiamondContract,
        // );
        // const isWhitelisted = await whitelist.isWhitelisted(playerAddress);
        // // TODO(#2329): isWhitelisted should just check the contractOwner
        // const adminAddress = address(await whitelist.adminAddress());

        // if (isWhitelisted === false && playerAddress !== adminAddress) {
        //   terminal.current?.println("");
        //   terminal.current?.println(
        //     "Registered players can enter in advance. The Game will be open to everyone soon.",
        //     TerminalTextStyle.Pink,
        //   );
        // }
        terminal.current?.println("");

        terminal.current?.print("Checking if whitelisted... ");

        const isWhitelisted = true;
        // TODO(#2329): isWhitelisted should just check the contractOwner
        // if (isWhitelisted || playerAddress === adminAddress) {
        if (isWhitelisted) {
          terminal.current?.println("Player whitelisted.");
          terminal.current?.println("");
          terminal.current?.println(`Welcome, player ${playerAddress}.`);

          // TODO: Provide own env variable for this feature
          if (!isProd) {
            // in development, automatically get some ether from faucet
            const balance = weiToEth(
              await ethConnection?.loadBalance(playerAddress),
            );
            if (balance === 0) {
              await requestDevFaucet(playerAddress);
            }
          }
          setStep(TerminalPromptStep.FETCHING_ETH_DATA);
        } else {
          setStep(TerminalPromptStep.ASKING_HAS_WHITELIST_KEY);
        }
      } catch (e) {
        console.error(`error connecting to whitelist: ${e}`);
        terminal.current?.println(
          "ERROR: Could not connect to whitelist contract. Please refresh and try again in a few minutes.",
          TerminalTextStyle.Red,
        );
        setStep(TerminalPromptStep.TERMINATED);
      }
    },
    [ethConnection, isProd, contractAddress],
  );

  const advanceStateFromAskHasWhitelistKey = useCallback(
    async (terminal: React.MutableRefObject<TerminalHandle | undefined>) => {
      terminal.current?.print(
        "Do you have a whitelist key?",
        TerminalTextStyle.Text,
      );
      terminal.current?.println(" (y/n)");
      const userInput = await terminal.current?.getInput();
      if (userInput === "y") {
        setStep(TerminalPromptStep.ASKING_WHITELIST_KEY);
      } else if (userInput === "n") {
        setStep(TerminalPromptStep.ASKING_WAITLIST_EMAIL);
      } else {
        terminal.current?.println("Unrecognized input. Please try again.");
        advanceStateFromAskHasWhitelistKey(terminal);
      }
    },
    [],
  );

  const advanceStateFromAskWhitelistKey = useCallback(
    async (terminal: React.MutableRefObject<TerminalHandle | undefined>) => {
      const address = ethConnection?.getAddress();
      if (!address) {
        throw new Error("not logged in");
      }

      terminal.current?.println(
        "Please enter your invite key (XXXXXX-XXXXXX-XXXXXX-XXXXXX):",
        TerminalTextStyle.Sub,
      );

      const key = (await terminal.current?.getInput()) || "";

      terminal.current?.print("Processing key... (this may take up to 30s)");
      terminal.current?.newline();

      if (!useZkWhitelist) {
        let registerConfirmationResponse = {} as RegisterConfirmationResponse;
        try {
          registerConfirmationResponse =
            await callRegisterAndWaitForConfirmation(key, address, terminal);
        } catch (e) {
          registerConfirmationResponse = {
            canRetry: true,
            errorMessage:
              "There was an error connecting to the whitelist server. Please try again later.",
          };
        }

        if (!registerConfirmationResponse.txHash) {
          terminal.current?.println(
            "ERROR: " + registerConfirmationResponse.errorMessage,
            TerminalTextStyle.Red,
          );
          if (registerConfirmationResponse.canRetry) {
            terminal.current?.println("Press any key to try again.");
            await terminal.current?.getInput();
            advanceStateFromAskWhitelistKey(terminal);
          } else {
            setStep(TerminalPromptStep.ASKING_WAITLIST_EMAIL);
          }
        } else {
          terminal.current?.print(
            "Successfully joined game. ",
            TerminalTextStyle.Green,
          );
          terminal.current?.print(`Welcome, player `);
          terminal.current?.println(address, TerminalTextStyle.Text);
          terminal.current?.print(
            "Sent player $0.15 :) ",
            TerminalTextStyle.Blue,
          );
          terminal.current?.printLink(
            "(View Transaction)",
            () => {
              window.open(
                `${BLOCK_EXPLORER_URL}/tx/${registerConfirmationResponse.txHash}`,
              );
            },
            TerminalTextStyle.Blue,
          );
          terminal.current?.newline();
          setStep(TerminalPromptStep.ASKING_PLAYER_EMAIL);
        }
      } else {
        if (!ethConnection) {
          throw new Error("no eth connection");
        }
        const contractsAPI = await makeContractsAPI({
          connection: ethConnection,
          contractAddress,
          components,
        });

        const keyBigInt = bigIntFromKey(key);
        const snarkArgs = await getWhitelistArgs(keyBigInt, address, terminal);
        try {
          const getArgs = async () => {
            return [
              snarkArgs[ZKArgIdx.PROOF_A],
              snarkArgs[ZKArgIdx.PROOF_B],
              snarkArgs[ZKArgIdx.PROOF_C],
              [...snarkArgs[ZKArgIdx.DATA]],
            ];
          };

          const txIntent: UnconfirmedUseKey = {
            contract: contractsAPI.contract,
            methodName: "useKey",
            args: getArgs(),
          };

          // console.log(txIntent);
          const tx = await contractsAPI.submitTransaction(txIntent);
          console.log(tx);

          // const ukReceipt = await contractsAPI.contract.useKey(
          //   snarkArgs[ZKArgIdx.PROOF_A],
          //   snarkArgs[ZKArgIdx.PROOF_B],
          //   snarkArgs[ZKArgIdx.PROOF_C],
          //   [...snarkArgs[ZKArgIdx.DATA]]
          // );
          // await ukReceipt.wait();
          terminal.current?.print(
            "Successfully joined game. ",
            TerminalTextStyle.Green,
          );
          terminal.current?.print(`Welcome, player `);
          terminal.current?.println(address, TerminalTextStyle.Text);
          // terminal.current?.print('Sent player $0.15 :) ', TerminalTextStyle.Blue);
          // terminal.current?.printLink(
          //   '(View Transaction)',
          //   () => {
          //     window.open(`${BLOCK_EXPLORER_URL}/tx/${ukReceipt.hash}`);
          //   },
          //   TerminalTextStyle.Blue
          // );

          terminal.current?.printLink(
            "(View Transaction)",
            () => {
              window.open(`${BLOCK_EXPLORER_URL}/tx/${tx.hash}`);
            },
            TerminalTextStyle.Pink,
          );
          terminal.current?.newline();
          // setStep(TerminalPromptStep.ASKING_PLAYER_EMAIL);
          setStep(TerminalPromptStep.FETCHING_ETH_DATA);
        } catch (e) {
          const error = e as Error;
          if (error instanceof Error) {
            //NOTE: Here might be some bugs
            const invalidKey = error.message.includes("invalid key");
            if (invalidKey) {
              terminal.current?.println(
                `ERROR: Key ${key} is not valid.`,
                TerminalTextStyle.Red,
              );
              setStep(TerminalPromptStep.ASKING_WAITLIST_EMAIL);
            } else {
              terminal.current?.println(
                `ERROR: Something went wrong.`,
                TerminalTextStyle.Red,
              );
              terminal.current?.println(
                "Press [Enter] to try again.",
                TerminalTextStyle.Pink,
              );
              await terminal.current?.getInput();
              advanceStateFromAskWhitelistKey(terminal);
            }
          }
          console.error("Error whitelisting.");
        }
      }
    },
    [ethConnection, contractAddress, useZkWhitelist],
  );

  const advanceStateFromAskWaitlistEmail = useCallback(
    async (terminal: React.MutableRefObject<TerminalHandle | undefined>) => {
      terminal.current?.println(
        "Enter your email address to sign up for the whitelist.",
        TerminalTextStyle.Text,
      );
      const email = (await terminal.current?.getInput()) || "";
      terminal.current?.print("Response pending... ");
      const response = await submitInterestedEmail(email);
      if (response === EmailResponse.Success) {
        terminal.current?.println(
          "Email successfully recorded. ",
          TerminalTextStyle.Green,
        );
        terminal.current?.println(
          "Keep an eye out for updates and invite keys in the next few weeks. Press ENTER to return to the homepage.",
          TerminalTextStyle.Sub,
        );
        setStep(TerminalPromptStep.TERMINATED);
        (await await terminal.current?.getInput()) || "";
        navigate("/");
      } else if (response === EmailResponse.Invalid) {
        terminal.current?.println(
          "Email invalid. Please try again.",
          TerminalTextStyle.Red,
        );
      } else {
        terminal.current?.print("ERROR: Server error. ", TerminalTextStyle.Red);
        terminal.current?.print(
          "Press ENTER to return to homepage.",
          TerminalTextStyle.Sub,
        );
        (await await terminal.current?.getInput()) || "";
        setStep(TerminalPromptStep.TERMINATED);
        navigate("/");
      }
    },
    [navigate],
  );

  const advanceStateFromAskPlayerEmail = useCallback(
    async (terminal: React.MutableRefObject<TerminalHandle | undefined>) => {
      const address = ethConnection?.getAddress();
      if (!address) {
        throw new Error("not logged in");
      }

      terminal.current?.print(
        "Enter your email address. ",
        TerminalTextStyle.Text,
      );
      terminal.current?.println(
        "We'll use this email address to notify you if you win a prize.",
      );

      const email = (await terminal.current?.getInput()) || "";
      const response = await submitPlayerEmail(
        await ethConnection?.signMessageObject({ email }),
      );

      if (response === EmailResponse.Success) {
        terminal.current?.println("Email successfully recorded.");
        setStep(TerminalPromptStep.FETCHING_ETH_DATA);
      } else if (response === EmailResponse.Invalid) {
        terminal.current?.println("Email invalid.", TerminalTextStyle.Red);
        advanceStateFromAskPlayerEmail(terminal);
      } else {
        terminal.current?.println(
          "Error recording email.",
          TerminalTextStyle.Red,
        );
        setStep(TerminalPromptStep.FETCHING_ETH_DATA);
      }
    },
    [ethConnection],
  );

  const advanceStateFromFetchingEthData = useCallback(
    async (terminal: React.MutableRefObject<TerminalHandle | undefined>) => {
      let newGameManager: GameManager;

      try {
        if (!ethConnection) {
          throw new Error("no eth connection");
        }

        if (!mainAccount || mainAccount === zeroAddress) {
          throw new Error("no main account");
        }

        newGameManager = await GameManager.create({
          mainAccount: address(mainAccount),
          connection: ethConnection,
          terminal,
          contractAddress,
          components,
          spectate,
        });
      } catch (e) {
        console.error(e);

        setStep(TerminalPromptStep.ERROR);

        terminal.current?.print(
          "Network under heavy load. Please refresh the page, and check ",
          TerminalTextStyle.Red,
        );

        terminal.current?.printLink(
          BLOCK_EXPLORER_URL,
          () => {
            window.open(BLOCK_EXPLORER_URL);
          },
          TerminalTextStyle.Red,
        );

        terminal.current?.println("");

        return;
      }

      setGameManager(newGameManager);

      window.df = newGameManager;

      const newGameUIManager = await GameUIManager.create(
        newGameManager,
        terminal,
      );

      window.ui = newGameUIManager;

      // Set MUD components for spaceship bonus calculations
      newGameUIManager.setMUDComponents(components);

      terminal.current?.newline();
      terminal.current?.println("Connected to " + WORLD_NAME + " Contract");

      terminal.current?.newline();
      terminal.current?.println("Welcome to " + WORLD_NAME + ".");
      terminal.current?.newline();
      //NOTE: round 3 don't collect those information
      // terminal.current?.println('We collect a minimal set of statistics such as SNARK proving');
      // terminal.current?.println('times and average transaction times across browsers, to help ');
      // terminal.current?.println('us optimize performance and fix bugs. You can opt out of this');
      // terminal.current?.println('in the Settings pane.');
      // terminal.current?.newline();

      gameUIManagerRef.current = newGameUIManager;
      if (!newGameManager.hasJoinedGame() && spectate === false) {
        setStep(TerminalPromptStep.NO_HOME_PLANET);
      } else {
        const browserHasData = !!newGameManager.getHomeCoords();

        if (spectate) {
          terminal.current?.println(
            "Spectate mode need to input the center coords.",
            TerminalTextStyle.Text,
          );
          setStep(TerminalPromptStep.ASK_ADD_ACCOUNT);
          return;
        }

        if (!browserHasData) {
          terminal.current?.println(
            "ERROR: Home coords not found on this browser.",
            TerminalTextStyle.Red,
          );
          setStep(TerminalPromptStep.ASK_ADD_ACCOUNT);
          return;
        }
        terminal.current?.println("Validated Local Data...");
        setStep(TerminalPromptStep.ALL_CHECKS_PASS);
      }
    },
    [ethConnection, contractAddress, mainAccount, spectate],
  );

  const advanceStateFromAskAddAccount = useCallback(
    async (terminal: React.MutableRefObject<TerminalHandle | undefined>) => {
      if (spectate) {
        setStep(TerminalPromptStep.ADD_ACCOUNT);
        return;
      }

      terminal.current?.println(
        "Import account home coordinates? (y/n)",
        TerminalTextStyle.Text,
      );
      terminal.current?.println(
        "If you're importing an account, make sure you know what you're doing.",
      );
      const userInput = await terminal.current?.getInput();
      if (userInput === "y") {
        setStep(TerminalPromptStep.ADD_ACCOUNT);
      } else if (userInput === "n") {
        terminal.current?.println("Try using a different account and reload.");
        setStep(TerminalPromptStep.TERMINATED);
      } else {
        terminal.current?.println("Unrecognized input. Please try again.");
        advanceStateFromAskAddAccount(terminal);
      }
    },
    [spectate],
  );

  const advanceStateFromAddAccount = useCallback(
    async (terminal: React.MutableRefObject<TerminalHandle | undefined>) => {
      const gameUIManager = gameUIManagerRef.current;

      if (gameUIManager) {
        try {
          if (spectate) {
            if (await gameUIManager.addAccount({ x: 0, y: 0 })) {
              terminal.current?.println("Successfully added account.");
              terminal.current?.println("Initializing game...");
              setStep(TerminalPromptStep.ALL_CHECKS_PASS);
            } else {
              throw "Invalid home coordinates.";
            }
          } else {
            terminal.current?.println("x: ", TerminalTextStyle.Blue);
            const x = parseInt((await terminal.current?.getInput()) || "");
            terminal.current?.println("y: ", TerminalTextStyle.Blue);
            const y = parseInt((await terminal.current?.getInput()) || "");
            if (
              Number.isNaN(x) ||
              Number.isNaN(y) ||
              Math.abs(x) > 2 ** 32 ||
              Math.abs(y) > 2 ** 32
            ) {
              throw "Invalid home coordinates.";
            }
            if (await gameUIManager.addAccount({ x, y })) {
              terminal.current?.println("Successfully added account.");
              terminal.current?.println("Initializing game...");
              setStep(TerminalPromptStep.ALL_CHECKS_PASS);
            } else {
              throw "Invalid home coordinates.";
            }
          }
        } catch (e) {
          terminal.current?.println(`ERROR: ${e}`, TerminalTextStyle.Red);
          terminal.current?.println("Please try again.");
        }
      } else {
        terminal.current?.println(
          "ERROR: Game UI Manager not found. Terminating session.",
        );
        setStep(TerminalPromptStep.TERMINATED);
      }
    },
    [spectate],
  );

  const advanceStateFromNoHomePlanet = useCallback(
    async (
      terminal: React.MutableRefObject<TerminalHandle | undefined>,
      { showHelp }: TerminalStateOptions = {
        showHelp: true,
      },
    ) => {
      const gameUIManager = gameUIManagerRef.current;
      if (!gameUIManager) {
        terminal.current?.println(
          "ERROR: Game UI Manager not found. Terminating session.",
          TerminalTextStyle.Red,
        );
        setStep(TerminalPromptStep.TERMINATED);
        return;
      }

      // if (Date.now() / 1000 > gameUIManager.getEndTimeSeconds()) {
      //   terminal.current?.println(
      //     'ERROR: This game has ended. Terminating session.',
      //     TerminalTextStyle.Red
      //   );
      //   setStep(TerminalPromptStep.TERMINATED);
      //   return;
      // }

      let setX = undefined;
      let setY = undefined;

      const params = new URLSearchParams(window.location.search);
      if (params.has("searchCenter")) {
        const parts = params.get("searchCenter")?.split(",");

        if (parts) {
          setX = parseInt(parts[0], 10);
          setY = parseInt(parts[1], 10);
        }
      }

      if (setX && setY) {
        const coords = { x: setX, y: setY };
        const distFromOrigin = Math.sqrt(coords.x ** 2 + coords.y ** 2);
        terminal.current?.println(
          `Spawn coordinates: (${coords.x.toFixed(0)}, ${coords.y.toFixed(0)}) were selected, distance from center: ${distFromOrigin.toFixed(0)}.`,
        );

        gameUIManager
          .getGameManager()
          .on(GameManagerEvent.InitializedPlayer, () => {
            setTimeout(() => {
              setMiniMapOn(false);

              terminal.current?.println("Initializing game...");
              setStep(TerminalPromptStep.ALL_CHECKS_PASS);
            });
          });

        gameUIManager
          .joinGame(
            async (e) => {
              // TODO: Handle 2min timeout error
              setMiniMapOn(false);

              console.error(e);

              terminal.current?.println("Error Joining Game:");
              terminal.current?.println(e.message, TerminalTextStyle.Red);
              terminal.current?.newline();

              console.log(e.message.slice(0, 20));

              if (e.message.slice(0, 20) === "Please enable popups") {
                terminal.current?.print(
                  "Player guide: ",
                  TerminalTextStyle.Pink,
                );

                terminal.current?.printLink(
                  "How to enable popups",
                  () => {
                    window.open(HOW_TO_ENABLE_POPUPS);
                  },
                  TerminalTextStyle.Green,
                );
                terminal.current?.println(
                  " <= New player please check this guide!!!",
                  TerminalTextStyle.Pink,
                );

                terminal.current?.println("");
              } else if (e.message === "transaction reverted") {
                terminal.current?.println(
                  "Please refresh the client, choose another area and try again.",
                  TerminalTextStyle.Pink,
                );

                terminal.current?.println("");
              }

              // terminal.current?.println(
              //   "Don't worry :-) you can get more ETH on Redstone this way 😘",
              //   TerminalTextStyle.Pink
              // );

              // terminal.current?.newline();
              // terminal.current?.printLink(
              //   'Deposit ETH to Redstone',
              //   () => {
              //     window.open(BLOCKCHAIN_BRIDGE);
              //   },
              //   TerminalTextStyle.Pink
              // );
              // terminal.current?.newline();
              // terminal.current?.newline();

              terminal.current?.println("Press [enter] to Try Again:");

              await terminal.current?.getInput();
              return true;
            },
            coords,
            spectate,
          )
          .catch((error: Error) => {
            terminal.current?.println(
              `[ERROR] An error occurred: ${error.toString().slice(0, 10000)}`,
              TerminalTextStyle.Red,
            );
            terminal.current?.println(
              "please refresh client to try again.",
              TerminalTextStyle.Pink,
            );
          });
      } else {
        if (showHelp) {
          terminal.current?.printElement(<BluePillMapGuide />);
        }

        setMiniMapOn(true);
        // let the miniMap component mount
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    },
    [ethConnection, spectate],
  );

  const advanceStateFromAllChecksPass = useCallback(
    async (
      terminal: React.MutableRefObject<TerminalHandle | undefined>,
      showHelp = true,
    ) => {
      if (showHelp) {
        terminal.current?.println("Enter game.", TerminalTextStyle.Green);
        terminal.current?.println("click [enter game] to begin");
      }

      terminal.current?.printElement(
        <PinkButton onClick={enterGame}>Enter Game</PinkButton>,
      );

      return;
    },
    [],
  );

  const advanceStateFromComplete = useCallback(
    async (terminal: React.MutableRefObject<TerminalHandle | undefined>) => {
      const input = (await terminal.current?.getInput()) || "";
      let res = "";
      try {
        // indrect eval call: http://perfectionkills.com/global-eval-what-are-the-options/
        res = (1, eval)(input);
        if (res !== undefined) {
          terminal.current?.println(res.toString(), TerminalTextStyle.Text);
        }
      } catch (e) {
        res = (e as Error).message;
        terminal.current?.println(`ERROR: ${res}`, TerminalTextStyle.Red);
      }
      advanceStateFromComplete(terminal);
    },
    [],
  );

  const advanceStateFromError = useCallback(async () => {
    await neverResolves();
  }, []);

  const advanceStateFromSpectating = useCallback(
    async (terminal: React.MutableRefObject<TerminalHandle | undefined>) => {
      try {
        if (!ethConnection) {
          throw new Error("not logged in");
        }

        setSpectate(true);
        setMiniMapOn(false);
        console.log("specatate:", spectate);
        console.log("isMiniMapOn:", isMiniMapOn);

        setStep(TerminalPromptStep.FETCHING_ETH_DATA);
      } catch (e) {
        console.error(e);
        setStep(TerminalPromptStep.ERROR);
        terminal.current?.print(
          "Network under heavy load. Please refresh the page, and check ",
          TerminalTextStyle.Red,
        );
        terminal.current?.printLink(
          BLOCK_EXPLORER_URL,
          () => {
            window.open(BLOCK_EXPLORER_URL);
          },
          TerminalTextStyle.Red,
        );
        terminal.current?.println("");
        return;
      }
    },
    [ethConnection, isProd, contractAddress, spectate],
  );

  const advanceState = useCallback(
    (terminal: React.MutableRefObject<TerminalHandle | undefined>) => {
      if (browserCompatibleState !== "supported") {
        return;
      }
      if (ethConnection === undefined) {
        return;
      }

      switch (true) {
        case step === TerminalPromptStep.COMPATIBILITY_CHECKS_PASSED:
          advanceStateFromCompatibilityPassed(terminal);
          return;
        case step === TerminalPromptStep.DISPLAY_ACCOUNTS:
          advanceStateFromDisplayAccounts(terminal);
          return;
        case step === TerminalPromptStep.GENERATE_ACCOUNT:
          advanceStateFromGenerateAccount(terminal);
          return;
        case step === TerminalPromptStep.IMPORT_ACCOUNT:
          advanceStateFromImportAccount(terminal);
          return;
        case step === TerminalPromptStep.ACCOUNT_SET:
          advanceStateFromAccountSet(terminal);
          return;
        case step === TerminalPromptStep.ASKING_HAS_WHITELIST_KEY:
          advanceStateFromAskHasWhitelistKey(terminal);
          return;
        case step === TerminalPromptStep.ASKING_WHITELIST_KEY:
          advanceStateFromAskWhitelistKey(terminal);
          return;
        case step === TerminalPromptStep.ASKING_WAITLIST_EMAIL:
          advanceStateFromAskWaitlistEmail(terminal);
          return;
        case step === TerminalPromptStep.ASKING_PLAYER_EMAIL:
          advanceStateFromAskPlayerEmail(terminal);
          return;
        case step === TerminalPromptStep.FETCHING_ETH_DATA:
          advanceStateFromFetchingEthData(terminal);
          return;
        case step === TerminalPromptStep.ASK_ADD_ACCOUNT:
          advanceStateFromAskAddAccount(terminal);
          return;
        case step === TerminalPromptStep.ADD_ACCOUNT:
          advanceStateFromAddAccount(terminal);
          return;
        case step === TerminalPromptStep.NO_HOME_PLANET:
          advanceStateFromNoHomePlanet(terminal);
          return;
        case step === TerminalPromptStep.ALL_CHECKS_PASS:
          advanceStateFromAllChecksPass(terminal);
          return;
        case step === TerminalPromptStep.COMPLETE:
          advanceStateFromComplete(terminal);
          return;
        case step === TerminalPromptStep.ERROR:
          advanceStateFromError();
          return;
        case step === TerminalPromptStep.SPECTATING:
          advanceStateFromSpectating(terminal);
          return;
      }
    },
    [
      step,
      advanceStateFromAccountSet,
      advanceStateFromAddAccount,
      advanceStateFromAllChecksPass,
      advanceStateFromAskAddAccount,
      advanceStateFromAskHasWhitelistKey,
      advanceStateFromAskPlayerEmail,
      advanceStateFromAskWaitlistEmail,
      advanceStateFromAskWhitelistKey,
      advanceStateFromCompatibilityPassed,
      advanceStateFromComplete,
      advanceStateFromDisplayAccounts,
      advanceStateFromError,
      advanceStateFromFetchingEthData,
      advanceStateFromGenerateAccount,
      advanceStateFromImportAccount,
      advanceStateFromNoHomePlanet,
      advanceStateFromSpectating,
      ethConnection,
      browserCompatibleState,
      syncSign,
    ],
  );

  useEffect(() => {
    const uiEmitter = UIEmitter.getInstance();
    uiEmitter.emit(UIEmitterEvent.UIChange);
  }, [initRenderState]);

  useEffect(() => {
    const gameUiManager = gameUIManagerRef.current;
    if (!terminalVisible && gameUiManager) {
      const tutorialManager = TutorialManager.getInstance(gameUiManager);
      tutorialManager.acceptInput(TutorialState.Terminal);
    }
  }, [terminalVisible]);

  useEffect(() => {
    if (terminalHandle.current && topLevelContainer.current) {
      advanceState(terminalHandle);
    }
  }, [terminalHandle, topLevelContainer, advanceState]);

  return (
    <>
      <Wrapper initRender={initRenderState} terminalEnabled={terminalVisible}>
        <GameWindowWrapper
          initRender={initRenderState}
          terminalEnabled={terminalVisible}
        >
          {gameUIManagerRef.current &&
            topLevelContainer.current &&
            gameManager && (
              <TopLevelDivProvider value={topLevelContainer.current}>
                <UIManagerProvider value={gameUIManagerRef.current}>
                  <GameWindowLayout
                    terminalVisible={terminalVisible}
                    setTerminalVisible={setTerminalVisible}
                  />
                </UIManagerProvider>
              </TopLevelDivProvider>
            )}

          <TerminalToggler
            terminalEnabled={terminalVisible}
            setTerminalEnabled={setTerminalVisible}
          />
        </GameWindowWrapper>

        {/** GM Blue Pill*/}

        <TerminalWrapper
          initRender={initRenderState}
          terminalEnabled={terminalVisible}
        >
          <MythicLabelText
            text={`Welcome To ${WORLD_NAME} ${VERSION}`}
            style={{
              fontFamily: "'Start Press 2P', sans-serif",
              display:
                initRenderState !== InitRenderState.COMPLETE ? "block" : "none",
            }}
          />
          <BrowserIssues
            issues={browserIssues}
            state={browserCompatibleState}
          />
          <div>
            {!indexerLoaded && (
              <div
                style={{
                  padding: "20px",
                  background: "rgba(0, 0, 0, 0.8)",
                  borderRadius: "8px",
                  border: "1px solid #ff69b4",
                  color: "#fff",
                  textAlign: "left",
                  margin: "20px 0",
                  width: "500px",
                  maxWidth: "90%",
                }}
              >
                <div
                  style={{
                    fontSize: "24px",
                    marginBottom: "15px",
                    color: "#ff69b4",
                  }}
                >
                  ⚡ INITIALIZING {WORLD_NAME} ⚡
                </div>
                <div style={{ marginBottom: "10px", fontSize: "18px" }}>
                  🔄 Loading game data...
                </div>
                <div style={{ marginBottom: "10px", fontSize: "18px" }}>
                  📊 Current step: {syncProgress.step}
                </div>
                <div style={{ marginBottom: "10px", fontSize: "18px" }}>
                  🎯 Progress: {syncProgress.percentage}%
                </div>
                <div style={{ fontSize: "18px", color: "#ff69b4" }}>
                  ⏳ Please wait, almost there...
                </div>
              </div>
            )}

            {indexerLoaded && !walletLinked && <BluePillWalletButton />}

            {indexerLoaded &&
              walletLinked &&
              !burnerHasFunds &&
              !initRenderState && <BluePillBurnerWallet />}

            {indexerLoaded &&
              walletLinked &&
              burnerHasFunds &&
              !playerRegistered &&
              !initRenderState && <BluePillRegisterPlayer />}
          </div>
          <Terminal
            ref={terminalHandle}
            promptCharacter={">"}
            visible={browserCompatibleState === "supported"}
            useCaretElement={initRenderState !== InitRenderState.COMPLETE}
          />
        </TerminalWrapper>

        <div ref={topLevelContainer}></div>
        <div>
          {isMiniMapOn && (
            <div style={{ position: "fixed", right: "100px", top: "100px" }}>
              <MiniMap ref={miniMapRef} />
            </div>
          )}
        </div>
      </Wrapper>
    </>
  );
}
