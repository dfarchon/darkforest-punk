import { useMemo, useState } from "react";
import styled from "styled-components";
import type { LocationId, ArtifactRarity, Artifact } from "@df/types";
import { PlanetType, Biome } from "@df/types";
import { formatEtherToNumber, isLocatable } from "@df/gamelogic";

import { Btn } from "../Components/Btn";
import { CenterBackgroundSubtext, Spacer, Section } from "../Components/CoreUI";
import { LoadingSpinner } from "../Components/LoadingSpinner";
import { Gold, Red, Sub } from "../Components/Text";
import { useAccount, usePlanet, useUIManager } from "../Utils/AppHooks";
import { useEmitterValue } from "../Utils/EmitterHooks";
import type { ModalHandle } from "../Views/ModalPane";
import { useFoundryUpgradeLevel } from "../../hooks/useFoundryUpgrade";

const SECTION_MARGIN = "0.75em";

const SectionBuy = styled.div`
  margin-top: ${SECTION_MARGIN};
`;

const CostBreakdown = styled.div`
  margin-top: 8px;
  padding: 8px;
  background-color: rgba(0, 0, 0, 0.3);
  border-radius: 4px;
  font-size: 12px;
`;

export function FoundryUpgradePane({
  initialPlanetId,
  modal: _modal,
}: {
  modal: ModalHandle;
  initialPlanetId: LocationId | undefined;
}) {
  const uiManager = useUIManager();
  const planetId = useEmitterValue(
    uiManager.selectedPlanetId$,
    initialPlanetId,
  );
  const planet = usePlanet(uiManager, planetId).value;
  const account = useAccount(uiManager);
  const { level, maxCrafts } = useFoundryUpgradeLevel(planetId);
  const [isUpgrading, setIsUpgrading] = useState(false);

  if (!planet || !account) {
    return (
      <CenterBackgroundSubtext width="100%" height="75px">
        Select a Foundry <br /> You Own
      </CenterBackgroundSubtext>
    );
  }

  if (planet.planetType !== PlanetType.RUINS) {
    return (
      <CenterBackgroundSubtext width="100%" height="75px">
        This Planet <br /> is not a Foundry
      </CenterBackgroundSubtext>
    );
  }

  const canUpgrade = level < 2;
  const nextLevel = level + 1;

  // Calculate upgrade cost
  const upgradeCost = useMemo(() => {
    const baseFee =
      level === 0
        ? BigInt(50_000_000_000_000) // 0.00005 ETH
        : BigInt(10_000_000_000_000); // 0.0001 ETH

    // Get biome from locatable planet
    const planetBiome = isLocatable(planet) ? planet.biome : Biome.OCEAN;

    // Get artifacts from planet
    const artifacts = uiManager
      .getArtifactsWithIds(planet.heldArtifactIds || [])
      .filter((a): a is Artifact => a !== undefined);

    // Biome multiplier
    const biomeMultiplier = getBiomeMultiplier(planetBiome);

    // Get highest artifact rarity on planet
    const highestRarity = getHighestArtifactRarity(artifacts);
    const rarityMultiplier = getRarityMultiplier(highestRarity);

    // Total fee = baseFee * biomeMultiplier * rarityMultiplier / 10000
    const totalFee =
      (baseFee * BigInt(biomeMultiplier) * BigInt(rarityMultiplier)) /
      BigInt(10000);

    return {
      eth: totalFee,
      biomeMultiplier,
      rarityMultiplier,
      baseFee,
    };
  }, [level, planet, uiManager]);

  const handleUpgrade = async () => {
    if (canUpgrade && !isUpgrading) {
      setIsUpgrading(true);
      try {
        await uiManager.upgradeFoundry(planet.locationId);
      } catch (error) {
        console.error("Failed to upgrade foundry:", error);
      } finally {
        setIsUpgrading(false);
      }
    }
  };

  return (
    <div>
      <Section>
        <div>
          <Sub>Current Branch</Sub>: {level} / 2
        </div>
        <div>
          <Sub>Max Crafts</Sub>: {maxCrafts} / 3
        </div>
      </Section>

      {canUpgrade && (
        <>
          <SectionBuy>
            <Sub>Upgrade to Level {nextLevel}</Sub>
            <div>
              <Sub>ETH Cost</Sub>:{" "}
              <Gold>
                {formatEtherToNumber(upgradeCost.eth.toString()).toFixed(8)} ETH
              </Gold>
              <CostBreakdown>
                <div>
                  Base:{" "}
                  {formatEtherToNumber(upgradeCost.baseFee.toString()).toFixed(
                    8,
                  )}{" "}
                  ETH
                </div>
                <div>
                  Biome Multiplier: {upgradeCost.biomeMultiplier / 100}x
                </div>
                <div>
                  Rarity Multiplier: {upgradeCost.rarityMultiplier / 100}x
                </div>
              </CostBreakdown>
            </div>
            <Spacer height={8} />
            {isUpgrading ? (
              <Btn disabled={true}>
                <LoadingSpinner initialText="Upgrading..." />
              </Btn>
            ) : (
              <Btn onClick={handleUpgrade} disabled={!canUpgrade}>
                Upgrade Foundry
              </Btn>
            )}
          </SectionBuy>
        </>
      )}

      {!canUpgrade && <Red>Foundry at Maximum Upgrade Level</Red>}
    </div>
  );
}

function getBiomeMultiplier(biome: Biome): number {
  const b = biome;
  if (b >= 1 && b <= 3) return 100;
  if (b >= 4 && b <= 6) return 150;
  if (b >= 7 && b <= 9) return 200;
  if (b === 10) return 250;
  return 100;
}

function getRarityMultiplier(rarity: ArtifactRarity): number {
  // ArtifactRarity enum values: UNKNOWN=0, COMMON=1, RARE=2, EPIC=3, LEGENDARY=4, MYTHIC=5
  if (rarity === 1) return 100; // COMMON
  if (rarity === 2) return 120; // RARE
  if (rarity === 3) return 150; // EPIC
  if (rarity === 4) return 200; // LEGENDARY
  if (rarity === 5) return 300; // MYTHIC
  return 100; // UNKNOWN or default
}

function getHighestArtifactRarity(artifacts: Artifact[]): ArtifactRarity {
  if (!artifacts || artifacts.length === 0) {
    return 1 as ArtifactRarity; // COMMON as default
  }

  let highest = 1 as ArtifactRarity; // COMMON
  for (const artifact of artifacts) {
    if (artifact && artifact.rarity > highest) {
      highest = artifact.rarity;
    }
  }
  return highest;
}
