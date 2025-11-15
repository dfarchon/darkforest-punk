import type { Planet, SunRendererType, WorldCoords } from "@df/types";
import { RendererType } from "@df/types";

import { EngineUtils } from "../EngineUtils";
import type { Renderer } from "../Renderer";
import type { GameGLManager } from "../WebGL/GameGLManager";

export class SunRenderer implements SunRendererType {
  manager: GameGLManager;
  renderer: Renderer;

  rendererType = RendererType.Sun;

  constructor(manager: GameGLManager) {
    this.manager = manager;
    this.renderer = manager.renderer;
  }

  private getAngle(): number {
    return EngineUtils.getNow() * 0.6;
  }

  public queueSun(planet: Planet, centerW: WorldCoords, radiusW: number) {
    const { sunBodyRenderer } = this.renderer;
    // Sun rays removed - only render the body
    sunBodyRenderer.queueSunBody(planet, centerW, radiusW);
  }

  public flush() {
    // order matters!
    const { sunBodyRenderer } = this.renderer;
    sunBodyRenderer.flush();
  }

  public setUniforms() {
    const { sunBodyRenderer } = this.renderer;
    if (sunBodyRenderer.setUniforms) {
      sunBodyRenderer.setUniforms();
    }
  }
}
