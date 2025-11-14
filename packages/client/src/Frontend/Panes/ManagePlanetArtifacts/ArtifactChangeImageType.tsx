import {
  MAX_AVATAR_TYPE,
  MAX_LOGO_TYPE,
  MAX_MEME_TYPE,
  MIN_AVATAR_TYPE,
  MIN_LOGO_TYPE,
  MIN_MEME_TYPE,
} from "@df/constants";
import { avatarTypeToNum, logoTypeToNum, memeTypeToNum } from "@df/procedural";
import { isUnconfirmedChangeArtifactImageTypeTx } from "@df/serde";
import type {
  Artifact,
  ArtifactId,
  AvatarType,
  LocationId,
  MemeType,
  Planet,
} from "@df/types";
import {
  ArtifactType,
  AvatarTypeNames,
  LogoType,
  LogoTypeNames,
  MemeTypeNames,
} from "@df/types";
import React, { useEffect, useRef, useState } from "react";
import styled from "styled-components";

import { Btn } from "../../Components/Btn";
import { SelectFrom } from "../../Components/CoreUI";
import {
  useAccount,
  useArtifact,
  usePlanet,
  useUIManager,
} from "../../Utils/AppHooks";

const StyledBuyArtifactPane = styled.div`
  & > div {
    display: flex;
    flex-direction: row;
    justify-content: space-between;

    &:last-child > span {
      margin-top: 1em;
      text-align: center;
      flex-grow: 1;
    }

    &.margin-top {
      margin-top: 0.5em;
    }
  }
`;

export function ArtifactChangeImageType({
  artifactId,
  depositOn,
}: {
  artifactId: ArtifactId;
  depositOn?: LocationId;
}) {
  const uiManager = useUIManager();
  const account = useAccount(uiManager);
  const artifactWrapper = useArtifact(uiManager, artifactId);
  const artifact = artifactWrapper.value;

  const depositPlanetWrapper = usePlanet(uiManager, depositOn);
  const onPlanetWrapper = usePlanet(uiManager, artifact?.onPlanetId);
  const depositPlanet = depositPlanetWrapper.value;
  const onPlanet = onPlanetWrapper.value;

  // Initialize state with a constant default value
  // We'll update it in useEffect after mount to avoid reading hook values during render
  const [imageType, setImageType] = useState(() => {
    return logoTypeToNum(LogoType.DFARES).toString();
  });

  // Use a ref to track if we've initialized and the previous artifactId
  const initializedRef = useRef(false);
  const prevArtifactIdRef = useRef<ArtifactId | undefined>(artifactId);

  // Update state after render using useEffect (runs asynchronously after render completes)
  // Only run once on mount or when artifactId changes (component remounted via key prop)
  useEffect(() => {
    // Check if this is a new mount or artifactId changed
    const isNewMount = !initializedRef.current;
    const artifactIdChanged = prevArtifactIdRef.current !== artifactId;

    if (isNewMount || artifactIdChanged) {
      initializedRef.current = true;
      prevArtifactIdRef.current = artifactId;

      // Read hook values inside effect, not in dependencies
      // This ensures we're reading stable values after render completes
      const currentOnPlanet = onPlanetWrapper.value;
      const currentArtifactValue = artifactWrapper.value;

      // Calculate defaultImageType after render, not during
      const defaultImageType =
        currentOnPlanet &&
        currentArtifactValue &&
        currentArtifactValue.artifactType === ArtifactType.Avatar &&
        currentArtifactValue.imageType > 0
          ? currentArtifactValue.imageType
          : logoTypeToNum(LogoType.DFARES);

      // Use functional update to ensure we're not causing issues
      setImageType((prev) => {
        const newValue = defaultImageType.toString();
        return prev !== newValue ? newValue : prev;
      });
    }
  }, [artifactId, onPlanetWrapper, artifactWrapper]); // Depend on wrappers, not their values

  // const otherArtifactsOnPlanet = usePlanetArtifacts(onPlanetWrapper, uiManager);

  if (!artifact || (!onPlanet && !depositPlanet) || !account) {
    return null;
  }

  if (!onPlanet) {
    return null;
  }

  const canArtifactChangeImageType = (artifact: Artifact) =>
    artifact.artifactType === ArtifactType.Avatar;

  const imageTypeChangeing = artifact.transactions?.hasTransaction(
    isUnconfirmedChangeArtifactImageTypeTx,
  );

  const enabled = (planet: Planet): boolean =>
    !imageTypeChangeing && planet?.owner === account;

  const values = [];
  const labels = [];

  for (let i = MIN_MEME_TYPE; i <= MAX_MEME_TYPE; i++) {
    values.push(memeTypeToNum(Number(i) as MemeType).toString());
    labels.push(MemeTypeNames[i]);
  }

  for (let i = MIN_LOGO_TYPE; i <= MAX_LOGO_TYPE; i++) {
    values.push(logoTypeToNum(Number(i) as LogoType).toString());
    labels.push(LogoTypeNames[i]);
  }

  for (let i = MIN_AVATAR_TYPE; i <= MAX_AVATAR_TYPE; i++) {
    values.push(avatarTypeToNum(Number(i) as AvatarType).toString());
    labels.push(AvatarTypeNames[i]);
  }

  // MyTodo: make more show state
  // const canHandleImageTypeChange = depositPlanetWrapper.value && ;

  return (
    <div>
      {canArtifactChangeImageType(artifact) && (
        <StyledBuyArtifactPane>
          <div>
            <div> Image Type </div>
            {/* MyTodo: change to like buySkinPane */}
            <SelectFrom
              values={values}
              labels={labels}
              value={imageType.toString()}
              setValue={setImageType}
            />
          </div>
          <div>
            <Btn
              onClick={() => {
                if (!enabled(onPlanet) || !uiManager || !onPlanet) {
                  return;
                }

                uiManager.changeArtifactImageType(
                  onPlanet.locationId,
                  artifact.id,
                  Number(imageType),
                );
              }}
              disabled={!enabled(onPlanet)}
            >
              Set Image Type
            </Btn>
          </div>
        </StyledBuyArtifactPane>
      )}
    </div>
  );
}
