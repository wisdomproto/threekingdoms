import { gameData, stages } from "@tk/data";
import type { Stage, BattleMap } from "@tk/data";
import { applyAction, createBattle, type BattleContext } from "@tk/engine";
import { chooseAction, type Policy } from "./policy";

export interface RunResult {
  result: "victory" | "defeat" | "timeout";
  turns: number;
  playerRetreats: number;
  duelsFired: string[];
}

/** §11-A 리포트 옵션 — 정책 티어·레벨 오프셋·상한 주입. seed 미지정 시 42(결정론이라 무영향). */
export interface RunOpts {
  seed?: number;
  policy?: Policy;
  levelOffset?: number;
  maxTurns?: number;
  /** §11-C 합성 — 미등록 생성 맵을 직접 주입(없으면 gameData.maps[mapId] 룩업). */
  mapOverride?: BattleMap;
}

/**
 * 레벨 오프셋 적용한 stage 사본(순수) — **플레이어 유닛 level만** clamp(level+offset, 1, 99).
 * 적·우군·배치·맵은 불변. offset 0이면 원본 그대로 반환(불필요 복사 회피).
 * (BattleScreen.applySortie와 동형 — 엔진/createBattle 무수정으로 저렙/고렙 플레이어를 모델링.)
 */
export function withLevelOffset(stage: Stage, offset: number): Stage {
  if (offset === 0) return stage;
  return {
    ...stage,
    units: stage.units.map((u) =>
      u.side === "player"
        ? { ...u, level: Math.max(1, Math.min(99, u.level + offset)) }
        : u,
    ),
  };
}

/**
 * 임의 Stage 1판 실행(등록 불필요 — §11-B 생성 스테이지 측정용). gameData에서 맵을 룩업하므로
 * stage.mapId는 실재 맵을 가리켜야 하고, 유닛 commanderId/classId/items는 gameData에 존재해야 한다
 * (생성기는 generic 적 commander를 commanders.json에 두어 충족).
 */
export function runStage(stage: Stage, opts: RunOpts = {}): RunResult {
  const seed = opts.seed ?? 42;
  const policy = opts.policy ?? chooseAction;
  const s = withLevelOffset(stage, opts.levelOffset ?? 0);
  const map = opts.mapOverride ?? gameData.maps[s.mapId];
  if (!map) throw new Error(`unknown map: ${s.mapId}`);
  const ctx: BattleContext = { data: gameData, stage: s, map };
  let state = createBattle(ctx, seed);

  // 시뮬 상한은 스테이지의 turnLimit 기준(+1 라운드 여유로 surviveTurns:turnLimit 충족이
  // 마지막 라운드 직후 판정되게 한다). 호출자가 명시하면 그 값을 쓴다. combat.maxTurns(30)에
  // 묶으면 turnLimit>30 인 후반 생존/장기전이 영원히 타임아웃돼서 잘못된 "불가" 신호가 난다.
  const cap = opts.maxTurns ?? s.turnLimit + 1;

  let guard = 0;
  // turn은 아군 페이즈 시작 시 증가 — <= 경계로 cap번째 라운드까지 온전히 실행
  while (state.status === "ongoing" && state.turn <= cap) {
    if (++guard > 100_000) throw new Error("simulation runaway"); // 56×32 맵 기준 상향
    const action = policy(ctx, state);
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

/**
 * 등록된 stageId 1판 실행. 하위호환: 두번째 인자가 number면 seed(+선택 maxTurns), 객체면 RunOpts.
 * 정책 미지정 시 greedy(chooseAction), levelOffset 0.
 */
export function runBattle(stageId: string, seedOrOpts?: number | RunOpts, maxTurns?: number): RunResult {
  const opts: RunOpts =
    typeof seedOrOpts === "number" || seedOrOpts === undefined
      ? { seed: seedOrOpts, maxTurns }
      : seedOrOpts;
  const base = stages[stageId];
  if (!base) throw new Error(`unknown stage: ${stageId}`);
  return runStage(base, opts);
}
