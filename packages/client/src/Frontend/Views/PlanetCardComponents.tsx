import type { Artifact, Planet, TooltipName } from "@df/types";
import React, { useState, useEffect } from "react";
import styled from "styled-components";

import { ArtifactImage } from "../Components/ArtifactImage";
import {
  ArtifactRarityLabelAnim,
  ArtifactTypeText,
} from "../Components/Labels/ArtifactLabels";
import { Sub, White } from "../Components/Text";
import { TooltipTrigger } from "../Panes/Tooltip";
import dfstyles from "../Styles/dfstyles";
import { ArtifactDetailsBody } from "../Panes/ArtifactDetailsPane";
import { useUIManager } from "../Utils/AppHooks";

const BonusStyle = styled.span`
  color: ${dfstyles.colors.dfgreen};
  font-size: 0.8em;
  vertical-align: center;
  line-height: 1.5em;
  margin-left: 8px;
`;

export const TimesTwo = () => <BonusStyle>x2</BonusStyle>;
export const Halved = () => <BonusStyle>%2</BonusStyle>;

export const RowTip = ({
  name,
  children,
}: {
  name: TooltipName;
  children: React.ReactNode;
}) => (
  <TooltipTrigger
    name={name}
    style={{
      lineHeight: "100%",
      position: "relative",
      top: "0.2em",
      cursor: "help",
    }}
  >
    {children}
  </TooltipTrigger>
);

export const TitleBar = styled.div`
  height: 2em;
  padding: 0.25em 0.5em;
  display: flex;
  flex-direction: row;
  justify-content: space-between;
  color: ${dfstyles.colors.subtext};
  border-bottom: 1px solid ${dfstyles.colors.border};
`;

const StyledPlanetActiveArtifact = styled.div<{ planet: Planet | undefined }>`
  display: flex;
  flex-direction: row;
  justify-content: flex-start;
  align-items: center;
  gap: 0.5em;
  color: ${dfstyles.colors.text};
`;

const ArtifactHoverContainer = styled.div`
  position: relative;
  display: inline-block;
  cursor: help;
`;

const ArtifactHoverPopup = styled.div<{
  top: number;
  left: number;
  visible: boolean;
}>`
  position: fixed;
  top: ${(props) => props.top}px;
  left: ${(props) => props.left}px;
  background: ${dfstyles.colors.background};
  border: 1px solid ${dfstyles.colors.border};
  border-radius: 4px;
  padding: 1em;
  min-width: 300px;
  max-width: 400px;
  max-height: 600px;
  overflow-y: auto;
  z-index: 10000;
  opacity: ${(props) => (props.visible ? 1 : 0)};
  visibility: ${(props) => (props.visible ? "visible" : "hidden")};
  transition:
    opacity 0.2s ease,
    visibility 0.2s ease;
  pointer-events: ${(props) => (props.visible ? "auto" : "none")};
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5);
`;

export function PlanetActiveArtifact({
  artifact,
  planet,
}: {
  artifact: Artifact;
  planet: Planet | undefined;
}) {
  const uiManager = useUIManager();
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const [isHovered, setIsHovered] = useState(false);
  const [shouldRenderDetails, setShouldRenderDetails] = useState(false);

  // Delay rendering ArtifactDetailsBody to avoid setState during render
  useEffect(() => {
    if (isHovered) {
      // Small delay to ensure hover state is committed before rendering
      const timer = setTimeout(() => {
        setShouldRenderDetails(true);
      }, 0);
      return () => clearTimeout(timer);
    } else {
      setShouldRenderDetails(false);
    }
  }, [isHovered]);

  const handleMouseMove = (event: React.MouseEvent) => {
    setMousePosition({ x: event.clientX, y: event.clientY });
  };

  const handleMouseEnter = () => {
    setIsHovered(true);
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
  };

  // Calculate popup position with edge detection
  const popupWidth = 400;
  const popupHeight = 600;
  const offset = 15;
  let popupLeft = mousePosition.x + offset;
  let popupTop = mousePosition.y + offset;

  // Adjust if popup would go off right edge
  if (popupLeft + popupWidth > window.innerWidth) {
    popupLeft = mousePosition.x - popupWidth - offset;
  }

  // Adjust if popup would go off bottom edge
  if (popupTop + popupHeight > window.innerHeight) {
    popupTop = mousePosition.y - popupHeight - offset;
  }

  // Ensure popup doesn't go off left edge
  if (popupLeft < 0) {
    popupLeft = offset;
  }

  // Ensure popup doesn't go off top edge
  if (popupTop < 0) {
    popupTop = offset;
  }

  return (
    <StyledPlanetActiveArtifact planet={planet}>
      <ArtifactHoverContainer
        onMouseMove={handleMouseMove}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        <ArtifactImage artifact={artifact} size={24} />
        <ArtifactHoverPopup
          top={popupTop}
          left={popupLeft}
          visible={isHovered}
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
        >
          {shouldRenderDetails && uiManager && (
            <ArtifactDetailsBody
              artifactId={artifact.id}
              contractConstants={uiManager.contractConstants}
              noActions={true}
            />
          )}
        </ArtifactHoverPopup>
      </ArtifactHoverContainer>
      <Sub>
        Active Artifact:{" "}
        <White>
          {" "}
          <ArtifactRarityLabelAnim rarity={artifact.rarity} />{" "}
          {/* <ArtifactBiomeText artifact={artifact} />{" "} */}
          <ArtifactTypeText artifact={artifact} />
        </White>
      </Sub>
    </StyledPlanetActiveArtifact>
  );
}
