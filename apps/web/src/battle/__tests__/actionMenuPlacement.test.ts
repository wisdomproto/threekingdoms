/**
 * placeMenu (ActionMenu §174 좌/우 자동 전환) 순수 기하 검증.
 * 레퍼런스 §9 "유닛 옆 세로 리스트" + §174 "맵 가림 회피 위해 좌/우 위치 자동 전환".
 * 메뉴가 유닛을 가리지 않고(셀 반폭+여백만큼 밀림) 화면 밖으로 나가지 않음을 보장한다.
 */
import { describe, expect, it } from "vitest";
import { MENU_WIDTH, itemsFor, menuPanelHeight, placeMenu, type Item } from "../hud/ActionMenu";
import type { InputState, UiEvent } from "../inputMachine";
import type { MenuAnchor } from "../store";

const VP = { width: 800, height: 600 };
const HALF = 24; // 줌 1.0 기준 셀 반폭(48/2)
const MENU_W = MENU_WIDTH; // ActionMenu에서 직접 import — 상수 드리프트 방지

function anchor(x: number, y: number, preferRight = true): MenuAnchor {
  return { x, y, half: HALF, preferRight };
}

describe("placeMenu — 좌/우 자동 전환(§174)", () => {
  it("화면 좌측 유닛: 메뉴는 유닛 오른쪽에 뜨고 셀을 가리지 않는다", () => {
    const { left } = placeMenu(anchor(100, 300), 8, VP);
    // 셀 중심(100) + 반폭(24) 보다 오른쪽이어야 유닛을 가리지 않음
    expect(left).toBeGreaterThan(100 + HALF);
  });

  it("화면 우측 유닛: 메뉴가 좌측으로 뒤집혀 유닛 왼쪽에 뜬다", () => {
    const ax = VP.width - 40; // 우측 가장자리 근처
    const { left } = placeMenu(anchor(ax, 300), 8, VP);
    // 좌측 전환 시 메뉴 우변(left+width)이 셀 중심-반폭 이하 → 유닛을 가리지 않음
    expect(left + MENU_W).toBeLessThanOrEqual(ax - HALF + 0.01);
  });

  it("어느 경우든 메뉴는 화면 가로 안에 들어온다", () => {
    for (const ax of [0, 50, 400, 760, 800]) {
      const { left } = placeMenu(anchor(ax, 300), 8, VP);
      expect(left).toBeGreaterThanOrEqual(0);
      expect(left + MENU_W).toBeLessThanOrEqual(VP.width);
    }
  });

  it("세로: 화면 위/아래로 넘치지 않게 클램프된다", () => {
    const tall = placeMenu(anchor(400, 5), 8, VP); // 상단 근처
    expect(tall.top).toBeGreaterThanOrEqual(0);
    const low = placeMenu(anchor(400, VP.height - 5), 8, VP); // 하단 근처
    const menuH = menuPanelHeight(8);
    expect(low.top + menuH).toBeLessThanOrEqual(VP.height);
  });

  it("preferRight=false(우측 점유)면 메뉴가 좌측에 떠 유닛 왼쪽에 배치된다", () => {
    const ax = 400; // 중앙 — 양쪽 다 화면 안
    const { left } = placeMenu(anchor(ax, 300, false), 8, VP);
    expect(left + MENU_W).toBeLessThanOrEqual(ax - HALF + 0.01); // 메뉴 우변 ≤ 셀 좌측
  });

  it("preferRight=false라도 좌측이 화면 밖이면 우측으로 뒤집힌다", () => {
    const { left } = placeMenu(anchor(30, 300, false), 8, VP); // 좌측 가장자리
    expect(left).toBeGreaterThanOrEqual(0);
    expect(left).toBeGreaterThan(30 + HALF - 0.01); // 우측 전환
  });

  it("항목 수가 적으면(취소만) 메뉴 높이도 작아 더 자유롭게 배치된다", () => {
    const one = placeMenu(anchor(400, 300), 1, VP);
    expect(one.top).toBeGreaterThanOrEqual(0);
    expect(one.top).toBeLessThan(VP.height);
  });
});

/**
 * itemsFor (행동 모델) — 회귀 가드. 모바일 BottomPanel이 같은 Item[]을 큰 버튼으로 그리므로
 * (스펙 2026-09-12 §2) 라벨 순서·disabled·dispatch 이벤트를 고정한다.
 * 취소 이벤트는 두 종류: 메뉴(postMoveMenu/strategyMenu/itemMenu) 취소 = menuCancel,
 * 표적 조준(targetSelect/strategyTarget/itemTarget) 취소 = cancel.
 */
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

describe("itemsFor — 행동 모델(BottomPanel 공유)", () => {
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
