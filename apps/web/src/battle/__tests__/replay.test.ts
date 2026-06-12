/**
 * 스위트 4 (설계 §7) — 리플레이 결정론 불변식.
 * createBattle(ctx, seed) 위에 actionLog를 fold한 결과 ≡ 완주 후 committedState.
 * v1.5 리더보드/리플레이(턴 로그 JSON 재시뮬레이션)와 seed+log 버그 재현의 기반 계약.
 */
import { describe, expect, it } from "vitest";
import { applyAction, createBattle } from "@tk/engine";
import type { Action, BattleState } from "@tk/engine";
import { BattleStore } from "../store";
import { playGreedyToEnd } from "./greedyUi";
import { sishuiCtx } from "./fixtures";

const ctx = sishuiCtx;
const SEED = 42;

function foldLog(seed: number, log: readonly Action[]): BattleState {
  return log.reduce((state, a) => applyAction(ctx, state, a).state, createBattle(ctx, seed));
}

describe("replay — actionLog fold ≡ committed", () => {
  it("완주한 전투의 로그를 처음부터 재적용하면 최종 상태가 deepEqual로 일치한다", async () => {
    const store = new BattleStore(ctx, SEED);
    await playGreedyToEnd(store, ctx);
    expect(store.committedState.status).not.toBe("ongoing");
    expect(store.actionLog.length).toBeGreaterThan(0);

    const replayed = foldLog(SEED, store.actionLog);
    expect(replayed).toEqual(store.committedState);
  }, 30_000);

  it("로그는 직렬화 왕복(JSON) 후에도 같은 결과를 낸다 — 저장/공유 가능 형식", async () => {
    const store = new BattleStore(ctx, SEED);
    await playGreedyToEnd(store, ctx);

    const wire = JSON.stringify({ seed: store.seed, log: store.actionLog });
    const parsed = JSON.parse(wire) as { seed: number; log: Action[] };
    expect(foldLog(parsed.seed, parsed.log)).toEqual(store.committedState);
  }, 30_000);
});
