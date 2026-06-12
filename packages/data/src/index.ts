import { z } from "zod";
import {
  TerrainSchema, UnitClassSchema, CombatConfigSchema,
  type Terrain, type UnitClass, type CombatConfig,
} from "./schemas";
import terrainsJson from "../json/terrains.json";
import unitClassesJson from "../json/unitClasses.json";
import combatJson from "../json/combat.json";

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
}

/** import 시점에 전부 검증 — 잘못된 JSON은 여기서 즉시 터진다.
 *  commanders/items/initialForces/maps/stages는 Port 5/6/9에서 추가된다. */
export const gameData: GameData = {
  terrains: loadJson(z.record(TerrainSchema), terrainsJson, "terrains.json"),
  unitClasses: loadJson(z.record(UnitClassSchema), unitClassesJson, "unitClasses.json"),
  combat: loadJson(CombatConfigSchema, combatJson, "combat.json"),
};
