import { EngineUtils } from "../EngineUtils";
import { SPRITE_PROGRAM_DEFINITION } from "../Programs/SpriteProgram";
import type { GameGLManager } from "../WebGL/GameGLManager";
import { GenericRenderer } from "../WebGL/GenericRenderer";

type IconKey = "weapon" | "hull" | "shield";

const ICON_URLS: Record<IconKey, string> = {
  weapon: "/sprites/modules/1Cannon.png",
  hull: "/sprites/modules/Hull.png",
  shield: "/sprites/modules/Shield.png",
};

export class ModuleIconRenderer extends GenericRenderer<
  typeof SPRITE_PROGRAM_DEFINITION,
  GameGLManager
> {
  private texIdxByKey: Map<IconKey, number>;
  private texturesByKey: Map<IconKey, WebGLTexture>;
  private posBuffer: number[];
  private texBuffer: number[];
  private rectposBuffer: number[];
  private loaded: Map<IconKey, boolean>;
  private allLoadedPromise: Promise<void> | null = null;
  private _pendingKey: IconKey[] = [];
  private _pendingTexKey: IconKey | undefined;
  private _pendingTexIdx: number | undefined;
  private _pendingTexture: WebGLTexture | undefined;

  constructor(manager: GameGLManager) {
    super(manager, SPRITE_PROGRAM_DEFINITION);
    this.texIdxByKey = new Map();
    this.texturesByKey = new Map();
    this.loaded = new Map();
    this.posBuffer = EngineUtils.makeEmptyQuadVec2();
    this.texBuffer = EngineUtils.makeEmptyQuadVec2();
    this.rectposBuffer = EngineUtils.makeQuadVec2(0, 0, 1, 1);
  }

  public async ensureLoaded(key: IconKey) {
    if (this.loaded.get(key)) return;
    const img = await this.loadImage(ICON_URLS[key]);
    const texIdx = this.manager.getTexIdx();
    this.uploadTexture(img, texIdx, key);
    this.texIdxByKey.set(key, texIdx);
    this.loaded.set(key, true);
  }

  public async ensureAllLoaded(): Promise<void> {
    if (!this.allLoadedPromise) {
      this.allLoadedPromise = Promise.all([
        this.ensureLoaded("weapon"),
        this.ensureLoaded("hull"),
        this.ensureLoaded("shield"),
      ]).then(() => {});
    }
    await this.allLoadedPromise;
  }

  public isLoaded(key: IconKey): boolean {
    return this.loaded.get(key) === true;
  }
  public isAllLoaded(): boolean {
    return (
      this.isLoaded("weapon") &&
      this.isLoaded("hull") &&
      this.isLoaded("shield")
    );
  }

  private loadImage(src: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = (e) => reject(e);
      img.src = encodeURI(src);
    });
  }

  private uploadTexture(
    img: HTMLImageElement,
    texIdx: number,
    key: IconKey,
  ): void {
    const { gl } = this.manager;
    gl.activeTexture(gl.TEXTURE0 + texIdx);
    const texture = gl.createTexture();
    if (!texture) {
      throw new Error(`Failed to create texture for ${key}`);
    }
    gl.bindTexture(gl.TEXTURE_2D, texture);
    EngineUtils.fillTexture(gl);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
    gl.generateMipmap(gl.TEXTURE_2D);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
    this.texturesByKey.set(key, texture);
  }

  public queueIconPx(
    key: IconKey,
    topLeftX: number,
    topLeftY: number,
    sizePx: number,
    rotationRad?: number,
    rarity?: number, // ArtifactRarity: 4 = Legendary, 5 = Mythic
  ) {
    const { position, texcoord, rectPos, color, shine, invert, mythic } =
      this.attribManagers;

    EngineUtils.makeQuadVec2Buffered(this.posBuffer, 0, 0, sizePx, sizePx);
    if (rotationRad !== undefined) {
      EngineUtils.translateQuadVec2(this.posBuffer, [-sizePx / 2, -sizePx / 2]);
      EngineUtils.rotateQuadVec2(this.posBuffer, rotationRad);
      EngineUtils.translateQuadVec2(this.posBuffer, [sizePx / 2, sizePx / 2]);
    }
    EngineUtils.translateQuadVec2(this.posBuffer, [topLeftX, topLeftY]);

    // full texture
    EngineUtils.makeQuadVec2Buffered(this.texBuffer, 0, 0, 1, 1);

    position.setVertex(this.posBuffer, this.verts);
    texcoord.setVertex(this.texBuffer, this.verts);
    rectPos.setVertex(this.rectposBuffer, this.verts);
    // Use [0, 0, 0, 255] to preserve original texture colors
    // The shader only replaces colors if RGB != 0, so [0,0,0] means "use texture as-is"
    const rgba: [number, number, number, number] = [0, 0, 0, 255];

    // Calculate effects based on rarity
    // Legendary (4): invert = 1, shine animation
    // Mythic (5): mythic = 1, stronger shine animation
    const isLegendary = rarity === 4;
    const isMythic = rarity === 5;
    const hasShine = isLegendary || isMythic;

    // Calculate animated shine value (same as SpriteRenderer)
    // Shine value should be in [0, 1] range, gets mapped to [-0.5, 11.5] in shader
    let shineValue = -1000; // Default: no shine
    if (hasShine) {
      const totalDur = 3; // 3 seconds animation cycle
      const totalFrames = totalDur * 60; // 180 frames at 60fps
      const nowFrame = Math.floor((EngineUtils.getNow() % totalDur) * 60);
      shineValue = nowFrame / totalFrames; // [0, 1]
    }
    const invertValue = isLegendary ? 1 : 0;
    const mythicValue = isMythic ? 1 : 0;

    for (let i = 0; i < 6; i++) {
      color.setVertex(rgba, this.verts + i);
      shine.setVertex([shineValue], this.verts + i);
      invert.setVertex([invertValue], this.verts + i);
      mythic.setVertex([mythicValue], this.verts + i);
    }
    if (!this._pendingKey) {
      this._pendingKey = [];
    }
    this._pendingKey.push(key);
    this.verts += 6;
  }

  public flush() {
    if (this.verts === 0) return;
    // Bind texture of the first pending batch (single texture per flush assumed here)
    const arr: IconKey[] = this._pendingKey || [];
    const key = arr.length ? arr[0] : "weapon";
    const texIdx = this.texIdxByKey.get(key);
    const texture = this.texturesByKey.get(key);

    if (texIdx === undefined || texture === undefined) {
      // Clear verts and return early if texture is missing
      this.verts = 0;
      this._pendingKey = [];
      return;
    }

    // Store texture info to bind after setUniforms() is called
    this._pendingTexKey = key;
    this._pendingTexIdx = texIdx;
    this._pendingTexture = texture;

    super.flush();

    // Clear pending data after flush
    this._pendingKey = [];
    this._pendingTexKey = undefined;
    this._pendingTexIdx = undefined;
    this._pendingTexture = undefined;
  }

  public setUniforms() {
    // Only set uniforms if we have pending texture data (set in flush())
    // This prevents errors when setUniforms() is called without a pending flush
    const key = this._pendingTexKey;
    const texIdx = this._pendingTexIdx;
    const texture = this._pendingTexture;

    if (!key || texIdx === undefined || texture === undefined) {
      return;
    }

    // Call parent to set matrix (program is already active from super.flush())
    this.uniformSetters.matrix(this.manager.projectionMatrix);

    // Bind texture AFTER program is activated (in super.flush())
    const { gl } = this.manager;
    // Activate texture unit and bind the texture
    gl.activeTexture(gl.TEXTURE0 + texIdx);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    // Set uniform to texture unit index
    this.uniformSetters.texture(texIdx);
  }
}
