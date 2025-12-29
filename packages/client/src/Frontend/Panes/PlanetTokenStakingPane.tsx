import { formatNumber, isLocatable } from "@df/gamelogic";
import { locationIdToHexStr } from "@df/serde";
import type { Planet, WorldCoords } from "@df/types";
import { Biome, PlanetType, SpaceType } from "@df/types";
import { getComponentValue } from "@latticexyz/recs";
import { encodeEntity } from "@latticexyz/store-sync/recs";
import { useMUD } from "@mud/MUDContext";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import styled from "styled-components";
import { formatEther, parseEther } from "viem";
import { readContract } from "viem";

import { Btn } from "../Components/Btn";
import { Red, Sub } from "../Components/Text";
import dfstyles from "../Styles/dfstyles";
import { useUIManager } from "../Utils/AppHooks";
import UIEmitter, { UIEmitterEvent } from "../Utils/UIEmitter";

const StakingContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: 1em;
  padding: 1em;
  max-height: 500px;
  overflow-y: auto;
`;

const StakingInfo = styled.div`
  background: ${dfstyles.colors.background};
  border: 1px solid ${dfstyles.colors.border};
  border-radius: 4px;
  padding: 1em;
  margin-bottom: 1em;
`;

const ErrorMessage = styled.div`
  color: ${dfstyles.colors.dfred};
  margin-top: 0.5em;
  font-size: 0.9em;
`;

const SuccessMessage = styled.div`
  color: ${dfstyles.colors.dfgreen};
  margin-top: 0.5em;
  font-size: 0.9em;
`;

const TokenBalanceInfo = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.5em;
  margin: 0.25em 0;
  background: ${dfstyles.colors.backgroundlight};
  border-radius: 2px;
`;

interface PlanetTokenStakingPaneProps {
  planet: Planet;
  onClose: () => void;
  onStakeComplete?: () => void;
}

// ERC20 ABI for balanceOf
const ERC20_ABI = [
  {
    inputs: [{ name: "account", type: "address" }],
    name: "balanceOf",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ name: "tokenId", type: "uint256" }],
    name: "getTokenLevel",
    outputs: [{ name: "", type: "uint8" }],
    stateMutability: "view",
    type: "function",
  },
] as const;

const PlanetTokenStakingPane: React.FC<PlanetTokenStakingPaneProps> = ({
  planet,
  onClose: _onClose,
  onStakeComplete,
}) => {
  const uiManager = useUIManager();
  const {
    components: { HomePlanet, PlanetToken: PlanetTokenTable },
    network: { publicClient },
  } = useMUD();
  const [x, setX] = useState<number>(0);
  const [y, setY] = useState<number>(0);
  const [level, setLevel] = useState<number>(4);
  const [tokenId, setTokenId] = useState<number>(0);
  const [isStaking, setIsStaking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [choosingLocation, setChoosingLocation] = useState(false);
  const [previewCoords, setPreviewCoords] = useState<WorldCoords | null>(null);
  const [tokenBalance, setTokenBalance] = useState<bigint>(0n);
  const [planetTokenAddress, setPlanetTokenAddress] = useState<string | null>(
    null,
  );
  const [hasHomePlanet, setHasHomePlanet] = useState(false);

  // Get planet token address from MUD table
  useEffect(() => {
    if (PlanetTokenTable) {
      try {
        const planetTokenData = getComponentValue(
          PlanetTokenTable,
          encodeEntity(PlanetTokenTable.metadata.keySchema, {}),
        );
        if (planetTokenData?.tokenAddress) {
          setPlanetTokenAddress(planetTokenData.tokenAddress);
        }
      } catch (e) {
        console.warn("Failed to get planet token address:", e);
      }
    }
  }, [PlanetTokenTable]);

  // Check if player has a home planet
  useEffect(() => {
    if (HomePlanet && uiManager.getAccount()) {
      try {
        const playerEntityKey = encodeEntity(HomePlanet.metadata.keySchema, {
          player: uiManager.getAccount() as `0x${string}`,
        });
        const homePlanetData = getComponentValue(HomePlanet, playerEntityKey);
        setHasHomePlanet(
          homePlanetData?.planetHash !== undefined &&
            homePlanetData.planetHash !==
              "0x0000000000000000000000000000000000000000000000000000000000000000",
        );
      } catch (e) {
        console.warn("Failed to check home planet:", e);
        setHasHomePlanet(false);
      }
    }
  }, [HomePlanet, uiManager]);

  // Fetch token balance
  useEffect(() => {
    const fetchTokenBalance = async () => {
      if (!planetTokenAddress || !publicClient || !uiManager.getAccount()) {
        return;
      }

      try {
        const balance = await readContract(publicClient, {
          address: planetTokenAddress as `0x${string}`,
          abi: ERC20_ABI,
          functionName: "balanceOf",
          args: [uiManager.getAccount() as `0x${string}`],
        });
        setTokenBalance(balance as bigint);
      } catch (e) {
        console.error("Failed to fetch token balance:", e);
        setTokenBalance(0n);
      }
    };

    fetchTokenBalance();
    // Refresh balance every 5 seconds
    const interval = setInterval(fetchTokenBalance, 5000);
    return () => clearInterval(interval);
  }, [planetTokenAddress, publicClient, uiManager]);

  // Check if user has enough tokens (1 token = 1 planet)
  const hasEnoughTokens = useMemo(() => {
    return tokenBalance >= parseEther("1");
  }, [tokenBalance]);

  // Calculate space type from coordinates
  const getSpaceType = useCallback(
    (coordX: number, coordY: number): SpaceType => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if (typeof window !== "undefined" && (window as any).df) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const df = (window as any).df;
        if (df.spaceTypeFromPerlin && df.biomebasePerlin) {
          try {
            const coords = { x: coordX, y: coordY };
            const perlin = df.biomebasePerlin(coords, true);
            const distFromOrigin = Math.sqrt(coordX ** 2 + coordY ** 2);
            return df.spaceTypeFromPerlin(perlin, distFromOrigin);
          } catch (e) {
            console.warn("Failed to calculate space type:", e);
          }
        }
      }
      return SpaceType.SPACE;
    },
    [],
  );

  // Calculate biome from coordinates (simplified - will be calculated on-chain)
  const getBiome = useCallback(
    (coordX: number, coordY: number, spaceType: SpaceType): Biome => {
      // Biome will be calculated on-chain from planetHash and perlin
      // For now, return a default based on spaceType
      if (spaceType === SpaceType.DEAD_SPACE) {
        return Biome.CORRUPTED;
      }
      // Default to OCEAN - actual biome will be calculated in contract
      return Biome.OCEAN;
    },
    [],
  );

  // Handle location selection from map click
  const handleLocationClick = useCallback(
    async (coords: WorldCoords) => {
      if (choosingLocation) {
        const newX = Math.round(coords.x);
        const newY = Math.round(coords.y);
        setX(newX);
        setY(newY);
        setChoosingLocation(false);
        setPreviewCoords(null);

        // Validate before staking
        if (!hasHomePlanet) {
          setError("You must set a home planet first");
          return;
        }

        if (!hasEnoughTokens) {
          setError("Insufficient tokens. You need at least 1 token to stake.");
          return;
        }

        if (!planetTokenAddress) {
          setError("Planet token contract not configured");
          return;
        }

        setError(null);
        setSuccess(null);
        setIsStaking(true);

        try {
          const spaceType = getSpaceType(newX, newY);
          const biome = getBiome(newX, newY, spaceType);

          // Call the contract through UIManager
          await uiManager.stakePlanetToken(
            newX,
            newY,
            level,
            spaceType,
            biome,
            tokenId,
          );

          setSuccess("Planet created from staked token successfully!");
          if (onStakeComplete) {
            onStakeComplete();
          }
        } catch (err: unknown) {
          console.error("Failed to stake planet token:", err);
          const errorMessage =
            err instanceof Error ? err.message : "Failed to stake planet token";
          setError(errorMessage);
        } finally {
          setIsStaking(false);
        }
      }
    },
    [
      choosingLocation,
      hasHomePlanet,
      hasEnoughTokens,
      planetTokenAddress,
      level,
      tokenId,
      uiManager,
      onStakeComplete,
      getSpaceType,
      getBiome,
    ],
  );

  const handleLocationPreview = useCallback(
    (coords: WorldCoords) => {
      if (choosingLocation) {
        setPreviewCoords(coords);
      }
    },
    [choosingLocation],
  );

  // Set up event listeners for location selection
  useEffect(() => {
    if (choosingLocation && hasHomePlanet && hasEnoughTokens) {
      // Notify renderer to show preview (similar to starbase)
      uiManager.setChoosingPlanetTokenLocation(true);
      const uiEmitter = UIEmitter.getInstance();
      uiEmitter.on(UIEmitterEvent.WorldMouseClick, handleLocationClick);
      uiEmitter.on(UIEmitterEvent.WorldMouseMove, handleLocationPreview);

      return () => {
        uiManager.setChoosingPlanetTokenLocation(false);
        uiEmitter.off(UIEmitterEvent.WorldMouseClick, handleLocationClick);
        uiEmitter.off(UIEmitterEvent.WorldMouseMove, handleLocationPreview);
      };
    } else {
      uiManager.setChoosingPlanetTokenLocation(false);
    }
    return () => {};
  }, [
    choosingLocation,
    handleLocationClick,
    handleLocationPreview,
    hasHomePlanet,
    hasEnoughTokens,
    uiManager,
  ]);

  return (
    <StakingContainer>
      <StakingInfo>
        <Sub>
          Stake ERC20 planet tokens to create new planets on the map. Requires a
          home planet and at least 1 token.
        </Sub>
      </StakingInfo>

      {!hasHomePlanet && (
        <Red style={{ marginTop: "0.5em" }}>
          You must set a home planet before staking tokens. Use the home planet
          system to set your home planet.
        </Red>
      )}

      {planetTokenAddress && (
        <TokenBalanceInfo>
          <span>Planet Token Balance:</span>
          <span
            style={{
              color: hasEnoughTokens
                ? dfstyles.colors.dfgreen
                : dfstyles.colors.dfred,
            }}
          >
            {formatEther(tokenBalance)} tokens
          </span>
        </TokenBalanceInfo>
      )}

      {!planetTokenAddress && (
        <Red style={{ marginTop: "0.5em" }}>
          Planet token contract not configured
        </Red>
      )}

      <div>
        {(() => {
          if (!hasHomePlanet) {
            return (
              <Sub style={{ marginTop: "0.5em", color: dfstyles.colors.dfred }}>
                Set a home planet first to enable staking
              </Sub>
            );
          }

          if (!hasEnoughTokens) {
            return (
              <Sub style={{ marginTop: "0.5em", color: dfstyles.colors.dfred }}>
                You need at least 1 token to stake. Get tokens from external
                minting.
              </Sub>
            );
          }

          return (
            <>
              {!choosingLocation ? (
                <>
                  <div style={{ marginTop: "0.5em" }}>
                    <label>
                      Token ID:
                      <input
                        type="number"
                        value={tokenId}
                        onChange={(e) =>
                          setTokenId(parseInt(e.target.value) || 0)
                        }
                        style={{ marginLeft: "0.5em", width: "100px" }}
                      />
                    </label>
                  </div>
                  <div style={{ marginTop: "0.5em" }}>
                    <label>
                      Planet Level:
                      <input
                        type="number"
                        value={level}
                        onChange={(e) =>
                          setLevel(parseInt(e.target.value) || 4)
                        }
                        min={1}
                        max={9}
                        style={{ marginLeft: "0.5em", width: "100px" }}
                      />
                    </label>
                  </div>
                  <div style={{ marginTop: "0.5em" }}>
                    <Btn onClick={() => setChoosingLocation(true)}>
                      Choose Location on Map
                    </Btn>
                  </div>
                </>
              ) : (
                <div>
                  <Sub
                    style={{
                      marginTop: "0.5em",
                      color: dfstyles.colors.dfgreen,
                    }}
                  >
                    {previewCoords
                      ? `Click on map to place planet at (${Math.round(previewCoords.x)}, ${Math.round(previewCoords.y)})`
                      : "Move mouse over map to preview location, then click to select"}
                  </Sub>
                  <div style={{ marginTop: "0.5em" }}>
                    <Btn
                      onClick={() => {
                        setChoosingLocation(false);
                        setPreviewCoords(null);
                      }}
                    >
                      Cancel Selection
                    </Btn>
                  </div>
                </div>
              )}
              <Sub style={{ marginTop: "0.5em" }}>
                Coordinates must be empty (no existing planet)
              </Sub>
            </>
          );
        })()}
      </div>

      {error && <ErrorMessage>{error}</ErrorMessage>}
      {success && <SuccessMessage>{success}</SuccessMessage>}
    </StakingContainer>
  );
};

export default PlanetTokenStakingPane;
