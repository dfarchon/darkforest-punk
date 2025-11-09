import { useMUD } from "@mud/MUDContext";
import type { Artifact, ArtifactId, LocationId, ModuleType } from "@df/types";
import { ArtifactType, ArtifactRarity, Biome } from "@df/types";
import { EMPTY_ADDRESS } from "@df/constants";
import { artifactIdFromHexStr } from "@df/serde";
import { useMemo } from "react";
import styled from "styled-components";

import { useCraftedSpaceshipByArtifact } from "../../hooks/useCraftedSpaceship";
import { ArtifactImage } from "../Components/ArtifactImage";
import { Btn } from "../Components/Btn";
import { Spacer } from "../Components/CoreUI";
import { Green, Red, Text, White } from "../Components/Text";
import { useArtifact, useUIManager } from "../Utils/AppHooks";
import type { ModalHandle } from "../Views/ModalPane";
import dfstyles from "../Styles/dfstyles";

// Module slot types
enum ModuleSlotType {
  ENGINES = 1,
  WEAPONS = 2,
  HULL = 3,
  SHIELD = 4,
}

const ModuleSlotNames = {
  [ModuleSlotType.ENGINES]: "Engines",
  [ModuleSlotType.WEAPONS]: "Weapons",
  [ModuleSlotType.HULL]: "Hull",
  [ModuleSlotType.SHIELD]: "Shield",
};

// Module limits per spaceship type (from constants.sol)
const SPACESHIP_MODULE_LIMITS: {
  [spaceshipType: number]: {
    [ModuleSlotType.ENGINES]: number;
    [ModuleSlotType.WEAPONS]: number;
    [ModuleSlotType.HULL]: number;
    [ModuleSlotType.SHIELD]: number;
  };
} = {
  1: {
    [ModuleSlotType.ENGINES]: 1,
    [ModuleSlotType.WEAPONS]: 1,
    [ModuleSlotType.HULL]: 1,
    [ModuleSlotType.SHIELD]: 1,
  },
  2: {
    [ModuleSlotType.ENGINES]: 2,
    [ModuleSlotType.WEAPONS]: 2,
    [ModuleSlotType.HULL]: 2,
    [ModuleSlotType.SHIELD]: 2,
  },
  3: {
    [ModuleSlotType.ENGINES]: 3,
    [ModuleSlotType.WEAPONS]: 4,
    [ModuleSlotType.HULL]: 2,
    [ModuleSlotType.SHIELD]: 2,
  },
  4: {
    [ModuleSlotType.ENGINES]: 4,
    [ModuleSlotType.WEAPONS]: 2,
    [ModuleSlotType.HULL]: 4,
    [ModuleSlotType.SHIELD]: 4,
  },
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

interface AvailableModule {
  artifact: Artifact;
  moduleType: number;
}

interface ModuleDisplayItem {
  moduleId: string;
  moduleSlotType: number;
  artifact?: Artifact;
  isInstalled: boolean; // true if on spaceship, false if on planet
}

export function SpaceshipModuleManagementPane({
  artifactId,
  modal: _modal,
}: {
  artifactId: ArtifactId;
  modal: ModalHandle;
}): JSX.Element {
  const uiManager = useUIManager();
  const artifactWrapper = useArtifact(uiManager, artifactId);
  const artifact = artifactWrapper.value;

  const {
    components: { SpaceshipModuleInstalled },
  } = useMUD();

  const spaceshipData = artifact
    ? useCraftedSpaceshipByArtifact(artifact)
    : undefined;

  // Get installed modules for this spaceship using useMemo
  // Read all modules from SpaceshipModuleInstalled and filter where artifactId matches spaceship
  const installedModules = useMemo(() => {
    if (!artifact || !spaceshipData || !SpaceshipModuleInstalled?.values) {
      return [];
    }

    const modules: InstalledModule[] = [];

    // Get all maps from SpaceshipModuleInstalled component
    const installedMap = SpaceshipModuleInstalled.values.artifactId;
    const slotTypeMap = SpaceshipModuleInstalled.values.moduleSlotType;
    const installedFlagMap = SpaceshipModuleInstalled.values.installed;

    if (!installedMap || !slotTypeMap || !installedFlagMap) {
      return [];
    }

    // Iterate through all entries in SpaceshipModuleInstalled
    // Filter where artifactId matches spaceship ID
    for (const [moduleIdKey, storedSpaceshipId] of installedMap.entries()) {
      // Get installed flag
      const installedFlag = installedFlagMap.get(moduleIdKey);
      const isInstalled = installedFlag === true;

      // Compare stored spaceshipId with our spaceship ID
      // Try multiple comparison methods to handle different formats
      const sourceSpaceshipId = Number(storedSpaceshipId.toString(16));
      const targetSpaceshipId = Number(artifact.id);

      const matchesSpaceship = sourceSpaceshipId === targetSpaceshipId;

      // Only include if matches spaceship and installed flag is true
      if (matchesSpaceship && isInstalled) {
        // Extract moduleId from Symbol key
        const keyString = moduleIdKey.toString();
        const hexMatch = keyString.match(/0x([0-9a-fA-F]+)/);
        if (hexMatch) {
          // Parse hex string properly and convert to ArtifactId format
          const hexValue = hexMatch[1];
          const slotType = slotTypeMap.get(moduleIdKey);

          if (hexValue && slotType !== undefined && Number(slotType) > 0) {
            // Convert hex string to ArtifactId format (properly padded hex string)
            const moduleIdStr = artifactIdFromHexStr("0x" + hexValue);
            let moduleArtifact = uiManager.getArtifactWithId(moduleIdStr);

            // If not found, try getting from gameManager's artifact map directly
            if (!moduleArtifact) {
              const gameManager = uiManager.getGameManager();
              moduleArtifact = gameManager.getArtifactMap().get(moduleIdStr);
            }

            modules.push({
              moduleId: moduleIdStr,
              moduleSlotType: Number(slotType),
              artifact: moduleArtifact,
            });
          }
        }
      }
    }

    return modules;
  }, [artifact, spaceshipData, SpaceshipModuleInstalled, uiManager]);

  // Get available modules on the same planet as the spaceship
  const availableModules = useMemo(() => {
    if (!artifact || !artifact.onPlanetId) return [];

    const gameManager = uiManager.getGameManager();
    const planetArtifacts = gameManager.entityStore.getPlanetArtifacts(
      artifact.onPlanetId,
    );

    return planetArtifacts.filter(
      (a: Artifact) =>
        a &&
        a.artifactType === ArtifactType.SpaceshipModule &&
        // Check if module is not already installed
        !installedModules.some((installed) => installed.moduleId === a.id),
    ) as Artifact[];
  }, [artifact, installedModules, uiManager]);

  // Get module types for available modules (using hooks properly)
  const availableModulesWithTypes = useMemo(() => {
    return availableModules
      .map((module: Artifact) => {
        // We'll need to get module data differently since we can't use hooks here
        // For now, we'll use the artifact's moduleType if available
        const moduleType = module.moduleType || 0;
        return {
          artifact: module,
          moduleType,
        };
      })
      .filter((item: AvailableModule) => item.moduleType > 0);
  }, [availableModules]);

  if (!artifact || artifact.artifactType !== ArtifactType.Spaceship) {
    return (
      <PaneContainer>
        <Red>This artifact is not a spaceship.</Red>
      </PaneContainer>
    );
  }

  if (!spaceshipData) {
    return (
      <PaneContainer>
        <Text>Loading spaceship data...</Text>
      </PaneContainer>
    );
  }

  const spaceshipType = spaceshipData.spaceshipType;
  const limits =
    SPACESHIP_MODULE_LIMITS[spaceshipType] || SPACESHIP_MODULE_LIMITS[1]; // Default to Scout limits

  // Combine installed and available modules for a slot
  const getCombinedModulesForSlot = (
    slotType: ModuleSlotType,
  ): ModuleDisplayItem[] => {
    const combined: ModuleDisplayItem[] = [];

    // Add installed modules (on spaceship)
    const installedForSlot = installedModules.filter(
      (m) => m.moduleSlotType === slotType,
    );
    installedForSlot.forEach((module) => {
      combined.push({
        moduleId: module.moduleId,
        moduleSlotType: module.moduleSlotType,
        artifact: module.artifact,
        isInstalled: true,
      });
    });

    // Add available modules (on planet)
    const availableForSlot = availableModulesWithTypes.filter(
      (item: AvailableModule) => item.moduleType === slotType,
    );
    availableForSlot.forEach((item) => {
      combined.push({
        moduleId: item.artifact.id,
        moduleSlotType: slotType,
        artifact: item.artifact,
        isInstalled: false,
      });
    });

    return combined;
  };

  const handleInstallModule = async (
    moduleId: ArtifactId,
    _slotType: ModuleSlotType,
  ): Promise<void> => {
    if (!artifact || !artifact.onPlanetId) {
      const gameManager = uiManager.getGameManager();
      gameManager
        .getNotificationsManager()
        .txInitError("df__installModule", "Spaceship must be on a planet");
      return;
    }

    try {
      const gameManager = uiManager.getGameManager();
      await gameManager.installModule(
        artifact.id,
        moduleId,
        artifact.onPlanetId,
      );
    } catch (error) {
      const gameManager = uiManager.getGameManager();
      gameManager
        .getNotificationsManager()
        .txInitError(
          "df__installModule",
          `Failed to install module: ${(error as Error).message}`,
        );
    }
  };

  const handleUninstallModule = async (
    moduleId: string,
    _slotType: ModuleSlotType,
  ): Promise<void> => {
    if (!artifact || !artifact.onPlanetId) {
      const gameManager = uiManager.getGameManager();
      gameManager
        .getNotificationsManager()
        .txInitError("df__uninstallModule", "Spaceship must be on a planet");
      return;
    }

    try {
      const gameManager = uiManager.getGameManager();
      await gameManager.uninstallModule(
        artifact.id,
        moduleId as ArtifactId,
        artifact.onPlanetId,
      );
    } catch (error) {
      const gameManager = uiManager.getGameManager();
      gameManager
        .getNotificationsManager()
        .txInitError(
          "df__uninstallModule",
          `Failed to uninstall module: ${(error as Error).message}`,
        );
    }
  };

  return (
    <PaneContainer>
      <Text>
        <White>Manage Modules for Spaceship Type: </White>{" "}
        <Green>{spaceshipType}</Green>
      </Text>

      {Object.values(ModuleSlotType)
        .filter((v) => typeof v === "number")
        .map((slotType) => {
          const combinedModules = getCombinedModulesForSlot(
            slotType as ModuleSlotType,
          );
          const installedCount = combinedModules.filter(
            (m) => m.isInstalled,
          ).length;
          const limit = limits[slotType as ModuleSlotType];
          const slotName = ModuleSlotNames[slotType as ModuleSlotType];

          return (
            <SlotSection key={slotType}>
              <SlotHeader>
                <Text>
                  <Green>{slotName}</Green> ({installedCount}/{limit})
                </Text>
              </SlotHeader>
              <SlotContent>
                {combinedModules.length === 0 ? (
                  <EmptySlot>No modules available</EmptySlot>
                ) : (
                  combinedModules.map((module) => (
                    <ModuleItem key={module.moduleId}>
                      {(() => {
                        // Always try to get the artifact, using module.artifact first or fetching by moduleId
                        let displayArtifact = module.artifact;

                        if (!displayArtifact && module.moduleId) {
                          // Try multiple methods to get the artifact
                          displayArtifact = uiManager.getArtifactWithId(
                            module.moduleId as ArtifactId,
                          );

                          // If still not found, try getting from gameManager's artifact map directly
                          if (!displayArtifact) {
                            const gameManager = uiManager.getGameManager();
                            displayArtifact = gameManager
                              .getArtifactMap()
                              .get(module.moduleId as ArtifactId);
                          }
                        }

                        return displayArtifact ? (
                          <>
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
                              <ArtifactImage
                                artifact={displayArtifact}
                                size={32}
                              />
                            </ArtifactImageWrapper>
                            <div style={{ flex: 1 }}>
                              <Text
                                style={{
                                  fontSize: "0.9em",
                                  color: dfstyles.colors.subtext,
                                }}
                              >
                                {module.isInstalled
                                  ? "Installed on ship"
                                  : "Available on planet"}
                              </Text>
                            </div>
                            {module.isInstalled ? (
                              <Btn
                                onClick={() =>
                                  handleUninstallModule(
                                    module.moduleId,
                                    module.moduleSlotType,
                                  )
                                }
                              >
                                Uninstall
                              </Btn>
                            ) : (
                              <Btn
                                onClick={() =>
                                  handleInstallModule(
                                    module.moduleId as ArtifactId,
                                    module.moduleSlotType,
                                  )
                                }
                                disabled={installedCount >= limit}
                              >
                                Install
                              </Btn>
                            )}
                          </>
                        ) : (
                          <>
                            {(() => {
                              // Create a minimal artifact object for display purposes
                              // This allows ArtifactImage to render even when artifact isn't fully loaded
                              const minimalArtifact: Artifact = {
                                isInititalized: false,
                                id: module.moduleId as ArtifactId,
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
                                moduleType:
                                  module.moduleSlotType as unknown as ModuleType,
                              };

                              return (
                                <>
                                  <ArtifactImageWrapper
                                    onMouseEnter={() => {
                                      uiManager.setHoveringOverArtifact(
                                        minimalArtifact.id,
                                      );
                                    }}
                                    onMouseLeave={() => {
                                      uiManager.setHoveringOverArtifact(
                                        undefined,
                                      );
                                    }}
                                  >
                                    <ArtifactImage
                                      artifact={minimalArtifact}
                                      size={32}
                                    />
                                  </ArtifactImageWrapper>
                                  <div style={{ flex: 1 }}>
                                    <Text
                                      style={{
                                        fontSize: "0.9em",
                                        color: dfstyles.colors.subtext,
                                      }}
                                    >
                                      {module.isInstalled
                                        ? "Installed on ship"
                                        : "Available on planet"}
                                    </Text>
                                  </div>
                                  {module.isInstalled ? (
                                    <Btn
                                      onClick={() =>
                                        handleUninstallModule(
                                          module.moduleId,
                                          module.moduleSlotType,
                                        )
                                      }
                                    >
                                      Uninstall
                                    </Btn>
                                  ) : (
                                    <Btn
                                      onClick={() =>
                                        handleInstallModule(
                                          module.moduleId as ArtifactId,
                                          module.moduleSlotType,
                                        )
                                      }
                                      disabled={installedCount >= limit}
                                    >
                                      Install
                                    </Btn>
                                  )}
                                </>
                              );
                            })()}
                          </>
                        );
                      })()}
                    </ModuleItem>
                  ))
                )}
                {installedCount >= limit && (
                  <Text
                    style={{
                      fontSize: "0.9em",
                      color: dfstyles.colors.subtext,
                      marginTop: "8px",
                      fontStyle: "italic",
                    }}
                  >
                    Slot is full
                  </Text>
                )}
              </SlotContent>
            </SlotSection>
          );
        })}
    </PaneContainer>
  );
}
