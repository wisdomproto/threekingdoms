import { z } from "zod";
import { BattleMapSchema, StageSchema, CommanderSchema, RosterEntrySchema, ItemSchema } from "@tk/data";

export const GameSnapshotSchema = z.object({
  assetBindings: z.record(z.string()).optional(),
  version: z.literal(1), projectId: z.string().uuid(), revision: z.number().int().positive(), name: z.string(),
  chapters: z.array(z.object({ chapter: z.number().int().positive(), title: z.string(), stageIds: z.array(z.string()).min(1) })).min(1),
  stages: z.record(StageSchema), maps: z.record(BattleMapSchema),
  commanders: z.record(CommanderSchema), rosters: z.record(RosterEntrySchema), items: z.record(ItemSchema),
});
export type GameSnapshot = z.infer<typeof GameSnapshotSchema>;
export const snapshotKey = (s: GameSnapshot) => `${s.projectId}.${s.revision}`;
