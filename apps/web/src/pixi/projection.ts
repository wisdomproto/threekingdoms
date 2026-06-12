/**
 * 좌표 투영의 단일 관문 (설계 §2.2 Projection).
 * 모든 grid↔world 변환은 반드시 이 파일을 거친다 — 쿼터뷰(아이소) 전환 시 이 파일만 교체.
 * v0는 직교(orthogonal) 투영: 엔진이 보는 것 = 화면에 보이는 것.
 *
 * pixi.js import 금지 — vitest node 환경에서 검증되는 순수 계층.
 */
import type { Coord } from "@tk/engine";

export const TILE_SIZE = 48;

export interface WorldPoint {
  x: number;
  y: number;
}

/** 그리드 좌표 → 해당 타일 "중심"의 월드 좌표 (유닛/하이라이트 앵커 0.5 기준) */
export function gridToWorld(coord: Coord): WorldPoint {
  return {
    x: coord.x * TILE_SIZE + TILE_SIZE / 2,
    y: coord.y * TILE_SIZE + TILE_SIZE / 2,
  };
}

/** 월드 좌표 → 그 점을 포함하는 타일의 그리드 좌표. 범위 검증은 호출자 책임. */
export function worldToGrid(point: WorldPoint): Coord {
  return {
    x: Math.floor(point.x / TILE_SIZE),
    y: Math.floor(point.y / TILE_SIZE),
  };
}

/**
 * 깊이 정렬 키 — UnitLayer의 zIndex로 사용 (sortableChildren).
 * 직교 투영에선 y 그대로지만, 아이소 전환 시 이 함수가 깊이 규칙의 교체점이 된다.
 */
export function depthOf(y: number): number {
  return y;
}
