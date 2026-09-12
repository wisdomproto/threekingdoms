/** 중단 저장(저장하고 나가기) — canSuspend/isResumable 순수 판정 + node(비브라우저) 영속 가드. */
import { describe, expect, it } from "vitest";
import { canSuspend, clearSuspend, isResumable, readSuspend, writeSuspend, type SuspendedBattle } from "../suspend";

const saved: SuspendedBattle = {
  version: 1, stageId: "05-sishuiguan", seed: 42, sortie: null, log: [],
  playthroughCount: 0, turn: 3, savedAt: "2026-09-12T00:00:00.000Z",
};
const env = { playthroughCount: 0, hasStage: (id: string) => id === "05-sishuiguan" };

describe("canSuspend", () => {
  it("idle + 아군 페이즈 + 진행 중 → true", () => {
    expect(canSuspend({ kind: "idle" }, { phase: "player", status: "ongoing" })).toBe(true);
  });
  it("행동 선택 중 / 적 페이즈 / 종료 → false", () => {
    expect(canSuspend({ kind: "selected" }, { phase: "player", status: "ongoing" })).toBe(false);
    expect(canSuspend({ kind: "idle" }, { phase: "enemy", status: "ongoing" })).toBe(false);
    expect(canSuspend({ kind: "idle" }, { phase: "player", status: "victory" })).toBe(false);
  });
});

describe("isResumable", () => {
  it("null / version≠1 / 미지 스테이지 / 회차 불일치 → false", () => {
    expect(isResumable(null, env)).toBe(false);
    expect(isResumable({ ...saved, version: 2 as unknown as 1 }, env)).toBe(false);
    expect(isResumable({ ...saved, stageId: "99-nope" }, env)).toBe(false);
    expect(isResumable(saved, { ...env, playthroughCount: 1 })).toBe(false);
  });
  it("전부 맞으면 true", () => expect(isResumable(saved, env)).toBe(true));
});

describe("localStorage 가드 (node)", () => {
  it("readSuspend는 null, write/clear는 no-op", () => {
    expect(readSuspend()).toBeNull();
    expect(() => writeSuspend(saved)).not.toThrow();
    expect(() => clearSuspend()).not.toThrow();
    expect(readSuspend()).toBeNull();
  });
});
