/**
 * 장비 슬롯 규칙(§10 지정 장착 3슬롯 — 무기1/말1/보물1) 순수 로직 테스트.
 * 원작 충실(2026-07-03 §7): 소모품은 장착하지 않고 부대 공유 창고행 → slotOf=null(장착 불가).
 */
import { describe, it, expect } from "vitest";
import type { Item } from "@tk/data";
import { slotOf, buildSlotView, applyEquip } from "../equipSlots";

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
  it("horse → 말, treasure → 보물", () => {
    expect(slotOf("horse")).toBe("mount");
    expect(slotOf("treasure")).toBe("relic");
  });
  it("소모품(supplyItem/attackItem)은 장착 불가(null) — 부대 공유 창고행", () => {
    expect(slotOf("supplyItem")).toBeNull();
    expect(slotOf("attackItem")).toBeNull();
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

  it("소모품은 장착되지 않는다(부대 공유 창고행 — 동일 참조 반환)", () => {
    const eq = ["쌍고검"];
    expect(applyEquip(eq, "상약", ITEMS)).toBe(eq);
    expect(applyEquip(eq, "폭탄", ITEMS)).toBe(eq);
  });

  it("동일 id 중복 장착은 무시(변화 없음)", () => {
    const same = applyEquip(["쌍고검", "적로"], "쌍고검", ITEMS);
    expect(same).toEqual(["쌍고검", "적로"]); // 변화 없음
  });

  it("미정의 아이템은 변화 없음(동일 참조)", () => {
    const eq = ["쌍고검"];
    expect(applyEquip(eq, "없는아이템", ITEMS)).toBe(eq);
  });
});

describe("buildSlotView", () => {
  it("슬롯별 분류 + 무기 초과·소모품은 overflow(구버전 세이브 관용)", () => {
    const v = buildSlotView(["쌍고검", "청룡언월도", "적로", "상약", "폭탄"], ITEMS);
    expect(v.arms).toEqual(["쌍고검"]);
    expect(v.mount).toEqual(["적로"]);
    // 소모품(상약·폭탄)은 슬롯 없음 → overflow, 무기 초과(청룡언월도)도 overflow
    expect(v.overflow).toEqual(["청룡언월도", "상약", "폭탄"]);
  });
});
