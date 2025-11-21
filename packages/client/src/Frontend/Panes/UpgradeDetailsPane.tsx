import { isUnconfirmedUpgradeTx } from "@df/serde";
import type { LocationId, Planet } from "@df/types";
import { PlanetType, UpgradeBranchName } from "@df/types";
import styled from "styled-components";

import {
  getPlanetMaxRank,
  getPlanetRank,
  isFullRank,
  upgradeName,
} from "../../Backend/Utils/Utils";
import { Btn } from "../Components/Btn";
import { CenterBackgroundSubtext, Spacer } from "../Components/CoreUI";
import { LoadingSpinner } from "../Components/LoadingSpinner";
import { Gold, Red, Sub, Subber } from "../Components/Text";
import { useAccount, usePlanet, useUIManager } from "../Utils/AppHooks";
import { useEmitterValue } from "../Utils/EmitterHooks";
import type { ModalHandle } from "../Views/ModalPane";
import { TabbedView } from "../Views/TabbedView";
import { UpgradePreview } from "../Views/UpgradePreview";

const SECTION_MARGIN = "0.75em";

const SectionPreview = styled.div`
  margin-top: ${SECTION_MARGIN};
`;

const SectionBuy = styled.div`
  margin-top: ${SECTION_MARGIN};
`;

export function UpgradeDetailsPaneHelpContent() {
  return (
    <div>
      <p>
        Upgrades cost Silver, and allow you to boost the stats of your planet.
        You need to move the required silver to this planet to be able to spend
        it on upgrades.
      </p>
      <Spacer height={8} />
      <p>
        All planets have a certain max rank, and each branch can only be
        upgraded so many times. Choose wisely!
      </p>
    </div>
  );
}

function SilverRequired({ planet }: { planet: Planet }) {
  const maxRank = getPlanetMaxRank(planet);
  const silverPerRank = [];

  for (let i = 0; i < maxRank; i++) {
    silverPerRank[i] = Math.floor((i + 1) * 0.2 * planet.silverCap);
  }

  return (
    <>
      {silverPerRank.map((silver: number, i: number) => (
        <span key={i}>
          {i === getPlanetRank(planet) ? (
            <Gold>{silver}</Gold>
          ) : (
            <Subber>{silver}</Subber>
          )}
          <Spacer width={8} />
        </span>
      ))}
    </>
  );
}

const getUpgradeStatusMessage = (
  planetAtMaxRank: boolean,
  branchAtMaxRank: boolean,
  enoughSilver: boolean,
  branch: UpgradeBranchName,
  canUpgradeBranch?: boolean,
) => {
  if (planetAtMaxRank) return <Red>Planet at Max Rank</Red>;
  if (branchAtMaxRank) return <Red>{upgradeName(branch)} at Max Rank</Red>;
  if (!enoughSilver) return <Red>Not Enough Silver</Red>;
  if (canUpgradeBranch === false)
    return <Red>Asteroid Field can only be upgraded once</Red>;
  return null;
};

export function UpgradeDetailsPane({
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
  const planetAtMaxRank = isFullRank(planet);
  const gameManager = uiManager.getGameManager();

  if (planet && account) {
    if (gameManager.checkDelegateCondition(planet.owner, account) === false) {
      // Empty block
    } else if (
      (planet.planetType !== PlanetType.PLANET &&
        planet.planetType !== PlanetType.STARBASE &&
        planet.planetType !== PlanetType.SILVER_MINE) ||
      planet.silverCap === 0
    ) {
      return (
        <CenterBackgroundSubtext width="100%" height="75px">
          This Planet <br /> is not Upgradeable
        </CenterBackgroundSubtext>
      );
    } else {
      // For SILVER_MINE (ASTEROID_FIELD): show all branches but only allow one upgrade total
      // For PLANET and STARBASE: show all three branches
      const isSilverMine = planet.planetType === PlanetType.SILVER_MINE;

      let tabTitles: string[] = [];
      let allowedBranches: UpgradeBranchName[] = [];

      if (isSilverMine) {
        // ASTEROID_FIELD: show all three branches, user can choose any one (or two for level 9)
        tabTitles = ["Defense", "Range", "Speed"];
        allowedBranches = [
          UpgradeBranchName.Defense,
          UpgradeBranchName.Range,
          UpgradeBranchName.Speed,
        ];
      } else {
        // PLANET and STARBASE: all three branches
        tabTitles = ["Defense", "Range", "Speed"];
        allowedBranches = [
          UpgradeBranchName.Defense,
          UpgradeBranchName.Range,
          UpgradeBranchName.Speed,
        ];
      }

      return (
        <TabbedView
          tabTitles={tabTitles}
          tabContents={(branchIndex: number) => {
            const upgradeBranch = allowedBranches[branchIndex];
            const currentLevel = planet.upgradeState[upgradeBranch];
            const branchAtMaxRank =
              !planet || planet.upgradeState[upgradeBranch] >= 4;
            const upgrade = branchAtMaxRank
              ? undefined
              : uiManager.getUpgrade(upgradeBranch, currentLevel);

            const totalLevel = planet.upgradeState.reduce((a, b) => a + b);
            const silverNeeded = Math.floor(
              (totalLevel + 1) * 0.2 * planet.silverCap,
            );
            const enoughSilver = planet.silver >= silverNeeded;
            const isPendingUpgrade = planet.transactions?.hasTransaction(
              isUnconfirmedUpgradeTx,
            );

            // For ASTEROID_FIELD: only allow one upgrade total (one-time upgrade)
            let canUpgradeBranch = true;
            if (isSilverMine) {
              // ASTEROID_FIELD can only be upgraded once total
              // If it has already been upgraded (totalLevel > 0), no more upgrades allowed
              if (totalLevel > 0) {
                canUpgradeBranch = false;
              }
            }

            const canUpgrade =
              enoughSilver &&
              !planetAtMaxRank &&
              !branchAtMaxRank &&
              !isPendingUpgrade &&
              canUpgradeBranch;

            const doUpgrade = () => {
              if (canUpgrade) {
                uiManager.upgrade(planet, upgradeBranch);
              }
            };

            return (
              <>
                <SectionPreview>
                  <UpgradePreview
                    upgrade={upgrade}
                    planet={planet}
                    branchName={upgradeBranch}
                    cantUpgrade={planetAtMaxRank || branchAtMaxRank}
                  />
                </SectionPreview>
                <SectionBuy>
                  <div>
                    <Sub>Silver Available</Sub>: <span>{planet.silver}</span>
                  </div>
                  <div>
                    <Sub>Silver Cost:</Sub> <SilverRequired planet={planet} />
                  </div>
                  <div>
                    <Spacer height={8} />
                    {isPendingUpgrade ? (
                      <Btn disabled={true}>
                        <LoadingSpinner initialText="Upgrading..." />
                      </Btn>
                    ) : (
                      <>
                        <Btn onClick={doUpgrade} disabled={!canUpgrade}>
                          {"Upgrade"}
                        </Btn>{" "}
                        {getUpgradeStatusMessage(
                          planetAtMaxRank,
                          branchAtMaxRank,
                          enoughSilver,
                          upgradeBranch,
                          canUpgradeBranch,
                        )}
                      </>
                    )}
                  </div>
                </SectionBuy>
              </>
            );
          }}
        />
      );
    }
  }

  return (
    <CenterBackgroundSubtext width="100%" height="75px">
      Select a Planet <br /> You Own
    </CenterBackgroundSubtext>
  );
}
