import { describe, it, expect } from "vitest";
import { diffStage, checklist } from "../../../tools/editor/publish.js";

type Json = Record<string, unknown>;
const base = (): Json => JSON.parse(JSON.stringify({
  id: "t", turnLimit: 30, units: Array.from({ length: 12 }, (_, i) => ({ commanderId: `u${i}`, x: i, y: 0 })),
  scenario: { intro: { bg: "x", lines: Array.from({ length: 6 }, () => ({ text: "a" })) }, outro: [{ lines: [{ text: "b" }] }] },
  dialogue: [{ id: "a", trigger: { kind: "battleStart" }, lines: [{ speaker: "s", text: "t" }] }],
  foo: { deep: 1 },
}));

describe("publish — diffStage (spec §7)", () => {
  it("동일 → []", () => expect(diffStage(base(), base())).toEqual([]));
  it("turnLimit 변경 → changed with before/after", () => {
    const a = base(); (a as Json).turnLimit = 25;
    expect(diffStage(base(), a)).toEqual([{ key: "turnLimit", kind: "changed", before: 30, after: 25 }]);
  });
  it("units 길이 변경 → count", () => {
    const a = base(); (a.units as Json[]).push({ commanderId: "new", x: 0, y: 0 });
    expect(diffStage(base(), a)).toEqual([{ key: "units", kind: "count", before: 12, after: 13 }]);
  });
  it("units 같은 길이·내용 변경 → changed", () => {
    const a = base(); (a.units as Json[])[0]!.x = 99;
    expect(diffStage(base(), a)).toEqual([{ key: "units", kind: "changed" }]);
  });
  it("dialogue 추가 → count", () => {
    const a = base(); (a.dialogue as Json[]).push({ id: "b", trigger: { kind: "battleStart" }, lines: [] });
    expect(diffStage(base(), a)).toEqual([{ key: "dialogue", kind: "count", before: 1, after: 2 }]);
  });
  it("scenario.intro 줄 수 변화 → lines (슬롯별)", () => {
    const a = base(); ((a.scenario as Json).intro as { lines: Json[] }).lines.push({ text: "c" }, { text: "d" });
    expect(diffStage(base(), a)).toEqual([{ key: "scenario.intro", kind: "lines", before: 6, after: 8 }]);
  });
  it("scenario 슬롯 추가/삭제 → added/removed, 줄 수 같고 내용만 변경 → changed", () => {
    const a = base(); (a.scenario as Json).outroDefeat = { lines: [{ text: "z" }] }; delete (a.scenario as Json).outro;
    ((a.scenario as Json).intro as { bg: string }).bg = "y";
    expect(diffStage(base(), a)).toEqual([
      { key: "scenario.intro", kind: "changed" },
      { key: "scenario.outro", kind: "removed" },
      { key: "scenario.outroDefeat", kind: "added" },
    ]);
  });
  it("키 추가/삭제 → added/removed; 미지 키 변화 → changed", () => {
    const a = base(); delete a.foo; a.bar = 1;
    expect(diffStage(base(), a)).toEqual([{ key: "foo", kind: "removed" }, { key: "bar", kind: "added" }]);
    const b = base(); (b.foo as Json).deep = 2;
    expect(diffStage(base(), b)).toEqual([{ key: "foo", kind: "changed", before: { deep: 1 }, after: { deep: 2 } }]);
  });
  it("before 가 null(새 스테이지) → 전 키 added", () => {
    expect(diffStage(null, { id: "n", units: [] }).map((d) => d.kind)).toEqual(["added", "added"]);
  });
});

describe("publish — checklist", () => {
  it("오류 없음 + 에셋 경고 → 4항목, warn 허용, canPublish", () => {
    const c = checklist({ localErrors: [], hasVictory: true, hasFail: false, missingAssets: ["maps/05.webp"] });
    expect(c.items.length).toBe(4);
    expect(c.items.map((i) => i.status)).toEqual(["ok", "warn", "warn", "ok"]);
    expect(c.canPublish).toBe(true);
  });
  it("localErrors 있음 → 필수 error, canPublish false", () => {
    const c = checklist({ localErrors: ["x"], hasVictory: true, hasFail: true, missingAssets: [] });
    expect(c.items[0]!.status).toBe("error");
    expect(c.items[1]!.status).toBe("ok");
    expect(c.items[2]!.status).toBe("ok");
    expect(c.canPublish).toBe(false);
  });
  it("승패조건 없음 → error", () => {
    expect(checklist({ localErrors: [], hasVictory: false, hasFail: false, missingAssets: [] }).canPublish).toBe(false);
  });
});
