import { ModalName } from "@df/types";
import React, { useState } from "react";
import styled from "styled-components";

import type { Hook } from "../../_types/global/GlobalTypes";
import { BorderlessPane, EmSpacer } from "../Components/CoreUI";
import { DFZIndex } from "../Utils/constants";
import {
  TOGGLE_GUILD_PANE,
  TOGGLE_HELP_PANE,
  TOGGLE_PLUGINS_PANE,
  TOGGLE_SETTINGS_PANE,
  TOGGLE_TRADE_PANE,
  TOGGLE_TRANSACTIONS_PANE,
  TOGGLE_AI_CHAT_PANE,
  TOGGLE_WALLET_PANE,
  TOGGLE_YOUR_ARTIFACTS_PANE,
  TOGGLE_YOUR_PLANETS_DEX_PANE,
} from "../Utils/ShortcutConstants";
import { ModalToggleButton } from "./ModalIcon";

export function SidebarPane({
  aiChatHook,
  walletHook,
  tradeHook,
  settingsHook,
  helpHook,
  pluginsHook,
  yourArtifactsHook,
  planetdexHook,
  transactionLogHook,
  guildHook,
}: {
  aiChatHook: Hook<boolean>;
  walletHook: Hook<boolean>;
  tradeHook: Hook<boolean>;
  settingsHook: Hook<boolean>;
  helpHook: Hook<boolean>;
  pluginsHook: Hook<boolean>;
  yourArtifactsHook: Hook<boolean>;
  planetdexHook: Hook<boolean>;
  transactionLogHook: Hook<boolean>;
  guildHook: Hook<boolean>;
}) {
  const [sidebarHovered, setSidebarHovered] = useState<boolean>(false);

  return (
    <WindowTogglesPaneContainer
      onMouseEnter={() => setSidebarHovered(true)}
      onMouseLeave={() => setSidebarHovered(false)}
    >
      <BorderlessPane
        style={{ zIndex: sidebarHovered ? DFZIndex.Tooltip : undefined }}
      >
        {/* <ModalToggleButton
          modal={ModalName.AIChat}
          hook={aiChatHook}
          text={sidebarHovered ? "Sophons" : undefined}
          size="stretch"
          shortcutKey={TOGGLE_AI_CHAT_PANE}
          shortcutText={sidebarHovered ? TOGGLE_AI_CHAT_PANE : undefined}
        />
        <EmSpacer height={0.5} /> */}
        <ModalToggleButton
          modal={ModalName.Wallet}
          hook={walletHook}
          text={sidebarHovered ? "Wallet & Trade" : undefined}
          size="stretch"
          shortcutKey={TOGGLE_WALLET_PANE}
          shortcutText={sidebarHovered ? TOGGLE_WALLET_PANE : undefined}
        />
        <EmSpacer height={0.5} />

        {/* PUNK  */}
        {/* <ModalToggleButton
          modal={ModalName.Trade}
          hook={tradeHook}
          text={sidebarHovered ? "Trade" : undefined}
          size="stretch"
          shortcutKey={TOGGLE_TRADE_PANE}
          shortcutText={sidebarHovered ? TOGGLE_TRADE_PANE : undefined}
        />
        <EmSpacer height={0.5} /> */}

        <ModalToggleButton
          modal={ModalName.Help}
          hook={helpHook}
          text={sidebarHovered ? "Help" : undefined}
          size="stretch"
          shortcutKey={TOGGLE_HELP_PANE}
          shortcutText={sidebarHovered ? TOGGLE_HELP_PANE : undefined}
        />

        <EmSpacer height={0.5} />
        <ModalToggleButton
          modal={ModalName.Settings}
          hook={settingsHook}
          text={sidebarHovered ? "Settings" : undefined}
          size="stretch"
          shortcutKey={TOGGLE_SETTINGS_PANE}
          shortcutText={sidebarHovered ? TOGGLE_SETTINGS_PANE : undefined}
        />

        <EmSpacer height={0.5} />
        <ModalToggleButton
          modal={ModalName.Plugins}
          hook={pluginsHook}
          text={sidebarHovered ? "Plugins" : undefined}
          size="stretch"
          shortcutKey={TOGGLE_PLUGINS_PANE}
          shortcutText={sidebarHovered ? TOGGLE_PLUGINS_PANE : undefined}
        />
        <EmSpacer height={0.5} />
        <ModalToggleButton
          modal={ModalName.YourArtifacts}
          hook={yourArtifactsHook}
          text={sidebarHovered ? "Your Inventory" : undefined}
          size="stretch"
          shortcutKey={TOGGLE_YOUR_ARTIFACTS_PANE}
          shortcutText={sidebarHovered ? TOGGLE_YOUR_ARTIFACTS_PANE : undefined}
        />
        <EmSpacer height={0.5} />
        <ModalToggleButton
          modal={ModalName.PlanetDex}
          hook={planetdexHook}
          text={sidebarHovered ? "Your Planets" : undefined}
          size="stretch"
          shortcutKey={TOGGLE_YOUR_PLANETS_DEX_PANE}
          shortcutText={
            sidebarHovered ? TOGGLE_YOUR_PLANETS_DEX_PANE : undefined
          }
        />
        <EmSpacer height={0.5} />
        <ModalToggleButton
          modal={ModalName.TransactionLog}
          hook={transactionLogHook}
          text={sidebarHovered ? "Transaction Log" : undefined}
          size="stretch"
          shortcutKey={TOGGLE_TRANSACTIONS_PANE}
          shortcutText={sidebarHovered ? TOGGLE_TRANSACTIONS_PANE : undefined}
        />

        <EmSpacer height={0.5} />
        <ModalToggleButton
          modal={ModalName.GuildContextPane}
          hook={guildHook}
          text={sidebarHovered ? "Guild" : undefined}
          size="stretch"
          shortcutKey={TOGGLE_GUILD_PANE}
          shortcutText={sidebarHovered ? TOGGLE_GUILD_PANE : undefined}
        />
      </BorderlessPane>
    </WindowTogglesPaneContainer>
  );
}

const WindowTogglesPaneContainer = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
  height: 100vh;
  position: absolute;
  top: 0;
  left: 0;
`;
