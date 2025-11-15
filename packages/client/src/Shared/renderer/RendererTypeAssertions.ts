import type {
  AsteroidRendererType,
  BackgroundRendererType,
  BaseRenderer,
  BeltRendererType,
  BlackDomainRendererType,
  BlueZoneRendererType,
  CaptureZoneRendererType,
  CircleRendererType,
  LineRendererType,
  LinkRendererType,
  MineBodyRendererType,
  MineRendererType,
  PerlinRendererType,
  PinkZoneRendererType,
  AIZoneRendererType,
  PlanetRendererType,
  PlanetRenderManagerType,
  QuasarBodyRendererType,
  QuasarRayRendererType,
  QuasarRendererType,
  RectRendererType,
  SunBodyRendererType,
  SunRayRendererType,
  SunRendererType,
  RingRendererType,
  RuinsRendererType,
  SpaceRendererType,
  SpacetimeRipRendererType,
  SpriteRendererType,
  TextRendererType,
  UIRendererType,
  UnminedRendererType,
  VoyageRendererType,
} from "@df/types";
import { RendererType } from "@df/types";

export function isPlanetRenderer(
  renderer: BaseRenderer,
): renderer is PlanetRendererType {
  return renderer.rendererType === RendererType.Planet;
}

export function isMineRenderer(
  renderer: BaseRenderer,
): renderer is MineRendererType {
  return renderer.rendererType === RendererType.Mine;
}

export function isSpacetimeRipRenderer(
  renderer: BaseRenderer,
): renderer is SpacetimeRipRendererType {
  return renderer.rendererType === RendererType.SpacetimeRip;
}

export function isQuasarRenderer(
  renderer: BaseRenderer,
): renderer is QuasarRendererType {
  return renderer.rendererType === RendererType.Quasar;
}

export function isRuinsRenderer(
  renderer: BaseRenderer,
): renderer is RuinsRendererType {
  return renderer.rendererType === RendererType.Ruins;
}

export function isAsteroidRenderer(
  renderer: BaseRenderer,
): renderer is AsteroidRendererType {
  return renderer.rendererType === RendererType.Asteroid;
}

export function isRingRenderer(
  renderer: BaseRenderer,
): renderer is RingRendererType {
  return renderer.rendererType === RendererType.Ring;
}

export function isSpriteRenderer(
  renderer: BaseRenderer,
): renderer is SpriteRendererType {
  return renderer.rendererType === RendererType.Sprite;
}

export function isBlackDomainRenderer(
  renderer: BaseRenderer,
): renderer is BlackDomainRendererType {
  return renderer.rendererType === RendererType.BlackDomain;
}

export function isTextRenderer(
  renderer: BaseRenderer,
): renderer is TextRendererType {
  return renderer.rendererType === RendererType.Text;
}

export function isVoyageRenderer(
  renderer: BaseRenderer,
): renderer is VoyageRendererType {
  return renderer.rendererType === RendererType.Voyager;
}

export function isLinkRenderer(
  renderer: BaseRenderer,
): renderer is LinkRendererType {
  return renderer.rendererType === RendererType.Link;
}

export function isMineBodyRenderer(
  renderer: BaseRenderer,
): renderer is MineBodyRendererType {
  return renderer.rendererType === RendererType.MineBody;
}

export function isBeltRenderer(
  renderer: BaseRenderer,
): renderer is BeltRendererType {
  return renderer.rendererType === RendererType.Belt;
}

export function isBackgroundRenderer(
  renderer: BaseRenderer,
): renderer is BackgroundRendererType {
  return renderer.rendererType === RendererType.Background;
}

export function isSpaceRenderer(
  renderer: BaseRenderer,
): renderer is SpaceRendererType {
  return renderer.rendererType === RendererType.Space;
}

export function isUnminedRenderer(
  renderer: BaseRenderer,
): renderer is UnminedRendererType {
  return renderer.rendererType === RendererType.Unmined;
}

export function isPerlinRenderer(
  renderer: BaseRenderer,
): renderer is PerlinRendererType {
  return renderer.rendererType === RendererType.Perlin;
}

export function isLineRenderer(
  renderer: BaseRenderer,
): renderer is LineRendererType {
  return renderer.rendererType === RendererType.Line;
}

export function isRectRenderer(
  renderer: BaseRenderer,
): renderer is RectRendererType {
  return renderer.rendererType === RendererType.Rect;
}

export function isCircleRenderer(
  renderer: BaseRenderer,
): renderer is CircleRendererType {
  return renderer.rendererType === RendererType.Circle;
}

export function isUIRendererManager(
  renderer: BaseRenderer,
): renderer is UIRendererType {
  return renderer.rendererType === RendererType.UI;
}

export function isPlanetRendererManager(
  renderer: BaseRenderer,
): renderer is PlanetRenderManagerType {
  return renderer.rendererType === RendererType.PlanetManager;
}

export function isQuasarBodyRenderer(
  renderer: BaseRenderer,
): renderer is QuasarBodyRendererType {
  return renderer.rendererType === RendererType.QuasarBody;
}

export function isQuasarRayRenderer(
  renderer: BaseRenderer,
): renderer is QuasarRayRendererType {
  return renderer.rendererType === RendererType.QuasarRay;
}

export function isCaptureZoneRenderer(
  renderer: BaseRenderer,
): renderer is CaptureZoneRendererType {
  return renderer.rendererType === RendererType.CaptureZone;
}

export function isPinkZoneRenderer(
  renderer: BaseRenderer,
): renderer is PinkZoneRendererType {
  return renderer.rendererType === RendererType.PinkZone;
}

export function isBlueZoneRenderer(
  renderer: BaseRenderer,
): renderer is BlueZoneRendererType {
  return renderer.rendererType === RendererType.BlueZone;
}

export function isAIZoneRenderer(
  renderer: BaseRenderer,
): renderer is AIZoneRendererType {
  return renderer.rendererType === RendererType.AIZone;
}

export function isSunRenderer(
  renderer: BaseRenderer,
): renderer is SunRendererType {
  return renderer.rendererType === RendererType.Sun;
}

export function isSunBodyRenderer(
  renderer: BaseRenderer,
): renderer is SunBodyRendererType {
  return renderer.rendererType === RendererType.SunBody;
}

export function isSunRayRenderer(
  renderer: BaseRenderer,
): renderer is SunRayRendererType {
  return renderer.rendererType === RendererType.SunRay;
}
