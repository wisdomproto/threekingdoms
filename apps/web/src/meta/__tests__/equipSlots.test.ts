/**
 * 장비 슬롯 규칙(§10 3슬롯 v1 — 무기1/말1/보물1 + 소모품2) 순수 로직 테스트.
 * 종전 무제한 리스트에서 무기 보정이 중첩되던 구멍(2026-07-03 지적)의 회귀 가드.
 */
import { describe, it, expect } from "vitest";
import type { Item } from "@tk/data";
import { slotOf, buildSlotView, applyEquip, SLOT_CAP } from "../equipSlots";

const ITEMS: Record<string, Item> = {
  쌍고검: { id: "쌍고검", name: "쌍고검", category: "weapon", power: 255, bonusPercent: 0 },
  청룡언월도: { id: "청룡언월도", name: "청룡언월도", category: "weapon", power: 255, bonusPercent: 12 },
  육도: { id: "육도", name: "육도", category: "book", power: 255, bonusPercent: 15 },
  적로: { id: "적로", name: "적로", category: "horse", power: 255, bonusPercent: 0 },
  무술교본: { id: "무술교본", name: "무술교본", category: "treasure", power: 255, bonusPercent: 0 },
  상약: { id: "상약", name: "상약", category: "supplyItem", power: 30, bonusPercent: 0 },
  한방약: { id: "한방약", name: "한방약", category: "supplyItem", power: 60, bonusPercent: 0 },
  폭탄: { id: "폭탄", name: "폭탄", category: "attackItem", power: 40, bonusPercent: 0 },
} as Record<string, Item>;

describe("slotOf", () => {
  it("weapon/book → 무기 슬롯 통합(책사는 병법서가 무기격)", () => {
    expect(slotOf("weapon")).toBe("arms");
    expect(slotOf("book")).toBe("arms");
  });
  it("horse → 말, treasure → 보물, 소모품 2종 → 파우치", () => {
    expect(slotOf("horse")).toBe("mount");
    expect(slotOf("treasure")).toBe("relic");
    expect(slotOf("supplyItem")).toBe("pouch");
    expect(slotOf("attackItem")).toBe("pouch");
  });
});

describe("applyEquip — 슬롯 규칙", () => {
  it("무기 슬롯이 차 있으면 교체(중첩 금지 — 종전 무제한 리스트의 구멍)", () => {
    const next = applyEquip(["쌍고검"], "청룡언월도", ITEMS);
    expect(next).toEqual(["청룡언월도"]);
  });

  it("book도 무기 슬롯을 점유 — 검+병법서 동시 장착 불가", () => {
    expect(applyEquip(["쌍고검"], "육도", ITEMS)).toEqual(["육도"]);
  });

  it("다른 슬롯끼리는 공존(무기+말+보물)", () => {
    let eq: readonly string[] = [];
    eq = applyEquip(eq, "쌍고검", ITEMS);
    eq = applyEquip(eq, "적로", ITEMS);
    eq = applyEquip(eq, "무술교본", ITEMS);
    expect([...eq].sort()).toEqual(["무술교본", "쌍고검", "적로"].sort());
  });

  it(`소모품 파우치는 ${SLOT_CAP.pouch}칸 — 초과 시 가장 오래된 것 교체`, () => {
    let eq: readonly string[] = [];
    eq = applyEquip(eq, "상약", ITEMS);
    eq = applyEquip(eq, "한방약", ITEMS);
    expect(eq).toEqual(["상약", "한방약"]);
    eq = applyEquip(eq, "폭탄", ITEMS); // 상약(가장 오래됨)이 빠진다
    expect(eq).toEqual(["한방약", "폭탄"]);
  });

  it("같은 소모품 2개는 허용, 파우치 외 동일 id 중복은 무시", () => {
    const two = applyEquip(["상약"], "상약", ITEMS);
    expect(two).toEqual(["상약", "상약"]);
    const same = applyEquip(["쌍고검", "적로"], "쌍고검", ITEMS);
    expect(same).toEqual(["쌍고검", "적로"]); // 변화 없음
  });

  it("미정의 아이템은 변화 없음(동일 참조)", () => {
    const eq = ["쌍고검"];
    expect(applyEquip(eq, "없는아이템", ITEMS)).toBe(eq);
  });
});

describe("buildSlotView", () => {
  it("슬롯별 분류 + 캡 초과분은 overflow(구버전 세이브 관용)", () => {
    const v = buildSlotView(["쌍고검", "청룡언월도", "적로", "상약", "한방약", "폭탄"], ITEMS);
    expect(v.arms).toEqual(["쌍고검"]);
    expect(v.mount).toEqual(["적로"]);
    expect(v.pouch).toEqual(["상약", "한방약"]);
    expect(v.overflow).toEqual(["청룡언월도", "폭탄"]); // 무기 초과 1 + 파우치 초과 1
  });
});
