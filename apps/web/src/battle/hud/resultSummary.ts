/**
 * 결산 요약 — 순수 데이터 (설계 §10·§12 클리어 결산 시퀀스).
 * Pixi/React 무관 — node에서 단위 테스트 가능. ResultSequence가 이 값으로 연출만 입힌다.
 *
 * 입력은 BattleVM + stage.reward(StageReward) + items 맵.
 * evaluateStage(@tk/engine)로 등급/점수를 산정하고, 보상 카드 표시용으로 풀어낸다.
 * MVP 가정(설계 phase-1 계약): 보물은 전부 획득으로 간주(treasuresObtained=total).
 */
import { evaluateStage } from "@tk/engine";
import type { StageReward, Item } from "@tk/data";
import type { BattleVM } from "../viewmodel";

export interface RewardCard {
  id: string;
  name: string;
}

export interface ResultSummary {
  grade: "S" | "A" | "B" | "C";
  score: number;
  /** 채워질 별 개수: S=4 A=3 B=2 C=1 */
  stars: number;
  gold: number;
  exp: number;
  treasures: RewardCard[];
  turnsUsed: number;
  turnLimit: number;
  playerRetreats: number;
}

const STARS: Record<ResultSummary["grade"], number> = { S: 4, A: 3, B: 2, C: 1 };

/** 아군 페이즈 종료 시점 퇴각 아군 수 — vm.units에서 도출 */
export function countPlayerRetreats(vm: BattleVM): number {
  return vm.units.filter((u) => u.side === "player" && u.retreated).length;
}

/**
 * 결산 요약 산출. reward 미지정 스테이지는 gold/exp 0, 보물 0개로 처리.
 * items에 없는 보물 id는 id를 이름으로 사용(누락 데이터 안전).
 */
export function buildResultSummary(
  vm: BattleVM,
  reward: StageReward | undefined,
  items: Record<string, Item>,
): ResultSummary {
  const treasureIds = reward?.treasures ?? [];
  const totalTreasures = treasureIds.length;
  // MVP: 전부 획득으로 간주
  const treasuresObtained = totalTreasures;
  const playerRetreats = countPlayerRetreats(vm);

  const { grade, score } = evaluateStage({
    turnsUsed: vm.turn.turn,
    turnLimit: vm.turn.turnLimit,
    playerRetreats,
    treasuresObtained,
    totalTreasures,
  });

  return {
    grade,
    score,
    stars: STARS[grade],
    gold: reward?.gold ?? 0,
    exp: reward?.exp ?? 0,
    treasures: treasureIds.map((id) => ({ id, name: items[id]?.name ?? id })),
    turnsUsed: vm.turn.turn,
    turnLimit: vm.turn.turnLimit,
    playerRetreats,
  };
}
