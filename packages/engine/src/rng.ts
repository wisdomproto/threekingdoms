/** mulberry32 — 순수 함수형: [0,1) 값과 다음 상태를 반환 */
export function nextRandom(state: number): [number, number] {
  const t = (state + 0x6d2b79f5) | 0;
  let r = Math.imul(t ^ (t >>> 15), 1 | t);
  r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
  return [((r ^ (r >>> 14)) >>> 0) / 4294967296, t];
}
