/**
 * 스테이지 결산 평가 (CLAUDE.md §10 — S~C 등급). 긴장감을 영구사망 대신 평가로.
 * 결정론: 입력만으로 산정, 난수 없음. 리더보드/리플레이 직결.
 */
export interface StageEvalInput {
  turnsUsed: number;
  turnLimit: number;
  playerRetreats: number;
  treasuresObtained: number;
  totalTreasures: number;
}

export interface StageEvalResult {
  grade: "S" | "A" | "B" | "C";
  score: number; // 0~100
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

export function evaluateStage(input: StageEvalInput): StageEvalResult {
  const { turnsUsed, turnLimit, playerRetreats, treasuresObtained, totalTreasures } = input;
  // turnLimit 0 방어 — 정의상 min(1)이지만 호출자 안전을 위해 가드
  const ratio = turnLimit > 0 ? turnsUsed / turnLimit : 1;

  let grade: StageEvalResult["grade"];
  if (ratio <= 0.4 && playerRetreats === 0 && treasuresObtained >= totalTreasures) {
    grade = "S";
  } else if (ratio <= 0.6 && playerRetreats <= 1) {
    grade = "A";
  } else if (ratio <= 0.9) {
    grade = "B";
  } else {
    grade = "C";
  }

  const score = clamp(
    Math.round(100 - ratio * 60 - playerRetreats * 15 + treasuresObtained * 5),
    0,
    100,
  );
  return { grade, score };
}
