import type { ChapterTest } from "./chapter-playtest";
import type { ChapterProgress } from "./chapter-progress";

export interface ChapterCheckpoint {
  version: 1; runId: string; nodeId: string; visit: number; progress: ChapterProgress;
}
const key = (id: string) => `tk.chapter.checkpoint.${id}`;
const strings = (value: unknown): value is string[] => Array.isArray(value) && value.every(v => typeof v === "string");
export function parseCheckpoint(value: unknown, test: ChapterTest): ChapterCheckpoint {
  const saved = value as ChapterCheckpoint;
  const p = saved?.progress;
  if (!saved || saved.version !== 1 || saved.runId !== test.id || !test.nodes.some(n => n.id === saved.nodeId) || !Number.isSafeInteger(saved.visit) || saved.visit < 0 || saved.visit > 99 || !p || !strings(p.joined) || !strings(p.departed) || !strings(p.sharedItems) || !p.units || typeof p.units !== "object" || Array.isArray(p.units)) throw new Error("저장된 테스트 진행 정보가 올바르지 않습니다. 처음부터 다시 시작해 주세요.");
  for (const [id, unit] of Object.entries(p.units)) {
    if (!unit || unit.commanderId !== id || typeof unit.classId !== "string" || !Number.isInteger(unit.level) || unit.level < 1 || unit.level > 99 || !Number.isSafeInteger(unit.exp) || unit.exp < 0 || !strings(unit.items)) throw new Error("저장된 장수 진행 정보가 올바르지 않습니다. 처음부터 다시 시작해 주세요.");
  }
  return structuredClone(saved);
}
export function loadCheckpoint(test: ChapterTest): ChapterCheckpoint | null {
  const value = localStorage.getItem(key(test.id));
  return value === null ? null : parseCheckpoint(JSON.parse(value), test);
}
export function saveCheckpoint(test: ChapterTest, nodeId: string, visit: number, progress: ChapterProgress): void {
  const saved = parseCheckpoint({ version: 1, runId: test.id, nodeId, visit, progress }, test);
  localStorage.setItem(key(test.id), JSON.stringify(saved));
}
export function rememberChapterTest(projectId: string, url: string): void {
  localStorage.setItem(`tk.chapter.latest.${projectId}`, url);
}
export function latestChapterTest(projectId: string): string {
  try {
    const url = localStorage.getItem(`tk.chapter.latest.${projectId}`) ?? "";
    return /^\/studio\/play\?draft=[a-f0-9-]{36}$/.test(url) ? url : "";
  } catch { return ""; }
}
