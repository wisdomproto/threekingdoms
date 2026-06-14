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
import huluguanJson from "../json/maps/huluguan.json";
import xuzhouJson from "../json/maps/xuzhou.json";
import xiapi1Json from "../json/maps/xiapi1.json";
import stage05Json from "../json/stages/05-sishuiguan.json";
import stage06Json from "../json/stages/06-huluguan.json";
import stage10Json from "../json/stages/10-xuzhou.json";
import stage12Json from "../json/stages/12-xiapi1.json";

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
    huluguan: loadJson(BattleMapSchema, huluguanJson, "maps/huluguan.json"),
    xuzhou: loadJson(BattleMapSchema, xuzhouJson, "maps/xuzhou.json"),
    xiapi1: loadJson(BattleMapSchema, xiapi1Json, "maps/xiapi1.json"),
  },
  stages: {
    "05-sishuiguan": loadJson(StageSchema, stage05Json, "stages/05-sishuiguan.json"),
    "06-huluguan": loadJson(StageSchema, stage06Json, "stages/06-huluguan.json"),
    "10-xuzhou": loadJson(StageSchema, stage10Json, "stages/10-xuzhou.json"),
    "12-xiapi1": loadJson(StageSchema, stage12Json, "stages/12-xiapi1.json"),
  },
};

/** Convenience shorthand — same object as gameData.stages */
export const stages: Record<string, Stage> = gameData.stages;
