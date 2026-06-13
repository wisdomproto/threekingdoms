/**
 * 자동전투 (feel-spec §A 보조 컨트롤) — setAutoBattle 토글이 아군 페이즈를 그리디 드라이버로
 * 구동하는지 검증. 정책은 @tk/sim chooseAction(진영 무관)이라, 자동 완주 결과는 순수 그리디
 * 루프(applyAction 직접)와 한 치도 다르지 않아야 한다 (store/입력기계가 결과를 왜곡하지 않음).
 */
import { describe, expect, it } from "vitest";
import { applyAction, createBattle } from "@tk/engine";
import { chooseAction } from "@tk/sim";
import { BattleStore } from "../store";
import { sishuiCtx } from "./fixtures";

const ctx = sishuiCtx;
const SEED = 42;

/** 순수 엔진 그리디 완주 — 자동전투 결과의 기대 베이스라인 */
function pureGreedyEnd(seed: number) {
  let state = createBattle(ctx, seed);
  let guard = 0;
  while (state.status === "ongoing" && guard++ < 10_000) {
    const act = chooseAction(ctx, state);
    if (!act) break;
    state = applyAction(ctx, state, act).state;
  }
  return state;
}

describe("자동전투 토글", () => {
  it("ON이면 양 페이즈가 자동 진행되어 전투가 끝까지 완주한다", async () => {
    const store = new BattleStore(ctx, SEED);
    expect(store.autoBattle).toBe(false);

    store.setAutoBattle(true); // idle → autoTurn → 그리디 드라이버 기동
    expect(store.autoBattle).toBe(true);
    await store.whenIdle(); // battleOver까지 대기 (auto 중엔 idle로 안 머문다)

    expect(store.uiState.kind).toBe("battleOver");
    expect(store.committedState.status).not.toBe("ongoing");
    // 자동 완주 ≡ 순수 그리디 — 아군 측도 동일 정책으로 구동됨을 고정
    expect(store.committedState).toEqual(pureGreedyEnd(SEED));
  }, 30_000);

  it("진행 중 OFF로 끄면 드라이버가 멈추고 아군 입력(idle)으로 복귀한다", async () => {
    const store = new BattleStore(ctx, SEED);
    store.setAutoBattle(true); // 첫 아군 액션 1개 커밋 후 play await에서 suspend
    store.setAutoBattle(false); // 즉시 OFF — shouldStop으로 다음 루프에서 중단

    await store.whenIdle();
    expect(store.autoBattle).toBe(false);
    expect(store.uiState.kind).toBe("idle"); // 자동 OFF → 수동 제어 복귀
    expect(store.committedState.status).toBe("ongoing"); // 전투는 아직 진행 중
  }, 30_000);

  it("이미 같은 값으로 토글하면 무시된다 (중복 드라이버 기동 없음)", () => {
    const store = new BattleStore(ctx, SEED);
    store.setAutoBattle(false); // 이미 false — no-op
    expect(store.autoBattle).toBe(false);
    expect(store.uiState.kind).toBe("idle");
    expect(store.actionLog.length).toBe(0);
  });
});
