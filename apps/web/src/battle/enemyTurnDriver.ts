/**
 * EnemyTurnDriver (설계 §2.1) — 적 페이즈 자동 루프.
 * @tk/sim의 그리디 chooseAction을 재사용해 1액션씩 커밋·재생한다.
 * 엔진이 마지막 적 행동에서 페이즈를 자동 전환하므로(phaseChanged(player) 포함),
 * 커밋 후 phase가 player로 바뀌면 루프가 끝난다. 종료/패배도 status로 감지.
 * 안전망: 최대 반복 가드 = 유닛 수 × 4 (move/attack/wait가 유닛당 최대 2액션이므로 여유 2배).
 */
import { chooseAction } from "@tk/sim";
import type { Action, BattleContext, BattleEvent, BattleState, Coord } from "@tk/engine";

export interface EnemyTurnDeps {
  ctx: BattleContext;
  getState: () => BattleState;
  /** store.commit — applyAction + actionLog 기록, events 반환 (동기) */
  commit: (action: Action) => readonly BattleEvent[];
  /** EventPlayer.enqueue — 드레인까지 await */
  play: (events: readonly BattleEvent[]) => Promise<void>;
  onFocus?: (coord: Coord) => void;
}

export async function runEnemyPhase(deps: EnemyTurnDeps): Promise<void> {
  const maxIters = deps.getState().units.length * 4;
  let iters = 0;
  for (;;) {
    const state = deps.getState();
    if (state.status !== "ongoing" || state.phase !== "enemy") return;
    if (++iters > maxIters) {
      throw new Error(
        `enemyTurnDriver: 반복 한도(${maxIters}) 초과 — 페이즈가 전환되지 않음 (엔진 계약 위반 의심)`,
      );
    }
    const action = chooseAction(deps.ctx, state);
    if (!action) return; // applyAction이 페이즈를 자동 전환하므로 정상 흐름에선 도달 안 함
    const unit = state.units.find((u) => u.id === action.unitId);
    if (unit) deps.onFocus?.({ x: unit.x, y: unit.y });
    const events = deps.commit(action);
    await deps.play(events);
  }
}
