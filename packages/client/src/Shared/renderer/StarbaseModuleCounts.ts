import type { ArtifactId } from "@df/types";

interface ModuleInfo {
  artifactId: ArtifactId;
  slotType: number; // 1=weapons, 3=hull, 4=shield
}

const countsMap: Map<
  string,
  { weapons: number; hull: number; shield: number }
> = new Map();

const modulesMap: Map<string, ModuleInfo[]> = new Map();

function normalizeId(id: string): string {
  let s = String(id);
  if (s.startsWith("0x") || s.startsWith("0X")) s = s.slice(2);
  s = s.toLowerCase();
  if (s.length < 64) s = s.padStart(64, "0");
  return s;
}

export function setStarbaseModuleCounts(
  starbaseId: string,
  weapons: number,
  hull: number,
  shield: number,
) {
  countsMap.set(normalizeId(starbaseId), { weapons, hull, shield });
}

export function getStarbaseModuleCounts(
  starbaseId: string,
): { weapons: number; hull: number; shield: number } | undefined {
  return countsMap.get(normalizeId(starbaseId));
}

export function setStarbaseModules(starbaseId: string, modules: ModuleInfo[]) {
  modulesMap.set(normalizeId(starbaseId), modules);
}

export function getStarbaseModules(
  starbaseId: string,
): ModuleInfo[] | undefined {
  return modulesMap.get(normalizeId(starbaseId));
}
