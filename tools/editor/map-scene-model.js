// Pure, lossless operations for the visual scene editor.
export const ACTIONS = ['exit', 'move', 'enter', 'face', 'pose'];
export function newMapPart() {
  return { map: 'scene-01-street', label: '새 이동 장면', units: [{ id: 'actor-1', sprite: 'liubei-foot', cell: [4, 4], facing: 'right' }], lines: [{ text: '이야기를 입력하세요.' }] };
}
export function setAction(line, kind, id, values) {
  const list = line[kind] ??= [];
  const found = list.find(a => a.id === id);
  if (found) Object.assign(found, values);
  else list.push({ id, ...values });
}
export function removeActor(part, id) {
  part.units = part.units.filter(u => u.id !== id);
  for (const line of part.lines) {
    for (const key of ACTIONS) {
      if (!line[key]) continue;
      line[key] = line[key].filter(a => a.id !== id);
      if (!line[key].length) delete line[key];
    }
    if (line.bubble?.id === id) delete line.bubble;
    for (const option of line.choice?.options ?? []) for (const reaction of option.react ?? []) {
      if (reaction.bubble?.id === id) delete reaction.bubble;
    }
  }
}
// Layout preview uses authored destination cells; actual game preview resolves walkability.
export function sceneLayout(part, index) {
  const states = new Map(part.units.map(u => [u.id, { ...u, cell: [...u.cell], pose: 'idle' }]));
  for (const line of part.lines.slice(0, index + 1)) {
    for (const kind of ACTIONS) for (const a of line[kind] ?? []) {
      const s = states.get(a.id); if (!s) continue;
      if (a.to) {
        const from = kind === 'enter' ? a.from : s.cell;
        const dx = a.to[0] - from[0], dy = a.to[1] - from[1];
        if (dx || dy) s.facing = dx ? dx > 0 ? 'right' : 'left' : dy > 0 ? 'down' : 'up';
        s.cell = [...a.to];
      }
      if (kind === 'exit') s.hidden = true;
      if (kind === 'enter') s.hidden = false;
      if (kind === 'face') s.facing = a.dir;
      if (kind === 'pose') s.pose = a.pose;
    }
  }
  return states;
}
