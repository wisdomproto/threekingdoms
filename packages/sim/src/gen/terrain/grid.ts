/**
 * 지형 격자 프리미티브 (§11-C) — 순수 + 시드 PRNG. 아키타입이 이 위에서 맵을 짠다.
 * docs/superpowers/specs/2026-06-15-terrain-grammar-design.md.
 *
 * "완전 랜덤 금지"(§11): 무작위는 scatter(엄폐 산포)에만, 그것도 주입된 mulberry32(seed)로 결정론.
 */
import type { BattleMap } from "@tk/data";

export interface TileGrid {
  width: number;
  height: number;
  cells: string[][]; // [y][x] 1글자 타일 코드
}

/** w×h 격자를 fill로 채워 생성. */
export function createGrid(width: number, height: number, fill: string): TileGrid {
  const cells = Array.from({ length: height }, () => Array.from({ length: width }, () => fill));
  return { width, height, cells };
}

const inBounds = (g: TileGrid, x: number, y: number) => x >= 0 && y >= 0 && x < g.width && y < g.height;

export function setTile(g: TileGrid, x: number, y: number, ch: string): void {
  if (inBounds(g, x, y)) g.cells[y]![x] = ch;
}

/** 사각 영역 [x0,x1]×[y0,y1](경계 포함, 격자 밖은 클램프)을 ch로. */
export function fillRect(g: TileGrid, x0: number, y0: number, x1: number, y1: number, ch: string): void {
  const lx = Math.max(0, Math.min(x0, x1)), hx = Math.min(g.width - 1, Math.max(x0, x1));
  const ly = Math.max(0, Math.min(y0, y1)), hy = Math.min(g.height - 1, Math.max(y0, y1));
  for (let y = ly; y <= hy; y++) for (let x = lx; x <= hx; x++) g.cells[y]![x] = ch;
}

/** 세로 벽(col x 전체 = ch). [gapY0,gapY1] 행은 gapCh(성문 등 통행 갭). */
export function vWall(g: TileGrid, x: number, ch: string, gapY0: number, gapY1: number, gapCh: string): void {
  if (x < 0 || x >= g.width) return;
  for (let y = 0; y < g.height; y++) {
    g.cells[y]![x] = y >= gapY0 && y <= gapY1 ? gapCh : ch;
  }
}

/** 가로 하천(row y 전체 = ch). bridgeX 열은 bridgeCh(다리 통행 갭). */
export function hRiver(g: TileGrid, y: number, ch: string, bridgeX: number, bridgeCh: string): void {
  if (y < 0 || y >= g.height) return;
  for (let x = 0; x < g.width; x++) {
    g.cells[y]![x] = x === bridgeX ? bridgeCh : ch;
  }
}

/** 각 칸을 density 확률로 ch로(주입 rng). mask(x,y)=false인 칸은 보호. */
export function scatter(
  g: TileGrid, ch: string, density: number, rng: () => number, mask?: (x: number, y: number) => boolean,
): void {
  for (let y = 0; y < g.height; y++) {
    for (let x = 0; x < g.width; x++) {
      if (mask && !mask(x, y)) continue;
      if (rng() < density) g.cells[y]![x] = ch;
    }
  }
}

/** 웨이포인트를 축정렬(가로→세로) 구간으로 잇는 통로를 width 두께로 ch 깎기. */
export function carvePath(g: TileGrid, waypoints: { x: number; y: number }[], width: number, ch: string): void {
  const half = Math.floor(width / 2);
  const stamp = (cx: number, cy: number) => {
    for (let dy = -half; dy <= half; dy++) for (let dx = -half; dx <= half; dx++) setTile(g, cx + dx, cy + dy, ch);
  };
  for (let i = 1; i < waypoints.length; i++) {
    const a = waypoints[i - 1]!, b = waypoints[i]!;
    const stepX = Math.sign(b.x - a.x), stepY = Math.sign(b.y - a.y);
    let x = a.x, y = a.y;
    stamp(x, y);
    while (x !== b.x) { x += stepX; stamp(x, y); } // 가로 먼저
    while (y !== b.y) { y += stepY; stamp(x, y); } // 그다음 세로
  }
}

/** mulberry32 — 결정론 32bit PRNG([0,1)). 같은 시드 같은 수열. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** TileGrid → BattleMap(행 문자열화). legend = 타일코드→지형id. */
export function toBattleMap(
  g: TileGrid, legend: Record<string, string>, id: string, name: string,
): BattleMap {
  return {
    id, name, width: g.width, height: g.height,
    tileLegend: legend,
    tiles: g.cells.map((row) => row.join("")),
  };
}
