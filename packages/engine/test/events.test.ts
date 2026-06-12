import { describe, it, expect } from "vitest";
import { gameData, stages } from "@tk/data";
import { createBattle } from "../src/createBattle";
import { findDuelTrigger } from "../src/events";
import type { BattleContext } from "../src/types";

const ctx: BattleContext = { data: gameData, stage: stages["05-sishuiguan"]! };

describe("findDuelTrigger", () => {
  it("관우가 화웅 공격 시 일기토 트리거가 잡힌다", () => {
    const state = createBattle(ctx.stage, ctx.data, 42);
    const ev = findDuelTrigger(ctx, state, "guanyu", "huaxiong");
    expect(ev?.id).toBe("duel_guanyu_huaxiong");
  });

  it("다른 조합(장비→화웅)은 트리거되지 않는다", () => {
    const state = createBattle(ctx.stage, ctx.data, 42);
    expect(findDuelTrigger(ctx, state, "zhangfei", "huaxiong")).toBeUndefined();
  });

  it("이미 발동된(once) 이벤트는 다시 잡히지 않는다", () => {
    const state = createBattle(ctx.stage, ctx.data, 42);
    const fired = { ...state, firedEvents: ["duel_guanyu_huaxiong"] };
    expect(findDuelTrigger(ctx, fired, "guanyu", "huaxiong")).toBeUndefined();
  });
});
