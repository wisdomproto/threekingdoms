import type { ItemEffects } from "@tk/data";
/** Shared equipment descriptions, including traits that do not modify base stats. */
export function itemEffectText(e?: ItemEffects): string {
  if (!e) return "고유 효과 없음";
  const p: string[] = [];
  if (e.move) p.push(`이동력 +${e.move}`);
  if (e.atkPercent) p.push(`공격 +${e.atkPercent}%`);
  if (e.spiritPercent) p.push(`정신 +${e.spiritPercent}%`);
  if (e.defensePercent) p.push(`받는 피해 −${e.defensePercent}%`);
  if (e.doubleStrike) p.push("연속공격");
  if (e.noCounter) p.push("공격 시 적의 반격 차단");
  if (e.multiHit) p.push(`공격 시 ${e.multiHit}회 타격`);
  if (e.counterStrikes && e.counterStrikes > 1) p.push(`반격 시 ${e.counterStrikes}회 타격`);
  if (e.alwaysHit) p.push("공격 반드시 명중");
  if (e.rangeBonus) p.push(`공격 사거리 +${e.rangeBonus}`);
  if (e.lifestealPercent) p.push(`입힌 피해의 ${e.lifestealPercent}% 회복`);
  if (e.flatDamagePerLevel) p.push(`고정 피해 ${e.flatDamagePerLevel} × (레벨 + 1)`);
  if (e.inflictStatus) p.push(`적중 시 ${e.inflictStatus.chance}% 확률로 ${{immobilize:"이동 불가",poison:"중독",seal:"책략 봉인",stun:"기절",attackUp:"공격 강화",defenseUp:"방어 강화",spiritUp:"정신 강화",moveUp:"이동 강화"}[e.inflictStatus.kind] ?? e.inflictStatus.kind} ${e.inflictStatus.turns}턴`);
  return p.join(" · ") || "고유 효과 없음";
}
