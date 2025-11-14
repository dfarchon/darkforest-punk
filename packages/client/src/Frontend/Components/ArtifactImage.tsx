import { ArtifactFileColor } from "@df/gamelogic";
import type { Artifact } from "@df/types";
import { ArtifactRarity, ArtifactType, Biome, SpaceshipType } from "@df/types";
import React, { useEffect, useRef } from "react";
import styled, { css } from "styled-components";

import { useCraftedModuleByArtifact } from "../../hooks/useCraftedModule";
import { useCraftedSpaceshipByArtifact } from "../../hooks/useCraftedSpaceship";
import { useInstalledModules } from "../../hooks/useInstalledModules";
import dfstyles from "../Styles/dfstyles";

// export const ARTIFACT_URL = 'https://d2wspbczt15cqu.cloudfront.net/v0.6.0-artifacts/';
export const ARTIFACT_URL = "/df_ares_artifact_icons/";

// Custom spaceship sprite URLs
const SPACESHIP_SPRITES = {
  [SpaceshipType.Scout]: "/sprites/Scouts.png",
  [SpaceshipType.Fighter]: "/sprites/Fighters.png",
  [SpaceshipType.Destroyer]: "/sprites/Destroyers.png",
  [SpaceshipType.Carrier]: "/sprites/Cruisers.png", // Using Cruisers.png for Carrier
} as const;

// Custom module sprite URLs
const MODULE_SPRITES = {
  1: "/sprites/modules/Engines.png", // ENGINES_MODULE_INDEX = 1
  2: "/sprites/modules/1Cannon.png", // WEAPONS_MODULE_INDEX = 2 (default to single cannon)
  3: "/sprites/modules/Hull.png", // HULL_SHIELD_MODULE_INDEX = 3 (default to Hull)
  4: "/sprites/modules/Shield.png", // HULL_SHIELD_MODULE_INDEX = 4 (default to Shield)
} as const;

// Module slot types
enum ModuleSlotType {
  ENGINES = 1,
  WEAPONS = 2,
  HULL = 3,
  SHIELD = 4,
}

// Module limits per spaceship type
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

/**
 * Calculate module overlay position based on spaceship type, slot type, and index
 * Layout pattern:
 * - Engines: Left side, vertical stack
 * - Shield/Hull: Middle, 2x2 grid
 * - Weapons: Right side, vertical stack
 */
function calculateModulePosition(
  size: number,
  spaceshipType: number,
  slotType: number,
  index: number,
  _totalInSlot: number,
): { top: number; left: number; width: number; height: number } {
  const moduleSize = size * 0.4; // Modules are 40% of spaceship size (increased for visibility)
  const padding = size * 0.03; // 3% padding

  // Get limits for this spaceship type
  const limits =
    SPACESHIP_MODULE_LIMITS[spaceshipType] || SPACESHIP_MODULE_LIMITS[1];
  const maxInSlot = limits[slotType as ModuleSlotType] || 1;

  if (slotType === ModuleSlotType.ENGINES) {
    // Engines: Left side, vertical stack
    const totalHeight = maxInSlot * moduleSize + (maxInSlot - 1) * padding;
    const startTop = (size - totalHeight) / 2;
    const left = padding;
    const top = startTop + index * (moduleSize + padding);
    return { top, left, width: moduleSize, height: moduleSize };
  } else if (slotType === ModuleSlotType.WEAPONS) {
    // Weapons: Right side, vertical stack
    const totalHeight = maxInSlot * moduleSize + (maxInSlot - 1) * padding;
    const startTop = (size - totalHeight) / 2;
    const left = size - moduleSize - padding;
    const top = startTop + index * (moduleSize + padding);
    return { top, left, width: moduleSize, height: moduleSize };
  } else if (
    slotType === ModuleSlotType.HULL ||
    slotType === ModuleSlotType.SHIELD
  ) {
    // Shield/Hull: Middle area, 2x2 grid
    const gridCols = 2;
    const gridRows = Math.ceil(maxInSlot / gridCols);
    const gridCellSize = (size * 0.4) / gridCols; // Middle area is 40% of size
    const gridStartLeft = size * 0.3; // Start at 30% from left
    const gridStartTop = (size - gridRows * gridCellSize) / 2;

    const row = Math.floor(index / gridCols);
    const col = index % gridCols;
    const left =
      gridStartLeft + col * gridCellSize + (gridCellSize - moduleSize) / 2;
    const top =
      gridStartTop + row * gridCellSize + (gridCellSize - moduleSize) / 2;

    return { top, left, width: moduleSize, height: moduleSize };
  }

  // Default: center
  return {
    top: (size - moduleSize) / 2,
    left: (size - moduleSize) / 2,
    width: moduleSize,
    height: moduleSize,
  };
}

// function getArtifactUrl(
//   thumb: boolean,
//   artifact: Artifact,
//   color: ArtifactFileColor,
// ): string {
//   const fileName = artifactFileName(true, thumb, artifact, color);
//   return ARTIFACT_URL + fileName;
// }

export function ArtifactImage({
  artifact,
  size,
  thumb: _thumb = false,
  bgColor: _bgColor = ArtifactFileColor.APP_BACKGROUND,
}: {
  artifact: Artifact;
  size: number;
  thumb?: boolean;
  bgColor?: ArtifactFileColor;
}) {
  // Get spaceship data from CraftedSpaceship MUD table
  const spaceshipData = useCraftedSpaceshipByArtifact(artifact);
  // Use artifact.spaceshipType if available (set by ArtifactUtils), otherwise use hook result
  let spaceshipType = artifact.spaceshipType ?? spaceshipData?.spaceshipType;

  // Fallback: If no CraftedSpaceship data exists, use default spaceship type
  if (artifact.artifactType === ArtifactType.Spaceship && !spaceshipType) {
    spaceshipType = SpaceshipType.Scout; // Default to Scout
  }

  // Get module data from CraftedModules MUD table
  const moduleData = useCraftedModuleByArtifact(artifact);
  // Use artifact.moduleType if available (set by ArtifactUtils), otherwise use hook result
  const moduleType = artifact.moduleType ?? moduleData?.moduleType;

  // Determine if artifact should have shine effect (same logic as viewport)
  const hasShine = artifact.rarity >= ArtifactRarity.Rare;
  const isLegendary = artifact.rarity === ArtifactRarity.Legendary;
  const isMythic = artifact.rarity === ArtifactRarity.Mythic;

  // Use the same biome source as 3D viewport: artifact.planetBiome
  // Convert Biome enum to index (0-9) to match 3D viewport behavior
  const getBiomeIndex = (biome: Biome): number => {
    const biomeMap = {
      [Biome.OCEAN]: 0,
      [Biome.FOREST]: 1,
      [Biome.GRASSLAND]: 2,
      [Biome.TUNDRA]: 3,
      [Biome.SWAMP]: 4,
      [Biome.DESERT]: 5,
      [Biome.ICE]: 6,
      [Biome.WASTELAND]: 7,
      [Biome.LAVA]: 8,
      [Biome.CORRUPTED]: 9,
    };
    return biomeMap[biome] ?? 0; // Default to Ocean if biome not found
  };

  const biomeIndex = getBiomeIndex(artifact.planetBiome);
  const spaceshipSpriteUrl =
    spaceshipType !== undefined
      ? SPACESHIP_SPRITES[spaceshipType as keyof typeof SPACESHIP_SPRITES]
      : undefined;
  const moduleSpriteUrl =
    moduleType !== undefined && moduleType >= 1 && moduleType <= 4
      ? MODULE_SPRITES[moduleType as keyof typeof MODULE_SPRITES]
      : undefined;

  // Get installed modules for spaceship artifacts
  // Always call the hook (React rules), but pass undefined for non-spaceships
  const installedModules = useInstalledModules(
    artifact.artifactType === ArtifactType.Spaceship ? artifact : undefined,
  );

  // For spaceship artifacts, use custom sprite rendering
  if (artifact.artifactType === ArtifactType.Spaceship && spaceshipSpriteUrl) {
    return (
      <SpaceshipContainer size={size}>
        {isMythic ? (
          <MythicSpaceshipSprite
            size={size}
            src={spaceshipSpriteUrl}
            biomeIndex={biomeIndex}
            isLegendary={isLegendary}
          />
        ) : (
          <SpaceshipSpriteImage
            size={size}
            src={spaceshipSpriteUrl}
            biomeIndex={biomeIndex}
            isLegendary={isLegendary}
            isMythic={isMythic}
          />
        )}
        {/* Render module overlays */}
        {(() => {
          // Group modules by slot type and calculate positions
          const modulesBySlot: {
            [slotType: number]: typeof installedModules;
          } = {};
          installedModules.forEach((module) => {
            if (!modulesBySlot[module.moduleSlotType]) {
              modulesBySlot[module.moduleSlotType] = [];
            }
            modulesBySlot[module.moduleSlotType].push(module);
          });

          const overlayElements: JSX.Element[] = [];

          Object.keys(modulesBySlot).forEach((slotTypeStr) => {
            const slotType = Number(slotTypeStr);
            const modulesInSlot = modulesBySlot[slotType];

            modulesInSlot.forEach((module, indexInSlot) => {
              const overlayModuleSpriteUrl =
                module.moduleType >= 1 && module.moduleType <= 4
                  ? (MODULE_SPRITES[
                      module.moduleType as keyof typeof MODULE_SPRITES
                    ] as string)
                  : undefined;

              if (!overlayModuleSpriteUrl) return;

              // Calculate position based on spaceship type, slot type, and index
              // Convert SpaceshipType enum to number (1-4)
              const spaceshipTypeNum =
                typeof spaceshipType === "number"
                  ? spaceshipType
                  : Number(spaceshipType) || 1;
              const position = calculateModulePosition(
                size,
                spaceshipTypeNum,
                slotType,
                indexInSlot,
                modulesInSlot.length,
              );

              // Get module artifact for rarity/biome info
              // Try to get the actual module artifact to get its rarity
              const moduleRarity = artifact.rarity; // Default to spaceship rarity
              const moduleBiomeIndex = biomeIndex; // Use spaceship biome for consistency

              // Try to get module artifact from context if available
              // Note: This requires access to uiManager or artifact map
              // For now, we'll use spaceship's rarity, but ideally should get module's rarity

              // Check if module has rare+ rarity (same logic as ModuleSpriteImage)
              const moduleHasShine = moduleRarity >= ArtifactRarity.Rare;
              const moduleIsLegendary =
                moduleRarity === ArtifactRarity.Legendary;
              const moduleIsMythic = moduleRarity === ArtifactRarity.Mythic;

              overlayElements.push(
                <React.Fragment
                  key={`${module.moduleId}-${slotType}-${indexInSlot}`}
                >
                  <ModuleOverlay
                    $size={position.width}
                    $src={overlayModuleSpriteUrl}
                    $biomeIndex={moduleBiomeIndex}
                    $isLegendary={moduleIsLegendary}
                    $isMythic={moduleIsMythic}
                    $hasShine={moduleHasShine}
                    $slotType={slotType}
                    $top={position.top}
                    $left={position.left}
                  />
                  {moduleHasShine && (
                    <ModuleShineOverlay
                      size={position.width}
                      isLegendary={moduleIsLegendary}
                      isMythic={moduleIsMythic}
                      style={{
                        top: `${position.top}px`,
                        left: `${position.left}px`,
                      }}
                    />
                  )}
                </React.Fragment>,
              );
            });
          });

          return overlayElements;
        })()}
        {hasShine && (
          <SpaceshipShineOverlay
            size={size}
            isLegendary={isLegendary}
            isMythic={isMythic}
          />
        )}
      </SpaceshipContainer>
    );
  }

  // For module artifacts (type 23), use custom sprite rendering similar to spaceships
  if (
    artifact.artifactType === ArtifactType.SpaceshipModule &&
    moduleSpriteUrl
  ) {
    return (
      <ModuleContainer size={size}>
        {isMythic ? (
          <MythicModuleSprite
            size={size}
            src={moduleSpriteUrl}
            isLegendary={isLegendary}
          />
        ) : (
          <ModuleSpriteImage
            size={size}
            src={moduleSpriteUrl}
            biomeIndex={biomeIndex}
            isLegendary={isLegendary}
            isMythic={isMythic}
          />
        )}
        {hasShine && (
          <ModuleShineOverlay
            size={size}
            isLegendary={isLegendary}
            isMythic={isMythic}
          />
        )}
      </ModuleContainer>
    );
  }

  // For non-spaceship artifacts, use default rendering
  return (
    <Container width={size} height={size}>
      <img
        width={size}
        height={size}
        src={ARTIFACT_URL + artifact.artifactType + ".png"}
      />
    </Container>
  );
}

// Component for mythic spaceships with pixel manipulation effects
const MythicSpaceshipSprite: React.FC<{
  size: number;
  src: string;
  biomeIndex: number;
  isLegendary: boolean;
}> = ({ size, src, biomeIndex, isLegendary }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const image = imageRef.current;
    if (!canvas || !image || !image.complete) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = size;
    canvas.height = size;

    const spriteWidth = 64;

    if (isLegendary) {
      ctx.filter = "invert(1)";
    }

    ctx.drawImage(
      image,
      biomeIndex * spriteWidth,
      0,
      spriteWidth,
      spriteWidth,
      0,
      0,
      size,
      size,
    );

    const imageData = ctx.getImageData(0, 0, size, size);
    const data = imageData.data;

    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];

      const isBlack = r < 13 && g < 13 && b < 13;
      const isWhite = r > 242 && g > 242 && b > 242;

      if (!isBlack && !isWhite) {
        // Enhanced color saturation for mythic
        data[i] = Math.min(255, Math.max(0, (r - 89) * 3 + 89)); // Red
        data[i + 1] = Math.min(255, Math.max(0, (g - 89) * 3 + 89)); // Green
        data[i + 2] = Math.min(255, Math.max(0, (b - 89) * 3 + 89)); // Blue
      }
    }

    ctx.putImageData(imageData, 0, 0);
  }, [size, biomeIndex, isLegendary]);

  return (
    <>
      <img
        ref={imageRef}
        src={src}
        style={{ display: "none" }}
        onLoad={() => {
          // Trigger canvas redraw when image loads
          const canvas = canvasRef.current;
          const image = imageRef.current;
          if (!canvas || !image) return;

          const ctx = canvas.getContext("2d");
          if (!ctx) return;

          canvas.width = size;
          canvas.height = size;

          const spriteWidth = 64;

          if (isLegendary) {
            ctx.filter = "invert(1)";
          }

          ctx.drawImage(
            image,
            biomeIndex * spriteWidth,
            0,
            spriteWidth,
            spriteWidth,
            0,
            0,
            size,
            size,
          );

          const imageData = ctx.getImageData(0, 0, size, size);
          const data = imageData.data;

          for (let i = 0; i < data.length; i += 4) {
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];

            const isBlack = r < 13 && g < 13 && b < 13;
            const isWhite = r > 242 && g > 242 && b > 242;

            if (!isBlack && !isWhite) {
              data[i] = Math.min(255, Math.max(0, (r - 89) * 3 + 89));
              data[i + 1] = Math.min(255, Math.max(0, (g - 89) * 3 + 89));
              data[i + 2] = Math.min(255, Math.max(0, (b - 89) * 3 + 89));
            }
          }

          ctx.putImageData(imageData, 0, 0);
        }}
      />
      <canvas
        ref={canvasRef}
        width={size}
        height={size}
        style={{
          width: `${size}px`,
          height: `${size}px`,
          imageRendering: "crisp-edges",
        }}
      />
    </>
  );
};

const Container = styled.div`
  image-rendering: crisp-edges;

  ${({ width, height }: { width: number; height: number }) => css`
    width: ${width}px;
    height: ${height}px;
    min-width: ${width}px;
    min-height: ${height}px;
    background-color: ${dfstyles.colors.artifactBackground};
    display: inline-block;
  `}
`;

const SpaceshipContainer = styled.div<{ size: number }>`
  position: relative;
  width: ${({ size }) => size}px;
  height: ${({ size }) => size}px;
  display: inline-block;
`;

const SpaceshipSpriteImage = styled.div<{
  size: number;
  src: string;
  biomeIndex: number;
  isLegendary: boolean;
  isMythic: boolean;
}>`
  image-rendering: crisp-edges;
  width: ${({ size }) => size}px;
  height: ${({ size }) => size}px;
  display: inline-block;
  vertical-align: middle;
  background-image: url(${({ src }) => src});
  background-size: auto 100%;
  background-repeat: no-repeat;
  background-position: ${({ biomeIndex, size }) => {
    // For smaller display sizes, we need to adjust the offset
    // The sprite sheet has 64px sprites, but we might be displaying at 32px
    const spriteWidth = 64; // Original sprite width in the sheet
    const scaleFactor = size / spriteWidth; // How much we're scaling down
    const adjustedOffset = biomeIndex * spriteWidth * scaleFactor;
    const position = `-${adjustedOffset}px 0`;
    return position;
  }};
  filter: ${({ isLegendary, isMythic }) => {
    if (isMythic) {
      // For mythic spaceships, we'll use the MythicSpaceshipSprite component instead
      return "none";
    }
    if (isLegendary) {
      // Legendary effects: color inversion like in viewport
      return "invert(1)";
    }
    return "none";
  }};
`;

const SpaceshipShineOverlay = styled.div<{
  size: number;
  isLegendary: boolean;
  isMythic: boolean;
}>`
  position: absolute;
  top: 0;
  left: 0;
  width: ${({ size }) => size}px;
  height: ${({ size }) => size}px;
  pointer-events: none;
  background: ${({ isLegendary, isMythic }) => {
    if (isMythic) {
      return "linear-gradient(135deg, rgba(255,215,0,0.3) 0%, rgba(255,69,0,0.3) 100%)";
    }
    if (isLegendary) {
      return "linear-gradient(135deg, rgba(255,255,255,0.2) 0%, rgba(200,200,255,0.2) 100%)";
    }
    return "linear-gradient(135deg, rgba(255,255,255,0.1) 0%, rgba(200,200,255,0.1) 100%)";
  }};
  animation: ${({ isMythic, isLegendary }) => {
    if (isMythic) {
      return "shineMythic 3s ease-in-out infinite";
    }
    if (isLegendary) {
      return "shineLegendary 3s ease-in-out infinite";
    }
    return "shine 3s ease-in-out infinite";
  }};
  opacity: ${({ isMythic, isLegendary }) => {
    if (isMythic) return 0.6;
    if (isLegendary) return 0.4;
    return 0.3;
  }};

  @keyframes shine {
    0%,
    100% {
      opacity: 0.3;
    }
    50% {
      opacity: 0.5;
    }
  }

  @keyframes shineLegendary {
    0%,
    100% {
      opacity: 0.4;
    }
    50% {
      opacity: 0.6;
    }
  }

  @keyframes shineMythic {
    0%,
    100% {
      opacity: 0.6;
    }
    50% {
      opacity: 0.8;
    }
  }
`;

// Module-specific styled components (similar to spaceship components)
const ModuleContainer = styled.div<{ size: number }>`
  position: relative;
  width: ${({ size }) => size}px;
  height: ${({ size }) => size}px;
  display: inline-block;
`;

const ModuleSpriteImage = styled.div<{
  size: number;
  src: string;
  biomeIndex: number;
  isLegendary: boolean;
  isMythic: boolean;
}>`
  image-rendering: crisp-edges;
  width: ${({ size }) => size}px;
  height: ${({ size }) => size}px;
  display: inline-block;
  vertical-align: middle;
  background-image: url(${({ src }) => src});
  background-size: contain;
  background-repeat: no-repeat;
  background-position: center;
  filter: ${({ isLegendary, isMythic }) => {
    if (isMythic) {
      // For mythic modules, we'll use the MythicModuleSprite component instead
      return "none";
    }
    if (isLegendary) {
      // Legendary effects: color inversion like in viewport
      return "invert(1)";
    }
    return "none";
  }};
`;

const ModuleShineOverlay = styled.div<{
  size: number;
  isLegendary: boolean;
  isMythic: boolean;
}>`
  position: absolute;
  top: 0;
  left: 0;
  width: ${({ size }) => size}px;
  height: ${({ size }) => size}px;
  pointer-events: none;
  background: ${({ isLegendary, isMythic }) => {
    if (isMythic) {
      return "linear-gradient(135deg, rgba(255,215,0,0.3) 0%, rgba(255,69,0,0.3) 100%)";
    }
    if (isLegendary) {
      return "linear-gradient(135deg, rgba(255,255,255,0.2) 0%, rgba(200,200,255,0.2) 100%)";
    }
    return "linear-gradient(135deg, rgba(255,255,255,0.1) 0%, rgba(200,200,255,0.1) 100%)";
  }};
  animation: ${({ isMythic, isLegendary }) => {
    if (isMythic) {
      return "shineMythic 3s ease-in-out infinite";
    }
    if (isLegendary) {
      return "shineLegendary 3s ease-in-out infinite";
    }
    return "shine 3s ease-in-out infinite";
  }};
  opacity: ${({ isMythic, isLegendary }) => {
    if (isMythic) return 0.6;
    if (isLegendary) return 0.4;
    return 0.3;
  }};
`;

// Module overlay for displaying installed modules on spaceships
const ModuleOverlay = styled.div<{
  $size: number;
  $src: string;
  $biomeIndex: number;
  $isLegendary: boolean;
  $isMythic: boolean;
  $hasShine: boolean;
  $slotType: number;
  $top: number;
  $left: number;
}>`
  position: absolute;
  top: ${({ $top }) => $top}px;
  left: ${({ $left }) => $left}px;
  width: ${({ $size }) => $size}px;
  height: ${({ $size }) => $size}px;
  pointer-events: none;
  image-rendering: crisp-edges;
  background-image: url(${({ $src }) => $src});
  background-size: contain;
  background-repeat: no-repeat;
  background-position: center;
  opacity: 1; // Full opacity like ModuleSpriteImage
  z-index: 10; // Ensure overlays are above the spaceship sprite
  filter: ${({ $isLegendary, $isMythic }) => {
    if ($isMythic) {
      // For mythic modules, we'll use the shine overlay for effects
      return "none";
    }
    if ($isLegendary) {
      // Legendary effects: color inversion like ModuleSpriteImage and viewport
      return "invert(1)";
    }
    return "none";
  }};
`;

// Component for mythic modules with pixel manipulation effects (single image, not sprite sheet)
const MythicModuleSprite: React.FC<{
  size: number;
  src: string;
  isLegendary: boolean;
}> = ({ size, src, isLegendary }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const image = imageRef.current;
    if (!canvas || !image || !image.complete) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = size;
    canvas.height = size;

    if (isLegendary) {
      ctx.filter = "invert(1)";
    }

    // Draw the full image (not clipped from sprite sheet)
    ctx.drawImage(image, 0, 0, size, size);

    const imageData = ctx.getImageData(0, 0, size, size);
    const data = imageData.data;

    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];

      const isBlack = r < 13 && g < 13 && b < 13;
      const isWhite = r > 242 && g > 242 && b > 242;

      if (!isBlack && !isWhite) {
        // Enhanced color saturation for mythic
        data[i] = Math.min(255, Math.max(0, (r - 89) * 3 + 89)); // Red
        data[i + 1] = Math.min(255, Math.max(0, (g - 89) * 3 + 89)); // Green
        data[i + 2] = Math.min(255, Math.max(0, (b - 89) * 3 + 89)); // Blue
      }
    }

    ctx.putImageData(imageData, 0, 0);
  }, [size, isLegendary]);

  return (
    <>
      <img
        ref={imageRef}
        src={src}
        style={{ display: "none" }}
        onLoad={() => {
          // Trigger canvas redraw when image loads
          const canvas = canvasRef.current;
          const image = imageRef.current;
          if (!canvas || !image) return;

          const ctx = canvas.getContext("2d");
          if (!ctx) return;

          canvas.width = size;
          canvas.height = size;

          if (isLegendary) {
            ctx.filter = "invert(1)";
          }

          // Draw the full image (not clipped from sprite sheet)
          ctx.drawImage(image, 0, 0, size, size);

          const imageData = ctx.getImageData(0, 0, size, size);
          const data = imageData.data;

          for (let i = 0; i < data.length; i += 4) {
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];

            const isBlack = r < 13 && g < 13 && b < 13;
            const isWhite = r > 242 && g > 242 && b > 242;

            if (!isBlack && !isWhite) {
              data[i] = Math.min(255, Math.max(0, (r - 89) * 3 + 89));
              data[i + 1] = Math.min(255, Math.max(0, (g - 89) * 3 + 89));
              data[i + 2] = Math.min(255, Math.max(0, (b - 89) * 3 + 89));
            }
          }

          ctx.putImageData(imageData, 0, 0);
        }}
      />
      <canvas
        ref={canvasRef}
        width={size}
        height={size}
        style={{
          width: `${size}px`,
          height: `${size}px`,
          imageRendering: "crisp-edges",
        }}
      />
    </>
  );
};
