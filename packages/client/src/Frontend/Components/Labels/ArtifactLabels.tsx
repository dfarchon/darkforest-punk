import { isAncient } from "@df/gamelogic";
import {
  isAvatar,
  isLogo,
  isMeme,
  numToAvatarType,
  numToLogoType,
  numToMemeType,
} from "@df/procedural";
import {
  type Artifact,
  ArtifactRarity,
  ArtifactRarityNames,
  ArtifactType,
  ArtifactTypeNames,
  AvatarTypeNames,
  BiomeNames,
  getArtifactTypeName,
  LogoType,
  LogoTypeNames,
  MemeTypeNames,
} from "@df/types";
import styled from "styled-components";

import { RarityColors } from "../../Styles/Colors";
import { LegendaryLabel } from "./LegendaryLabel";
import { MythicLabel } from "./MythicLabel";

export const ArtifactRarityText = ({ rarity }: { rarity: ArtifactRarity }) => (
  <>{ArtifactRarityNames[rarity]}</>
);

export const ArtifactBiomeText = ({ artifact }: { artifact: Artifact }) => (
  <>{isAncient(artifact) ? "Ancient" : BiomeNames[artifact.planetBiome]}</>
);

export const ArtifactTypeText = ({ artifact }: { artifact: Artifact }) => {
  const imageType = artifact.imageType;
  let content = "";

  if (isMeme(imageType)) {
    content = MemeTypeNames[numToMemeType(imageType)];
  } else if (isLogo(imageType)) {
    content = LogoTypeNames[numToLogoType(imageType)];
  } else if (isAvatar(imageType)) {
    content = AvatarTypeNames[numToAvatarType(imageType)];
  } else {
    content = LogoTypeNames[LogoType.DFARES];
  }

  // console.log(imageType);
  // console.log(isAvatar(imageType));
  // console.log(content);

  return (
    <>
      {getArtifactTypeName(artifact)}
      {artifact.artifactType === ArtifactType.Avatar && ":" + content}
    </>
  );
};

// colored labels

export const StyledArtifactRarityLabel = styled.span<{
  rarity: ArtifactRarity;
}>`
  color: ${({ rarity }) => RarityColors[rarity]};
`;

export const ArtifactRarityLabel = ({ rarity }: { rarity: ArtifactRarity }) => (
  <StyledArtifactRarityLabel rarity={rarity}>
    <ArtifactRarityText rarity={rarity} />
  </StyledArtifactRarityLabel>
);

export const ArtifactRarityLabelAnim = ({
  rarity,
}: {
  rarity: ArtifactRarity;
}) => {
  switch (rarity) {
    case ArtifactRarity.Mythic:
      return <MythicLabel />;
    case ArtifactRarity.Legendary:
      return <LegendaryLabel />;
    default:
      return <ArtifactRarityLabel rarity={rarity} />;
  }
};

// combined labels

export const ArtifactRarityBiomeTypeText = ({
  artifact,
}: {
  artifact: Artifact;
}) => (
  <>
    <ArtifactRarityText rarity={artifact.rarity} />{" "}
    <ArtifactBiomeText artifact={artifact} />{" "}
    <ArtifactTypeText artifact={artifact} />
  </>
);
