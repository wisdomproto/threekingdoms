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
import type { Side } from "@tk/data";
import type { Action, BattleContext, BattleEvent, BattleState, Coord } from "@tk/engine";

export interface GreedyPhaseDeps {
  ctx: BattleContext;
  /** 이 드라이버가 구동할 진영 (이 진영 페이즈가 아니면 즉시 종료) */
  side: Side;
  getState: () => BattleState;
  /** store.commit — applyAction + actionLog 기록, events 반환 (동기) */
  commit: (action: Action) => readonly BattleEvent[];
  /** EventPlayer.enqueue — 드레인까지 await */
  play: (events: readonly BattleEvent[]) => Promise<void>;
  onFocus?: (coord: Coord) => void;
  /** 외부 중단 신호 (자동전투 OFF 등). true면 루프를 멈춘다 */
  shouldStop?: () => boolean;
}

/**
 * 그리디 페이즈 드라이버 (적 페이즈 + 아군 자동전투 공용).
 * @tk/sim의 chooseAction(진영 무관, state.phase 기준)으로 1액션씩 커밋·재생한다.
 * 엔진이 마지막 행동에서 페이즈를 자동 전환하므로, 커밋 후 phase가 바뀌면 루프가 끝난다.
 *
 * 드레인 보장 계약:
 *   종료 시점에 (a) 한 번도 play하지 않았거나 (b) 여전히 우리 진영 페이즈로 남아있다면
 *   (= shouldStop으로 조기 중단) 반드시 play([])를 1회 호출해 onDrained → drained 전이를
 *   보장한다. 이 경로를 생략하면 autoTurn/enemyTurn 상태에 영구 갇힌다 (설계 §5 drained 계약).
 */
export async function runGreedyPhase(deps: GreedyPhaseDeps): Promise<void> {
  const maxIters = deps.getState().units.length * 4;
  let iters = 0;
  let playedAtLeastOnce = false;
  for (;;) {
    const state = deps.getState();
    if (state.status !== "ongoing" || state.phase !== deps.side) break;
    if (deps.shouldStop?.()) break; // 자동전투 OFF 등 외부 중단
    if (++iters > maxIters) {
      throw new Error(
        `greedyPhaseDriver(${deps.side}): 반복 한도(${maxIters}) 초과 — 페이즈가 전환되지 않음 (엔진 계약 위반 의심)`,
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
  // 드레인 보장: 미재생(전원 acted 진입) 또는 조기 중단(여전히 우리 페이즈)이면 빈 큐로 드레인 트리거.
  const end = deps.getState();
  const stoppedEarly = end.status === "ongoing" && end.phase === deps.side;
  if (!playedAtLeastOnce || stoppedEarly) {
    await deps.play([]);
  }
}

/** 적 페이즈 드라이버 — runGreedyPhase(side="enemy")의 얇은 래퍼 (중단 없음) */
export async function runEnemyPhase(deps: Omit<GreedyPhaseDeps, "side" | "shouldStop">): Promise<void> {
  return runGreedyPhase({ ...deps, side: "enemy" });
}
