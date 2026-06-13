/**
 * 상점 진열 항목의 표시 모델 — 순수 함수(window 불필요, node 단위테스트 대상).
 *
 * Shop.tsx(React)에서 분리한 이유: 진열 필터/효과 문구/구매 가능 판정은 데이터 변환이라
 * 렌더와 무관하게 검증 가능해야 한다(§battle 테스트와 동일하게 vitest env=node).
 */
import type { Item, Shop, ShopItem } from "@tk/data";

/** 카테고리 한글 라벨 — 진열 분류 배지. */
const CATEGORY_LABEL: Record<Item["category"], string> = {
  weapon: "무기",
  treasure: "보물",
  attackItem: "공격 아이템",
  supplyItem: "소모품",
  horse: "탈것",
  book: "병법서",
};

/** power=255는 "비소모"(영구 장비) 표식. supplyItem/attackItem만 소모품으로 본다. */
function isConsumable(item: Item): boolean {
  return (item.category === "supplyItem" || item.category === "attackItem") && item.power !== 255;
}

/** 효과 한 줄 — 무기/병법서/탈것은 % 가산, 소모품은 효과량(회복/피해). */
function effectText(item: Item): string {
  if (isConsumable(item)) {
    const verb = item.category === "supplyItem" ? "회복" : "피해";
    return `${verb} ${item.power}`;
  }
  if (item.bonusPercent > 0) return `+${item.bonusPercent}%`;
  return "고유 효과";
}

/** 진열 1줄의 표시 모델(렌더 전 확정). 누락 itemId는 제외된다. */
export interface ShopRow {
  itemId: string;
  name: string;
  category: Item["category"];
  categoryLabel: string;
  effect: string;
  consumable: boolean;
  price: number;
  /** 현재 자금으로 살 수 있는가. */
  affordable: boolean;
  /** 이미 보유 중인 수량(중복 보유 허용 — 0이면 미보유). */
  owned: number;
}

/**
 * 상점 진열 목록을 표시 모델로 변환(순수).
 *  - unlockChapter <= chapter 인 항목만.
 *  - items 사전에 없는 itemId(데이터 불일치)는 조용히 제외 — 깨진 행을 그리지 않는다.
 *  - 정렬: 미해금 잡음 없이 진열 순서(데이터 순) 유지.
 */
export function buildShopRows(
  shop: Shop,
  items: Record<string, Item>,
  gold: number,
  chapter: number,
  inventory: readonly string[] = [],
): ShopRow[] {
  const ownedCount = new Map<string, number>();
  for (const id of inventory) ownedCount.set(id, (ownedCount.get(id) ?? 0) + 1);

  const rows: ShopRow[] = [];
  for (const entry of shop.items as ShopItem[]) {
    if (entry.unlockChapter > chapter) continue;
    const item = items[entry.itemId];
    if (!item) continue; // 데이터 불일치 — 깨진 행 방지
    rows.push({
      itemId: entry.itemId,
      name: item.name,
      category: item.category,
      categoryLabel: CATEGORY_LABEL[item.category] ?? item.category,
      effect: effectText(item),
      consumable: isConsumable(item),
      price: entry.price,
      affordable: gold >= entry.price,
      owned: ownedCount.get(entry.itemId) ?? 0,
    });
  }
  return rows;
}
