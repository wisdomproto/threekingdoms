import type { Terrain } from "@tk/data";
import type { BattleContext, BattleState, Coord, UnitState } from "./types";

export function terrainAt(ctx: BattleContext, x: number, y: number): Terrain {
  const row = ctx.stage.map.tiles[y];
  if (row === undefined) throw new Error(`y out of range: ${y}`);
  const ch = row[x];
  if (ch === undefined) throw new Error(`x out of range: ${x}`);
  const tid = ctx.stage.map.tileLegend[ch];
  if (tid === undefined) throw new Error(`no legend entry for tile '${ch}' at (${x},${y})`);
  const terrain = ctx.data.terrains[tid];
  if (!terrain) throw new Error(`unknown terrain id '${tid}' for tile '${ch}' at (${x},${y})`);
  return terrain;
}

export function moveCostFor(terrain: Terrain, classId: string): number {
  return terrain.moveCost[classId] ?? terrain.moveCost.default;
}

export function unitAt(state: BattleState, x: number, y: number): UnitState | undefined {
  return state.units.find((u) => !u.retreated && u.x === x && u.y === y);
}

const IMPASSABLE = 99;

/**
 * 다익스트라. 적 점유 타일은 통과 불가, 아군 점유 타일은 통과 가능·정지 불가.
 * moved/acted 가드는 호출자(applyAction)의 책임 — 이 함수는 위치·지형·이동력만 본다.
 */
export function getMovableTiles(ctx: BattleContext, state: BattleState, unitId: string): Coord[] {
  const unit = state.units.find((u) => u.id === unitId);
  if (!unit || unit.retreated) return [];
  const { width, height } = ctx.stage.map;

  const dist = new Map<string, number>();
  const key = (x: number, y: number) => `${x},${y}`;
  dist.set(key(unit.x, unit.y), 0);
  // 이동력이 한 자릿수라 우선순위 큐 없이 단순 배열로 충분 (맵 12×12)
  const frontier: Array<{ x: number; y: number; cost: number }> = [{ x: unit.x, y: unit.y, cost: 0 }];

  while (frontier.length > 0) {
    frontier.sort((a, b) => a.cost - b.cost);
    const cur = frontier.shift()!;
    if (cur.cost > (dist.get(key(cur.x, cur.y)) ?? Infinity)) continue;
    for (const [dx, dy] of [[0, -1], [0, 1], [-1, 0], [1, 0]] as const) {
      const nx = cur.x + dx, ny = cur.y + dy;
      if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
      const occupant = unitAt(state, nx, ny);
      if (occupant && occupant.side !== unit.side) continue; // 적은 통과 불가
      const cost = moveCostFor(terrainAt(ctx, nx, ny), unit.classId);
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
