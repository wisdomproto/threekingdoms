/**
 * 순수 제스처 인식기 (설계 §2.2 gesture) — 포인터 이벤트 시퀀스를 탭/팬/핀치로 분류.
 * DOM/Pixi 의존 없음: 타임스탬프를 입력으로 받아 결정론적으로 동작 → vitest 합성 시퀀스 검증.
 * InputAdapter(4단계)가 Pixi pointer 이벤트를 PointerSample로 변환해 먹인다.
 *
 * 임계값 (설계 §2.2): 슬롭 10px(CSS px 기준) / 탭 300ms / 핀치 2포인터.
 */

export const TAP_SLOP_PX = 10;
export const TAP_MAX_MS = 300;

export interface PointerSample {
  id: number;
  x: number;
  y: number;
  /** ms 단위 타임스탬프 (performance.now() 등) — 순수성 유지를 위해 외부 주입 */
  t: number;
}

export type GestureEvent =
  | { type: "tap"; x: number; y: number }
  | { type: "panStart"; x: number; y: number }
  | { type: "panMove"; dx: number; dy: number }
  | { type: "panEnd" }
  | { type: "pinchStart"; centerX: number; centerY: number; distance: number }
  /** scale = 현재 두 포인터 거리 / pinchStart 시점 거리 */
  | { type: "pinchMove"; centerX: number; centerY: number; scale: number }
  | { type: "pinchEnd" };

type Mode = "idle" | "pending" | "pan" | "pinch" | "rejected";

interface TrackedPointer {
  startX: number;
  startY: number;
  x: number;
  y: number;
  startT: number;
}

export class GestureRecognizer {
  private mode: Mode = "idle";
  private pointers = new Map<number, TrackedPointer>();
  private lastX = 0;
  private lastY = 0;
  private pinchStartDist = 1;

  pointerDown(p: PointerSample): GestureEvent[] {
    if (this.pointers.size === 0) {
      this.pointers.set(p.id, { startX: p.x, startY: p.y, x: p.x, y: p.y, startT: p.t });
      this.mode = "pending";
      return [];
    }
    if (this.pointers.size === 1) {
      const events: GestureEvent[] = [];
      if (this.mode === "pan") events.push({ type: "panEnd" });
      this.pointers.set(p.id, { startX: p.x, startY: p.y, x: p.x, y: p.y, startT: p.t });
      this.mode = "pinch";
      const { centerX, centerY, distance } = this.pinchGeometry();
      this.pinchStartDist = distance > 0 ? distance : 1;
      events.push({ type: "pinchStart", centerX, centerY, distance });
      return events;
    }
    // 3번째 이상 포인터는 추적하지 않는다 (핀치는 2포인터 고정)
    return [];
  }

  pointerMove(p: PointerSample): GestureEvent[] {
    const pt = this.pointers.get(p.id);
    if (!pt) return [];
    pt.x = p.x;
    pt.y = p.y;
    switch (this.mode) {
      case "pending": {
        if (Math.hypot(p.x - pt.startX, p.y - pt.startY) > TAP_SLOP_PX) {
          this.mode = "pan";
          this.lastX = p.x;
          this.lastY = p.y;
          return [{ type: "panStart", x: p.x, y: p.y }];
        }
        return [];
      }
      case "pan": {
        const dx = p.x - this.lastX;
        const dy = p.y - this.lastY;
        this.lastX = p.x;
        this.lastY = p.y;
        return [{ type: "panMove", dx, dy }];
      }
      case "pinch": {
        const { centerX, centerY, distance } = this.pinchGeometry();
        return [{ type: "pinchMove", centerX, centerY, scale: distance / this.pinchStartDist }];
      }
      default:
        return [];
    }
  }

  pointerUp(p: PointerSample): GestureEvent[] {
    const pt = this.pointers.get(p.id);
    if (!pt) return [];
    this.pointers.delete(p.id);
    switch (this.mode) {
      case "pending": {
        this.mode = "idle";
        const within =
          p.t - pt.startT <= TAP_MAX_MS &&
          Math.hypot(p.x - pt.startX, p.y - pt.startY) <= TAP_SLOP_PX;
        return within ? [{ type: "tap", x: p.x, y: p.y }] : [];
      }
      case "pan": {
        this.mode = "idle";
        return [{ type: "panEnd" }];
      }
      case "pinch": {
        // 핀치가 끝난 뒤 남은 포인터는 탭/팬으로 재해석하지 않는다 (오입력 방지)
        this.mode = this.pointers.size > 0 ? "rejected" : "idle";
        return [{ type: "pinchEnd" }];
      }
      case "rejected": {
        if (this.pointers.size === 0) this.mode = "idle";
        return [];
      }
      default:
        return [];
    }
  }

  /** pointercancel 등 — 진행 중 제스처를 정리하고 초기화 */
  cancel(): GestureEvent[] {
    const events: GestureEvent[] =
      this.mode === "pan"
        ? [{ type: "panEnd" }]
        : this.mode === "pinch"
          ? [{ type: "pinchEnd" }]
          : [];
    this.pointers.clear();
    this.mode = "idle";
    return events;
  }

  private pinchGeometry(): { centerX: number; centerY: number; distance: number } {
    const pts = [...this.pointers.values()];
    const a = pts[0];
    const b = pts[1];
    if (!a || !b) throw new Error("pinchGeometry: 포인터 2개 필요");
    return {
      centerX: (a.x + b.x) / 2,
      centerY: (a.y + b.y) / 2,
      distance: Math.hypot(b.x - a.x, b.y - a.y),
    };
  }
}
