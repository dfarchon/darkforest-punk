import React, { useImperativeHandle, useState } from "react";
import styled from "styled-components";

import dfstyles from "../Styles/dfstyles";
import { Sub } from "./Text";

export interface LoadingBarHandle {
  setFractionCompleted: (fractionCompleted: number) => void;
}

interface LoadingBarProps {
  prettyEntityName: string;
}

export const TextLoadingBar = React.forwardRef<
  LoadingBarHandle,
  LoadingBarProps
>(TextLoadingBarImpl);

export function TextLoadingBarImpl(
  { prettyEntityName }: LoadingBarProps,
  ref: React.Ref<LoadingBarHandle>,
) {
  const clampFractionCompleted = (nextFractionCompleted: number) =>
    Number.isFinite(nextFractionCompleted)
      ? Math.max(0, Math.min(1, nextFractionCompleted))
      : 0;

  // value between 0 and 1
  const [fractionCompleted, setFractionCompleted] = useState(0);

  useImperativeHandle(ref, () => ({
    setFractionCompleted: (nextFractionCompleted: number) => {
      setFractionCompleted(clampFractionCompleted(nextFractionCompleted));
    },
  }));

  const progressWidth = 20;
  const normalizedFractionCompleted = clampFractionCompleted(fractionCompleted);
  const displayFractionCompleted =
    normalizedFractionCompleted >= 1 - Number.EPSILON
      ? 1
      : normalizedFractionCompleted;
  const filledWidth =
    displayFractionCompleted === 1
      ? progressWidth
      : Math.floor(progressWidth * displayFractionCompleted);

  let progressText = "";

  for (let i = 0; i < progressWidth; i++) {
    if (i < filledWidth) {
      progressText += "=";
    } else {
      progressText += "\u00a0"; // &nbsp;
    }
  }

  const percentText = Math.floor(displayFractionCompleted * 100)
    .toString()
    .padStart(3, " ");

  return (
    <span>
      [<Sub>{progressText}</Sub>]{" "}
      <span style={{ fontWeight: percentText === "100" ? "bold" : undefined }}>
        {percentText}%{" "}
      </span>
      <LoadingTitle>{prettyEntityName}</LoadingTitle>
    </span>
  );
}

const LoadingTitle = styled.div`
  display: inline-block;
  color: ${dfstyles.colors.text};
`;
