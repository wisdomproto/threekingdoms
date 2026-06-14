/**
 * InputAdapter (설계 §2.2) — stage 전역 pointer → GestureRecognizer 분류 →
 * 탭이면 worldToGrid 변환 후 store.dispatchUi({type:'tapTile', coord}), 팬/핀치는 카메라로.
 * stage는 카메라 변환이 적용되지 않으므로 e.global = 스크린 px — 그대로 인식기에 먹인다.
 * 카메라는 항상 자유 (설계 §4): animating/enemyTurn 중에도 팬/줌은 여기서 처리되어 동작한다.
 */
import type { Container, FederatedPointerEvent, Rectangle } from "pixi.js";
import type { Coord } from "@tk/engine";
import type { UiEvent } from "../battle/inputMachine";
import { GestureRecognizer, type GestureEvent } from "./gesture";
import { worldToGrid } from "./projection";
import type { CameraController } from "./camera";

export interface UiDispatcher {
  dispatchUi(event: UiEvent): void;
}

export interface InputAdapterOptions {
  stage: Container;
  /** stage.hitArea로 쓸 스크린 rect (app.screen — resize 시 Pixi가 갱신) */
  screen: Rectangle;
  camera: CameraController;
  store: UiDispatcher;
  mapWidth: number;
  mapHeight: number;
  /**
   * 조회(호버/탭) 콜백 (Tier 1-2/1-3). 데스크톱 호버(pointermove)·모바일 탭 시 그 칸 좌표를,
   * 맵 밖이거나 호버가 풀리면 null을 넘긴다. inputMachine과 독립 — 렌더러가 유닛 해석·위협범위로 잇는다.
   * 팬/핀치(드래그) 중에는 호버 갱신을 보내지 않는다(조회가 깜빡이지 않게).
   */
  onInspect?: (coord: Coord | null) => void;
}

export class InputAdapter {
  private readonly opts: InputAdapterOptions;
  private readonly recognizer = new GestureRecognizer();
  private pinchBaseScale = 1;

  constructor(opts: InputAdapterOptions) {
    this.opts = opts;
  }

  attach(): void {
    const { stage, screen } = this.opts;
    stage.eventMode = "static";
    stage.hitArea = screen;
    stage.on("pointerdown", this.onDown);
    stage.on("pointermove", this.onMove);
    stage.on("pointerup", this.onUp);
    stage.on("pointerupoutside", this.onUp);
    stage.on("pointercancel", this.onCancel);
  }

  detach(): void {
    const { stage } = this.opts;
    stage.off("pointerdown", this.onDown);
    stage.off("pointermove", this.onMove);
    stage.off("pointerup", this.onUp);
    stage.off("pointerupoutside", this.onUp);
    stage.off("pointercancel", this.onCancel);
  }

  private readonly onDown = (e: FederatedPointerEvent): void => {
    this.process(this.recognizer.pointerDown(this.sample(e)));
  };

  private readonly onMove = (e: FederatedPointerEvent): void => {
    const events = this.recognizer.pointerMove(this.sample(e));
    this.process(events);
    // 데스크톱 호버 조회 (Tier 1-2): 드래그(팬/핀치)가 시작되지 않은 동안만 칸을 조회.
    // 터치는 hover가 없어 거의 발화하지 않고, 마우스 이동에서만 의미가 있다.
    if (this.opts.onInspect && !events.some((g) => g.type === "panMove" || g.type === "pinchMove")) {
      this.opts.onInspect(this.toCoordOrNull(e.global.x, e.global.y));
    }
  };

  private readonly onUp = (e: FederatedPointerEvent): void => {
    this.process(this.recognizer.pointerUp(this.sample(e)));
  };

  private readonly onCancel = (): void => {
    this.process(this.recognizer.cancel());
  };

  private sample(e: FederatedPointerEvent): { id: number; x: number; y: number; t: number } {
    return { id: e.pointerId, x: e.global.x, y: e.global.y, t: performance.now() };
  }

  /** 스크린 px → 맵 안 그리드 좌표, 맵 밖이면 null (호버·탭 공용) */
  private toCoordOrNull(screenX: number, screenY: number): Coord | null {
    const world = this.opts.camera.screenToWorld({ x: screenX, y: screenY });
    const coord = worldToGrid(world);
    if (
      coord.x < 0 ||
      coord.y < 0 ||
      coord.x >= this.opts.mapWidth ||
      coord.y >= this.opts.mapHeight
    ) {
      return null;
    }
    return coord;
  }

  private process(events: GestureEvent[]): void {
    for (const g of events) {
      switch (g.type) {
        case "tap": {
          const coord = this.toCoordOrNull(g.x, g.y);
          if (coord) {
            // 모바일 탭-조회 (Tier 1-2): 탭한 칸을 조회 채널에도 전달.
            // 내 활성 유닛 선택은 inputMachine이 처리하므로(idle→selected) 조회가 그 흐름을
            // 가로채지 않는다 — 렌더러가 "선택 가능 아군이면 조회 무시" 규칙으로 거른다.
            this.opts.onInspect?.(coord);
            this.opts.store.dispatchUi({ type: "tapTile", coord });
          }
          break;
        }
        case "panMove":
          this.opts.camera.panBy(g.dx, g.dy);
          break;
        case "pinchStart":
          this.pinchBaseScale = this.opts.camera.current.scale;
          break;
        case "pinchMove":
          this.opts.camera.zoomAt(
            { x: g.centerX, y: g.centerY },
            this.pinchBaseScale * g.scale,
          );
          break;
        default:
          break; // panStart/panEnd/pinchEnd — 카메라에 추가 동작 없음
      }
    }
  }
}
