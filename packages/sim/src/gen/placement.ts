/**
 * 경로% 진행 필드 + 밴드 타일 질의 (§11-B) — 엔진 pathCostField 위에.
 *
 * 진행% = spawn(0) → goal(100): 플레이어가 시작점에서 목표까지 여정의 몇 %를 통과한 칸인가.
 * goal 기준 거리장(pathCostField)을 spawn까지 거리로 정규화 — 그래야 페이싱 커브의 90% 밴드(보스)가
 * goal 근처가 된다. (spec §3.3의 "0(goal)~100(최원거리)"를 spawn 정규화로 정밀화 — 보스 위치 정합.)
 */
import { pathCostField } from "@tk/engine";
import type { BattleContext, Coord } from "@tk/engine";

export type PercentField = Map<string, number>;

const key = (x: number, y: number) => `${x},${y}`;
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/**
 * goal 거리장을 spawn 기준 진행%로 변환. spawn 도달 불가/0거리면 빈 필드(생성기가 경계 처리).
 * 진행% = round((1 − cost/costSpawn) × 100), [0,100] 클램프. goal=100, spawn=0.
 */
export function pathPercentField(
  ctx: BattleContext,
  goal: Coord,
  spawn: Coord,
  moveClass: string,
): PercentField {
  const cost = pathCostField(ctx, goal, moveClass);
  const costSpawn = cost.get(key(spawn.x, spawn.y));
  const out: PercentField = new Map();
  if (!costSpawn || costSpawn <= 0) return out; // spawn 미도달 또는 spawn==goal
  for (const [k, c] of cost) {
    out.set(k, clamp(Math.round((1 - c / costSpawn) * 100), 0, 100));
  }
  return out;
}

/**
 * atPercent에 가까운 타일을 가까운 순으로(결정론 — 동률은 "x,y" 키 사전순). exclude된 키 제외.
 * 생성기가 이 순서로 적을 채운다(밴드 중심부터).
 */
export function tilesNearPercent(
  field: PercentField,
  atPercent: number,
  exclude: Set<string>,
): Coord[] {
  const entries: Array<{ k: string; coord: Coord; gap: number }> = [];
  for (const [k, pct] of field) {
    if (exclude.has(k)) continue;
    const [x, y] = k.split(",").map(Number) as [number, number];
    entries.push({ k, coord: { x, y }, gap: Math.abs(pct - atPercent) });
  }
  entries.sort((a, b) => (a.gap !== b.gap ? a.gap - b.gap : a.k < b.k ? -1 : a.k > b.k ? 1 : 0));
  return entries.map((e) => e.coord);
}
