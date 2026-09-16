import { describe, it, expect } from 'vitest';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { gameData, MapSceneSchema } from '../src';
import library from '../../../apps/web/public/assets/scene-motions/library.json';

describe('chapter one staged conversations', () => {
  it('ships all seven additional slots with valid actors, reachable cells and painted maps', () => {
    let slots = 0;
    for (const stage of Object.values(gameData.stages).filter(s => /^0[1-4]-/.test(s.id))) {
      for (const slot of ['intro', 'outro'] as const) {
        if (stage.id.startsWith('01-') && slot === 'intro') continue;
        const parts = stage.scenario?.[slot];
        expect(Array.isArray(parts)).toBe(true);
        if (!Array.isArray(parts)) continue;
        slots++;
        for (const part of parts) {
          if (!('map' in part)) continue;
          expect(MapSceneSchema.safeParse(part).success).toBe(true);
          const map = gameData.maps[part.map]!;
          expect(map).toBeDefined();
          expect(existsSync(resolve('../../apps/web/public/assets/maps', part.map + '.webp'))).toBe(true);
          const ids = new Set(part.units.map(u => u.id));
          expect(ids.size).toBe(part.units.length);
          const checkCell = (cell: unknown) => {
            expect(Array.isArray(cell)).toBe(true);
            const [x,y] = cell as [number, number];
            expect(x).toBeGreaterThanOrEqual(0); expect(x).toBeLessThan(map.width);
            expect(y).toBeGreaterThanOrEqual(0); expect(y).toBeLessThan(map.height);
            expect(map.tileLegend[map.tiles[y]![x]!]).not.toBe('wall');
          };
          for (const u of part.units) {
            checkCell(u.cell);
            expect(library.actors).toHaveProperty(u.sprite);
          }
          for (const line of part.lines) {
            for (const key of ['enter','move','exit','face','pose'] as const) {
              for (const action of line[key] ?? []) {
                expect(ids.has(action.id)).toBe(true);
                if ('to' in action) checkCell(action.to);
                if ('from' in action) checkCell(action.from);
              }
            }
          }
        }
      }
    }
    expect(slots).toBe(7);
  });
});
