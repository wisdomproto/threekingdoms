import { describe, it, expect } from "vitest";
import { describeTrigger, newDialogueId, newSceneLine, newVnPart, slotParts, sceneCount, collectSceneBgs } from "../../../tools/editor/story-model.js";
import { validateStory } from "../../../tools/editor/validate-story.js";

type Json = Record<string, unknown>;
const nameOf = (id: string) => ({ liubei: "유비" }[id] ?? id);
const duelLabel = (id: string) => ({ d1: "관우 vs 화웅" }[id] ?? id);

describe("story-model — describeTrigger (spec §5)", () => {
  it("5종 트리거를 사람 말로", () => {
    expect(describeTrigger({ kind: "battleStart" }, nameOf, duelLabel)).toBe("전투가 시작되면");
    expect(describeTrigger({ kind: "turn", n: 5 }, nameOf, duelLabel)).toBe("5턴이 시작되면");
    expect(describeTrigger({ kind: "unitRetreated", unitId: "liubei" }, nameOf, duelLabel)).toBe("유비이(가) 퇴각하면");
    expect(describeTrigger({ kind: "duelOccurred", duelId: "d1" }, nameOf, duelLabel)).toBe("일기토 관우 vs 화웅이(가) 일어나면");
    expect(describeTrigger({ kind: "battleEnd" }, nameOf, duelLabel)).toBe("전투가 끝나면");
    expect(describeTrigger({ kind: "battleEnd", result: "victory" }, nameOf, duelLabel)).toBe("전투에서 이기면");
    expect(describeTrigger({ kind: "battleEnd", result: "defeat" }, nameOf, duelLabel)).toBe("전투에서 지면");
  });
});

describe("story-model — id/줄/파트 생성", () => {
  it("newDialogueId: 최대 번호 +1, 빈 배열 → dlg-1, 비정형 id 섞여도 충돌 없음", () => {
    expect(newDialogueId(["dlg-1", "dlg-2"])).toBe("dlg-3");
    expect(newDialogueId([])).toBe("dlg-1");
    const existing = ["intro_x", "dlg-7", "dlg-abc", "05_turn3"];
    const id = newDialogueId(existing);
    expect(existing).not.toContain(id);
    expect(id).toBe("dlg-8");
  });
  it("newSceneLine: 내레이션 = speaker 키 없음 / 화자 = portraitId 기본 화자", () => {
    expect(newSceneLine()).toEqual({ text: "" });
    expect("speaker" in newSceneLine()).toBe(false);
    expect(newSceneLine("유비")).toEqual({ speaker: "유비", portraitId: "유비", text: "" });
  });
  it("newVnPart: bg 키 없이 내레이션 1줄", () => {
    const p = newVnPart();
    expect(p).toEqual({ lines: [{ text: "" }] });
    expect("bg" in p).toBe(false);
  });
});

describe("story-model — 슬롯/배경 수집", () => {
  const vn = { bg: "b1", lines: [{ text: "a" }, { text: "b", bg: "b2" }] };
  const map = { map: "scene-inn", units: [{ id: "u", sprite: "s", cell: [0, 0] }], lines: [{ text: "x" }] };
  it("slotParts: undefined → [], 단일 VN → [vn], 배열 → 그대로", () => {
    expect(slotParts(undefined)).toEqual([]);
    expect(slotParts(vn)).toEqual([vn]);
    const arr = [vn, map];
    expect(slotParts(arr)).toBe(arr);
  });
  it("sceneCount = intro + outro 파트 수", () => {
    expect(sceneCount({ scenario: { intro: vn, outro: [vn, map] } })).toBe(3);
    expect(sceneCount({})).toBe(0);
  });
  it("collectSceneBgs: 파트 bg + 줄 bg, 정렬·중복 제거, MapScene 무시", () => {
    const a = { scenario: { intro: vn, outro: [map, { bg: "b0", lines: [{ text: "" }] }] } };
    const b = { scenario: { outroDefeat: { bg: "b1", lines: [{ text: "", bg: "b3" }] } } };
    expect(collectSceneBgs([a, b, {}])).toEqual(["b0", "b1", "b2", "b3"]);
  });
});

describe("validate-story (spec §9)", () => {
  const ctx = { placedIds: ["liubei", "huaxiong"], duelIds: ["d1"] };
  const good = (): Json => JSON.parse(JSON.stringify({
    scenario: {
      intro: { bg: "x", lines: [{ text: "n" }, { speaker: "유비", text: "t" }] },
      outro: [{ lines: [{ text: "a" }] }, { map: "m", units: [{ id: "u", sprite: "s", cell: [0, 0] }], lines: [{ text: "x" }] }],
    },
    dialogue: [
      { id: "a", trigger: { kind: "battleStart" }, lines: [{ speaker: "유비", text: "t" }] },
      { id: "b", trigger: { kind: "turn", n: 3 }, lines: [{ speaker: "유비", text: "t" }] },
      { id: "c", trigger: { kind: "unitRetreated", unitId: "liubei" }, lines: [{ speaker: "유비", text: "t" }] },
      { id: "d", trigger: { kind: "duelOccurred", duelId: "d1" }, lines: [{ speaker: "유비", text: "t" }] },
    ],
  }));
  const errs = (mut: (s: Json) => void) => { const s = good(); mut(s); return validateStory(s, ctx); };
  const one = (mut: (s: Json) => void, ...contains: string[]) => {
    const e = errs(mut);
    expect(e.length).toBe(1);
    for (const c of contains) expect(e[0]).toContain(c);
  };
  // 테스트용 접근 — 캐스팅 잡음 줄이기
  const intro = (s: Json) => (s.scenario as Json).intro as Json & { lines: Json[] };
  const outro = (s: Json) => (s.scenario as Json).outro as Json[];
  const dlg = (s: Json) => s.dialogue as Array<Json & { lines: Json[]; trigger: Json }>;

  it("정상 → []; scenario/dialogue 없음 → []", () => {
    expect(validateStory(good(), ctx)).toEqual([]);
    expect(validateStory({}, ctx)).toEqual([]);
  });
  it("VN 파트 lines 빈 배열", () => one((s) => { intro(s).lines = []; }, "전투 전 이야기 1번째 장면", "줄이 없습니다"));
  it("줄 text 공백만", () => one((s) => { intro(s).lines[1]!.text = "  "; }, "전투 전 이야기 1번째 장면 2번째 줄", "본문이 비어 있습니다"));
  it("줄 speaker 키가 있는데 빈 문자열 (내레이션은 키 없음)", () => one((s) => { intro(s).lines[0]!.speaker = ""; }, "전투 전 이야기 1번째 장면 1번째 줄", "화자"));
  it("MapScene 파트 units 빈 배열", () => one((s) => { outro(s)[1]!.units = []; }, "전투 후 이야기 2번째 장면", "유닛"));
  it("dialogue id 중복", () => one((s) => { dlg(s)[1]!.id = "a"; }, "전투 중 대사 2번째", "중복"));
  it("dialogue speaker 빈", () => one((s) => { dlg(s)[0]!.lines[0]!.speaker = ""; }, "전투 중 대사 1번째 1번째 줄", "화자"));
  it("dialogue lines 빈 배열", () => one((s) => { dlg(s)[0]!.lines = []; }, "전투 중 대사 1번째", "줄이 없습니다"));
  it("turn.n 0", () => one((s) => { dlg(s)[1]!.trigger.n = 0; }, "전투 중 대사 2번째", "턴"));
  it("unitRetreated.unitId 미배치", () => one((s) => { dlg(s)[2]!.trigger.unitId = "ghost"; }, "전투 중 대사 3번째", "ghost"));
  it("duelOccurred.duelId 없음", () => one((s) => { dlg(s)[3]!.trigger.duelId = "nope"; }, "전투 중 대사 4번째", "nope"));
});
