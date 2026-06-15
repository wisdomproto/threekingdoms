/**
 * 시드 고정 전투 RNG (2026-06-16 §2-1 전환 — docs/reference/yeonggeoljeon-rifine-combat.md).
 *
 * 계약(Phase B 이후 소비 시 필수):
 *  - 모든 전투 확률은 BattleState.rngState로만 굴린다(벽시계·Math.random 금지) → 시드 재현·세이브스컴 방지.
 *  - 롤로 갈린 결과(명중/빗맞음·분산 피해·상태이상 발동)는 **반드시 BattleEvent에 실어** 프레젠터 투영이
 *    커밋 상태와 일치하게 한다("이벤트가 상태 변화를 전부 서술한다" — dev diffSnapshot 단언). rngState 전진도
 *    그 이벤트 적용으로 재현된다. 누락 시 기존 드레인 단언이 자동 적발한다.
 */

/** mulberry32 — 순수 함수형: [0,1) 값과 다음 상태를 반환 */
export function nextRandom(state: number): [number, number] {
  const t = (state + 0x6d2b79f5) | 0;
  let r = Math.imul(t ^ (t >>> 15), 1 | t);
  r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
  return [((r ^ (r >>> 14)) >>> 0) / 4294967296, t];
}
