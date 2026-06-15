/**
 * 지형 아키타입 3종 (§11-C) — 각자 결정론 레이아웃 함수. 격자 = 진실의 원천(§3-1).
 * "완전 랜덤 금지": 레이아웃은 문법(벽/병목/통로), 무작위는 엄폐 산포에만(시드 PRNG).
 */
import {
  createGrid, setTile, vWall, scatter, carvePath, mulberry32, type TileGrid,
} from "./grid";
import type { Coord } from "@tk/engine";

export interface ArchParams {
  width: number;
  height: number;
  seed: number;
  chokeWidth?: number; // gateBreakthrough — 성문 폭
  coverDensity?: number; // pincerDefense — 엄폐 밀도
  corridorWidth?: number; // escapeCorridor — 통로 폭
}

export interface ArchOutput {
  grid: TileGrid;
  spawn: Coord;
  goal: Coord;
}

/** 관문돌파 — 수직 성벽 + 성문 병목. spawn 좌, goal 벽 너머 우. */
export function gateBreakthrough(p: ArchParams): ArchOutput {
  const { width: w, height: h, seed } = p;
  const chokeWidth = p.chokeWidth ?? 3;
  const g = createGrid(w, h, ".");
  scatter(g, "g", 0.15, mulberry32(seed)); // 초원 결
  scatter(g, "f", 0.06, mulberry32(seed + 1)); // 삼림 엄폐(통행 가능)
  const wallX = Math.floor(w / 2);
  const cy = Math.floor(h / 2);
  const gy0 = cy - Math.floor(chokeWidth / 2);
  const gy1 = gy0 + chokeWidth - 1; // chokeWidth 0이면 gy1<gy0 → 갭 없음(벽 막힘)
  vWall(g, wallX, "#", gy0, gy1, "G"); // 산포 뒤 적용 → 벽/문이 산포를 덮음
  const spawn = { x: 2, y: cy };
  const goal = { x: w - 3, y: cy };
  setTile(g, spawn.x, spawn.y, ".");
  setTile(g, goal.x, goal.y, ".");
  return { grid: g, spawn, goal };
}

/** 협공방어 — 개활지 + 산발 엄폐(중앙 비움). spawn 중앙, goal 가장자리. */
export function pincerDefense(p: ArchParams): ArchOutput {
  const { width: w, height: h, seed } = p;
  const coverDensity = p.coverDensity ?? 0.12;
  const g = createGrid(w, h, ".");
  scatter(g, "g", 0.2, mulberry32(seed));
  const cx = Math.floor(w / 2);
  const cy = Math.floor(h / 2);
  const R = Math.max(2, Math.floor(Math.min(w, h) / 6)); // 중앙 개방 반경
  scatter(g, "f", coverDensity, mulberry32(seed + 1), (x, y) => Math.abs(x - cx) > R || Math.abs(y - cy) > R);
  const spawn = { x: cx, y: cy };
  const goal = { x: w - 3, y: cy };
  setTile(g, spawn.x, spawn.y, ".");
  setTile(g, goal.x, goal.y, ".");
  return { grid: g, spawn, goal };
}

/** 탈출 — 절벽으로 막은 격자에 굽은 통로 carve. spawn 한쪽, goal 반대 끝. */
export function escapeCorridor(p: ArchParams): ArchOutput {
  const { width: w, height: h } = p;
  const corridorWidth = p.corridorWidth ?? 3;
  const g = createGrid(w, h, "c"); // 절벽(통행 불가)으로 채우고
  const cy = Math.floor(h / 2);
  const topY = Math.max(1, cy - Math.floor(h * 0.3));
  // 좌(cy) → 위 → 우 → 아래(cy) 굽은 통로(serpentine).
  const wps: Coord[] = [
    { x: 2, y: cy },
    { x: Math.floor(w * 0.35), y: cy },
    { x: Math.floor(w * 0.35), y: topY },
    { x: Math.floor(w * 0.65), y: topY },
    { x: Math.floor(w * 0.65), y: cy },
    { x: w - 3, y: cy },
  ];
  carvePath(g, wps, corridorWidth, ".");
  const spawn = { x: 2, y: cy };
  const goal = { x: w - 3, y: cy };
  setTile(g, spawn.x, spawn.y, ".");
  setTile(g, goal.x, goal.y, ".");
  return { grid: g, spawn, goal };
}
