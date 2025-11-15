import { EMPTY_ADDRESS } from "@df/constants";
import { formatNumber, getRange, hasOwner, isLocatable } from "@df/gamelogic";
import {
  artifactImageTypeToNum,
  avatarTypeToNum,
  getOwnerColorVec,
  getPlanetCosmetic,
  isAvatar,
  isLogo,
  isMeme,
  logoTypeToNum,
  memeTypeToNum,
} from "@df/procedural";
import { isUnconfirmedMoveTx } from "@df/serde";
import { artifactIdFromHexStr } from "@df/serde";
import type {
  Artifact,
  ArtifactId,
  AvatarType,
  LocatablePlanet,
  LocationId,
  MemeType,
  Planet,
  PlanetRenderInfo,
  PlanetRenderManagerType,
  WorldCoords,
  MaterialType,
  RGBAVec,
} from "@df/types";
import {
  ArtifactRarity,
  ArtifactType,
  Biome,
  HatType,
  LogoType,
  PlanetType,
  RendererType,
  SpaceshipType,
  TextAlign,
  TextAnchor,
} from "@df/types";
import type { ClientComponents } from "@mud/createClientComponents";

import { avatars } from "../Avatars";
import { engineConsts } from "../EngineConsts";
import { logos } from "../Logos";
import { memes } from "../Memes";
import type { Renderer } from "../Renderer";
import type { GameGLManager } from "../WebGL/GameGLManager";
import { getMaterialColor } from "@frontend/Panes/PlanetMaterialsPane";
import dfstyles from "@frontend/Styles/dfstyles";

const { whiteA, barbsA, gold } = engineConsts.colors;
const { maxRadius } = engineConsts.planet;

/**
 * this guy is always going to call things in worldcoords, we'll convert them
 * to CanvasCoords. responsible for rendering planets by calling primitive renderers
 */
export class PlanetRenderManager implements PlanetRenderManagerType {
  renderer: Renderer;

  rendererType = RendererType.PlanetManager;

  // Custom spaceship sprite management
  private spaceshipImages: Map<SpaceshipType, HTMLImageElement> = new Map();
  private spaceshipSpritesLoaded: boolean = false;

  // Custom spaceship sprite URLs
  private static readonly SPACESHIP_SPRITES = {
    [SpaceshipType.Scout]: "/sprites/Scouts.png",
    [SpaceshipType.Fighter]: "/sprites/Fighters.png",
    [SpaceshipType.Destroyer]: "/sprites/Destroyers.png",
    [SpaceshipType.Carrier]: "/sprites/Cruisers.png", // Using Cruisers.png for Carrier
  } as const;

  // Custom module sprite management
  private moduleImages: Map<number, HTMLImageElement> = new Map();
  private moduleSpritesLoaded: boolean = false;

  // Custom module sprite URLs
  private static readonly MODULE_SPRITES = {
    1: "/sprites/modules/Engines.png", // Engine
    2: "/sprites/modules/1Cannon.png", // Weapon
    3: "/sprites/modules/Hull.png", // Hull
    4: "/sprites/modules/Shield.png", // Shield
  } as const;

  // Module slot types
  private static readonly ModuleSlotType = {
    ENGINES: 1,
    WEAPONS: 2,
    HULL: 3,
    SHIELD: 4,
  } as const;

  // Module limits per spaceship type
  private static readonly SPACESHIP_MODULE_LIMITS: {
    [spaceshipType: number]: {
      [key: number]: number;
    };
  } = {
    1: { 1: 1, 2: 1, 3: 1, 4: 1 }, // Scout
    2: { 1: 2, 2: 2, 3: 2, 4: 2 }, // Fighter
    3: { 1: 3, 2: 4, 3: 2, 4: 2 }, // Destroyer
    4: { 1: 4, 2: 2, 3: 4, 4: 4 }, // Carrier
  };

  HTMLImages: Record<number, HTMLImageElement> = {};
  private static components: ClientComponents | null = null;

  constructor(gl: GameGLManager) {
    this.renderer = gl.renderer;
    this.loadHTMLImages();
    this.loadSpaceshipSprites();
    this.loadModuleSprites();
    // this.loadNewHats();
  }

  static setComponents(components: ClientComponents): void {
    PlanetRenderManager.components = components;
  }

  static refreshComponents(components: ClientComponents): void {
    PlanetRenderManager.components = components;
  }

  // Get components from renderer context instead of static components
  private getComponents(): ClientComponents | null {
    // Try to get components from renderer context
    const rendererWithComponents = this.renderer as Renderer & {
      components?: ClientComponents;
    };
    if (rendererWithComponents?.components) {
      return rendererWithComponents.components;
    }
    // Fallback to static components
    return PlanetRenderManager.components;
  }

  loadHTMLImages(): void {
    const memeKeys = Object.keys(memes);
    const logoKeys = Object.keys(logos);
    const avatarKeys = Object.keys(avatars);

    {
      //set default image
      const img = new Image();
      img.src = logos[LogoType.DFARES].topLayer[0];

      img.onload = () => {
        this.HTMLImages[0] = img;
      };
    }

    for (let i = 0; i < memeKeys.length; ++i) {
      const memeKey = memeKeys[i];
      const meme = memes[Number(memeKey) as MemeType];
      const num = memeTypeToNum(Number(memeKey) as MemeType);

      const img = new Image();
      img.src = meme.topLayer[0];
      img.onload = () => {
        this.HTMLImages[num] = img;
      };
    }

    for (let i = 0; i < logoKeys.length; ++i) {
      const logoKey = logoKeys[i];
      const logo = logos[Number(logoKey) as LogoType];
      const num = logoTypeToNum(Number(logoKey) as LogoType);

      const img = new Image();
      img.src = logo.topLayer[0];
      img.onload = () => {
        this.HTMLImages[num] = img;
      };
    }

    for (let i = 0; i < avatarKeys.length; ++i) {
      const avatarKey = avatarKeys[i];
      const avatar = avatars[Number(avatarKey) as AvatarType];
      const num = avatarTypeToNum(Number(avatarKey) as AvatarType);
      const img = new Image();
      img.src = avatar.topLayer[0];
      img.onload = () => {
        this.HTMLImages[num] = img;
      };
    }
  }

  loadSpaceshipSprites(): void {
    for (const [spaceshipType, spriteUrl] of Object.entries(
      PlanetRenderManager.SPACESHIP_SPRITES,
    )) {
      const img = new Image();
      img.src = spriteUrl;
      img.onload = () => {
        this.spaceshipImages.set(Number(spaceshipType) as SpaceshipType, img);
        // Check if all sprites are loaded
        if (
          this.spaceshipImages.size ===
          Object.keys(PlanetRenderManager.SPACESHIP_SPRITES).length
        ) {
          this.spaceshipSpritesLoaded = true;
        }
      };
      img.onerror = () => {
        console.warn(`Failed to load spaceship sprite: ${spriteUrl}`);
      };
    }
  }

  loadModuleSprites(): void {
    for (const [moduleType, spriteUrl] of Object.entries(
      PlanetRenderManager.MODULE_SPRITES,
    )) {
      const img = new Image();
      img.src = spriteUrl;
      img.onload = () => {
        this.moduleImages.set(Number(moduleType), img);
        // Check if all sprites are loaded
        if (
          this.moduleImages.size ===
          Object.keys(PlanetRenderManager.MODULE_SPRITES).length
        ) {
          this.moduleSpritesLoaded = true;
        }
      };
      img.onerror = () => {
        console.warn(`Failed to load module sprite: ${spriteUrl}`);
      };
    }
  }

  // loadNewHats(): void {
  //   const keys = Object.keys(hats);
  //   // for (let i = 0; i < keys.length; ++i) {
  //   //   const key = keys[i];
  //   //   const hat = hats[key as HatType];
  //   //   hat.image &&
  //   //     hat.image().then((img) => {
  //   //       this.newHats[key as HatType] = img;
  //   //     });
  //   // }

  //   for (let i = 0; i < keys.length; ++i) {
  //     const key = keys[i];

  //     const hat = hats[Number(key) as HatType];
  //     if (!hat.legacy) {
  //       const img = new Image();
  //       img.src = hat.topLayer[0];
  //       img.onload = () => {
  //         this.newHats[Number(key) as HatType] = img;
  //       };
  //     }
  //   }
  // }

  queueLocation(
    renderInfo: PlanetRenderInfo,
    now: number,
    highPerfMode: boolean,
    disableEmojis: boolean,
    disableHats: boolean,
  ): void {
    const { context: uiManager, circleRenderer: cR } = this.renderer;
    const planet = renderInfo.planet;
    const renderAtReducedQuality =
      renderInfo.radii.radiusPixels <= 5 && highPerfMode;
    const isHovering =
      uiManager.getHoveringOverPlanet()?.locationId === planet.locationId;
    const isSelected =
      uiManager.getSelectedPlanet()?.locationId === planet.locationId;

    let textAlpha = 255;
    if (renderInfo.radii.radiusPixels < 2 * maxRadius) {
      // text alpha scales a bit faster
      textAlpha *= renderInfo.radii.radiusPixels / (2 * maxRadius);
    }

    const artifacts = uiManager
      .getArtifactsWithIds(planet.heldArtifactIds)
      .filter((a) => !!a) as Artifact[];
    const color = uiManager.isOwnedByMe(planet)
      ? whiteA
      : getOwnerColorVec(planet);

    // draw planet body
    this.queuePlanetBody(
      planet,
      planet.location.coords,
      renderInfo.radii.radiusWorld,
    );
    this.queueAsteroids(
      planet,
      planet.location.coords,
      renderInfo.radii.radiusWorld,
    );
    this.queueArtifactsAroundPlanet(
      planet,
      artifacts,
      planet.location.coords,
      renderInfo.radii.radiusWorld,
      now,
      textAlpha,
    );

    // Skip rings for SUN planets
    if (planet.planetType !== PlanetType.SUN) {
      this.queueRings(
        planet,
        planet.location.coords,
        renderInfo.radii.radiusWorld,
      );
    }

    // render black domain
    if (planet.destroyed) {
      this.queueBlackDomain(
        planet,
        planet.location.coords,
        renderInfo.radii.radiusWorld,
      );

      return;
    }

    // draw hp bar
    let cA = 1.0; // circle alpha
    if (renderInfo.radii.radiusPixels < 2 * maxRadius) {
      cA *= renderInfo.radii.radiusPixels / (2 * maxRadius);
    }

    if (hasOwner(planet)) {
      let ringOffset = 0;

      // Render silver ring (inside)
      if (planet.silver > 0 && planet.silverCap > 0) {
        const silverPct = Math.min(planet.silver / planet.silverCap, 1.0);
        const silverRadius =
          renderInfo.radii.radiusWorld * (1.1 - 0.01 * (ringOffset + 1));
        const silverColorHex = dfstyles.colors.dfyellow;
        const hexColor = silverColorHex.replace("#", "");
        const r = parseInt(hexColor.slice(0, 2), 16);
        const g = parseInt(hexColor.slice(2, 4), 16);
        const b = parseInt(hexColor.slice(4, 6), 16);

        // Base circle with lower alpha
        const silverColorBase: RGBAVec = [r, g, b, cA * 120];
        cR.queueCircleWorld(
          planet.location.coords,
          silverRadius,
          silverColorBase,
          0.5,
        );

        // Percentage circle with full alpha
        const silverColorFull: RGBAVec = [r, g, b, cA * 255];
        cR.queueCircleWorld(
          planet.location.coords,
          silverRadius,
          silverColorFull,
          2,
          silverPct,
        );

        ringOffset++;
      }

      // Render material rings (inside, before population)
      if (planet.materials && planet.materials.length > 0) {
        for (const material of planet.materials) {
          if (!material || material.materialAmount <= 0 || material.cap <= 0) {
            continue;
          }

          const materialColor = getMaterialColor(
            material.materialId as MaterialType,
          );
          // Convert hex color to RGB array (handle both #RRGGBB and #RRGGBBAA formats)
          const hexColor = materialColor.replace("#", "");
          const r = parseInt(hexColor.slice(0, 2), 16);
          const g = parseInt(hexColor.slice(2, 4), 16);
          const b = parseInt(hexColor.slice(4, 6), 16);

          const materialPct = Math.min(
            material.materialAmount / material.cap,
            1.0,
          );
          const materialRadius =
            renderInfo.radii.radiusWorld * (1.1 - 0.01 * (ringOffset + 1));

          // Base circle with lower alpha
          const materialColorBase: RGBAVec = [r, g, b, cA * 120];
          cR.queueCircleWorld(
            planet.location.coords,
            materialRadius,
            materialColorBase,
            0.5,
          );

          // Percentage circle with full alpha
          const materialColorFull: RGBAVec = [r, g, b, cA * 255];
          cR.queueCircleWorld(
            planet.location.coords,
            materialRadius,
            materialColorFull,
            2,
            materialPct,
          );

          ringOffset++;
        }
      }

      // Render population ring (outermost)
      color[3] = cA * 120;
      cR.queueCircleWorld(
        planet.location.coords,
        renderInfo.radii.radiusWorld * 1.1,
        color,
        0.5,
      );
      const pct = planet.population / planet.populationCap;
      color[3] = cA * 255;
      cR.queueCircleWorld(
        planet.location.coords,
        renderInfo.radii.radiusWorld * 1.1,
        color,
        2,
        pct,
      );
    }

    if (!disableHats && planet.canShow) {
      const activatedAvatar = artifacts.find(
        (a) =>
          a.artifactType === ArtifactType.Avatar &&
          a.lastActivated > a.lastDeactivated,
      );

      //MyTodo: change the limit for logoHat & memeHat

      if (activatedAvatar) {
        // artifact image
        this.queueArtifactImage(
          planet.location.coords,
          renderInfo.radii.radiusWorld * 2,
          activatedAvatar,
        );
      } else if (isMeme(planet.hatType)) {
        this.queueMemeImage(
          planet.location.coords,
          renderInfo.radii.radiusWorld * 2,
          planet.hatType as HatType,
          planet.hatLevel as number,
        );
      } else if (isLogo(planet.hatType)) {
        this.queueLogoImage(
          planet.location.coords,
          renderInfo.radii.radiusWorld * 2,
          planet.hatType as number,
          planet.hatLevel as number,
          planet.adminProtect as boolean,
        );
      } else if (isAvatar(planet.hatType)) {
        this.queueAvatarImage(
          planet.location.coords,
          renderInfo.radii.radiusWorld * 2,
          planet.hatType as HatType,
          planet.hatLevel as number,
        );
      } else {
        // normal hat
        this.queueHat(
          planet,
          planet.location.coords,
          renderInfo.radii.radiusWorld,
          planet.hatType,
          planet.hatLevel,
        );
      }
    }

    /* draw text */
    if (!renderAtReducedQuality) {
      this.queuePlanetPopulationText(
        planet,
        planet.location.coords,
        renderInfo.radii.radiusWorld,
        textAlpha,
      );

      this.queuePlanetSilverText(
        planet,
        planet.location.coords,
        renderInfo.radii.radiusWorld,
        textAlpha,
      );

      // this.queuePlanetMaterialsText(
      //   planet,
      //   planet.location.coords,
      //   renderInfo.radii.radiusWorld,
      //   textAlpha,
      // );

      this.queueArtifactIcon(
        planet,
        planet.location.coords,
        renderInfo.radii.radiusWorld,
      );

      if (!disableEmojis) {
        this.drawPlanetMessages(
          renderInfo,
          planet.location.coords,
          renderInfo.radii.radiusWorld,
          isHovering ? 0.2 : textAlpha,
        );
      }
    }

    if (isHovering && !isSelected && !planet.frozen) {
      this.queueRangeRings(planet);
    }

    //render Ice Link
    if (planet.frozen) {
      this.queueBlackDomain(
        planet,
        planet.location.coords,
        renderInfo.radii.radiusWorld,
      );
    }
  }

  private queueArtifactsAroundPlanet(
    planet: Planet,
    artifacts: Artifact[],
    centerW: WorldCoords,
    radiusW: number,
    now: number,
    alpha: number,
  ) {
    const numArtifacts = artifacts.length;

    const MS_PER_ROTATION = 10 * 1000 * (planet.planetLevel + 1);
    const anglePerArtifact = (Math.PI * 2) / numArtifacts;
    const startingAngle = 0 - Math.PI / 2;
    const nowAngle = (Math.PI * 2 * (now % MS_PER_ROTATION)) / MS_PER_ROTATION;
    const artifactSize = 0.67 * radiusW;
    const distanceRadiusScale = 1.5;
    const distanceFromCenterOfPlanet =
      radiusW * distanceRadiusScale + artifactSize;

    for (let i = 0; i < artifacts.length; i++) {
      const x =
        Math.cos(anglePerArtifact * i + startingAngle + nowAngle) *
          distanceFromCenterOfPlanet +
        centerW.x;
      const y =
        Math.sin(anglePerArtifact * i + startingAngle + nowAngle) *
          distanceFromCenterOfPlanet +
        centerW.y;
      if (
        artifacts[i].artifactType === ArtifactType.Avatar
        // && artifacts[i].lastActivated <= artifacts[i].lastDeactivated
      ) {
        //draw special hat
        const avatarType = artifactImageTypeToNum(artifacts[i].imageType);

        this.HTMLImages[avatarType] &&
          this.renderer.overlay2dRenderer.drawHTMLImage(
            this.HTMLImages[avatarType],
            { x, y },
            artifactSize * 1.2,
            artifactSize * 1.2,
            radiusW,
            false,
          );
      } else if (artifacts[i].artifactType === ArtifactType.Spaceship) {
        // Handle custom spaceship sprites using HTML images
        this.queueCustomSpaceshipSprite(
          artifacts[i],
          { x, y },
          artifactSize,
          alpha,
        );
      } else if (artifacts[i].artifactType === ArtifactType.SpaceshipModule) {
        // Handle custom module sprites using HTML images
        this.queueCustomModuleSprite(
          artifacts[i],
          { x, y },
          artifactSize,
          alpha,
        );
      } else if (artifacts[i].artifactType !== ArtifactType.Avatar) {
        this.renderer.spriteRenderer.queueArtifactWorld(
          artifacts[i],
          { x, y },
          artifactSize,
          alpha,
          undefined,
          undefined,
          undefined,
          this.renderer.getViewport(),
        );
      }
    }
  }

  public queueCustomSpaceshipSprite(
    artifact: Artifact,
    centerW: WorldCoords,
    radiusW: number,
    alpha: number,
    fromCoords?: WorldCoords,
    toCoords?: WorldCoords,
  ) {
    if (!this.spaceshipSpritesLoaded) {
      // Fallback to default sprite renderer
      this.renderer.spriteRenderer.queueArtifactWorld(
        artifact,
        centerW,
        radiusW,
        alpha,
        undefined,
        undefined,
        undefined,
        this.renderer.getViewport(),
      );
      return;
    }

    // Get spaceship type from CraftedSpaceship MUD table
    let spaceshipType: SpaceshipType | undefined;

    // First, try to use the spaceshipType from the artifact object (set by ArtifactUtils)
    if (artifact.spaceshipType !== undefined) {
      spaceshipType = artifact.spaceshipType as SpaceshipType;
    } else {
      // Fallback: lookup from MUD table
      const components = this.getComponents();
      if (components) {
        // Use the same approach as useCraftedSpaceship - direct map access
        // This works better than getComponentValue with encodeEntity for this use case
        const artifactId = Number(artifact.id);
        const spaceshipTypeMap =
          components.CraftedSpaceship?.values?.spaceshipType;

        if (spaceshipTypeMap) {
          // Find the correct key by iterating through all keys (same method as useCraftedSpaceship)
          for (const [key, value] of spaceshipTypeMap.entries()) {
            const keyString = key.toString();
            if (keyString.includes(artifactId.toString())) {
              spaceshipType = value as SpaceshipType;
              break;
            }
          }
        }
      }
    }

    // Fallback: If no CraftedSpaceship data exists, use default spaceship type
    if (!spaceshipType) {
      spaceshipType = SpaceshipType.Scout; // Default to Scout
    }
    const spaceshipImage = this.spaceshipImages.get(spaceshipType);
    if (!spaceshipImage) {
      // Fallback to default sprite renderer
      this.renderer.spriteRenderer.queueArtifactWorld(
        artifact,
        centerW,
        radiusW,
        alpha,
        undefined,
        undefined,
        undefined,
        this.renderer.getViewport(),
      );
      return;
    }

    // Calculate biome index for sprite selection (0-9)
    const biomeIndex = this.getBiomeIndex(artifact.planetBiome);

    // Calculate rotation based on movement direction
    let rotation = 0;
    if (fromCoords && toCoords) {
      const dx = toCoords.x - fromCoords.x;
      const dy = toCoords.y - fromCoords.y;
      // Calculate the angle from the movement direction
      // The spaceship sprite's default orientation points to the right (0 radians)
      // Note: Canvas Y-axis is inverted (positive Y goes down), so we need to flip dy
      rotation = Math.atan2(-dy, dx);
    }

    // Use HTML image renderer with biome-specific sprite clipping, rotation, and rarity effects
    this.renderer.overlay2dRenderer.drawHTMLImageWithRarityEffects(
      spaceshipImage,
      centerW,
      radiusW,
      radiusW,
      radiusW,
      false,
      biomeIndex * 64, // x offset for biome sprite (64px per sprite)
      0, // y offset (always 0 since it's a horizontal strip)
      64, // sprite width
      64, // sprite height
      rotation, // rotation in radians
      artifact.rarity, // artifact rarity for effects
      alpha, // alpha value for transparency
    );

    // Render module overlays on top of the spaceship
    this.renderModuleOverlays(
      artifact,
      spaceshipType,
      centerW,
      radiusW,
      rotation,
      alpha,
    );
  }

  /**
   * Get installed modules for a spaceship artifact (non-hook version for class methods)
   */
  private getInstalledModules(artifact: Artifact): Array<{
    moduleId: ArtifactId;
    moduleType: number;
    moduleSlotType: number;
  }> {
    const components = this.getComponents();

    const modules: Array<{
      moduleId: ArtifactId;
      moduleType: number;
      moduleSlotType: number;
    }> = [];

    // Convert artifact ID to number for comparison (same as useInstalledModules)
    const artifactIdStr = artifact.id.toString();
    // Remove 0x prefix if present, then parse as hex
    const cleanHex = artifactIdStr.startsWith("0x")
      ? artifactIdStr.slice(2)
      : artifactIdStr;
    const spaceshipIdNum = parseInt(cleanHex, 16);

    const installedMap = components.SpaceshipModuleInstalled.values.artifactId;
    const slotTypeMap =
      components.SpaceshipModuleInstalled.values.moduleSlotType;
    const installedFlagMap =
      components.SpaceshipModuleInstalled.values.installed;
    const moduleTypeMap = components.CraftedModules.values.moduleType;
    // Iterate through all entries in SpaceshipModuleInstalled
    for (const [moduleIdKey, storedSpaceshipId] of installedMap.entries()) {
      const installedFlag = installedFlagMap.get(moduleIdKey);
      const isInstalled = installedFlag === true;

      const sourceSpaceshipId =
        typeof storedSpaceshipId === "bigint"
          ? Number(storedSpaceshipId)
          : Number(storedSpaceshipId);

      const matchesSpaceship = sourceSpaceshipId === spaceshipIdNum;

      if (matchesSpaceship && isInstalled) {
        const keyString = moduleIdKey.toString();
        const hexMatch = keyString.match(/0x([0-9a-fA-F]+)/);
        if (hexMatch) {
          const hexValue = hexMatch[1];
          const slotType = slotTypeMap.get(moduleIdKey);
          if (hexValue && slotType !== undefined && Number(slotType) > 0) {
            const moduleIdStr = artifactIdFromHexStr("0x" + hexValue);
            const moduleIdNum = parseInt(moduleIdStr, 16);

            // Find module type from CraftedModules
            let moduleType: number | undefined;
            for (const [key, value] of moduleTypeMap.entries()) {
              const moduleKeyString = key.toString();
              const numericStr = moduleIdNum.toString();
              const hexStr = moduleIdNum.toString(16);
              if (
                moduleKeyString.includes(numericStr) ||
                moduleKeyString.includes(hexStr) ||
                moduleKeyString.includes(moduleIdStr)
              ) {
                moduleType = value as number;
                break;
              }
            }

            if (
              moduleType !== undefined &&
              moduleType >= 1 &&
              moduleType <= 4
            ) {
              modules.push({
                moduleId: moduleIdStr,
                moduleType: moduleType,
                moduleSlotType: Number(slotType),
              });
            }
          }
        }
      }
    }

    return modules;
  }

  /**
   * Calculate module overlay position (same logic as ArtifactImage)
   */
  private calculateModulePosition(
    size: number,
    spaceshipType: number,
    slotType: number,
    index: number,
  ): { top: number; left: number; width: number; height: number } {
    const moduleSize = size * 0.11; // Modules are 25% of spaceship size (reduced for better fit)
    const padding = size * 0.001; // 2% padding
    const horizontalOffset = size * 0.1; // Move all modules 10% to the right

    const limits =
      PlanetRenderManager.SPACESHIP_MODULE_LIMITS[spaceshipType] ||
      PlanetRenderManager.SPACESHIP_MODULE_LIMITS[1];
    const maxInSlot = limits[slotType] || 1;

    if (slotType === PlanetRenderManager.ModuleSlotType.ENGINES) {
      const totalHeight = maxInSlot * moduleSize + (maxInSlot - 1) * padding;
      const startTop = (size - totalHeight) / 2;
      const left = size * 0.15 + horizontalOffset; // Move from edge to 15% from left (closer to center) + offset
      const top = startTop + index * (moduleSize + padding);
      return { top, left, width: moduleSize, height: moduleSize };
    } else if (slotType === PlanetRenderManager.ModuleSlotType.WEAPONS) {
      const totalHeight = maxInSlot * moduleSize + (maxInSlot - 1) * padding;
      const startTop = (size - totalHeight) / 2;
      const left = size - moduleSize - size * 0.4 + horizontalOffset; // Move from edge to 40% from right (closer to center) + offset
      const top = startTop + index * (moduleSize + padding);
      return { top, left, width: moduleSize, height: moduleSize };
    } else if (
      slotType === PlanetRenderManager.ModuleSlotType.HULL ||
      slotType === PlanetRenderManager.ModuleSlotType.SHIELD
    ) {
      const gridCols = 2;
      const gridRows = Math.ceil(maxInSlot / gridCols);
      const gridCellSize = (size * 0.25) / gridCols; // Middle area is 30% of size
      const gridStartLeft = size * 0.25 + horizontalOffset; // Start at 25% from left + offset
      const gridStartTop = (size - gridRows * gridCellSize) / 2;

      const row = Math.floor(index / gridCols);
      const col = index % gridCols;
      const left =
        gridStartLeft + col * gridCellSize + (gridCellSize - moduleSize) / 2;
      const top =
        gridStartTop + row * gridCellSize + (gridCellSize - moduleSize) / 2;

      return { top, left, width: moduleSize, height: moduleSize };
    }

    return {
      top: (size - moduleSize) / 2,
      left: (size - moduleSize) / 2 + horizontalOffset,
      width: moduleSize,
      height: moduleSize,
    };
  }

  /**
   * Render module overlays on top of spaceship sprite in viewport
   */
  private renderModuleOverlays(
    artifact: Artifact,
    spaceshipType: SpaceshipType,
    centerW: WorldCoords,
    radiusW: number,
    rotation: number,
    alpha: number,
  ): void {
    const installedModules = this.getInstalledModules(artifact);
    if (installedModules.length === 0) {
      return;
    }

    // Group modules by slot type
    const modulesBySlot: {
      [slotType: number]: typeof installedModules;
    } = {};
    installedModules.forEach((module) => {
      if (!modulesBySlot[module.moduleSlotType]) {
        modulesBySlot[module.moduleSlotType] = [];
      }
      modulesBySlot[module.moduleSlotType].push(module);
    });

    const spaceshipTypeNum = Number(spaceshipType);
    const spriteSize = radiusW * 2; // Total sprite size in world coordinates

    // Render each module overlay
    Object.keys(modulesBySlot).forEach((slotTypeStr) => {
      const slotType = Number(slotTypeStr);
      const modulesInSlot = modulesBySlot[slotType];

      modulesInSlot.forEach((module, indexInSlot) => {
        const moduleImage = this.moduleImages.get(module.moduleType);
        if (!moduleImage) {
          console.log(
            "[PlanetRenderManager] Module image not found for type:",
            module.moduleType,
          );
          return;
        }

        // Calculate position relative to spaceship center
        // spriteSize is in world coordinates (radiusW * 2)
        const position = this.calculateModulePosition(
          spriteSize,
          spaceshipTypeNum,
          slotType,
          indexInSlot,
        );

        // Position is relative to top-left (0,0) of sprite, convert to center-relative offset
        // All values are already in world coordinates
        const offsetX = position.left + position.width / 2 - spriteSize / 2;
        const offsetY = position.top + position.height / 2 - spriteSize / 2;

        // Apply rotation to the offset (rotate around spaceship center)
        const cosR = Math.cos(rotation);
        const sinR = Math.sin(rotation);
        const rotatedOffsetX = offsetX * cosR - offsetY * sinR;
        const rotatedOffsetY = offsetX * sinR + offsetY * cosR;

        // Calculate final world position
        const moduleCenterW: WorldCoords = {
          x: centerW.x + rotatedOffsetX,
          y: centerW.y + rotatedOffsetY,
        };

        const moduleSizeW = position.width; // Already in world units

        // Get module artifact for rarity info (same as queueCustomModuleSprite)
        // Try to get artifact from renderer context
        const rendererContext = this.renderer.context as {
          getArtifactWithId?: (id: ArtifactId) => Artifact | undefined;
        };
        let moduleRarity = ArtifactRarity.Common; // Default rarity
        if (rendererContext?.getArtifactWithId) {
          const moduleArtifact = rendererContext.getArtifactWithId(
            module.moduleId,
          );
          if (moduleArtifact) {
            moduleRarity = moduleArtifact.rarity;
          }
        }

        // Modules are single images, not sprite sheets - use full image dimensions
        const imageWidth = moduleImage.width || moduleSizeW;
        const imageHeight = moduleImage.height || moduleSizeW;

        // Use drawHTMLImageWithRarityEffects to match artifactType 23 rendering
        this.renderer.overlay2dRenderer.drawHTMLImageWithRarityEffects(
          moduleImage,
          moduleCenterW,
          moduleSizeW,
          moduleSizeW,
          radiusW,
          false,
          0, // x offset (0 for single image, not sprite sheet)
          0, // y offset (0 for single image)
          imageWidth, // full image width
          imageHeight, // full image height
          rotation, // Apply same rotation as spaceship
          moduleRarity, // artifact rarity for effects
          alpha, // alpha value for transparency
        );
      });
    });
  }

  public queueCustomModuleSprite(
    artifact: Artifact,
    centerW: WorldCoords,
    radiusW: number,
    alpha: number,
    _fromCoords?: WorldCoords,
    _toCoords?: WorldCoords,
  ) {
    if (!this.moduleSpritesLoaded) {
      // Fallback to default sprite renderer
      this.renderer.spriteRenderer.queueArtifactWorld(
        artifact,
        centerW,
        radiusW,
        alpha,
        undefined,
        undefined,
        undefined,
        this.renderer.getViewport(),
      );
      return;
    }

    // Get module type from CraftedModules MUD table
    let moduleType: number | undefined;

    // First, try to use the moduleType from the artifact object (set by ArtifactUtils)
    if (artifact.moduleType !== undefined) {
      moduleType = artifact.moduleType;
    } else {
      // Fallback: lookup from MUD table
      const components = this.getComponents();
      if (components) {
        // Use the same approach as useCraftedModule - direct map access
        const artifactId = Number(artifact.id);
        const moduleTypeMap = components.CraftedModules?.values?.moduleType;

        if (moduleTypeMap) {
          // Find the correct key by iterating through all keys
          for (const [key, value] of moduleTypeMap.entries()) {
            const keyString = key.toString();
            if (keyString.includes(artifactId.toString())) {
              moduleType = value as number;
              break;
            }
          }
        }
      }
    }

    // Fallback: If no CraftedModules data exists, use default module type
    if (!moduleType || moduleType < 1 || moduleType > 4) {
      moduleType = 1; // Default to Engine
    }
    const moduleImage = this.moduleImages.get(moduleType);
    if (!moduleImage) {
      // Fallback to default sprite renderer
      this.renderer.spriteRenderer.queueArtifactWorld(
        artifact,
        centerW,
        radiusW,
        alpha,
        undefined,
        undefined,
        undefined,
        this.renderer.getViewport(),
      );
      return;
    }

    // Modules don't rotate like spaceships, so rotation is always 0
    const rotation = 0;

    // Modules are single images, not sprite sheets - use full image dimensions
    const imageWidth = moduleImage.width || 64;
    const imageHeight = moduleImage.height || 64;

    // Use HTML image renderer with full image (no sprite sheet clipping) and rarity effects
    this.renderer.overlay2dRenderer.drawHTMLImageWithRarityEffects(
      moduleImage,
      centerW,
      radiusW,
      radiusW,
      radiusW,
      false,
      0, // x offset (0 for single image, not sprite sheet)
      0, // y offset (0 for single image)
      imageWidth, // full image width
      imageHeight, // full image height
      rotation, // rotation in radians (0 for modules)
      artifact.rarity, // artifact rarity for effects
      alpha, // alpha value for transparency
    );
  }

  private getBiomeIndex(biome: Biome): number {
    // Map biome to sprite index (0-9)
    const biomeMap = {
      [Biome.OCEAN]: 0,
      [Biome.FOREST]: 1,
      [Biome.GRASSLAND]: 2,
      [Biome.TUNDRA]: 3,
      [Biome.SWAMP]: 4,
      [Biome.DESERT]: 5,
      [Biome.ICE]: 6,
      [Biome.WASTELAND]: 7,
      [Biome.LAVA]: 8,
      [Biome.CORRUPTED]: 9,
    };
    return biomeMap[biome] ?? 0; // Default to Ocean if biome not found
  }

  private drawPlanetMessages(
    renderInfo: PlanetRenderInfo,
    coords: WorldCoords,
    radiusW: number,
    textAlpha: number,
  ) {
    if (!renderInfo.planet.emoji) {
      return;
    }

    // if (!renderInfo.planet.messages) {
    //   return;
    // }

    const { overlay2dRenderer: cM } = this.renderer;

    cM.drawPlanetMessages(coords, radiusW, renderInfo, textAlpha);
  }

  private queueArtifactIcon(
    planet: Planet,
    { x, y }: WorldCoords,
    radius: number,
  ) {
    const { overlay2dRenderer: cM } = this.renderer;

    if (!isLocatable(planet)) {
      return;
    }
    const mineable = planet.planetType === PlanetType.RUINS;

    const iconLoc = { x: x - radius, y: y + radius };

    if (mineable && !planet.hasTriedFindingArtifact) {
      const viewport = this.renderer.getViewport();
      const screenRadius = viewport.worldToCanvasDist(radius);
      const scale = Math.min(1, screenRadius / 20);
      if (screenRadius > 4) {
        cM.drawArtifactIcon(iconLoc, scale);
      }
    }
  }

  private queuePlanetSilverText(
    planet: Planet,
    center: WorldCoords,
    radius: number,
    alpha: number,
  ) {
    const { textRenderer: tR } = this.renderer;
    const silver = planet ? Math.ceil(planet.silver) : 0;
    if (planet.silverGrowth > 0 || planet.silver > 0) {
      tR.queueTextWorld(
        formatNumber(silver),
        { x: center.x, y: center.y + 1.1 * radius + 0.75 },
        [...gold, alpha],
        0,
        TextAlign.Center,
        TextAnchor.Bottom,
      );
    }
  }

  private queuePlanetMaterialsText(
    planet: Planet,
    center: WorldCoords,
    radius: number,
    alpha: number,
  ) {
    const { textRenderer: tR } = this.renderer;

    if (!planet.materials || planet.materials.length === 0) {
      return;
    }

    let materialOffset = 0;
    for (const material of planet.materials) {
      if (!material || material.materialAmount <= 0) {
        continue;
      }

      const materialColor = getMaterialColor(
        material.materialId as MaterialType,
      );
      // Convert hex color to RGB array
      const r = parseInt(materialColor.slice(1, 3), 16);
      const g = parseInt(materialColor.slice(3, 5), 16);
      const b = parseInt(materialColor.slice(5, 7), 16);

      tR.queueTextWorld(
        formatNumber(material.materialAmount, 0),
        {
          x: center.x,
          y:
            center.y +
            1.1 * radius +
            (planet.silver > 0 ? 0.75 : 0) +
            materialOffset * 0.5,
        },
        [r, g, b, alpha],
        (planet.silver > 0 ? -1 : 0) - materialOffset,
        TextAlign.Center,
        TextAnchor.Bottom,
      );
      materialOffset++;
    }
  }

  // calculates population in that is queued to leave planet
  private getLockedPopulation(planet: Planet): number {
    let lockedPopulation = 0;
    for (const unconfirmedMove of planet.transactions?.getTransactions(
      isUnconfirmedMoveTx,
    ) ?? []) {
      lockedPopulation += unconfirmedMove.intent.forces;
    }

    return lockedPopulation;
  }

  // calculates attack value of mouse-drag action
  private getMouseAtk(): number | undefined {
    const { context } = this.renderer;

    const fromPlanet = context.getMouseDownPlanet();
    const toPlanet = context.getHoveringOverPlanet();

    if (!fromPlanet || !toPlanet) {
      return undefined;
    }

    let effectivePopulation = fromPlanet.population;
    for (const unconfirmedMove of fromPlanet.transactions?.getTransactions(
      isUnconfirmedMoveTx,
    ) ?? []) {
      effectivePopulation -= unconfirmedMove.intent.forces;
    }
    const shipsMoved =
      (context.getForcesSending(fromPlanet.locationId) / 100) *
      effectivePopulation;

    const myAtk: number = context.getEnergyArrivingForMove(
      fromPlanet.locationId,
      toPlanet.locationId,
      undefined,
      shipsMoved,
    );

    return myAtk;
  }

  private queueRings(planet: Planet, center: WorldCoords, radius: number) {
    const { ringRenderer } = this.renderer;
    let idx = 0;

    const { defense, range, speed } = engineConsts.colors.belt;

    for (let i = 0; i < planet.upgradeState[0]; i++) {
      ringRenderer.queueRingAtIdx(planet, center, radius, defense, idx++);
    }
    for (let i = 0; i < planet.upgradeState[1]; i++) {
      ringRenderer.queueRingAtIdx(planet, center, radius, range, idx++);
    }
    for (let i = 0; i < planet.upgradeState[2]; i++) {
      ringRenderer.queueRingAtIdx(planet, center, radius, speed, idx++);
    }
  }

  private queuePlanetBody(
    planet: Planet,
    centerW: WorldCoords,
    radiusW: number,
  ) {
    const {
      quasarRenderer: qR,
      sunRenderer: sR,
      planetRenderer: pR,
      spacetimeRipRenderer: spR,
      ruinsRenderer: rR,
      mineRenderer: mR,
    } = this.renderer;

    const { planetType } = planet;
    const planetTypeNum = Number(planetType);

    // Check SUN first (planetType 6) - must be before SILVER_BANK (5) check
    if (planetTypeNum === 6 || planetType === PlanetType.SUN) {
      if (sR) {
        sR.queueSun(planet, centerW, radiusW);
      } else {
        console.error("[PlanetRenderManager] sunRenderer is not available!");
      }
      return;
    }

    // Check other planet types
    if (planetTypeNum === 2 || planetType === PlanetType.SILVER_MINE) {
      mR.queueMine(planet, centerW, radiusW);
    } else if (planetTypeNum === 4 || planetType === PlanetType.TRADING_POST) {
      spR.queueRip(planet, centerW, radiusW);
    } else if (planetTypeNum === 5 || planetType === PlanetType.SILVER_BANK) {
      // QUASAR (SILVER_BANK = 5)
      qR.queueQuasar(planet, centerW, radiusW);
    } else if (planetTypeNum === 3 || planetType === PlanetType.RUINS) {
      rR.queueRuins(planet, centerW, radiusW);
    } else {
      // Default to regular planet renderer
      pR.queuePlanetBody(planet, centerW, radiusW);
    }
  }

  private queueBlackDomain(
    planet: Planet,
    center: WorldCoords,
    radius: number,
  ) {
    const { blackDomainRenderer: bR } = this.renderer;

    bR.queueBlackDomain(planet, center, radius);

    // cR.queueCircleWorld(center, radius * 1.2, [255, 192, 203, 160]);
  }

  private queueAsteroids(planet: Planet, center: WorldCoords, radius: number) {
    const { asteroidRenderer: aR } = this.renderer;

    const { bonus } = engineConsts.colors;

    if (planet.bonus[0]) {
      aR.queueAsteroid(planet, center, radius, bonus.populationCap);
    }
    if (planet.bonus[1]) {
      aR.queueAsteroid(planet, center, radius, bonus.populationGro);
    }
    if (planet.bonus[2]) {
      aR.queueAsteroid(planet, center, radius, bonus.range);
    }
    if (planet.bonus[3]) {
      aR.queueAsteroid(planet, center, radius, bonus.speed);
    }
    if (planet.bonus[4]) {
      aR.queueAsteroid(planet, center, radius, bonus.defense);
    }
    if (planet.bonus[5]) {
      aR.queueAsteroid(planet, center, radius, bonus.spaceJunk);
    }
  }

  queueHat(
    planet: Planet,
    center: WorldCoords,
    radius: number,
    hatType: number,
    hatLevel: number,
  ) {
    const { context } = this.renderer;
    const hoveringPlanet = context.getHoveringOverPlanet() !== undefined;
    const myRotation = 0;
    const cosmetic = getPlanetCosmetic(planet);

    //MyTodo: determine the size limit
    hatLevel = Math.min(hatLevel, 3);

    if (hatLevel > 0) {
      const hoverCoords = context.getHoveringOverCoords();

      let bg = cosmetic.bgStr;
      let base = cosmetic.baseStr;
      if (cosmetic.hatType === HatType.SantaHat) {
        bg = "red";
        base = "white";
      }

      const hatScale = 1.65 ** (hatLevel - 1);
      this.renderer.overlay2dRenderer.drawHat(
        hatType as number, // cosmetic.hatType,
        512,
        512,
        center,
        1.2 * radius * hatScale,
        1.2 * radius * hatScale,
        radius,
        myRotation,
        hoveringPlanet,
        bg,
        base,
        hoverCoords,
      );
    }
  }

  queueArtifactImage(center: WorldCoords, radius: number, artifact?: Artifact) {
    if (!artifact) {
      return;
    }
    const { context } = this.renderer;
    const hoveringPlanet = context.getHoveringOverPlanet() !== undefined;
    const hoverCoords = context.getHoveringOverCoords();

    // const avatarType = avatarFromArtifactIdAndImageType(artifact.id,
    // artifact.imageType, false);

    const imageType = artifactImageTypeToNum(artifact.imageType);

    //NOTE: artifact image

    const hatScale = 1;

    this.HTMLImages[imageType] &&
      this.renderer.overlay2dRenderer.drawHTMLImage(
        this.HTMLImages[imageType],
        center,
        // radius === 1 ? 2 : 1.2 * 1.3 ** (artifact.rarity - 1) * radius,
        // radius === 1 ? 2 : 1.2 * 1.3 ** (artifact.rarity - 1) * radius,
        // radius === 1 ? 1.5 : 1.3 ** (artifact.rarity - 1) * radius,
        radius * hatScale,
        radius * hatScale,
        radius * hatScale,
        hoveringPlanet,
        hoverCoords,
      );
  }

  queueMemeImage(
    center: WorldCoords,
    radius: number,
    hatType: HatType,
    hatLevel: number,
  ) {
    if (isMeme(hatType) === false) {
      return;
    }

    // MyTodo: determine the size limit
    hatLevel = Math.min(hatLevel, 1);

    const { context } = this.renderer;
    const hoveringPlanet = context.getHoveringOverPlanet() !== undefined;
    const hoverCoords = context.getHoveringOverCoords();
    const hatScale = 1.65 ** (hatLevel - 1);

    this.HTMLImages[hatType] &&
      this.renderer.overlay2dRenderer.drawHTMLImage(
        this.HTMLImages[hatType],
        center,
        // 1.2 * radius * hatScale,
        // 1.2 * radius * hatScale,
        radius * hatScale,
        radius * hatScale,
        radius,
        hoveringPlanet,
        hoverCoords,
      );
  }

  queueLogoImage(
    center: WorldCoords,
    radius: number,
    hatType: number,
    hatLevel: number,
    ifAdminSet: boolean,
  ) {
    if (isLogo(hatType) === false) {
      return;
    }

    //MyTodo: determine the size limit
    if (ifAdminSet === false) {
      hatLevel = Math.min(hatLevel, 1);
    }

    const { context } = this.renderer;
    const hoveringPlanet = context.getHoveringOverPlanet() !== undefined;
    const hoverCoords = context.getHoveringOverCoords();
    const hatScale = 1.65 ** (hatLevel - 1);

    this.HTMLImages[hatType] &&
      this.renderer.overlay2dRenderer.drawHTMLImage(
        this.HTMLImages[hatType],
        center,
        radius * hatScale,
        radius * hatScale,
        radius,
        hoveringPlanet,
        hoverCoords,
      );
  }

  queueAvatarImage(
    center: WorldCoords,
    radius: number,
    hatType: number,
    hatLevel: number,
  ) {
    if (isAvatar(hatType) === false) {
      return;
    }

    //MyTodo: determine the size limit
    hatLevel = Math.min(hatLevel, 1);

    const { context } = this.renderer;
    const hoveringPlanet = context.getHoveringOverPlanet() !== undefined;
    const hoverCoords = context.getHoveringOverCoords();
    const hatScale = 1.65 ** (hatLevel - 1);

    this.HTMLImages[hatType] &&
      this.renderer.overlay2dRenderer.drawHTMLImage(
        this.HTMLImages[hatType],
        center,
        // 1.2 * radius * hatScale,
        // 1.2 * radius * hatScale,
        radius * hatScale,
        radius * hatScale,
        radius,
        hoveringPlanet,
        hoverCoords,
      );
  }

  private queuePlanetPopulationText(
    planet: Planet,
    center: WorldCoords,
    radius: number,
    alpha: number,
  ) {
    const { context: uiManager, textRenderer: tR } = this.renderer;
    const population = planet ? Math.ceil(planet.population) : 0;
    const lockedPopulation = this.getLockedPopulation(planet);

    // construct base population string
    let populationString = population <= 0 ? "" : formatNumber(population);
    if (lockedPopulation > 0) {
      populationString += ` (-${formatNumber(lockedPopulation)})`;
    }

    const playerColor = hasOwner(planet) ? getOwnerColorVec(planet) : barbsA;
    const color = uiManager.isOwnedByMe(planet) ? whiteA : playerColor;
    color[3] = alpha;

    const textLoc: WorldCoords = {
      x: center.x,
      y: center.y - 1.22 * radius - 0.75,
    };

    tR.queueTextWorld(populationString, textLoc, color);

    // now display atk string
    const fromPlanet = uiManager.getMouseDownPlanet();
    const toPlanet = uiManager.getHoveringOverPlanet();

    const myAtk = this.getMouseAtk();

    const moveHereInProgress =
      myAtk &&
      fromPlanet?.locationId !== toPlanet?.locationId &&
      toPlanet?.locationId === planet.locationId &&
      !uiManager.getIsChoosingTargetPlanet();

    if (moveHereInProgress && myAtk && toPlanet) {
      let atkString = "";
      if (
        uiManager.isOwnedByMe(planet) ||
        uiManager.inSameGuildRightNow(uiManager.getAccount(), planet.owner) ||
        planet.population === 0
      ) {
        atkString += ` (+${formatNumber(myAtk)})`;
      } else {
        atkString += ` (-${formatNumber((myAtk * 100) / toPlanet.defense)})`;
      }

      tR.queueTextWorld(atkString, textLoc, color, 1);
      // if (planet.spaceJunk !== 0) {
      //   const spaceJunkString = `(+${planet.spaceJunk} junk)`;
      //   tR.queueTextWorld(
      //     spaceJunkString,
      //     { x: center.x, y: center.y - 1.1 * radius - 0.75 },
      //     color,
      //     2
      //   );
      // }
    }
  }

  /**
   * Renders rings around planet that show how far sending the given percentage of this planet's
   * population would be able to travel.
   */
  drawRangeAtPercent(
    planet: LocatablePlanet,
    pct: number,
    spaceshipRangeBoost = 1,
  ) {
    const { circleRenderer: cR, textRenderer: tR } = this.renderer;
    const range = getRange(planet, pct, spaceshipRangeBoost);
    const {
      range: { dash },
    } = engineConsts.colors;
    cR.queueCircleWorld(
      planet.location.coords,
      range,
      [...dash, 255],
      1,
      1,
      true,
    );
    tR.queueTextWorld(
      `${pct}%`,
      { x: planet.location.coords.x, y: planet.location.coords.y + range },
      [...dash, 255],
    );
  }

  /**
   * Renders three rings around the planet that show the player how far this planet can attack.
   */
  queueRangeRings(planet: LocatablePlanet) {
    const { circleRenderer: cR, context, textRenderer: tR } = this.renderer;
    const {
      range: { population },
    } = engineConsts.colors;
    const { x, y } = planet.location.coords;

    // Get spaceship range boost from UI manager
    const spaceshipRangeBoost = this.renderer.context.getSpaceshipRangeBoost(
      planet.locationId,
    );
    const abandonRangeBoost =
      this.renderer.context.getAbandonRangeChangePercent() / 100;

    if (!context.isAbandoning()) {
      this.drawRangeAtPercent(planet, 100, spaceshipRangeBoost);
      this.drawRangeAtPercent(planet, 50, spaceshipRangeBoost);
      this.drawRangeAtPercent(planet, 25, spaceshipRangeBoost);
    }

    if (planet.owner === EMPTY_ADDRESS) {
      return;
    }

    const percentForces = context.getForcesSending(planet.locationId); // [0, 100]
    const forces = (percentForces / 100) * planet.population;
    const scaledForces =
      (percentForces * planet.population) / planet.populationCap;
    const range = getRange(
      planet,
      scaledForces,
      context.isAbandoning() ? abandonRangeBoost : spaceshipRangeBoost,
    );

    if (range > 1) {
      cR.queueCircleWorld({ x, y }, range, [...population, 255], 1, 1, true);

      tR.queueTextWorld(
        `${formatNumber(forces)}`,
        { x, y: y + range },
        [...population, 255],
        0,
        TextAlign.Center,
        TextAnchor.Bottom,
      );
    }

    // so that it draws below the planets
    cR.flush();
  }

  queuePlanets(
    cachedPlanets: Map<LocationId, PlanetRenderInfo>,
    now: number,
    highPerfMode: boolean,
    disableEmojis: boolean,
    disableHats: boolean,
  ): void {
    for (const entry of cachedPlanets.entries()) {
      this.queueLocation(
        entry[1],
        now,
        highPerfMode,
        disableEmojis,
        disableHats,
      );
    }
  }

  flush() {
    const {
      planetRenderer,
      asteroidRenderer,
      beltRenderer,
      mineRenderer,
      quasarRenderer,
      sunRenderer,
      spacetimeRipRenderer,
      ruinsRenderer,
      ringRenderer,
      blackDomainRenderer,
      glManager: { gl },
    } = this.renderer;

    // we use depth testing here because it's super speedy for GPU sorting
    gl.enable(gl.DEPTH_TEST);
    planetRenderer.flush();
    asteroidRenderer.flush();
    beltRenderer.flush();
    mineRenderer.flush();
    spacetimeRipRenderer.flush();
    ruinsRenderer.flush();
    ringRenderer.flush();
    gl.disable(gl.DEPTH_TEST);

    // Flush quasar and sun renderers
    // Note: setUniforms is called automatically from within flush() by the child renderers
    quasarRenderer.flush();
    sunRenderer.flush();
    blackDomainRenderer.flush();
  }
}
