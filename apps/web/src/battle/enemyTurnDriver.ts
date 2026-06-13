/**
 * EnemyTurnDriver (설계 §2.1) — 적 페이즈 자동 루프.
 * @tk/sim의 그리디 chooseAction을 재사용해 1액션씩 커밋·재생한다.
 * 엔진이 마지막 적 행동에서 페이즈를 자동 전환하므로(phaseChanged(player) 포함),
 * 커밋 후 phase가 player로 바뀌면 루프가 끝난다. 종료/패배도 status로 감지.
 * 안전망: 최대 반복 가드 = 유닛 수 × 4 (move/attack/wait가 유닛당 최대 2액션이므로 여유 2배).
 *
 * 드레인 보장 계약:
 *   runEnemyPhase는 종료 전 반드시 play([])를 최소 1회 호출해 드레인을 보장한다.
 *   chooseAction → undefined(전원 acted)로 첫 이터레이션에서 즉시 return하는 경우에도
 *   play([])를 호출해 onDrained → drained → idle 전환을 보장한다.
 *   (이 경로를 생략하면 enemyTurn 상태에 영구 갇힘 — 설계 §5 drained 계약 위반)
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
  let playedAtLeastOnce = false;
  for (;;) {
    const state = deps.getState();
    if (state.status !== "ongoing" || state.phase !== "enemy") break;
    if (++iters > maxIters) {
      throw new Error(
        `enemyTurnDriver: 반복 한도(${maxIters}) 초과 — 페이즈가 전환되지 않음 (엔진 계약 위반 의심)`,
      );
    }
    const action = chooseAction(deps.ctx, state);
    if (!action) break; // applyAction이 페이즈를 자동 전환하므로 정상 흐름에선 도달 안 함
    const unit = state.units.find((u) => u.id === action.unitId);
    if (unit) deps.onFocus?.({ x: unit.x, y: unit.y });
    const events = deps.commit(action);
    await deps.play(events);
    playedAtLeastOnce = true;
  }
  // 드레인 보장: 한 번도 play를 호출하지 않은 경우(전원 acted 상태로 enemyTurn 진입 등)
  // 빈 배열로 enqueue해 onDrained → drained → idle 전환을 트리거한다.
  if (!playedAtLeastOnce) {
    await deps.play([]);
  }
}
