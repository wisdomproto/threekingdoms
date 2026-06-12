/**
 * 카메라 수학부 — 순수 함수만 (설계 §2.2 CameraController).
 * Pixi container에 scale/position을 실제로 적용하는 부분은 4단계의 CameraController가 담당하고,
 * 여기는 클램프/좌표 변환 계산만 둔다. pixi.js import 금지.
 *
 * 좌표 모델: screen = world * scale + offset(ox, oy)
 * (Pixi에선 container.scale.set(scale); container.position.set(ox, oy) 에 대응)
 */
import { TILE_SIZE } from "./projection";

/** 줌 하한 — 단, 타일 화면 크기 ≥ MIN_TILE_SCREEN_PX 불변량이 우선한다 */
export const ZOOM_MIN = 0.5;
export const ZOOM_MAX = 2.0;
/**
 * 오탭률 기준 불변량: 최소줌에서도 타일이 화면에서 24px 이상이어야 한다 (설계 §2.2).
 * TILE_SIZE=48 기준 0.5 × 48 = 24px로 ZOOM_MIN과 정확히 일치 — 타일 크기를 바꾸면
 * minZoom이 자동으로 따라온다.
 */
export const MIN_TILE_SCREEN_PX = 24;

export interface CameraState {
  scale: number;
  ox: number;
  oy: number;
}

export interface Size {
  width: number;
  height: number;
}

export interface Point {
  x: number;
  y: number;
}

/** 타일 ≥24px 불변량을 반영한 실효 줌 하한 */
export function minZoom(tileSize: number = TILE_SIZE): number {
  return Math.max(ZOOM_MIN, MIN_TILE_SCREEN_PX / tileSize);
}

export function clampZoom(scale: number, tileSize: number = TILE_SIZE): number {
  return Math.min(ZOOM_MAX, Math.max(minZoom(tileSize), scale));
}

export function worldToScreen(state: CameraState, p: Point): Point {
  return { x: p.x * state.scale + state.ox, y: p.y * state.scale + state.oy };
}

export function screenToWorld(state: CameraState, p: Point): Point {
  return { x: (p.x - state.ox) / state.scale, y: (p.y - state.oy) / state.scale };
}

/** 한 축의 팬 클램프: 맵이 뷰포트보다 크면 빈 가장자리 금지, 작으면 중앙 정렬 */
function clampAxis(offset: number, viewport: number, scaledWorld: number): number {
  if (scaledWorld <= viewport) return (viewport - scaledWorld) / 2;
  return Math.min(0, Math.max(viewport - scaledWorld, offset));
}

/**
 * 맵 경계 팬 클램프. worldSize는 스케일 적용 전 월드 px (맵 width×TILE_SIZE 등).
 */
export function clampPan(state: CameraState, viewport: Size, worldSize: Size): CameraState {
  return {
    scale: state.scale,
    ox: clampAxis(state.ox, viewport.width, worldSize.width * state.scale),
    oy: clampAxis(state.oy, viewport.height, worldSize.height * state.scale),
  };
}

/** 팬 제스처 적용: 스크린 px 델타 → 오프셋 이동 + 경계 클램프 */
export function panBy(
  state: CameraState,
  dx: number,
  dy: number,
  viewport: Size,
  worldSize: Size,
): CameraState {
  return clampPan({ scale: state.scale, ox: state.ox + dx, oy: state.oy + dy }, viewport, worldSize);
}

/**
 * 앵커 고정 줌: 스크린 좌표 anchor 아래의 월드 점이 줌 전후 동일하게 유지된다.
 * (핀치 중심/마우스 휠 위치 기준 줌). 줌 클램프 → 오프셋 재계산 → 팬 클램프 순.
 * 주의: 팬 클램프가 개입하는 맵 가장자리에선 앵커 보존이 의도적으로 깨진다(빈 화면 방지 우선).
 */
export function zoomAt(
  state: CameraState,
  anchor: Point,
  targetScale: number,
  viewport: Size,
  worldSize: Size,
  tileSize: number = TILE_SIZE,
): CameraState {
  const scale = clampZoom(targetScale, tileSize);
  const world = screenToWorld(state, anchor);
  const next: CameraState = {
    scale,
    ox: anchor.x - world.x * scale,
    oy: anchor.y - world.y * scale,
  };
  return clampPan(next, viewport, worldSize);
}
