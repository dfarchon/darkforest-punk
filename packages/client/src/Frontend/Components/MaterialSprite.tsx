import React from "react";
import styled from "styled-components";

import type { MaterialType } from "@df/types";

const MaterialSpriteContainer = styled.img<{
  size: number;
}>`
  width: ${({ size }) => size}px;
  height: ${({ size }) => size}px;
  display: inline-block;
  vertical-align: middle;
  image-rendering: crisp-edges;
  object-fit: contain;
`;

interface MaterialSpriteProps {
  materialId: MaterialType;
  size?: number;
  className?: string;
  style?: React.CSSProperties;
}

// Map material IDs to their corresponding image filenames
const getMaterialImagePath = (materialId: MaterialType): string => {
  const materialImages: Record<MaterialType, string> = {
    0: "/img/404-text.png",
    1: "/icons/Materials/1 Water.png",
    2: "/icons/Materials/2 Wood.png",
    3: "/icons/Materials/3 Windsteel.png",
    4: "/icons/Materials/4 Auroruim.png",
    5: "/icons/Materials/5 Mycelium Gel.png",
    6: "/icons/Materials/6 Sandglass.png",
    7: "/icons/Materials/7 Icestone.png",
    8: "/icons/Materials/8 Scrapium.png",
    9: "/icons/Materials/9 Pyrosteel.png",
    10: "/icons/Materials/10 Blackalloy.png",
    11: "/icons/Materials/11 Crystall.png",
    12: "/icons/Materials/12 Solar Energy.png",
  };

  return materialImages[materialId] || "/img/404-text.png";
};

export function MaterialSprite({
  materialId,
  size = 64, // Doubled from 64 to 128 (twice as big: 64 * 2 = 128)
  className,
  style,
}: MaterialSpriteProps) {
  const imagePath = getMaterialImagePath(materialId);

  return (
    <MaterialSpriteContainer
      src={imagePath}
      alt={`Material ${materialId}`}
      size={size}
      className={className}
      style={style}
      onError={(e) => {
        console.error(`Failed to load material image: ${imagePath}`, e);
      }}
    />
  );
}
