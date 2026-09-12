import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { CHAPTERS, chapterOf, chapterTitle, stageNumber } from "../../../tools/editor/chapters.js";

describe("editor/chapters — campaign.ts CHAPTERS 사본 (spec §2)", () => {
  it("campaign.ts 표와 동일 (SSOT 드리프트 가드)", () => {
    const src = readFileSync(fileURLToPath(new URL("../../../apps/web/src/meta/campaign.ts", import.meta.url)), "utf-8");
    const rows = [...src.matchAll(/\{ chapter: (\d+), title: "([^"]+)", from: (\d+), to: (\d+) \}/g)]
      .map((m) => ({ chapter: Number(m[1]), title: m[2], from: Number(m[3]), to: Number(m[4]) }));
    expect(rows.length).toBe(5);
    expect(CHAPTERS).toEqual(rows);
  });
  it("stageNumber / chapterOf / chapterTitle", () => {
    expect(CHAPTERS.length).toBe(5);
    expect(stageNumber("05-sishuiguan")).toBe(5);
    expect(chapterOf("05-sishuiguan")).toBe(2);
    expect(chapterOf("27-huarong")).toBe(5);
    expect(chapterOf("zz")).toBe(0);
    expect(chapterTitle("05-sishuiguan")).toBe("반동탁연합");
    expect(chapterTitle("zz")).toBe("");
  });
});
