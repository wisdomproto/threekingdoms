/** UnitPanel 좌/우 컬럼 결정 — 유닛이 화면 좌측 절반이면 우측 컬럼(가림 회피). */
import { describe, expect, it } from "vitest";
import { bottomPanelState, hudMode, unitPanelSide } from "../hudLayout";
import type { InputState } from "../inputMachine";

describe("unitPanelSide", () => {
  it("앵커 없음 → left", () => expect(unitPanelSide(null, 800)).toBe("left"));
  it("유닛이 좌측 절반 → right", () => expect(unitPanelSide({ x: 100 }, 800)).toBe("right"));
  it("유닛이 우측 절반 → left", () => expect(unitPanelSide({ x: 600 }, 800)).toBe("left"));
  it("뷰포트 0(미측정) → left", () => expect(unitPanelSide({ x: 100 }, 0)).toBe("left"));
});

describe("hudMode — <768px 모바일 게이트", () => {
  it("0(미측정) → desktop", () => expect(hudMode(0)).toBe("desktop"));
  it("767 → mobile", () => expect(hudMode(767)).toBe("mobile"));
  it("768 → desktop", () => expect(hudMode(768)).toBe("desktop"));
  it("1280 → desktop", () => expect(hudMode(1280)).toBe("desktop"));
});

describe("bottomPanelState — InputState kind 전표", () => {
  const collapsed: InputState["kind"][] = ["idle", "enemyTurn", "autoTurn", "animating", "battleOver", "confirmEndTurn"];
  const expanded: InputState["kind"][] = [
    "selected", "postMoveMenu", "targetSelect", "confirmAttack",
    "strategyMenu", "strategyTarget", "itemMenu", "itemTarget",
  ];
  for (const kind of collapsed) {
    it(`${kind} → collapsed`, () => expect(bottomPanelState({ kind } as InputState)).toBe("collapsed"));
  }
  for (const kind of expanded) {
    it(`${kind} → expanded`, () => expect(bottomPanelState({ kind } as InputState)).toBe("expanded"));
  }
});
