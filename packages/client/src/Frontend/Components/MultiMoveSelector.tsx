import React, { useEffect, useRef } from "react";
import styled from "styled-components";
import type { QueuedArrival } from "@df/types";
import { formatCompact, formatNumber } from "@df/gamelogic";
import { useUIManager } from "../Utils/AppHooks";
import dfstyles from "../Styles/dfstyles";
import { Icon, IconType } from "../Components/Icons";
import { getPlanetName } from "@df/procedural";
import { TooltipTrigger } from "../Panes/Tooltip";
import { TooltipName } from "@df/types";
import { BiomeTextColors } from "../Styles/Colors";
import { Biome } from "@df/types";

const Container = styled.div`
  position: absolute;
  background: ${dfstyles.colors.background};
  border: 1px solid #444;
  border-radius: 8px;
  padding: 4px;
  z-index: 1000;
  min-width: 250px;
  max-width: 250px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5);
`;

const Header = styled.div`
  color: #fff;
  font-size: 14px;
  font-weight: bold;
  margin-bottom: 8px;
  text-align: center;
  border-bottom: 1px solid #444;
  padding-bottom: 0px;
`;

const MoveList = styled.div`
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 4px;
  margin-bottom: 4px;
`;

const MoveItem = styled.div<{ isSelected?: boolean }>`
  display: flex;
  flex-direction: column;
  padding: 0px;
  background: ${(props) => (props.isSelected ? "#333" : "transparent")};
  border: 1px solid ${(props) => (props.isSelected ? "#666" : "#444")};
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s ease;
  min-height: 40px;

  &:hover {
    background: #333;
    border-color: #666;
  }
`;

const MoveInfo = styled.div`
  display: flex;
  flex-direction: column;
  gap: 2px;
  align-items: center;
  justify-content: center;
`;

const MoveId = styled.div`
  color: #fff;
  font-size: 12px;
  font-weight: bold;
  align-items: center;
  justify-content: center;
`;

const MoveDetails = styled.div`
  color: #aaa;
  font-size: 11px;
  display: flex;
  flex-direction: column;
  gap: 2px;
`;

const MoveDetailRow = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 4px;
  font-size: 10px;
`;

const MoveStatus = styled.div<{ status: "active" | "reverted" | "completed" }>`
  font-size: 10px;
  padding: 2px 6px;
  border-radius: 3px;
  font-weight: bold;
  text-transform: uppercase;

  ${(props) => {
    switch (props.status) {
      case "active":
        return "background: #2d5a2d; color: #4ade4a;";
      case "reverted":
        return "background: #5a2d2d; color: #de4a4a;";
      case "completed":
        return "background: #2d2d5a; color: #4a4ade;";
      default:
        return "background: #444; color: #aaa;";
    }
  }}
`;

const DirectionGroup = styled.div`
  margin-bottom: 8px;
`;

const DirectionHeader = styled.div`
  color: #888;
  font-size: 11px;
  font-weight: bold;
  margin-bottom: 4px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  display: flex;
  gap: 8px;
  align-items: center;
`;

const PlanetName = styled.span<{ biomeColor?: string }>`
  color: ${(props) => props.biomeColor || "#4a9eff"};
  cursor: pointer;
  transition: color 0.2s ease;

  &:hover {
    color: ${(props) => props.biomeColor || "#66b3ff"};
    text-decoration: underline;
  }
`;

const Arrow = styled.span`
  color: #888;
  user-select: none;
`;

interface MultiMoveSelectorProps {
  moves: QueuedArrival[];
  selectedMoveId?: string;
  onSelectMove: (move: QueuedArrival) => void;
  onClose: () => void;
  position: { x: number; y: number };
}

export function MultiMoveSelector({
  moves,
  selectedMoveId,
  onSelectMove,
  onClose,
  position,
}: MultiMoveSelectorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const uiManager = useUIManager();

  // Handle clicking outside to close the selector
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        onClose();
      }
    };

    // Add a longer delay to prevent immediate closing and allow stable interaction
    const timeoutId = setTimeout(() => {
      document.addEventListener("mousedown", handleClickOutside);
    }, 500);

    return () => {
      clearTimeout(timeoutId);
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [onClose]);

  // Group moves by direction (from -> to)
  const groupedMoves = moves.reduce(
    (groups, move) => {
      const key = `${move.fromPlanet}-${move.toPlanet}`;
      if (!groups[key]) {
        groups[key] = [];
      }
      groups[key].push(move);
      return groups;
    },
    {} as Record<string, QueuedArrival[]>,
  );

  const handleMoveClick = (move: QueuedArrival) => {
    onSelectMove(move);
    // Don't close the selector automatically - let user see the details
    // The selector will stay open until they click outside or select another move
  };

  const getMoveStatus = (
    move: QueuedArrival,
  ): "active" | "reverted" | "completed" => {
    // This would need to be implemented based on your game logic
    // For now, we'll assume all moves are active
    return "active";
  };

  const formatMoveId = (moveId: string) => {
    return `#${moveId.slice(-6)}`;
  };

  const formatMoveTime = (move: QueuedArrival) => {
    // Use the same logic as SelectedVoyagePane
    const currentTime = Date.now();
    const arrivalTime = uiManager.convertTickToMs(move.arrivalTick);
    const timeLeft = arrivalTime - currentTime;

    if (timeLeft <= 0) return "Arrived";

    const minutes = Math.floor(timeLeft / 60000);
    const seconds = Math.floor((timeLeft % 60000) / 1000);
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  };

  const formatProgress = (move: QueuedArrival) => {
    // Use the same logic as SelectedVoyagePane
    const currentTime = Date.now();
    const departureTime = uiManager.convertTickToMs(move.departureTick);
    const arrivalTime = uiManager.convertTickToMs(move.arrivalTick);
    const totalJourneyTime = arrivalTime - departureTime;
    const elapsedTime = currentTime - departureTime;
    const progress = Math.max(
      0,
      Math.min(100, (elapsedTime / totalJourneyTime) * 100),
    );

    return `${progress.toFixed(1)}%`;
  };

  return (
    <Container
      ref={containerRef}
      style={{
        left: position.x,
        top: position.y,
      }}
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <Header>Moves Detected ({moves.length})</Header>

      {Object.entries(groupedMoves).map(([direction, directionMoves]) => {
        const fromPlanet = uiManager.getPlanetWithId(
          directionMoves[0].fromPlanet,
        );
        const toPlanet = uiManager.getPlanetWithId(directionMoves[0].toPlanet);

        const fromPlanetName =
          getPlanetName(fromPlanet) ||
          `${directionMoves[0].fromPlanet.slice(0, 8)}...`;
        const toPlanetName =
          getPlanetName(toPlanet) ||
          `${directionMoves[0].toPlanet.slice(0, 8)}...`;

        // Get biome colors for planet names
        const fromPlanetBiomeColor = fromPlanet?.biome
          ? BiomeTextColors[fromPlanet.biome]
          : undefined;
        const toPlanetBiomeColor = toPlanet?.biome
          ? BiomeTextColors[toPlanet.biome]
          : undefined;

        return (
          <DirectionGroup key={direction}>
            <DirectionHeader>
              <TooltipTrigger name={TooltipName.Planet}>
                <PlanetName
                  biomeColor={fromPlanetBiomeColor}
                  onClick={(e) => {
                    e.stopPropagation();
                    uiManager.setSelectedPlanet(fromPlanet);
                  }}
                  onMouseEnter={() => {
                    uiManager.setHoveringOverPlanet(fromPlanet);
                  }}
                  onMouseLeave={() => {
                    uiManager.setHoveringOverPlanet(undefined);
                  }}
                  title={`Click to select ${fromPlanetName}`}
                >
                  {fromPlanetName}
                </PlanetName>
              </TooltipTrigger>
              <Arrow>→</Arrow>
              <TooltipTrigger name={TooltipName.Planet}>
                <PlanetName
                  biomeColor={toPlanetBiomeColor}
                  onClick={(e) => {
                    e.stopPropagation();
                    uiManager.setSelectedPlanet(toPlanet);
                  }}
                  onMouseEnter={() => {
                    uiManager.setHoveringOverPlanet(toPlanet);
                  }}
                  onMouseLeave={() => {
                    uiManager.setHoveringOverPlanet(undefined);
                  }}
                  title={`Click to select ${toPlanetName}`}
                >
                  {toPlanetName}
                </PlanetName>
              </TooltipTrigger>
            </DirectionHeader>
            <MoveList>
              {directionMoves.map((move) => (
                <MoveItem
                  key={move.eventId}
                  isSelected={selectedMoveId === move.eventId}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleMoveClick(move);
                  }}
                >
                  <MoveInfo>
                    {/* <MoveId>{formatMoveId(move.eventId)}</MoveId> */}
                    <MoveDetails>
                      <MoveDetailRow>
                        <span>{formatMoveTime(move)}</span>{" "}
                        <span>{formatProgress(move)}</span>
                      </MoveDetailRow>
                      <MoveDetailRow>
                        <span>
                          <Icon type={IconType.Energy} />{" "}
                          {formatNumber(move.energyArriving)}
                        </span>
                      </MoveDetailRow>
                    </MoveDetails>
                  </MoveInfo>
                </MoveItem>
              ))}
            </MoveList>
          </DirectionGroup>
        );
      })}
    </Container>
  );
}
