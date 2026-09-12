/**
 * itemsFor (ActionMenu 행동 모델) — 회귀 가드. 모바일 BottomPanel이 같은 Item[]을 큰 버튼으로
 * 그리므로(스펙 2026-09-12 §2) 라벨 순서·disabled·dispatch 이벤트를 고정한다.
 */
import { describe, expect, it } from "vitest";
import { itemsFor, type Item } from "../hud/ActionMenu";
import type { InputState, UiEvent } from "../inputMachine";

const AT = { x: 1, y: 1 };
const base = { unitId: "유비", from: AT, preview: AT, movable: [], attackable: [], strategies: [], items: [] };
function postMove(over: Partial<Extract<InputState, { kind: "postMoveMenu" }>> = {}): InputState {
  return { kind: "postMoveMenu", ...base, canFlank: false, canUltimate: false, ...over };
}
function collect(): { dispatch: (e: UiEvent) => void; events: UiEvent[] } {
  const events: UiEvent[] = [];
  return { dispatch: (e) => events.push(e), events };
}
const press = (items: Item[], key: string): void => items.find((i) => i.key === key)!.onPress!();

describe("itemsFor", () => {
  it("postMoveMenu — 8항목 고정 순서(레퍼런스 §9)", () => {
    const labels = itemsFor(postMove(), () => {}).map((i) => i.label);
    expect(labels).toEqual(["공격", "책략", "도구", "교환", "협공", "필살", "대기", "취소"]);
  });
  it("postMoveMenu — 조건 미충족 dim: attackable/strategies/items 빈 배열, 협공·필살 불가, 교환 placeholder", () => {
    const items = itemsFor(postMove(), () => {});
    const dim = items.filter((i) => i.disabled || i.placeholder).map((i) => i.key);
    expect(dim).toEqual(["attack", "strategy", "item", "trade", "assist", "ultimate"]);
  });
  it("postMoveMenu — 대상/책략 있으면 점등", () => {
    const items = itemsFor(postMove({ attackable: ["화웅"], strategies: ["업화"], canFlank: true, canUltimate: true }), () => {});
    const lit = items.filter((i) => !i.disabled && !i.placeholder).map((i) => i.key);
    expect(lit).toEqual(["attack", "strategy", "assist", "ultimate", "wait", "cancel"]);
  });
  it("postMoveMenu — onPress → dispatch 이벤트", () => {
    const { dispatch, events } = collect();
    const items = itemsFor(postMove({ attackable: ["화웅"] }), dispatch);
    press(items, "attack");
    press(items, "wait");
    press(items, "cancel");
    expect(events.map((e) => e.type)).toEqual(["menuAttack", "menuWait", "menuCancel"]);
  });
  it("targetSelect — [취소]만, cancel 이벤트", () => {
    const { dispatch, events } = collect();
    const items = itemsFor({ kind: "targetSelect", ...base }, dispatch);
    expect(items.map((i) => i.label)).toEqual(["취소"]);
    press(items, "cancel");
    expect(events).toEqual([{ type: "cancel" }]);
  });
  it("strategyMenu — 책략 수 + 취소", () => {
    const items = itemsFor({ kind: "strategyMenu", ...base, strategies: ["업화", "치료"] }, () => {});
    expect(items).toHaveLength(3);
    expect(items[2]!.label).toBe("취소");
  });
  it("idle / confirmAttack / selected → []", () => {
    expect(itemsFor({ kind: "idle" }, () => {})).toEqual([]);
    expect(itemsFor({ kind: "selected", unitId: "유비", movable: [], attackable: [] }, () => {})).toEqual([]);
    expect(itemsFor({ kind: "confirmAttack", targetId: "화웅", prior: { kind: "selected", unitId: "유비", movable: [], attackable: [] } }, () => {})).toEqual([]);
  });
});
