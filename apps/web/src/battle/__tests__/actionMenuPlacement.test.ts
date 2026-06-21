/**
 * placeMenu (ActionMenu §174 좌/우 자동 전환) 순수 기하 검증.
 * 레퍼런스 §9 "유닛 옆 세로 리스트" + §174 "맵 가림 회피 위해 좌/우 위치 자동 전환".
 * 메뉴가 유닛을 가리지 않고(셀 반폭+여백만큼 밀림) 화면 밖으로 나가지 않음을 보장한다.
 */
import { describe, expect, it } from "vitest";
import { MENU_WIDTH, menuPanelHeight, placeMenu } from "../hud/ActionMenu";
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
