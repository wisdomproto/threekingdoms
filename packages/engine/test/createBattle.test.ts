import { describe, it, expect } from "vitest";
import { gameData, stages } from "@tk/data";
import { createBattle } from "../src/createBattle";

const stage = stages["05-sishuiguan"]!;

describe("createBattle", () => {
  it("스테이지의 모든 유닛이 스탯 해석되어 배치된다", () => {
    const state = createBattle(stage, gameData, 42);
    expect(state.units).toHaveLength(stage.units.length);
    const guanyu = state.units.find((u) => u.id === "guanyu")!;
    expect(guanyu.hp).toBe(64);
    expect(guanyu.move).toBe(6);       // cavalry
    expect(guanyu.side).toBe("player");
  });
  it("턴 1, 아군 페이즈, ongoing으로 시작한다", () => {
    const state = createBattle(stage, gameData, 42);
    expect(state.turn).toBe(1);
    expect(state.phase).toBe("player");
    expect(state.status).toBe("ongoing");
    expect(state.rngState).toBe(42);
  });
  it("존재하지 않는 commanderId는 에러를 던진다", () => {
    const badStage = {
      ...stage,
      units: [{ commanderId: "ghost", side: "player" as const, x: 0, y: 0 }],
    };
    expect(() => createBattle(badStage, gameData, 42)).toThrow("unknown commander: ghost");
  });
});
