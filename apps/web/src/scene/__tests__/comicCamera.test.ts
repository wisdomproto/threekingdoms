import { describe, it, expect } from "vitest";
import { cameraFor } from "../comicCamera";

describe("cameraFor — 칸 rect contain-fit (spec §3)", () => {
  const img = { w: 1000, h: 1000 };
  it("전체 rect + 여백 0 + 같은 크기 뷰 = 항등", () => {
    expect(cameraFor([0, 0, 1, 1], { w: 1500, h: 2000 }, { w: 1500, h: 2000 }, 0)).toEqual({ scale: 1, tx: 0, ty: 0 });
  });
  it("전체 rect + 기본 여백 0.06 = fit(scale 0.88, 여백만큼 이동)", () => {
    const c = cameraFor([0, 0, 1, 1], { w: 1500, h: 2000 }, { w: 1500, h: 2000 });
    expect(c.scale).toBeCloseTo(0.88);
    expect(c.tx).toBeCloseTo(1500 * 0.06);
    expect(c.ty).toBeCloseTo(2000 * 0.06);
  });
  it("세로 뷰(폭 제한): 칸 폭이 뷰 폭에 맞고 세로 중앙", () => {
    const c = cameraFor([0, 0, 0.5, 0.5], img, { w: 400, h: 800 }, 0);
    expect(c.scale).toBeCloseTo(0.8);
    expect(c.tx).toBeCloseTo(0);
    expect(c.ty).toBeCloseTo(200);
  });
  it("가로 뷰(높이 제한): 우하단 칸이 음수 이동으로 당겨진다", () => {
    const c = cameraFor([0.5, 0.5, 0.5, 0.5], img, { w: 800, h: 400 }, 0);
    expect(c.scale).toBeCloseTo(0.8);
    expect(c.tx).toBeCloseTo(-200);
    expect(c.ty).toBeCloseTo(-400);
  });
  it("칸 중심은 항상 뷰 중심에 온다(여백 무관)", () => {
    const rect = [0.2, 0.6, 0.3, 0.25] as const;
    const view = { w: 390, h: 844 };
    for (const pad of [0, 0.06, 0.2]) {
      const c = cameraFor(rect, { w: 1500, h: 2000 }, view, pad);
      expect((rect[0] + rect[2] / 2) * 1500 * c.scale + c.tx).toBeCloseTo(view.w / 2);
      expect((rect[1] + rect[3] / 2) * 2000 * c.scale + c.ty).toBeCloseTo(view.h / 2);
    }
  });
});
