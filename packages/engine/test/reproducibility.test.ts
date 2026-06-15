import { describe, it, expect } from "vitest";
import { createBattle } from "../src/createBattle";
import { applyAction } from "../src/actions";
import type { BattleState } from "../src/types";
import { testCtx } from "./fixtures";

/** 고정 시드 + 고정 행동(관우 1회 대기)으로 전투를 진행해 최종 state를 낸다. */
function runFixed(seed: number): BattleState {
  const s0 = createBattle(testCtx, seed);
  return applyAction(testCtx, s0, { type: "wait", unitId: "관우" }).state;
}

describe("Phase A: 시드 재현성 (전투 RNG 토대)", () => {
  it("같은 (시드, 행동) → 동일 최종 state (리플레이/세이브스컴 방지 토대)", () => {
    expect(runFixed(42)).toEqual(runFixed(42));
  });

  it("RNG 소비처 0 → 다른 시드여도 rngState 외 진행 동일 (Phase B에서 분기될 자리)", () => {
    const a = runFixed(42);
    const b = runFixed(99);
    // rngState(=저장된 seed)만 다르고 나머지 전개는 동일해야 한다(소비 0 증명).
    expect({ ...a, rngState: 0 }).toEqual({ ...b, rngState: 0 });
  });
});
