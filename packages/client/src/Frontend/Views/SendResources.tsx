import { formatNumber, isSpaceShip } from "@df/gamelogic";
import { isUnconfirmedMoveTx } from "@df/serde";
import type { Artifact, Materials, MaterialType, Planet } from "@df/types";
import { artifactNameFromArtifact, TooltipName } from "@df/types";
import {
  getMaterialColor,
  getMaterialIcon,
} from "@frontend/Panes/PlanetMaterialsPane";
import React, { useCallback } from "react";
import styled from "styled-components";

import type { Wrapper } from "../../Backend/Utils/Wrapper";
import { Btn } from "../Components/Btn";
import { Icon, IconType } from "../Components/Icons";
import { LoadingSpinner } from "../Components/LoadingSpinner";
import { MaybeShortcutButton } from "../Components/MaybeShortcutButton";
import { Slider } from "../Components/Slider";
import { getMaterialTooltipName, TooltipTrigger } from "../Panes/Tooltip";
import dfstyles from "../Styles/dfstyles";
import {
  useAccount,
  usePlanetInactiveArtifacts,
  useUIManager,
} from "../Utils/AppHooks";
import { useEmitterValue } from "../Utils/EmitterHooks";
import { useOnUp } from "../Utils/KeyEmitters";
import { TOGGLE_SEND } from "../Utils/ShortcutConstants";
import { SelectArtifactRow } from "./ArtifactRow";

const StyledSendResources = styled.div`
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-bottom: 8px;
  /* Allow the container to be flexible for proper scrolling */
  min-height: 0;
`;

const MaterialsContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: 2px;
`;

const ResourcesScrollable = styled.div`
  position: relative;
  max-height: 200px;
  overflow-y: scroll; /* force scrollbar always visible */
  padding: 8px; /* keep content padding */

  flex-shrink: 0;
  min-height: 0;

  /* Force scrollbar to left side */
  direction: rtl; /* flip scrollbar to left */
  & > * {
    direction: ltr; /* restore normal direction for children */
  }

  /* Webkit scrollbar styling */
  &::-webkit-scrollbar {
    width: 16px; /* make scrollbar wider */
    background-color: transparent; /* track background */
  }

  &::-webkit-scrollbar-thumb {
    background-color: #888; /* thumb color */
    border-radius: 8px; /* rounder thumb */
    border: 4px solid transparent; /* create extra space around thumb */
  }

  &::-webkit-scrollbar-thumb:hover {
    background-color: #555;
  }

  &::-webkit-scrollbar-track {
    margin: 8px 0; /* add vertical margin to track */
    border-radius: 8px;
    background-color: transparent;
  }

  /* Firefox scrollbar */
  scrollbar-width: thin;
  scrollbar-color: #888 transparent;
`;

export function MaterialIcon({ materialId }: { materialId: number }) {
  return (
    <div
      style={{
        width: "16px",
        height: "16px",
        backgroundColor: getMaterialColor(materialId as MaterialType),
        borderRadius: "2px",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: "12px",
        lineHeight: "1",
      }}
    >
      {getMaterialIcon(materialId as MaterialType)}
    </div>
  );
}

const ResourceRow = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 0;
  min-height: 32px;
`;

const ResourceIcon = styled.div<{ color: string }>`
  width: 16px;
  height: 16px;
  background-color: transparent;
  border-radius: 2px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  line-height: 1;
  flex-shrink: 0;
  cursor: help;
`;

const ResourceValue = styled.div<{ color: string }>`
  color: ${(props) => props.color};
  font-size: 12px;
  font-weight: bold;
  min-width: 50px;
  text-align: right;
  flex-shrink: 0;
`;

const ResourceSlider = styled.div`
  width: 100%;
  margin: 0;
`;

const ResourcePercentage = styled.div<{ color: string }>`
  color: ${(props) => props.color};
  font-size: 12px;
  font-weight: bold;
  min-width: 35px;
  text-align: center;
  flex-shrink: 0;
`;

const ResourceControls = styled.div<{ color: string }>`
  display: flex;
  gap: 4px;
  align-items: center;
  flex-shrink: 0;

  button {
    background: none;
    border: none;
    color: ${(props) => props.color};
    font-size: 14px;
    font-weight: bold;
    cursor: pointer;
    padding: 2px 4px;
    border-radius: 2px;
    transition: background-color 0.2s;

    &:hover {
      background-color: rgba(255, 255, 255, 0.1);
    }

    &:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
  }
`;

function ResourceBar({
  isSilver,
  isMaterial,
  selected,
  material,
  value,
  setValue,
  disabled,
}: {
  isSilver?: boolean;
  isMaterial?: boolean;
  selected: Planet | Materials | undefined;
  material?: Materials;
  value: number;
  setValue: (x: number) => void;
  disabled?: boolean;
}) {
  const getResource = useCallback(
    (val: number): string => {
      if (!selected) return "";

      // MATERIAL
      if (isMaterial && material) {
        const amount =
          typeof material.materialAmount === "string"
            ? parseFloat(material.materialAmount)
            : Number(material.materialAmount);
        const materialValue = (val / 100) * amount;

        // e.g., "312.4 MYCELIUM"
        return `${formatNumber(materialValue)}`;
      }

      // SILVER or POPULATION
      const resource = isSilver
        ? (selected as Planet).silver
        : (selected as Planet).population;

      const resourceValue = (val / 100) * resource;

      return `${formatNumber(resourceValue)}`;
    },
    [selected, isSilver, isMaterial, material],
  );

  const getResourceColor = () => {
    if (isMaterial && material) {
      return getMaterialColor(material.materialId);
    }
    if (isSilver) {
      return dfstyles.colors.dfyellow;
    }
    return dfstyles.colors.text; // White for population
  };

  const getResourceIcon = () => {
    if (isMaterial && material) {
      return getMaterialIcon(material.materialId);
    }
    if (isSilver) {
      return <Icon type={IconType.Silver} />;
    }
    return <Icon type={IconType.Energy} />;
  };

  const resourceColor = getResourceColor();

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
      {/* Main resource row: [Icon] [Name] [Value] [%] [+/-] */}
      <ResourceRow>
        {(() => {
          if (isMaterial && material) {
            return (
              <TooltipTrigger
                name={getMaterialTooltipName(material.materialId)}
              >
                <ResourceIcon color={resourceColor}>
                  {getResourceIcon()}
                </ResourceIcon>
              </TooltipTrigger>
            );
          }
          if (isSilver) {
            return (
              <TooltipTrigger name={TooltipName.Silver}>
                <ResourceIcon color={resourceColor}>
                  {getResourceIcon()}
                </ResourceIcon>
              </TooltipTrigger>
            );
          }
          return (
            <TooltipTrigger name={TooltipName.Energy}>
              <ResourceIcon color={resourceColor}>
                {getResourceIcon()}
              </ResourceIcon>
            </TooltipTrigger>
          );
        })()}

        {/* <ResourceName color={resourceColor}>{getResourceName()}</ResourceName> */}

        <ResourceValue color={resourceColor}>
          {getResource(value)}
        </ResourceValue>
        <ResourceSlider>
          <Slider
            variant="filled"
            labelVisibility="none"
            min={0}
            max={100}
            value={value}
            step={1}
            disabled={disabled}
            onChange={(e: Event & React.ChangeEvent<HTMLInputElement>) => {
              const target = e.target as HTMLInputElement;
              setValue(parseInt(target.value, 10));
            }}
            style={{ height: "16px" }}
          />
        </ResourceSlider>
        <ResourcePercentage color={resourceColor}>{value}%</ResourcePercentage>

        <ResourceControls color={resourceColor}>
          <button
            onClick={() => setValue(Math.max(0, value - 1))}
            disabled={disabled || value <= 0}
          >
            -
          </button>
          <button
            onClick={() => setValue(Math.min(100, value + 1))}
            disabled={disabled || value >= 100}
          >
            +
          </button>
        </ResourceControls>
      </ResourceRow>
    </div>
  );
}

function SendRow({
  toggleSending,
  artifact,
  sending,
  abandoning,
  disabled = false,
}: {
  toggleSending: () => void;
  artifact: Artifact | undefined;
  sending: boolean;
  abandoning?: boolean;
  disabled?: boolean;
}) {
  let content = "Send";
  if (artifact) {
    const artifactName = artifactNameFromArtifact(artifact);
    if (isSpaceShip(artifact.artifactType)) {
      // Call it "Move" with a spaceship, instead of "Send"
      content = `Move ${artifactName}`;
    } else {
      // Only add the "+" if we are sending Energy & Artifact
      content += ` + ${artifactName}`;
    }
  }
  if (abandoning) {
    content += " and Abandon";
  }
  /* Explicitly avoid binding to `onShortcutPressed` so we can support sending on subpanes */
  return (
    <MaybeShortcutButton
      size="stretch"
      onClick={toggleSending}
      active={sending}
      shortcutKey={TOGGLE_SEND}
      shortcutText={TOGGLE_SEND}
      disabled={disabled}
    >
      {content}
    </MaybeShortcutButton>
  );
}

export function SendResources({
  planetWrapper: p,
  onToggleSendForces,
  onToggleAbandon: _onToggleAbandon,
}: {
  planetWrapper: Wrapper<Planet | undefined>;
  onToggleSendForces: () => void;
  onToggleAbandon: () => void;
}) {
  const uiManager = useUIManager();
  const gameManager = uiManager.getGameManager();
  const account = useAccount(uiManager);

  const canDelegate = gameManager.checkDelegateCondition(
    p.value?.owner,
    account,
  );

  const owned = p.value?.owner === account || canDelegate;

  const locationId = p?.value?.locationId;

  const isSendingShip = uiManager.isSendingShip(locationId);

  const isAbandoning = useEmitterValue(uiManager.isAbandoning$, false);
  const isSendingForces = useEmitterValue(uiManager.isSending$, false);
  const energySending = uiManager.getForcesSending(locationId);
  const silverSending = uiManager.getSilverSending(locationId);
  const artifactSending = uiManager.getArtifactSending(locationId);

  const disableSliders = isSendingShip || isAbandoning;

  const activeMaterials =
    p.value?.materials?.filter(
      (mat) => mat.materialId !== 0 && Number(mat.materialAmount) > 0,
    ) || [];

  const updateEnergySending = useCallback(
    (energyPercent: number) => {
      if (!locationId) {
        return;
      }
      uiManager.setForcesSending(locationId, energyPercent);
    },
    [uiManager, locationId],
  );

  const updateSilverSending = useCallback(
    (silverPercent: number) => {
      if (!locationId) {
        return;
      }
      uiManager.setSilverSending(locationId, silverPercent);
    },
    [uiManager, locationId],
  );

  const updateArtifactSending = useCallback(
    (sendArtifact: Artifact | undefined) => {
      if (!locationId) {
        return;
      }
      uiManager.setArtifactSending(locationId, sendArtifact);
    },
    [uiManager, locationId],
  );

  // this variable is an array of 10 elements. each element is a key. whenever the user presses a
  // key, we set the amount of energy that we're sending to be proportional to how late in the array
  // that key is
  const energyShortcuts = "1234567890".split("");

  // same as above, except for silver
  const silverShortcuts = "!@#$%^&*()".split("");

  // for each of the above keys, we set up a listener that is triggered whenever that key is
  // pressed, and sets the corresponding resource sending amount
  for (let i = 0; i < energyShortcuts.length; i++) {
    useOnUp(energyShortcuts[i], () => updateEnergySending((i + 1) * 10), [
      updateEnergySending,
    ]);
    useOnUp(silverShortcuts[i], () => updateSilverSending((i + 1) * 10), [
      updateSilverSending,
    ]);
  }

  useOnUp(
    "-",
    () => {
      updateEnergySending(uiManager.getForcesSending(locationId) - 10);
    },
    [uiManager, locationId, updateEnergySending],
  );
  useOnUp(
    "=",
    () => {
      updateEnergySending(uiManager.getForcesSending(locationId) + 10);
    },
    [uiManager, locationId, updateEnergySending],
  );
  useOnUp(
    "_",
    () => {
      updateSilverSending(uiManager.getSilverSending(locationId) - 10);
    },
    [uiManager, locationId, updateSilverSending],
  );
  useOnUp(
    "+",
    () => {
      updateSilverSending(uiManager.getSilverSending(locationId) + 10);
    },
    [uiManager, locationId, updateSilverSending],
  );

  const artifacts = usePlanetInactiveArtifacts(p, uiManager);
  const spaceshipsYouOwn = artifacts.filter(
    (a) => isSpaceShip(a.artifactType) && a.controller === account,
  );

  let sendRow;
  if (p.value && p.value.transactions?.hasTransaction(isUnconfirmedMoveTx)) {
    sendRow = (
      <Btn size="stretch" disabled>
        <LoadingSpinner
          initialText={isSendingShip ? "Moving..." : "Sending..."}
        />
      </Btn>
    );
  } else {
    const isDisabled =
      (p.value?.destroyed || p.value?.frozen || !owned) && !isSendingShip;
    sendRow = (
      <SendRow
        artifact={artifactSending}
        toggleSending={onToggleSendForces}
        sending={isSendingForces}
        disabled={isDisabled}
      />
    );
  }

  return (
    <StyledSendResources>
      <div style={{ position: "relative" }}>
        <ResourcesScrollable
          ref={(el: HTMLDivElement | null) => {
            // Attach scroll handler to update custom thumb position
            if (!el) return;
            const rail = el.parentElement?.querySelector(
              '[data-custom-scrollbar="rail"]',
            ) as HTMLDivElement | null;
            const thumb = el.parentElement?.querySelector(
              '[data-custom-scrollbar="thumb"]',
            ) as HTMLDivElement | null;
            const update = () => {
              if (!thumb || !rail) return;
              const { scrollTop, scrollHeight, clientHeight } = el;
              const trackHeight = rail.clientHeight;
              const thumbHeight = Math.max(
                Math.round((clientHeight / scrollHeight) * trackHeight),
                24,
              );
              const maxThumbTop = trackHeight - thumbHeight;
              const ratio = scrollTop / (scrollHeight - clientHeight || 1);
              const top = Math.round(ratio * maxThumbTop);
              thumb.style.height = `${thumbHeight}px`;
              thumb.style.top = `${top}px`;
            };
            el.addEventListener("scroll", update);
            // Initialize
            setTimeout(update, 0);
          }}
        >
          {owned && !p.value?.destroyed && !p.value?.frozen && (
            <>
              <ResourceBar
                selected={p.value}
                value={energySending}
                setValue={updateEnergySending}
                disabled={disableSliders}
              />
              {p.value && p.value.silver > 0 && (
                <ResourceBar
                  selected={p.value}
                  value={silverSending}
                  setValue={updateSilverSending}
                  disabled={disableSliders}
                  isSilver
                />
              )}
            </>
          )}
          {owned &&
            !p.value?.destroyed &&
            !p.value?.frozen &&
            activeMaterials.length > 0 && (
              <MaterialsContainer>
                {activeMaterials.map((mat) => (
                  <ResourceBar
                    key={mat.materialId}
                    selected={p.value}
                    material={mat}
                    value={uiManager.getMaterialSending(
                      locationId!,
                      mat.materialId,
                    )}
                    setValue={(val) =>
                      uiManager.setMaterialSending(
                        locationId!,
                        mat.materialId,
                        val,
                      )
                    }
                    disabled={disableSliders}
                    isMaterial
                  />
                ))}
              </MaterialsContainer>
            )}
          {p.value && artifacts.length > 0 && (
            <SelectArtifactRow
              artifacts={artifacts}
              onArtifactChange={updateArtifactSending}
              selectedArtifact={artifactSending}
            />
          )}
        </ResourcesScrollable>
      </div>
      {spaceshipsYouOwn.length > 0 || owned ? sendRow : null}

      {/* {uiManager.getSpaceJunkEnabled() && owned ? abandonRow : null} */}
    </StyledSendResources>
  );
}
