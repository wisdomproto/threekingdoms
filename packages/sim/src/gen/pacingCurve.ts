/**
 * 페이싱 커브 + 밴드 전력 예산 (§11-B) — 순수, 엔진 무관.
 * docs/superpowers/specs/2026-06-15-pacing-generator-design.md.
 *
 * 커브 = [경로%, 누적 전력%] 오름차순. 시작→목표 경로를 100%로 정규화했을 때
 * "이 지점까지 누적 적 전력이 몇 %여야 하는가"를 정의한다(예: 50%지점=전력40%, 90%=보스).
 */

/** [pathPercent, cumulativeForcePercent] 오름차순. */
export type PacingCurve = [number, number][];

/** 기본 커브 — 후반 가중(보스 = 90% 지점). §11 본문 수치. */
export const DEFAULT_CURVE: PacingCurve = [
  [20, 15],
  [50, 40],
  [90, 100],
];

/** 한 밴드 = 경로% 중심 + 배정 전력. */
export interface Band {
  atPercent: number;
  force: number;
}

/**
 * 커브 점들을 밴드로 변환. 각 밴드 전력 = 인접 누적%의 차분 × total / 100.
 * 마지막 밴드는 잔여(total − 앞 밴드 합)를 흡수해 합이 정확히 total이 되게 한다
 * (커브 끝 누적%가 100 미만이어도 총 예산을 다 쓴다).
 */
export function bandBudgets(curve: PacingCurve, total: number): Band[] {
  const sorted = curve.slice().sort((a, b) => a[0] - b[0]);
  const bands: Band[] = [];
  let prevCum = 0;
  let allocated = 0;
  for (let i = 0; i < sorted.length; i++) {
    const [atPercent, cum] = sorted[i]!;
    const isLast = i === sorted.length - 1;
    const force = isLast ? total - allocated : ((cum - prevCum) / 100) * total;
    bands.push({ atPercent, force });
    allocated += force;
    prevCum = cum;
  }
  return bands;
}
