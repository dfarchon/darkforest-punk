import { formatNumber } from "@df/gamelogic";
import type { LocationId, Materials, MaterialType } from "@df/types";
import { PlanetType } from "@df/types";
import { MaterialSprite } from "@frontend/Components/MaterialSprite";
import { getMaterialTooltipName } from "@frontend/Panes/Tooltip";
import { useState } from "react";
import styled from "styled-components";

import { Btn } from "../Components/Btn";
import { CenterBackgroundSubtext } from "../Components/CoreUI";
import { NumberInput } from "../Components/Input";
import dfstyles from "../Styles/dfstyles";
import { usePlanet, useUIManager } from "../Utils/AppHooks";
import { useEmitterValue } from "../Utils/EmitterHooks";
import type { ModalHandle } from "../Views/ModalPane";
import { TabbedView } from "../Views/TabbedView";
import ModuleCraftingPane from "./ModuleCraftingPane";
import SpaceshipCraftingPane from "./SpaceshipCraftingPane";
import { TooltipTrigger } from "./Tooltip";

const PlanetMaterialsWrapper = styled.div`
  display: flex;
  flex-direction: column;
  height: 100%;
  max-height: 500px;

  & .row {
    display: flex;
    flex-direction: row;
    justify-content: space-between;
    & > span {
      &:first-child {
        color: ${dfstyles.colors.subtext};
        padding-right: 1em;
      }
    }
  }
  & .message {
    margin: 1em 0;

    & p {
      margin: 0.5em 0;

      &:last-child {
        margin-bottom: 1em;
      }
    }
  }
`;

const MaterialsContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-top: 8px;
  overflow-y: auto;
  max-height: calc(100% - 40px);
  padding-right: 4px;

  /* Force scrollbar to left side */
  direction: rtl;

  & > * {
    direction: ltr; /* Restore normal direction for children */
  }

  /* Custom scrollbar styling - left side scrollbar */
  &::-webkit-scrollbar {
    width: 12px; /* Make scrollbar wider */
    background-color: transparent;
  }

  &::-webkit-scrollbar-track {
    background: transparent;
    border-radius: 6px;
    margin: 4px 0;
  }

  &::-webkit-scrollbar-thumb {
    background: ${dfstyles.colors.borderDarker};
    border-radius: 6px;
    border: 2px solid transparent;
  }

  &::-webkit-scrollbar-thumb:hover {
    background: ${dfstyles.colors.subtext};
  }

  /* Firefox scrollbar */
  scrollbar-width: thin;
  scrollbar-color: ${dfstyles.colors.borderDarker} transparent;
`;

const MaterialCard = styled.div`
  display: flex;
  flex-direction: column;
  padding: 6px;
  background-color: ${dfstyles.colors.backgroundlighter};
  border: 1px solid ${dfstyles.colors.borderDarker};
  border-radius: 6px;
  gap: 2px;
  min-height: fit-content;
`;

const MaterialHeader = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
`;

const MaterialIcon = styled.div<{ color: string }>`
  width: 16px;
  height: 16px;
  background-color: transparent;
  border-radius: 3px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  line-height: 1;
  cursor: help;
`;

const MaterialName = styled.div<{ color: string }>`
  color: ${(props) => props.color};
  font-weight: bold;
  font-size: 16px;
`;

const MaterialStats = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 12px;
  color: ${dfstyles.colors.subtext};
`;

const SliderButton = styled.button`
  width: 20px;
  height: 20px;
  border: 1px solid ${dfstyles.colors.borderDarker};
  background: ${dfstyles.colors.backgroundlighter};
  color: ${dfstyles.colors.text};
  border-radius: 3px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;

  &:hover {
    background: ${dfstyles.colors.borderDarker};
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

const MaterialBar = styled.div<{
  percentage: number;
  materialID: MaterialType;
}>`
  width: 100%;
  height: 10px;
  background-color: ${dfstyles.colors.borderDarker};
  border-radius: 4px;
  overflow: hidden;
  position: relative;

  &::after {
    content: "";
    display: block;
    width: ${(props) => props.percentage}%;
    height: 100%;
    background-color: ${(props) => getMaterialColor(props.materialID)};
    transition: width 0.3s ease;
  }
`;

const MaterialBarText = styled.div`
  position: absolute;
  top: 40%;
  left: 50%;
  transform: translate(-50%, -50%);
  font-size: 10px;
  font-weight: bold;
  color: white;
  text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.8);
  z-index: 1;
  pointer-events: none;
`;

const MaterialWithdrawContainer = styled.div`
  display: flex;
  align-items: center;
  gap: 4px;
  margin-top: 8px;
`;

const WithdrawInput = styled.div`
  width: 80px;
`;

const WithdrawButton = styled(Btn)`
  padding: 4px 8px;
  font-size: 12px;
  min-width: 60px;
`;

const MaterialWithdrawBar = styled.div`
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-top: 8px;
  padding: 8px;
  background-color: ${dfstyles.colors.background};
  border: 1px solid ${dfstyles.colors.borderDarker};
  border-radius: 4px;
`;

const WithdrawHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 4px;
`;

const WithdrawLabel = styled.div`
  font-size: 12px;
  font-weight: bold;
  color: ${dfstyles.colors.text};
`;

const WithdrawAmount = styled.div`
  font-size: 14px;
  font-weight: bold;
  color: ${dfstyles.colors.subtext};
`;

const WithdrawSlider = styled.input`
  width: 100%;
  height: 6px;
  border-radius: 3px;
  background: ${dfstyles.colors.borderDarker};
  outline: none;
  -webkit-appearance: none;
  margin: 4px 0;

  &::-webkit-slider-thumb {
    -webkit-appearance: none;
    appearance: none;
    width: 16px;
    height: 16px;
    border-radius: 50%;
    background: ${dfstyles.colors.subbertext};
    cursor: pointer;
    border: 2px solid white;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
  }

  &::-moz-range-thumb {
    width: 16px;
    height: 16px;
    border-radius: 50%;
    background: ${dfstyles.colors.subbertext};
    cursor: pointer;
    border: 2px solid white;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
  }
`;

const WithdrawWarning = styled.div`
  font-size: 15px;
  color: ${dfstyles.colors.dfred};
  padding: 4px 8px;
  border-radius: 3px;
  border: 1px solid ${dfstyles.colors.dfred};
  margin-top: 4px;
`;

const MaterialScoreInfo = styled.div`
  font-size: 15px;
  color: ${dfstyles.colors.subtext};
  padding: 4px 6px;
  border-radius: 3px;
  border: 1px solid ${dfstyles.colors.borderDarker};
  margin-top: 4px;
`;

const CraftingToggleContainer = styled.div`
  display: flex;
  gap: 8px;
  margin-bottom: 12px;
  padding: 2px;
`;

const CraftingToggleButton = styled.button<{ active: boolean }>`
  flex: 1;
  padding: 8px 12px;
  background-color: ${(props) =>
    props.active
      ? dfstyles.colors.backgroundlighter
      : dfstyles.colors.background};
  color: ${(props) => (props.active ? "#fff" : dfstyles.colors.subtext)};

  font-size: 12px;
  // font-weight: ${(props) => (props.active ? "bold" : "normal")};
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover {
    background-color: ${(props) =>
      props.active
        ? dfstyles.colors.borderDarker
        : dfstyles.colors.borderDarker};
    // color: ${(props) => (props.active ? "#fff" : dfstyles.colors.text)};
  }
`;

const CraftingWrapper = styled.div`
  display: flex;
  flex-direction: column;
  width: 100%;
`;

export function getMaterialName(materialId: MaterialType): string {
  switch (materialId) {
    case 1:
      return "WATER CRYSTALS";
    case 2:
      return "LIVING WOOD";
    case 3:
      return "WINDSTEEL";
    case 4:
      return "AURORIUM";
    case 5:
      return "MYCELIUM GEL";
    case 6:
      return "SANDGLASS";
    case 7:
      return "CRYOSTONE";
    case 8:
      return "SCRAPIUM";
    case 9:
      return "PYROSTEEL";
    case 10:
      return "BLACKALLOY";
    case 11:
      return "CRYSTAL";
    default:
      return "Unknown";
  }
}

export function getMaterialIcon(
  materialId: MaterialType,
  size: number = 64, // Doubled from 64 to 128 (twice as big: 64 * 2 = 128)
): React.ReactElement {
  return <MaterialSprite materialId={materialId} size={size} />;
}

export function getMaterialScoreMultiplier(materialId: MaterialType): number {
  switch (materialId) {
    case 1:
      return 105;
    case 2:
      return 110;
    case 3:
      return 120;
    case 4:
      return 130;
    case 5:
      return 150;
    case 6:
      return 180;
    case 7:
      return 200;
    case 8:
      return 250;
    case 9:
      return 300;
    case 10:
      return 400;
    case 11:
      return 600;
    default:
      return 100;
  }
}

export function getMaterialColor(materialId: MaterialType): string {
  switch (materialId) {
    case 1:
      return "#4A90E2"; // Blue for water
    case 2:
      return "#8B4513"; // Brown for wood
    case 3:
      return "#87CEEB"; // Light blue for windsteel
    case 4:
      return "#f5bf2c"; // AURORIUM
    case 5:
      return "#8b55c1ff"; // Violet for mycelium
    case 6:
      return "#FFD700"; // Gold for sunstone
    case 7:
      return "#80e5f3ff"; // Light blue for glacite
    case 8:
      return "#696969"; // Gray for scrapium
    case 9:
      return "#FF4500"; // Orange for pyrosteel
    case 10:
      return "#2F4F4F"; // Dark gray for blackalloy
    case 11:
      return "#0df000df"; // Dark Green for Currapted Crystals
    default:
      return dfstyles.colors.subtext;
  }
}

export function getMaterialDescription(id: number): string {
  switch (id) {
    case 1:
      return "A shimmering liquid harvested from deep ocean wells, used in cooling systems, fluidic shields, and hydro-reactive engines.";
    case 2:
      return "An organic, flexible biofiber that forms the core of regenerative hull plating and photosynthetic tech modules.";
    case 3:
      return "Lightweight and highly conductive alloy spun from atmospheric windsteel veins; vital for turbine propulsion and trade ship frames.";
    case 4:
      return "Luminous mineral infused with polar energy, mined from aurora-lit tundra fields. Used in advanced navigation cores, sensor arrays, and energy-reflective ship plating.";
    case 5:
      return "Pulsating fungal gel infused with life essence; powers alchemical reactors and mycelial growth algorithms.";
    case 6:
      return "Sharp, granular shards capable of storing temporal energy—used in chrono-sensors and time-slowing projectiles.";
    case 7:
      return "Frozen mineral forged in vacuum conditions, used in advanced refrigeration, stasis chambers, and cryo-lasers.";
    case 8:
      return "Junk-forged alloy made from Wasteland scraps, restructured into modular components for rough industrial builds.";
    case 9:
      return "Ultra-dense alloy mined from volcanic zones, ideal for magma engines, high-heat armor, and thermal weapon cores.";
    case 10:
      return "A forbidden dark alloy synthesized from corrupted zones. Dense, unstable, and extremely powerful in shadow-tech applications.";
    case 11:
      return "Crystallized corruption extracted from reality-warped biomes. Essential for ZK-reactors, entropy drives, and unstable modules.";
    default:
      return "Unknown material of mysterious origin.";
  }
}

export function PlanetMaterialsPane({
  initialPlanetId,
  modal: _modal,
}: {
  initialPlanetId: LocationId | undefined;
  modal: ModalHandle;
}) {
  const uiManager = useUIManager();
  const planetId = useEmitterValue(
    uiManager.selectedPlanetId$,
    initialPlanetId,
  );
  const planet = usePlanet(uiManager, planetId).value;
  const [withdrawAmounts, setWithdrawAmounts] = useState<{
    [key: number]: number;
  }>({});

  const [materialAllocations, setMaterialAllocations] = useState<{
    [key: number]: number;
  }>({});

  // State for switching between Spaceship and Module crafting
  const [craftingType, setCraftingType] = useState<"spaceship" | "module">(
    "spaceship",
  );

  const handleWithdraw = (materialType: MaterialType, amount: number) => {
    if (amount > 0 && planet) {
      uiManager.withdrawMaterial(planet.locationId, materialType, amount);
      // Clear the input after withdrawal
      setWithdrawAmounts((prev) => ({ ...prev, [materialType]: 0 }));
    }
  };

  const handleAmountChange = (materialType: MaterialType, value: string) => {
    const numValue = parseFloat(value) || 0;
    setWithdrawAmounts((prev) => ({ ...prev, [materialType]: numValue }));
  };

  const handleSliderChange = (materialType: MaterialType, value: number) => {
    setMaterialAllocations((prev) => ({ ...prev, [materialType]: value }));

    // Also update withdraw amounts based on slider percentage
    if (planet) {
      const material = planet.materials?.find(
        (m) => m?.materialId === materialType,
      );
      if (material) {
        const maxWithdraw = Number(material.materialAmount);
        const withdrawAmount = Math.floor((value / 100) * maxWithdraw);
        setWithdrawAmounts((prev) => ({
          ...prev,
          [materialType]: withdrawAmount,
        }));
      }
    }
  };

  const handleSliderIncrement = (materialType: MaterialType) => {
    const current = materialAllocations[materialType] || 0;
    const newValue = Math.min(current + 5, 100);
    setMaterialAllocations((prev) => ({ ...prev, [materialType]: newValue }));

    // Also update withdraw amounts
    if (planet) {
      const material = planet.materials?.find(
        (m) => m.materialId === materialType,
      );
      if (material) {
        const maxWithdraw = Number(material.materialAmount);
        const withdrawAmount = (newValue / 100) * maxWithdraw;
        setWithdrawAmounts((prev) => ({
          ...prev,
          [materialType]: withdrawAmount,
        }));
      }
    }
  };

  const handleSliderDecrement = (materialType: MaterialType) => {
    const current = materialAllocations[materialType] || 0;
    const newValue = Math.max(current - 5, 0);
    setMaterialAllocations((prev) => ({ ...prev, [materialType]: newValue }));

    // Also update withdraw amounts
    if (planet) {
      const material = planet.materials?.find(
        (m) => m.materialId === materialType,
      );
      if (material) {
        const maxWithdraw = Number(material.materialAmount);
        const withdrawAmount = (newValue / 100) * maxWithdraw;
        setWithdrawAmounts((prev) => ({
          ...prev,
          [materialType]: withdrawAmount,
        }));
      }
    }
  };

  const getWithdrawAmount = (
    materialType: MaterialType,
    percentage: number,
  ): string => {
    if (!planet) return "";

    const material = planet.materials?.find(
      (m) => m.materialId === materialType,
    );
    if (!material) return "";

    const maxAmount = Number(material.materialAmount);
    const amount = (percentage / 100) * maxAmount;
    return `${formatNumber(amount)}`;
  };

  // Check if material amount is less than 1/5 of cap
  const isMaterialBelowThreshold = (material: Materials): boolean => {
    const currentAmount = Math.floor(withdrawAmounts[material.materialId]);
    const cap = Math.ceil(Number(material.cap));

    return currentAmount * 5 < cap;
  };

  if (!planet) {
    return (
      <CenterBackgroundSubtext width="100%" height="200px">
        No planet selected
      </CenterBackgroundSubtext>
    );
  }

  const activeMaterials =
    planet.materials?.filter(
      (mat) => mat.materialId !== 0 && Number(mat.materialAmount) > 0,
    ) || [];

  const isFoundry = planet.planetType === PlanetType.RUINS;

  // Build tabs dynamically based on planet type
  const tabTitles: string[] = ["Materials"];
  if (isFoundry) {
    tabTitles.push("Craft");
  }

  const tabContents = (tabIndex: number) => {
    if (tabIndex === 0) {
      // Materials tab
      return (
        <PlanetMaterialsWrapper>
          {activeMaterials.length === 0 ? (
            <CenterBackgroundSubtext width="100%" height="100px">
              No materials found on this planet
            </CenterBackgroundSubtext>
          ) : (
            <MaterialsContainer>
              {activeMaterials.map((mat) => {
                const percentage =
                  Number(mat.cap) > 0
                    ? (Number(mat.materialAmount) / Number(mat.cap)) * 100
                    : 0;
                const materialColor = getMaterialColor(mat.materialId);
                const allocation = materialAllocations[mat.materialId] || 0;
                const isBelowThreshold = isMaterialBelowThreshold(mat);
                const scoreMultiplier = getMaterialScoreMultiplier(
                  mat.materialId,
                );

                return (
                  <MaterialCard key={mat.materialId}>
                    <MaterialHeader>
                      <TooltipTrigger
                        name={getMaterialTooltipName(mat.materialId)}
                      >
                        <MaterialIcon color={materialColor}>
                          {getMaterialIcon(mat.materialId)}
                        </MaterialIcon>
                      </TooltipTrigger>
                      <MaterialName color={materialColor}>
                        {getMaterialName(mat.materialId)}
                      </MaterialName>
                    </MaterialHeader>

                    <MaterialStats>
                      {mat.growth && (
                        <div style={{ color: materialColor }}>
                          Growth Rate: {formatNumber(Number(mat.growthRate), 2)}
                        </div>
                      )}
                    </MaterialStats>

                    {/* Score multiplier info */}
                    <MaterialScoreInfo>
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          color: "white",
                        }}
                      >
                        <span>
                          Withdraw Score Multiplier: {scoreMultiplier}
                        </span>
                      </div>
                    </MaterialScoreInfo>

                    {/* Material quantity vs cap progress bar - shows current status only */}
                    <MaterialBar
                      percentage={percentage}
                      materialID={mat.materialId}
                    >
                      <MaterialBarText>
                        {formatNumber(mat.materialAmount)} /{" "}
                        {formatNumber(mat.cap)}
                      </MaterialBarText>
                    </MaterialBar>

                    {/* Material withdrawal control panel - only shown at trading posts */}
                    {planet.planetType === 4 && ( // SPACETIME_RIP (TRADING_POST)
                      <MaterialWithdrawBar>
                        <WithdrawHeader>
                          <WithdrawLabel>Withdraw Amount</WithdrawLabel>
                          <WithdrawAmount>
                            {getWithdrawAmount(mat.materialId, allocation)}
                          </WithdrawAmount>
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: "8px",
                            }}
                          >
                            <span
                              style={{ fontSize: "11px", color: materialColor }}
                            >
                              {allocation}%
                            </span>
                            <div style={{ display: "flex", gap: "4px" }}>
                              <SliderButton
                                onClick={() =>
                                  handleSliderDecrement(mat.materialId)
                                }
                                disabled={allocation <= 0}
                              >
                                -
                              </SliderButton>
                              <SliderButton
                                onClick={() =>
                                  handleSliderIncrement(mat.materialId)
                                }
                                disabled={allocation >= 100}
                              >
                                +
                              </SliderButton>
                            </div>
                          </div>
                        </WithdrawHeader>

                        <WithdrawSlider
                          type="range"
                          min="0"
                          max="100"
                          value={allocation}
                          onChange={(e) =>
                            handleSliderChange(
                              mat.materialId,
                              parseInt(e.target.value),
                            )
                          }
                        />

                        {/* Warning message for materials below threshold */}
                        {isBelowThreshold && (
                          <WithdrawWarning>
                            ⚠️ Cannot withdraw: Material amount is less than 1/5
                            of capacity
                          </WithdrawWarning>
                        )}

                        <MaterialWithdrawContainer>
                          <WithdrawInput>
                            <NumberInput
                              value={withdrawAmounts[mat.materialId] || 0}
                              onChange={(e) => {
                                if (e.target) {
                                  handleAmountChange(
                                    mat.materialId,
                                    (e.target as HTMLInputElement).value,
                                  );
                                }
                              }}
                            />
                          </WithdrawInput>
                          <WithdrawButton
                            onClick={() =>
                              handleWithdraw(
                                mat.materialId,
                                withdrawAmounts[mat.materialId] || 0,
                              )
                            }
                            disabled={
                              !withdrawAmounts[mat.materialId] ||
                              withdrawAmounts[mat.materialId] <= 0 ||
                              isBelowThreshold
                            }
                          >
                            Withdraw
                          </WithdrawButton>
                        </MaterialWithdrawContainer>
                      </MaterialWithdrawBar>
                    )}
                  </MaterialCard>
                );
              })}
            </MaterialsContainer>
          )}
        </PlanetMaterialsWrapper>
      );
    } else if (tabIndex === 1 && isFoundry) {
      // Crafting tab (only for foundries) - toggle between Spaceship and Module
      return (
        <CraftingWrapper>
          <CraftingToggleContainer>
            <CraftingToggleButton
              active={craftingType === "spaceship"}
              onClick={() => setCraftingType("spaceship")}
            >
              Spaceships
            </CraftingToggleButton>
            <CraftingToggleButton
              active={craftingType === "module"}
              onClick={() => setCraftingType("module")}
            >
              Modules
            </CraftingToggleButton>
          </CraftingToggleContainer>
          {craftingType === "spaceship" ? (
            <SpaceshipCraftingPane
              planet={planet}
              onClose={() => {}}
              onCraftComplete={() => {}}
            />
          ) : (
            <ModuleCraftingPane
              planet={planet}
              onClose={() => {}}
              onCraftComplete={() => {}}
            />
          )}
        </CraftingWrapper>
      );
    }
    return null;
  };

  return <TabbedView tabTitles={tabTitles} tabContents={tabContents} />;
}
