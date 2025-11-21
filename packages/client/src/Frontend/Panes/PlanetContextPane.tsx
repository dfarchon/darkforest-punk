import { EMPTY_ADDRESS } from "@df/constants";
import type { Planet } from "@df/types";
import { ModalName, PlanetType } from "@df/types";
import React, { useCallback, useEffect, useMemo } from "react";

import type { GameUIManager } from "../../Backend/GameLogic/GameUIManager";
import type { Wrapper } from "../../Backend/Utils/Wrapper";
import { CapturePlanetButton } from "../Components/CapturePlanetButton";
import { VerticalSplit } from "../Components/CoreUI";
import { MineArtifactButton } from "../Components/MineArtifactButton";
import { OpenBlueButton } from "../Components/OpenBlueButton";
import { OpenDropBombButton } from "../Components/OpenDropBombButton";
import { OpenHatPaneButton } from "../Components/OpenHatPaneButton";
import { OpenKardashevButton } from "../Components/OpenKardashevButton";
import {
  OpenBroadcastPaneButton,
  OpenManagePlanetArtifactsButton,
  OpenMaterialsPaneButton,
  OpenPlanetInfoButton,
  OpenUpgradeDetailsPaneButton,
} from "../Components/OpenPaneButtons";
import { OpenPinkButton } from "../Components/OpenPinkButton";
import { snips } from "../Styles/dfstyles";
import { useAccount, useSelectedPlanet, useUIManager } from "../Utils/AppHooks";
import { useEmitterSubscribe } from "../Utils/EmitterHooks";
import { useOnUp } from "../Utils/KeyEmitters";
import {
  EXIT_PANE,
  TOGGLE_ABANDON,
  TOGGLE_SEND,
} from "../Utils/ShortcutConstants";
import UIEmitter, { UIEmitterEvent } from "../Utils/UIEmitter";
import { ManageJunkButton } from "../Views/ManageJunkButton";
import type { ModalHandle } from "../Views/ModalPane";
import { ModalPane } from "../Views/ModalPane";
import { PlanetCard, PlanetCardTitle } from "../Views/PlanetCard";
import {
  getNotifsForPlanet,
  PlanetNotifications,
} from "../Views/PlanetNotifications";
import { SendResources } from "../Views/SendResources";
import { WithdrawSilver } from "../Views/WithdrawSilver";

export const PlanetPaneName = {
  Capture: "Capture",
  Upgrade: "Upgrade",
  Boardcast: "Boardcast",
  Info: "Info",
  BuyArtifact: "BuyArtifact",
  Artifacts: "Artifacts",
  DropBomb: "DropBomb",
  Pink: "Pink",
  Kardashev: "Kardashev",
  Blue: "Blue",
  Hat: "Hat",
};

function PlanetContextPaneContent({
  modal,
  planet,
  uiManager,
  onToggleSendForces,
  onToggleAbandon,
}: {
  modal: ModalHandle;
  planet: Wrapper<Planet | undefined>;
  uiManager: GameUIManager;
  onToggleSendForces: () => void;
  onToggleAbandon: () => void;
}) {
  const account = useAccount(uiManager);
  const gameManager = uiManager.getGameManager();
  const notifs = useMemo(
    () => getNotifsForPlanet(planet.value, account, gameManager),
    [planet, account, gameManager],
  );

  const canDelegate = gameManager.checkDelegateCondition(
    planet.value?.owner,
    account,
  );

  const owned = planet.value?.owner === account || canDelegate;

  useEffect(() => {
    if (!planet.value) {
      modal.popAll();
    }
  }, [planet.value, modal]);

  const p = planet.value;

  // const burned =
  //   p && p.burnOperator !== undefined && p.burnOperator !== EMPTY_ADDRESS;
  // const kardasheved =
  //   p &&
  //   p.kardashevOperator !== undefined &&
  //   p.kardashevOperator !== EMPTY_ADDRESS;

  const shouldShowAddJunkButton = useMemo(() => {
    if (!p) {
      return false;
    }
    if (p.junkOwner === EMPTY_ADDRESS && p.owner === account) return true;
    else if (p.owner === account && p.junkOwner !== account) return true;
    else return false;
  }, [p, account]);

  const showShowClearJunkButton = useMemo(() => {
    if (!p) {
      return false;
    }
    if (p.junkOwner === account) return true;
    else return false;
  }, [p, account]);

  const gt3 = p && p.planetLevel >= 3;

  const pinkZonePassed = useMemo(() => {
    return p && uiManager.checkPlanetCanPink(p.locationId);
  }, [p]);

  // const blueZonePassed = useMemo(() => {
  //   return p && uiManager.checkPlanetCanBlue(p.locationId);
  // }, [p]);

  // let captureRow = null;
  // if (!p?.destroyed && !p?.frozen && uiManager.captureZonesEnabled) {
  //   captureRow = (
  //     <CapturePlanetButton
  //       planetWrapper={planet}
  //       key={PlanetPaneName.Capture}
  //     />
  //   );
  // }

  let upgradeRow = null;
  if (
    !p?.destroyed &&
    !p?.frozen &&
    owned &&
    (p?.planetType === PlanetType.PLANET ||
      p?.planetType === PlanetType.STARBASE ||
      p?.planetType === PlanetType.SILVER_MINE)
  ) {
    upgradeRow = (
      <OpenUpgradeDetailsPaneButton
        modal={modal}
        planetId={p?.locationId}
        key={PlanetPaneName.Upgrade}
      />
    );
  }

  const boardcastRow = (
    <OpenBroadcastPaneButton
      modal={modal}
      planetId={p?.locationId}
      key={PlanetPaneName.Boardcast}
    />
  );
  let infoRow = null;
  if (!p?.destroyed && !p?.frozen) {
    infoRow = <OpenPlanetInfoButton modal={modal} planetId={p?.locationId} />;
  }

  let materialsRow = null;
  if (!p?.destroyed && !p?.frozen) {
    materialsRow = (
      <OpenMaterialsPaneButton modal={modal} planetId={p?.locationId} />
    );
  }

  let artifactsRow = null;
  if (!p?.destroyed && !p?.frozen) {
    artifactsRow = (
      <OpenManagePlanetArtifactsButton modal={modal} planetId={p?.locationId} />
    );
  }

  // let hatRow = null;
  // if (!p?.destroyed && !p?.frozen && owned) {
  //   hatRow = (
  //     <OpenHatPaneButton
  //       modal={modal}
  //       planetId={p?.locationId}
  //       key={PlanetPaneName.Hat}
  //     />
  //   );
  // }

  // let dropBombRow = null;
  // if (!p?.destroyed && !p?.frozen && owned && gt3 && !burned) {
  //   dropBombRow = (
  //     <OpenDropBombButton
  //       modal={modal}
  //       planetId={p?.locationId}
  //       key={PlanetPaneName.DropBomb}
  //     />
  //   );
  // }

  let pinkRow = null;
  if (!p?.destroyed && !p?.frozen && pinkZonePassed) {
    pinkRow = (
      <OpenPinkButton
        modal={modal}
        planetId={p?.locationId}
        key={PlanetPaneName.Pink}
      />
    );
  }

  // let kardashevRow = null;
  // if (!p?.destroyed && !p?.frozen && owned && gt3 && !kardasheved) {
  //   kardashevRow = (
  //     <OpenKardashevButton
  //       modal={modal}
  //       planetId={p?.locationId}
  //       key={PlanetPaneName.Kardashev}
  //     />
  //   );
  // }

  // let blueRow = null;
  // if (!p?.destroyed && !p?.frozen && gt3 && owned && blueZonePassed) {
  //   blueRow = (
  //     <OpenBlueButton
  //       modal={modal}
  //       planetId={p?.locationId}
  //       key={PlanetPaneName.Blue}
  //     />
  //   );
  // }

  // let buyArtifactRow = null;
  // if (!p?.destroyed && !p?.frozen && owned) {
  // buyArtifactRow = <OpenBuyArtifactPaneButton modal={modal}
  // planetId={p?.locationId} key={PlanetPaneName.BuyArtifact} />;
  // }

  const rows = [];
  if (upgradeRow) {
    rows.push(upgradeRow);
  }
  if (boardcastRow) {
    rows.push(boardcastRow);
  }
  if (infoRow) {
    rows.push(infoRow);
  }
  if (materialsRow) {
    rows.push(materialsRow);
  }
  // if (buyArtifactRow) rows.push(buyArtifactRow);
  if (artifactsRow) {
    rows.push(artifactsRow);
  }

  // if (dropBombRow) {
  //   rows.push(dropBombRow);
  // }
  if (pinkRow) {
    rows.push(pinkRow);
  }
  // if (kardashevRow) {
  //   rows.push(kardashevRow);
  // }
  // if (blueRow) {
  //   rows.push(blueRow);
  // }
  // if (hatRow) {
  //   rows.push(hatRow);
  // }

  let withdrawRow = null;
  if (
    !p?.destroyed &&
    !p?.frozen &&
    owned &&
    p?.planetType === PlanetType.TRADING_POST
  ) {
    withdrawRow = <WithdrawSilver wrapper={planet} />;
  }

  let notifRow = null;
  if (!p?.destroyed && !p?.frozen && notifs.length > 0) {
    notifRow = <PlanetNotifications planet={planet} notifs={notifs} />;
  }
  // if (kardashevRow) {
  //   rows.push(kardashevRow);
  // }
  // if (blueRow) {
  //   rows.push(blueRow);
  // }
  // if (hatRow) {
  //   rows.push(hatRow);
  // }

  const mid = Math.ceil(0.5 * rows.length);

  const leftRows = [];
  for (let i = 0; i < mid; i++) {
    leftRows.push(rows[i]);
  }
  const rightRows = [];
  for (let i = mid; i < rows.length; i++) {
    rightRows.push(rows[i]);
  }

  if (shouldShowAddJunkButton) {
    return (
      <>
        <PlanetCard planetWrapper={planet} />

        <ManageJunkButton wrapper={planet} />
      </>
    );
  } else {
    return (
      <>
        <PlanetCard planetWrapper={planet} />
        <SendResources
          planetWrapper={planet}
          onToggleSendForces={onToggleSendForces}
          onToggleAbandon={onToggleAbandon}
        />

        <ManageJunkButton wrapper={planet} />

        <MineArtifactButton planetWrapper={planet} />
        {/* {captureRow} */}

        <VerticalSplit>
          {leftRows.map((row, idx) => (
            <React.Fragment key={"left-" + idx}>{row}</React.Fragment>
          ))}
          {rightRows.map((row, idx) => (
            <React.Fragment key={"right-" + idx}>{row}</React.Fragment>
          ))}
        </VerticalSplit>

        {withdrawRow}
        {notifRow}
      </>
    );
  }
}

export function SelectedPlanetHelpContent() {
  return (
    <div>
      <p>
        This pane allows you to interact with the currently selected planet.
        Pressing the ESCAPE key allows you to deselect the current planet.
      </p>
    </div>
  );
}

export function PlanetContextPane({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  const uiManager = useUIManager();
  const planet = useSelectedPlanet(uiManager);

  /* All of this is done to support using the key commands on subpanes of the PlanetContextPane */
  const doSend = useCallback(() => {
    if (!uiManager) {
      return;
    }
    const uiEmitter = UIEmitter.getInstance();
    if (
      uiManager.isSendingForces() ||
      uiManager.isSendingShip() ||
      uiManager.isAbandoning()
    ) {
      uiEmitter.emit(UIEmitterEvent.SendInitiated, planet.value);
    } else {
      uiEmitter.emit(UIEmitterEvent.SendCancelled);
    }
  }, [planet, uiManager]);

  const toggleSendingForces = useCallback(() => {
    if (
      planet.value?.destroyed &&
      planet.value?.frozen &&
      !uiManager.isSendingShip(planet.value?.locationId)
    ) {
      return;
    }
    const isAbandoning = uiManager.isAbandoning();
    if (isAbandoning) {
      return;
    }
    const isSending = uiManager.isSendingForces();
    uiManager.setSending(!isSending);
    doSend();
  }, [uiManager, doSend, planet]);

  const toggleAbandoning = useCallback(() => {
    if (planet.value?.destroyed) {
      return;
    }
    if (planet.value?.frozen) {
      return;
    }
    const isAbandoning = uiManager.isAbandoning();
    uiManager.setAbandoning(!isAbandoning);
    doSend();
  }, [uiManager, doSend, planet]);

  useOnUp(TOGGLE_SEND, () => {
    toggleSendingForces();
  }, [toggleSendingForces]);

  useOnUp(TOGGLE_ABANDON, () => {
    toggleAbandoning();
  }, [toggleAbandoning]);

  useOnUp(EXIT_PANE, () => {
    // If we clear the selectedPlanetId, the below hook will cancel and cleanup the sending
    uiManager.setSelectedPlanet(undefined);
  }, [uiManager]);

  // If the locationId changes, cancel any sending
  useEmitterSubscribe(
    uiManager.selectedPlanetId$,
    () => {
      const uiEmitter = UIEmitter.getInstance();
      uiEmitter.emit(UIEmitterEvent.SendCancelled);

      // Get the previous planet and clear it's artifact
      // so it doesn't have a ship selected the next time the planet is selected
      const previousPlanet = uiManager.getPreviousSelectedPlanet();
      if (previousPlanet) {
        uiManager.setArtifactSending(previousPlanet.locationId, undefined);
      }
    },
    [uiManager],
  );

  const render = useCallback(
    (modal: ModalHandle) => (
      <PlanetContextPaneContent
        modal={modal}
        planet={planet}
        uiManager={uiManager}
        onToggleSendForces={toggleSendingForces}
        onToggleAbandon={toggleAbandoning}
      />
    ),
    [uiManager, planet, toggleSendingForces, toggleAbandoning],
  );

  return (
    <ModalPane
      style={
        // eslint-disable-next-line no-nested-ternary
        planet?.value?.destroyed
          ? snips.destroyedBackground
          : planet?.value?.frozen
            ? snips.frozenBackground
            : undefined
      }
      visible={visible}
      onClose={onClose}
      id={ModalName.PlanetContextPane}
      title={(small: boolean) => (
        <PlanetCardTitle small={small} planet={planet} />
      )}
      hideClose
      helpContent={SelectedPlanetHelpContent}
      width="350px"
    >
      {render}
    </ModalPane>
  );
}
