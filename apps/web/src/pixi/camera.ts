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

/**
 * 월드 좌표 worldPoint가 현재 뷰포트 중앙 ±margin 범위 안에 있는지 판정.
 * margin=0.35(기본)이면 화면 중앙 70%×70% 사각형 안에 있을 때 true.
 * 자동 포커스 발동 조건으로 사용 — 이미 충분히 화면 안에 있으면 카메라를 강제 이동하지 않는다.
 *
 * @param state  현재 카메라 상태
 * @param viewport  화면 크기 (px)
 * @param worldPoint  검사할 월드 좌표 (px)
 * @param margin  0~0.5, 기본 0.35
 */
export function isInCenter(
  state: CameraState,
  viewport: Size,
  worldPoint: Point,
  margin = 0.35,
): boolean {
  const screen = worldToScreen(state, worldPoint);
  const cx = viewport.width / 2;
  const cy = viewport.height / 2;
  const halfW = viewport.width * margin;
  const halfH = viewport.height * margin;
  return (
    screen.x >= cx - halfW &&
    screen.x <= cx + halfW &&
    screen.y >= cy - halfH &&
    screen.y <= cy + halfH
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Pixi 적용부 (설계 §2.2 CameraController) — 위 수학부의 유일한 소비자.
// pixi.js를 직접 import하지 않고 구조적 타입(CameraTarget)으로 컨테이너를 받는다 —
// camera.test.ts(node 환경, Pixi 무균 지대)가 이 파일을 계속 import할 수 있어야 하기 때문.
// 트윈 진행은 BattleRenderer가 ticker에서 update(deltaMS)를 호출해 구동한다.
// ─────────────────────────────────────────────────────────────────────────────

/** Pixi Container의 구조적 부분집합 — scale/position만 조작 */
export interface CameraTarget {
  scale: { set(value: number): void };
  position: { set(x: number, y: number): void };
}

interface FocusTween {
  fromOx: number;
  fromOy: number;
  toOx: number;
  toOy: number;
  fromScale: number;
  toScale: number;
  elapsed: number;
  duration: number;
}

function easeInOut(t: number): number {
  return t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
}

export class CameraController {
  private state: CameraState;
  private viewport: Size;
  private readonly worldSize: Size;
  private readonly target: CameraTarget;
  private focusTween: FocusTween | null = null;

  constructor(target: CameraTarget, worldSize: Size, viewport: Size, initialScale = 1) {
    this.target = target;
    this.worldSize = worldSize;
    this.viewport = viewport;
    this.state = clampPan({ scale: clampZoom(initialScale), ox: 0, oy: 0 }, viewport, worldSize);
    this.apply();
  }

  get current(): CameraState {
    return this.state;
  }

  resize(viewport: Size): void {
    this.viewport = viewport;
    this.state = clampPan(this.state, viewport, this.worldSize);
    this.apply();
  }

  panBy(dx: number, dy: number): void {
    this.focusTween = null; // 수동 팬이 자동 포커스를 이긴다
    this.state = panBy(this.state, dx, dy, this.viewport, this.worldSize);
    this.apply();
  }

  zoomAt(anchor: Point, targetScale: number): void {
    this.focusTween = null;
    this.state = zoomAt(this.state, anchor, targetScale, this.viewport, this.worldSize);
    this.apply();
  }

  screenToWorld(p: Point): Point {
    return screenToWorld(this.state, p);
  }

  /** 컬링용 — 현재 뷰포트가 비추는 월드 좌표 rect */
  viewWorldRect(): { x: number; y: number; width: number; height: number } {
    const tl = screenToWorld(this.state, { x: 0, y: 0 });
    return {
      x: tl.x,
      y: tl.y,
      width: this.viewport.width / this.state.scale,
      height: this.viewport.height / this.state.scale,
    };
  }

  /**
   * worldPoint(월드 px)가 현재 뷰포트 중앙 ±margin(기본 0.35) 안에 있는지 판정.
   * 자동 포커스 발동 조건으로 사용 — true이면 카메라 이동 생략.
   */
  isInCenter(worldPoint: Point, margin = 0.35): boolean {
    return isInCenter(this.state, this.viewport, worldPoint, margin);
  }

  /**
   * worldPoint(월드 px)를 화면 중앙으로 — ms=0이면 즉시 스냅.
   * targetScale을 주면 줌도 함께 트윈한다("기본 줌 복귀" 버튼용). 생략하면 현재 줌 유지
   * (자동 포커스 추적은 줌을 건드리지 않아야 하므로 기본 동작은 그대로).
   */
  focusOn(worldPoint: Point, ms: number, targetScale?: number): void {
    const toScale = targetScale !== undefined ? clampZoom(targetScale) : this.state.scale;
    // 목표 오프셋은 도착 줌 기준으로 계산 — 트윈 종료 시 정확히 중앙 정렬된다.
    const desired = clampPan(
      {
        scale: toScale,
        ox: this.viewport.width / 2 - worldPoint.x * toScale,
        oy: this.viewport.height / 2 - worldPoint.y * toScale,
      },
      this.viewport,
      this.worldSize,
    );
    if (ms <= 0) {
      this.focusTween = null;
      this.state = desired;
      this.apply();
      return;
    }
    this.focusTween = {
      fromOx: this.state.ox,
      fromOy: this.state.oy,
      toOx: desired.ox,
      toOy: desired.oy,
      fromScale: this.state.scale,
      toScale: desired.scale,
      elapsed: 0,
      duration: ms,
    };
  }

  /** ticker에서 호출 — 포커스 트윈 진행 */
  update(deltaMS: number): void {
    const tw = this.focusTween;
    if (!tw) return;
    tw.elapsed += deltaMS;
    const t = Math.min(1, tw.elapsed / tw.duration);
    const k = easeInOut(t);
    this.state = {
      scale: tw.fromScale + (tw.toScale - tw.fromScale) * k,
      ox: tw.fromOx + (tw.toOx - tw.fromOx) * k,
      oy: tw.fromOy + (tw.toOy - tw.fromOy) * k,
    };
    if (t >= 1) this.focusTween = null;
    this.apply();
  }

  private apply(): void {
    this.target.scale.set(this.state.scale);
    this.target.position.set(this.state.ox, this.state.oy);
  }
}
