import type { Planet, StarbaseRendererType, WorldCoords } from "@df/types";
import { RendererType } from "@df/types";

import { EngineUtils } from "../EngineUtils";
import { STARBASE_PROGRAM_DEFINITION } from "../Programs/StarbaseProgram";
import {
  getStarbaseModuleCounts,
  getStarbaseModules,
} from "../StarbaseModuleCounts";
import type { GameGLManager } from "../WebGL/GameGLManager";
import { GenericRenderer } from "../WebGL/GenericRenderer";
import { ModuleIconRenderer } from "./ModuleIconRenderer";

// Phase 1: Default starbase type configuration
interface StarbaseTypeConfig {
  backgroundColor: [number, number, number];
  ringColor: [number, number, number];
  weaponColor: [number, number, number];
  shieldColor: [number, number, number];
  coreColor: [number, number, number];
}

export class StarbaseRenderer
  extends GenericRenderer<typeof STARBASE_PROGRAM_DEFINITION, GameGLManager>
  implements StarbaseRendererType
{
  quad3Buffer: number[];
  quad2Buffer: number[];

  rendererType = RendererType.Starbase;

  private _weaponsCount = 0;
  private _hullCount = 0;
  private _shieldCount = 0;
  private iconRenderer: ModuleIconRenderer;

  constructor(manager: GameGLManager) {
    super(manager, STARBASE_PROGRAM_DEFINITION);

    this.quad3Buffer = EngineUtils.makeEmptyQuad();
    this.quad2Buffer = EngineUtils.makeQuadVec2(-1, -1, 1, 1);
    this.iconRenderer = new ModuleIconRenderer(manager);
    // Preload icons in background
    void this.iconRenderer.ensureAllLoaded();
  }

  public setUniforms() {
    const time = EngineUtils.getNow();
    this.uniformSetters.matrix(this.manager.projectionMatrix);
    this.uniformSetters.time(time);
    // Rotation speeds: inner ring counter-clockwise, outer ring clockwise (counter-rotation)
    // Using radians per second - adjust these values to control rotation speed
    // Higher values = faster rotation
    this.uniformSetters.innerRotation(20.0); // Counter-clockwise speed (positive) - weapons rotate
    this.uniformSetters.outerRotation(-60); // Clockwise speed (will be negated in shader) - counter-rotating outer ring
    // Module counts - still set to keep uniforms alive (prevent shader optimization)
    // Even though we don't use them for shader drawing anymore (only sprite icons)
    this.uniformSetters.weaponsCount(this._weaponsCount);
    const outerTotal = this._hullCount + this._shieldCount;
    this.uniformSetters.hullShieldCount(outerTotal);
  }

  public flush() {
    if (this.verts === 0) {
      return;
    }
    super.flush();
  }

  private getStarbaseTypeConfig(): StarbaseTypeConfig {
    // Phase 1: Only Default starbase type
    return {
      backgroundColor: [51, 51, 77], // Dark gray-blue (0.2, 0.2, 0.3)
      ringColor: [128, 128, 153], // Gray ring (0.5, 0.5, 0.6)
      weaponColor: [204, 51, 51], // Red/orange (0.8, 0.2, 0.2)
      shieldColor: [51, 102, 204], // Blue/cyan (0.2, 0.4, 0.8)
      coreColor: [230, 230, 230], // White/gray (0.9, 0.9, 0.9)
    };
  }

  private queueLayer(
    center: { x: number; y: number },
    radius: number,
    z: number,
    layer: number,
    color: [number, number, number],
    rotation: number = 0,
  ) {
    const {
      position,
      rectPos,
      color: colorAttrib,
      layer: layerAttrib,
      rotation: rotationAttrib,
    } = this.attribManagers;

    const x1 = center.x - radius;
    const y1 = center.y - radius;
    const x2 = center.x + radius;
    const y2 = center.y + radius;

    EngineUtils.makeQuadBuffered(this.quad3Buffer, x1, y1, x2, y2, z);
    position.setVertex(this.quad3Buffer, this.verts);
    rectPos.setVertex(this.quad2Buffer, this.verts);

    // Push color, layer, and rotation for all 6 vertices
    for (let i = 0; i < 6; i++) {
      colorAttrib.setVertex(color, this.verts + i);
      layerAttrib.setVertex([layer], this.verts + i);
      rotationAttrib.setVertex([rotation], this.verts + i);
    }

    this.verts += 6;
  }

  public queueStarbase(
    planet: Planet,
    centerW: WorldCoords,
    radiusW: number,
  ): void {
    // Flush any previously batched starbases so uniforms apply per-starbase
    if (this.verts > 0) this.flush();

    const center = this.manager.renderer
      .getViewport()
      .worldToCanvasCoords(centerW);
    const radius = this.manager.renderer
      .getViewport()
      .worldToCanvasDist(radiusW);

    const z = EngineUtils.getPlanetZIndex(planet);
    const config = this.getStarbaseTypeConfig();

    // Load current counts from shared state
    const counts = getStarbaseModuleCounts(
      planet.locationId as unknown as string,
    );
    this._weaponsCount = counts?.weapons ?? 0;
    this._hullCount = counts?.hull ?? 0;
    this._shieldCount = counts?.shield ?? 0;

    // Layer 0: Visible background area (between inner and outer rings)
    this.queueLayer(center, radius, z - 0.0001, 0, config.backgroundColor);

    // Layer 1: Outer ring - Gray border only (blue circles removed)
    this.queueLayer(center, radius, z - 0.00008, 1, config.ringColor, -1.0);

    // Layer 2: Inner ring structure (red triangles removed)

    // Layer 3: Inner ring structure (thin ring at boundary)
    this.queueLayer(center, radius, z + 0.00005, 3, config.ringColor);

    // Layer 4: Central core - Concentric circles
    this.queueLayer(center, radius, z + 0.0001, 4, config.coreColor, 0.0);
    this.queueLayer(center, radius, z + 0.00011, 4, config.ringColor, 1.0);
    this.queueLayer(center, radius, z + 0.00012, 4, config.coreColor, 2.0);
    this.queueLayer(center, radius, z + 0.00013, 4, config.ringColor, 3.0);

    // Draw base
    this.flush();

    // Icon overlay (sprite) based on installed counts
    if (!this.iconRenderer.isAllLoaded()) {
      return;
    }

    const iconSizePx = Math.max(8, Math.min(24, radius * 0.2));
    const weaponSizePx = Math.max(14, Math.min(32, radius * 0.28));
    // Match shader rotation so icons track rings
    const timeSeconds = EngineUtils.getNow() * 0.001;
    const innerRotationSpeed = 20.0; // must match setUniforms
    const outerRotationSpeed = -60.0; // must match setUniforms

    // Get installed modules to look up artifact rarities
    const modules = getStarbaseModules(planet.locationId as unknown as string);
    const context = this.manager.renderer?.context;

    // Helper to get rarity for a module by slot type and index
    const getRarityForModule = (
      slotType: number,
      index: number,
    ): number | undefined => {
      if (!modules || !context) return undefined;
      const matchingModules = modules.filter((m) => m.slotType === slotType);
      if (index >= matchingModules.length) return undefined;
      const artifact = context.getArtifactWithId(
        matchingModules[index].artifactId,
      );
      return artifact?.rarity as number | undefined;
    };

    // Weapons icons (rotated 180 degrees)
    for (let i = 0; i < this._weaponsCount && i < 4; i++) {
      const base = (i * Math.PI) / 2 + Math.PI; // Add 180 degrees
      const ang = base + timeSeconds * innerRotationSpeed;
      const px = center.x + Math.cos(ang) * radius * 0.5;
      const py = center.y + Math.sin(ang) * radius * 0.5;
      const rarity = getRarityForModule(1, i); // slotType 1 = weapons
      this.iconRenderer.queueIconPx(
        "weapon",
        px - weaponSizePx / 2,
        py - weaponSizePx / 2,
        weaponSizePx,
        base, // keep icon orientation fixed, rotated 180 degrees
        rarity,
      );
    }
    this.iconRenderer.flush();

    // Hull icons (draw first on outer ring, rotated 180 degrees)
    for (let i = 0; i < this._hullCount && i < 8; i++) {
      const base = (i * Math.PI) / 4 + Math.PI; // Add 180 degrees
      const ang = base + timeSeconds * outerRotationSpeed;
      const px = center.x + Math.cos(ang) * radius * 0.75;
      const py = center.y + Math.sin(ang) * radius * 0.75;
      const rarity = getRarityForModule(3, i); // slotType 3 = hull
      this.iconRenderer.queueIconPx(
        "hull",
        px - iconSizePx / 2,
        py - iconSizePx / 2,
        iconSizePx,
        base, // Rotate icon 180 degrees
        rarity,
      );
    }

    this.iconRenderer.flush();

    // Shield icons (continue around ring after hull icons, rotated 180 degrees)
    for (let j = 0; j < this._shieldCount && j < 8; j++) {
      const idx = this._hullCount + j;
      const base = (idx * Math.PI) / 4 + Math.PI; // Add 180 degrees
      const ang = base + timeSeconds * outerRotationSpeed;
      const px = center.x + Math.cos(ang) * radius * 0.75;
      const py = center.y + Math.sin(ang) * radius * 0.75;
      const rarity = getRarityForModule(4, j); // slotType 4 = shield
      this.iconRenderer.queueIconPx(
        "shield",
        px - iconSizePx / 2,
        py - iconSizePx / 2,
        iconSizePx,
        base, // Rotate icon 180 degrees
        rarity,
      );
    }

    this.iconRenderer.flush();
  }
}
