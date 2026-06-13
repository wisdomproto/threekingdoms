import { describe, expect, it } from "vitest";
import {
  MIN_TILE_SCREEN_PX,
  ZOOM_MAX,
  ZOOM_MIN,
  clampPan,
  clampZoom,
  isInCenter,
  minZoom,
  panBy,
  screenToWorld,
  worldToScreen,
  zoomAt,
  type CameraState,
  type Size,
} from "../camera";
import { TILE_SIZE } from "../projection";

// 사수관 56×32 기준 월드 크기
const WORLD: Size = { width: 56 * TILE_SIZE, height: 32 * TILE_SIZE }; // 2688×1536
const VIEW: Size = { width: 800, height: 600 };

describe("clampZoom", () => {
  it("[0.5, 2.0] 범위로 클램프한다", () => {
    expect(clampZoom(0.1)).toBe(ZOOM_MIN);
    expect(clampZoom(5)).toBe(ZOOM_MAX);
    expect(clampZoom(1.3)).toBe(1.3);
  });

  it("불변량: 최소줌에서도 타일 화면 크기 ≥ 24px — 타일 크기가 바뀌어도 자동 추종", () => {
    for (const tileSize of [48, 32, 24, 16]) {
      const clamped = clampZoom(0.001, tileSize);
      expect(clamped * tileSize).toBeGreaterThanOrEqual(MIN_TILE_SCREEN_PX);
    }
    // TILE_SIZE=48에선 0.5×48=24px로 하한이 정확히 일치
    expect(minZoom(48)).toBe(0.5);
    // 더 작은 타일이면 하한이 자동으로 올라간다
    expect(minZoom(32)).toBe(0.75);
    expect(minZoom(16)).toBe(1.5);
  });
});

describe("clampPan", () => {
  it("맵이 뷰포트보다 클 때 가장자리 밖으로 팬 불가", () => {
    const s = (ox: number, oy: number): CameraState => ({ scale: 1, ox, oy });
    // 오른쪽/아래 한계: viewport - world*scale
    expect(clampPan(s(100, 50), VIEW, WORLD)).toEqual({ scale: 1, ox: 0, oy: 0 });
    expect(clampPan(s(-9999, -9999), VIEW, WORLD)).toEqual({
      scale: 1,
      ox: VIEW.width - WORLD.width,
      oy: VIEW.height - WORLD.height,
    });
    // 범위 내 값은 그대로
    expect(clampPan(s(-500, -300), VIEW, WORLD)).toEqual({ scale: 1, ox: -500, oy: -300 });
  });

  it("맵이 뷰포트보다 작으면 중앙 정렬", () => {
    const state: CameraState = { scale: 0.25, ox: -100, oy: -100 };
    const result = clampPan(state, VIEW, WORLD); // 672×384 < 800×600
    expect(result.ox).toBe((VIEW.width - WORLD.width * 0.25) / 2);
    expect(result.oy).toBe((VIEW.height - WORLD.height * 0.25) / 2);
  });

  it("panBy는 델타 적용 후 클램프한다", () => {
    const state: CameraState = { scale: 1, ox: -500, oy: -300 };
    expect(panBy(state, -10, 20, VIEW, WORLD)).toEqual({ scale: 1, ox: -510, oy: -280 });
    expect(panBy(state, 9999, 9999, VIEW, WORLD)).toEqual({ scale: 1, ox: 0, oy: 0 });
  });
});

describe("zoomAt (앵커 고정 줌)", () => {
  it("앵커 아래의 월드 좌표가 줌 전후 보존된다 (팬 클램프 비개입 구간)", () => {
    const state: CameraState = { scale: 1, ox: -500, oy: -300 };
    const anchor = { x: 400, y: 300 };
    const before = screenToWorld(state, anchor);
    const after = zoomAt(state, anchor, 1.5, VIEW, WORLD);
    const afterWorld = screenToWorld(after, anchor);
    expect(after.scale).toBe(1.5);
    expect(afterWorld.x).toBeCloseTo(before.x, 9);
    expect(afterWorld.y).toBeCloseTo(before.y, 9);
  });

  it("줌인→줌아웃 왕복도 앵커를 보존한다", () => {
    const state: CameraState = { scale: 1, ox: -800, oy: -400 };
    const anchor = { x: 123, y: 456 };
    const world = screenToWorld(state, anchor);
    const zoomedIn = zoomAt(state, anchor, 2.0, VIEW, WORLD);
    const back = zoomAt(zoomedIn, anchor, 1.0, VIEW, WORLD);
    expect(screenToWorld(zoomedIn, anchor).x).toBeCloseTo(world.x, 9);
    expect(screenToWorld(back, anchor).x).toBeCloseTo(world.x, 9);
    expect(screenToWorld(back, anchor).y).toBeCloseTo(world.y, 9);
  });

  it("목표 줌도 클램프된다", () => {
    const state: CameraState = { scale: 1, ox: -500, oy: -300 };
    expect(zoomAt(state, { x: 0, y: 0 }, 99, VIEW, WORLD).scale).toBe(ZOOM_MAX);
    expect(zoomAt(state, { x: 0, y: 0 }, 0.01, VIEW, WORLD).scale).toBe(minZoom());
  });

  it("줌 결과도 팬 클램프를 통과한다 (가장자리에서 빈 화면 금지)", () => {
    // 좌상단 구석에서 줌아웃 → 오프셋이 양수로 튀려는 것을 클램프
    const state: CameraState = { scale: 1, ox: 0, oy: 0 };
    const result = zoomAt(state, { x: 0, y: 0 }, 0.5, VIEW, WORLD);
    expect(result.ox).toBeLessThanOrEqual(0);
    expect(result.oy).toBeLessThanOrEqual(0);
  });
});

describe("worldToScreen / screenToWorld", () => {
  it("상호 역함수", () => {
    const state: CameraState = { scale: 1.5, ox: -321, oy: 87 };
    const p = { x: 1000, y: 700 };
    const round = screenToWorld(state, worldToScreen(state, p));
    expect(round.x).toBeCloseTo(p.x, 9);
    expect(round.y).toBeCloseTo(p.y, 9);
  });
});

describe("리사이즈 후 clampPan (ResizeObserver 시나리오)", () => {
  it("뷰포트 확장 후 경계 밖 pivot은 새 뷰포트 기준으로 클램프된다", () => {
    // 상황: 초기 뷰포트 23×895(DevTools 열린 상태)로 마운트 → pivot (-500, -300) 저장
    // → 뷰포트가 1280×800으로 확장(ResizeObserver 발화) → clampPan 재적용
    const prevState: CameraState = { scale: 1, ox: -500, oy: -300 };
    const newView: Size = { width: 1280, height: 800 };
    const result = clampPan(prevState, newView, WORLD); // WORLD = 2688×1536
    // 맵(2688)이 뷰(1280)보다 크므로 빈 가장자리 금지: ox ≤ 0
    expect(result.ox).toBeLessThanOrEqual(0);
    // 음수 한계: viewport - world*scale = 1280 - 2688 = -1408
    expect(result.ox).toBeGreaterThanOrEqual(newView.width - WORLD.width);
    expect(result.oy).toBeLessThanOrEqual(0);
    expect(result.oy).toBeGreaterThanOrEqual(newView.height - WORLD.height);
  });

  it("뷰포트가 맵보다 커지면(극단적 줌아웃) 맵이 중앙 정렬된다", () => {
    // 맵보다 훨씬 큰 뷰포트 — scale 0.25에서 가로 672px < 1280px
    const state: CameraState = { scale: 0.25, ox: -999, oy: 999 };
    const bigView: Size = { width: 1280, height: 800 };
    const result = clampPan(state, bigView, WORLD);
    expect(result.ox).toBeCloseTo((bigView.width - WORLD.width * 0.25) / 2, 6);
    expect(result.oy).toBeCloseTo((bigView.height - WORLD.height * 0.25) / 2, 6);
  });
});

describe("isInCenter (자동 포커스 발동 조건 판정)", () => {
  // 뷰포트 800×600, scale 1, 중앙 정렬 카메라 (맵보다 뷰포트가 작아 ox=-1000, oy=-500)
  const state: CameraState = { scale: 1, ox: -1000, oy: -500 };
  const viewport: Size = { width: 800, height: 600 };

  it("화면 중앙에 있는 점 → true", () => {
    // screen 중앙 = (400, 300) → world = (400-(-1000), 300-(-500)) = (1400, 800)
    // worldToScreen: x*1 + (-1000) = 400 → x=1400
    const center = { x: 1400, y: 800 };
    expect(isInCenter(state, viewport, center, 0.35)).toBe(true);
  });

  it("화면 중앙 ±35% 안에 있는 점 → true", () => {
    // halfW = 800*0.35 = 280, cx=400 → x in [120, 680]
    // screen_x = 1200*1 + (-1000) = 200 → 200 in [120, 680] → true
    const nearCenter = { x: 1200, y: 800 };
    expect(isInCenter(state, viewport, nearCenter, 0.35)).toBe(true);
  });

  it("화면 중앙 ±35% 밖에 있는 점 → false", () => {
    // screen_x = 50*1 + (-1000) = -950 → 화면 밖 → false
    const far = { x: 50, y: 800 };
    expect(isInCenter(state, viewport, far, 0.35)).toBe(false);
  });

  it("화면 가장자리 근처 → false", () => {
    // screen_x = (1000+680+1)*1 + (-1000) = 681 → 681 > 680 → false
    const edge = { x: 1681, y: 800 };
    expect(isInCenter(state, viewport, edge, 0.35)).toBe(false);
  });

  it("margin 0.5이면 화면 전체가 범위 — 가장자리도 true", () => {
    // halfW = 800*0.5=400, cx=400 → x in [0,800]
    // screen_x = (1000+799)*1 + (-1000) = 799 → 0 <= 799 <= 800 → true
    const almostEdge = { x: 1799, y: 800 };
    expect(isInCenter(state, viewport, almostEdge, 0.5)).toBe(true);
  });

  it("margin 0이면 정확히 중앙점만 true", () => {
    const exact = { x: 1400, y: 800 };
    expect(isInCenter(state, viewport, exact, 0)).toBe(true);
    const offByOne = { x: 1401, y: 800 };
    expect(isInCenter(state, viewport, offByOne, 0)).toBe(false);
  });
});
