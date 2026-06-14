/**
 * 공격범위 그리드 모델 (Tier 2-2, core-loop-gap-analysis.md §8-7 "공격범위 5×5 그리드").
 *
 * 병종 사거리(rangeMin~rangeMax)를 패널 안 작은 정사각 격자의 셀 분류로 환산한다 —
 * 순수 표현용 데이터(좌표 → 셀 종류). 렌더는 호출자(패널)가 맡는다.
 *
 *   center = 유닛 자신(격자 정중앙)
 *   donut  = { c : rangeMin ≤ manhattan(center, c) ≤ rangeMax }  ← 공격 가능 칸
 *   blank  = 나머지(사정권 밖) — 간접공격(rangeMin>1)이면 도넛 안쪽 근접 칸도 blank
 *
 * 격자 한 변 = 2*radius+1 (홀수, 중앙 보장). radius = max(rangeMax, 2)로
 * 근접(1)도 최소 5×5를 유지(§8-7 "5×5류")해 병종 간 모양 비교가 일정한 틀에서 보인다.
 * rangeMax가 2보다 크면 격자가 그만큼 커진다(포차·장사정 시각 구분).
 *
 * ⚠️ 격자/맵 무관. 지형·점유·이동은 보지 않는다(threatRange.ts가 그 역할).
 *   여기선 "이 병종의 사거리 모양"만 그린다 — 입력은 rangeMin/rangeMax 둘뿐.
 */

/** 격자 한 셀의 종류 */
export type RangeCellKind = "center" | "donut" | "blank";

export interface RangeCell {
  /** 격자 로컬 좌표(중앙 기준 상대 오프셋) — dx,dy ∈ [-radius, radius] */
  dx: number;
  dy: number;
  kind: RangeCellKind;
}

export interface RangeGrid {
  /** 한 변 셀 수(홀수) */
  size: number;
  /** 중앙까지의 반경 = (size-1)/2 */
  radius: number;
  rangeMin: number;
  rangeMax: number;
  /** 행 우선(y 바깥, x 안쪽)으로 평탄화된 셀 배열 — length === size*size */
  cells: RangeCell[];
}

/** 격자 최소 반경 — 근접도 5×5를 유지(§8-7 "5×5류") */
const MIN_RADIUS = 2;

/**
 * 사거리 모양을 격자 셀 분류로.
 * @param rangeMin 최소 사거리(맨해튼). 음수/NaN은 0으로 정규화.
 * @param rangeMax 최대 사거리(맨해튼). rangeMin 미만이면 rangeMin으로 끌어올림.
 */
export function rangeGrid(rangeMin: number, rangeMax: number): RangeGrid {
  const rMin = Number.isFinite(rangeMin) ? Math.max(0, Math.floor(rangeMin)) : 0;
  const rMaxRaw = Number.isFinite(rangeMax) ? Math.max(0, Math.floor(rangeMax)) : 0;
  const rMax = Math.max(rMaxRaw, rMin);

  const radius = Math.max(MIN_RADIUS, rMax);
  const size = radius * 2 + 1;

  const cells: RangeCell[] = [];
  for (let dy = -radius; dy <= radius; dy++) {
    for (let dx = -radius; dx <= radius; dx++) {
      const d = Math.abs(dx) + Math.abs(dy);
      let kind: RangeCellKind;
      if (d === 0) kind = "center";
      else if (d >= rMin && d <= rMax) kind = "donut";
      else kind = "blank";
      cells.push({ dx, dy, kind });
    }
  }
  return { size, radius, rangeMin: rMin, rangeMax: rMax, cells };
}
