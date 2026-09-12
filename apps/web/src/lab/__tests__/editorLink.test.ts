import { describe, it, expect } from "vitest";
import { editorUrlFor } from "../editorLink";

describe("editorUrlFor — 게임 → 에디터 빠른 편집 진입 (spec §8)", () => {
  it("origin + stage-editor.html?stage=…&quick=1", () => {
    expect(editorUrlFor("05-sishuiguan", "http://localhost:8081")).toBe("http://localhost:8081/tools/stage-editor.html?stage=05-sishuiguan&quick=1");
  });
  it("stageId 는 URL 인코딩, origin 끝 슬래시는 제거", () => {
    expect(editorUrlFor("a b&c", "http://x/")).toBe("http://x/tools/stage-editor.html?stage=a%20b%26c&quick=1");
  });
});
