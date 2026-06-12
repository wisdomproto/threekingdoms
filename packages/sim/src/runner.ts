import { gameData, stages } from "@tk/data";
import { applyAction, createBattle, type BattleContext } from "@tk/engine";
import { chooseAction } from "./policy";

export interface RunResult {
  result: "victory" | "defeat" | "timeout";
  turns: number;
  playerRetreats: number;
  duelsFired: string[];
}

export function runBattle(stageId: string, seed: number, maxTurns = gameData.combat.maxTurns): RunResult {
  const stage = stages[stageId];
  if (!stage) throw new Error(`unknown stage: ${stageId}`);
  const map = gameData.maps[stage.mapId];
  if (!map) throw new Error(`unknown map: ${stage.mapId}`);
  const ctx: BattleContext = { data: gameData, stage, map };
  let state = createBattle(ctx, seed);

  let guard = 0;
  // turn은 아군 페이즈 시작 시 증가 — <= 경계로 maxTurns번째 라운드까지 온전히 실행
  while (state.status === "ongoing" && state.turn <= maxTurns) {
    if (++guard > 100_000) throw new Error("simulation runaway"); // 56×32 맵 기준 상향
    const action = chooseAction(ctx, state);
    if (!action) break;
    state = applyAction(ctx, state, action).state;
  }

  return {
    result: state.status === "ongoing" ? "timeout" : state.status,
    turns: Math.min(state.turn, maxTurns),
    playerRetreats: state.units.filter((u) => u.side === "player" && u.retreated).length,
    duelsFired: state.firedEvents,
  };
}
