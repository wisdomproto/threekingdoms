import { describe, expect, it } from "vitest";
import { stages, type SceneSlot } from "@tk/data";
import { readingLines } from "../chronicle";

describe("chronicle reading", () => {
  it("keeps choices separate instead of presenting incompatible answers as one conversation", () => {
    const lines = readingLines(stages['01-zhuojun']!.scenario!.intro);
    const choice = lines.find(line => line.choices);
    expect(choice?.choices).toHaveLength(2);
    expect(choice?.choices?.every(option => option.lines.length > 0)).toBe(true);
    expect(lines.some(line => line.text === choice?.choices?.[0]?.lines[0]?.text)).toBe(false);
  });
  it("preserves VN, map and comic reading order without exporting movement commands", () => {
    const slot: SceneSlot = [
      { lines: [{ text: 'Before' }] },
      { map: 'test', units: [], lines: [{ text: 'Walk', move: [{ id: 'hero', to: [1, 2] }] }] },
      { kind: 'comic', pages: [{ image: 'page', panels: [{ rect: [0, 0, 1, 1], lines: [{ text: 'After' }] }] }] },
    ];
    expect(readingLines(slot).map(line => line.text)).toEqual(['Before', 'Walk', 'After']);
    expect(readingLines(slot).some(line => 'move' in line)).toBe(false);
    expect(readingLines(undefined)).toEqual([]);
  });
});
