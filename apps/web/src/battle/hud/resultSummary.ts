/**
 * 결산 요약 — 순수 데이터 (설계 §10·§12 클리어 결산 시퀀스).
 * Pixi/React 무관 — node에서 단위 테스트 가능. ResultSequence가 이 값으로 연출만 입힌다.
 *
 * 입력은 BattleVM + stage.reward(StageReward) + items 맵.
 * evaluateStage(@tk/engine)로 등급/점수를 산정하고, 보상 카드 표시용으로 풀어낸다.
 * 보물 = stage.reward.treasures(무조건 보상) + vm.pendingRewards(전략조건 노획분)를
 * **id 기준 중복제거**해 병합한다(같은 id가 양쪽에 있어도 카드 1장). 자금도 양쪽을 합산.
 * MVP 가정(설계 phase-1 계약): 표시된 보물은 전부 획득으로 간주(treasuresObtained=total).
 * 전략조건 보상은 정의상 "획득한" 것이므로 이 가정과 정합한다.
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
  /**
   * 연출 위계(설계 §12 "보상의 내용물은 설계대로, 전달 방식은 카지노처럼").
   * 수치/등급은 그대로 두고, "얼마나 화려하게 깔지"만 등급·보상 규모에서 파생한다.
   * ResultSequence가 잭팟 플래시·코인 물량·텍스트 강도를 이 값으로 차등한다.
   */
  fanfare: Fanfare;
}

/** 결산 연출 강도 — 순수 파생(난수 없음). 내용물 불변, 표현만 차등. */
export interface Fanfare {
  /** S등급 잭팟(금빛 플래시 + 최대 코인 물량). */
  jackpot: boolean;
  /** 0=차분 1=보통 2=화려 3=잭팟. 별 펀치 글로우·코인 수·exp 번쩍을 스케일. */
  level: 0 | 1 | 2 | 3;
  /** 코인 팝 개수(자금 규모·등급 기반, 표현용 상한). */
  coinPops: number;
}

const STARS: Record<ResultSummary["grade"], number> = { S: 4, A: 3, B: 2, C: 1 };

/** 등급 → 기본 연출 강도. S만 잭팟. */
const GRADE_FANFARE: Record<ResultSummary["grade"], 0 | 1 | 2 | 3> = {
  S: 3,
  A: 2,
  B: 1,
  C: 0,
};

/**
 * 연출 강도 파생(순수). 등급이 1차, 자금 규모가 코인 물량을 가산한다.
 * 코인 팝은 표현이므로 6~14개로 클램프(너무 많으면 산만·성능).
 */
export function deriveFanfare(grade: ResultSummary["grade"], gold: number): Fanfare {
  const level = GRADE_FANFARE[grade];
  const g = Math.max(0, Math.floor(gold));
  // 자금 0이면 코인 없음. 그 외 등급 베이스 + 자금 로그 스케일.
  const base = level + 1; // C=1 … S=4
  const byGold = g <= 0 ? 0 : Math.min(10, Math.round(Math.log10(g + 1) * 3));
  const coinPops = g <= 0 ? 0 : Math.min(14, Math.max(6, base + byGold));
  return { jackpot: grade === "S", level, coinPops };
}

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
  const pending = vm.pendingRewards ?? [];
  // stage.reward(무조건) + 전략조건 노획분을 id 기준 중복제거해 병합(같은 id는 카드 1장).
  const treasureIds = [
    ...new Set([...(reward?.treasures ?? []), ...pending.flatMap((p) => p.treasures)]),
  ];
  const totalTreasures = treasureIds.length;
  // MVP: 표시된 보물은 전부 획득으로 간주(전략조건 보상은 정의상 획득분)
  const treasuresObtained = totalTreasures;
  const playerRetreats = countPlayerRetreats(vm);

  const { grade, score } = evaluateStage({
    turnsUsed: vm.turn.turn,
    turnLimit: vm.turn.turnLimit,
    playerRetreats,
    treasuresObtained,
    totalTreasures,
  });

  const gold = (reward?.gold ?? 0) + pending.reduce((sum, p) => sum + p.gold, 0);
  return {
    grade,
    score,
    stars: STARS[grade],
    gold,
    exp: reward?.exp ?? 0,
    treasures: treasureIds.map((id) => ({ id, name: items[id]?.name ?? id })),
    turnsUsed: vm.turn.turn,
    turnLimit: vm.turn.turnLimit,
    playerRetreats,
    fanfare: deriveFanfare(grade, gold),
  };
}
