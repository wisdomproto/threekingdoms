import { afterEach, describe, expect, it, vi } from "vitest";
import { latestChapterTest, loadCheckpoint, parseCheckpoint, rememberChapterTest, saveCheckpoint } from "../chapter-checkpoint";
import type { ChapterTest } from "../chapter-playtest";

const test: ChapterTest = { kind: "tk-chapter-test", version: 1, id: "run", name: "Test", entry: "end", returnUrl: "/studio?project=p", nodes: [{ id: "end", name: "End", kind: "end", next: {} }] };
const progress = { joined: ["유비"], departed: [], sharedItems: ["콩"], units: { 유비: { commanderId: "유비", classId: "footman", level: 5, exp: 37, items: ["사모"] } } };
function storage() {
  const values = new Map<string, string>();
  vi.stubGlobal("localStorage", { getItem: (k: string) => values.get(k) ?? null, setItem: (k: string, v: string) => values.set(k, v) });
  return values;
}
afterEach(() => vi.unstubAllGlobals());
describe("chapter checkpoints", () => {
  it("restores progress at a node boundary and isolates immutable runs", () => {
    storage();
    expect(loadCheckpoint(test)).toBeNull();
    saveCheckpoint(test, "end", 3, progress);
    expect(loadCheckpoint(test)).toMatchObject({ nodeId: "end", visit: 3, progress });
    expect(loadCheckpoint({ ...test, id: "new-run" })).toBeNull();
    const saved = loadCheckpoint(test)!;
    saved.progress.units.유비!.exp = 0;
    expect(loadCheckpoint(test)!.progress.units.유비!.exp).toBe(37);
  });
  it("rejects stale, malformed and unsupported checkpoints without overwriting them", () => {
    const values = storage();
    saveCheckpoint(test, "end", 3, progress);
    const valid = loadCheckpoint(test)!;
    for (const patch of [{ version: 2 }, { runId: "other" }, { nodeId: "missing" }, { visit: 100 }, { progress: { ...progress, joined: null } }]) {
      expect(() => parseCheckpoint({ ...valid, ...patch }, test)).toThrow();
    }
    values.set("tk.chapter.checkpoint.run", "broken");
    expect(() => loadCheckpoint(test)).toThrow();
    expect(values.get("tk.chapter.checkpoint.run")).toBe("broken");
  });
  it("surfaces storage failure and rejects external resume URLs", () => {
    storage();
    rememberChapterTest("p", "https://example.com");
    expect(latestChapterTest("p")).toBe("");
    const url = "/studio/play?draft=8f28be63-2473-48f9-84b1-d7df73c8cf15";
    rememberChapterTest("p", url);
    expect(latestChapterTest("p")).toBe(url);
    expect(latestChapterTest("other")).toBe("");
    vi.stubGlobal("localStorage", { setItem: () => { throw new Error("Quota exceeded"); } });
    expect(() => saveCheckpoint(test, "end", 3, progress)).toThrow("Quota exceeded");
  });
});
