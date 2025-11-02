import { isEmojiFlagMessage } from "@df/gamelogic";
import {
  isAvatar,
  isHat,
  isLogo,
  isMeme,
  numToAvatarType,
  numToHatType,
  numToLogoType,
  numToMemeType,
} from "@df/procedural";
import type {
  Artifact,
  CanvasCoords,
  Chunk,
  EmojiFlagBody,
  PlanetMessage,
  PlanetRenderInfo,
  WorldCoords,
} from "@df/types";
import { ArtifactRarity, LogoType, TextAlign } from "@df/types";

import { avatarFromType } from "./Avatars";
import { engineConsts } from "./EngineConsts";
import { EngineUtils } from "./EngineUtils";
import { hatFromType } from "./Hats";
import { logoFromType } from "./Logos";
import { memeFromType } from "./Memes";
import type { Renderer } from "./Renderer";
/*
   this is mostly migration code from the old renderer; it holds all of the old renderer primitives,
   but most of them have been re-implemented in GL. still useful for debugging sometimes - draws
   to the canvas2d canvas, which sits above the webgl canvas.
 */
export class Overlay2DRenderer {
  renderer: Renderer;
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;

  constructor(engine: Renderer, canvas: HTMLCanvasElement) {
    this.renderer = engine;
    this.canvas = canvas;

    const ctx = this.canvas.getContext("2d");
    if (!ctx) {
      console.error("error getting draw context");
      return;
    }

    this.ctx = ctx;
  }

  clear() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }

  drawChunk(chunk: Chunk) {
    const { bottomLeft, sideLength } = chunk.chunkFootprint;
    const { x, y } = bottomLeft;

    this.drawRectStrokeAtCenterWorld(
      { x: x + sideLength / 2, y: y + sideLength / 2 },
      sideLength,
      sideLength,
      2,
      "red",
    );
  }

  drawRectStrokeAtCenterWorld(
    center: WorldCoords,
    width: number,
    height: number,
    strokeWidth: number,
    color = "white",
  ) {
    const viewport = this.renderer.getViewport();

    const centerCanvasCoords = viewport.worldToCanvasCoords(center);
    const widthCanvasCoords = viewport.worldToCanvasDist(width);
    const heightCanvasCoords = viewport.worldToCanvasDist(height);
    this.ctx.fillStyle = "rgba(0, 0, 0, 0)";
    this.ctx.strokeStyle = color;
    this.ctx.lineWidth = strokeWidth;
    this.ctx.strokeRect(
      centerCanvasCoords.x - widthCanvasCoords / 2,
      centerCanvasCoords.y - heightCanvasCoords / 2,
      widthCanvasCoords,
      heightCanvasCoords,
    );
  }

  drawArtifactAroundPlanet(
    // @ts-expect-error `artifact` argument seems to be unused, double check and remove if redundant
    artifact: Artifact,
    coords: CanvasCoords,
    size: number,
  ) {
    this.ctx.fillRect(coords.x - size / 2, coords.y - size / 2, size, size);
  }

  drawHat(
    hatType: number,
    pathHeight: number, // height of svg path
    pathWidth: number, // width of svg path
    center: WorldCoords, // center of planet
    width: number, // width of hat
    height: number, // height of hat
    radius: number, // radius of planet
    rotation: number, // rotation of planet / hat (no-op right now)
    hoveringPlanet: boolean, // whether or not the user is hovering over the given planet
    fill1: string | CanvasPattern = "white", // hat fill color for bottom layer
    fill2: string | CanvasPattern = "red", // hat fill color for top layer
    hoverCoords: WorldCoords | null = null,
  ) {
    const { ctx } = this;
    const viewport = this.renderer.getViewport();

    const getHat = (num: number) => {
      if (isHat(num)) {
        return hatFromType(numToHatType(num));
      } else if (isMeme(num)) {
        return memeFromType(numToMemeType(num));
      } else if (isLogo(num)) {
        return logoFromType(numToLogoType(num));
      } else if (isAvatar(num)) {
        return avatarFromType(numToAvatarType(num));
      } else {
        return logoFromType(LogoType.DFARES);
      }
    };

    const hat = getHat(hatType);

    // const hat = hatFromType(HatType.Doge);

    const offY = radius + height / 4;

    const trueCenter = viewport.worldToCanvasCoords(center);
    const trueWidth = viewport.worldToCanvasDist(width);
    const trueHeight = viewport.worldToCanvasDist(height);
    const trueOffY = -1 * viewport.worldToCanvasDist(offY);

    // calculate hat hover

    // TODO when we add planet rotation back in we'll need to use sin/cos to calculate hat center...
    const hatCenter: WorldCoords = {
      x: center.x,
      y: center.y + offY,
    };

    const hatTopLeft = {
      x: hatCenter.x - width / 2,
      y: hatCenter.y - height / 2,
    };

    const hovering =
      (hoverCoords &&
        hoverCoords.x > hatTopLeft.x &&
        hoverCoords.x < hatTopLeft.x + width &&
        hoverCoords.y > hatTopLeft.y &&
        hoverCoords.y < hatTopLeft.y + height) ||
      hoveringPlanet;

    // now draw the hat
    if (hat.legacy) {
      ctx.save();

      // move to planet center
      ctx.translate(trueCenter.x, trueCenter.y);

      // extrude out to outside
      ctx.rotate(rotation);
      ctx.translate(0, trueOffY);

      // move to svg center
      ctx.scale(trueWidth / pathWidth, trueHeight / pathHeight);
      ctx.translate(-pathWidth / 2, -pathHeight / 2);

      ctx.globalAlpha = hovering ? 0.3 : 1;

      ctx.fillStyle = fill1;
      for (const pathStr of hat.bottomLayer) {
        ctx.fill(new Path2D(pathStr));
      }

      ctx.fillStyle = fill2;
      for (const pathStr of hat.topLayer) {
        ctx.fill(new Path2D(pathStr));
      }

      ctx.globalAlpha = 1;

      ctx.restore();
    }
  }

  drawHTMLImageWithClipping(
    image: HTMLImageElement,
    center: WorldCoords,
    width: number,
    height: number,
    radius: number,
    hoveringPlanet: boolean,
    spriteX: number, // x offset in sprite sheet
    spriteY: number, // y offset in sprite sheet
    spriteWidth: number, // width of individual sprite
    spriteHeight: number, // height of individual sprite
    rotation: number = 0, // rotation in radians
  ) {
    const { ctx } = this;
    const viewport = this.renderer.getViewport();

    const trueCenter = viewport.worldToCanvasCoords(center);
    const trueWidth = viewport.worldToCanvasDist(width);
    const trueHeight = viewport.worldToCanvasDist(height);

    ctx.save();
    ctx.translate(trueCenter.x, trueCenter.y);
    ctx.rotate(rotation);
    ctx.scale(trueWidth / spriteWidth, trueHeight / spriteHeight);

    // Draw the specific sprite from the sprite sheet
    ctx.drawImage(
      image,
      spriteX,
      spriteY,
      spriteWidth,
      spriteHeight, // source rectangle
      -spriteWidth / 2,
      -spriteHeight / 2,
      spriteWidth,
      spriteHeight, // destination rectangle
    );

    ctx.restore();
  }

  drawHTMLImageWithRarityEffects(
    image: HTMLImageElement,
    center: WorldCoords,
    width: number,
    height: number,
    _radius: number,
    _hoveringPlanet: boolean,
    spriteX: number, // x offset in sprite sheet
    spriteY: number, // y offset in sprite sheet
    spriteWidth: number, // width of individual sprite
    spriteHeight: number, // height of individual sprite
    rotation: number = 0, // rotation in radians
    rarity: number = 1, // artifact rarity (1 = Common, 2 = Rare, etc.)
    alpha: number = 255, // alpha value for transparency
  ) {
    const { ctx } = this;
    const viewport = this.renderer.getViewport();

    const trueCenter = viewport.worldToCanvasCoords(center);
    const trueWidth = viewport.worldToCanvasDist(width);
    const trueHeight = viewport.worldToCanvasDist(height);

    // Calculate shine animation (exact same as SpriteRenderer)
    const totalDur = 3;
    const totalFrames = totalDur * 60;
    // Use EngineUtils.getNow() for consistent timing with SpriteRenderer
    const nowFrame = Math.floor((EngineUtils.getNow() % totalDur) * 60);
    const shineVal = nowFrame / totalFrames;

    // Determine effects based on rarity
    const hasShine = rarity >= ArtifactRarity.Rare;
    const isLegendary = rarity === ArtifactRarity.Legendary;
    const isMythic = rarity === ArtifactRarity.Mythic;
    // Removed outline effect - no borders for spaceships

    ctx.save();

    // Main sprite rendering
    ctx.translate(trueCenter.x, trueCenter.y);
    ctx.rotate(rotation);
    ctx.scale(trueWidth / spriteWidth, trueHeight / spriteHeight);
    ctx.globalAlpha = alpha / 255;

    // Apply color inversion for legendary artifacts
    if (isLegendary) {
      ctx.filter = "invert(1)";
    }

    // Apply mythic effects (simplified version of the shader effect)
    if (isMythic) {
      // Create a canvas for mythic effects
      const tempCanvas = document.createElement("canvas");
      const tempCtx = tempCanvas.getContext("2d");
      if (tempCtx) {
        tempCanvas.width = spriteWidth;
        tempCanvas.height = spriteHeight;

        // Draw the sprite to temp canvas
        tempCtx.drawImage(
          image,
          spriteX,
          spriteY,
          spriteWidth,
          spriteHeight,
          0,
          0,
          spriteWidth,
          spriteHeight,
        );

        // Apply mythic color effects
        const imageData = tempCtx.getImageData(0, 0, spriteWidth, spriteHeight);
        const data = imageData.data;

        for (let i = 0; i < data.length; i += 4) {
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];

          // Check if pixel is black or white (preserve them)
          const isBlack = r < 13 && g < 13 && b < 13;
          const isWhite = r > 242 && g > 242 && b > 242;

          if (!isBlack && !isWhite) {
            // Apply mythic color transformation
            data[i] = Math.min(255, Math.max(0, (r - 89) * 3 + 89)); // Red
            data[i + 1] = Math.min(255, Math.max(0, (g - 89) * 3 + 89)); // Green
            data[i + 2] = Math.min(255, Math.max(0, (b - 89) * 3 + 89)); // Blue
          }
        }

        tempCtx.putImageData(imageData, 0, 0);

        // Draw the processed image
        ctx.drawImage(
          tempCanvas,
          -spriteWidth / 2,
          -spriteHeight / 2,
          spriteWidth,
          spriteHeight,
        );
      }
    } else {
      // Draw normal sprite
      ctx.drawImage(
        image,
        spriteX,
        spriteY,
        spriteWidth,
        spriteHeight, // source rectangle
        -spriteWidth / 2,
        -spriteHeight / 2,
        spriteWidth,
        spriteHeight, // destination rectangle
      );
    }

    // Apply shine effect for rare+ artifacts
    if (hasShine) {
      ctx.restore();
      ctx.save();

      // Calculate shine position (same formula as shader)
      const shine = -0.5 + 12 * shineVal;

      // Create shine effect using a white line
      ctx.translate(trueCenter.x, trueCenter.y);
      ctx.rotate(rotation);
      ctx.scale(trueWidth / spriteWidth, trueHeight / spriteHeight);

      ctx.strokeStyle = "white";
      // Match shader thickness: 0.05 of sprite size (same as shader's < 0.05 condition)
      ctx.lineWidth = Math.max(1, spriteWidth * 0.05);
      ctx.globalAlpha = 0.8;

      // Draw diagonal shine line (exact same as shader: (x - shine) - 0.25 * (y - 0.5) = 0)
      ctx.beginPath();
      const startX = -spriteWidth / 2;
      const endX = spriteWidth / 2;
      const startY = -spriteHeight / 2;
      const endY = spriteHeight / 2;

      // Convert to normalized coordinates (0-1) like the shader uses
      const normalizedShine = shine;

      // Find intersection points of diagonal line with sprite boundaries
      // Line equation: (x - shine) - 0.25 * (y - 0.5) = 0
      // Rearranged: y = 4 * (x - shine) + 0.5

      const intersections = [];

      // Check intersection with left edge (x = 0)
      const yAtLeft = 4 * (0 - normalizedShine) + 0.5;
      if (yAtLeft >= 0 && yAtLeft <= 1) {
        intersections.push({ x: startX, y: startY + yAtLeft * spriteHeight });
      }

      // Check intersection with right edge (x = 1)
      const yAtRight = 4 * (1 - normalizedShine) + 0.5;
      if (yAtRight >= 0 && yAtRight <= 1) {
        intersections.push({ x: endX, y: startY + yAtRight * spriteHeight });
      }

      // Check intersection with top edge (y = 0)
      const xAtTop = normalizedShine + 0.25 * (0 - 0.5);
      if (xAtTop >= 0 && xAtTop <= 1) {
        intersections.push({ x: startX + xAtTop * spriteWidth, y: startY });
      }

      // Check intersection with bottom edge (y = 1)
      const xAtBottom = normalizedShine + 0.25 * (1 - 0.5);
      if (xAtBottom >= 0 && xAtBottom <= 1) {
        intersections.push({ x: startX + xAtBottom * spriteWidth, y: endY });
      }

      // Draw the diagonal line through the intersection points
      if (intersections.length >= 2) {
        ctx.moveTo(intersections[0].x, intersections[0].y);
        ctx.lineTo(intersections[1].x, intersections[1].y);
        ctx.stroke();
      }
    }

    ctx.restore();
  }

  drawHTMLImage(
    image: HTMLImageElement,
    center: WorldCoords, // center of planet
    width: number, // width of hat
    height: number, // height of hat
    radius: number, // radius of planet
    hoveringPlanet: boolean, // whether or not the user is hovering over the given planet
    hoverCoords: WorldCoords | null = null,
  ) {
    const { ctx } = this;
    const viewport = this.renderer.getViewport();
    // const hat = hatFromType(hatType);

    const offY = radius + height / 4;

    const trueCenter = viewport.worldToCanvasCoords(center);
    const trueWidth = viewport.worldToCanvasDist(width);
    const trueHeight = viewport.worldToCanvasDist(height);
    // const trueOffY = -1 * viewport.worldToCanvasDist(offY);

    // calculate hat hover

    // TODO when we add planet rotation back in we'll need to use sin/cos to calculate hat center...
    const hatCenter: WorldCoords = {
      x: center.x,
      y: center.y + offY,
    };

    const hatTopLeft = {
      x: hatCenter.x - width / 2,
      y: hatCenter.y - height / 2,
    };

    const hovering =
      (hoverCoords &&
        hoverCoords.x > hatTopLeft.x &&
        hoverCoords.x < hatTopLeft.x + width &&
        hoverCoords.y > hatTopLeft.y &&
        hoverCoords.y < hatTopLeft.y + height) ||
      hoveringPlanet;

    ctx.save();
    ctx.globalAlpha = hovering ? 0.3 : 1;

    // ctx.arc(trueCenter.x, trueCenter.y, trueWidth / 2, 0, 2 * Math.PI);
    // ctx.clip();

    ctx.drawImage(
      image,
      trueCenter.x - trueWidth / 2,
      trueCenter.y - trueHeight / 2,
      trueWidth,
      trueHeight,
    );

    ctx.globalAlpha = 1;
    ctx.restore();
  }

  drawLoopWorld(
    center: WorldCoords,
    radius: number,
    width: number,
    color = "white",
    dotted = false,
  ) {
    this.drawArcWorld(center, radius, width, 100, color, dotted);
  }

  drawArcWorld(
    center: WorldCoords,
    radius: number,
    width: number,
    percent: number,
    color = "white",
    dotted = false,
  ) {
    const viewport = this.renderer.getViewport();

    const centerCanvasCoords = viewport.worldToCanvasCoords(center);
    const radiusCanvasCoords = viewport.worldToCanvasDist(radius);
    this.ctx.fillStyle = "rgba(0, 0, 0, 0)";
    this.ctx.strokeStyle = color;
    // this.ctx.lineWidth = viewport.worldToCanvasDist(width);
    this.ctx.lineWidth = width;
    this.ctx.beginPath();
    this.ctx.arc(
      centerCanvasCoords.x,
      centerCanvasCoords.y,
      radiusCanvasCoords,
      1.5 * Math.PI,
      1.5 * Math.PI + (2 * Math.PI * percent) / 100,
      false,
    );

    if (dotted) {
      this.ctx.setLineDash([15, 15]);
    } else {
      this.ctx.setLineDash([]);
    }
    this.ctx.stroke();

    this.ctx.setLineDash([]);
  }

  drawLine(
    startCoords: WorldCoords,
    endCoords: WorldCoords,
    lineWidth: number,
    color = "white",
    dotted = false,
  ) {
    const viewport = this.renderer.getViewport();

    this.ctx.beginPath();
    // this.ctx.lineWidth = viewport.worldToCanvasDist(lineWidth);
    this.ctx.lineWidth = lineWidth;
    this.ctx.strokeStyle = color;
    const startCanvasCoords: CanvasCoords =
      viewport.worldToCanvasCoords(startCoords);
    this.ctx.moveTo(startCanvasCoords.x, startCanvasCoords.y);
    const endCanvasCoords: CanvasCoords =
      viewport.worldToCanvasCoords(endCoords);
    this.ctx.lineTo(endCanvasCoords.x, endCanvasCoords.y);

    if (dotted) {
      this.ctx.setLineDash([15, 15]);
    } else {
      this.ctx.setLineDash([]);
    }
    this.ctx.stroke();

    this.ctx.setLineDash([]);
  }

  drawPlanetMessages(
    centerWorld: WorldCoords,
    radiusWorld: number,
    renderInfo: PlanetRenderInfo,
    textAlpha: number,
  ) {
    this.drawEmojiMessage(
      centerWorld,
      radiusWorld,
      renderInfo,
      renderInfo.planet.emoji ?? "",
      textAlpha,
    );

    // planets have at most one emoji
    // let renderedEmoji = false;
    // renderInfo.planet.messages?.forEach((m) => {
    //   if (isEmojiFlagMessage(m) && !renderedEmoji) {
    //     this.drawEmojiMessage(
    //       centerWorld,
    //       radiusWorld,
    //       renderInfo,
    //       m,
    //       textAlpha,
    //     );
    //     renderedEmoji = true;
    //   }
    // });
  }

  drawEmojiMessage(
    centerWorld: WorldCoords,
    radiusWorld: number,
    renderInfo: PlanetRenderInfo,
    emoji: string,
    textAlpha: number,
  ) {
    const getUnifiedFromEmoji = (emoji: string) => {
      const codePoints = Array.from(emoji).map(
        (char) => char.codePointAt(0)?.toString(16) || "",
      );
      return codePoints.join("-");
    };

    const emojiData = getUnifiedFromEmoji(emoji);
    if (!emojiData) {
      return;
    }

    const viewport = this.renderer.getViewport();
    const pixelCoords = viewport.worldToCanvasCoords(centerWorld);
    const radiusPixels = (viewport.worldToCanvasDist(radiusWorld) * 3) / 4;

    // Save current context state
    this.ctx.save();
    // Set the global alpha
    this.ctx.globalAlpha = textAlpha;

    // Helper function to simplify emoji code
    const simplifyEmojiCode = (code: string): string => {
      // Remove variation selectors (fe0f)
      let simplified = code.replace(/-fe0f/g, "");
      // Remove zero-width joiner
      simplified = simplified.replace(/-200d/g, "");
      // Remove skin tone modifiers
      simplified = simplified.replace(/-1f3f[b-f]/g, "");
      // For compound emojis, use first part
      if (simplified.includes("-")) {
        simplified = simplified.split("-")[0];
      }
      return simplified;
    };

    const img = new Image();

    const simplifiedEmojiData = simplifyEmojiCode(emojiData);
    img.src = `https://cdn.jsdelivr.net/gh/twitter/twemoji@latest/assets/svg/${simplifiedEmojiData}.svg`;

    this.ctx.drawImage(
      img,
      pixelCoords.x - radiusPixels,
      pixelCoords.y - radiusPixels * 2.7,
      radiusPixels * 2,
      radiusPixels * 2,
    );

    // Restore context state
    this.ctx.restore();
  }

  drawText(
    text: string,
    x: number,
    y: number,
    color = "white",
    align: TextAlign = TextAlign.Center,
  ) {
    this.ctx.font = engineConsts.fontStyle;
    // this.ctx.textBaseline = 'middle';
    if (align === TextAlign.Center) {
      this.ctx.textAlign = "center";
    } else {
      // no-op
      this.ctx.textAlign = "center";
    }
    this.ctx.fillStyle = color;
    this.ctx.fillText(text, x, y);
  }

  drawArtifactIcon(glassLoc: WorldCoords, scale: number, color = "white") {
    const { ctx } = this;

    const viewport = this.renderer.getViewport();
    const loc = viewport.worldToCanvasCoords(glassLoc);

    ctx.save();
    ctx.translate(loc.x, loc.y);
    ctx.scale((1 / 32) * scale, (1 / 32) * scale);

    const path = new Path2D(
      "M385.758 160c9.063-6.44 17.756-13.608 25.722-21.574 16.701-16.701 27.873-37.25 31.456-57.861 3.929-22.593-1.836-43.57-15.815-57.55-11.15-11.149-26.255-17.043-43.682-17.043-24.816 0-50.961 11.912-71.73 32.681-33.238 33.238-52.613 79.119-63.038 111.861-7.72-32.901-23.103-77.322-53.009-107.229-16.047-16.046-36.557-24.285-55.923-24.285-15.827 0-30.89 5.502-42.13 16.743-24.993 24.994-21.616 68.893 7.543 98.052 10.396 10.396 22.549 19.031 35.36 26.206h-108.512v128h32v224h384v-224.001h32v-128h-94.242zM337.163 64.109c13.862-13.862 31.161-22.137 46.275-22.137 5.35 0 12.854 1.127 18.225 6.499 13.015 13.014 5.706 43.154-15.64 64.499-21.973 21.973-51.53 37.084-77.216 47.030h-25.336c9.284-28.774 26.029-68.228 53.692-95.891zM130.607 108.338c-7.914-7.914-12.885-18.080-13.64-27.893-0.351-4.56-0.025-13.124 6.098-19.247 5.122-5.122 11.894-6.198 16.674-6.198v0c10.629 0 21.734 5.008 30.466 13.74 16.936 16.936 30.883 43.886 40.334 77.938 0.255 0.92 0.504 1.835 0.748 2.743-0.908-0.243-1.823-0.492-2.743-0.748-34.052-9.451-61.002-23.399-77.937-40.335zM448 272h-160v208h-64v-208h-160v-16h160v-64h64v64h160v16z",
    );
    ctx.translate(-256, -256);

    ctx.fillStyle = color;
    ctx.fill(path);

    ctx.restore();
  }

  drawMiner() {
    const { context: gameUIManager } = this.renderer;
    const { ctx } = this;

    const minerLocs = gameUIManager.getAllMinerLocations();
    if (minerLocs.length === 0) {
      return;
    }

    const viewport = this.renderer.getViewport();
    for (const minerLoc of minerLocs) {
      // Somehow a miner can end up undefined at this point
      if (!minerLoc) {
        continue;
      }

      const loc = viewport.worldToCanvasCoords(minerLoc);

      ctx.save();
      ctx.translate(loc.x, loc.y);
      ctx.scale(1 / 16, 1 / 16);

      const path = new Path2D(
        "M512 224h-50.462c-13.82-89.12-84.418-159.718-173.538-173.538v-50.462h-64v50.462c-89.12 13.82-159.718 84.418-173.538 173.538h-50.462v64h50.462c13.82 89.12 84.418 159.718 173.538 173.538v50.462h64v-50.462c89.12-13.82 159.718-84.418 173.538-173.538h50.462v-64zM396.411 224h-49.881c-9.642-27.275-31.255-48.889-58.53-58.53v-49.881c53.757 12.245 96.166 54.655 108.411 108.411zM256 288c-17.673 0-32-14.327-32-32s14.327-32 32-32c17.673 0 32 14.327 32 32s-14.327 32-32 32zM224 115.589v49.881c-27.275 9.641-48.889 31.255-58.53 58.53h-49.881c12.245-53.756 54.655-96.166 108.411-108.411zM115.589 288h49.881c9.641 27.275 31.255 48.889 58.53 58.53v49.881c-53.756-12.245-96.166-54.654-108.411-108.411zM288 396.411v-49.881c27.275-9.642 48.889-31.255 58.53-58.53h49.881c-12.245 53.757-54.654 96.166-108.411 108.411z",
      );
      ctx.translate(-256, -256);

      ctx.fillStyle = "white";
      ctx.fill(path);

      ctx.restore();
    }
  }
}
