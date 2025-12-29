import { isLocatable } from "@df/gamelogic";
import {
  isUnconfirmedChangeHomePlanetTx,
  isUnconfirmedSetHomePlanetTx,
  isUnconfirmedStakeTokensTx,
} from "@df/serde";
import type { LocatablePlanet, Planet } from "@df/types";
import { PlanetType } from "@df/types";
import { getComponentValue } from "@latticexyz/recs";
import { encodeEntity } from "@latticexyz/store-sync/recs";
import { useMUD } from "@mud/MUDContext";
import { useCallback, useMemo } from "react";
import styled from "styled-components";

import type { Wrapper } from "../../Backend/Utils/Wrapper";
import { useUIManager } from "../Utils/AppHooks";
import { LoadingSpinner } from "./LoadingSpinner";
import { MaybeShortcutButton } from "./MaybeShortcutButton";

const TextWrapper = styled.span`
  text-align: center;
  display: block;
  width: 100%;
`;

const ButtonContainer = styled.div`
  display: flex;
  flex-direction: column;
  width: 100%;
  margin-top: 4px;
  margin-bottom: 4px;
`;

export function HomePlanetButton({
  wrapper,
}: {
  wrapper: Wrapper<Planet | undefined>;
}) {
  const uiManager = useUIManager();
  const planet = wrapper.value;
  const account = uiManager.getAccount();
  const {
    components: { HomePlanet, StakedLevel },
  } = useMUD();

  // Check if player already has a home planet
  const hasHomePlanet = useMemo(() => {
    if (!HomePlanet || !account) {
      return false;
    }
    try {
      const playerEntityKey = encodeEntity(HomePlanet.metadata.keySchema, {
        player: account as `0x${string}`,
      });
      const homePlanetData = getComponentValue(HomePlanet, playerEntityKey);
      return (
        homePlanetData?.planetHash !== undefined &&
        homePlanetData.planetHash !==
          "0x0000000000000000000000000000000000000000000000000000000000000000"
      );
    } catch (e) {
      console.warn("Failed to check home planet:", e);
      return false;
    }
  }, [HomePlanet, account]);

  // Check if this planet is the current home planet
  const isCurrentHomePlanet = useMemo(() => {
    if (!HomePlanet || !account || !planet) {
      return false;
    }
    try {
      const playerEntityKey = encodeEntity(HomePlanet.metadata.keySchema, {
        player: account as `0x${string}`,
      });
      const homePlanetData = getComponentValue(HomePlanet, playerEntityKey);
      if (!homePlanetData?.planetHash) {
        return false;
      }
      // Compare planet hashes (convert to same format for comparison)
      const currentHomeHash = homePlanetData.planetHash.toLowerCase();
      const planetHash = planet.locationId.toLowerCase();
      return currentHomeHash === planetHash;
    } catch (e) {
      console.warn("Failed to check if current home planet:", e);
      return false;
    }
  }, [HomePlanet, account, planet]);

  const canSetHomePlanet = useMemo(() => {
    if (!planet) {
      return false;
    }
    // Must own the planet
    if (planet.owner !== account) {
      return false;
    }
    // Must be PLANET type
    if (planet.planetType !== PlanetType.PLANET) {
      return false;
    }
    // Must not be destroyed or frozen
    if (planet.destroyed || planet.frozen) {
      return false;
    }
    return true;
  }, [planet, account]);

  const setHomePlanet = useCallback(() => {
    if (!planet) {
      return;
    }
    if (hasHomePlanet && !isCurrentHomePlanet) {
      // Change home planet (has cooldown and fee)
      uiManager.changeHomePlanet(planet.locationId);
    } else if (!hasHomePlanet) {
      // Set home planet (first time, no fee)
      uiManager.setHomePlanet(planet.locationId);
    }
  }, [planet, uiManager, hasHomePlanet, isCurrentHomePlanet]);

  const changing = useMemo(
    () =>
      !!wrapper.value?.transactions?.hasTransaction(
        isUnconfirmedChangeHomePlanetTx,
      ),
    [wrapper],
  );

  const setting = useMemo(
    () =>
      !!wrapper.value?.transactions?.hasTransaction(
        isUnconfirmedSetHomePlanetTx,
      ),
    [wrapper],
  );

  const handleAction = () => {
    setHomePlanet();
  };

  if (!canSetHomePlanet) {
    return null;
  }

  // Check if player already has a staked planet (limit of 1 per home planet)
  // Use StakedLevel to check if player has any staked planets
  const hasStakedPlanet = useMemo(() => {
    if (!StakedLevel || !account) {
      return false;
    }
    try {
      const playerEntityKey = encodeEntity(StakedLevel.metadata.keySchema, {
        player: account as `0x${string}`,
      });
      const stakedLevelData = getComponentValue(StakedLevel, playerEntityKey);
      // If stakedLevel > 0, player has at least one staked planet
      return (stakedLevelData?.totalLevel ?? 0n) > 0n;
    } catch (e) {
      console.warn("Failed to check staked planets:", e);
      return false;
    }
  }, [StakedLevel, account]);

  const staking = useMemo(
    () =>
      !!wrapper.value?.transactions?.hasTransaction(isUnconfirmedStakeTokensTx),
    [wrapper],
  );

  // If this is the home planet, show "Place ERC20 Planet" button
  if (isCurrentHomePlanet) {
    const getButtonContent = () => {
      if (staking) {
        return <LoadingSpinner initialText="Placing ERC20 Planet..." />;
      }
      if (hasStakedPlanet) {
        return "ERC20 Planet Already Placed";
      }
      return "Place ERC20 Planet";
    };

    return (
      <ButtonContainer>
        <MaybeShortcutButton
          size="stretch"
          onClick={() => {
            // Open the staking pane (similar to starbase crafting)
            if (planet && isLocatable(planet)) {
              uiManager.setChoosingPlanetTokenLocation(
                planet as LocatablePlanet,
              );
            }
          }}
          disabled={staking || hasStakedPlanet}
        >
          <TextWrapper>{getButtonContent()}</TextWrapper>
        </MaybeShortcutButton>
      </ButtonContainer>
    );
  }

  // Only show "Set Home Planet" if no home planet exists (hide "Change Home Planet")
  if (hasHomePlanet) {
    return null; // Hide "Change Home Planet" button
  }

  return (
    <ButtonContainer>
      <MaybeShortcutButton
        size="stretch"
        onClick={handleAction}
        disabled={changing || setting}
      >
        <TextWrapper>
          {setting ? (
            <LoadingSpinner initialText="Setting Home Planet..." />
          ) : (
            "Set Home Planet"
          )}
        </TextWrapper>
      </MaybeShortcutButton>
    </ButtonContainer>
  );
}
