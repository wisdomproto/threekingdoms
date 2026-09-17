import type { ItemEffects } from "@tk/data";
/** Display-only appraisal of effects; independent of drop probability and item power sentinels. */
export function treasureGrade(e?: ItemEffects) {
  const score = (e?.atkPercent ?? 0) + (e?.defensePercent ?? 0) + (e?.spiritPercent ?? 0) + (e?.move ?? 0) * 10;
  const grade: "common" | "fine" | "rare" | "legendary" = e?.doubleStrike || e?.noCounter || e?.multiHit || e?.lifestealPercent || e?.counterStrikes || score >= 15 ? "legendary"
    : e?.alwaysHit || e?.rangeBonus || e?.inflictStatus || e?.flatDamagePerLevel || score >= 10 ? "rare" : score >= 5 ? "fine" : "common";
  const labels = { common: "일반", fine: "고급", rare: "희귀", legendary: "전설" };
  const colors = { common: "#c4cbd0", fine: "#81dfa3", rare: "#c6a0ff", legendary: "#ffe084" };
  const recommendation = e?.move ? "기동·우회 장수 추천" : e?.doubleStrike || e?.atkPercent ? "공격형 장수 추천" : e?.defensePercent ? "전방 방어 장수 추천" : e?.spiritPercent ? "책략형 장수 추천" : "효과를 확인해 장착하세요";
  return { grade, label: labels[grade], color: colors[grade], recommendation };
}
