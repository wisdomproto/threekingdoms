type Entry = Record<string, any>;

/** Existing roster assignments win; otherwise retain the most frequent battle class. */
export function characterProfiles(commanders: Entry, rosters: Entry, battles: Entry[]) {
  const counts = new Map<string, Map<string, number>>();
  function visit(value: any) {
    if (!value || typeof value !== 'object') return;
    if (typeof value.commanderId === 'string' && typeof value.classId === 'string') {
      const classes = counts.get(value.commanderId) ?? new Map<string, number>();
      classes.set(value.classId, (classes.get(value.classId) ?? 0) + 1);
      counts.set(value.commanderId, classes);
    }
    Object.values(value).forEach(visit);
  }
  battles.forEach(visit);
  return Object.fromEntries(Object.entries(commanders).map(([id, commander]) => {
    const classes = [...(counts.get(id)?.entries() ?? [])].sort((a,b) => b[1]-a[1]);
    const classId = rosters[id]?.classId || commander.defaultClassId || classes[0]?.[0] || '';
    const inferredRole = classId === 'lord' ? 'lord' : ['strategist','sorcerer'].includes(classId) ? 'caster' : ['archer','crossbowman','catapult'].includes(classId) ? 'ranged' : ['band','civilian','transport'].includes(classId) ? 'support' : classId ? 'melee' : '';
    const rosterRole = rosters[id]?.role;
    return [id, {classId, role: commander.battleRole || (rosterRole && rosterRole !== 'guest' ? rosterRole : inferredRole), source: rosters[id] ? 'roster' : commander.defaultClassId ? 'character' : 'battle', classes: classes.map(([key]) => key)}];
  }));
}
