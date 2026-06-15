/**
 * 경로% 진행 필드 + 밴드 타일 질의(§11-B) 테스트.
 * 진행% = spawn(0) → goal(100). boss 밴드(90%)가 goal 근처가 되도록 spawn 정규화.
 */
import { describe, it, expect } from "vitest";
import { gameData, stages } from "@tk/data";
import type { BattleContext } from "@tk/engine";
import { pathPercentField, tilesNearPercent } from "../../src/gen/placement";

function ctxFor(stageId: string): BattleContext {
  const stage = stages[stageId]!;
  return { data: gameData, stage, map: gameData.maps[stage.mapId]! };
}

const GOAL = { x: 2, y: 14 }; // 사수관 화웅 위치(적 본대)
const SPAWN = { x: 50, y: 15 }; // 사수관 아군 시작

describe("pathPercentField", () => {
  const ctx = ctxFor("05-sishuiguan");
  const field = pathPercentField(ctx, GOAL, SPAWN, "foot");

  it("goal 타일 진행%는 100(여정 끝)", () => {
    expect(field.get(`${GOAL.x},${GOAL.y}`)).toBe(100);
  });

  it("spawn 타일 진행%는 0(여정 시작)", () => {
    expect(field.get(`${SPAWN.x},${SPAWN.y}`)).toBe(0);
  });

  it("모든 값이 [0,100]", () => {
    for (const v of field.values()) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(100);
    }
  });

  it("goal 근처 타일이 spawn 근처 타일보다 진행%가 높다", () => {
    const nearGoal = field.get(`4,14`);
    const nearSpawn = field.get(`48,15`);
    expect(nearGoal).toBeGreaterThan(nearSpawn!);
  });
});

describe("tilesNearPercent", () => {
  const ctx = ctxFor("05-sishuiguan");
  const field = pathPercentField(ctx, GOAL, SPAWN, "foot");

  it("atPercent에 가까운 타일부터 정렬 반환", () => {
    const tiles = tilesNearPercent(field, 50, new Set());
    expect(tiles.length).toBeGreaterThan(0);
    const pctOf = (c: { x: number; y: number }) => field.get(`${c.x},${c.y}`)!;
    // 첫 타일이 50%에 가장 근접
    const firstGap = Math.abs(pctOf(tiles[0]!) - 50);
    const lastGap = Math.abs(pctOf(tiles[tiles.length - 1]!) - 50);
    expect(firstGap).toBeLessThanOrEqual(lastGap);
  });

  it("exclude된 타일은 제외", () => {
    const all = tilesNearPercent(field, 50, new Set());
    const ex = new Set([`${all[0]!.x},${all[0]!.y}`]);
    const filtered = tilesNearPercent(field, 50, ex);
    expect(filtered.some((c) => `${c.x},${c.y}` === `${all[0]!.x},${all[0]!.y}`)).toBe(false);
  });

  it("결정론 — 같은 입력 같은 순서", () => {
    const a = tilesNearPercent(field, 40, new Set());
    const b = tilesNearPercent(field, 40, new Set());
    expect(a).toEqual(b);
  });
});
