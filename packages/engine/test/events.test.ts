import { describe, it, expect } from "vitest";
import { createBattle } from "../src/createBattle";
import { findDuelTrigger } from "../src/events";
import { testCtx } from "./fixtures";

describe("findDuelTrigger", () => {
  it("관우가 화웅 공격 시 일기토 트리거가 잡힌다", () => {
    const state = createBattle(testCtx, 42);
    const ev = findDuelTrigger(testCtx, state, "관우", "화웅");
    expect(ev?.id).toBe("duel_관우_화웅");
  });

  it("다른 조합(유비→화웅)은 트리거되지 않는다", () => {
    const state = createBattle(testCtx, 42);
    expect(findDuelTrigger(testCtx, state, "유비", "화웅")).toBeUndefined();
  });

  it("이미 발동된(once) 이벤트는 다시 잡히지 않는다", () => {
    const state = createBattle(testCtx, 42);
    const fired = { ...state, firedEvents: ["duel_관우_화웅"] };
    expect(findDuelTrigger(testCtx, fired, "관우", "화웅")).toBeUndefined();
  });
});
