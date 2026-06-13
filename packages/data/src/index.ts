import { z } from "zod";
import {
  TerrainSchema, UnitClassSchema, CombatConfigSchema,
  CommanderSchema, ItemSchema, InitialForceSchema, BattleMapSchema, StageSchema, StrategySchema,
  RosterEntrySchema, ShopSchema,
  type Terrain, type UnitClass, type CombatConfig,
  type Commander, type Item, type InitialForce, type BattleMap, type Stage, type Strategy,
  type RosterEntry, type Shop,
} from "./schemas";
import terrainsJson from "../json/terrains.json";
import unitClassesJson from "../json/unitClasses.json";
import combatJson from "../json/combat.json";
import commandersJson from "../json/commanders.json";
import itemsJson from "../json/items.json";
import strategiesJson from "../json/strategies.json";
import initialForcesJson from "../json/initialForces.json";
import rostersJson from "../json/rosters.json";
import shopCh1Json from "../json/shops/ch1.json";
import sishuiguanJson from "../json/maps/sishuiguan.json";
import stage05Json from "../json/stages/05-sishuiguan.json";

export * from "./schemas";

function loadJson<T>(schema: { safeParse: (d: unknown) => { success: true; data: T } | { success: false; error: { message: string } } }, data: unknown, filename: string): T {
  const result = schema.safeParse(data);
  if (!result.success) throw new Error(`[${filename}] 스키마 검증 실패:\n${result.error.message}`);
  return result.data;
}

export interface GameData {
  terrains: Record<string, Terrain>;
  unitClasses: Record<string, UnitClass>;
  combat: CombatConfig;
  commanders: Record<string, Commander>;
  items: Record<string, Item>;
  strategies: Record<string, Strategy>;
  initialForces: Record<string, InitialForce>;
  rosters: Record<string, RosterEntry>;
  shops: Record<string, Shop>;
  maps: Record<string, BattleMap>;
  stages: Record<string, Stage>;
}

/** import 시점에 전부 검증 — 잘못된 JSON은 여기서 즉시 터진다. */
export const gameData: GameData = {
  terrains: loadJson(z.record(TerrainSchema), terrainsJson, "terrains.json"),
  unitClasses: loadJson(z.record(UnitClassSchema), unitClassesJson, "unitClasses.json"),
  combat: loadJson(CombatConfigSchema, combatJson, "combat.json"),
  commanders: loadJson(z.record(CommanderSchema), commandersJson, "commanders.json"),
  items: loadJson(z.record(ItemSchema), itemsJson, "items.json"),
  strategies: loadJson(z.record(StrategySchema), strategiesJson, "strategies.json"),
  initialForces: loadJson(z.record(InitialForceSchema), initialForcesJson, "initialForces.json"),
  rosters: loadJson(z.record(RosterEntrySchema), rostersJson, "rosters.json"),
  shops: {
    ch1: loadJson(ShopSchema, shopCh1Json, "shops/ch1.json"),
  },
  maps: {
    sishuiguan: loadJson(BattleMapSchema, sishuiguanJson, "maps/sishuiguan.json"),
  },
  stages: {
    "05-sishuiguan": loadJson(StageSchema, stage05Json, "stages/05-sishuiguan.json"),
  },
};

/** Convenience shorthand — same object as gameData.stages */
export const stages: Record<string, Stage> = gameData.stages;
