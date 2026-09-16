import { CommanderSchema, ItemSchema, RosterEntrySchema, gameData, type GameData } from "@tk/data";

export type RuntimeCatalogs = Pick<GameData, "commanders" | "items" | "rosters">;
function record<T>(value: unknown, schema: { parse(value: unknown): T }, name: string): Record<string, T> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${name}: 데이터 목록이 필요합니다.`);
  return Object.fromEntries(Object.entries(value).map(([key, row]) => {
    const parsed = schema.parse(row);
    const id = (parsed as { id?: string; commanderId?: string }).id ?? (parsed as { commanderId?: string }).commanderId;
    if (id !== key) throw new Error(`${name}.${key}: ID와 목록 키가 다릅니다.`);
    return [key, parsed];
  }));
}
export function parseRuntimeCatalogs(value: unknown): RuntimeCatalogs {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("프로젝트 데이터 목록이 필요합니다.");
  const source = value as Record<string, unknown>;
  return {
    commanders: record(source.commanders, CommanderSchema, "장수"),
    items: record(source.items, ItemSchema, "아이템"),
    rosters: record(source.rosters, RosterEntrySchema, "로스터"),
  };
}
export function runtimeGameData(catalogs?: RuntimeCatalogs): GameData {
  return catalogs ? { ...gameData, ...parseRuntimeCatalogs(catalogs) } : gameData;
}
