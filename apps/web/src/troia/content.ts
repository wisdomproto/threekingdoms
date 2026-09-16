import { z } from 'zod';
import { gameData, StageSchema, BattleMapSchema, CommanderSchema, ItemSchema, UnitClassSchema } from '@tk/data';
import { createBattle, type BattleContext } from '@tk/engine';
import source from '../../../../packages/data/json/troia/first-battle.json';

const schema = z.object({
  version: z.literal(1), seed: z.number().int(), stage: StageSchema, map: BattleMapSchema,
  commanders: z.record(CommanderSchema), items: z.record(ItemSchema), unitClasses: z.record(UnitClassSchema),
  portraits: z.record(z.object({ art: z.enum(['achilles','patroclus','diores','troops']), portrait: z.number().int().min(0).max(3), role: z.string() })),
  story: z.record(z.array(z.tuple([z.string(),z.string()])).min(1)),
  tactics: z.object({commander:z.string(),fallbackTurn:z.number().int().positive(),fallback:z.tuple([z.number(),z.number()]),retreatRatio:z.number().min(0).max(1),exit:z.tuple([z.number(),z.number()])}),
});
export const content = schema.parse(source);
export const context: BattleContext = {
  data: { ...gameData, commanders: content.commanders, items:content.items, unitClasses:content.unitClasses, rosters:{}, shops:{}, maps:{[content.map.id]:content.map}, stages:{[content.stage.id]:content.stage} },
  stage:content.stage, map:content.map,
};
for (const u of content.stage.units) {
  if (!content.commanders[u.commanderId] || !content.unitClasses[u.classId] || u.items.some(id=>!content.items[id])) throw new Error(`Invalid Troy unit: ${u.commanderId}`);
  if (u.x>=content.map.width || u.y>=content.map.height) throw new Error(`Troy placement outside map: ${u.commanderId}`);
}
export const nameOf = (id:string) => content.commanders[id]?.name ?? id;
export const newBattle = () => createBattle(context,content.seed);
