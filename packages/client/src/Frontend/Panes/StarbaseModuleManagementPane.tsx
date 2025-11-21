import { EMPTY_ADDRESS } from "@df/constants";
import { artifactIdFromHexStr } from "@df/serde";
import type { Artifact, ArtifactId, LocationId, ModuleType } from "@df/types";
import { ArtifactRarity, ArtifactType, Biome } from "@df/types";
import { useMUD } from "@mud/MUDContext";
import { useEffect, useMemo, useState } from "react";
import styled from "styled-components";

import { locationIdToHexStr } from "../../Shared/serde/location";
import { ArtifactImage } from "../Components/ArtifactImage";
import { Btn } from "../Components/Btn";
import { Spacer } from "../Components/CoreUI";
import { Green, Red, Text, White } from "../Components/Text";
import dfstyles from "../Styles/dfstyles";
import { useUIManager } from "../Utils/AppHooks";

enum ModuleSlotType {
  ENGINES = 1,
  WEAPONS = 2,
  HULL = 3,
  SHIELD = 4,
}

// Mirror contract limits (StarbaseModuleSystem.sol lines 31-34)
const SLOT_LIMITS: Record<number, number> = {
  [ModuleSlotType.ENGINES]: 0,
  [ModuleSlotType.WEAPONS]: 4,
  [ModuleSlotType.HULL]: 4,
  [ModuleSlotType.SHIELD]: 4,
};

const ModuleSlotNames = {
  [ModuleSlotType.ENGINES]: "Engines",
  [ModuleSlotType.WEAPONS]: "Weapons",
  [ModuleSlotType.HULL]: "Hull",
  [ModuleSlotType.SHIELD]: "Shield",
};

const PaneContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: 16px;
`;

const SlotSection = styled.div`
  border: 1px solid ${dfstyles.colors.border};
  border-radius: 4px;
  padding: 12px;
  background-color: ${dfstyles.colors.backgroundlight};
`;

const SlotHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
`;

const SlotContent = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
`;

const ModuleItem = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px;
  background-color: ${dfstyles.colors.background};
  border-radius: 4px;
`;

const ArtifactImageWrapper = styled.div`
  cursor: help;
  display: inline-block;
`;

const EmptySlot = styled.div`
  padding: 8px;
  color: ${dfstyles.colors.subtext};
  font-style: italic;
  text-align: center;
`;

interface InstalledModule {
  moduleId: string;
  moduleSlotType: number;
  artifact?: Artifact;
}

interface ModuleDisplayItem {
  moduleId: string;
  moduleSlotType: number;
  artifact?: Artifact;
  isInstalled: boolean;
}

export function StarbaseModuleManagementPane({
  planetId,
}: {
  planetId: LocationId;
}): JSX.Element {
  const uiManager = useUIManager();
  const gameManager = uiManager.getGameManager();
  const {
    components: { StarBaseModuleInstalled, CraftedModules },
  } = useMUD();

  // local refresh key to force recompute when we know changes occurred
  const [refreshKey, setRefreshKey] = useState(0);

  const planet = uiManager.getPlanetWithId(planetId);
  if (!planet) {
    return (
      <PaneContainer>
        <Red>Starbase not found.</Red>
      </PaneContainer>
    );
  }

  const starbaseHashHex = locationIdToHexStr(planetId).toLowerCase();

  const getModuleTypeForId = (moduleIdHex: ArtifactId): number | undefined => {
    const moduleTypeMap = CraftedModules?.values?.moduleType;
    if (!moduleTypeMap) return undefined;
    const idHex = (moduleIdHex as string).toLowerCase();
    const cleanHex = idHex.startsWith("0x") ? idHex.slice(2) : idHex;
    const moduleIdNum = parseInt(cleanHex, 16);
    const numericStr = moduleIdNum.toString();
    const hexStr = moduleIdNum.toString(16);
    for (const [key, value] of moduleTypeMap.entries()) {
      const keyString = key.toString().toLowerCase();
      if (
        keyString.includes(cleanHex) ||
        keyString.includes(numericStr) ||
        keyString.includes(hexStr)
      ) {
        return value as number;
      }
    }
    return undefined;
  };

  const normalizeSlotType = (raw: number | undefined): number | undefined => {
    if (raw === undefined) return undefined;
    if (raw === 0) return ModuleSlotType.ENGINES;
    return raw;
  };

  const installedModules = useMemo(() => {
    const result: InstalledModule[] = [];
    const valuesAny = (
      StarBaseModuleInstalled as unknown as { values?: unknown }
    ).values as Record<string, unknown> | undefined;
    const sbMap =
      (valuesAny?.["starbaseHash"] as Map<unknown, unknown>) || undefined;
    const slotTypeMap = StarBaseModuleInstalled?.values?.moduleSlotType;
    const installedFlagMap = StarBaseModuleInstalled?.values?.installed;
    if (!sbMap || !slotTypeMap || !installedFlagMap) return result;

    for (const [moduleIdKey, storedStarbaseHash] of sbMap.entries()) {
      if (installedFlagMap.get(moduleIdKey) !== true) continue;
      const storedHex =
        typeof storedStarbaseHash === "string"
          ? (storedStarbaseHash as string).toLowerCase()
          : String(storedStarbaseHash).toLowerCase();
      if (storedHex !== starbaseHashHex) continue;

      const keyString = moduleIdKey.toString();
      const hexMatch = keyString.match(/0x([0-9a-fA-F]+)/);
      if (!hexMatch) continue;
      const idHex = ("0x" + hexMatch[1]) as ArtifactId;
      const moduleIdFull = artifactIdFromHexStr(idHex);

      const normSlot = normalizeSlotType(
        Number(slotTypeMap.get(moduleIdKey) ?? 0),
      );
      if (!normSlot) continue;

      const artifact =
        uiManager.getArtifactWithId(moduleIdFull as ArtifactId) ||
        gameManager.getArtifactMap().get(moduleIdFull as ArtifactId);

      result.push({
        moduleId: moduleIdFull,
        moduleSlotType: normSlot,
        artifact,
      });
    }

    return result;
  }, [
    StarBaseModuleInstalled,
    starbaseHashHex,
    uiManager,
    gameManager,
    refreshKey,
  ]);

  // Watch component map sizes to auto-refresh when MUD updates arrive
  useEffect(() => {
    const valuesAny = (
      StarBaseModuleInstalled as unknown as { values?: unknown }
    ).values as Record<string, unknown> | undefined;
    const installedSize = StarBaseModuleInstalled?.values?.installed?.size ?? 0;
    const slotSize = StarBaseModuleInstalled?.values?.moduleSlotType?.size ?? 0;
    const hashSize =
      (valuesAny?.["starbaseHash"] as Map<unknown, unknown>)?.size ?? 0;
    // bump key minimally to re-run memos when sizes change
    setRefreshKey((k) => k + (installedSize + slotSize + hashSize));
  }, [
    StarBaseModuleInstalled?.values?.installed?.size,
    StarBaseModuleInstalled?.values?.moduleSlotType?.size,
    (StarBaseModuleInstalled as unknown)?.values?.["starbaseHash"]?.size,
  ]);

  useEffect(() => {
    gameManager.hardRefreshPlanet(planetId);
  }, [gameManager, planetId]);

  const availableModules: Artifact[] = useMemo(() => {
    const planetArtifacts =
      gameManager.entityStore.getPlanetArtifacts(planetId);
    return planetArtifacts.filter(
      (a: Artifact) =>
        a &&
        a.artifactType === ArtifactType.SpaceshipModule &&
        !installedModules.some((m) => m.moduleId === a.id),
    ) as Artifact[];
  }, [gameManager, planetId, installedModules, refreshKey]);

  const getCombinedModulesForSlot = (
    slotType: ModuleSlotType,
  ): ModuleDisplayItem[] => {
    const combined: ModuleDisplayItem[] = [];
    installedModules
      .filter((m) => {
        const installedType =
          getModuleTypeForId(m.moduleId as ArtifactId) ??
          (m.artifact?.moduleType as unknown as number | undefined) ??
          m.moduleSlotType;
        return installedType === slotType;
      })
      .forEach((m) =>
        combined.push({
          moduleId: m.moduleId,
          moduleSlotType: m.moduleSlotType,
          artifact: m.artifact,
          isInstalled: true,
        }),
      );
    availableModules
      .filter((a) => {
        const aType =
          (a.moduleType as unknown as number | undefined) ??
          getModuleTypeForId(a.id as ArtifactId);
        return aType === slotType;
      })
      .forEach((a) =>
        combined.push({
          moduleId: a.id,
          moduleSlotType: slotType,
          artifact: a,
          isInstalled: false,
        }),
      );
    return combined;
  };

  const handleInstall = async (moduleId: ArtifactId): Promise<void> => {
    try {
      await gameManager.installStarbaseModule(planetId, moduleId);
      setTimeout(async () => {
        await gameManager.hardRefreshPlanet(planetId);
        setRefreshKey((k) => k + 1);
      }, 500);
    } catch (e) {
      gameManager
        .getNotificationsManager()
        .txInitError("df__installStarbaseModule", (e as Error).message);
    }
  };

  const handleUninstall = async (moduleId: ArtifactId): Promise<void> => {
    try {
      await gameManager.uninstallStarbaseModule(planetId, moduleId);
      setTimeout(async () => {
        await gameManager.hardRefreshPlanet(planetId);
        setRefreshKey((k) => k + 1);
      }, 500);
    } catch (e) {
      gameManager
        .getNotificationsManager()
        .txInitError("df__uninstallStarbaseModule", (e as Error).message);
    }
  };

  return (
    <PaneContainer>
      {Object.values(ModuleSlotType)
        .filter((v) => typeof v === "number")
        .map((slotType) => {
          const combined = getCombinedModulesForSlot(
            slotType as ModuleSlotType,
          );
          const installedCountLimit =
            SLOT_LIMITS[slotType as ModuleSlotType] ?? 0;
          const installedCount = combined.filter((m) => m.isInstalled).length;
          const slotName = ModuleSlotNames[slotType as ModuleSlotType];
          return (
            <SlotSection key={slotType}>
              <SlotHeader>
                <Text>
                  <Green>{slotName}</Green> ({installedCount}/
                  {installedCountLimit})
                </Text>
              </SlotHeader>
              <SlotContent>
                {combined.length === 0 ? (
                  <EmptySlot>No modules available</EmptySlot>
                ) : (
                  combined.map((m) => {
                    const displayArtifact: Artifact =
                      m.artifact ||
                      ({
                        isInititalized: false,
                        id: m.moduleId as ArtifactId,
                        planetDiscoveredOn: "0" as LocationId,
                        rarity: ArtifactRarity.Common,
                        planetBiome: Biome.OCEAN,
                        mintedAtTimestamp: 0,
                        discoverer: EMPTY_ADDRESS,
                        artifactType: ArtifactType.SpaceshipModule,
                        activations: 0,
                        lastActivated: 0,
                        lastDeactivated: 0,
                        controller: EMPTY_ADDRESS,
                        imageType: 0,
                        currentOwner: EMPTY_ADDRESS,
                        moduleType: m.moduleSlotType as unknown as ModuleType,
                      } as Artifact);

                    return (
                      <ModuleItem key={m.moduleId}>
                        <ArtifactImageWrapper
                          onMouseEnter={() => {
                            uiManager.setHoveringOverArtifact(
                              displayArtifact.id,
                            );
                          }}
                          onMouseLeave={() => {
                            uiManager.setHoveringOverArtifact(undefined);
                          }}
                        >
                          <ArtifactImage artifact={displayArtifact} size={32} />
                        </ArtifactImageWrapper>
                        <div style={{ flex: 1 }}>
                          <Text
                            style={{
                              fontSize: "0.9em",
                              color: dfstyles.colors.subtext,
                            }}
                          >
                            {m.isInstalled
                              ? "Installed on starbase"
                              : "Available on starbase"}
                          </Text>
                        </div>
                        {m.isInstalled ? (
                          <Btn
                            onClick={() =>
                              handleUninstall(m.moduleId as ArtifactId)
                            }
                          >
                            Uninstall
                          </Btn>
                        ) : (
                          <Btn
                            onClick={() =>
                              handleInstall(m.moduleId as ArtifactId)
                            }
                            disabled={
                              installedCountLimit === 0 ||
                              installedCount >= installedCountLimit
                            }
                          >
                            Install
                          </Btn>
                        )}
                      </ModuleItem>
                    );
                  })
                )}
                {installedCountLimit === 0 ? (
                  <>
                    <Spacer height={4} />
                    <Text
                      style={{
                        fontSize: "0.9em",
                        color: dfstyles.colors.subtext,
                        fontStyle: "italic",
                      }}
                    >
                      Slot disabled by contract
                    </Text>
                  </>
                ) : (
                  installedCount >= installedCountLimit && (
                    <>
                      <Spacer height={4} />
                      <Text
                        style={{
                          fontSize: "0.9em",
                          color: dfstyles.colors.subtext,
                          fontStyle: "italic",
                        }}
                      >
                        Slot is full
                      </Text>
                    </>
                  )
                )}
              </SlotContent>
            </SlotSection>
          );
        })}
    </PaneContainer>
  );
}
