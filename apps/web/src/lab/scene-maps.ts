import { gameData, type BattleMap } from "@tk/data";

export function resolveSceneMap(id: string, maps?: Record<string, BattleMap>): BattleMap | undefined {
  return maps && Object.hasOwn(maps, id) ? maps[id] : Object.hasOwn(gameData.maps, id) ? gameData.maps[id] : undefined;
}
