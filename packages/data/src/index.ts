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

/** import 시점에 전부 검증 — 잘못된 JSON은 여기서 즉시 터진다 */
export const gameData: GameData = {
  terrains: z.record(TerrainSchema).parse(terrainsJson),
  unitClasses: z.record(UnitClassSchema).parse(unitClassesJson),
  commanders: z.record(CommanderSchema).parse(commandersJson),
  combat: CombatConfigSchema.parse(combatJson),
};

export const stages: Record<string, Stage> = {
  "05-sishuiguan": StageSchema.parse(sishuiguanJson),
};
