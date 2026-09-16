import type { Stage } from "@tk/data";
import type { RosterUnit } from "./metaStore";
import type { SortieMember } from "./sortie";

/** Prefer authored allies, then fill remaining slots from the available roster. */
export function autoFormation(roster: readonly RosterUnit[], stage: Stage): SortieMember[] {
  const slots = stage.units.filter(u => u.side === "player");
  const order = [...slots.map(u => u.commanderId), ...roster.map(u => u.commanderId)];
  const available = new Map(roster.map(u => [u.commanderId, u]));
  return [...new Set(order)].filter(id => available.has(id)).slice(0, slots.length).map(id => {
    const u = available.get(id)!;
    return { commanderId: id, classId: u.classId, level: u.level, exp: u.exp, items: [...u.equipped] };
  });
}
