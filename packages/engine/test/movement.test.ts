import { describe, it, expect } from "vitest";
import { gameData } from "@tk/data";
import { createBattle } from "../src/createBattle";
import { getMovableTiles, terrainAt, moveCostFor } from "../src/movement";
import { testCtx } from "./fixtures";

describe("이동 v2", () => {
  const state = createBattle(testCtx, 42);

  it("제자리 포함, 성벽(99) 제외, 점유 타일 정지 불가 — 기존 룰 유지", () => {
    const tiles = getMovableTiles(testCtx, state, "관우");
    expect(tiles).toContainEqual({ x: 1, y: 4 });
    for (const t of tiles) {
      expect(terrainAt(testCtx, t.x, t.y).id).not.toBe("wall");
      const occ = state.units.find((u) => u.id !== "관우" && !u.retreated && u.x === t.x && u.y === t.y);
      expect(occ).toBeUndefined();
    }
  });

  it("moveClass별 지형 비용: 기병 산지 3, 산적계 산지 1, 궁병 숲 3", () => {
    const mountain = gameData.terrains["mountain"]!;
    const forest = gameData.terrains["forest"]!;
    expect(moveCostFor(mountain, "cavalry")).toBe(3);
    expect(moveCostFor(mountain, "bandit")).toBe(1);
    expect(moveCostFor(mountain, "foot")).toBe(2);
    expect(moveCostFor(forest, "archerFoot")).toBe(3);
  });

  it("반환 순서 결정론 (y,x 정렬) 유지", () => {
    const a = getMovableTiles(testCtx, state, "관우");
    const b = getMovableTiles(testCtx, state, "관우");
    expect(a).toEqual(b);
  });
});
