import type { Item } from "@tk/data";

/** Match the tool's visible family; this does not change its battle rules. */
export function itemFxCategory(item: Item | undefined): string {
  if (item?.category === "supplyItem") return "heal";
  const name = item?.name ?? "";
  if (/폭탄|초열|화룡|업화|화계|화공/.test(name)) return "fire";
  if (/낙석|산사태|지진|거암|토석/.test(name)) return "earth";
  if (/소용돌이|탁류|해일|수계/.test(name)) return "water";
  if (/선풍|회오리|풍진|바람/.test(name)) return "wind";
  if (/독|포박|주박/.test(name)) return "debuff";
  return "special";
}
