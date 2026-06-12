import { z } from "zod";
import {
  TerrainSchema,
  UnitClassSchema,
  CommanderSchema,
  CombatConfigSchema,
  StageSchema,
  type Terrain,
  type UnitClass,
  type Commander,
  type CombatConfig,
  type Stage,
} from "./schemas";
import terrainsJson from "../json/terrains.json";
import unitClassesJson from "../json/unitClasses.json";
import commandersJson from "../json/commanders.json";
import combatJson from "../json/combat.json";
import sishuiguanJson from "../json/stages/05-sishuiguan.json";

export * from "./schemas";

export interface GameData {
  terrains: Record<string, Terrain>;
  unitClasses: Record<string, UnitClass>;
  commanders: Record<string, Commander>;
  combat: CombatConfig;
}

function loadJson<T>(
  schema: { safeParse: (d: unknown) => { success: true; data: T } | { success: false; error: { message: string } } },
  data: unknown,
  filename: string
): T {
  const result = schema.safeParse(data);
  if (!result.success) {
    throw new Error(`[${filename}] 스키마 검증 실패:\n${result.error.message}`);
  }
  return result.data;
}

/** import 시점에 전부 검증 — 잘못된 JSON은 여기서 즉시 터진다 */
export const gameData: GameData = {
  terrains: loadJson(z.record(TerrainSchema), terrainsJson, "terrains.json"),
  unitClasses: loadJson(z.record(UnitClassSchema), unitClassesJson, "unitClasses.json"),
  commanders: loadJson(z.record(CommanderSchema), commandersJson, "commanders.json"),
  combat: loadJson(CombatConfigSchema, combatJson, "combat.json"),
};

export const stages: Record<string, Stage> = {
  "05-sishuiguan": loadJson(StageSchema, sishuiguanJson, "stages/05-sishuiguan.json"),
};
