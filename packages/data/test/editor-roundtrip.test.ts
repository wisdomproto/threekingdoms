import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { loadStage, serializeStage, loadMap, serializeMap, cloneUnits } from "../../../tools/editor/stage-io.js";

// 파일을 직접 열거한다(gameData 경유 X) — 새 스테이지/맵 파일도 자동 포함, 스키마 무효 파일도 보존 검증 대상.
const JSON_DIR = fileURLToPath(new URL("../json/", import.meta.url));
type Json = Record<string, unknown>;
function files(sub: string): Array<[string, Json]> {
  const dir = join(JSON_DIR, sub);
  return readdirSync(dir).filter((f) => f.endsWith(".json")).sort()
    .map((f) => [f, JSON.parse(readFileSync(join(dir, f), "utf-8")) as Json]);
}
const same = (a: unknown, b: unknown) => {
  expect(a).toEqual(b);                                   // 구조 — 실패 시 읽을 수 있는 diff
  expect(JSON.stringify(a)).toBe(JSON.stringify(b));      // 키 순서까지
};

describe("에디터 round-trip — Load → 수정 없음 → Save 는 원본과 구조·키 순서까지 동일 (spec §6-1)", () => {
  const stages = files("stages");
  const maps = files("maps");
  it("스테이지·맵 파일이 열거된다", () => {
    expect(stages.length).toBeGreaterThanOrEqual(27);
    expect(maps.length).toBeGreaterThanOrEqual(30);
  });
  for (const [name, obj] of stages) {
    it(`stages/${name}`, () => same(serializeStage(loadStage(obj)), obj));
  }
  for (const [name, obj] of maps) {
    it(`maps/${name}`, () => same(serializeMap(loadMap(obj)), obj));
  }
});

describe("에디터 round-trip — 편집 의미론 (spec §6-2)", () => {
  // 최소 스테이지 — 실데이터 모양이 아니라 합성(synthetic) 데이터다. camera 안에 미지 키(decorations)를
  // 일부러 넣어 그 경로를 exercise한다 — 실제 스테이지 02/04/06은 24f6d42에서 decorations를 camera 밖으로
  // 뽑아 이제 이 모양을 안 쓰지만, 로드/저장이 여전히 이를 보존해야 한다는 계약은 유효하다.
  // 그 외: 미지 유닛 필드·optional:false·once 없는 증원.
  const base = (): Json => JSON.parse(JSON.stringify({
    id: "t", name: "T", mapId: "m", turnLimit: 20,
    camera: { decorations: [{ cell: [1, 1], kind: "reeds" }], zoom: 1.5, focus: [3, 4] },
    scenario: { intro: { bg: "x", lines: [{ speaker: "유비", text: "…" }] } },
    dialogue: { battleStart: [{ speaker: "정원지", text: "…" }] },
    units: [{ commanderId: "liubei", classId: "lord", level: 1, troops: 100, items: [], side: "player", x: 1, y: 2, note: "미지" }],
    objectives: [{ kind: "defeatAll", optional: false }],
    reinforcements: [{ id: "r1", side: "enemy", trigger: { kind: "turn", turn: 3 }, units: [{ commanderId: "bandit-1", classId: "bandit", level: 1, troops: 50, items: [], side: "enemy", x: 5, y: 5, tag: "미지" }] }],
    events: [{ id: "d1", type: "duel", trigger: { kind: "attack", attackerId: "liubei", defenderId: "bandit-1" }, outcome: { winnerId: "liubei", loserRetreats: true }, once: true }],
  }));

  it("유닛 x 변경 → 그 필드만 바뀌고 scenario·유닛 미지 필드·camera 안 미지 키 보존", () => {
    const m = loadStage(base()) as Json & { units: Json[] };
    m.units[0]!.x = 9;
    const out = serializeStage(m) as Json & { units: Json[]; camera: Json };
    const want = base() as Json & { units: Json[] };
    want.units[0]!.x = 9;
    same(out, want);
    expect(out.units[0]!.note).toBe("미지");
    expect((out.camera.decorations as unknown[]).length).toBe(1);
  });

  it("camera=null / victory=null → 키 삭제 (원본에 있었어도)", () => {
    const src = base(); (src as Json).victory = { kind: "defeatAll" };
    const m = loadStage(src) as Json;
    m.camera = null; m.victory = null;
    const out = serializeStage(m) as Json;
    expect("camera" in out).toBe(false);
    expect("victory" in out).toBe(false);
  });

  it("camera.focus=null (UI가 만드는 값) → focus 키 없음, zoom·미지 키는 유지", () => {
    const m = loadStage(base()) as Json & { camera: Json };
    m.camera.focus = null;
    const out = serializeStage(m) as Json & { camera: Json };
    expect("focus" in out.camera).toBe(false);
    expect(out.camera.zoom).toBe(1.5);
    expect(Array.isArray(out.camera.decorations)).toBe(true);
  });

  it("새 이벤트(ORIG 없음) → 소유 키 순서로 생성, type='duel' once=true 는 UI가 넣은 그대로", () => {
    const m = loadStage(base()) as Json & { events: Json[] };
    m.events.push({ id: "d2", type: "duel", trigger: { kind: "attack", attackerId: "a", defenderId: "b" }, outcome: { winnerId: "a", loserRetreats: false }, once: true });
    const out = serializeStage(m) as Json & { events: Json[] };
    expect(Object.keys(out.events[1]!)).toEqual(["id", "type", "trigger", "outcome", "once"]);
    expect(out.events[1]!.once).toBe(true);
  });

  it("유닛 삭제 → 원소 제거", () => {
    const m = loadStage(base()) as Json & { units: Json[] };
    m.units.splice(0, 1);
    expect(((serializeStage(m) as Json).units as unknown[]).length).toBe(0);
  });

  it("turnLimit 없는 입력 → 저장에도 없음 (기본값 주입 금지)", () => {
    const src = base(); delete (src as Json).turnLimit;
    expect("turnLimit" in (serializeStage(loadStage(src)) as Json)).toBe(false);
  });

  it("optional:false 목표 보존, 새 증원(units: []) 은 units 기록, once 없는 증원은 once 없이", () => {
    const m = loadStage(base()) as Json & { reinforcements: Json[]; objectives: Json[] };
    m.reinforcements.push({ id: "r2", side: "enemy", units: [], trigger: { kind: "turn", turn: 5 }, once: true });
    const out = serializeStage(m) as Json & { reinforcements: Json[]; objectives: Json[] };
    expect(out.objectives[0]!.optional).toBe(false);
    expect("once" in out.reinforcements[0]!).toBe(false);
    expect(out.reinforcements[1]!.units).toEqual([]);
    expect(Object.keys(out.reinforcements[1]!)).toEqual(["id", "side", "trigger", "units", "once"]);
  });

  it("cloneUnits 로 Undo 스냅샷 → 복원 → 저장해도 유닛 미지 필드 보존", () => {
    const m = loadStage(base()) as Json & { units: Json[] };
    const snap = cloneUnits(m.units);
    m.units[0]!.x = 99;
    m.units = snap; // doUndo 와 동일
    const out = serializeStage(m) as Json & { units: Json[] };
    expect(out.units[0]!.x).toBe(1);
    expect(out.units[0]!.note).toBe("미지");
  });

  it("맵: tiles 는 string[][] 로 로드되고 legend 미사용 키가 보존된다", () => {
    const map = { id: "m", name: "M", width: 3, height: 2, tileLegend: { ".": "plain", "g": "grass", "z": "unused" }, tiles: ["..g", "g.."] };
    const model = loadMap(map);
    expect(model.tiles).toEqual([[".", ".", "g"], ["g", ".", "."]]);
    same(serializeMap(model), map);
  });

  it("맵: tileLegend=null → 사용된 문자만 TERRAINS 순서로 새 legend 생성", () => {
    const model = loadMap({ id: "m", name: "M", width: 2, height: 1, tileLegend: null, tiles: [".g"] });
    const out = serializeMap(model);
    expect(out.tileLegend).toEqual({ ".": "plain", "g": "grass" });
  });

  it("맵: legend에 없는 문자를 tiles가 사용 → 원본 legend 키 순서 유지 + 누락 문자만 TERRAINS에서 뒤에 보충", () => {
    const model = loadMap({ id: "m", name: "M", width: 2, height: 1, tileLegend: { ".": "plain" }, tiles: [".g"] });
    const out = serializeMap(model);
    expect(Object.keys(out.tileLegend as Json)).toEqual([".", "g"]);
    expect(out.tileLegend).toEqual({ ".": "plain", "g": "grass" });
  });
});
