import type { MoveClass, Terrain } from "@tk/data";
import type { BattleContext, BattleState, Coord, UnitState } from "./types";
import { areFoes } from "./types";

export function terrainAt(ctx: BattleContext, x: number, y: number): Terrain {
  const row = ctx.map.tiles[y];
  if (row === undefined) throw new Error(`y out of range: ${y}`);
  const ch = row[x];
  if (ch === undefined) throw new Error(`x out of range: ${x}`);
  const tid = ctx.map.tileLegend[ch];
  if (tid === undefined) throw new Error(`no legend entry for tile '${ch}' at (${x},${y})`);
  const terrain = ctx.data.terrains[tid];
  if (!terrain) throw new Error(`unknown terrain id '${tid}' for tile '${ch}' at (${x},${y})`);
  return terrain;
}

export function moveCostFor(terrain: Terrain, moveClass: MoveClass | string): number {
  return terrain.moveCost[moveClass] ?? terrain.moveCost.default;
}

export function unitAt(state: BattleState, x: number, y: number): UnitState | undefined {
  return state.units.find((u) => !u.retreated && u.x === x && u.y === y);
}

const IMPASSABLE = 99;

/**
 * 다익스트라. **적대 진영(camp 다름)** 점유 타일은 통과 불가,
 * 같은 진영(아군·우군) 점유 타일은 통과 가능·정지 불가.
 * moved/acted 가드는 호출자(applyAction)의 책임 — 이 함수는 위치·지형·이동력만 본다.
 */
export function getMovableTiles(ctx: BattleContext, state: BattleState, unitId: string): Coord[] {
  const unit = state.units.find((u) => u.id === unitId);
  if (!unit || unit.retreated) return [];
  const { width, height } = ctx.map;

  const dist = new Map<string, number>();
  const key = (x: number, y: number) => `${x},${y}`;
  dist.set(key(unit.x, unit.y), 0);
  // 이동력이 한 자릿수라 우선순위 큐 없이 단순 배열로 충분
  const frontier: Array<{ x: number; y: number; cost: number }> = [{ x: unit.x, y: unit.y, cost: 0 }];

  while (frontier.length > 0) {
    frontier.sort((a, b) => a.cost - b.cost);
    const cur = frontier.shift()!;
    if (cur.cost > (dist.get(key(cur.x, cur.y)) ?? Infinity)) continue;
    for (const [dx, dy] of [[0, -1], [0, 1], [-1, 0], [1, 0]] as const) {
      const nx = cur.x + dx, ny = cur.y + dy;
      if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
      const occupant = unitAt(state, nx, ny);
      if (occupant && areFoes(occupant.side, unit.side)) continue; // 적대 진영은 통과 불가
      const cost = moveCostFor(terrainAt(ctx, nx, ny), unit.moveClass);
      if (cost >= IMPASSABLE) continue;
      const next = cur.cost + cost;
      if (next > unit.move) continue;
      if (next < (dist.get(key(nx, ny)) ?? Infinity)) {
        dist.set(key(nx, ny), next);
        frontier.push({ x: nx, y: ny, cost: next });
      }
    }
  }

  const result: Coord[] = [];
  for (const k of dist.keys()) {
    const [x, y] = k.split(",").map(Number) as [number, number];
    const occupant = unitAt(state, x, y);
    if (occupant && occupant.id !== unit.id) continue; // 점유 타일에 정지 불가
    result.push({ x, y });
  }
  // 좌표 정렬로 반환 순서를 플랫폼/입력 무관하게 고정 — 시뮬 결정론의 전제
  result.sort((a, b) => (a.y !== b.y ? a.y - b.y : a.x - b.x));
  return result;
}

/**
 * goal 칸으로부터의 **지형비용 최단거리 장(field)**. 이동력·유닛 점유 무시(전역),
 * 통행 불가(IMPASSABLE) 지형만 막는다. moveClass별 이동비용을 쓴다.
 *
 * 용도: 그리디 라우팅(탈출/점령 목표)이 맨해튼 거리만 쓰면 강·협곡 같은 통행불가
 * 지형에 막혀 다리를 우회하지 못하고 정체(제자리 wait)한다. 이 장으로 "다리를 건너는
 * 우회가 실제로는 목표에 가까워지는 길"임을 인식시킨다. 반환: key "x,y" → 비용(도달 가능
 * 칸만). 도달 불가 칸은 미포함(호출자는 Infinity로 간주).
 */
export function pathCostField(
  ctx: BattleContext, goal: Coord, moveClass: MoveClass | string,
): Map<string, number> {
  const { width, height } = ctx.map;
  const key = (x: number, y: number) => `${x},${y}`;
  const dist = new Map<string, number>();
  const goalCost = moveCostFor(terrainAt(ctx, goal.x, goal.y), moveClass);
  if (goalCost >= IMPASSABLE) return dist; // 목표 칸 자체가 통행 불가면 라우팅 불가
  dist.set(key(goal.x, goal.y), 0);
  const frontier: Array<{ x: number; y: number; cost: number }> = [{ x: goal.x, y: goal.y, cost: 0 }];
  while (frontier.length > 0) {
    frontier.sort((a, b) => a.cost - b.cost);
    const cur = frontier.shift()!;
    if (cur.cost > (dist.get(key(cur.x, cur.y)) ?? Infinity)) continue;
    for (const [dx, dy] of [[0, -1], [0, 1], [-1, 0], [1, 0]] as const) {
      const nx = cur.x + dx, ny = cur.y + dy;
      if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
      // 진입 비용 = 들어가려는 칸(nx,ny)의 지형비용 (getMovableTiles와 동일 규약)
      const cost = moveCostFor(terrainAt(ctx, nx, ny), moveClass);
      if (cost >= IMPASSABLE) continue;
      const next = cur.cost + cost;
      if (next < (dist.get(key(nx, ny)) ?? Infinity)) {
        dist.set(key(nx, ny), next);
        frontier.push({ x: nx, y: ny, cost: next });
      }
    }
  }
  return dist;
}
