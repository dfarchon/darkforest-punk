import { isLocatable } from "@df/gamelogic";
import {
  getPlanetName,
  isAvatar,
  isLogo,
  isMeme,
  numToAvatarType,
  numToLogoType,
} from "@df/procedural";
import { avatarFromType, logoFromType } from "@df/renderer";
import type { Planet } from "@df/types";
import { TooltipName } from "@df/types";
import React from "react";
import styled from "styled-components";

import { StatIdx } from "../../_types/global/GlobalTypes";
import type { Wrapper } from "../../Backend/Utils/Wrapper";
import {
  AlignCenterHorizontally,
  EmSpacer,
  InlineBlock,
  SpreadApart,
} from "../Components/CoreUI";
import { Icon, IconType } from "../Components/Icons";
import { AccountLabel } from "../Components/Labels/Labels";
import { MythicLabelText } from "../Components/Labels/MythicLabel";
import {
  DefenseText,
  PopulationGrowthText,
  JunkText,
  MaterialsDisplay,
  PlanetBiomeTypeLabelAnim,
  PlanetPopulationLabel,
  PlanetLevel,
  PlanetRank,
  PlanetSilverLabel,
  RangeText,
  SilverGrowthText,
  SpeedText,
} from "../Components/Labels/PlanetLabels";
import { Sub } from "../Components/Text";
import { PlanetIcons } from "../Renderers/PlanetscapeRenderer/PlanetIcons";
import dfstyles, { snips } from "../Styles/dfstyles";
import {
  useActiveArtifact,
  usePlanetArtifacts,
  useUIManager,
} from "../Utils/AppHooks";
import { useEmitterValue } from "../Utils/EmitterHooks";
import { useSpaceshipMovement } from "../../hooks/useSpaceshipMovement";
import { isArtifactSpaceShip } from "@df/gamelogic";
import { ArtifactType } from "@df/types";
import { SelectArtifactRow } from "./ArtifactRow";
import {
  Halved,
  PlanetActiveArtifact,
  RowTip,
  TimesTwo,
  TitleBar,
} from "./PlanetCardComponents";

const InfoHead = styled.div`
  text-align: center;
  font-size: 120%;
  font-weight: bold;
  color: yellow;
`;

export function PlanetCardTitle({
  planet,
  small,
}: {
  planet: Wrapper<Planet | undefined>;
  small?: boolean;
}) {
  if (!planet.value) {
    return <></>;
  }
  if (small) {
    return <>{getPlanetName(planet.value)}</>;
  }

  const p = planet.value;
  let planetNameDiv = <div> {getPlanetName(planet.value)} </div>;

  if (p.hatLevel > 0 && isMeme(p.hatType)) {
    // const memeType = numToMemeType(p.hatType);
    // const meme = memeFromType(memeType);
    // const memeColor = meme.color;
    planetNameDiv = <MythicLabelText text={getPlanetName(p)} />;
  }

  if (p.hatLevel > 0 && isLogo(p.hatType)) {
    const logoType = numToLogoType(p.hatType);
    const logo = logoFromType(logoType);
    const logoColor = logo.color;
    planetNameDiv = (
      <div style={{ color: logoColor }}> {getPlanetName(p)} </div>
    );
  }

  if (p.hatLevel > 0 && isAvatar(p.hatType)) {
    // const avatarType = numToAvatarType(p.hatType);
    // const avatar = avatarFromType(avatarType);
    // const avatarColor = avatar.color;
    planetNameDiv = <MythicLabelText text={getPlanetName(p)} />;
  }
  return (
    <AlignCenterHorizontally
      style={{ width: "initial", display: "inline-flex" }}
    >
      {planetNameDiv}
      <EmSpacer width={0.5} />
      <PlanetIcons planet={planet.value} />
    </AlignCenterHorizontally>
  );
}

const ElevatedContainer = styled.div`
  ${snips.roundedBordersWithEdge}
  border-color: ${dfstyles.colors.borderDarker};
  background-color: ${dfstyles.colors.backgroundlight};
  margin-top: 8px;
  margin-bottom: 8px;
  font-size: 85%;
`;

const DescContainer = styled.div`
  &:hover {
    text-decoration: underline;
  }
`;

/** Preview basic planet information - used in `PlanetContextPane` and `HoverPlanetPane` */
export function PlanetCard({
  planetWrapper: p,
  standalone,
}: {
  planetWrapper: Wrapper<Planet | undefined>;
  standalone?: boolean;
}) {
  const uiManager = useUIManager();
  const active = useActiveArtifact(p, uiManager);
  const planet = p.value;
  const artifacts = usePlanetArtifacts(p, uiManager);
  const spaceJunkEnabled = uiManager.getSpaceJunkEnabled();
  const isAbandoning = useEmitterValue(
    uiManager.isAbandoning$,
    uiManager.isAbandoning(),
  );

  // Get spaceship bonuses if a spaceship is selected for movement
  const { getSpaceshipBonusesForArtifact } = useSpaceshipMovement();
  const artifactSendingChange = useEmitterValue(
    uiManager.artifactSending$,
    undefined,
  );
  const artifactSending =
    planet && artifactSendingChange?.planetId === planet.locationId
      ? artifactSendingChange.artifact
      : undefined;

  // Get real spaceship bonuses from MUD table
  const spaceshipBonuses =
    artifactSending && isArtifactSpaceShip(artifactSending.artifactType)
      ? getSpaceshipBonusesForArtifact(artifactSending)
      : undefined;

  const gameManager = uiManager.getGameManager();
  const player = gameManager.getPlayer(planet?.owner);

  const account = planet?.owner;
  const guildId = account ? gameManager.getPlayerGuildId(account) : undefined;

  const guild = gameManager.getGuild(guildId);

  if (!planet || !isLocatable(planet)) {
    return <></>;
  }

  let showDesc = <div></div>;

  if (planet.hatLevel > 0 && isMeme(planet.hatType)) {
    // Empty block
  }

  if (planet.hatLevel > 0 && isLogo(planet.hatType)) {
    const logoType = numToLogoType(planet.hatType);
    const logo = logoFromType(logoType);
    const website = logo.website;
    const logoColor = logo.color;

    showDesc = (
      <div>
        <div style={{ color: logoColor }} onClick={() => window.open(website)}>
          <DescContainer>{logo.desc}</DescContainer>
        </div>
      </div>
    );
  }

  if (planet.hatLevel > 0 && isAvatar(planet.hatType)) {
    const avatarType = numToAvatarType(planet.hatType);
    const avatar = avatarFromType(avatarType);
    const desc = avatar.desc;
    if (desc !== "") {
      showDesc = <div style={{ color: "pink", fontSize: "20px" }}>{desc}</div>;
    }
  }

  return (
    <>
      {standalone && (
        <TitleBar>
          <PlanetCardTitle planet={p} />
        </TitleBar>
      )}
      <div style={{ padding: standalone ? "8px" : undefined }}>
        <AlignCenterHorizontally style={{ justifyContent: "space-between" }}>
          <InlineBlock>
            <PlanetLevel planet={planet} />
            <EmSpacer width={0.5} />
            <PlanetRank planet={planet} />
            <EmSpacer width={0.5} />
            <PlanetBiomeTypeLabelAnim planet={planet} />
            <EmSpacer width={0.5} />
          </InlineBlock>
        </AlignCenterHorizontally>
        {active && (
          <>
            <EmSpacer height={0.5} />
            <PlanetActiveArtifact artifact={active} planet={planet} />
          </>
        )}

        <StatRow>{showDesc}</StatRow>

        <ElevatedContainer>
          <StatRow>
            <SpreadApart>
              <div
                style={{
                  border: `1px solid ${dfstyles.colors.borderDarker}`,
                  borderTop: "none",
                  borderLeft: "none",
                  width: "50%",
                }}
              >
                <RowTip name={TooltipName.Energy}>
                  <SpreadApart>
                    <AlignCenterHorizontally>
                      <EmSpacer width={0.5} />
                      <Icon type={IconType.Energy} />
                    </AlignCenterHorizontally>
                    <AlignCenterHorizontally>
                      <PlanetPopulationLabel planet={planet} />
                      {planet?.bonus && planet.bonus[StatIdx.PopulationCap] && (
                        <TimesTwo />
                      )}
                      <EmSpacer width={0.5} />
                    </AlignCenterHorizontally>
                  </SpreadApart>
                </RowTip>
              </div>
              <div
                style={{
                  border: `1px solid ${dfstyles.colors.borderDarker}`,
                  borderTop: "none",
                  borderRight: "none",
                  borderLeft: "none",
                  width: "50%",
                }}
              >
                <RowTip name={TooltipName.Silver}>
                  <SpreadApart>
                    <AlignCenterHorizontally>
                      <EmSpacer width={0.5} />
                      <Icon type={IconType.Silver} />
                    </AlignCenterHorizontally>
                    <AlignCenterHorizontally>
                      <PlanetSilverLabel planet={planet} />
                      <EmSpacer width={0.5} />
                    </AlignCenterHorizontally>
                  </SpreadApart>
                </RowTip>
              </div>
            </SpreadApart>
          </StatRow>
          <StatRow>
            <SpreadApart>
              <div
                style={{
                  border: `1px solid ${dfstyles.colors.borderDarker}`,
                  borderTop: "none",
                  borderLeft: "none",
                  borderBottom: "none",
                  width: "50%",
                }}
              >
                <RowTip name={TooltipName.EnergyGrowth}>
                  <SpreadApart>
                    <AlignCenterHorizontally>
                      <EmSpacer width={0.5} />
                      <Icon type={IconType.EnergyGrowth} />
                    </AlignCenterHorizontally>
                    <AlignCenterHorizontally>
                      <PopulationGrowthText planet={planet} />
                      {planet?.bonus && planet.bonus[StatIdx.PopulationGro] && (
                        <TimesTwo />
                      )}
                      <EmSpacer width={0.5} />
                    </AlignCenterHorizontally>
                  </SpreadApart>
                </RowTip>
              </div>
              <div
                style={{
                  borderBottom: "none",
                  borderTop: "none",
                  borderRight: "none",
                  width: "50%",
                }}
              >
                <RowTip name={TooltipName.SilverGrowth}>
                  <SpreadApart>
                    <AlignCenterHorizontally>
                      <EmSpacer width={0.5} />
                      <Icon type={IconType.SilverGrowth} />
                    </AlignCenterHorizontally>
                    <AlignCenterHorizontally>
                      <SilverGrowthText planet={p.value} />
                      <EmSpacer width={0.5} />
                    </AlignCenterHorizontally>
                  </SpreadApart>
                </RowTip>
              </div>
            </SpreadApart>
          </StatRow>

          <StatRow>
            <SpreadApart>
              <div
                style={{
                  border: `1px solid ${dfstyles.colors.borderDarker}`,
                  borderBottom: "none",
                  borderLeft: "none",
                  width: spaceJunkEnabled ? "25%" : "34%",
                }}
              >
                <RowTip name={TooltipName.Defense}>
                  <SpreadApart>
                    <AlignCenterHorizontally>
                      <EmSpacer width={0.5} />
                      <Icon type={IconType.Defense} />
                    </AlignCenterHorizontally>
                    <AlignCenterHorizontally>
                      <DefenseText planet={planet} />
                      {planet?.bonus && planet.bonus[StatIdx.Defense] && (
                        <TimesTwo />
                      )}
                      <EmSpacer width={0.5} />
                    </AlignCenterHorizontally>
                  </SpreadApart>
                </RowTip>
              </div>

              <div
                style={{
                  border: `1px solid ${dfstyles.colors.borderDarker}`,
                  borderLeft: "none",
                  borderBottom: "none",
                  width: spaceJunkEnabled ? "25%" : "33%",
                }}
              >
                <RowTip name={TooltipName.Speed}>
                  <SpreadApart>
                    <AlignCenterHorizontally>
                      <EmSpacer width={0.5} />
                      <Icon type={IconType.Speed} />
                    </AlignCenterHorizontally>
                    <AlignCenterHorizontally>
                      <SpeedText
                        planet={planet}
                        buff={(() => {
                          if (isAbandoning) {
                            return uiManager.getSpeedBuff();
                          }
                          if (
                            spaceshipBonuses &&
                            spaceshipBonuses.speedBonus > 0
                          ) {
                            return (100 + spaceshipBonuses.speedBonus) / 100;
                          }
                          return undefined;
                        })()}
                      />
                      {planet?.bonus && planet.bonus[StatIdx.Speed] && (
                        <TimesTwo />
                      )}
                      <EmSpacer width={0.5} />
                    </AlignCenterHorizontally>
                  </SpreadApart>
                </RowTip>
              </div>

              <div
                style={{
                  border: `1px solid ${dfstyles.colors.borderDarker}`,
                  borderLeft: "none",
                  borderRight: "none",
                  borderBottom: "none",
                  width: spaceJunkEnabled ? "25%" : "33%",
                }}
              >
                <RowTip name={TooltipName.Range}>
                  <SpreadApart>
                    <AlignCenterHorizontally>
                      <EmSpacer width={0.5} />
                      <Icon type={IconType.Range} />
                    </AlignCenterHorizontally>

                    <AlignCenterHorizontally>
                      <RangeText
                        planet={planet}
                        buff={(() => {
                          if (isAbandoning) {
                            return uiManager.getRangeBuff();
                          }
                          if (
                            spaceshipBonuses &&
                            spaceshipBonuses.rangeBonus > 0
                          ) {
                            return (100 + spaceshipBonuses.rangeBonus) / 100;
                          }
                          return undefined;
                        })()}
                      />
                      {planet?.bonus && planet.bonus[StatIdx.Range] && (
                        <TimesTwo />
                      )}
                      <EmSpacer width={0.5} />
                    </AlignCenterHorizontally>
                  </SpreadApart>
                </RowTip>
              </div>

              {spaceJunkEnabled && (
                <div
                  style={{
                    border: `1px solid ${dfstyles.colors.borderDarker}`,
                    borderRight: "none",
                    borderBottom: "none",
                    width: "25%",
                  }}
                >
                  <RowTip name={TooltipName.SpaceJunk}>
                    <SpreadApart>
                      <AlignCenterHorizontally>
                        <EmSpacer width={0.5} />
                        <Icon type={IconType.TrashCan} />
                      </AlignCenterHorizontally>

                      <AlignCenterHorizontally>
                        <JunkText planet={planet} />
                        {planet?.bonus && planet.bonus[StatIdx.SpaceJunk] && (
                          <Halved />
                        )}
                        <EmSpacer width={0.5} />
                      </AlignCenterHorizontally>
                    </SpreadApart>
                  </RowTip>
                </div>
              )}
            </SpreadApart>
          </StatRow>
        </ElevatedContainer>

        {/* Materials Display */}
        {planet.materials && planet.materials.length > 0 && (
          <>
            <MaterialsDisplay planet={planet} />
            <EmSpacer height={0.5} />
          </>
        )}

        {standalone && (
          <>
            <SpreadApart>
              <Sub>owner</Sub>
              <Sub>
                <AccountLabel
                  ethAddress={planet.owner}
                  includeAddressIfHasTwitter={true}
                />
              </Sub>
            </SpreadApart>

            {player && <InfoHead>{player.name}</InfoHead>}
            {guild && (
              <InfoHead>
                {guild.name && guild.name.length !== 0
                  ? guild.name.toUpperCase() + " GUILD (ID:" + guild.id + ")"
                  : "ANONYMOUS GUILD (ID:" + guild.id + ")"}
              </InfoHead>
            )}
            <SelectArtifactRow artifacts={artifacts} />
          </>
        )}
      </div>
    </>
  );
}

const StatRow = styled(AlignCenterHorizontally)`
  ${snips.roundedBorders}
  display: inline-block;
  box-sizing: border-box;
  width: 100%;

  /* Set the Icon color to something a little dimmer */
  --df-icon-color: ${dfstyles.colors.subtext};
`;
