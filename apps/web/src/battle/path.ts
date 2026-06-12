/**
 * 이동 연출용 경로 재계산 (설계 §2.2 path).
 * 엔진 export `moveCostFor`/`terrainAt`/`unitAt`를 그대로 재사용해 규칙 이중 구현을 피하고,
 * 도달 비용 계산은 엔진 getMovableTiles와 동일한 다익스트라 — 같은 reachable 집합을 산출한다.
 * 타이브레이크는 getMovableTiles의 반환 정렬 규칙(y 우선, x 차선 오름차순)과 일치시켜 결정론 유지.
 *
 * 장기 제안(설계 §6): 엔진 unitMoved 이벤트에 path 필드가 추가되면 이 파일은 제거.
 */
import { moveCostFor, terrainAt, unitAt } from "@tk/engine";
import type { BattleContext, BattleState, Coord } from "@tk/engine";

const IMPASSABLE = 99;
const NEIGHBORS = [
  [0, -1],
  [0, 1],
  [-1, 0],
  [1, 0],
] as const;

const key = (x: number, y: number) => `${x},${y}`;

/**
 * 엔진 getMovableTiles와 동일 규칙의 최소 비용 맵.
 * 적 점유 타일 통과 불가, 아군 점유 타일 통과 가능, 이동력 초과 가지치기.
 */
function buildDistMap(
  ctx: BattleContext,
  state: BattleState,
  unit: { x: number; y: number; side: string; moveClass: string; move: number },
): Map<string, number> {
  const { width, height } = ctx.map;
  const dist = new Map<string, number>();
  dist.set(key(unit.x, unit.y), 0);
  const frontier: Array<{ x: number; y: number; cost: number }> = [
    { x: unit.x, y: unit.y, cost: 0 },
  ];

  while (frontier.length > 0) {
    frontier.sort((a, b) => a.cost - b.cost);
    const cur = frontier.shift()!;
    if (cur.cost > (dist.get(key(cur.x, cur.y)) ?? Infinity)) continue;
    for (const [dx, dy] of NEIGHBORS) {
      const nx = cur.x + dx;
      const ny = cur.y + dy;
      if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
      const occupant = unitAt(state, nx, ny);
      if (occupant && occupant.side !== unit.side) continue; // 적은 통과 불가
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
  return dist;
}

/**
 * unitId의 현재 위치에서 to까지의 최소 비용 경로 (시작 타일 포함, 도착 타일 포함).
 * to가 이동 범위 밖이거나 도달 불능이면 null.
 * 동일 비용 경로가 여럿이면 역추적 시 (y, x) 오름차순으로 작은 이웃을 선택 — 결정론 보장.
 */
export function findPath(
  ctx: BattleContext,
  state: BattleState,
  unitId: string,
  to: Coord,
): Coord[] | null {
  const unit = state.units.find((u) => u.id === unitId);
  if (!unit || unit.retreated) return null;
  if (to.x === unit.x && to.y === unit.y) return [{ x: unit.x, y: unit.y }];

  const dist = buildDistMap(ctx, state, unit);
  if (!dist.has(key(to.x, to.y))) return null;

  // 역추적: dist[n] + 진입비용(cur) === dist[cur] 인 이웃 중 (y, x) 최소를 선택
  const path: Coord[] = [{ x: to.x, y: to.y }];
  let cur: Coord = to;
  let guard = 0;
  while (!(cur.x === unit.x && cur.y === unit.y)) {
    if (++guard > ctx.map.width * ctx.map.height) {
      throw new Error(`findPath: 역추적 루프 한도 초과 (${unitId} → ${to.x},${to.y})`);
    }
    const enterCost = moveCostFor(terrainAt(ctx, cur.x, cur.y), unit.moveClass);
    const dCur = dist.get(key(cur.x, cur.y))!;
    let best: Coord | null = null;
    for (const [dx, dy] of NEIGHBORS) {
      const nx = cur.x + dx;
      const ny = cur.y + dy;
      const dn = dist.get(key(nx, ny));
      if (dn === undefined) continue;
      if (dn + enterCost !== dCur) continue;
      if (!best || ny < best.y || (ny === best.y && nx < best.x)) best = { x: nx, y: ny };
    }
    if (!best) return null; // dist 맵이 올바르면 도달 불가 — 방어적 처리
    path.push(best);
    cur = best;
  }
  return path.reverse();
}
