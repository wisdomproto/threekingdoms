/**
 * 장비 슬롯 규칙(§10 지정 장착 3슬롯) — 순수 모듈(node 테스트 대상).
 *
 * 원작 충실(2026-07-03 §7 창고): **소모품은 장착하지 않는다.** 유닛이 장착하는 건 지속 장비뿐:
 *  - 무기(arms) 1 — weapon/book 통합(책사는 병법서가 무기격 — 원작 부채/서적 문법)
 *  - 말(mount) 1 — horse
 *  - 보물(relic) 1 — treasure
 * 소모품(supplyItem/attackItem)은 부대 공유 창고에 두고 전투 중 「도구」로 꺼내 쓴다(sharedItems 풀).
 * 같은 슬롯이 차 있으면 **교체**(가장 먼저 낀 것이 빠짐) — 거절보다 원작 상점 교체감에 가깝다.
 *
 * ⚠️ 이 규칙은 메타(편성) 레이어 전용 — 엔진/스테이지 JSON의 items 리스트는 손대지 않는다
 * (적 유닛 데이터는 자유 리스트 유지, 밸런스 sim 불변).
 */
import type { Item } from "@tk/data";

export type EquipSlot = "arms" | "mount" | "relic";

export const SLOT_LABEL: Record<EquipSlot, string> = {
  arms: "무기",
  mount: "말",
  relic: "보물",
};

export const SLOT_CAP: Record<EquipSlot, number> = { arms: 1, mount: 1, relic: 1 };

/** 카테고리 → 슬롯. 소모품·매핑 밖 카테고리는 null(장착 불가 — 소모품은 부대 창고행). */
export function slotOf(category: Item["category"] | undefined): EquipSlot | null {
  switch (category) {
    case "weapon":
    case "book":
      return "arms";
    case "horse":
      return "mount";
    case "treasure":
      return "relic";
    default:
      return null; // supplyItem/attackItem = 장착 불가(부대 공유 소지품)
  }
}

/** 장착 리스트의 슬롯 뷰 — 슬롯별 채워진 itemId(장착 순서 유지) + 규칙 초과분(overflow). */
export interface SlotView {
  arms: string[];
  mount: string[];
  relic: string[];
  /** 캡 초과·매핑 불가(소모품·구버전 장착) 등 규칙 밖 항목 — UI가 해제 가능하게 노출 */
  overflow: string[];
}

export function buildSlotView(
  equipped: readonly string[],
  items: Record<string, Item>,
): SlotView {
  const v: SlotView = { arms: [], mount: [], relic: [], overflow: [] };
  for (const id of equipped) {
    const slot = slotOf(items[id]?.category);
    if (!slot) {
      v.overflow.push(id); // 소모품·미매핑 = 장착 불가(구버전 세이브 관용, 해제 유도)
      continue;
    }
    if (v[slot].length >= SLOT_CAP[slot]) v.overflow.push(id);
    else v[slot].push(id);
  }
  return v;
}

/**
 * 아이템 장착(순수) — 슬롯 규칙 적용해 새 장착 리스트 반환.
 *  - 슬롯 미매핑 아이템(소모품 등)/미보유 정의: 변화 없음(동일 참조 — 장착 불가).
 *  - 슬롯이 차 있으면 그 슬롯의 가장 오래된 항목을 빼고 넣는다(교체).
 *  - 이미 장착된 동일 id는 무시(중복 장착 방지 — 전 슬롯 단일 cap).
 */
export function applyEquip(
  equipped: readonly string[],
  itemId: string,
  items: Record<string, Item>,
): string[] | readonly string[] {
  const slot = slotOf(items[itemId]?.category);
  if (!slot) return equipped; // 소모품/미매핑 = 장착 불가(부대 창고행)
  if (equipped.includes(itemId)) return equipped; // 동일 id 중복 장착 무의미
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
