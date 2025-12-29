import type { CanvasCoords, QueuedArrival, WorldCoords } from "@df/types";
import { useState } from "react";

import { useMoveRevert } from "../../hooks/useMoveRevert";

interface MoveRevertButtonProps {
  voyage: QueuedArrival;
  worldCoords: WorldCoords;
  viewport: {
    worldToCanvasCoords: (coords: WorldCoords) => CanvasCoords;
    worldToCanvasDist: (dist: number) => number;
  };
  onRevert?: () => void;
}

export function MoveRevertButton({
  voyage,
  worldCoords,
  viewport,
  onRevert,
}: MoveRevertButtonProps) {
  const { canRevertMove, revertMove } = useMoveRevert();
  const [isReverting, setIsReverting] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const canRevert = canRevertMove(voyage);

  if (!canRevert) {
    return null;
  }

  const screenCoords = viewport.worldToCanvasCoords(worldCoords);
  const buttonSize = Math.max(24, viewport.worldToCanvasDist(12)); // Make button larger

  const handleRevert = async () => {
    if (!showConfirm) {
      setShowConfirm(true);
      return;
    }

    setIsReverting(true);
    try {
      await revertMove(voyage);
      onRevert?.();
    } catch (error) {
      console.error("Failed to revert move:", error);
      // TODO: Show error message to user
    } finally {
      setIsReverting(false);
      setShowConfirm(false);
    }
  };

  const handleCancel = () => {
    setShowConfirm(false);
  };

  return (
    <div
      style={{
        position: "absolute",
        left: screenCoords.x - buttonSize / 2,
        top: screenCoords.y + buttonSize + 4,
        zIndex: 1000,
      }}
    >
      {showConfirm ? (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "4px",
            backgroundColor: "rgba(0, 0, 0, 0.8)",
            padding: "8px",
            borderRadius: "4px",
            border: "1px solid #ff6b6b",
            minWidth: "120px",
          }}
        >
          <div
            style={{
              color: "#ff6b6b",
              fontSize: "12px",
              fontWeight: "bold",
              textAlign: "center",
            }}
          >
            Reverse Move?
          </div>
          <div
            style={{
              color: "#fff",
              fontSize: "10px",
              textAlign: "center",
              marginBottom: "4px",
              width: "50%",
              margin: "0 auto",
            }}
          >
            Revert costs 50% resources.
          </div>
          <div style={{ display: "flex", gap: "4px" }}>
            <button
              onClick={handleRevert}
              disabled={isReverting}
              style={{
                flex: 1,
                padding: "4px 8px",
                backgroundColor: "#ff6b6b",
                color: "white",
                border: "none",
                borderRadius: "2px",
                fontSize: "10px",
                cursor: isReverting ? "not-allowed" : "pointer",
                opacity: isReverting ? 0.6 : 1,
              }}
            >
              {isReverting ? "Reversing..." : "Yes"}
            </button>
            <button
              onClick={handleCancel}
              disabled={isReverting}
              style={{
                flex: 1,
                padding: "4px 8px",
                backgroundColor: "#666",
                color: "white",
                border: "none",
                borderRadius: "2px",
                fontSize: "10px",
                cursor: isReverting ? "not-allowed" : "pointer",
              }}
            >
              No
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={handleRevert}
          style={{
            width: buttonSize,
            height: buttonSize,
            backgroundColor: "rgba(255, 107, 107, 0.95)",
            border: "3px solid #ff6b6b",
            borderRadius: "50%",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "12px",
            color: "white",
            fontWeight: "bold",
            boxShadow:
              "0 0 10px rgba(255, 107, 107, 0.8), 0 2px 4px rgba(0, 0, 0, 0.5)",
            transition: "all 0.2s ease",
            zIndex: 1000,
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = "rgba(255, 107, 107, 1)";
            e.currentTarget.style.transform = "scale(1.1)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = "rgba(255, 107, 107, 0.9)";
            e.currentTarget.style.transform = "scale(1)";
          }}
          title="Reverse Move (only available in first half of journey and if source planet is still owned)"
        >
          ↶
        </button>
      )}
    </div>
  );
}
