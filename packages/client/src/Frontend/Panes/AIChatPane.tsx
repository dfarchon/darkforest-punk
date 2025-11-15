import type { GameManager } from "@backend/GameLogic/GameManager";
import { getPlanetName } from "@df/procedural";
import {
  type ArtifactId,
  type LocationId,
  ModalName,
  type Planet,
  type WorldCoords,
} from "@df/types";
import { Setting } from "@df/types";
import { Btn } from "@frontend/Components/Btn";
import { predictTokenCost } from "@frontend/Utils/AI-Chat-PredictCost";
import { useEffect, useRef, useState } from "react";
import styled from "styled-components";

import { Spacer } from "../Components/CoreUI";
import { useAccount, usePlayer, useUIManager } from "../Utils/AppHooks";
import {
  clearChatHistoryFromIndexedDB,
  loadConversationFromIndexedDB,
  saveMessageToIndexedDB,
} from "../Utils/IndexedDB-ChatMemory";
import { useBooleanSetting } from "../Utils/SettingsHooks";
import { ModalPane } from "../Views/ModalPane";
import { CurrencyView } from "./AIChatTokensBar";
import { LevelFilter } from "./LevelFilter";
const API_URL = import.meta.env.VITE_AI_API_URL;
const PLANET_LEVELS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];

const AIChatWrapper = styled.div`
  position: relative;
  width: 550px;
  height: 450px;
`;

const AIChatContent = styled.div`
  width: 100%;
  height: 72%;
  overflow-y: scroll;
  padding-bottom: 80px; // to make room for input
  display: flex;
  flex-direction: column;
  border-radius: 5px;
`;
//w-full resize-none rounded-md border border-gray-700 p-2
const AIChatInputRows = styled.textarea.attrs(() => ({
  onKeyDown: (e: React.KeyboardEvent) => e.stopPropagation(),
  onKeyUp: (e: React.KeyboardEvent) => e.stopPropagation(),
}))`
  width: 100%;
  resize: none;
  border: 1px solid rgba(59, 63, 70, 0.95); // Tailwind's gray-700
  border-radius: 0.375rem; // Tailwind's rounded-md
  padding: 0.5rem; // Tailwind's p-2
  font-size: 1rem;
  font-family: inherit;
  color: rgba(255, 255, 255, 0.6);

  &:focus {
    outline: none;
    border-color: rgba(255, 255, 255, 0.6);
    box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.6);
  }
`;

const AIChatInput = styled.div`
  position: absolute;
  bottom: 0;
  left: 50%;
  transform: translateX(-50%);
  width: 100%;
  box-shadow: 0 -2px 10px rgba(0, 0, 0, 0.05);
  padding: 8px;
  display: flex;
  flex-direction: column;
  gap: 8px;
`;

const AITextOutput = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;

  .label {
    font-size: 0.875rem; /* Tailwind's text-sm */
    color: #6b7280; /* Tailwind's gray-500 */
  }

  .value {
    align-items: center;
    font-weight: 700; /* Tailwind's font-bold */
    font-size: 1.125rem; /* Tailwind's text-lg */
  }
`;

const ChatMessage = styled.div<{ isUser: boolean }>`
  margin-bottom: 10px;
  padding: 10px;
  border-radius: 5px;
  background-color: ${(props) => (props.isUser ? "#ffffff" : "#2c2f33")};
  color: ${(props) => (props.isUser ? "#000000" : "#f5f5f5")};
  align-self: ${(props) => (props.isUser ? "flex-end" : "flex-start")};
  border: 1px solid ${(props) => (props.isUser ? "#e0e0e0" : "#4a4a4d")};
  box-shadow: ${(props) =>
    props.isUser
      ? "0px 4px 8px rgba(255, 255, 255, 0.2)"
      : "0px 4px 8px rgba(0, 0, 0, 0.2)"};
`;

const AIAgentContent = styled.div`
  width: 550px;
  height: 450px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
`;

const AgentResponseContainer = styled.div`
  flex: 0 0 30%; /* Flex shorthand to enforce fixed height of 30% */
  max-height: 30%; /* Ensure it doesn't exceed 30% */
  background-color: #2c2f33;
  color: rgba(
    255,
    255,
    255,
    0.8
  ); /* Slightly brighter text for better readability */
  padding: 10px;
  border: 1px solid #4a4a4d;
  border-radius: 5px;
  margin-bottom: 16px;
  overflow-y: auto;
  box-sizing: border-box; /* Ensures padding doesn't add to height */
`;

function HelpContent() {
  return (
    <div>
      <p>
        {" "}
        Chat with AI Sophon, your intelligent assistant and agent in the Dark
        Forest universe.{" "}
      </p>{" "}
      <Spacer height={8} />{" "}
      <p>
        {" "}
        Ask questions, plan strategies, or dive into the game's lore and
        mechanics with ease.{" "}
      </p>{" "}
      <Spacer height={12} />{" "}
      <p>
        {" "}
        To use the AI Sophon Agent, start by selecting the top-left corner of
        your desired range using "Start Range Selection." Then, select the
        bottom-right corner on the map. Planets within this range will be
        automatically filtered and included in the input prompt.{" "}
      </p>{" "}
      <Spacer height={8} />{" "}
      <p>
        {" "}
        Additionally, you can use the planet level filter bar to pre-select your
        desired planet levels for more precise results.{" "}
      </p>
    </div>
  );
}

//speak("hello, how are you today?");
export function AIChatPane({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  // PUNK! for fun - could be setup in option
  const speak = (text: string) => {
    if (settingValue && mute) {
      if ("speechSynthesis" in window) {
        speechSynthesis.cancel(); // Optional: interrupt anything queued
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = "en-US"; // Set language (change as needed)
        utterance.pitch = 0; // Range: 0 to 2 - 1.5 / 0 / 1
        utterance.rate = 0.6; // Range: 0.1 to 10 - 0.7 / 0 / 0.75
        utterance.voice = speechSynthesis.getVoices()[0]; // Choose a specific voice 1 / 0 / 2

        speechSynthesis.speak(utterance);
      }
    } else {
      console.error("Speech synthesis not supported in this browser.");
    }
  };
  const uiManager = useUIManager();
  const gameManager = uiManager.getGameManager();
  const account = useAccount(uiManager);
  const player = usePlayer(uiManager).value;
  const [mute, setMute] = useState<boolean>(true);
  const [settingValue, setSettingValue] = useBooleanSetting(
    uiManager,
    Setting.ActiveAISpeak,
  );
  const [activeTab, setActiveTab] = useState<"chat" | "agent">("chat");
  const [selectedRange, setSelectedRange] = useState<{
    begin: WorldCoords | null;
    end: WorldCoords | null;
  }>({ begin: null, end: null });

  const [planetsCount, setPlanetsCount] = useState<number>(0);
  const [planetsFilteredCount, setPlanetsFilteredCount] = useState<number>(0);
  const [selectedPlanets, setSelectedPlanets] = useState<Planet[]>([]);
  const [selectedLevels, setSelectedLevels] = useState<number[]>([
    3, 4, 5, 6, 7, 8, 9,
  ]); // Default to 3-9 (all levels)
  const [predictedCost, setPredictedCost] = useState<{
    aItokens: number;
    cost: number;
    credits: number;
  }>({
    aItokens: 0,
    cost: 0,
    credits: 0,
  });
  const [agentPreResponse, setAgentPreResponse] = useState<{
    df_fcName: string;
    args: never[];
  } | null>(null); // For AIAgent DF function , args
  const [agentResponse, setAgentResponse] = useState<string>(""); // For AIAgentContent
  const [isSelectionActive, setIsSelectionActive] = useState<boolean>(false);
  const [inputChat, setInputChat] = useState<string>("");
  const [inputAgent, setInputAgent] = useState<string>("");
  const [chatHistory, setChatHistory] = useState<
    { message: string; isUser: boolean }[]
  >([]);

  const [temp, setTemp] = useState(true);

  // Initilized if visible
  useEffect(() => {
    if (visible && temp) {
      const initializeChat = async () => {
        const history = await loadConversationFromIndexedDB();

        if (history && history.length === 0) {
          try {
            const response = await fetch(`${API_URL}/api/conversation/start`, {
              method: "POST",
              // mode: "no-cors",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                username: player?.name,
                message: "Hello!",
                indexedHistory: history.map((h) => h.message).join("\n"),
              }),
            });

            if (response.ok) {
              const aiResponse = await response.json();

              const aiMessage = { message: aiResponse, isUser: false };
              setChatHistory((prev) => [...prev, aiMessage]);
              saveMessageToIndexedDB(aiMessage);
            }
          } catch (error) {
            console.error("Error starting chat:", error);
          }
        } else if (history && history.length > 0) {
          const loadChatHistory = async () => {
            const historyIndexedDB = await loadConversationFromIndexedDB();
            setChatHistory(historyIndexedDB || []);
          };
          loadChatHistory();
        }
      };

      const intializeSelectedRange = async () => {
        const aiZone = JSON.parse(localStorage.getItem("aiselectedRange"));
        if (!aiZone) {
          return;
        }
        setSelectedRange({ begin: aiZone.begin, end: aiZone.end });
      };
      initializeChat();
      intializeSelectedRange();
      setTemp(false);
    }
    if (visible) {
      localStorage.setItem("iaselectedRangeVissible", "1");
    } else {
      localStorage.setItem("iaselectedRangeVissible", "0");
    }
  }, [visible]);
  // any change for selectedLevels, selectedRange, uiManager, gameManager, input
  // do a refresh of filtered planets per planet level filter bar & range selection
  useEffect(() => {
    if (gameManager) {
      if (selectedRange.begin && selectedRange.end) {
        const chunks = uiManager.getExploredChunks(); // Fetch explored chunks from the UI
        const chunksAsArray = Array.from(chunks);

        // Filter chunks within the selected range all planets in inpacted chunks
        const filteredChunks = chunksAsArray.filter((chunk) => {
          if (!chunk.chunkFootprint || !chunk.chunkFootprint.bottomLeft) {
            console.warn("Invalid chunk structure:", chunk);
            return false;
          }

          const chunkLeft = chunk.chunkFootprint.bottomLeft.x;
          const chunkRight = chunkLeft + chunk.chunkFootprint.sideLength;
          const chunkBottom = chunk.chunkFootprint.bottomLeft.y;
          const chunkTop = chunkBottom + chunk.chunkFootprint.sideLength;
          if (selectedRange.begin && selectedRange.end)
            return (
              chunkRight > selectedRange.begin.x &&
              chunkLeft < selectedRange.end.x &&
              chunkBottom < selectedRange.begin.y &&
              chunkTop > selectedRange.end.y
            );
        });

        // Generate planet hashes for the selected range only planets
        const planetData = filteredChunks.flatMap((chunk) =>
          chunk.planetLocations
            .filter((planet) => {
              if (selectedRange.begin && selectedRange.end) {
                const planetX = planet.coords.x;
                const planetY = planet.coords.y;

                return (
                  planetX >
                    Math.min(selectedRange.begin.x, selectedRange.end.x) &&
                  planetX <
                    Math.max(selectedRange.begin.x, selectedRange.end.x) &&
                  planetY <
                    Math.max(selectedRange.begin.y, selectedRange.end.y) &&
                  planetY > Math.min(selectedRange.begin.y, selectedRange.end.y)
                );
              }
              return false;
            })
            .map((planet) => ({
              hash: planet.hash,
              coords: planet.coords,
            })),
        );
        // Set selected planet count
        setPlanetsCount(planetData.length);

        // Filter planets by selected levels
        const filteredPlanets = gameManager
          .getPlanetsWithIds(planetData.map((planet) => planet.hash))
          .filter(
            (planet) =>
              planet.planetLevel >= Math.min(...selectedLevels) &&
              planet.planetLevel <= Math.max(...selectedLevels),
          );
        // Set filtered planets as selected planets
        setSelectedPlanets(filteredPlanets);
        // Set filtered planet count
        setPlanetsFilteredCount(filteredPlanets.length);
        // Transform planets for cost calculation
        const reducedPlanets = reducePlanets(filteredPlanets);
        const forCost = {
          username: player?.name,
          message: inputAgent,
          selectedPlanets: reducedPlanets,
        };
        // Repair issue with big number for JSON
        const stringForCost = JSON.stringify(forCost, (key, value) =>
          typeof value === "bigint" ? value.toString() : value,
        );

        //console.log("String:", stringForCost);
        // Predict cost for default input + selected filtered planets + msg input
        const predictedCost_ = predictTokenCost(stringForCost, "gpt-3.5-turbo");
        setPredictedCost(predictedCost_);
      }
    }
  }, [selectedLevels, selectedRange, uiManager, gameManager, inputAgent]);

  // Function step by step for Btn Start Range selection and handlers
  const handleStartSelection = () => {
    // Set disable for btn
    setIsSelectionActive(true);
    // Reset the selected range before starting a new selection
    setSelectedRange({ begin: null, end: null });
    localStorage.setItem(
      "aiselectedRange",
      JSON.stringify({ begin: null, end: null }),
    );

    const handleHoverPreview = () => {
      const coords = uiManager.getHoveringOverCoords();
      const storedRange = JSON.parse(
        localStorage.getItem("aiselectedRange") || "{}",
      );

      if (storedRange.begin && coords) {
        const previewRange = { ...storedRange, end: coords };
        localStorage.setItem("aiselectedRange", JSON.stringify(previewRange));

        uiManager.getAIZones();
        const chunks = uiManager.getExploredChunks(); // Fetch explored chunks from the UI
        const chunksAsArray = Array.from(chunks);
        // Filter whole player map chunks
        const filteredChunks = chunksAsArray.filter((chunk) => {
          // Validate chunk structure
          if (!chunk.chunkFootprint || !chunk.chunkFootprint.bottomLeft) {
            console.warn("Invalid chunk structure:", chunk);
            return false;
          }

          const chunkLeft = chunk.chunkFootprint.bottomLeft.x;
          const chunkRight = chunkLeft + chunk.chunkFootprint.sideLength;
          const chunkBottom = chunk.chunkFootprint.bottomLeft.y;
          const chunkTop = chunkBottom + chunk.chunkFootprint.sideLength;
          if (previewRange.begin && previewRange.end)
            return (
              chunkRight > Math.min(previewRange.begin.x, previewRange.end.x) &&
              chunkLeft < Math.max(previewRange.begin.x, previewRange.end.x) &&
              chunkBottom <
                Math.max(previewRange.begin.y, previewRange.end.y) &&
              chunkTop > Math.min(previewRange.begin.y, previewRange.end.y)
            );
        });

        // Generate planet hashes for the selected range
        const planetData = filteredChunks.flatMap((chunk) =>
          chunk.planetLocations
            .filter((planet) => {
              if (previewRange.begin && previewRange.end) {
                const planetX = planet.coords.x;
                const planetY = planet.coords.y;

                return (
                  planetX >
                    Math.min(previewRange.begin.x, previewRange.end.x) &&
                  planetX <
                    Math.max(previewRange.begin.x, previewRange.end.x) &&
                  planetY <
                    Math.max(previewRange.begin.y, previewRange.end.y) &&
                  planetY > Math.min(previewRange.begin.y, previewRange.end.y)
                );
              }
              return false;
            })
            .map((planet) => ({
              hash: planet.hash,
              coords: planet.coords,
            })),
        );

        // console.log("Filtered Planet Hashes:", planetData);

        setPlanetsCount(planetData.length);

        // Fetch full planet data filtered by level filter bar
        const filteredPlanets = gameManager
          .getPlanetsWithIds(planetData.map((planet) => planet.hash))
          .filter(
            (planet) =>
              planet.planetLevel >= Math.min(...selectedLevels) &&
              planet.planetLevel <= Math.max(...selectedLevels),
          );
        //     console.log("NOT-Filtered Planets:", planetsFullData);

        // console.log("Filtered Planets:", filteredPlanets);
        setSelectedPlanets(filteredPlanets);
        setPlanetsFilteredCount(filteredPlanets.length);

        // Transform planets for cost calculation
        const reducedPlanets = reducePlanets(filteredPlanets);
        // Buld forCost constant for prediction function
        const forCost = {
          username: player?.name,
          message: inputAgent,
          selectedPlanets: reducedPlanets,
        };

        const stringForCost = JSON.stringify(forCost, (key, value) =>
          typeof value === "bigint" ? value.toString() : value,
        );
        // console.log("String:", stringForCost);
        // Predict cost for default input + selected filtered planets + msg input
        const predictedCost_ = predictTokenCost(stringForCost, "gpt-3.5-turbo");
        //console.log("Price:", predictedCost_);
        setPredictedCost(predictedCost_);
        // Optional: trigger a render or visual overlay using this preview
        // e.g. update state, draw to canvas, etc.
      }
    };
    let hoverPreviewListenerAttached = false;
    // Define the click handler for Start Range Selection
    const handleClick = (event: MouseEvent) => {
      const coords = uiManager.getHoveringOverCoords();
      if (coords) {
        setSelectedRange((prev) => {
          if (!prev.begin) {
            console.log("Begin coordinates set:", coords);
            const updatedRange = { ...prev, begin: coords };
            localStorage.setItem(
              "aiselectedRange",
              JSON.stringify(updatedRange),
            );
            // After setting begin
            if (!hoverPreviewListenerAttached) {
              window.addEventListener("mousemove", handleHoverPreview);
              hoverPreviewListenerAttached = true;
            }
            return updatedRange;
          } else if (!prev.end) {
            console.log("End coordinates set:", coords);

            localStorage.removeItem("aiselectedPreviewRange");
            const updatedRange = { ...prev, end: coords };
            // Call generatePlanetArray with the selected range once both begin and end are set
            if (updatedRange.begin && updatedRange.end) {
              console.log("Both begin and end are filled. Stopping listener.");
              window.removeEventListener("click", handleClick);
              localStorage.setItem(
                "aiselectedRange",
                JSON.stringify(updatedRange),
              );
              uiManager.getAIZones();
              const chunks = uiManager.getExploredChunks(); // Fetch explored chunks from the UI
              const chunksAsArray = Array.from(chunks);
              window.removeEventListener("mousemove", handleHoverPreview);
              hoverPreviewListenerAttached = false;
              // Filter whole player map chunks
              const filteredChunks = chunksAsArray.filter((chunk) => {
                // Validate chunk structure
                if (!chunk.chunkFootprint || !chunk.chunkFootprint.bottomLeft) {
                  console.warn("Invalid chunk structure:", chunk);
                  return false;
                }

                const chunkLeft = chunk.chunkFootprint.bottomLeft.x;
                const chunkRight = chunkLeft + chunk.chunkFootprint.sideLength;
                const chunkBottom = chunk.chunkFootprint.bottomLeft.y;
                const chunkTop = chunkBottom + chunk.chunkFootprint.sideLength;
                if (updatedRange.begin && updatedRange.end)
                  return (
                    chunkRight >
                      Math.min(updatedRange.begin.x, updatedRange.end.x) &&
                    chunkLeft <
                      Math.max(updatedRange.begin.x, updatedRange.end.x) &&
                    chunkBottom <
                      Math.max(updatedRange.begin.y, updatedRange.end.y) &&
                    chunkTop >
                      Math.min(updatedRange.begin.y, updatedRange.end.y)
                  );
              });

              // Generate planet hashes for the selected range
              const planetData = filteredChunks.flatMap((chunk) =>
                chunk.planetLocations
                  .filter((planet) => {
                    if (updatedRange.begin && updatedRange.end) {
                      const planetX = planet.coords.x;
                      const planetY = planet.coords.y;

                      return (
                        planetX >
                          Math.min(updatedRange.begin.x, updatedRange.end.x) &&
                        planetX <
                          Math.max(updatedRange.begin.x, updatedRange.end.x) &&
                        planetY <
                          Math.max(updatedRange.begin.y, updatedRange.end.y) &&
                        planetY >
                          Math.min(updatedRange.begin.y, updatedRange.end.y)
                      );
                    }
                    return false;
                  })
                  .map((planet) => ({
                    hash: planet.hash,
                    coords: planet.coords,
                  })),
              );

              // console.log("Filtered Planet Hashes:", planetData);

              setPlanetsCount(planetData.length);

              // Fetch full planet data filtered by level filter bar
              const filteredPlanets = gameManager
                .getPlanetsWithIds(planetData.map((planet) => planet.hash))
                .filter(
                  (planet) =>
                    planet.planetLevel >= Math.min(...selectedLevels) &&
                    planet.planetLevel <= Math.max(...selectedLevels),
                );
              //     console.log("NOT-Filtered Planets:", planetsFullData);

              // console.log("Filtered Planets:", filteredPlanets);
              setSelectedPlanets(filteredPlanets);
              setPlanetsFilteredCount(filteredPlanets.length);

              // Transform planets for cost calculation
              const reducedPlanets = reducePlanets(filteredPlanets);
              // Buld forCost constant for prediction function
              const forCost = {
                username: player?.name,
                message: inputAgent,
                selectedPlanets: reducedPlanets,
              };

              const stringForCost = JSON.stringify(forCost, (key, value) =>
                typeof value === "bigint" ? value.toString() : value,
              );
              // console.log("String:", stringForCost);
              // Predict cost for default input + selected filtered planets + msg input
              const predictedCost_ = predictTokenCost(
                stringForCost,
                "gpt-3.5-turbo",
              );
              //console.log("Price:", predictedCost_);
              setPredictedCost(predictedCost_);
            }
            setIsSelectionActive(false);
            return updatedRange;
          }

          return prev;
        });
      }
    };

    console.log("Map selection started.");
    // Clean up any previous event listener before adding a new one
    window.removeEventListener("click", handleClick);
    window.addEventListener("click", handleClick);
  };

  // Btn Send AIchat Assistan Q.
  const handleSendChat = async () => {
    if (inputChat.trim()) {
      const userMessage = { message: inputChat, isUser: true };
      setChatHistory((prev) => [...prev, userMessage]);
      saveMessageToIndexedDB(userMessage);
      const history = await loadConversationFromIndexedDB();

      try {
        // Spend tokens and handle fetch within the same try block
        const responseSpendGPTTokens = await gameManager.spendGPTTokens(1);
        await responseSpendGPTTokens.confirmedPromise;

        const response = await fetch(`${API_URL}/api/conversation/step`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            username: player?.name,
            message: inputChat,
            indexedHistory: history.map((h) => h.message).join("\n"),
          }),
        });

        if (response.ok) {
          const aiResponse = await response.json();
          const aiMessage = { message: aiResponse, isUser: false };
          setChatHistory((prev) => [...prev, aiMessage]);
          saveMessageToIndexedDB(aiMessage);
          if (settingValue) {
            speak(aiResponse);
          }
        } else {
          console.error("Error fetching AI response:", response.statusText);
        }
      } catch (error) {
        console.error("Error in AI chat process:", error);
      } finally {
        setInputChat(""); // Clear input regardless of outcome
      }
    }
  };

  // Btn Clear AIchat history
  const handleClearChat = async () => {
    try {
      await clearChatHistoryFromIndexedDB();
      setChatHistory([]);
    } catch (error) {
      console.error("Error clearing chat history:", error);
    }
  };
  // Btn Mute / Unmute
  const handleMute = () => {
    if (mute) {
      speechSynthesis.cancel(); // Stop any ongoing speech when muting
    }
    setMute((prev) => !prev);
  };

  // Function to reduce the selectedPlanets to minized chat tokens needs
  function reducePlanets(selectedPlanets: Planet[]) {
    return selectedPlanets.map((planet) => [
      planet.locationId,
      getPlanetName(planet), // Extract name using the provided function
      planet.isHomePlanet ? 1 : 0,
      //planet.syncedWithContract ? 1 : 0,
      //planet.perlin,
      planet.owner === "0x0000000000000000000000000000000000000000"
        ? "0x0"
        : planet.owner, // Simplify owner field
      planet.ownerName === "0x0000000000000000000000000000000000000000"
        ? "0x0"
        : gameManager.getPlayer(planet.owner)?.name || "", // Simplify owner field
      planet.spaceType,
      planet.planetType,
      planet.planetLevel,
      planet.universeZone,
      planet.distSquare,
      planet.range,
      planet.speed,
      planet.defense,
      planet.population.toFixed(0),
      planet.populationCap,
      planet.populationGrowth,
      planet.silver.toFixed(0),
      planet.silverCap,
      planet.silverGrowth,
      planet.upgradeState,
      // planet.lastUpdated,
      // planet.isInContract ? 1 : 0,
      planet.coordsRevealed ? 1 : 0,
      //planet.silverSpent,
      planet.bonus.map((b) => (b ? 1 : 0)),
      planet.populationGroDoublers,
      planet.silverGroDoublers,
      planet.hasTriedFindingArtifact ? 1 : 0,
      planet.heldArtifactIds,
      planet.destroyed ? 1 : 0,
      // planet.frozen ? 1 : 0,
      planet.effects,
      planet.flags,
      planet.transactions,
      planet.location.coords.x,
      planet.location.coords.y,
      // planet.location.hash,
      // planet.location.perlin,
      // planet.location.biomebase,
      planet.biome,
      // planet.loadingServerState ? 1 : 0,
      // planet.needsServerRefresh ? 1 : 0,
    ]);
  }

  // Btn Send AIAgent request
  const handleAgentApprove = async () => {
    if (agentPreResponse != null) {
      const reducedPlanets = reducePlanets(selectedPlanets);

      executeClientFunction(agentPreResponse.df_fcName, agentPreResponse.args);
      try {
        const forCost = {
          username: player?.name,
          message: inputAgent,
          selectedPlanets: reducedPlanets,
        };

        const stringForCost = JSON.stringify(forCost, (key, value) =>
          typeof value === "bigint" ? value.toString() : value,
        );

        const predictedCost_ = predictTokenCost(stringForCost, "gpt-3.5-turbo");

        // Spend tokens and handle fetch within the same try block
        const responseSpendGPTTokens = await gameManager.spendGPTTokens(
          predictedCost_.credits,
        );
        await responseSpendGPTTokens.confirmedPromise;
      } catch (error) {
        console.error("Error sending message tokens not spend:", error);
        setAgentResponse("Error sending message tokens not spend.");
        return;
      }

      setAgentPreResponse(null);
    }
  };

  // Btn Send AIAgent request
  const handleAgentSend = async () => {
    if (inputAgent.trim()) {
      const reducedPlanets = reducePlanets(selectedPlanets);

      try {
        const stringReducedPlanets = JSON.stringify(
          reducedPlanets,
          (key, value) =>
            typeof value === "bigint" ? value.toString() : value,
        );
        const response = await fetch(`${API_URL}/api/agent/agent`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            username: player?.name,
            ownerAddress: player?.address,
            message: inputAgent,
            selectedPlanets: stringReducedPlanets,
          }),
        });

        if (response.ok) {
          const { aiResponse } = await response.json();
          // Validate and filter df_fcName and args
          console.log("response:", aiResponse);
          const { df_fcName, args } = aiResponse;
          if (!df_fcName || !Array.isArray(args)) {
            console.error(
              "Invalid AI response: missing function name or arguments.",
            );
            setAgentResponse(
              "The agent's response was invalid: missing function name or arguments. Please try again.",
            );
            return;
          }

          // Client-side execution of the validated function
          try {
            setAgentPreResponse({ df_fcName, args });
            setAgentResponse(
              `Function: ${df_fcName}, Args: ${JSON.stringify(args)}`,
            );
            // executeClientFunction(df_fcName, args);
          } catch (error) {
            console.error(
              ` Error executing client function: ${df_fcName}`,
              error,
            );
            setAgentResponse(
              ` An error occurred while executing the function: ${df_fcName}.`,
            );
          }
        } else {
          console.error("Failed to fetch agent response:", response.statusText);
          setAgentResponse("The server failed to process your request.");
        }
      } catch (error) {
        console.error("Error in AIAgentContent:", error);
        setAgentResponse("An error occurred while processing your request.");
      } finally {
        setInputAgent(""); // Clear input regardless of outcome
      }
    } else {
      setAgentResponse("Put some input msg Sophon agent!");
    }
  };

  /**
   * Executes a client function based on the agent's response.
   * @param {string} functionName - The name of the client function to call.
   * @param {any[]} args - The arguments to pass to the function.
   */
  const executeClientFunction = (functionName: string, args: never[]) => {
    const clientFunctions: Record<string, (...args: never[]) => void> = {
      move: (
        arg1: LocationId,
        arg2: LocationId,
        arg3: number | string,
        arg4: number | string,
        arg5: ArtifactId | undefined,
        arg6: boolean,
      ) => {
        // Example implementation
        // from.locationId, to.locationId, forces, silver, artifact?.id, abandoning,
        // arg1 , arg2 , arg3, arg4, arg5, arg6

        if (arg5 == "null" || arg5 == "0") {
          arg5 = undefined;
        }
        if (arg3 == typeof "string") {
          arg3 = Number(arg3);
        }
        if (arg4 == typeof "string") {
          arg4 = Number(arg4);
        }
        const agentAnswer = `Moving from ${getPlanetName(gameManager.getPlanetWithId(arg1))} to ${getPlanetName(gameManager.getPlanetWithId(arg2))} with forces: ${arg3} silver: ${arg4} artID: ${arg5} abandoning: ${arg6}`;
        setAgentResponse(agentAnswer);
        //speak(agentAnswer);
        gameManager.move(arg1, arg2, Number(arg3), Number(arg4), arg5, false);
      },
      revealLocation: (arg1: LocationId) => {
        const agentAnswer = `Revealing location: ${getPlanetName(gameManager.getPlanetWithId(arg1))}`;
        setAgentResponse(agentAnswer);
        //speak(agentAnswer);
        gameManager.revealLocation(arg1);
      },
      upgrade: (arg1: LocationId, arg2: number) => {
        const agentAnswer = `Upgrading planet ${getPlanetName(gameManager.getPlanetWithId(arg1))} with branch ${arg2}`;
        setAgentResponse(agentAnswer);
        // speak(agentAnswer);
        gameManager.upgrade(arg1, arg2);
      },
      upgradePlanet: (arg1: LocationId, arg2: number) => {
        const agentAnswer = `Upgrading planet ${getPlanetName(gameManager.getPlanetWithId(arg1))} with branch ${arg2}`;
        setAgentResponse(agentAnswer);
        // speak(agentAnswer);
        gameManager.upgrade(arg1, arg2);
      },
      setPlanetEmoji: (arg1: LocationId, arg2: string) => {
        const agentAnswer = `Setting emoji ${arg2} for location ${getPlanetName(gameManager.getPlanetWithId(arg1))}`;
        setAgentResponse(agentAnswer);
        gameManager.setPlanetEmoji(arg1, arg2);
      },
      withdrawSilver: (arg1: LocationId, arg2: number) => {
        const agentAnswer = `Withdrawing ${arg2} silver from ${getPlanetName(gameManager.getPlanetWithId(arg1))}`;
        setAgentResponse(agentAnswer);
        //speak(agentAnswer);
        gameManager.withdrawSilver(arg1, arg2);
      },
      refreshPlanet: (arg1: LocationId) => {
        const agentAnswer = `Refreshing planet ${arg1}`;
        setAgentResponse(agentAnswer);
        gameManager.refreshPlanet(arg1);
      },
    };

    if (functionName in clientFunctions) {
      clientFunctions[functionName](...args);
    } else {
      throw new Error(`Function ${functionName} is not defined.`);
    }
  };

  // Btn Clear AIAGent history
  const handleAgentTabOpen = () => {
    setAgentResponse(""); // Clear agent response when switching to the Agent tab
    setAgentPreResponse(null);
  };

  if (!account || !player) return null;

  return (
    <ModalPane
      id={ModalName.AIChat}
      title={"AI Sophons"}
      visible={visible}
      onClose={onClose}
      helpContent={HelpContent}
    >
      <div className="mb-4 flex items-center justify-between">
        <Btn
          onClick={() => {
            setActiveTab("chat");
          }}
          disabled={activeTab === "chat"}
        >
          AI Assistant
        </Btn>
        {/* Add AIRangeOfMap to the header for range selection */}

        <Btn
          onClick={() => {
            setActiveTab("agent");
            handleAgentTabOpen();
          }}
          disabled={activeTab === "agent"}
        >
          AI Agent
        </Btn>
      </div>
      {activeTab === "chat" ? (
        <AIChatWrapper>
          <AIChatContent>
            {chatHistory.map((message, index) => (
              <ChatMessage key={index} isUser={message.isUser}>
                {message.message}
              </ChatMessage>
            ))}
            <Spacer height={16} />
          </AIChatContent>

          <AIChatInput>
            <div className="border-t border-gray-700">
              <AIChatInputRows
                onKeyDown={(e) => e.stopPropagation()}
                onKeyUp={(e) => e.stopPropagation()}
                value={inputChat}
                onChange={(e) => setInputChat(e.target.value)}
                placeholder="Enter a command or query for the Sophon assistant..."
                rows={2}
              />
            </div>
            <div className="flex items-center justify-between p-1">
              <Btn onClick={handleClearChat}>Clear</Btn>
              <Btn onClick={handleMute}>{mute ? "🔊" : "🔇"}</Btn>
              <Btn onClick={handleSendChat}>Send</Btn>
            </div>
          </AIChatInput>
        </AIChatWrapper>
      ) : (
        <AIAgentContent>
          <div>
            {" "}
            <div className="flex items-center justify-center border-gray-600">
              {/* Column 1: Begin and End Text */}

              {/* Column 2: Begin End left and rigth */}
              <div className="flex flex-row items-start justify-center gap-10 p-1">
                <AITextOutput>
                  <span className="label">Begin:</span>
                  <span className="value">
                    {selectedRange.begin ? (
                      `(${selectedRange.begin.x}, ${selectedRange.begin.y})`
                    ) : (
                      <span className="text-sm text-gray-500">
                        Not Set. Click #1
                      </span>
                    )}
                  </span>
                </AITextOutput>
                <Btn
                  onClick={handleStartSelection}
                  disabled={isSelectionActive}
                >
                  Select Range
                </Btn>
                <AITextOutput>
                  <span className="label">End:</span>
                  <span className="value">
                    {selectedRange.end ? (
                      `(${selectedRange.end.x}, ${selectedRange.end.y})`
                    ) : (
                      <span className="text-sm text-gray-500">
                        Not Set. Click #2
                      </span>
                    )}
                  </span>
                </AITextOutput>
              </div>
            </div>
            <LevelFilter
              levels={PLANET_LEVELS}
              selectedLevels={selectedLevels}
              onSelectLevel={(levels) => {
                setSelectedLevels(levels);
              }}
            />
            <div className="flex items-center justify-between border-b border-t p-1">
              <div className="rounded border p-1">
                <AITextOutput>
                  <span className="label">In range</span>
                  <span className="value">{planetsCount}</span>
                </AITextOutput>
              </div>
              <div>
                <AITextOutput>
                  <span className="label">Cost $</span>
                  <span className="value">{predictedCost.cost.toFixed(8)}</span>
                </AITextOutput>
                <AITextOutput>
                  <span className="label">ChatTokens</span>
                  <span className="value">
                    {predictedCost.aItokens.toFixed(0)}
                  </span>
                </AITextOutput>
              </div>
              <div>
                <AITextOutput>
                  <span className="label">Credits</span>
                  <span className="value">
                    {predictedCost.credits.toFixed(0)}
                  </span>
                </AITextOutput>
                <AITextOutput>
                  <span className="label">Selected Planets</span>
                  <span className="value">{planetsFilteredCount}</span>
                </AITextOutput>
              </div>
            </div>
            <div className="flex items-center justify-between p-1">
              <AIChatInputRows
                onKeyDown={(e) => e.stopPropagation()}
                onKeyUp={(e) => e.stopPropagation()}
                className="TextInput"
                value={inputAgent}
                onChange={(e) => setInputAgent(e.target.value)}
                placeholder="Enter a command or query for the Sophon agent..."
                rows={3}
              />
            </div>
            <div className="flex items-center justify-between p-1">
              <Btn
                onClick={() => {
                  setAgentResponse("");
                  setAgentPreResponse(null);
                }}
              >
                Clear
              </Btn>
              {agentPreResponse != null && (
                <Btn onClick={handleAgentApprove}>Approve</Btn>
              )}
              <Btn onClick={handleAgentSend}>Send</Btn>
            </div>{" "}
            <AgentResponseContainer>
              {agentResponse
                .split(",")
                .map((line, index) => <div key={index}>{line.trim()}</div>) ||
                "No response yet. Please enter a message."}
            </AgentResponseContainer>{" "}
          </div>
        </AIAgentContent>
      )}
      <CurrencyView />
    </ModalPane>
  );
}
