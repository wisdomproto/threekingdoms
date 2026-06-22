/**
 * chooseMenuPreferRight 순수 테스트(env=node). 레퍼런스 §174 — 메뉴가 공격 대상/이동범위를
 * 가리지 않게 적은 쪽 선호, 동률이면 화면 안쪽. 길중 버그(무조건 우측·적 가림) 회귀 방지.
 */
import { describe, it, expect } from "vitest";
import { chooseMenuPreferRight, type SideUnit } from "../menuPlacement";

const SELF = "u1";
function base(units: SideUnit[], over: Partial<Parameters<typeof chooseMenuPreferRight>[0]> = {}) {
  return chooseMenuPreferRight({
    unitId: SELF,
    gx: 10,
    gy: 10,
    selfSide: "player",
    units,
    screenX: 400,
    screenWidth: 800,
    ...over,
  });
}

describe("chooseMenuPreferRight", () => {
  it("우측에 적이 있으면 왼쪽 선호(false) — 공격 대상 가림 회피(스크린샷 케이스)", () => {
    const units: SideUnit[] = [
      { id: SELF, x: 10, y: 10, side: "player" },
      { id: "e1", x: 11, y: 10, side: "enemy" },
      { id: "e2", x: 12, y: 12, side: "enemy" },
    ];
    expect(base(units)).toBe(false);
  });

  it("좌측에 적이 있으면 오른쪽 선호(true)", () => {
    const units: SideUnit[] = [
      { id: SELF, x: 10, y: 10, side: "player" },
      { id: "e1", x: 9, y: 10, side: "enemy" },
    ];
    expect(base(units)).toBe(true);
  });

  it("빈 전장 + 유닛이 화면 우측 절반 → 왼쪽 선호(화면 안쪽)", () => {
    expect(base([{ id: SELF, x: 10, y: 10, side: "player" }], { screenX: 700 })).toBe(false);
  });

  it("빈 전장 + 유닛이 화면 좌측 절반 → 오른쪽 선호(화면 안쪽)", () => {
    expect(base([{ id: SELF, x: 10, y: 10, side: "player" }], { screenX: 100 })).toBe(true);
  });

  it("적 가중치(2) > 아군(1) — 우측 적 1 vs 좌측 아군 1이면 왼쪽 선호", () => {
    const units: SideUnit[] = [
      { id: SELF, x: 10, y: 10, side: "player" },
      { id: "e1", x: 11, y: 10, side: "enemy" }, // 우측 적 = 2
      { id: "a1", x: 9, y: 10, side: "player" }, // 좌측 아군 = 1
    ];
    expect(base(units)).toBe(false);
  });

  it("세로 범위 밖(>4행) 유닛은 무시 → 동률, 화면 안쪽 폴백", () => {
    const units: SideUnit[] = [
      { id: SELF, x: 10, y: 10, side: "player" },
      { id: "e1", x: 11, y: 20, side: "enemy" }, // dy=10 무시
    ];
    expect(base(units, { screenX: 100 })).toBe(true); // 좌측 절반 → 우측
  });

  it("퇴각·자기 자신·같은 열은 카운트 제외", () => {
    const units: SideUnit[] = [
      { id: SELF, x: 10, y: 10, side: "player" },
      { id: "e1", x: 11, y: 10, side: "enemy", retreated: true }, // 퇴각 제외
      { id: "e2", x: 10, y: 12, side: "enemy" }, // 같은 열(dx=0) 제외
    ];
    expect(base(units, { screenX: 100 })).toBe(true); // 카운트 0 → 동률 → 좌측절반 → 우측
  });
});
