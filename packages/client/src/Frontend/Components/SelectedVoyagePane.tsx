import { formatCompact, formatNumber } from "@df/gamelogic";
import { isArtifactSpaceShip } from "@df/gamelogic";
import { getPlanetName } from "@df/procedural";
import type { QueuedArrival } from "@df/types";
import { TooltipName } from "@df/types";
import React, { useCallback, useRef, useState } from "react";
import styled from "styled-components";

import { useMoveRevert } from "../../hooks/useMoveRevert";
import { ArtifactImage } from "../Components/ArtifactImage";
import { Icon, IconType } from "../Components/Icons";
import {
  getMaterialColor,
  getMaterialIcon,
  getMaterialName,
} from "../Panes/PlanetMaterialsPane";
import { getMaterialTooltipName, TooltipTrigger } from "../Panes/Tooltip";
import { BiomeTextColors } from "../Styles/Colors";
import dfstyles from "../Styles/dfstyles";
import { snips } from "../Styles/dfstyles";
import { useUIManager } from "../Utils/AppHooks";

const VoyageCardContainer = styled.div<{
  isDragging?: boolean;
  isHovered?: boolean;
}>`
  ${snips.roundedBordersWithEdge}
  border-color: ${(props) =>
    props.isHovered ? dfstyles.colors.dfblue : dfstyles.colors.borderDarker};
  background: linear-gradient(
    135deg,
    ${(props) =>
        props.isHovered
          ? `${dfstyles.colors.backgroundlight}dd`
          : dfstyles.colors.backgroundlight}
      0%,
    ${(props) =>
        props.isHovered
          ? `${dfstyles.colors.background}dd`
          : dfstyles.colors.background}
      100%
  );
  padding: 16px;
  min-width: 320px;
  max-width: 400px;
  position: relative;
  cursor: ${(props) => (props.isDragging ? "grabbing" : "default")};
  user-select: none;
  box-shadow: ${(props) =>
    props.isHovered
      ? "0 4px 20px rgba(0, 123, 255, 0.3)"
      : "0 4px 12px rgba(0, 0, 0, 0.3)"};
  backdrop-filter: blur(10px);
  border: 1px solid
    ${(props) =>
      props.isHovered ? dfstyles.colors.dfblue : dfstyles.colors.border};
  opacity: ${(props) => (props.isHovered ? 0.95 : 1)};
  transition: all 0.2s ease;
`;

const DragHandle = styled.div`
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 30px;
  cursor: grab;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(
    90deg,
    transparent 0%,
    ${dfstyles.colors.borderDarker} 50%,
    transparent 100%
  );
  opacity: 0.3;
  transition: opacity 0.2s ease;

  &:hover {
    opacity: 0.6;
  }

  &::before {
    content: "⋮⋮";
    color: ${dfstyles.colors.subtext};
    font-size: 12px;
    letter-spacing: 2px;
  }
`;

const CloseButton = styled.button`
  position: absolute;
  top: 8px;
  right: 8px;
  background: none;
  border: none;
  color: ${dfstyles.colors.subtext};
  cursor: pointer;
  font-size: 14px;
  padding: 4px;
  line-height: 1;

  &:hover {
    color: ${dfstyles.colors.text};
  }
`;

const VoyageTitle = styled.div`
  font-size: 16px;
  font-weight: bold;
  color: ${dfstyles.colors.text};
  margin-bottom: 8px;
  text-align: center;
  padding-right: 20px; /* Make room for close button */
`;

const StatRow = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin: 4px 0;
  font-size: 14px;
`;

const StatLabel = styled.span`
  color: ${dfstyles.colors.subtext};
`;

const StatValue = styled.span`
  color: ${dfstyles.colors.text};
  font-weight: 500;
`;

const PlanetName = styled.span<{ biomeColor?: string }>`
  color: ${(props) => props.biomeColor || dfstyles.colors.text};
  font-weight: 500;
`;

const VoyageInfo = styled.div`
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px solid ${dfstyles.colors.borderDarker};
`;

const ArtifactContainer = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  border-radius: 4px;
  padding: 2px;
  transition: background-color 0.2s ease;

  &:hover {
    background-color: ${dfstyles.colors.backgroundlighter};
  }
`;

const ArtifactIdText = styled.span`
  font-size: 12px;
  color: ${dfstyles.colors.subtext};
`;

const CombinedResourceRow = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin: 4px 0;
  font-size: 14px;
  padding: 4px 0;
  border-top: 1px solid ${dfstyles.colors.borderDarker};
`;

const ResourcePair = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
`;

const ResourceIcon = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
`;

const ResourceValue = styled.span`
  color: ${dfstyles.colors.text};
  font-weight: 500;
`;

const MaterialsSection = styled.div`
  margin-top: 8px;
  padding-top: 8px;
`;

const MaterialsTitle = styled.div`
  font-size: 12px;
  color: ${dfstyles.colors.subtext};
  margin-bottom: 6px;
  text-align: center;
`;

const MaterialsGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(100px, 1fr));
  gap: 4px;
  font-size: 12px;
`;

const MaterialItem = styled.div`
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 2px 4px;
  background-color: ${dfstyles.colors.backgroundlighter};
  border-radius: 3px;
  border: 1px solid ${dfstyles.colors.borderDarker};
`;

const MaterialIcon = styled.div<{ color: string }>`
  width: 24px;
  height: 24px;
  background-color: transparent;
  border-radius: 2px;
  display: flex;
  align-items: center;
  justify-content: center;
  line-height: 1;
  cursor: help;
  &:hover {
    transform: scale(1.2);
    cursor: help;
  }
`;

const MaterialName = styled.span<{ color: string }>`
  color: ${(props) => props.color};
  font-weight: bold;
  font-size: 12px;
`;

const RevertButton = styled.button`
  width: 100%;
  padding: 8px 12px;
  background-color: ${dfstyles.colors.dfred};
  color: white;
  border: 1px solid ${dfstyles.colors.dfred};
  border-radius: 4px;
  font-size: 12px;
  font-weight: bold;
  cursor: pointer;
  transition: all 0.2s ease;
  margin-top: 8px;

  &:hover:not(:disabled) {
    background-color: ${dfstyles.colors.dfred};
    opacity: 0.8;
    transform: translateY(-1px);
  }

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
`;

const ConfirmDialog = styled.div`
  background-color: ${dfstyles.colors.backgrounddark};
  border: 1px solid ${dfstyles.colors.dfred};
  border-radius: 4px;
  padding: 12px;
  margin-top: 8px;
`;

const ConfirmTitle = styled.div`
  color: ${dfstyles.colors.dfred};
  font-size: 14px;
  font-weight: bold;
  text-align: center;
  margin-bottom: 8px;
`;

const ConfirmMessage = styled.div`
  color: ${dfstyles.colors.text};
  font-size: 11px;
  text-align: center;
  margin-bottom: 12px;
  line-height: 1.4;
`;

const ConfirmButtons = styled.div`
  display: flex;
  gap: 8px;
`;

const ConfirmButton = styled.button<{ variant: "confirm" | "cancel" }>`
  flex: 1;
  padding: 6px 12px;
  border: none;
  border-radius: 3px;
  font-size: 11px;
  font-weight: bold;
  cursor: pointer;
  transition: all 0.2s ease;

  ${(props) =>
    props.variant === "confirm"
      ? `
        background-color: ${dfstyles.colors.dfred};
        color: white;
        &:hover:not(:disabled) {
          opacity: 0.8;
        }
      `
      : `
        background-color: ${dfstyles.colors.borderDarker};
        color: ${dfstyles.colors.text};
        &:hover:not(:disabled) {
          background-color: ${dfstyles.colors.borderDark};
        }
      `}

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
`;

interface SelectedVoyagePaneProps {
  voyage: QueuedArrival;
  onClose?: () => void;
  showCloseButton?: boolean;
  fixedPosition?: boolean;
  isHovered?: boolean;
  initialPosition?: { x: number; y: number } | null;
  onPositionChange?: (position: { x: number; y: number }) => void;
}

export function SelectedVoyagePane({
  voyage,
  onClose,
  showCloseButton = true,
  fixedPosition = true,
  isHovered = false,
  initialPosition = null,
  onPositionChange,
}: SelectedVoyagePaneProps) {
  const uiManager = useUIManager();
  const { canRevertMove, revertMove } = useMoveRevert();
  const [isReverting, setIsReverting] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  // Drag and drop state
  const [position, setPosition] = useState<{ x: number; y: number }>(() => {
    if (initialPosition) {
      return initialPosition;
    }
    // Default position (center-right of screen)
    return {
      x: window.innerWidth - 400,
      y: window.innerHeight / 2 - 200,
    };
  });
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  // Calculate journey progress
  const currentTime = Date.now();
  const departureTime = uiManager.convertTickToMs(voyage.departureTick);
  const arrivalTime = uiManager.convertTickToMs(voyage.arrivalTick);
  const totalJourneyTime = arrivalTime - departureTime;
  const elapsedTime = currentTime - departureTime;
  const progress = Math.max(
    0,
    Math.min(100, (elapsedTime / totalJourneyTime) * 100),
  );

  // Calculate time remaining
  const timeRemaining = Math.max(0, arrivalTime - currentTime);
  const timeRemainingSeconds = Math.floor(timeRemaining / 1000);
  const timeRemainingMinutes = Math.floor(timeRemainingSeconds / 60);
  const timeRemainingHours = Math.floor(timeRemainingMinutes / 60);

  const formatTimeRemaining = () => {
    if (timeRemainingHours > 0) {
      return `${timeRemainingHours}h ${timeRemainingMinutes % 60}m`;
    } else if (timeRemainingMinutes > 0) {
      return `${timeRemainingMinutes}m ${timeRemainingSeconds % 60}s`;
    } else {
      return `${timeRemainingSeconds}s`;
    }
  };

  // Get planet names
  const fromPlanet = uiManager.getPlanetWithId(voyage.fromPlanet);
  const toPlanet = uiManager.getPlanetWithId(voyage.toPlanet);

  const fromPlanetName =
    getPlanetName(fromPlanet) || `${voyage.fromPlanet.slice(0, 8)}...`;
  const toPlanetName =
    getPlanetName(toPlanet) || `${voyage.toPlanet.slice(0, 8)}...`;

  // Get biome colors for planet names
  const fromPlanetBiomeColor = fromPlanet?.biome
    ? BiomeTextColors[fromPlanet.biome]
    : undefined;
  const toPlanetBiomeColor = toPlanet?.biome
    ? BiomeTextColors[toPlanet.biome]
    : undefined;

  // Check if this is the player's voyage
  const isMyVoyage = voyage.player === uiManager.getAccount();

  // Check if this voyage can be reverted
  const canRevert = isMyVoyage && canRevertMove(voyage);

  const handleRevert = async () => {
    if (!showConfirm) {
      setShowConfirm(true);
      return;
    }

    setIsReverting(true);
    try {
      await revertMove(voyage);
      setShowConfirm(false);
      onClose?.(); // Close the pane after successful revert
      // Show success message
      console.log("Move reverted successfully!");
    } catch (error: unknown) {
      console.error("Failed to revert move:", error);

      // Show user-friendly error message
      const errorMessage = error?.message || "Unknown error occurred";
      alert(`Failed to revert move: ${errorMessage}`);
    } finally {
      setIsReverting(false);
    }
  };

  const handleCancelRevert = () => {
    setShowConfirm(false);
  };

  // Drag and drop handlers
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (!fixedPosition) return;

      e.preventDefault();
      setIsDragging(true);

      const rect = containerRef.current?.getBoundingClientRect();
      if (rect) {
        setDragOffset({
          x: e.clientX - rect.left,
          y: e.clientY - rect.top,
        });
      }
    },
    [fixedPosition],
  );

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!isDragging || !fixedPosition) return;

      e.preventDefault();
      setPosition({
        x: e.clientX - dragOffset.x,
        y: e.clientY - dragOffset.y,
      });
    },
    [isDragging, dragOffset, fixedPosition],
  );

  const handleMouseUp = useCallback(() => {
    if (!fixedPosition) return;
    setIsDragging(false);
    // Notify parent of position change
    if (onPositionChange) {
      onPositionChange(position);
    }
  }, [fixedPosition, onPositionChange, position]);

  // Add global mouse event listeners
  React.useEffect(() => {
    if (isDragging) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);

      return () => {
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
      };
    }
  }, [isDragging, handleMouseMove, handleMouseUp]);

  return (
    <div
      ref={containerRef}
      style={
        fixedPosition
          ? {
              position: "fixed",
              left: `${position.x}px`,
              top: `${position.y}px`,
              zIndex: 1000,
            }
          : {}
      }
    >
      <VoyageCardContainer isDragging={isDragging} isHovered={isHovered}>
        {fixedPosition && <DragHandle onMouseDown={handleMouseDown} />}
        {showCloseButton && onClose && (
          <CloseButton onClick={onClose}>✕</CloseButton>
        )}
        <VoyageTitle>
          {(() => {
            if (voyage.isMultiple) {
              return `${voyage.count} Moves`;
            }
            return isMyVoyage ? "My Voyage" : "Voyage";
          })()}
        </VoyageTitle>

        {voyage.isMultiple ? (
          <StatRow>
            <StatLabel>Click to select a move</StatLabel>
          </StatRow>
        ) : (
          <>
            <StatRow>
              <StatLabel>From:</StatLabel>
              <StatValue>
                {voyage.fromPlanet.slice(0, 8)}...{" "}
                <PlanetName biomeColor={fromPlanetBiomeColor}>
                  {fromPlanetName}
                </PlanetName>
              </StatValue>
            </StatRow>
            <StatRow>
              <StatLabel>To:</StatLabel>{" "}
              <StatValue>
                {voyage.toPlanet.slice(0, 8)}...{" "}
                <PlanetName biomeColor={toPlanetBiomeColor}>
                  {toPlanetName}
                </PlanetName>
              </StatValue>
            </StatRow>
          </>
        )}

        {!voyage.isMultiple && (
          <>
            <CombinedResourceRow>
              <ResourcePair>
                <TooltipTrigger name={TooltipName.Energy}>
                  <ResourceIcon>
                    <Icon type={IconType.Energy} />
                  </ResourceIcon>
                </TooltipTrigger>
                <ResourceValue>
                  {formatNumber(voyage.energyArriving)}
                </ResourceValue>
              </ResourcePair>
              <ResourcePair>
                <TooltipTrigger name={TooltipName.Silver}>
                  <ResourceIcon>
                    <Icon type={IconType.Silver} />
                  </ResourceIcon>
                </TooltipTrigger>
                <ResourceValue>
                  {formatNumber(voyage.silverMoved)}
                </ResourceValue>
              </ResourcePair>
            </CombinedResourceRow>

            {/* Materials Display */}
            {voyage.materialsMoved && voyage.materialsMoved.length > 0 && (
              <MaterialsSection>
                <MaterialsTitle>Materials</MaterialsTitle>
                <MaterialsGrid>
                  {voyage.materialsMoved
                    .filter(
                      (mat) =>
                        mat.materialId !== 0 && Number(mat.materialAmount) > 0,
                    )
                    .map((mat, index) => {
                      const materialColor = getMaterialColor(mat.materialId);
                      const amount = Number(mat.materialAmount);
                      const formattedAmount =
                        amount >= 1e18
                          ? formatCompact(amount / 1e18)
                          : formatCompact(amount);

                      return (
                        <MaterialItem key={index}>
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
                          <span
                            style={{
                              fontSize: "12px",
                              color: materialColor,
                              fontWeight: "bold",
                              alignItems: "right",
                            }}
                          >
                            {formattedAmount}
                          </span>
                        </MaterialItem>
                      );
                    })}
                </MaterialsGrid>
              </MaterialsSection>
            )}

            <StatRow>
              <StatLabel>Progress:</StatLabel>
              <StatValue>{progress.toFixed(1)}%</StatValue>
              <StatLabel>Remaining:</StatLabel>
              <StatValue>{formatTimeRemaining()}</StatValue>
            </StatRow>

            {voyage.artifactId && (
              <StatRow>
                <StatValue>
                  {(() => {
                    const artifact = uiManager.getArtifactWithId(
                      voyage.artifactId,
                    );
                    return artifact ? (
                      <ArtifactContainer
                        onMouseEnter={() => {
                          uiManager.setHoveringOverArtifact(artifact.id);
                        }}
                        onMouseLeave={() => {
                          uiManager.setHoveringOverArtifact(undefined);
                        }}
                      >
                        <ArtifactImage artifact={artifact} size={24} />
                        {/* <ArtifactIdText>
                      ID: {voyage.artifactId.slice(0, 8)}...
                    </ArtifactIdText> */}
                      </ArtifactContainer>
                    ) : (
                      `ID: ${voyage.artifactId.slice(0, 8)}...`
                    );
                  })()}
                </StatValue>
              </StatRow>
            )}

            <VoyageInfo>
              <StatRow>
                <StatLabel>Voyage ID:</StatLabel>
                <StatValue>{voyage.eventId.slice(0, 8)}...</StatValue>
              </StatRow>

              <StatRow>
                <StatLabel>Player:</StatLabel>
                <StatValue>{voyage.player.slice(0, 8)}...</StatValue>
              </StatRow>

              <StatRow>
                <StatLabel>Departure:</StatLabel>
                <StatValue>
                  {new Date(departureTime).toLocaleTimeString()}
                </StatValue>
              </StatRow>

              <StatRow>
                <StatLabel>Arrival:</StatLabel>
                <StatValue>
                  {new Date(arrivalTime).toLocaleTimeString()}
                </StatValue>
              </StatRow>
            </VoyageInfo>

            {/* Revert Button */}
            {canRevert && (
              <>
                {showConfirm ? (
                  <ConfirmDialog>
                    <ConfirmTitle>Reverse Move?</ConfirmTitle>
                    <ConfirmMessage>
                      Cost 50% resources and energy to revert.
                    </ConfirmMessage>
                    <ConfirmButtons>
                      <ConfirmButton
                        variant="confirm"
                        onClick={handleRevert}
                        disabled={isReverting}
                      >
                        {isReverting ? "Reversing..." : "Yes"}
                      </ConfirmButton>
                      <ConfirmButton
                        variant="cancel"
                        onClick={handleCancelRevert}
                        disabled={isReverting}
                      >
                        No
                      </ConfirmButton>
                    </ConfirmButtons>
                  </ConfirmDialog>
                ) : (
                  <RevertButton
                    onClick={handleRevert}
                    title="Reverse Move (only available in first half of journey and if source planet is still owned)"
                  >
                    ↶ Reverse Move
                  </RevertButton>
                )}
              </>
            )}
          </>
        )}
      </VoyageCardContainer>
    </div>
  );
}
