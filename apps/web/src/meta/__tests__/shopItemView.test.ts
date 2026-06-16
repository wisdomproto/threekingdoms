/**
 * 상점 진열 변환(buildShopRows) 단위테스트(env=node — 순수 함수).
 * 필터(해금 챕터)·효과 문구·구매 가능 판정·보유 수량·데이터 불일치 제외를 검증.
 */
import { describe, it, expect } from "vitest";
import type { Item, Shop } from "@tk/data";
import { buildShopRows, effectText, buildShopGroups, type ShopRow } from "../screens/shopItemView";

/** rows에서 itemId로 한 행을 꺼낸다(없으면 테스트 실패 — undefined 전파 방지). */
function row(rows: ShopRow[], itemId: string): ShopRow {
  const r = rows.find((x) => x.itemId === itemId);
  if (!r) throw new Error(`row not found: ${itemId}`);
  return r;
}

const items: Record<string, Item> = {
  칠성검: { id: "칠성검", name: "칠성검", category: "weapon", power: 255, bonusPercent: 10 },
  상약: { id: "상약", name: "상약", category: "supplyItem", power: 30, bonusPercent: 0 },
  보물X: { id: "보물X", name: "보물X", category: "treasure", power: 255, bonusPercent: 0 },
};

const shop: Shop = {
  id: "ch1",
  name: "1장 상점",
  items: [
    { itemId: "칠성검", price: 300, unlockChapter: 1 },
    { itemId: "상약", price: 60, unlockChapter: 1 },
    { itemId: "보물X", price: 500, unlockChapter: 2 }, // 2장 해금
    { itemId: "없는아이템", price: 10, unlockChapter: 1 }, // items 사전에 없음
  ],
};

describe("buildShopRows", () => {
  it("unlockChapter > chapter 항목과 누락 itemId는 제외", () => {
    const rows = buildShopRows(shop, items, 1000, 1);
    expect(rows.map((r) => r.itemId)).toEqual(["칠성검", "상약"]); // 보물X(2장)·없는아이템 제외
  });

  it("2장이면 보물X도 진열(누락 itemId는 여전히 제외)", () => {
    const rows = buildShopRows(shop, items, 1000, 2);
    expect(rows.map((r) => r.itemId)).toEqual(["칠성검", "상약", "보물X"]);
  });

  it("효과 문구: 무기=+%, 소모품=회복량, 보물=고유 효과", () => {
    const rows = buildShopRows(shop, items, 1000, 2);
    expect(row(rows, "칠성검").effect).toBe("+10%");
    expect(row(rows, "상약").effect).toBe("회복 30");
    expect(row(rows, "상약").consumable).toBe(true);
    expect(row(rows, "보물X").effect).toBe("고유 효과");
    expect(row(rows, "보물X").consumable).toBe(false);
  });

  it("자금에 따라 affordable 판정", () => {
    const poor = buildShopRows(shop, items, 100, 1);
    expect(row(poor, "칠성검").affordable).toBe(false); // 300 > 100
    expect(row(poor, "상약").affordable).toBe(true); // 60 <= 100
  });

  it("inventory의 보유 수량 집계(중복 허용)", () => {
    const rows = buildShopRows(shop, items, 1000, 1, ["상약", "상약", "칠성검"]);
    expect(row(rows, "상약").owned).toBe(2);
    expect(row(rows, "칠성검").owned).toBe(1);
  });

  it("카테고리 한글 라벨", () => {
    const rows = buildShopRows(shop, items, 1000, 1);
    expect(row(rows, "칠성검").categoryLabel).toBe("무기");
    expect(row(rows, "상약").categoryLabel).toBe("소모품");
  });
});

describe("effectText 전 효과(Phase F)", () => {
  const wpn = (effects: Item["effects"]): Item =>
    ({ id: "x", name: "x", category: "weapon", power: 255, bonusPercent: 0, effects });
  it("무반격·관통·재반격·고정뎀·필중", () => {
    expect(effectText(wpn({ noCounter: true }))).toBe("무반격");
    expect(effectText(wpn({ multiHit: 3 }))).toBe("관통 3격");
    expect(effectText(wpn({ counterStrikes: 2 }))).toBe("재반격 2회");
    expect(effectText(wpn({ flatDamagePerLevel: 15 }))).toBe("고정 피해(방어무시)");
    expect(effectText(wpn({ alwaysHit: true }))).toBe("필중");
  });
  it("흡혈·사거리·상태이상·복합", () => {
    expect(effectText(wpn({ lifestealPercent: 50 }))).toBe("흡혈 50%");
    expect(effectText(wpn({ rangeBonus: 1 }))).toBe("사거리 +1");
    expect(effectText(wpn({ inflictStatus: { kind: "poison", chance: 75, turns: 3 } }))).toBe("중독 부여 75%");
    expect(effectText(wpn({ move: 1, atkPercent: 10, noCounter: true }))).toBe("이동 +1 · 공격 +10% · 무반격");
  });
});

describe("buildShopGroups (Phase F)", () => {
  const mk = (itemId: string, category: ShopRow["category"], label: string): ShopRow =>
    ({ itemId, name: itemId, category, categoryLabel: label, effect: "", consumable: false, price: 1, affordable: true, owned: 0 });
  it("카테고리 정의 순서대로 그룹, 빈 그룹 제외", () => {
    const g = buildShopGroups([mk("a", "weapon", "무기"), mk("b", "supplyItem", "소모품"), mk("c", "horse", "탈것")]);
    expect(g.map((x) => x.category)).toEqual(["weapon", "horse", "supplyItem"]);
    expect(g[0]!.rows.map((r) => r.itemId)).toEqual(["a"]);
    expect(g[0]!.label).toBe("무기");
  });
});
