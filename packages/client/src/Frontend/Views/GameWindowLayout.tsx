import type { GameManager } from "@backend/GameLogic/GameManager";
import type { ModalId } from "@df/types";
import { ModalName, Setting } from "@df/types";
import { AmbiencePane } from "@frontend/Panes/AmbiencePane";
import { useCallback, useEffect, useState } from "react";
import styled from "styled-components";

import { BorderlessPane } from "../Components/CoreUI";
import {
  CanvasContainer,
  CanvasWrapper,
  MainWindow,
  UpperLeft,
  WindowWrapper,
} from "../Components/GameWindowComponents";
import ControllableCanvas from "../Game/ControllableCanvas";
import { AIChatPane } from "../Panes/AIChatPane";
import { ArtifactHoverPane } from "../Panes/ArtifactHoverPane";
import { CoordsPane } from "../Panes/CoordsPane";
import { DiagnosticsPane } from "../Panes/DiagnosticsPane";
import { ExplorePane } from "../Panes/ExplorePane";
import GuildContextPane from "../Panes/GuildPane";
import { HelpPane } from "../Panes/HelpPane";
import { HotkeysArtShipPane, HotkeysMainLinePane } from "../Panes/HotKeyPane";
import { HoverPlanetPane } from "../Panes/HoverPlanetPane";
import OnboardingPane from "../Panes/OnboardingPane";
import { PlanetContextPane } from "../Panes/PlanetContextPane";
import { PlanetDexPane } from "../Panes/PlanetDexPane";
import { PlayerArtifactsPane } from "../Panes/PlayerArtifactsPane";
import { PluginLibraryPane } from "../Panes/PluginLibraryPane";
import { PrivatePane } from "../Panes/PrivatePane";
import { SettingsPane } from "../Panes/SettingsPane";
import { TradePane } from "../Panes/TradePane";
import { TransactionLogPane } from "../Panes/TransactionLogPane";
import { TutorialPane } from "../Panes/TutorialPane";
import { TwitterVerifyPane } from "../Panes/TwitterVerifyPane";
import { WalletPane } from "../Panes/WalletPane";
import { ZoomPane } from "../Panes/ZoomPane";
import { useSelectedPlanet, useUIManager } from "../Utils/AppHooks";
import { useOnUp } from "../Utils/KeyEmitters";
import { useBooleanSetting } from "../Utils/SettingsHooks";
import {
  TOGGLE_AI_CHAT_PANE,
  TOGGLE_DIAGNOSTICS_PANE,
  TOGGLE_HELP_PANE,
  TOGGLE_HOTKEY_VISIBLE,
  TOGGLE_PANE_VISIBLE,
  TOGGLE_PLUGINS_PANE,
  TOGGLE_SETTINGS_PANE,
  TOGGLE_TERMINAL,
  TOGGLE_TRADE_PANE,
  TOGGLE_TRANSACTIONS_PANE,
  TOGGLE_YOUR_ARTIFACTS_PANE,
  TOGGLE_YOUR_PLANETS_DEX_PANE,
} from "../Utils/ShortcutConstants";
import { NotificationsPane } from "./Notifications";
import { SidebarPane } from "./SidebarPane";
import { TopBar } from "./TopBar";

export function GameWindowLayout({
  terminalVisible,
  setTerminalVisible,
  spectate,
}: {
  terminalVisible: boolean;
  setTerminalVisible: (visible: boolean) => void;
  spectate?: boolean;
}) {
  const uiManager = useUIManager();
  const modalManager = uiManager.getModalManager();
  const modalPositions = modalManager.getModalPositions();

  /**
   * We use the existence of a window position for a given modal as an indicator
   * that it should be opened on page load. This is to satisfy the feature of
   * peristent modal positions across browser sessions for a given account.
   */
  const isModalOpen = useCallback(
    (modalId: ModalId) => {
      const pos = modalPositions.get(modalId);
      if (pos) {
        return pos.state !== "closed";
      } else {
        return false;
      }
    },
    [modalPositions],
  );

  const [paneVisible, setPaneVisible] = useState<boolean>(true);
  const [bottomHotkeyVisible, setBottomHotkeyVisible] = useState<boolean>(true);

  const [helpVisible, setHelpVisible] = useState<boolean>(
    isModalOpen(ModalName.Help),
  );

  const [transactionLogVisible, setTransactionLogVisible] = useState<boolean>(
    isModalOpen(ModalName.TransactionLog),
  );

  const [guildVisible, setGuildVisible] = useState<boolean>(
    isModalOpen(ModalName.GuildContextPane),
  );
  const [planetdexVisible, setPlanetdexVisible] = useState<boolean>(
    isModalOpen(ModalName.PlanetDex),
  );
  const [playerArtifactsVisible, setPlayerArtifactsVisible] = useState<boolean>(
    isModalOpen(ModalName.YourArtifacts),
  );
  const [twitterVerifyVisible, setTwitterVerifyVisible] = useState<boolean>(
    isModalOpen(ModalName.TwitterVerify),
  );

  const [aiChatVisible, setAIChatVisible] = useState<boolean>(
    isModalOpen(ModalName.AIChat),
  );

  const [walletVisible, setWalletVisible] = useState<boolean>(
    isModalOpen(ModalName.Wallet),
  );

  const [tradeVisible, setTradeVisible] = useState<boolean>(
    isModalOpen(ModalName.Trade),
  );
  const [settingsVisible, setSettingsVisible] = useState<boolean>(
    isModalOpen(ModalName.Settings),
  );
  const [privateVisible, setPrivateVisible] = useState<boolean>(
    isModalOpen(ModalName.Private),
  );
  const [pluginsVisible, setPluginsVisible] = useState<boolean>(
    isModalOpen(ModalName.Plugins),
  );
  const [diagnosticsVisible, setDiagnosticsVisible] = useState<boolean>(
    isModalOpen(ModalName.Diagnostics),
  );

  const [modalsContainer, setModalsContainer] = useState<
    HTMLDivElement | undefined
  >();
  const modalsContainerCB = useCallback((node) => {
    setModalsContainer(node);
  }, []);
  const [onboardingVisible, setOnboardingVisible] = useBooleanSetting(
    uiManager,
    Setting.NewPlayer,
  );
  const tutorialHook = useBooleanSetting(uiManager, Setting.TutorialOpen);
  const selected = useSelectedPlanet(uiManager).value;
  const [selectedPlanetVisible, setSelectedPlanetVisible] =
    useState<boolean>(!!selected);

  const [userTerminalVisibleSetting, setUserTerminalVisibleSetting] =
    useBooleanSetting(uiManager, Setting.TerminalVisible);

  const [userHotKeysVisibleSetting] = useBooleanSetting(
    uiManager,
    Setting.DisableDefaultShortcuts,
  );
  const [userExperimentalVisibleSetting] = useBooleanSetting(
    uiManager,
    Setting.ExperimentalFeatures,
  );

  const [userPaneVisibleSetting, setUserPaneVisibleSetting] = useBooleanSetting(
    uiManager,
    Setting.PaneVisible,
  );
  const [userBottomHotkeyVisibleSetting, setUserBottomHotkeyVisibleSetting] =
    useBooleanSetting(uiManager, Setting.BottomHotkeyVisible);
  useEffect(() => {
    uiManager.setOverlayContainer(modalsContainer);
  }, [uiManager, modalsContainer]);

  const account = uiManager.getAccount();

  //Terminal
  useEffect(() => {
    if (uiManager.getAccount()) {
      setTerminalVisible(uiManager.getBooleanSetting(Setting.TerminalVisible));
    }
  }, [account, uiManager, setTerminalVisible]);

  useEffect(() => {
    if (userTerminalVisibleSetting !== terminalVisible) {
      setUserTerminalVisibleSetting(terminalVisible);
    }
  }, [
    userTerminalVisibleSetting,
    setUserTerminalVisibleSetting,
    terminalVisible,
  ]);

  //pane
  useEffect(() => {
    if (uiManager.getAccount()) {
      setPaneVisible(uiManager.getBooleanSetting(Setting.PaneVisible));
    }
  }, [account, uiManager, setPaneVisible]);

  useEffect(() => {
    if (userPaneVisibleSetting !== paneVisible) {
      setUserPaneVisibleSetting(paneVisible);
    }
  }, [paneVisible, userPaneVisibleSetting, setUserPaneVisibleSetting]);

  //bottom hotkeys
  useEffect(() => {
    if (uiManager.getAccount()) {
      setBottomHotkeyVisible(
        uiManager.getBooleanSetting(Setting.BottomHotkeyVisible),
      );
    }
  }, [account, uiManager, setBottomHotkeyVisible]);

  useEffect(() => {
    if (userBottomHotkeyVisibleSetting !== bottomHotkeyVisible) {
      setUserBottomHotkeyVisibleSetting(bottomHotkeyVisible);
    }
  }, [
    bottomHotkeyVisible,
    userBottomHotkeyVisibleSetting,
    setUserBottomHotkeyVisibleSetting,
  ]);

  useEffect(
    () => setSelectedPlanetVisible(!!selected),
    [selected, setSelectedPlanetVisible],
  );

  useOnUp(
    TOGGLE_DIAGNOSTICS_PANE,
    useCallback(() => {
      setDiagnosticsVisible((value) => !value);
    }, [setDiagnosticsVisible]),
  );
  useOnUp(
    TOGGLE_TERMINAL,
    useCallback(() => {
      setTerminalVisible(!terminalVisible);
    }, [terminalVisible, setTerminalVisible]),
  );

  useOnUp(
    TOGGLE_PANE_VISIBLE,
    useCallback(() => {
      setPaneVisible(!paneVisible);
    }, [paneVisible, setPaneVisible]),
  );

  useOnUp(
    TOGGLE_HOTKEY_VISIBLE,
    useCallback(() => {
      setBottomHotkeyVisible(!bottomHotkeyVisible);
    }, [bottomHotkeyVisible, setBottomHotkeyVisible]),
  );

  useOnUp(
    TOGGLE_TRADE_PANE,
    useCallback(() => {
      if (paneVisible) {
        return;
      }
      setTradeVisible(!tradeVisible);
    }, [paneVisible, tradeVisible, setTradeVisible]),
  );

  useOnUp(
    TOGGLE_AI_CHAT_PANE,
    useCallback(() => {
      if (paneVisible) {
        return;
      }
      setTradeVisible(!aiChatVisible);
    }, [paneVisible, aiChatVisible, setAIChatVisible]),
  );

  useOnUp(
    TOGGLE_HELP_PANE,
    useCallback(() => {
      if (paneVisible) {
        return;
      }
      setHelpVisible(!helpVisible);
    }, [paneVisible, helpVisible, setHelpVisible]),
  );

  useOnUp(
    TOGGLE_SETTINGS_PANE,
    useCallback(() => {
      if (paneVisible) {
        return;
      }
      setSettingsVisible(!settingsVisible);
    }, [paneVisible, settingsVisible, setSettingsVisible]),
  );

  useOnUp(
    TOGGLE_PLUGINS_PANE,
    useCallback(() => {
      if (paneVisible) {
        return;
      }
      setPluginsVisible(!pluginsVisible);
    }, [paneVisible, pluginsVisible, setPluginsVisible]),
  );

  // useOnUp(
  //   TOGGLE_YOUR_ARTIFACTS_PANE,
  //   useCallback(() => {
  //     if (paneVisible) {
  //       return;
  //     }
  //     setPlayerArtifactsVisible(!playerArtifactsVisible);
  //   }, [paneVisible, playerArtifactsVisible, setPlayerArtifactsVisible]),
  // );

  useOnUp(
    TOGGLE_YOUR_PLANETS_DEX_PANE,
    useCallback(() => {
      if (paneVisible) {
        return;
      }
      setPlanetdexVisible(!planetdexVisible);
    }, [paneVisible, planetdexVisible, setPlanetdexVisible]),
  );

  useOnUp(
    TOGGLE_TRANSACTIONS_PANE,
    useCallback(() => {
      if (paneVisible) {
        return;
      }
      setTransactionLogVisible(!transactionLogVisible);
    }, [paneVisible, transactionLogVisible, setTransactionLogVisible]),
  );

  return (
    <WindowWrapper>
      <TopBarPaneContainer>
        {paneVisible && (
          <BorderlessPane>
            <TopBar
              twitterVerifyHook={[
                twitterVerifyVisible,
                setTwitterVerifyVisible,
              ]}
            />
          </BorderlessPane>
        )}
      </TopBarPaneContainer>

      {/* all modals rendered into here */}
      <div ref={modalsContainerCB}>
        <HelpPane visible={helpVisible} onClose={() => setHelpVisible(false)} />
        <TransactionLogPane
          visible={transactionLogVisible}
          onClose={() => setTransactionLogVisible(false)}
        />
        <PlanetDexPane
          visible={planetdexVisible}
          onClose={() => setPlanetdexVisible(false)}
        />
        <TwitterVerifyPane
          visible={twitterVerifyVisible}
          onClose={() => setTwitterVerifyVisible(false)}
        />

        {/* <AIChatPane
          visible={aiChatVisible}
          onClose={() => setAIChatVisible(false)}
        /> */}

        <WalletPane
          visible={walletVisible}
          onClose={() => setWalletVisible(false)}
        />
        {/* PUNK */}
        {/* <TradePane
          visible={tradeVisible}
          onClose={() => setTradeVisible(false)}
        /> */}
        <SettingsPane
          ethConnection={uiManager.getEthConnection()}
          visible={settingsVisible}
          onClose={() => setSettingsVisible(false)}
          onOpenPrivate={() => setPrivateVisible(true)}
        />
        <PrivatePane
          visible={privateVisible}
          onClose={() => setPrivateVisible(false)}
        />
        <PlayerArtifactsPane
          visible={playerArtifactsVisible}
          onClose={() => setPlayerArtifactsVisible(false)}
        />
        <PlanetContextPane
          visible={selectedPlanetVisible}
          onClose={() => setSelectedPlanetVisible(false)}
        />
        <DiagnosticsPane
          visible={diagnosticsVisible}
          onClose={() => setDiagnosticsVisible(false)}
        />

        <GuildContextPane
          visible={guildVisible}
          onClose={() => setGuildVisible(false)}
        />

        {modalsContainer && (
          <PluginLibraryPane
            modalsContainer={modalsContainer}
            gameUIManager={uiManager}
            visible={pluginsVisible}
            onClose={() => setPluginsVisible(false)}
          />
        )}
      </div>

      {!spectate && (
        <OnboardingPane
          visible={onboardingVisible}
          onClose={() => setOnboardingVisible(false)}
        />
      )}

      <MainWindow>
        <CanvasContainer>
          <UpperLeft>
            <AmbiencePane />
            {paneVisible && <ZoomPane />}
          </UpperLeft>

          {paneVisible && (
            <SidebarPane
              aiChatHook={[aiChatVisible, setAIChatVisible]}
              walletHook={[walletVisible, setWalletVisible]}
              tradeHook={[tradeVisible, setTradeVisible]}
              transactionLogHook={[
                transactionLogVisible,
                setTransactionLogVisible,
              ]}
              settingsHook={[settingsVisible, setSettingsVisible]}
              helpHook={[helpVisible, setHelpVisible]}
              pluginsHook={[pluginsVisible, setPluginsVisible]}
              yourArtifactsHook={[
                playerArtifactsVisible,
                setPlayerArtifactsVisible,
              ]}
              planetdexHook={[planetdexVisible, setPlanetdexVisible]}
              guildHook={[guildVisible, setGuildVisible]}
            />
          )}
          <CanvasWrapper>
            <ControllableCanvas />
          </CanvasWrapper>
          <NotificationsPane />
          {paneVisible && <CoordsPane />}
          {paneVisible && <ExplorePane />}
          {bottomHotkeyVisible &&
            !userHotKeysVisibleSetting &&
            userExperimentalVisibleSetting && (
              <>
                {/* <HotkeysArtShipPane
                  selectedPlanetVisible={selectedPlanetVisible}
                /> */}
                <HotkeysMainLinePane
                  selectedPlanetVisible={selectedPlanetVisible}
                />
              </>
            )}

          <HoverPlanetPane />
          <ArtifactHoverPane />
          {!spectate && <TutorialPane tutorialHook={tutorialHook} />}
        </CanvasContainer>
      </MainWindow>
    </WindowWrapper>
  );
}

const TopBarPaneContainer = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
  width: 100vw;
  position: absolute;
  top: 0;
  left: 0;
`;
