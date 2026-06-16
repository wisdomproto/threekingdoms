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

const STATUS_LABEL: Record<"poison" | "seal" | "immobilize", string> = {
  poison: "중독", seal: "금책", immobilize: "부동",
};

/**
 * 효과 한 줄 — 소모품은 회복/피해, 그 외는 effects(전 전투 특성) + 레거시 bonusPercent를 ' · '로 연결.
 * 표시 전용 순수 함수(전투 행동 특성도 문구화 — 전력 숫자가 못 잡는 가치를 보여줌). Phase F.
 */
export function effectText(item: Item): string {
  if (isConsumable(item)) {
    const verb = item.category === "supplyItem" ? "회복" : "피해";
    return `${verb} ${item.power}`;
  }
  const parts: string[] = [];
  const e = item.effects;
  if (e) {
    if (e.move) parts.push(`이동 +${e.move}`);
    if (e.atkPercent) parts.push(`공격 +${e.atkPercent}%`);
    if (e.spiritPercent) parts.push(`정신 +${e.spiritPercent}%`);
    if (e.defensePercent) parts.push(`받는 피해 −${e.defensePercent}%`);
    if (e.rangeBonus) parts.push(`사거리 +${e.rangeBonus}`);
    if (e.multiHit) parts.push(`관통 ${e.multiHit}격`);
    if (e.counterStrikes && e.counterStrikes > 1) parts.push(`재반격 ${e.counterStrikes}회`);
    if (e.noCounter) parts.push("무반격");
    if (e.doubleStrike) parts.push("연속공격");
    if (e.flatDamagePerLevel) parts.push("고정 피해(방어무시)");
    if (e.alwaysHit) parts.push("필중");
    if (e.lifestealPercent) parts.push(`흡혈 ${e.lifestealPercent}%`);
    if (e.inflictStatus) parts.push(`${STATUS_LABEL[e.inflictStatus.kind]} 부여 ${e.inflictStatus.chance}%`);
  }
  if (item.bonusPercent > 0) parts.push(`+${item.bonusPercent}%`);
  return parts.length ? parts.join(" · ") : "고유 효과";
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
