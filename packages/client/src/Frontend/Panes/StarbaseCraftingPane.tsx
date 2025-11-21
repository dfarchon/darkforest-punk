import { formatNumber, isLocatable } from "@df/gamelogic";
import { locationIdToHexStr } from "@df/serde";
import type { Planet, WorldCoords } from "@df/types";
import { MaterialType, PlanetType, SpaceType } from "@df/types";
import { getComponentValue } from "@latticexyz/recs";
import { encodeEntity } from "@latticexyz/store-sync/recs";
import { useMUD } from "@mud/MUDContext";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import styled from "styled-components";

import { Btn } from "../Components/Btn";
import { Red, Sub } from "../Components/Text";
import dfstyles from "../Styles/dfstyles";
import { useUIManager } from "../Utils/AppHooks";
import UIEmitter, { UIEmitterEvent } from "../Utils/UIEmitter";
import {
  getMaterialColor,
  getMaterialIcon,
  getMaterialName,
} from "./PlanetMaterialsPane";
import { getMaterialTooltipName, TooltipTrigger } from "./Tooltip";

const CraftingContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: 1em;
  padding: 1em;
  max-height: 500px;
  overflow-y: auto;
`;

const StarbaseInfo = styled.div`
  background: ${dfstyles.colors.background};
  border: 1px solid ${dfstyles.colors.border};
  border-radius: 4px;
  padding: 1em;
  margin-bottom: 1em;
`;

const MaterialRequirementRow = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.5em;
  margin: 0.25em 0;
  background: ${dfstyles.colors.backgroundlight};
  border-radius: 2px;
`;

const MaterialIcon = styled.span<{ color: string }>`
  color: ${(props) => props.color};
  font-size: 1em;
  margin-right: 0.5em;
  cursor: help;
`;

const ErrorMessage = styled.div`
  color: ${dfstyles.colors.dfred};
  margin-top: 0.5em;
  font-size: 0.9em;
`;

const SuccessMessage = styled.div`
  color: ${dfstyles.colors.dfgreen};
  margin-top: 0.5em;
  font-size: 0.9em;
`;

interface StarbaseCraftingPaneProps {
  planet: Planet;
  onClose: () => void;
  onCraftComplete?: () => void;
}

interface MaterialRequirement {
  materialType: MaterialType;
  amount: number;
  currentAmount: number;
}

const STARBASE_MATERIAL_REQUIREMENTS: MaterialRequirement[] = [
  { materialType: MaterialType.WINDSTEEL, amount: 500, currentAmount: 0 },
  { materialType: MaterialType.SCRAPIUM, amount: 400, currentAmount: 0 },
  { materialType: MaterialType.PYROSTEEL, amount: 300, currentAmount: 0 },
];

const StarbaseCraftingPane: React.FC<StarbaseCraftingPaneProps> = ({
  planet,
  onClose: _onClose,
  onCraftComplete,
}) => {
  const uiManager = useUIManager();
  const {
    components: { StarbasePlanet },
  } = useMUD();
  const [x, setX] = useState<number>(0);
  const [y, setY] = useState<number>(0);
  const [level, setLevel] = useState<number>(4);
  const [isCrafting, setIsCrafting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [choosingLocation, setChoosingLocation] = useState(false);
  const [previewCoords, setPreviewCoords] = useState<WorldCoords | null>(null);

  // Check if this planet already has a starbase (client-side validation)
  const hasExistingStarbase = useMemo(() => {
    if (!StarbasePlanet) return false;
    try {
      const planetEntityKey = encodeEntity(StarbasePlanet.metadata.keySchema, {
        planetHash: locationIdToHexStr(planet.locationId) as `0x${string}`,
      });
      const starbasePlanet = getComponentValue(StarbasePlanet, planetEntityKey);
      // If starbasePlanet exists and has a non-zero starbaseHash, planet already has a starbase
      return (
        starbasePlanet &&
        starbasePlanet.starbaseHash !==
          "0x0000000000000000000000000000000000000000000000000000000000000000"
      );
    } catch (e) {
      console.warn("Failed to check existing starbase:", e);
      return false;
    }
  }, [StarbasePlanet, planet.locationId]);

  // Get current material amounts
  const materialRequirements = useMemo(() => {
    return STARBASE_MATERIAL_REQUIREMENTS.map((req) => {
      const material = planet.materials?.find(
        (m) => m?.materialId === req.materialType,
      );
      const currentAmount = material ? Number(material.materialAmount) : 0;
      return {
        ...req,
        currentAmount,
      };
    });
  }, [planet.materials]);

  // Check if all materials are sufficient
  const hasEnoughMaterials = useMemo(() => {
    return materialRequirements.every((req) => req.currentAmount >= req.amount);
  }, [materialRequirements]);

  // Reset choosingLocation if materials become insufficient
  useEffect(() => {
    if (!hasEnoughMaterials && choosingLocation) {
      setChoosingLocation(false);
      setPreviewCoords(null);
    }
  }, [hasEnoughMaterials, choosingLocation]);

  // Calculate space type from coordinates
  const getSpaceType = useCallback(
    (coordX: number, coordY: number): SpaceType => {
      // Access df (GameManager) from window if available
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if (typeof window !== "undefined" && (window as any).df) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const df = (window as any).df;
        if (df.spaceTypeFromPerlin && df.biomebasePerlin) {
          try {
            const coords = { x: coordX, y: coordY };
            const perlin = df.biomebasePerlin(coords, true);
            const distFromOrigin = Math.sqrt(coordX ** 2 + coordY ** 2);
            return df.spaceTypeFromPerlin(perlin, distFromOrigin);
          } catch (e) {
            console.warn("Failed to calculate space type:", e);
          }
        }
      }
      // Fallback to SPACE if calculation fails
      return SpaceType.SPACE;
    },
    [],
  );

  // Handle location selection from map click
  const handleLocationClick = useCallback(
    async (coords: WorldCoords) => {
      if (choosingLocation) {
        const newX = Math.round(coords.x);
        const newY = Math.round(coords.y);
        setX(newX);
        setY(newY);
        setChoosingLocation(false);
        setPreviewCoords(null);

        // Automatically trigger starbase creation after coordinate selection
        // Validate before creating
        if (!isLocatable(planet)) {
          setError("Planet must be locatable");
          return;
        }

        if (hasExistingStarbase) {
          setError(
            "This planet has already crafted a starbase. Only one starbase per planet is allowed.",
          );
          return;
        }

        if (!hasEnoughMaterials) {
          setError("Insufficient materials");
          return;
        }

        if (planet.planetLevel < 4) {
          setError("Source planet must be level 4 or higher");
          return;
        }

        if (planet.planetType !== PlanetType.PLANET) {
          setError("Source planet must be a PLANET type");
          return;
        }

        setError(null);
        setSuccess(null);
        setIsCrafting(true);

        try {
          const spaceType = getSpaceType(newX, newY);

          // Call the contract through UIManager (same pattern as craftSpaceship/craftModule)
          await uiManager.createStarBase(
            planet.locationId,
            newX,
            newY,
            level,
            spaceType,
          );

          setSuccess("Starbase created successfully!");
          if (onCraftComplete) {
            onCraftComplete();
          }
        } catch (err: unknown) {
          console.error("Failed to create starbase:", err);
          const errorMessage =
            err instanceof Error ? err.message : "Failed to create starbase";
          setError(errorMessage);
        } finally {
          setIsCrafting(false);
        }
      }
    },
    [
      choosingLocation,
      planet,
      hasEnoughMaterials,
      level,
      uiManager,
      onCraftComplete,
      getSpaceType,
    ],
  );

  const handleLocationPreview = useCallback(
    (coords: WorldCoords) => {
      if (choosingLocation) {
        setPreviewCoords(coords);
      }
    },
    [choosingLocation],
  );

  // Set up event listeners for location selection
  useEffect(() => {
    if (choosingLocation && isLocatable(planet)) {
      // Notify renderer to show red circle
      uiManager.setChoosingStarbaseLocationPlanet(planet);
      const uiEmitter = UIEmitter.getInstance();
      uiEmitter.on(UIEmitterEvent.WorldMouseClick, handleLocationClick);
      uiEmitter.on(UIEmitterEvent.WorldMouseMove, handleLocationPreview);

      return () => {
        // Clear renderer state when done
        uiManager.setChoosingStarbaseLocationPlanet(undefined);
        uiEmitter.off(UIEmitterEvent.WorldMouseClick, handleLocationClick);
        uiEmitter.off(UIEmitterEvent.WorldMouseMove, handleLocationPreview);
      };
    } else {
      // Clear renderer state when not choosing
      uiManager.setChoosingStarbaseLocationPlanet(undefined);
    }
    return () => {};
  }, [
    choosingLocation,
    handleLocationClick,
    handleLocationPreview,
    planet,
    uiManager,
  ]);

  return (
    <CraftingContainer>
      <StarbaseInfo>
        <Sub>
          Craft a starbase at empty coordinates. Requires a level 4+ planet with
          sufficient materials.
        </Sub>
      </StarbaseInfo>
      <div>
        {(() => {
          if (hasExistingStarbase) {
            return (
              <Sub style={{ marginTop: "0.5em", color: dfstyles.colors.dfred }}>
                This planet has already crafted a starbase. Only one starbase
                per planet is allowed.
              </Sub>
            );
          }

          if (!hasEnoughMaterials) {
            return (
              <Sub style={{ marginTop: "0.5em", color: dfstyles.colors.dfred }}>
                Gather required materials to select starbase location
              </Sub>
            );
          }

          return (
            <>
              {!choosingLocation ? (
                <>
                  <div style={{ marginTop: "0.5em" }}>
                    <Btn onClick={() => setChoosingLocation(true)}>
                      Choose Location on Map
                    </Btn>
                  </div>
                </>
              ) : (
                <div>
                  {(() => {
                    let isOutOfRange = false;
                    if (previewCoords && isLocatable(planet)) {
                      const distance = uiManager.getDistCoords(
                        planet.location.coords,
                        previewCoords,
                      );
                      const maxAllowedDistance = planet.range * 0.5;
                      isOutOfRange = distance > maxAllowedDistance;
                    }
                    return (
                      <Sub
                        style={{
                          marginTop: "0.5em",
                          color: isOutOfRange
                            ? dfstyles.colors.dfred
                            : dfstyles.colors.dfgreen,
                        }}
                      >
                        {previewCoords
                          ? `Click on map to place starbase at (${Math.round(previewCoords.x)}, ${Math.round(previewCoords.y)})`
                          : "Move mouse over map to preview location, then click to select"}
                      </Sub>
                    );
                  })()}
                  <div style={{ marginTop: "0.5em" }}>
                    <Btn
                      onClick={() => {
                        setChoosingLocation(false);
                        setPreviewCoords(null);
                      }}
                    >
                      Cancel Selection
                    </Btn>
                  </div>
                </div>
              )}
              <Sub style={{ marginTop: "0.5em" }}>
                Coordinates must be empty (no existing planet or starbase)
              </Sub>
            </>
          );
        })()}
      </div>
      <div>
        {!hasExistingStarbase && (
          <>
            {" "}
            <h4>Material Requirements:</h4>
            {materialRequirements.map((req) => {
              const hasEnough = req.currentAmount >= req.amount;
              const materialColor = getMaterialColor(req.materialType);
              return (
                <TooltipTrigger
                  key={req.materialType}
                  name={getMaterialTooltipName(req.materialType)}
                >
                  <MaterialRequirementRow>
                    <div style={{ display: "flex", alignItems: "center" }}>
                      <MaterialIcon color={materialColor}>
                        {getMaterialIcon(req.materialType, 24)}
                      </MaterialIcon>
                      <span>{getMaterialName(req.materialType)}</span>
                    </div>
                    <div>
                      <span
                        style={{
                          color: hasEnough
                            ? dfstyles.colors.dfgreen
                            : dfstyles.colors.dfred,
                        }}
                      >
                        {formatNumber(req.currentAmount)} /{" "}
                        {formatNumber(req.amount)}
                      </span>
                    </div>
                  </MaterialRequirementRow>
                </TooltipTrigger>
              );
            })}{" "}
          </>
        )}
      </div>

      {error && <ErrorMessage>{error}</ErrorMessage>}
      {success && <SuccessMessage>{success}</SuccessMessage>}

      {!hasEnoughMaterials && (
        <Red style={{ marginTop: "0.5em" }}>
          Insufficient materials to craft starbase
        </Red>
      )}

      {planet.planetLevel < 4 && (
        <Red style={{ marginTop: "0.5em" }}>
          Source planet must be level 4 or higher
        </Red>
      )}
    </CraftingContainer>
  );
};

export default StarbaseCraftingPane;
