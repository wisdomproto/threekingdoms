import { type BattleState, isConsumable } from "@tk/engine";
import { runtimeGameData } from "../lab/catalog-data";
import { type LabPayload } from "../lab/lab";
import { parsePlaytestSnapshot } from "../lab/playtest";
import type { ChapterTest } from "./chapter-playtest";

export interface CarriedUnit { commanderId: string; classId: string; level: number; exp: number; items: string[] }
export interface BattleCarry { units: CarriedUnit[]; sharedItems: string[] }
export interface ChapterProgress {
  units: Record<string, CarriedUnit>; sharedItems: string[]; joined: string[]; departed: string[];
}
export function collectBattleCarry(state: BattleState): BattleCarry {
  return { units: state.units.filter(u => u.side === "player").map(u => ({ commanderId: u.id, classId: u.classId, level: u.level, exp: u.exp, items: [...u.items] })), sharedItems: [...state.sharedItems.friendly] };
}
export function initialChapterProgress(test: ChapterTest): ChapterProgress {
  const snapshot = test.nodes.find(n => n.snapshot)?.snapshot;
  if (!snapshot) return { units: {}, sharedItems: [], joined: [], departed: [] };
  const parsed = parsePlaytestSnapshot(snapshot);
  if (!parsed.ok) throw new Error(parsed.message);
  const data = runtimeGameData(parsed.payload.catalogs);
  return { units: {}, sharedItems: [], departed: [], joined: Object.values(data.rosters).filter(r => r.joinChapter <= (test.chapterNumber ?? 1)).map(r => r.commanderId) };
}
export function applyChapterProgress(payload: LabPayload, progress: ChapterProgress): LabPayload {
  const result = structuredClone(payload);
  const apply = (unit: LabPayload["stage"]["units"][number]) => {
    const carried = progress.units[unit.commanderId];
    if (unit.side !== "player" || !carried) return unit;
    return { ...unit, classId: carried.classId, level: carried.level, exp: carried.exp, items: [...carried.items] };
  };
  result.stage.units = result.stage.units.map(apply);
  if (result.stage.reinforcements) result.stage.reinforcements = result.stage.reinforcements.map(r => ({ ...r, units: r.units.map(apply) }));
  result.sharedItems = [...progress.sharedItems];
  return result;
}
export function finishChapterBattle(previous: ChapterProgress, payload: LabPayload, result: "victory" | "defeat", value: unknown): ChapterProgress {
  if (result === "defeat") return previous;
  const carry = value as BattleCarry;
  if (!carry || !Array.isArray(carry.units) || !Array.isArray(carry.sharedItems)) throw new Error("전투 성장 결과를 읽지 못했습니다.");
  const data = runtimeGameData(payload.catalogs), next = structuredClone(previous);
  const allowed = new Set([...payload.stage.units, ...(payload.stage.reinforcements ?? []).flatMap(r => r.units)].map(u => u.commanderId));
  const seen = new Set<string>();
  for (const unit of carry.units) {
    if (!unit || !allowed.has(unit.commanderId) || seen.has(unit.commanderId) || !Object.hasOwn(data.unitClasses, unit.classId) || !Number.isInteger(unit.level) || unit.level < 1 || unit.level > 99 || !Number.isSafeInteger(unit.exp) || unit.exp < 0 || !Array.isArray(unit.items) || unit.items.some(id => !Object.hasOwn(data.items, id) || isConsumable(data.items[id]!.category))) throw new Error("전투 성장·장비 결과가 올바르지 않습니다.");
    seen.add(unit.commanderId);
    next.units[unit.commanderId] = structuredClone(unit);
    if (!next.joined.includes(unit.commanderId) && !next.departed.includes(unit.commanderId)) next.joined.push(unit.commanderId);
  }
  if (carry.sharedItems.some(id => !Object.hasOwn(data.items, id) || !isConsumable(data.items[id]!.category))) throw new Error("부대 창고 결과가 올바르지 않습니다.");
  next.sharedItems = [...carry.sharedItems];
  for (const roster of Object.values(data.rosters)) {
    if (roster.departsAfterStage === payload.stage.id && next.joined.includes(roster.commanderId)) {
      next.joined = next.joined.filter(id => id !== roster.commanderId);
      if (!next.departed.includes(roster.commanderId)) next.departed.push(roster.commanderId);
    }
  }
  return next;
}
const key = (id: string) => `tk.chapter.progress.${id}`;
export function writeChapterProgress(runId: string, nodeId: string, visit: number, progress: ChapterProgress): void {
  sessionStorage.setItem(key(runId), JSON.stringify({ nodeId, visit, progress }));
}
export function readChapterProgress(runId: string, nodeId: string, visit: number): ChapterProgress {
  const saved = JSON.parse(sessionStorage.getItem(key(runId)) ?? "null");
  if (!saved || saved.nodeId !== nodeId || saved.visit !== visit || !saved.progress?.units || !Array.isArray(saved.progress.sharedItems)) throw new Error("챕터 진행 정보가 일치하지 않습니다. 챕터 처음부터 다시 테스트해 주세요.");
  return saved.progress as ChapterProgress;
}
