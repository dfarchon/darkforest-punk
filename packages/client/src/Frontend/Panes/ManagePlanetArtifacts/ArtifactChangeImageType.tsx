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
import React, { useState } from "react";
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

  // Calculate defaultImageType during render
  // Since we use key={artifactId} in parent, React will remount this component
  // when artifactId changes, so state will be initialized correctly
  const defaultImageType =
    onPlanet &&
    artifact &&
    artifact.artifactType === ArtifactType.Avatar &&
    artifact.imageType > 0
      ? artifact.imageType
      : logoTypeToNum(LogoType.DFARES);

  // Initialize state with defaultImageType
  // The useState initializer function only runs once per mount,
  // so it will capture the defaultImageType value at mount time
  const [imageType, setImageType] = useState(() => {
    // Calculate defaultImageType inside the initializer to ensure
    // we're using the values available at mount time
    const mountDefaultImageType =
      onPlanet &&
      artifact &&
      artifact.artifactType === ArtifactType.Avatar &&
      artifact.imageType > 0
        ? artifact.imageType
        : logoTypeToNum(LogoType.DFARES);
    return mountDefaultImageType.toString();
  });

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
