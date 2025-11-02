import type { Artifact } from "@df/types";
import { TooltipName } from "@df/types";
import styled from "styled-components";

import { useCraftedSpaceshipByArtifact } from "../../hooks/useCraftedSpaceship";
import { TooltipTrigger } from "../Panes/Tooltip";
import { Icon, IconType } from "./Icons";
import { Green } from "./Text";

const BonusesContainer = styled.div`
  margin-top: 8px;
`;

const BonusRow = styled.div`
  display: flex;
  flex-direction: row;
  justify-content: space-between;
  align-items: center;
  margin: 4px 0;

  & > span:first-child {
    margin-right: 1.5em;
    display: flex;
    align-items: center;
    gap: 8px;
  }

  & > span:last-child {
    text-align: right;
    width: 6em;
    flex-grow: 1;
  }
`;

const BonusValue = styled.span<{ positive?: boolean }>`
  color: ${({ positive }) => (positive ? "#00DC82" : "#FF6492")};
  font-weight: bold;
`;

interface SpaceshipBonusesProps {
  artifact: Artifact;
}

export function SpaceshipBonuses({ artifact }: SpaceshipBonusesProps) {
  const spaceshipData = useCraftedSpaceshipByArtifact(artifact);

  if (!spaceshipData) {
    return null;
  }

  const bonuses = [
    {
      icon: IconType.Defense,
      tooltip: TooltipName.Defense,
      label: "Attack",
      value: spaceshipData.attackBonus || 0,
    },
    {
      icon: IconType.Defense,
      tooltip: TooltipName.Defense,
      label: "Defense",
      value: spaceshipData.defenseBonus || 0,
    },
    {
      icon: IconType.Speed,
      tooltip: TooltipName.Speed,
      label: "Speed",
      value: spaceshipData.speedBonus || 0,
    },
    {
      icon: IconType.Range,
      tooltip: TooltipName.Range,
      label: "Range",
      value: spaceshipData.rangeBonus || 0,
    },
  ];

  return (
    <BonusesContainer>
      <Green>Spaceship Bonuses</Green>
      {bonuses.map((bonus, index) => (
        <BonusRow key={index}>
          <span>
            <TooltipTrigger name={bonus.tooltip}>
              <Icon type={bonus.icon} />
            </TooltipTrigger>
            {bonus.label}
          </span>
          <BonusValue positive={bonus.value > 0}>
            {bonus.value > 0 ? `+${bonus.value}%` : bonus.value}
          </BonusValue>
        </BonusRow>
      ))}
    </BonusesContainer>
  );
}
