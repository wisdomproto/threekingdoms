/**
 * 재현 테스트: Bug 1 — 2턴부터 유닛 선택 불가
 *
 * 증상: 1턴 플레이 → 턴 종료(endTurnPressed 또는 마지막 유닛 대기) → 적 턴 자동 진행
 *       → 2턴 아군 페이즈에서 아군 유닛 tapTile → uiState가 선택되지 않음
 *
 * 원인: EnemyTurnDriver가 chooseAction → undefined(전원 acted) 경로로 첫 이터레이션에서
 *       즉시 return할 때, play()를 한 번도 호출하지 않아 EventPlayer 드레인이 발화하지 않고
 *       enemyTurn 상태에 영구히 갇힌다.
 *
 * 수정: runEnemyPhase 종료 전 play([]) 최소 1회 호출 보장 (드레인 계약).
 *
 * 검증 경로 (store.dispatchUi 경유 — 정책 직접 호출 금지):
 *   UI 이벤트로 1턴 전체 진행 → whenIdle() → 2턴에서 tapTile → selected 단언
 */
import { describe, expect, it } from "vitest";
import type { InputState } from "../inputMachine";
import { BattleStore } from "../store";
import { FakePresenter } from "./fakePresenter";
import { sishuiCtx } from "./fixtures";

const ctx = sishuiCtx;
const SEED = 42;

describe("Bug 1 재현 및 수정 확인: 2턴에서 아군 유닛 선택 가능", () => {
  /**
   * 가장 짧은 경로: endTurnPressed 즉시 → 적 턴 완료 → 2턴 tapTile
   */
  it("endTurnPressed 즉시 → 적 턴 완료 → 2턴 tapTile → selected", async () => {
    const store = new BattleStore(ctx, SEED, { presenter: new FakePresenter() });

    expect(store.uiState.kind).toBe("idle");
    expect(store.committedState.phase).toBe("player");
    expect(store.committedState.turn).toBe(1);

    // 1턴: 즉시 턴 종료 (미행동 아군 전원 wait 커밋)
    store.dispatchUi({ type: "endTurnPressed" });
    expect(store.uiState.kind).toBe("animating");

    // 적 턴 자동 진행 + 완료 대기
    await store.whenIdle();

    // 2턴 진입 확인
    expect(store.uiState.kind).toBe("idle");
    expect(store.committedState.phase).toBe("player");
    expect(store.committedState.turn).toBe(2);

    // 2턴에서 아군 유닛 탭 → selected 전이 단언 (버그 시 이 단언 실패)
    const unit = store.committedState.units.find((u) => u.side === "player" && !u.retreated && !u.acted);
    expect(unit).toBeDefined();
    store.dispatchUi({ type: "tapTile", coord: { x: unit!.x, y: unit!.y } });
    expect(store.uiState.kind).toBe("selected");
    if (store.uiState.kind === "selected") {
      expect(store.uiState.unitId).toBe(unit!.id);
    }
  }, 30_000);

  /**
   * 3턴 연속: 매 아군 페이즈 시작 시 유닛 선택 가능성 확인
   */
  it("3턴 연속: 매 아군 페이즈마다 첫 유닛 tapTile → selected", async () => {
    const store = new BattleStore(ctx, SEED, { presenter: new FakePresenter() });

    for (let turn = 1; turn <= 3; turn++) {
      await store.whenIdle();
      if (store.uiState.kind === "battleOver") break;

      expect(store.uiState.kind).toBe("idle");
      expect(store.committedState.phase).toBe("player");

      const units = store.committedState.units.filter(
        (u) => u.side === "player" && !u.retreated && !u.acted,
      );
      if (units.length === 0) break;

      const first = units[0]!;
      store.dispatchUi({ type: "tapTile", coord: { x: first.x, y: first.y } });
      expect(store.uiState.kind).toBe("selected");

      // 선택 취소 후 턴 종료
      store.dispatchUi({ type: "cancel" });
      store.dispatchUi({ type: "endTurnPressed" });
    }
  }, 30_000);

  /**
   * UI 이벤트 경로로 1턴 완전 플레이 후 2턴 선택 가능
   * (tapTile 자기 자신 → menuWait 방식으로 아군 전원 대기)
   */
  it("1턴 아군 전원 menuWait → whenIdle → 2턴 tapTile → selected", async () => {
    const store = new BattleStore(ctx, SEED, { presenter: new FakePresenter() });

    // 1턴: 아군 전원을 탭→제자리 menuWait 처리
    // 마지막 유닛 wait 시 자동으로 enemyTurn으로 전환되므로 break
    while (true) {
      const units = store.committedState.units.filter(
        (u) => u.side === "player" && !u.retreated && !u.acted,
      );
      if (units.length === 0) break;
      // 아직 idle이어야 탭 가능 (animating이면 마지막 유닛이 페이즈 전환 트리거)
      if (store.uiState.kind !== "idle") break;

      const u = units[0]!;
      store.dispatchUi({ type: "tapTile", coord: { x: u.x, y: u.y } }); // selected
      // `as` 캐스팅으로 CFA narrowing 리셋 — store.uiState getter가 새 값을 반환함을 TS가 모름
      const uiAfterTap = store.uiState as InputState;
      expect(["selected", "idle"].includes(uiAfterTap.kind)).toBe(true);
      if (uiAfterTap.kind !== "selected") break;
      store.dispatchUi({ type: "tapTile", coord: { x: u.x, y: u.y } }); // postMoveMenu(제자리)
      expect(store.uiState.kind).toBe("postMoveMenu");
      store.dispatchUi({ type: "menuWait" }); // animating or stays idle (마지막이면 enemyTurn 진입)
    }

    // 적 턴 완료 + idle 복귀 대기
    await store.whenIdle();

    expect(store.uiState.kind).toBe("idle");
    expect(store.committedState.phase).toBe("player");
    expect(store.committedState.turn).toBe(2);

    // 2턴: 아군 유닛 탭 → selected
    const unit2 = store.committedState.units.find(
      (u) => u.side === "player" && !u.retreated && !u.acted,
    );
    expect(unit2).toBeDefined();
    store.dispatchUi({ type: "tapTile", coord: { x: unit2!.x, y: unit2!.y } });
    expect(store.uiState.kind).toBe("selected");
  }, 30_000);

  /**
   * 드레인 보장 단위 테스트: runEnemyPhase가 play([])를 반드시 1회 호출하는지 확인
   * (chooseAction이 즉시 undefined를 반환하는 시뮬레이션)
   */
  it("EnemyTurnDriver: play 호출 없이 return해도 drainCount >= 1", async () => {
    let drainCount = 0;
    let playCount = 0;
    // runEnemyPhase를 직접 import해서 테스트
    const { runEnemyPhase } = await import("../enemyTurnDriver");

    // 모든 적이 이미 acted=true인 상태를 시뮬레이션
    const { createBattle } = await import("@tk/engine");
    const state = createBattle(ctx, SEED);
    // phase를 enemy로, 모든 enemy를 acted=true로 패치
    const patchedState = {
      ...state,
      phase: "enemy" as const,
      units: state.units.map((u) =>
        u.side === "enemy" ? { ...u, acted: true } : u,
      ),
    };

    await runEnemyPhase({
      ctx,
      getState: () => patchedState,
      commit: () => [],
      play: (events) => {
        playCount++;
        drainCount++; // play 호출 = 드레인 트리거
        return Promise.resolve();
      },
    });

    // 버그 수정 후: play가 최소 1회 호출돼야 함
    expect(playCount).toBeGreaterThanOrEqual(1);
    expect(drainCount).toBeGreaterThanOrEqual(1);
  }, 10_000);
});
