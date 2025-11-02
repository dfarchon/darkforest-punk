import type { LocationId } from "@df/types";
import React, { useCallback } from "react";

import { BluePane } from "../Panes/BluePane";
import {
  BroadcastPane,
  BroadcastPaneHelpContent,
} from "../Panes/BroadcastPane";
import { BuyArtifactPane } from "../Panes/BuyArtifactPane";
import {
  ManagePlanetArtifactsHelpContent,
  ManagePlanetArtifactsPane,
  PlanetInfoHelpContent,
  PlanetMaterialsHelpContent,
} from "../Panes/ManagePlanetArtifacts/ManagePlanetArtifactsPane";
import { PlanetInfoPane } from "../Panes/PlanetInfoPane";
import { PlanetMaterialsPane } from "../Panes/PlanetMaterialsPane";
import {
  UpgradeDetailsPane,
  UpgradeDetailsPaneHelpContent,
} from "../Panes/UpgradeDetailsPane";
import { FoundryUpgradePane } from "../Panes/FoundryUpgradePane";
import {
  TOGGLE_BLUE_PANE,
  TOGGLE_BROADCAST_PANE,
  TOGGLE_BUY_ARTIFACT_PANE,
  TOGGLE_HAT_PANE,
  TOGGLE_MATERIALS_PANE,
  TOGGLE_PLANET_ARTIFACTS_PANE,
  TOGGLE_PLANET_INFO_PANE,
  TOGGLE_UPGRADES_PANE,
} from "../Utils/ShortcutConstants";
import type { ModalHandle } from "../Views/ModalPane";
import { MaybeShortcutButton } from "./MaybeShortcutButton";

export function OpenPaneButton({
  modal,
  title,
  element,
  helpContent,
  shortcut,
}: {
  modal: ModalHandle;
  title: string;
  element: () => React.ReactElement;
  helpContent?: React.ReactElement;
  shortcut?: string;
}) {
  const open = useCallback(() => {
    modal.push({
      title,
      element,
      helpContent,
    });
  }, [title, element, helpContent, modal]);

  return (
    <MaybeShortcutButton
      size="stretch"
      onClick={open}
      onShortcutPressed={open}
      shortcutKey={shortcut}
      shortcutText={shortcut}
    >
      {title}
    </MaybeShortcutButton>
  );
}

export function OpenBuyArtifactPaneButton({
  modal,
  planetId,
}: {
  modal: ModalHandle;
  planetId: LocationId | undefined;
}) {
  return (
    <OpenPaneButton
      modal={modal}
      title="Buy Artifact"
      shortcut={TOGGLE_BUY_ARTIFACT_PANE}
      element={() => (
        <BuyArtifactPane modal={modal} initialPlanetId={planetId} />
      )}
    />
  );
}

export function OpenBroadcastPaneButton({
  modal,
  planetId,
}: {
  modal: ModalHandle;
  planetId: LocationId | undefined;
}) {
  return (
    <OpenPaneButton
      modal={modal}
      title="Broadcast"
      shortcut={TOGGLE_BROADCAST_PANE}
      element={() => <BroadcastPane modal={modal} initialPlanetId={planetId} />}
      helpContent={BroadcastPaneHelpContent()}
    />
  );
}

export function OpenUpgradeDetailsPaneButton({
  modal,
  planetId,
}: {
  modal: ModalHandle;
  planetId: LocationId | undefined;
}) {
  return (
    <OpenPaneButton
      modal={modal}
      title="Upgrade"
      shortcut={TOGGLE_UPGRADES_PANE}
      element={() => (
        <UpgradeDetailsPane modal={modal} initialPlanetId={planetId} />
      )}
      helpContent={UpgradeDetailsPaneHelpContent()}
    />
  );
}

export function OpenManagePlanetArtifactsButton({
  modal,
  planetId,
}: {
  modal: ModalHandle;
  planetId: LocationId | undefined;
}) {
  return (
    <OpenPaneButton
      modal={modal}
      title="Inventory"
      shortcut={TOGGLE_PLANET_ARTIFACTS_PANE}
      element={() => (
        <ManagePlanetArtifactsPane modal={modal} initialPlanetId={planetId} />
      )}
      helpContent={ManagePlanetArtifactsHelpContent()}
    />
  );
}

export function OpenPlanetInfoButton({
  modal,
  planetId,
}: {
  modal: ModalHandle;
  planetId: LocationId | undefined;
}) {
  return (
    <OpenPaneButton
      modal={modal}
      title="Info" // Info / Claim
      shortcut={TOGGLE_PLANET_INFO_PANE}
      element={() => (
        <PlanetInfoPane initialPlanetId={planetId} modal={modal} />
      )}
      helpContent={PlanetInfoHelpContent()}
    />
  );
}

export function OpenBlueButton({
  modal,
  planetId,
}: {
  modal: ModalHandle;
  planetId: LocationId | undefined;
}) {
  return (
    <OpenPaneButton
      modal={modal}
      title="Blue"
      shortcut={TOGGLE_BLUE_PANE}
      element={() => <BluePane initialPlanetId={planetId} modal={modal} />}
      helpContent={PlanetInfoHelpContent()}
    />
  );
}

export function OpenMaterialsPaneButton({
  modal,
  planetId,
}: {
  modal: ModalHandle;
  planetId: LocationId | undefined;
}) {
  return (
    <OpenPaneButton
      modal={modal}
      title="Materials"
      shortcut={TOGGLE_MATERIALS_PANE}
      element={() => (
        <PlanetMaterialsPane modal={modal} initialPlanetId={planetId} />
      )}
      helpContent={PlanetMaterialsHelpContent()}
    />
  );
}

export function OpenFoundryUpgradePaneButton({
  modal,
  planetId,
}: {
  modal: ModalHandle;
  planetId: LocationId | undefined;
}) {
  return (
    <OpenPaneButton
      modal={modal}
      title="Upgrade Foundry"
      element={() => (
        <FoundryUpgradePane modal={modal} initialPlanetId={planetId} />
      )}
    />
  );
}
