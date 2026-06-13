import type { Grade } from "@tk/data";

/**
 * 조조전 병과 등급계수 성장 (docs/reference/sosoden-class-grades.md §2).
 *
 * 레벨업 상승치는 **등급 × 현재 능력치 구간** 2변수 함수다. 같은 등급이라도 해당 스탯의
 * 현재값이 높은 "특화 구간"에 들어가야 상승폭이 커진다 → 열매(아이템)로 구간 경계를
 * 넘기는 특화 플레이가 성립.
 *
 * 원작 구간표 (§2 채택값):
 *   | 등급 | 0~48 | 50~68 | 70~88 | 90~100 |
 *   |  S   |  +2  |  +3   |  +4   |   —    |
 *   |  A   |  +2  |  +3   |   —   |   —    |
 *   |  B   |  +1  |  +2   |  +3   |   —    |
 *   |  C   |  +1  |  +2   |   —   |   —    |
 *
 * 구간 경계: 원작 표가 명시한 49 / 69 / 89는 "구간" 단위라 우리는
 *   v < 50 → 구간0(0~48) / v < 70 → 구간1(50~68) / v < 90 → 구간2(70~88) / v ≥ 90 → 구간3(90~100)
 * 으로 닫는다(49·69·89는 직전 구간에 흡수 — 짝수 능력치 + floor(/2) 초기값 특성상 거의 발생 안 함).
 *
 * 엣지 처리 (구간표에 없는 칸 — notes에 명시):
 *  - "—"(빈 칸)은 그 등급이 더 높은 구간에서 추가 가산을 받지 못한다는 뜻 → 해당 등급의
 *    "마지막 정의된 구간" 값으로 클램프한다. (A는 70+에서 +3 유지, C는 70+에서 +2 유지,
 *     S는 90+에서 +4 유지, B는 90+에서 +3 유지.) 능력치가 무한정 폭주하지 않도록.
 *  - D 등급: 원작 구간표에 행이 없다(0=D, 미사용). C보다 한 단계 아래의 "둔재"로
 *    전 구간 +1 고정으로 정의한다. (S~C는 +1~+4 분포 → D=+1은 C의 하한과 동률이나
 *     상위 구간에서 증가하지 않아 실효 성장이 가장 느림.)
 */
export type GrowthStat = Grade;

/** 능력치 현재값 → 구간 인덱스 (0:0~48 / 1:50~68 / 2:70~88 / 3:90~100) */
function bracket(v: number): 0 | 1 | 2 | 3 {
  if (v < 50) return 0;
  if (v < 70) return 1;
  if (v < 90) return 2;
  return 3;
}

/**
 * 등급별 구간 가산표. 4원소 = [구간0, 구간1, 구간2, 구간3].
 * "—"(빈 칸)은 마지막 정의 구간으로 클램프한 값을 그대로 둔다.
 */
const GROWTH_TABLE: Record<Grade, [number, number, number, number]> = {
  S: [2, 3, 4, 4], // 90+ = +4 클램프
  A: [2, 3, 3, 3], // 70+ = +3 클램프
  B: [1, 2, 3, 3], // 90+ = +3 클램프
  C: [1, 2, 2, 2], // 70+ = +2 클램프
  D: [1, 1, 1, 1], // 원작 미정의 — C 하위 둔재로 전 구간 +1 고정
};

/** 등급 + 현재 누적값 → 이번 레벨업 가산치 (결정론, 난수 없음) */
export function growthCoeff(grade: Grade, current: number): number {
  return GROWTH_TABLE[grade][bracket(current)];
}

/**
 * 부대 능력치 = floor(장수능력/2) + Σ_{L=1..level} coeff(grade, 그 시점 누적값).
 *
 * **증분형 누적**: 단일 계수 곱(LV_GROWTH×level)이 아니라, 레벨마다 그 시점의 누적값으로
 * 구간을 재조회해 가산한다. base·grade·level만의 순수 함수 → 완전 결정론(난수 없음).
 * level 0이면 초기값 floor(base/2) 그대로.
 */
export function corpsStat(base: number, grade: Grade, level: number): number {
  let v = Math.floor(base / 2);
  for (let L = 1; L <= level; L++) {
    v += growthCoeff(grade, v);
  }
  return v;
}
