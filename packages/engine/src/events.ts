import type { StageEvent } from "@tk/data";
import type { BattleContext, BattleState } from "./types";

/** attackerId가 defenderId를 공격 선언했을 때 발동할 일기토 이벤트를 찾는다 */
export function findDuelTrigger(
  ctx: BattleContext,
  state: BattleState,
  attackerId: string,
  defenderId: string,
): StageEvent | undefined {
  return ctx.stage.events.find((e) =>
    e.type === "duel" &&
    e.trigger.kind === "attack" &&
    e.trigger.attackerId === attackerId &&
    e.trigger.defenderId === defenderId &&
    !(e.once && state.firedEvents.includes(e.id)),
  );
}
