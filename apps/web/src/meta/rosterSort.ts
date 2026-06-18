import { unitStats } from "./unitStats";
import type { RosterUnit } from "./metaStore";

export type SortKey = "power" | "level" | "role" | "new";

const ROLE_ORDER: Record<RosterUnit["role"], number> = {
  lord: 0, melee: 1, caster: 2, support: 3, guest: 4,
};

function getPower(u: RosterUnit): number {
  return unitStats(u.commanderId, u.classId, u.level, u.equipped).power;
}

export function sortRoster(roster: RosterUnit[], key: SortKey, chapter: number): RosterUnit[] {
  const arr = [...roster];
  arr.sort((a, b) => {
    const stableBreaker = a.commanderId.localeCompare(b.commanderId);
    if (key === "power") return getPower(b) - getPower(a) || stableBreaker;
    if (key === "level") return b.level - a.level || stableBreaker;
    if (key === "role") {
      const rd = ROLE_ORDER[a.role] - ROLE_ORDER[b.role];
      return rd !== 0 ? rd : getPower(b) - getPower(a) || stableBreaker;
    }
    // "new": chapter 일치 먼저
    const an = a.joinChapter === chapter ? 0 : 1;
    const bn = b.joinChapter === chapter ? 0 : 1;
    return an !== bn ? an - bn : getPower(b) - getPower(a) || stableBreaker;
  });
  return arr;
}
