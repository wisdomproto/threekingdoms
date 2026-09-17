/**
 * 플레이어 페이즈를 @tk/sim 그리디(chooseAction)와 동일한 의사결정으로 "UI 이벤트"로 구동.
 * applyAction을 직접 부르지 않고 store.dispatchUi만 사용 — inputMachine·store·eventPlayer·
 * enemyTurnDriver 전 스택이 실전 경로로 작동하는지 검증하는 fullBattle/replay의 공용 드라이버.
 *
 * Policy decisions, including post-move attacks, ultimates and healing, use chooseAction.
 */
import { chooseAction } from "@tk/sim";
import { applyAction, type Action, type BattleContext } from "@tk/engine";
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

    let final: Action = action;
    if (action.type === "move") {
      store.dispatchUi({ type: "tapTile", coord: action.to });
      // Evaluate the same policy against the committed-move state; UI still holds a preview.
      const moved = applyAction(ctx, state, action).state;
      final = chooseAction(ctx, moved) ?? { type: "wait", unitId: unit.id };
      if (final.unitId !== unit.id || final.type === "move") throw new Error("Unexpected post-move policy action");
    } else {
      store.dispatchUi({ type: "tapTile", coord: { x: unit.x, y: unit.y } });
    }
    if (final.type === "attack" || final.type === "ultimate") {
      const target = state.units.find(u => u.id === final.targetId)!;
      store.dispatchUi({ type: final.type === "ultimate" ? "menuUltimate" : "menuAttack" });
      store.dispatchUi({ type: "tapTile", coord: { x: target.x, y: target.y } });
    } else if (final.type === "strategy") {
      store.dispatchUi({ type: "menuStrategy" });
      store.dispatchUi({ type: "selectStrategy", strategyId: final.strategyId });
      store.dispatchUi({ type: "tapTile", coord: final.target });
      store.dispatchUi({ type: "tapTile", coord: final.target }); // Confirm the area preview.
    } else if (final.type === "wait") {
      store.dispatchUi({ type: "menuWait" });
    } else throw new Error(`Unsupported UI policy action: ${final.type}`);
  }
  throw new Error(`maxSteps(${maxSteps}) exceeded`);
}
