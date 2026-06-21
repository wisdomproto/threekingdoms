// apps/web/src/pixi/objects/autotile.ts
/** 성벽 오토타일 — 4-이웃 비트마스크(N=1,E=2,S=4,W=8) → 세그먼트 + 시계방향 회전. pixi-free(순수). */
export type WallSeg = "single" | "end" | "straight" | "corner" | "tee" | "cross";
export interface WallTile { seg: WallSeg; rot: 0 | 90 | 180 | 270; }

const TABLE: Record<number, WallTile> = {
  0:  { seg: "single",   rot: 0 },
  1:  { seg: "end",      rot: 270 },
  2:  { seg: "end",      rot: 0 },
  4:  { seg: "end",      rot: 90 },
  8:  { seg: "end",      rot: 180 },
  10: { seg: "straight", rot: 0 },
  5:  { seg: "straight", rot: 90 },
  6:  { seg: "corner",   rot: 0 },
  12: { seg: "corner",   rot: 90 },
  9:  { seg: "corner",   rot: 180 },
  3:  { seg: "corner",   rot: 270 },
  14: { seg: "tee",      rot: 0 },
  13: { seg: "tee",      rot: 90 },
  11: { seg: "tee",      rot: 180 },
  7:  { seg: "tee",      rot: 270 },
  15: { seg: "cross",    rot: 0 },
};

export function wallTile(mask: number): WallTile {
  // TABLE is exhaustive over all 16 values of a 4-bit mask
  return TABLE[mask & 0b1111]!;
}
