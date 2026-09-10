import { describe, expect, it } from 'vitest';
import type { MapScene } from '@tk/data';
import stage from '../../../../../../packages/data/json/stages/01-zhuojun.json';
import tavern from '../../../../../../packages/data/json/maps/scene-01-tavern.json';
import orchard from '../../../../../../packages/data/json/maps/scene-01-orchard.json';
import { findScenePath, type Cell } from '../interpreter';

describe('opening scene blocking', () => {
  for (const map of [tavern, orchard]) it(`${map.id}: routes reach authored positions without crossing scenery`, () => {
    const scene = stage.scenario.intro.find(s => 'map' in s && s.map === map.id) as MapScene;
    const walkable = ([x, y]: Cell) => map.tiles[y]?.[x] === '.';
    const positions = new Map(scene.units.map(u => [u.id, u.cell]));
    for (const unit of scene.units) expect(walkable(unit.cell), unit.id).toBe(true);
    for (const line of scene.lines) {
      for (const action of [...line.exit ?? [], ...line.move ?? [], ...line.enter ?? []]) {
        const from = 'from' in action ? action.from as Cell : positions.get(action.id)!;
        const path = findScenePath(walkable, from, action.to);
        expect(path.at(-1), action.id).toEqual(action.to);
        expect(path.every(walkable)).toBe(true);
        if (from[1] === 9 || action.to[1] === 9) {
          expect(path.filter(c => c[1] >= 8).every(c => c[0] === 7)).toBe(true);
        }
        positions.set(action.id, action.to);
      }
    }
  });
});

