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
    this.process(this.recognizer.pointerMove(this.sample(e)));
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

  private process(events: GestureEvent[]): void {
    for (const g of events) {
      switch (g.type) {
        case "tap": {
          const world = this.opts.camera.screenToWorld({ x: g.x, y: g.y });
          const coord: Coord = worldToGrid(world);
          if (
            coord.x >= 0 &&
            coord.y >= 0 &&
            coord.x < this.opts.mapWidth &&
            coord.y < this.opts.mapHeight
          ) {
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
