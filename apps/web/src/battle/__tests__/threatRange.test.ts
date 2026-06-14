/**
 * threatTiles 단위 테스트 (Tier 1-3 위협범위).
 *
 * 계약:
 *  - 위협 = ⋃_{발판 ∈ 이동도달∪현위치} 사거리 도넛(rangeMin~rangeMax 맨해튼).
 *  - 근접(사거리1): 발판 ∪ 그 4이웃. 발판 자신은 "이동 후 제자리 공격 대상이 아님"이지만
 *    다른 발판의 사거리에 들어와 대부분 포함된다 — 여기선 **공격 가능 칸이 위협에 포함**되는지만 본다.
 *  - 간접공격(궁병 rangeMin>1): 현위치 인접 근접 칸은 위협에서 빠진다(도넛 안쪽 사각).
 *  - 엔진 getMovableTiles·getAttackableTargets와 교차검증: 실제로 도달 가능한 발판에서
 *    실제로 공격 가능한 타깃 칸이 전부 위협 집합에 들어있다.
 *  - 퇴각/미존재 유닛은 빈 배열.
 *
 * 합성 testCtx(8×6)를 쓴다 — 작은 맵이라 위협 집합을 직접 셈할 수 있다.
 */
import { describe, expect, it } from "vitest";
import {
  createBattle,
  distance,
  getAttackableTargets,
  getMovableTiles,
} from "@tk/engine";
import type { BattleState, Coord } from "@tk/engine";
import { threatTiles } from "../threatRange";
import { testCtx } from "./fixtures";
import { findUnit, withUnit } from "./fixtures";

const ctx = testCtx;
const SEED = 7;

const k = (c: Coord): string => `${c.x},${c.y}`;
function asSet(tiles: Coord[]): Set<string> {
  return new Set(tiles.map(k));
}

describe("threatTiles", () => {
  it("미존재/퇴각 유닛은 빈 배열", () => {
    const s = createBattle(ctx, SEED);
    expect(threatTiles(ctx, s, "없는유닛")).toEqual([]);
    const retreated: BattleState = withUnit(s, "화웅", { retreated: true });
    expect(threatTiles(ctx, retreated, "화웅")).toEqual([]);
  });

  it("이동 0·근접 사거리: 현위치 4이웃만 위협 (제자리 도넛)", () => {
    const s0 = createBattle(ctx, SEED);
    // 화웅을 이동 0으로 고정, 사거리 1 보장 → 위협 = 상하좌우 4칸(맵 안)
    const s = withUnit(s0, "화웅", { move: 0, rangeMin: 1, rangeMax: 1 });
    const u = findUnit(s, "화웅");
    const got = asSet(threatTiles(ctx, s, "화웅"));

    const expected: Coord[] = [
      { x: u.x - 1, y: u.y },
      { x: u.x + 1, y: u.y },
      { x: u.x, y: u.y - 1 },
      { x: u.x, y: u.y + 1 },
    ].filter((c) => c.x >= 0 && c.y >= 0 && c.x < ctx.map.width && c.y < ctx.map.height);

    for (const c of expected) expect(got.has(k(c))).toBe(true);
    // 현위치 자신은 사거리 도넛(거리1)에 안 들어감 → 위협 아님
    expect(got.has(k({ x: u.x, y: u.y }))).toBe(false);
  });

  it("이동 가능 적의 위협 = 모든 발판에서 공격 가능한 칸을 포함 (엔진 교차검증)", () => {
    const s = createBattle(ctx, SEED);
    const threat = asSet(threatTiles(ctx, s, "화웅"));
    const stands = getMovableTiles(ctx, s, "화웅");

    // 각 발판에서 화웅을 옮긴 가상 상태로 getAttackableTargets → 그 타깃 칸이 위협에 있어야 한다
    for (const stand of stands) {
      const moved = withUnit(s, "화웅", { x: stand.x, y: stand.y });
      const targetIds = getAttackableTargets(ctx, moved, "화웅", stand);
      for (const tid of targetIds) {
        const t = findUnit(moved, tid);
        expect(threat.has(k({ x: t.x, y: t.y }))).toBe(true);
      }
    }
  });

  it("간접공격(궁병): 현위치 인접 근접 칸은 위협에서 제외 (도넛 안쪽)", () => {
    const s0 = createBattle(ctx, SEED);
    // 이숙(궁병)을 이동 0·사거리 2~2로 고정 → 거리1 칸은 사각, 거리2 칸만 위협
    const s = withUnit(s0, "이숙", { move: 0, rangeMin: 2, rangeMax: 2 });
    const u = findUnit(s, "이숙");
    const got = asSet(threatTiles(ctx, s, "이숙"));

    // 거리1 인접 칸 — 위협 아님
    for (const c of [
      { x: u.x - 1, y: u.y },
      { x: u.x + 1, y: u.y },
      { x: u.x, y: u.y - 1 },
      { x: u.x, y: u.y + 1 },
    ]) {
      if (c.x < 0 || c.y < 0 || c.x >= ctx.map.width || c.y >= ctx.map.height) continue;
      expect(got.has(k(c))).toBe(false);
    }
    // 모든 위협 칸은 정확히 거리 2 (이동 0이므로)
    for (const c of got) {
      const [x, y] = c.split(",").map(Number) as [number, number];
      expect(distance({ x: u.x, y: u.y }, { x, y })).toBe(2);
    }
  });

  it("결과는 좌표 정렬 + 중복 없음 (결정론)", () => {
    const s = createBattle(ctx, SEED);
    const tiles = threatTiles(ctx, s, "화웅");
    // 중복 없음
    expect(new Set(tiles.map(k)).size).toBe(tiles.length);
    // 정렬(y 우선, x 차선)
    const sorted = [...tiles].sort((a, b) => (a.y !== b.y ? a.y - b.y : a.x - b.x));
    expect(tiles).toEqual(sorted);
  });
});
