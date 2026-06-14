/**
 * 위협 범위 산출 (Tier 1-3, core-loop-gap-analysis.md §7-1 2계층 정보 / "여포 위협범위→빠져라" 공략장치).
 *
 * 어떤 유닛이 **다음 행동 1회로 공격할 수 있는 모든 칸**을 돌려준다:
 *   threat = ⋃_{p ∈ (이동 도달 칸 ∪ 현위치)} { c : rangeMin ≤ manhattan(p, c) ≤ rangeMax }
 *
 * - 이동 도달 칸은 엔진 getMovableTiles(다익스트라, 지형 비용·적 점유 통과불가)를 그대로 쓴다 —
 *   "내가 갈 수 있는 곳에서 때릴 수 있는 곳"이 곧 위협 범위. 현위치도 포함(제자리 공격).
 * - 사거리는 병종 rangeMin/rangeMax(맨해튼). 간접공격(궁/포 rangeMin>1)은 근접 칸이 빠진
 *   도넛 모양이 자연히 나온다 — 엔진 getAttackableTargets와 동일한 거리 규칙.
 * - 맵 밖 칸은 제외. 결과는 좌표 정렬로 고정(결정론 — 시각 깜빡임/스냅샷 안정).
 *
 * ⚠️ 순수 읽기 전용. 커밋·난수 없음. 호버 변경 시 1회 산출 → 캐시(렌더러가 보유)하라.
 *   매 프레임 호출 금지(이동 도달 산출이 다익스트라라 비싸다).
 *
 * "다음에 도달 가능"은 이동력 1회 기준의 근사다 — 적이 이미 acted여도(이번 턴 행동 완료)
 * 위협 범위는 "다음 턴 기준 위험 구역"으로 보여준다(공략 판단용). acted 게이팅은 호출자 몫.
 */
import { getMovableTiles } from "@tk/engine";
import type { BattleContext, BattleState, Coord } from "@tk/engine";

/** 좌표 집합 키 */
function key(x: number, y: number): string {
  return `${x},${y}`;
}

/**
 * unitId가 위협하는(다음 1행동으로 공격 가능한) 칸 목록.
 * @returns 좌표 정렬된 배열. 유닛 없음/퇴각이면 빈 배열.
 */
export function threatTiles(ctx: BattleContext, state: BattleState, unitId: string): Coord[] {
  const unit = state.units.find((u) => u.id === unitId);
  if (!unit || unit.retreated) return [];

  const { width, height } = ctx.map;
  const rMin = unit.rangeMin;
  const rMax = unit.rangeMax;

  // 발판 = 이동 도달 칸 ∪ 현위치 (getMovableTiles는 보통 현위치를 포함하지만 방어적으로 추가)
  const stands = getMovableTiles(ctx, state, unitId);
  const standSet = new Set<string>();
  for (const s of stands) standSet.add(key(s.x, s.y));
  standSet.add(key(unit.x, unit.y));

  const out = new Set<string>();
  for (const sk of standSet) {
    const [sx, sy] = sk.split(",").map(Number) as [number, number];
    // 그 발판에서 사거리 도넛(맨해튼 rMin~rMax) 안의 모든 칸
    for (let dy = -rMax; dy <= rMax; dy++) {
      const rem = rMax - Math.abs(dy);
      for (let dx = -rem; dx <= rem; dx++) {
        const d = Math.abs(dx) + Math.abs(dy);
        if (d < rMin) continue; // 간접공격 근접 사각(도넛 안쪽)
        const cx = sx + dx;
        const cy = sy + dy;
        if (cx < 0 || cy < 0 || cx >= width || cy >= height) continue;
        out.add(key(cx, cy));
      }
    }
  }

  const result: Coord[] = [];
  for (const k of out) {
    const [x, y] = k.split(",").map(Number) as [number, number];
    result.push({ x, y });
  }
  result.sort((a, b) => (a.y !== b.y ? a.y - b.y : a.x - b.x));
  return result;
}
