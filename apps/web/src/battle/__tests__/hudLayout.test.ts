/** UnitPanel 좌/우 컬럼 결정 — 유닛이 화면 좌측 절반이면 우측 컬럼(가림 회피). */
import { describe, expect, it } from "vitest";
import { unitPanelSide } from "../hudLayout";

describe("unitPanelSide", () => {
  it("앵커 없음 → left", () => expect(unitPanelSide(null, 800)).toBe("left"));
  it("유닛이 좌측 절반 → right", () => expect(unitPanelSide({ x: 100, y: 0 }, 800)).toBe("right"));
  it("유닛이 우측 절반 → left", () => expect(unitPanelSide({ x: 600, y: 0 }, 800)).toBe("left"));
  it("뷰포트 0(미측정) → left", () => expect(unitPanelSide({ x: 100, y: 0 }, 0)).toBe("left"));
});
