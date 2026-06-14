import { gameData, stages } from "@tk/data";
import { applyAction, createBattle, type BattleContext } from "@tk/engine";
import { chooseAction } from "./policy";

export interface RunResult {
  result: "victory" | "defeat" | "timeout";
  turns: number;
  playerRetreats: number;
  duelsFired: string[];
}

export function runBattle(stageId: string, seed: number, maxTurns?: number): RunResult {
  const stage = stages[stageId];
  if (!stage) throw new Error(`unknown stage: ${stageId}`);
  const map = gameData.maps[stage.mapId];
  if (!map) throw new Error(`unknown map: ${stage.mapId}`);
  const ctx: BattleContext = { data: gameData, stage, map };
  let state = createBattle(ctx, seed);

  // 시뮬 상한은 스테이지의 turnLimit 기준(+1 라운드 여유로 surviveTurns:turnLimit 충족이
  // 마지막 라운드 직후 판정되게 한다). 호출자가 명시하면 그 값을 쓴다. combat.maxTurns(30)에
  // 묶으면 turnLimit>30 인 후반 생존/장기전이 영원히 타임아웃돼서 잘못된 "불가" 신호가 난다.
  const cap = maxTurns ?? stage.turnLimit + 1;

  let guard = 0;
  // turn은 아군 페이즈 시작 시 증가 — <= 경계로 cap번째 라운드까지 온전히 실행
  while (state.status === "ongoing" && state.turn <= cap) {
    if (++guard > 100_000) throw new Error("simulation runaway"); // 56×32 맵 기준 상향
    const action = chooseAction(ctx, state);
    if (!action) break;
    state = applyAction(ctx, state, action).state;
  }

  return {
    result: state.status === "ongoing" ? "timeout" : state.status,
    turns: Math.min(state.turn, cap),
    playerRetreats: state.units.filter((u) => u.side === "player" && u.retreated).length,
    duelsFired: state.firedEvents,
  };
}
