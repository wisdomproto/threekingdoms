/**
 * 플레이어 페이즈를 @tk/sim 그리디(chooseAction)와 동일한 의사결정으로 "UI 이벤트"로 구동.
 * applyAction을 직접 부르지 않고 store.dispatchUi만 사용 — inputMachine·store·eventPlayer·
 * enemyTurnDriver 전 스택이 실전 경로로 작동하는지 검증하는 fullBattle/replay의 공용 드라이버.
 *
 * 정책 등가성: chooseAction은 (공격 가능 시 최저 troops 적 공격) → (미이동 시 최근접 이동) →
 * (대기). 이동 후에는 chooseAction을 다시 부르는 대신 postMoveMenu의 attackable(프리뷰 from
 * 기준)로 같은 규칙(최저 troops 공격, 없으면 대기)을 적용한다 — 엔진 조회가 동일하므로 등가.
 */
import { chooseAction } from "@tk/sim";
import type { BattleContext } from "@tk/engine";
import type { InputState } from "../inputMachine";
import type { BattleStore } from "../store";

export async function playGreedyToEnd(
  store: BattleStore,
  ctx: BattleContext,
  maxSteps = 2000,
): Promise<void> {
  for (let step = 0; step < maxSteps; step++) {
    await store.whenIdle();
    // getter 참조에 대한 TS 협착이 dispatchUi 호출을 가로질러 남지 않도록 매번 지역 변수로 캡처
    const atIdle: InputState = store.uiState;
    if (atIdle.kind === "battleOver") return;
    if (atIdle.kind !== "idle") {
      throw new Error(`예상 밖 ui 상태: ${atIdle.kind}`);
    }

    const state = store.committedState;
    const action = chooseAction(ctx, state);
    if (!action) throw new Error("player 페이즈인데 chooseAction이 행동을 못 찾음");
    const unit = state.units.find((u) => u.id === action.unitId);
    if (!unit) throw new Error(`unknown unit: ${action.unitId}`);

    store.dispatchUi({ type: "tapTile", coord: { x: unit.x, y: unit.y } });
    const afterSelect: InputState = store.uiState;
    if (afterSelect.kind !== "selected") {
      throw new Error(`${action.unitId} 선택 실패 → ${afterSelect.kind}`);
    }

    if (action.type === "attack") {
      const target = state.units.find((u) => u.id === action.targetId);
      if (!target) throw new Error(`unknown target: ${action.targetId}`);
      store.dispatchUi({ type: "tapTile", coord: { x: target.x, y: target.y } });
    } else if (action.type === "move") {
      store.dispatchUi({ type: "tapTile", coord: action.to });
      const ui: InputState = store.uiState;
      if (ui.kind !== "postMoveMenu") {
        throw new Error(`이동 프리뷰 실패: (${action.to.x},${action.to.y}) → ${ui.kind}`);
      }
      if (ui.attackable.length > 0) {
        const weakest = ui.attackable
          .map((id) => {
            const t = state.units.find((u) => u.id === id);
            if (!t) throw new Error(`unknown attackable: ${id}`);
            return t;
          })
          .sort((a, b) => a.troops - b.troops)[0]!;
        store.dispatchUi({ type: "menuAttack" });
        store.dispatchUi({ type: "tapTile", coord: { x: weakest.x, y: weakest.y } });
      } else {
        store.dispatchUi({ type: "menuWait" });
      }
    } else {
      // wait: 자기 자신 탭 → postMoveMenu(제자리) → 대기
      store.dispatchUi({ type: "tapTile", coord: { x: unit.x, y: unit.y } });
      store.dispatchUi({ type: "menuWait" });
    }
  }
  throw new Error(`maxSteps(${maxSteps}) 초과 — 교착/무한루프 의심`);
}
