/**
 * Publish 게이트 (spec 2026-09-12-creator-ux-p2 §7) — 레포 `json/stages/*.json`·`json/maps/*.json` 을
 * 디스크에서 읽어 zod 로 **전수** 검사한다. 콘텐츠 회귀(05 목표가 정확히 무엇인지 등)는 여기 없다 —
 * 에디터 Publish 는 "스키마에 맞는가·참조가 살아 있는가"만 묻는다. serve.py `_validate_data` 가
 * `vitest run publish-gate` 로 이 파일만 돌린다. index.ts 미등록 신규 파일도 검사된다.
 */
import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { BattleMapSchema, StageSchema } from "../src/schemas";
// gameData(index.ts) 를 import 하면 등록 JSON 하나만 깨져도 모듈 로드에서 throw 해 "전수 보고"가 죽는다 — 참조표도 디스크에서 읽는다.
const readJson = (rel: string) => JSON.parse(readFileSync(join(__dirname, "..", "json", rel), "utf-8")) as Record<string, unknown>;

const JSON_DIR = join(__dirname, "..", "json");
const readDir = (sub: string) =>
  readdirSync(join(JSON_DIR, sub)).filter((f) => f.endsWith(".json")).map((f) => ({ file: `${sub}/${f}`, obj: JSON.parse(readFileSync(join(JSON_DIR, sub, f), "utf-8")) as unknown }));

describe("publish gate — 레포 JSON 스키마 전수", () => {
  const maps = readDir("maps");
  const stages = readDir("stages");
  const commanderIds = new Set(Object.keys(readJson("commanders.json")));
  const classIds = new Set(Object.keys(readJson("unitClasses.json")));

  it("maps/*.json 전부 BattleMapSchema 통과", () => {
    const bad = maps.flatMap(({ file, obj }) => { const r = BattleMapSchema.safeParse(obj); return r.success ? [] : [`${file}: ${r.error.issues[0]?.path.join(".")} ${r.error.issues[0]?.message}`]; });
    expect(bad).toEqual([]);
  });

  it("stages/*.json 전부 StageSchema 통과", () => {
    const bad = stages.flatMap(({ file, obj }) => { const r = StageSchema.safeParse(obj); return r.success ? [] : [`${file}: ${r.error.issues[0]?.path.join(".")} ${r.error.issues[0]?.message}`]; });
    expect(bad).toEqual([]);
  });

  it("stages 참조 무결성 — mapId·commanderId·classId·dialogue 트리거", () => {
    const mapIds = new Set(maps.map(({ obj }) => (obj as { id: string }).id));
    const bad: string[] = [];
    for (const { file, obj } of stages) {
      const r = StageSchema.safeParse(obj);
      if (!r.success) continue; // 위 테스트가 보고
      const s = r.data;
      if (!mapIds.has(s.mapId)) bad.push(`${file}: mapId ${s.mapId} 없음`);
      const placed = [...s.units, ...(s.reinforcements ?? []).flatMap((x) => x.units)];
      for (const u of placed) {
        if (!commanderIds.has(u.commanderId)) bad.push(`${file}: commanderId ${u.commanderId} 없음`);
        if (!classIds.has(u.classId)) bad.push(`${file}: classId ${u.classId} 없음`);
      }
      const placedIds = new Set(placed.map((u) => u.commanderId));
      const duelIds = new Set(s.events.map((e) => e.id));
      const seen = new Set<string>();
      for (const d of s.dialogue ?? []) {
        if (seen.has(d.id)) bad.push(`${file}: dialogue id 중복 ${d.id}`);
        seen.add(d.id);
        if (d.trigger.kind === "unitRetreated" && !placedIds.has(d.trigger.unitId)) bad.push(`${file}: dialogue ${d.id} unitRetreated ${d.trigger.unitId} 미배치`);
        if (d.trigger.kind === "duelOccurred" && !duelIds.has(d.trigger.duelId)) bad.push(`${file}: dialogue ${d.id} duelOccurred ${d.trigger.duelId} 없음`);
      }
    }
    expect(bad).toEqual([]);
  });
});
