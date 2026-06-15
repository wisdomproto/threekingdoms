/**
 * 지형 맵 생성 디스패치 + 연결성 검증 (§11-C).
 * generateMap(archetype, params) → BattleMap + spawn/goal. 연결 불가면 throw(생성 단계에서
 * A의 IMPASSABLE 데이터버그 예방). 격자가 곧 텍스트라 renderAscii로 프리뷰.
 */
import { gameData } from "@tk/data";
import type { BattleMap } from "@tk/data";
import { pathCostField } from "@tk/engine";
import type { BattleContext, Coord } from "@tk/engine";
import { toBattleMap } from "./grid";
import { gateBreakthrough, pincerDefense, escapeCorridor, type ArchParams, type ArchOutput } from "./archetypes";

/** 표준 14지형 범례(기존 맵과 동일 코드). 생성 맵이 전 지형을 표현 가능. */
export const STANDARD_LEGEND: Record<string, string> = {
  ".": "plain", g: "grass", b: "bridge", w: "waste", v: "village", B: "barracks",
  d: "depot", f: "forest", m: "mountain", F: "fort", G: "gate", r: "river", "#": "wall", c: "cliff",
};

export type Archetype = "gateBreakthrough" | "pincerDefense" | "escapeCorridor";

const ARCHETYPES: Record<Archetype, (p: ArchParams) => ArchOutput> = {
  gateBreakthrough,
  pincerDefense,
  escapeCorridor,
};

export interface GeneratedMap {
  map: BattleMap;
  spawn: Coord;
  goal: Coord;
}

/** spawn→goal 도보 도달 가능 여부(pathCostField). 생성 맵 + gameData.terrains로 ctx 합성. */
function isConnected(map: BattleMap, spawn: Coord, goal: Coord): boolean {
  const ctx = { data: gameData, stage: { units: [] } as unknown, map } as BattleContext;
  const cost = pathCostField(ctx, goal, "foot");
  const r = cost.get(`${spawn.x},${spawn.y}`);
  return r !== undefined && Number.isFinite(r);
}

export function generateMap(archetype: Archetype, params: ArchParams, id?: string, name?: string): GeneratedMap {
  const out = ARCHETYPES[archetype](params);
  const map = toBattleMap(out.grid, STANDARD_LEGEND, id ?? `gen-${archetype}`, name ?? archetype);
  if (!isConnected(map, out.spawn, out.goal)) {
    throw new Error(
      `generateMap: ${archetype} — spawn(${out.spawn.x},${out.spawn.y})→goal(${out.goal.x},${out.goal.y}) 도달 불가(병목/통로 파라미터 확인)`,
    );
  }
  return { map, spawn: out.spawn, goal: out.goal };
}

/** 격자 텍스트 프리뷰(행=height). */
export function renderAscii(map: BattleMap): string {
  return map.tiles.join("\n");
}
