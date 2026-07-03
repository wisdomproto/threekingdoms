/**
 * 장비 슬롯 규칙(§10 "무기/방어구/보조 3슬롯"의 v1 구현) — 순수 모듈(node 테스트 대상).
 *
 * 종전 구현은 슬롯 개념 없는 무제한 리스트라 무기 여러 자루의 보정이 전부 중첩됐다
 * (2026-07-03 지적 — 설계 문서에만 있고 코드가 빠져 있던 규칙). 조조전 3슬롯 문법을
 * 우리 카테고리로 매핑한다:
 *  - 무기(arms) 1 — weapon/book 통합(책사는 병법서가 무기격 — 원작 부채/서적 문법)
 *  - 말(mount) 1 — horse
 *  - 보물(relic) 1 — treasure
 *  - 소모품(pouch) 2 — supplyItem/attackItem(전투 중 도구 사용처가 있어 별도 파우치)
 * 같은 슬롯이 차 있으면 **교체**(가장 먼저 낀 것이 빠짐) — 거절보다 원작 상점 교체감에 가깝다.
 *
 * ⚠️ 이 규칙은 메타(편성) 레이어 전용 — 엔진/스테이지 JSON의 items 리스트는 손대지 않는다
 * (적 유닛 데이터는 자유 리스트 유지, 밸런스 sim 불변).
 */
import type { Item } from "@tk/data";

export type EquipSlot = "arms" | "mount" | "relic" | "pouch";

export const SLOT_LABEL: Record<EquipSlot, string> = {
  arms: "무기",
  mount: "말",
  relic: "보물",
  pouch: "소모품",
};

export const SLOT_CAP: Record<EquipSlot, number> = { arms: 1, mount: 1, relic: 1, pouch: 2 };

/** 카테고리 → 슬롯. 매핑 밖 카테고리는 null(장착 불가). */
export function slotOf(category: Item["category"] | undefined): EquipSlot | null {
  switch (category) {
    case "weapon":
    case "book":
      return "arms";
    case "horse":
      return "mount";
    case "treasure":
      return "relic";
    case "supplyItem":
    case "attackItem":
      return "pouch";
    default:
      return null;
  }
}

/** 장착 리스트의 슬롯 뷰 — 슬롯별 채워진 itemId(장착 순서 유지) + 규칙 초과분(overflow). */
export interface SlotView {
  arms: string[];
  mount: string[];
  relic: string[];
  pouch: string[];
  /** 캡 초과·매핑 불가 등 규칙 밖 항목(구버전 세이브 관용) — UI가 해제 가능하게 노출 */
  overflow: string[];
}

export function buildSlotView(
  equipped: readonly string[],
  items: Record<string, Item>,
): SlotView {
  const v: SlotView = { arms: [], mount: [], relic: [], pouch: [], overflow: [] };
  for (const id of equipped) {
    const slot = slotOf(items[id]?.category);
    if (!slot) {
      v.overflow.push(id);
      continue;
    }
    if (v[slot].length >= SLOT_CAP[slot]) v.overflow.push(id);
    else v[slot].push(id);
  }
  return v;
}

/**
 * 아이템 장착(순수) — 슬롯 규칙 적용해 새 장착 리스트 반환.
 *  - 슬롯 미매핑 아이템/미보유 정의: 변화 없음(동일 참조).
 *  - 슬롯이 차 있으면 그 슬롯의 가장 오래된 항목을 빼고 넣는다(교체).
 *  - 이미 장착된 동일 id는 무시(중복 장착 방지 — pouch는 같은 소모품 2개 허용).
 */
export function applyEquip(
  equipped: readonly string[],
  itemId: string,
  items: Record<string, Item>,
): string[] | readonly string[] {
  const slot = slotOf(items[itemId]?.category);
  if (!slot) return equipped;
  // pouch 외 슬롯은 동일 id 중복 장착 무의미(효과 중첩 방지 — 교체 대상도 아님)
  if (slot !== "pouch" && equipped.includes(itemId)) return equipped;
  const view = buildSlotView(equipped, items);
  const next = [...equipped];
  if (view[slot].length >= SLOT_CAP[slot]) {
    const evict = view[slot][0]!; // 가장 오래된 것 교체
    const idx = next.indexOf(evict);
    if (idx >= 0) next.splice(idx, 1);
  }
  next.push(itemId);
  return next;
}
