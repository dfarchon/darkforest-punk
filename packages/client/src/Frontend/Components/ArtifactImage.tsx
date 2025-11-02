import { ArtifactFileColor } from "@df/gamelogic";
import type { Artifact } from "@df/types";
import { ArtifactRarity, ArtifactType, Biome, SpaceshipType } from "@df/types";
import { useEffect, useRef } from "react";
import styled, { css } from "styled-components";

import { useCraftedSpaceshipByArtifact } from "../../hooks/useCraftedSpaceship";
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
  const spriteUrl =
    spaceshipType !== undefined
      ? SPACESHIP_SPRITES[spaceshipType as keyof typeof SPACESHIP_SPRITES]
      : undefined;

  // For spaceship artifacts, use custom sprite rendering
  if (artifact.artifactType === ArtifactType.Spaceship && spriteUrl) {
    return (
      <SpaceshipContainer size={size}>
        {isMythic ? (
          <MythicSpaceshipSprite
            size={size}
            src={spriteUrl}
            biomeIndex={biomeIndex}
            isLegendary={isLegendary}
          />
        ) : (
          <SpaceshipSpriteImage
            size={size}
            src={spriteUrl}
            biomeIndex={biomeIndex}
            isLegendary={isLegendary}
            isMythic={isMythic}
          />
        )}
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
        willReadFrequently={true}
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
