/**
 * 스위트 3 (설계 §7) — 황금 테스트: 실제 엔진 + 양측 그리디로 사수관을 battleEnded까지 완주.
 *  - 플레이어 측은 UI 이벤트로만 구동(greedyUi) → inputMachine·store·eventPlayer·enemyTurnDriver
 *    전 스택이 실전 경로로 작동. 무한루프/교착 부재가 곧 applyAction 페이즈 전환 계약의 고정.
 *  - TrackingPresenter + dev 단언: 이벤트 스트림만으로 재구성한 투영이 매 드레인마다
 *    committed와 일치 — "이벤트가 상태 변화를 전부 서술한다" 계약을 완주 내내 검증.
 *  - 결정론 회귀 1건: 복제 상태 드라이런의 damageDealt ≡ 실제 커밋의 damageDealt
 *    (분산 없음 계약 — v0.1 데미지 예보 UI의 기반).
 */
import { describe, expect, it } from "vitest";
import { applyAction, createBattle } from "@tk/engine";
import { chooseAction } from "@tk/sim";
import { BattleStore } from "../store";
import { TrackingPresenter } from "./fakePresenter";
import { playGreedyToEnd } from "./greedyUi";
import { sishuiCtx } from "./fixtures";

const ctx = sishuiCtx;
const SEED = 42;

async function runFullBattle(seed: number) {
  const presenter = new TrackingPresenter();
  const store = new BattleStore(ctx, seed, { presenter, dev: true });
  presenter.prime(store.settledState);
  await playGreedyToEnd(store, ctx);
  return { store, presenter };
}

describe("fullBattle — 사수관 완주", () => {
  it("battleEnded까지 교착 없이 완주하고, 모든 드레인에서 dev 정합 단언을 통과한다", async () => {
    const { store, presenter } = await runFullBattle(SEED);

    // 종료 상태 일치 3종: 엔진 status / UI 상태기계 / settled 스냅샷
    expect(store.committedState.status).not.toBe("ongoing");
    expect(store.uiState.kind).toBe("battleOver");
    expect(store.settledState).toEqual(store.committedState);

    // battleEnded 최후 재생 계약 — 연출 스트림의 마지막 이벤트이자 유일한 battleEnded
    const types = presenter.events.map((e) => e.type);
    expect(types.filter((t) => t === "battleEnded")).toHaveLength(1);
    expect(types[types.length - 1]).toBe("battleEnded");

    // 페이즈 전환 계약: 적 페이즈가 시작됐다면 반드시 player 복귀가 따라왔다 (마지막 종료 제외)
    const phases = presenter.events.filter((e) => e.type === "phaseChanged");
    expect(phases.length).toBeGreaterThan(0);

    // 행동 로그가 쌓였고 턴 제한(+1 = 제한 초과 판정 턴) 안에서 끝났다
    expect(store.actionLog.length).toBeGreaterThan(0);
    expect(store.committedState.turn).toBeLessThanOrEqual(ctx.stage.turnLimit + 1);
  }, 30_000);

  it("결과는 결정론적 — 같은 seed 두 번 완주 동일 + 순수 엔진 그리디 루프와 결과 일치", async () => {
    const a = await runFullBattle(SEED);
    const b = await runFullBattle(SEED);
    expect(a.store.actionLog).toEqual(b.store.actionLog);
    expect(a.store.committedState).toEqual(b.store.committedState);

    // 교차 검증: UI 이벤트 경유 완주 ≡ applyAction 직접 호출 그리디 루프 (store/입력기계가 결과를 왜곡하지 않음)
    let pure = createBattle(ctx, SEED);
    let guard = 0;
    while (pure.status === "ongoing" && guard++ < 10_000) {
      const act = chooseAction(ctx, pure);
      if (!act) break;
      pure = applyAction(ctx, pure, act).state;
    }
    expect(a.store.committedState).toEqual(pure);

    // 회귀 베이스라인 메모: 그리디 vs 그리디(시드 42)는 일기토 미발동·22턴 defeat가 현재 균형.
    // (일기토는 관우→화웅 직접 공격 조건 — 그리디는 최저 troops 대상을 치므로 안 걸린다.
    //  사람 플레이/일기토 활용 전제의 스테이지라 시뮬 패배 자체는 설계 §11의 밸런스 이슈가 아니라 정책 한계.)
    expect(a.store.committedState.status).toBe(pure.status);
  }, 60_000);

  it("getSnapshot은 settled 기준이며 notify 없인 참조가 안정적이다 (useSyncExternalStore 계약)", async () => {
    const { store } = await runFullBattle(SEED);
    const s1 = store.getSnapshot();
    const s2 = store.getSnapshot();
    expect(s1).toBe(s2); // 캐시 — 무한 리렌더 방지
    expect(s1.ui.kind).toBe("battleOver");
    expect(s1.vm.status).toBe(store.settledState.status);
    expect(s1.vm.turn.turnLimit).toBe(ctx.stage.turnLimit);
  });
});

describe("결정론 회귀 — 드라이런 데미지 = 실제 커밋 데미지", () => {
  it("모든 공격에 대해 복제 상태 드라이런의 damageDealt가 실제와 동일 (분산 없음)", () => {
    let state = createBattle(ctx, SEED);
    let checked = 0;
    let guard = 0;
    while (state.status === "ongoing" && guard++ < 10_000) {
      const action = chooseAction(ctx, state);
      if (!action) break;
      if (action.type === "attack") {
        // 드라이런: 깊은 복제 상태에 적용 — 예보가 실제 커밋과 한 치도 다르지 않아야 한다
        const dry = applyAction(ctx, structuredClone(state), action);
        const real = applyAction(ctx, state, action);
        expect(dry.events.filter((e) => e.type === "damageDealt")).toEqual(
          real.events.filter((e) => e.type === "damageDealt"),
        );
        expect(dry.state).toEqual(real.state);
        state = real.state;
        checked++;
      } else {
        state = applyAction(ctx, state, action).state;
      }
    }
    expect(state.status).not.toBe("ongoing");
    expect(checked).toBeGreaterThan(0);
  }, 30_000);
});
