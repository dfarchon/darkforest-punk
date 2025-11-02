import { useCallback, useEffect, useState } from "react";
import { useUIManager } from "../Utils/AppHooks";
import { VoyageSelector } from "./VoyageSelector";
import Viewport from "../Game/Viewport";

export function VoyageSelectors() {
  const uiManager = useUIManager();
  const [voyages, setVoyages] = useState<unknown[]>([]);
  const [viewport, setViewport] = useState<unknown>(null);

  // Get all voyages
  useEffect(() => {
    const updateVoyages = () => {
      const allVoyages = uiManager.getAllVoyages();
      setVoyages(allVoyages);
    };

    updateVoyages();

    // Update voyages periodically
    const interval = setInterval(updateVoyages, 1000);
    return () => clearInterval(interval);
  }, [uiManager]);

  // Get viewport instance
  useEffect(() => {
    const updateViewport = () => {
      const viewportInstance = Viewport.getInstance();
      if (viewportInstance) {
        setViewport(viewportInstance);
      }
    };

    updateViewport();

    // Update viewport periodically
    const interval = setInterval(updateViewport, 100);
    return () => clearInterval(interval);
  }, []);

  const handleVoyageSelect = useCallback(
    (voyage: unknown) => {
      console.log("VoyageSelectors: Selecting voyage", voyage.eventId);
      uiManager.setSelectedVoyage(voyage);
    },
    [uiManager],
  );

  if (!viewport) {
    return null;
  }

  return (
    <>
      {voyages.map((voyage) => {
        // Calculate voyage position (midpoint between from and to planets)
        const fromPlanet = uiManager.getPlanetWithId(voyage.fromPlanet);
        const toPlanet = uiManager.getPlanetWithId(voyage.toPlanet);

        if (!fromPlanet || !toPlanet) {
          return null;
        }

        // Calculate midpoint
        const midX =
          (fromPlanet.location.coords.x + toPlanet.location.coords.x) / 2;
        const midY =
          (fromPlanet.location.coords.y + toPlanet.location.coords.y) / 2;

        const worldCoords = { x: midX, y: midY };

        return (
          <VoyageSelector
            key={voyage.eventId}
            voyage={voyage}
            worldCoords={worldCoords}
            viewport={viewport}
            onSelect={handleVoyageSelect}
          />
        );
      })}
    </>
  );
}
