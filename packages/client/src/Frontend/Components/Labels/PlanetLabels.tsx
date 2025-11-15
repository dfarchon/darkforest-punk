import { EMPTY_ADDRESS } from "@df/constants";
import { formatEtherToNumber, formatNumber } from "@df/gamelogic";
import { getPlayerColor } from "@df/procedural";
import type { Planet } from "@df/types";
import type { MaterialType } from "@df/types";
import { PlanetType, PlanetTypeNames } from "@df/types";
import { TooltipName } from "@df/types";
import {
  getMaterialColor,
  getMaterialIcon,
  getMaterialName,
} from "@frontend/Panes/PlanetMaterialsPane";
import {
  getMaterialTooltipName,
  TooltipTrigger,
} from "@frontend/Panes/Tooltip";
import React from "react";
import styled from "styled-components";

import { getPlanetRank } from "../../../Backend/Utils/Utils";
import dfstyles from "../../Styles/dfstyles";
import { useAccount, usePlayer, useUIManager } from "../../Utils/AppHooks";
import { EmSpacer } from "../CoreUI";
import { Colored, Sub, Subber, White } from "../Text";
import { TextPreview } from "../TextPreview";
import { OptionalPlanetBiomeLabelAnim } from "./BiomeLabels";
import { TwitterLink } from "./Labels";
import { SpacetimeRipLabel } from "./SpacetimeRipLabel";

/* note that we generally prefer `Planet | undefined` over `Planet` because it
   makes it easier to pass in selected / hovering planet from the emitters      */

/* stat stuff */

export function StatText({
  planet,
  getStat,
  style,
  buff,
}: {
  planet: Planet | undefined;
  getStat: (p: Planet) => number;
  style?: React.CSSProperties;
  buff?: number;
}) {
  const textStyle = {
    ...style,
    color: buff ? dfstyles.colors.dforange : undefined,
  };

  let content;
  if (planet) {
    let stat = getStat(planet);
    if (buff) {
      stat *= buff;
    }
    content = formatNumber(stat, 2);
  } else {
    content = "n/a";
  }
  return <span style={textStyle}>{content}</span>;
}

export function GrowthText({
  planet,
  getStat,
  style,
}: {
  planet: Planet | undefined;
  getStat: (p: Planet) => number;
  style?: React.CSSProperties;
}) {
  const paused = planet && planet.pausers > 0;
  const statStyle = {
    ...style,
    textDecoration: paused ? "line-through" : "none",
  };

  return <StatText style={statStyle} planet={planet} getStat={getStat} />;
}

const getSilver = (p: Planet) => p.silver;
export const SilverText = ({ planet }: { planet: Planet | undefined }) => (
  <StatText planet={planet} getStat={getSilver} />
);

const getSilverCap = (p: Planet) => p.silverCap;
export const SilverCapText = ({ planet }: { planet: Planet | undefined }) => (
  <StatText planet={planet} getStat={getSilverCap} />
);

const getPopulation = (p: Planet) => p.population;
export const PopulationText = ({ planet }: { planet: Planet | undefined }) => (
  <StatText planet={planet} getStat={getPopulation} />
);

const getPopulationCap = (p: Planet) => p.populationCap;
export const PopulationCapText = ({
  planet,
}: {
  planet: Planet | undefined;
}) => <StatText planet={planet} getStat={getPopulationCap} />;

export function PlanetPopulationLabel({
  planet,
}: {
  planet: Planet | undefined;
}) {
  return (
    <span>
      <PopulationText planet={planet} /> <Subber>/</Subber>{" "}
      <PopulationCapText planet={planet} />
    </span>
  );
}

export function PlanetSilverLabel({ planet }: { planet: Planet | undefined }) {
  return (
    <span>
      <SilverText planet={planet} /> <Subber>/</Subber>{" "}
      <SilverCapText planet={planet} />
    </span>
  );
}

const getDefense = (p: Planet) => p.defense;
export const DefenseText = ({ planet }: { planet: Planet | undefined }) => (
  <StatText planet={planet} getStat={getDefense} />
);

const getRange = (p: Planet) => p.range;
export const RangeText = ({
  planet,
  buff,
}: {
  planet: Planet | undefined;
  buff?: number;
}) => <StatText planet={planet} getStat={getRange} buff={buff} />;

const getJunk = (p: Planet) => {
  const PLANET_LEVEL_JUNK = [50, 55, 60, 65, 75, 100, 200, 250, 300, 500];
  return PLANET_LEVEL_JUNK[p.planetLevel];
};
export const JunkText = ({ planet }: { planet: Planet | undefined }) => (
  <StatText planet={planet} getStat={getJunk} />
);

const getSpeed = (p: Planet) => p.speed;
export const SpeedText = ({
  planet,
  buff,
}: {
  planet: Planet | undefined;
  buff?: number;
}) => <StatText planet={planet} getStat={getSpeed} buff={buff} />;

const getPopulationGrowth = (p: Planet) => p.populationGrowth;
export const PopulationGrowthText = ({
  planet,
}: {
  planet: Planet | undefined;
}) => <GrowthText planet={planet} getStat={getPopulationGrowth} />;

const getSilverGrowth = (p: Planet) => p.silverGrowth;
export const SilverGrowthText = ({
  planet,
}: {
  planet: Planet | undefined;
}) => <GrowthText planet={planet} getStat={getSilverGrowth} />;

// level and rank stuff
export const PlanetLevelText = ({ planet }: { planet: Planet | undefined }) =>
  planet ? <>Level {planet.planetLevel}</> : <></>;

export const PlanetRankText = ({ planet }: { planet: Planet | undefined }) =>
  planet ? <>Rank {getPlanetRank(planet)}</> : <></>;

export const LevelRankText = ({
  planet,
  delim,
}: {
  planet: Planet | undefined;
  delim?: string;
}) => (
  <>
    <PlanetLevelText planet={planet} />
    {delim || ", "}
    <PlanetRankText planet={planet} />
  </>
);

export const LevelRankTextEm = ({
  planet,
  delim,
}: {
  planet: Planet | undefined;
  delim?: string;
}) =>
  planet ? (
    <Sub>
      lvl <White>{planet.planetLevel}</White>
      {delim || ", "}
      rank <White>{getPlanetRank(planet)}</White>
    </Sub>
  ) : (
    <></>
  );

export const PlanetTypeLabelAnim = ({
  planet,
}: {
  planet: Planet | undefined;
}) => (
  <>
    {planet &&
      (planet.planetType === PlanetType.TRADING_POST ? (
        <SpacetimeRipLabel />
      ) : (
        PlanetTypeNames[planet.planetType]
      ))}
  </>
);

export const PlanetBiomeTypeLabelAnim = ({
  planet,
}: {
  planet: Planet | undefined;
}) => (
  <>
    {planet?.planetType !== PlanetType.TRADING_POST && (
      <>
        <OptionalPlanetBiomeLabelAnim planet={planet} />
        <EmSpacer width={0.5} />
      </>
    )}
    <PlanetTypeLabelAnim planet={planet} />
  </>
);

export const PlanetLevel = ({ planet }: { planet: Planet | undefined }) => {
  if (!planet) {
    return <></>;
  }
  return (
    <>
      <Sub>{"Level "}</Sub>
      {planet.planetLevel}
    </>
  );
};

export const PlanetRank = ({ planet }: { planet: Planet | undefined }) => {
  if (!planet) {
    return <></>;
  }
  return (
    <>
      <Sub>{"Rank "}</Sub>
      {getPlanetRank(planet)}
    </>
  );
};

/**
 * Either 'yours' in green text,
 */
export function PlanetOwnerLabel({
  planet,
  abbreviateOwnAddress,
  colorWithOwnerColor,
}: {
  planet: Planet | undefined;
  abbreviateOwnAddress?: boolean;
  colorWithOwnerColor?: boolean;
}) {
  const uiManager = useUIManager();
  const account = useAccount(uiManager);
  const owner = usePlayer(uiManager, planet?.owner);

  const defaultColor = dfstyles.colors.subtext;

  if (!planet) {
    return <>/</>;
  }

  if (planet.owner === EMPTY_ADDRESS) {
    return <Sub>Unclaimed</Sub>;
  }

  if (abbreviateOwnAddress && planet.owner === account) {
    return <Colored color={dfstyles.colors.dfgreen}>yours!</Colored>;
  }

  const color = colorWithOwnerColor
    ? defaultColor
    : getPlayerColor(planet.owner);
  if (planet.owner && owner.value?.twitter) {
    return <TwitterLink color={color} twitter={owner.value.twitter} />;
  }

  return (
    <Colored color={color}>
      <TextPreview text={planet.owner} />
    </Colored>
  );
}

export function MaterialsText({
  planet,
  style,
}: {
  planet: Planet | undefined;
  style?: React.CSSProperties;
}) {
  if (!planet || !planet.materials || planet.materials.length === 0) {
    return <span style={style}>No materials</span>;
  }

  // Filter out materials with 0 amount and UNKNOWN type
  const activeMaterials = planet.materials.filter(
    (mat) => mat.materialId !== 0 && Number(mat.materialAmount) > 0,
  );

  if (activeMaterials.length === 0) {
    return <span style={style}>No materials</span>;
  }

  return (
    <span style={style}>
      {activeMaterials.map((mat, index) => (
        <span key={mat.materialId}>
          {index > 0 && " "}
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "1px",
            }}
          >
            <span
              style={{
                width: "10px",
                height: "10px",
                backgroundColor: "transparent",
                borderRadius: "2px",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "10px",
                lineHeight: "1",
                cursor: "help",
              }}
            >
              {" "}
              <TooltipTrigger name={getMaterialTooltipName(mat.materialId)}>
                {getMaterialIcon(mat.materialId)}
              </TooltipTrigger>
            </span>
            <span
              style={{
                color: getMaterialColor(mat.materialId),
                fontWeight: "bold",
              }}
            >
              {formatNumber(mat.materialAmount)}
            </span>
          </span>
        </span>
      ))}
    </span>
  );
}

const MaterialsScrollable = styled.div`
  position: relative;
  max-height: 200px;

  overflow-y: auto;
  padding: 0px;
  direction: rtl;

  & > * {
    direction: ltr;
  }

  &::-webkit-scrollbar {
    width: 16px;
    background-color: transparent;
  }

  &::-webkit-scrollbar-thumb {
    background-color: #888;
    border-radius: 8px;
    border: 4px solid transparent;
  }

  &::-webkit-scrollbar-thumb:hover {
    background-color: #555;
  }

  &::-webkit-scrollbar-track {
    margin: 8px 0;
    border-radius: 8px;
    background-color: transparent;
  }

  scrollbar-width: thin;
  scrollbar-color: #888 transparent;
`;

const MaterialsGrid = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1px;
  background-color: transparent;
  border: 1px solid ${dfstyles.colors.borderDarker};
  border-radius: 4px;
  overflow: hidden;
`;

const MaterialItem = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 4px 10px;
  background-color: ${dfstyles.colors.backgroundlight};
  min-height: 20px;
  border-right: 1px solid ${dfstyles.colors.borderDarker};
  border-bottom: 1px solid ${dfstyles.colors.borderDarker};

  &:nth-child(even) {
    border-right: none;
  }

  &:nth-last-child(-n + 2) {
    border-bottom: none;
  }
`;

const MaterialIcon = styled.div<{ color: string }>`
  width: 10px;
  height: 10px;
  background-color: transparent;
  border-radius: 1px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  line-height: 1;
  flex-shrink: 0;
  cursor: help;
  transition: transform 0.2s ease;

  &:hover {
    transform: scale(1.1);
    cursor: help;
  }
`;

const MaterialValues = styled.div`
  color: ${dfstyles.colors.text};
  font-size: 12px;
  font-weight: 500;
  line-height: 1;
`;

export function MaterialsDisplay({
  planet,
  style,
}: {
  planet: Planet | undefined;
  style?: React.CSSProperties;
}) {
  if (!planet || !planet.materials || planet.materials.length === 0) {
    return null;
  }

  // Filter out materials with 0 amount and UNKNOWN type
  const activeMaterials = planet.materials.filter(
    (mat) => mat.materialId !== 0 && Number(mat.materialAmount) > 0,
  );

  if (activeMaterials.length === 0) {
    return null;
  }

  return (
    <div style={style}>
      <MaterialsScrollable>
        <MaterialsGrid>
          {activeMaterials.map((mat) => {
            const materialColor = getMaterialColor(mat.materialId);

            return (
              <MaterialItem key={mat.materialId}>
                <TooltipTrigger name={getMaterialTooltipName(mat.materialId)}>
                  <MaterialIcon color={materialColor}>
                    {getMaterialIcon(mat.materialId)}
                  </MaterialIcon>
                </TooltipTrigger>
                <MaterialValues>
                  {mat.growth && `+${formatNumber(Number(mat.growthRate), 2)} `}
                  {formatNumber(Number(mat.materialAmount), 0)} /{" "}
                  {formatNumber(Number(mat.cap), 0)}
                </MaterialValues>
              </MaterialItem>
            );
          })}
        </MaterialsGrid>
      </MaterialsScrollable>
    </div>
  );
}
