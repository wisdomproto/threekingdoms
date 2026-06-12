import { describe, expect, it } from "vitest";
import { GestureRecognizer, TAP_MAX_MS, TAP_SLOP_PX, type GestureEvent } from "../gesture";

function types(events: GestureEvent[]): string[] {
  return events.map((e) => e.type);
}

describe("탭", () => {
  it("슬롭·시간 내 down→up은 tap", () => {
    const g = new GestureRecognizer();
    expect(g.pointerDown({ id: 1, x: 10, y: 10, t: 0 })).toEqual([]);
    expect(g.pointerUp({ id: 1, x: 12, y: 13, t: 100 })).toEqual([{ type: "tap", x: 12, y: 13 }]);
  });

  it("슬롭(10px) 이내 미세 이동은 탭을 깨지 않는다", () => {
    const g = new GestureRecognizer();
    g.pointerDown({ id: 1, x: 50, y: 50, t: 0 });
    expect(g.pointerMove({ id: 1, x: 53, y: 53, t: 50 })).toEqual([]); // ~4.2px
    expect(types(g.pointerUp({ id: 1, x: 52, y: 51, t: 120 }))).toEqual(["tap"]);
  });

  it("300ms 초과 홀드는 탭이 아니다", () => {
    const g = new GestureRecognizer();
    g.pointerDown({ id: 1, x: 10, y: 10, t: 0 });
    expect(g.pointerUp({ id: 1, x: 10, y: 10, t: TAP_MAX_MS + 50 })).toEqual([]);
  });

  it("경계값: 정확히 300ms / 정확히 10px은 탭", () => {
    const g = new GestureRecognizer();
    g.pointerDown({ id: 1, x: 0, y: 0, t: 0 });
    expect(types(g.pointerUp({ id: 1, x: TAP_SLOP_PX, y: 0, t: TAP_MAX_MS }))).toEqual(["tap"]);
  });
});

describe("팬", () => {
  it("슬롭 초과 이동 → panStart, 이후 이동은 직전 위치 기준 델타 panMove, up은 panEnd (탭 없음)", () => {
    const g = new GestureRecognizer();
    g.pointerDown({ id: 1, x: 50, y: 50, t: 0 });
    expect(g.pointerMove({ id: 1, x: 70, y: 50, t: 50 })).toEqual([
      { type: "panStart", x: 70, y: 50 },
    ]);
    expect(g.pointerMove({ id: 1, x: 80, y: 60, t: 80 })).toEqual([
      { type: "panMove", dx: 10, dy: 10 },
    ]);
    expect(g.pointerMove({ id: 1, x: 75, y: 65, t: 110 })).toEqual([
      { type: "panMove", dx: -5, dy: 5 },
    ]);
    expect(g.pointerUp({ id: 1, x: 75, y: 65, t: 150 })).toEqual([{ type: "panEnd" }]);
  });

  it("300ms 넘게 홀드한 뒤 슬롭을 넘겨도 팬으로 인식된다 (시간 임계는 탭에만 적용)", () => {
    const g = new GestureRecognizer();
    g.pointerDown({ id: 1, x: 0, y: 0, t: 0 });
    expect(types(g.pointerMove({ id: 1, x: 30, y: 0, t: 500 }))).toEqual(["panStart"]);
  });
});

describe("핀치", () => {
  it("2포인터 down → pinchStart, 거리 변화 → pinchMove(scale=현재/시작), up → pinchEnd", () => {
    const g = new GestureRecognizer();
    g.pointerDown({ id: 1, x: 100, y: 100, t: 0 });
    expect(g.pointerDown({ id: 2, x: 200, y: 100, t: 30 })).toEqual([
      { type: "pinchStart", centerX: 150, centerY: 100, distance: 100 },
    ]);
    expect(g.pointerMove({ id: 2, x: 300, y: 100, t: 60 })).toEqual([
      { type: "pinchMove", centerX: 200, centerY: 100, scale: 2 },
    ]);
    expect(g.pointerMove({ id: 1, x: 150, y: 100, t: 90 })).toEqual([
      { type: "pinchMove", centerX: 225, centerY: 100, scale: 1.5 },
    ]);
    expect(g.pointerUp({ id: 2, x: 300, y: 100, t: 120 })).toEqual([{ type: "pinchEnd" }]);
  });

  it("핀치 종료 후 남은 포인터는 탭/팬으로 재해석되지 않는다", () => {
    const g = new GestureRecognizer();
    g.pointerDown({ id: 1, x: 0, y: 0, t: 0 });
    g.pointerDown({ id: 2, x: 100, y: 0, t: 20 });
    g.pointerUp({ id: 2, x: 100, y: 0, t: 60 }); // pinchEnd
    expect(g.pointerMove({ id: 1, x: 50, y: 50, t: 80 })).toEqual([]); // 팬 아님
    expect(g.pointerUp({ id: 1, x: 50, y: 50, t: 100 })).toEqual([]); // 탭 아님
    // 다음 제스처는 정상 동작
    g.pointerDown({ id: 3, x: 10, y: 10, t: 200 });
    expect(types(g.pointerUp({ id: 3, x: 10, y: 10, t: 250 }))).toEqual(["tap"]);
  });

  it("팬 중 두 번째 포인터 down → panEnd 후 pinchStart로 승격", () => {
    const g = new GestureRecognizer();
    g.pointerDown({ id: 1, x: 0, y: 0, t: 0 });
    g.pointerMove({ id: 1, x: 30, y: 0, t: 40 }); // panStart
    expect(types(g.pointerDown({ id: 2, x: 100, y: 0, t: 80 }))).toEqual([
      "panEnd",
      "pinchStart",
    ]);
  });

  it("3번째 포인터는 무시된다 (핀치는 2포인터 고정)", () => {
    const g = new GestureRecognizer();
    g.pointerDown({ id: 1, x: 0, y: 0, t: 0 });
    g.pointerDown({ id: 2, x: 100, y: 0, t: 20 });
    expect(g.pointerDown({ id: 3, x: 50, y: 50, t: 40 })).toEqual([]);
    expect(g.pointerMove({ id: 3, x: 60, y: 60, t: 60 })).toEqual([]);
    expect(g.pointerUp({ id: 3, x: 60, y: 60, t: 80 })).toEqual([]);
    // 기존 핀치는 계속 유효
    expect(types(g.pointerMove({ id: 2, x: 150, y: 0, t: 100 }))).toEqual(["pinchMove"]);
  });
});

describe("cancel", () => {
  it("팬 중 cancel은 panEnd를 방출하고 초기화한다", () => {
    const g = new GestureRecognizer();
    g.pointerDown({ id: 1, x: 0, y: 0, t: 0 });
    g.pointerMove({ id: 1, x: 30, y: 0, t: 40 });
    expect(g.cancel()).toEqual([{ type: "panEnd" }]);
    // 초기화 후 새 제스처 정상
    g.pointerDown({ id: 1, x: 0, y: 0, t: 100 });
    expect(types(g.pointerUp({ id: 1, x: 0, y: 0, t: 150 }))).toEqual(["tap"]);
  });

  it("pending 중 cancel은 아무것도 방출하지 않는다", () => {
    const g = new GestureRecognizer();
    g.pointerDown({ id: 1, x: 0, y: 0, t: 0 });
    expect(g.cancel()).toEqual([]);
  });
});

describe("방어적 처리", () => {
  it("추적하지 않는 포인터의 move/up은 무시", () => {
    const g = new GestureRecognizer();
    expect(g.pointerMove({ id: 9, x: 1, y: 1, t: 0 })).toEqual([]);
    expect(g.pointerUp({ id: 9, x: 1, y: 1, t: 10 })).toEqual([]);
  });
});
