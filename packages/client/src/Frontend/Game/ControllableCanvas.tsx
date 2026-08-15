import { Renderer } from "@df/renderer";
import { CursorState, ModalManagerEvent, Setting } from "@df/types";
// import * as fabric from 'fabric'; // v6
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import styled from "styled-components";

import type { RendererGameContext } from "../../Shared/renderer/Renderer";
import { useUIManager } from "../Utils/AppHooks";
import { useIsDown } from "../Utils/KeyEmitters";
import {
  MOVE_DOWN,
  MOVE_LEFT,
  MOVE_RIGHT,
  MOVE_UP,
} from "../Utils/ShortcutConstants";
import UIEmitter, { UIEmitterEvent } from "../Utils/UIEmitter";
import Viewport from "./Viewport";

const CanvasWrapper = styled.div`
  width: 100%;
  height: 100%;

  position: relative;

  canvas {
    width: 100%;
    height: 100%;

    position: absolute;

    &#buffer {
      width: auto;
      height: auto;
      display: none;
    }
  }
  // TODO put this into a global style
  canvas,
  img {
    image-rendering: -moz-crisp-edges;
    image-rendering: -webkit-crisp-edges;
    image-rendering: pixelated;
    image-rendering: crisp-edges;
  }
`;

export default function ControllableCanvas() {
  // html canvas element width and height. viewport dimensions are tracked by viewport obj
  const [width, setWidth] = useState(0);
  const [height, setHeight] = useState(0);

  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const glRef = useRef<HTMLCanvasElement | null>(null);
  const bufferRef = useRef<HTMLCanvasElement | null>(null);
  const initializedRef = useRef(false);

  const evtRef = canvasRef;

  // const [fCanvas, setFCanvas] = useState<fabric.Canvas | null>(null);

  const gameUIManager = useUIManager();

  const modalManager = gameUIManager.getModalManager();
  const [targeting, setTargeting] = useState<boolean>(false);

  useEffect(() => {
    const updateTargeting = (newstate: CursorState) => {
      setTargeting(newstate === CursorState.TargetingExplorer);
    };
    modalManager.on(ModalManagerEvent.StateChanged, updateTargeting);
    return () => {
      modalManager.removeListener(
        ModalManagerEvent.StateChanged,
        updateTargeting,
      );
    };
  }, [modalManager]);

  const doResize = useCallback(() => {
    if (wrapperRef.current) {
      const nextWidth = wrapperRef.current.clientWidth;
      const nextHeight = wrapperRef.current.clientHeight;

      if (nextWidth <= 0 || nextHeight <= 0) {
        return;
      }

      setWidth((currentWidth) =>
        currentWidth === nextWidth ? currentWidth : nextWidth,
      );
      setHeight((currentHeight) =>
        currentHeight === nextHeight ? currentHeight : nextHeight,
      );
    }
  }, []);

  useLayoutEffect(() => {
    doResize();
  }, [doResize]);

  useEffect(() => {
    if (!wrapperRef.current || typeof ResizeObserver === "undefined") {
      return;
    }

    const resizeObserver = new ResizeObserver(() => {
      doResize();
    });

    resizeObserver.observe(wrapperRef.current);

    return () => {
      resizeObserver.disconnect();
    };
  }, [doResize]);

  useEffect(() => {
    if (!initializedRef.current || width <= 0 || height <= 0) {
      return;
    }

    const uiEmitter: UIEmitter = UIEmitter.getInstance();
    const frameId = window.requestAnimationFrame(() => {
      uiEmitter.emit(UIEmitterEvent.WindowResize);
    });

    return () => {
      window.cancelAnimationFrame(frameId);
    };
  }, [width, height]);

  const canInitialize = Boolean(gameUIManager) && width > 0 && height > 0;

  useEffect(() => {
    if (!canInitialize || !gameUIManager) {
      return;
    }
    // if (!fCanvas && canvasRef.current) {
    //   // setFCanvas(new fabric.Canvas(canvasRef.current));
    // }

    const uiEmitter: UIEmitter = UIEmitter.getInstance();

    const onWheel = (e: WheelEvent): void => {
      e.preventDefault();
      const { deltaY } = e;
      uiEmitter.emit(UIEmitterEvent.CanvasScroll, deltaY);
    };

    // const canvas = fCanvas?.getSelectionElement();
    const canvas = evtRef.current;
    if (!canvas || !canvasRef.current || !glRef.current || !bufferRef.current) {
      return;
    }

    // This zooms your home world in really close to show the awesome details
    // TODO: Store this as it changes and re-initialize to that if stored
    const defaultWorldUnits = 4;
    Viewport.initialize(gameUIManager, defaultWorldUnits, canvas);
    Renderer.initialize(
      canvasRef.current,
      glRef.current,
      bufferRef.current,
      Viewport.getInstance(),
      gameUIManager as unknown as RendererGameContext,
      {
        spaceColors: {
          innerNebulaColor: gameUIManager.getStringSetting(
            Setting.RendererColorInnerNebula,
          ),
          nebulaColor: gameUIManager.getStringSetting(
            Setting.RendererColorNebula,
          ),
          spaceColor: gameUIManager.getStringSetting(
            Setting.RendererColorSpace,
          ),
          deepSpaceColor: gameUIManager.getStringSetting(
            Setting.RendererColorDeepSpace,
          ),
          deadSpaceColor: gameUIManager.getStringSetting(
            Setting.RendererColorDeadSpace,
          ),
        },
      },
    );
    initializedRef.current = true;

    // We can't attach the wheel event onto the canvas due to:
    // https://www.chromestatus.com/features/6662647093133312
    canvas.addEventListener("wheel", onWheel);
    // fCanvas.on("mouse:wheel", onWheel);
    window.addEventListener("resize", doResize);

    uiEmitter.on(UIEmitterEvent.UIChange, doResize);

    const initialResizeFrameId = window.requestAnimationFrame(() => {
      uiEmitter.emit(UIEmitterEvent.WindowResize);
    });

    return () => {
      initializedRef.current = false;
      window.cancelAnimationFrame(initialResizeFrameId);
      Viewport.destroyInstance();
      Renderer.destroy();
      canvas.removeEventListener("wheel", onWheel);
      window.removeEventListener("resize", doResize);
      uiEmitter.removeListener(UIEmitterEvent.UIChange, doResize);
    };
  }, [
    canInitialize,
    gameUIManager,
    doResize,
    canvasRef,
    glRef,
    bufferRef,
    evtRef,
  ]);

  // attach event listeners
  useEffect(() => {
    if (!evtRef.current) {
      return;
    }
    const canvas = evtRef.current;

    const uiEmitter: UIEmitter = UIEmitter.getInstance();

    function onMouseEvent(
      emitEventName: UIEmitterEvent,
      mouseEvent: MouseEvent,
    ) {
      const rect = canvas.getBoundingClientRect();
      const canvasX = mouseEvent.clientX - rect.left;
      const canvasY = mouseEvent.clientY - rect.top;
      uiEmitter.emit(emitEventName, { x: canvasX, y: canvasY });
    }

    const onMouseDown = (e: MouseEvent) => {
      onMouseEvent(UIEmitterEvent.CanvasMouseDown, e);
    };
    // this is the root of the mousemove event
    const onMouseMove = (e: MouseEvent) => {
      onMouseEvent(UIEmitterEvent.CanvasMouseMove, e);
    };
    const onMouseUp = (e: MouseEvent) => {
      onMouseEvent(UIEmitterEvent.CanvasMouseUp, e);
    };
    // TODO convert this to mouseleave
    const onMouseOut = () => {
      uiEmitter.emit(UIEmitterEvent.CanvasMouseOut);
    };

    canvas.addEventListener("mousedown", onMouseDown);
    canvas.addEventListener("mousemove", onMouseMove);
    canvas.addEventListener("mouseup", onMouseUp);
    canvas.addEventListener("mouseout", onMouseOut);
    return () => {
      canvas.removeEventListener("mousedown", onMouseDown);
      canvas.removeEventListener("mousemove", onMouseMove);
      canvas.removeEventListener("mouseup", onMouseUp);
      canvas.removeEventListener("mouseout", onMouseOut);
    };
  }, [evtRef]);

  // Keyboard movement handlers with continuous movement supportAdd commentMore actions
  const isUpPressed = useIsDown(MOVE_UP);
  const isDownPressed = useIsDown(MOVE_DOWN);
  const isLeftPressed = useIsDown(MOVE_LEFT);
  const isRightPressed = useIsDown(MOVE_RIGHT);

  // Continuous movement using animation frame
  useEffect(() => {
    let animationId: number;

    const moveCamera = () => {
      const uiEmitter = UIEmitter.getInstance();

      if (isUpPressed) {
        uiEmitter.emit(UIEmitterEvent.MoveUp);
      }
      if (isDownPressed) {
        uiEmitter.emit(UIEmitterEvent.MoveDown);
      }
      if (isLeftPressed) {
        uiEmitter.emit(UIEmitterEvent.MoveLeft);
      }
      if (isRightPressed) {
        uiEmitter.emit(UIEmitterEvent.MoveRight);
      }

      // Continue the animation loop if any key is pressed
      if (isUpPressed || isDownPressed || isLeftPressed || isRightPressed) {
        animationId = requestAnimationFrame(moveCamera);
      }
    };

    // Start movement if any key is pressed
    if (isUpPressed || isDownPressed || isLeftPressed || isRightPressed) {
      animationId = requestAnimationFrame(moveCamera);
    }

    return () => {
      if (animationId) {
        cancelAnimationFrame(animationId);
      }
    };
  }, [isUpPressed, isDownPressed, isLeftPressed, isRightPressed]);

  return (
    <CanvasWrapper
      ref={wrapperRef}
      style={{ cursor: targeting ? "crosshair" : undefined }}
    >
      <canvas ref={glRef} width={width} height={height} />
      <canvas ref={canvasRef} width={width} height={height} />
      <canvas ref={bufferRef} id="buffer" />
    </CanvasWrapper>
  );
}
