/**
 * 아키타입 + 맵 생성/연결성 검증(§11-C) 테스트.
 */
import { describe, it, expect } from "vitest";
import { gameData } from "@tk/data";
import { pathCostField } from "@tk/engine";
import { gateBreakthrough, pincerDefense, escapeCorridor } from "../../../src/gen/terrain/archetypes";
import { generateMap, renderAscii, STANDARD_LEGEND } from "../../../src/gen/terrain/mapGen";

function reachable(map: ReturnType<typeof generateMap>): boolean {
  const ctx = { data: gameData, stage: { units: [] } as never, map: map.map };
  const cost = pathCostField(ctx, map.goal, "foot");
  const r = cost.get(`${map.spawn.x},${map.spawn.y}`);
  return r !== undefined && Number.isFinite(r);
}

describe("아키타입 — 치수·핵심 피처·결정론", () => {
  it("gateBreakthrough: 성문(G) 셀이 존재하고 spawn 좌·goal 우", () => {
    const { grid, spawn, goal } = gateBreakthrough({ width: 30, height: 16, seed: 1, chokeWidth: 3 });
    expect(grid.cells.flat().filter((c) => c === "G").length).toBe(3); // 게이트 폭
    expect(grid.cells.flat().includes("#")).toBe(true); // 벽 존재
    expect(spawn.x).toBeLessThan(goal.x);
  });

  it("pincerDefense: 중앙이 개방(엄폐 없음), spawn=중앙", () => {
    const { grid, spawn } = pincerDefense({ width: 30, height: 16, seed: 2, coverDensity: 0.3 });
    expect(spawn.x).toBe(15);
    expect(grid.cells[spawn.y]![spawn.x]).not.toBe("f"); // 중앙 비엄폐
  });

  it("escapeCorridor: 절벽으로 막힌 격자에 통로(.)가 carve됨", () => {
    const { grid } = escapeCorridor({ width: 30, height: 16, seed: 3, corridorWidth: 3 });
    expect(grid.cells.flat().filter((c) => c === "c").length).toBeGreaterThan(0); // 절벽 벽
    expect(grid.cells.flat().filter((c) => c === ".").length).toBeGreaterThan(0); // 통로
  });

  it("같은 시드면 동일 격자(결정론)", () => {
    const a = gateBreakthrough({ width: 24, height: 14, seed: 9, chokeWidth: 4 });
    const b = gateBreakthrough({ width: 24, height: 14, seed: 9, chokeWidth: 4 });
    expect(a.grid.cells).toEqual(b.grid.cells);
  });
});

describe("generateMap — 조립 + 연결성 검증", () => {
  it("3 아키타입 모두 spawn→goal 연결 + BattleMap 스키마 정합", () => {
    for (const arch of ["gateBreakthrough", "pincerDefense", "escapeCorridor"] as const) {
      const gen = generateMap(arch, { width: 30, height: 16, seed: 5, chokeWidth: 3, coverDensity: 0.12, corridorWidth: 3 });
      expect(gen.map.tiles.length).toBe(16);
      expect(gen.map.tiles.every((r) => r.length === 30)).toBe(true);
      expect(reachable(gen)).toBe(true); // 연결성
    }
  });

  it("성문 폭 0이면 도달 불가 → throw(생성 단계 차단)", () => {
    expect(() =>
      generateMap("gateBreakthrough", { width: 20, height: 12, seed: 1, chokeWidth: 0 }),
    ).toThrow();
  });

  it("renderAscii는 height행 텍스트", () => {
    const gen = generateMap("pincerDefense", { width: 20, height: 10, seed: 1, coverDensity: 0.1 });
    expect(renderAscii(gen.map).split("\n").length).toBe(10);
  });

  it("STANDARD_LEGEND이 사용 타일코드를 포함", () => {
    expect(STANDARD_LEGEND["#"]).toBe("wall");
    expect(STANDARD_LEGEND["G"]).toBe("gate");
    expect(STANDARD_LEGEND["c"]).toBe("cliff");
  });
});
