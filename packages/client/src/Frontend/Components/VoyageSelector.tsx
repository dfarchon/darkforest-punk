import type { CanvasCoords, QueuedArrival, WorldCoords } from "@df/types";

import { useUIManager } from "../Utils/AppHooks";

interface VoyageSelectorProps {
  voyage: QueuedArrival;
  worldCoords: WorldCoords;
  viewport: {
    worldToCanvasCoords: (coords: WorldCoords) => CanvasCoords;
    worldToCanvasDist: (dist: number) => number;
  };
  onSelect: (voyage: QueuedArrival) => void;
}

export function VoyageSelector({
  voyage,
  worldCoords,
  viewport,
  onSelect,
}: VoyageSelectorProps) {
  const uiManager = useUIManager();
  const selectedVoyage = uiManager.getSelectedVoyage();
  const isSelected =
    selectedVoyage && selectedVoyage.eventId === voyage.eventId;

  const screenCoords = viewport.worldToCanvasCoords(worldCoords);
  const selectorSize = Math.max(20, viewport.worldToCanvasDist(10));

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onSelect(voyage);
  };

  const handleMouseEnter = () => {
    console.log("VoyageSelector: Mouse enter on voyage", voyage.eventId);
    uiManager.setHoveringOverVoyage(voyage);
  };

  const handleMouseLeave = () => {
    console.log("VoyageSelector: Mouse leave on voyage", voyage.eventId);
    uiManager.setHoveringOverVoyage(undefined);
  };

  return (
    <div
      style={{
        position: "absolute",
        left: screenCoords.x - selectorSize / 2,
        top: screenCoords.y - selectorSize / 2,
        zIndex: 500,
      }}
    >
      <button
        onClick={handleClick}
        style={{
          width: selectorSize,
          height: selectorSize,
          backgroundColor: isSelected
            ? "rgba(0, 255, 255, 0.8)"
            : "rgba(255, 255, 255, 0.6)",
          border: isSelected ? "2px solid #00ffff" : "2px solid #ffffff",
          borderRadius: "50%",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: "10px",
          color: "white",
          fontWeight: "bold",
          boxShadow: isSelected
            ? "0 0 15px rgba(0, 255, 255, 0.8), 0 2px 4px rgba(0, 0, 0, 0.5)"
            : "0 2px 4px rgba(0, 0, 0, 0.3)",
          transition: "all 0.2s ease",
        }}
        onMouseEnter={(e) => {
          handleMouseEnter();
          if (!isSelected) {
            e.currentTarget.style.backgroundColor = "rgba(255, 255, 255, 0.8)";
            e.currentTarget.style.transform = "scale(1.1)";
          }
        }}
        onMouseLeave={(e) => {
          handleMouseLeave();
          if (!isSelected) {
            e.currentTarget.style.backgroundColor = "rgba(255, 255, 255, 0.6)";
            e.currentTarget.style.transform = "scale(1)";
          }
        }}
        title={`Click to select voyage ${voyage.eventId}`}
      >
        {isSelected ? "✓" : "○"}
      </button>
    </div>
  );
}
