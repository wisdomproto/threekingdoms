import { unitStats } from "./unitStats";
import type { RosterUnit } from "./metaStore";
import type { SortieMember } from "./sortie";

export interface SortieSummary {
  count: number;
  totalPower: number;
  warnings: string[];
  emptyDefault: boolean;
}

export function sortieSummary(
  selected: SortieMember[],
  roster: RosterUnit[],
  maxSlots: number,
): SortieSummary {
  const emptyDefault = selected.length === 0;
  const warnings: string[] = [];

  if (!emptyDefault) {
    const slotsLeft = maxSlots - selected.length;
    if (slotsLeft > 0) warnings.push(`빈 슬롯 ${slotsLeft}개`);

    const hasLord = roster.some((u) => u.role === "lord");
    const lordSelected = selected.some((m) => {
      const u = roster.find((r) => r.commanderId === m.commanderId);
      return u?.role === "lord";
    });
    if (hasLord && !lordSelected) warnings.push("군주 미편성");
  }

  const totalPower = selected.reduce((sum, m) => {
    const u = roster.find((r) => r.commanderId === m.commanderId);
    if (!u) return sum;
    return sum + unitStats(m.commanderId, m.classId, m.level, m.items).power;
  }, 0);

  return { count: selected.length, totalPower, warnings, emptyDefault };
}
