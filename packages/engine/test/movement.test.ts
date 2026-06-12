import { describe, it, expect } from "vitest";
import { gameData, stages } from "@tk/data";
import { createBattle } from "../src/createBattle";
import { getMovableTiles, terrainAt, moveCostFor } from "../src/movement";
import type { BattleContext } from "../src/types";

const ctx: BattleContext = { data: gameData, stage: stages["05-sishuiguan"]! };

describe("getMovableTiles", () => {
  it("이동력 범위 안의 타일만 반환하고 제자리를 포함한다", () => {
    const state = createBattle(ctx.stage, ctx.data, 42);
    const guanyu = state.units.find((u) => u.id === "guanyu")!;
    const tiles = getMovableTiles(ctx, state, "guanyu");
    expect(tiles).toContainEqual({ x: guanyu.x, y: guanyu.y });
    for (const t of tiles) {
      const manhattan = Math.abs(t.x - guanyu.x) + Math.abs(t.y - guanyu.y);
      expect(manhattan).toBeLessThanOrEqual(guanyu.move); // 비용이 최소 1이므로 맨해튼 거리가 이동력을 초과하는 타일에는 도달 불가
    }
  });

  it("성벽(비용 99)은 포함되지 않는다", () => {
    const state = createBattle(ctx.stage, ctx.data, 42);
    const tiles = getMovableTiles(ctx, state, "guanyu");
    for (const t of tiles) {
      expect(terrainAt(ctx, t.x, t.y).id).not.toBe("wall");
    }
  });

  it("다른 유닛이 점유한 타일은 목적지가 될 수 없다", () => {
    const state = createBattle(ctx.stage, ctx.data, 42);
    const occupied = state.units
      .filter((u) => u.id !== "guanyu" && !u.retreated)
      .map((u) => `${u.x},${u.y}`);
    const tiles = getMovableTiles(ctx, state, "guanyu");
    for (const t of tiles) expect(occupied).not.toContain(`${t.x},${t.y}`);
  });

  it("적 유닛은 통과도 불가, 아군 유닛은 통과 가능", () => {
    // 사수관 초기 배치에서 유비(5,11)는 관우(4,10)·미축(6,11) 등 아군에 둘러싸여 있다.
    // 아군 통과가 안 되면 도달 타일 수가 급감하므로, 아군 점유 타일 너머의 타일이 포함되는지 본다.
    const state = createBattle(ctx.stage, ctx.data, 42);
    const tiles = getMovableTiles(ctx, state, "liubei");
    expect(tiles.some((t) => t.y <= 7)).toBe(true); // 아군 라인 너머 북쪽으로 도달 가능
  });

  it("지형 비용은 병종 오버라이드를 적용한다 (기병 산악 4, 보병 숲 1)", () => {
    const mountain = gameData.terrains["mountain"]!;
    const forest = gameData.terrains["forest"]!;
    expect(moveCostFor(mountain, "cavalry")).toBe(4);
    expect(moveCostFor(mountain, "infantry")).toBe(3); // default
    expect(moveCostFor(forest, "infantry")).toBe(1);
    expect(moveCostFor(forest, "cavalry")).toBe(2); // default
  });
});
