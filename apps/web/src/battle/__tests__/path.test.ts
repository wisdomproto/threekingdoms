import { describe, expect, it } from "vitest";
import {
  createBattle,
  getMovableTiles,
  moveCostFor,
  terrainAt,
  unitAt,
  type BattleContext,
  type BattleState,
  type Coord,
} from "@tk/engine";
import { findPath } from "../path";
import { testCtx } from "./fixtures";

const SEED = 42;

/** 테스트 독립 검산용 다익스트라 — 엔진과 같은 규칙을 별도 구현해 비용 합을 교차 검증 */
function referenceDist(ctx: BattleContext, state: BattleState, unitId: string): Map<string, number> {
  const unit = state.units.find((u) => u.id === unitId)!;
  const dist = new Map<string, number>([[`${unit.x},${unit.y}`, 0]]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const [k, d] of [...dist]) {
      const [x, y] = k.split(",").map(Number) as [number, number];
      for (const [dx, dy] of [[0, -1], [0, 1], [-1, 0], [1, 0]] as const) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= ctx.map.width || ny >= ctx.map.height) continue;
        const occupant = unitAt(state, nx, ny);
        if (occupant && occupant.side !== unit.side) continue;
        const cost = moveCostFor(terrainAt(ctx, nx, ny), unit.moveClass);
        if (cost >= 99) continue;
        const next = d + cost;
        if (next > unit.move) continue;
        if (next < (dist.get(`${nx},${ny}`) ?? Infinity)) {
          dist.set(`${nx},${ny}`, next);
          changed = true;
        }
      }
    }
  }
  return dist;
}

function pathCost(ctx: BattleContext, path: Coord[], moveClass: string): number {
  // 첫 타일(시작 위치)은 진입 비용 없음
  return path.slice(1).reduce((sum, c) => sum + moveCostFor(terrainAt(ctx, c.x, c.y), moveClass), 0);
}

describe("findPath", () => {
  const state = createBattle(testCtx, SEED);
  const guanyu = state.units.find((u) => u.id === "관우")!; // lightCavalry, move 6, (1,4)

  it("직선 평지 경로: 비용 합 = 맨해튼 거리", () => {
    const path = findPath(testCtx, state, "관우", { x: 1, y: 2 });
    expect(path).toEqual([
      { x: 1, y: 4 },
      { x: 1, y: 3 },
      { x: 1, y: 2 },
    ]);
  });

  it("제자리 경로는 시작 타일 하나", () => {
    expect(findPath(testCtx, state, "관우", { x: 1, y: 4 })).toEqual([{ x: 1, y: 4 }]);
  });

  it("타이브레이크: 동일 비용 경로가 여럿이면 (y, x) 오름차순 — getMovableTiles 정렬 규칙과 일치", () => {
    // (1,4)→(3,2): 최소 비용 4의 L자 경로가 여럿. y가 작은 이웃 우선이므로 위로 먼저 꺾는 경로로 고정
    const path = findPath(testCtx, state, "관우", { x: 3, y: 2 });
    expect(path).toEqual([
      { x: 1, y: 4 },
      { x: 1, y: 3 },
      { x: 1, y: 2 },
      { x: 2, y: 2 },
      { x: 3, y: 2 },
    ]);
  });

  it("벽(이동 불가 지형)은 절대 통과하지 않는다", () => {
    // (3,1)은 성문. 윗줄(y=0)과 (0,1)·(7,1)은 벽 — 경로의 모든 타일은 통행 가능 지형이어야 한다
    const path = findPath(testCtx, state, "관우", { x: 3, y: 1 });
    expect(path).not.toBeNull();
    for (const c of path!) {
      const cost = moveCostFor(terrainAt(testCtx, c.x, c.y), guanyu.moveClass);
      expect(cost, `(${c.x},${c.y}) 벽 통과`).toBeLessThan(99);
      expect(c.y).toBeGreaterThan(0); // y=0 벽 행 미진입
    }
    // 동비용 선행 타일 (2,1)·(3,2) 중 타이브레이크 규칙(y 우선)으로 (2,1) 경유가 고정된다
    expect(path![path!.length - 2]).toEqual({ x: 2, y: 1 });
  });

  it("적 점유 타일로 막힌 곳은 도달 불가 → null", () => {
    // (6,1)의 이웃: (5,1)=화웅, (6,2)=이숙, (6,0)·(7,1)=벽 — 전부 막힘
    expect(findPath(testCtx, state, "관우", { x: 6, y: 1 })).toBeNull();
    expect(getMovableTiles(testCtx, state, "관우")).not.toContainEqual({ x: 6, y: 1 });
  });

  it("이동력 밖 타일은 null", () => {
    expect(findPath(testCtx, state, "관우", { x: 7, y: 5 })).toBeNull(); // 비용 8 > move 6
  });

  it("퇴각/미존재 유닛은 null", () => {
    expect(findPath(testCtx, state, "없는장수", { x: 1, y: 3 })).toBeNull();
  });

  it("속성: getMovableTiles의 모든 타일에 대해 유효한 최소 비용 경로를 반환한다", () => {
    const ref = referenceDist(testCtx, state, "관우");
    const tiles = getMovableTiles(testCtx, state, "관우");
    expect(tiles.length).toBeGreaterThan(10);
    for (const to of tiles) {
      const path = findPath(testCtx, state, "관우", to);
      expect(path, `(${to.x},${to.y}) 경로 없음`).not.toBeNull();
      // 시작·끝 일치
      expect(path![0]).toEqual({ x: guanyu.x, y: guanyu.y });
      expect(path![path!.length - 1]).toEqual(to);
      // 모든 스텝이 4방 인접
      for (let i = 1; i < path!.length; i++) {
        const a = path![i - 1]!, b = path![i]!;
        expect(Math.abs(a.x - b.x) + Math.abs(a.y - b.y)).toBe(1);
      }
      // 적 점유 타일 미통과
      for (const c of path!.slice(1)) {
        const occupant = unitAt(state, c.x, c.y);
        expect(occupant?.side === "enemy", `(${c.x},${c.y}) 적 통과`).toBe(false);
      }
      // 비용 합 = 독립 검산 다익스트라의 최소 비용 (엔진 이동 비용과 동률)
      expect(pathCost(testCtx, path!, guanyu.moveClass)).toBe(ref.get(`${to.x},${to.y}`));
      // 이동력 한도 내
      expect(pathCost(testCtx, path!, guanyu.moveClass)).toBeLessThanOrEqual(guanyu.move);
    }
  });

  it("보병(footman)도 동일 속성 만족 — moveClass별 비용 차이 반영", () => {
    const ref = referenceDist(testCtx, state, "유비");
    const liubei = state.units.find((u) => u.id === "유비")!;
    for (const to of getMovableTiles(testCtx, state, "유비")) {
      const path = findPath(testCtx, state, "유비", to);
      expect(path).not.toBeNull();
      expect(pathCost(testCtx, path!, liubei.moveClass)).toBe(ref.get(`${to.x},${to.y}`));
    }
  });

  it("결정론: 같은 입력에 항상 같은 경로", () => {
    const a = findPath(testCtx, state, "관우", { x: 3, y: 2 });
    const b = findPath(testCtx, state, "관우", { x: 3, y: 2 });
    expect(a).toEqual(b);
  });
});
