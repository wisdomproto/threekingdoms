# 에디터 round-trip 무손실 + 3단 검증 — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `tools/stage-editor.html`이 스테이지/맵을 열고 저장해도 에디터가 모르는 필드(`scenario`·`dialogue`·`decorations`…)를 하나도 잃지 않게 하고, 저장은 항상 허용하며 검증을 Save/Playtest/Publish 3단으로 나눈다.

**Architecture:** I/O 코어를 DOM 무관 ESM 모듈 `tools/editor/stage-io.js`로 뽑아 **원본 보존 오버레이**(WeakMap `ORIG` + 소유 키 스프레드 병합)를 구현하고, vitest가 27 스테이지·30 맵의 `stringify(serialize(load(x))) === stringify(x)`를 게이트로 강제한다. HTML은 그 모듈을 `<script type="module">`로 import해 얇은 래퍼만 남기고, serve.py가 `POST /validate-data`로 `pnpm --filter @tk/data test`를 대신 실행해 Publish 검사를 제공한다.

**Tech Stack:** 브라우저 ESM(빌드 없음) · vitest(`packages/data`, TS) · Python `http.server`(`tools/serve.py`) · zod 검증은 기존 `@tk/data` 테스트 재사용(새 의존성 0).

**Spec:** `docs/superpowers/specs/2026-09-11-editor-roundtrip-design.md` (§4 규칙·§4-5 존재 규칙·§6 테스트 목록이 곧 수용 기준)

**작업 위치:** 메인 체크아웃 `C:\projects\threekingdoms` (브랜치 `main`). 커밋 트레일러 `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`. 커밋 전 `pnpm --filter @tk/data test` green.

---

## File Structure

| 파일 | 책임 |
|---|---|
| `tools/editor/stage-io.js` (신규) | `TERRAINS` · `loadStage` · `serializeStage` · `cloneUnits` · `loadMap` · `serializeMap`. DOM·전역 없음. 원본 보존 규칙(§4) 전부 여기. |
| `tools/editor/stage-io.d.ts` (신규) | 위 모듈의 TS 선언(테스트·typecheck용). `tsconfig.base.json`이 `moduleResolution: Bundler`라 `.js` 지정자가 이 사이드카로 해석됨 — tsconfig 변경 금지. |
| `packages/data/test/editor-roundtrip.test.ts` (신규) | round-trip 동일성(파일 열거) + 편집 의미론 케이스. |
| `tools/stage-editor.html` (수정) | 모듈 import, 4개 I/O 함수를 래퍼로 교체, `TERRAINS` 인라인 삭제, `pushUndo`가 `cloneUnits`, 저장 차단 3지점 제거, 배너 문구, 「Publish 검사」 버튼+패널, 모듈 로드 실패 안내. |
| `tools/serve.py` (수정) | `POST /validate-data`. |

---

## Chunk 1: I/O 모듈 + 회귀 게이트

### Task 1: round-trip 동일성 테스트 (실패 먼저)

**Files:**
- Create: `packages/data/test/editor-roundtrip.test.ts`

- [ ] **Step 1: 테스트 파일 작성**

```ts
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
const same = (a: unknown, b: unknown) => expect(JSON.stringify(a)).toBe(JSON.stringify(b)); // 구조 + 키 순서

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
  // 실데이터를 흉내 낸 최소 스테이지: 미지 키·미지 유닛 필드·camera 안의 미지 키·optional:false·once 없는 증원
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
});
```

- [ ] **Step 2: 실패 확인**

Run: `pnpm --filter @tk/data test -- editor-roundtrip`
Expected: FAIL — `Cannot find module '../../../tools/editor/stage-io.js'`

### Task 2: `stage-io.js` + `.d.ts`

**Files:**
- Create: `tools/editor/stage-io.js`
- Create: `tools/editor/stage-io.d.ts`

- [ ] **Step 1: `TERRAINS` 표를 HTML에서 옮겨 온다**

`tools/stage-editor.html` 244~260행의 `const TERRAINS = [ ... ];` 블록을 **그대로** 복사(값 변경 금지)해 아래 모듈의 `export const TERRAINS = [...]` 자리에 넣는다. (HTML 쪽 삭제는 Task 4.)

- [ ] **Step 2: 모듈 작성**

```js
// tools/editor/stage-io.js — 스테이지/맵 에디터 I/O 코어 (DOM 무관, 브라우저 <script type="module"> · vitest 전용)
// 규칙의 근거: docs/superpowers/specs/2026-09-11-editor-roundtrip-design.md §4
//  - 로드: 소유 키만 모델로 (중첩 객체는 얕은 복사), 원본은 ORIG(WeakMap)에 보관. 기본값 주입 금지.
//  - 저장: { ...원본, ...소유키 } — 미지 키·미지 필드는 손대지 않고 통과. 키 순서 = 원본 순서.
//  - null/undefined 소유 값 → 키 삭제(중첩 1단계 포함). 빈 배열은 원본에 있었을 때만(최상위), 필수 배열은 항상.

export const TERRAINS = [
  /* ← stage-editor.html 244~260행 블록의 배열 원소를 그대로 붙여 넣는다 */
];

const ORIG = new WeakMap();
const own = (model, orig) => { if (orig && typeof orig === "object") ORIG.set(model, orig); return model; };
const isObj = (v) => v !== null && typeof v === "object" && !Array.isArray(v);

/** 소유 키만 얕게 복사한 모델. 중첩 객체(trigger/outcome/camera/reward)는 { ...v } 로 복사해 UI가 필드를 바꿔도 원본이 오염되지 않게. */
function pickShallow(src, keys) {
  const m = {};
  for (const k of keys) {
    if (src[k] === undefined) continue;
    m[k] = isObj(src[k]) ? { ...src[k] } : src[k];
  }
  return m;
}

/** 중첩 소유 객체의 1단계 null/undefined 필드 제거 (UI가 만드는 camera.focus=null 대응, spec §4-5) */
function stripNulls(o) {
  const out = {};
  for (const [k, v] of Object.entries(o)) if (v !== null && v !== undefined) out[k] = v;
  return out;
}

const KEYS = {
  stage: ["id", "name", "mapId", "turnLimit", "camera", "reward", "levelCap", "units", "objectives", "failConditions", "reinforcements", "strategyConditions", "victory", "defeat", "events"],
  unit: ["commanderId", "classId", "level", "troops", "items", "side", "x", "y"],
  event: ["id", "type", "trigger", "outcome", "once"],
  reinf: ["id", "side", "trigger", "units", "once"],
  strat: ["id", "description", "trigger", "reward"],
};
// 스키마 필수(또는 파일 관행) 배열 — 원본 유무와 무관하게 항상 기록 (spec §4-5)
const ALWAYS = { stage: new Set(["units", "events"]), reinf: new Set(["units"]), unit: new Set(["items"]) };

/**
 * 원본 위에 소유 키를 덮어쓴다.
 * @param model  ORIG 가 붙은(또는 새) 모델 객체
 * @param keys   소유 키(순서 = 새 객체의 키 순서)
 * @param always 항상 기록할 배열 키
 * @param sub    배열 원소 직렬화기 { key: fn }
 */
function merge(model, keys, always, sub = {}) {
  const orig = ORIG.get(model) ?? {};
  const out = { ...orig };
  for (const k of keys) {
    let v = model[k];
    if (v === null || v === undefined) { delete out[k]; continue; }
    if (Array.isArray(v)) {
      if (v.length === 0 && !(k in orig) && !always.has(k)) continue;
      v = sub[k] ? v.map(sub[k]) : v;
    } else if (isObj(v)) {
      v = stripNulls(v);
    }
    out[k] = v;
  }
  for (const k of always) if (out[k] === undefined) out[k] = [];
  return out;
}

const loadUnit = (u) => own({ ...pickShallow(u, KEYS.unit), items: u.items ?? [] }, u);
const serializeUnit = (u) => merge(u, KEYS.unit, ALWAYS.unit);
const serializeEvent = (e) => merge(e, KEYS.event, new Set());
const serializeReinf = (r) => merge(r, KEYS.reinf, ALWAYS.reinf, { units: serializeUnit });
const serializeStrat = (s) => merge(s, KEYS.strat, new Set());

/** 스테이지 JSON → 편집 모델. 미지 키는 모델에 없고 ORIG 에만 있다. */
export function loadStage(obj) {
  const m = pickShallow(obj, KEYS.stage);
  m.units = (obj.units ?? []).map(loadUnit);
  m.events = (obj.events ?? []).map((e) => own(pickShallow(e, KEYS.event), e));
  m.reinforcements = (obj.reinforcements ?? []).map((r) => own({ ...pickShallow(r, KEYS.reinf), units: (r.units ?? []).map(loadUnit) }, r));
  m.strategyConditions = (obj.strategyConditions ?? []).map((s) => own(pickShallow(s, KEYS.strat), s));
  m.objectives = (obj.objectives ?? []).map((o) => ({ ...o }));       // 그대로 통과(kind 별 재조립 금지)
  m.failConditions = (obj.failConditions ?? []).map((f) => ({ ...f }));
  return own(m, obj);
}

/** 편집 모델 → 스테이지 JSON 객체 (문자열화는 호출측: JSON.stringify(x, null, 2) + "\n") */
export function serializeStage(model) {
  return merge(model, KEYS.stage, ALWAYS.stage, {
    units: serializeUnit, events: serializeEvent, reinforcements: serializeReinf, strategyConditions: serializeStrat,
  });
}

/** Undo 스냅샷용 깊은 복제 + ORIG 재부착 (UI 의 pushUndo 가 JSON 복제 대신 이것을 쓴다) */
export function cloneUnits(units) {
  return units.map((u) => own(JSON.parse(JSON.stringify(u)), ORIG.get(u)));
}

/** 맵 JSON → { id, name, width, height, tileLegend, tiles: string[][] }. 맵은 ORIG 를 쓰지 않는다(spec §4-1). */
export function loadMap(m) {
  const W = m.width, H = m.height;
  const tiles = (m.tiles ?? []).map((row) => { const a = String(row).split(""); while (a.length < W) a.push("."); return a.slice(0, W); });
  while (tiles.length < H) tiles.push(Array(W).fill("."));
  return { id: m.id, name: m.name, width: W, height: H, tileLegend: isObj(m.tileLegend) ? { ...m.tileLegend } : null, tiles };
}

/** 맵 모델 → 맵 JSON 객체. 로드한 legend(키 순서·미사용 키)를 기반으로, 새로 쓰인 char 만 TERRAINS 에서 보충. */
export function serializeMap({ id, name, width, height, tileLegend, tiles }) {
  const used = new Set(); tiles.forEach((r) => r.forEach((ch) => used.add(ch)));
  let legend;
  if (tileLegend) {
    legend = { ...tileLegend };
    TERRAINS.forEach(([ch, tid]) => { if (used.has(ch) && !(ch in legend)) legend[ch] = tid; });
  } else {
    legend = {}; TERRAINS.forEach(([ch, tid]) => { if (used.has(ch)) legend[ch] = tid; });
  }
  return { id, name, width, height, tileLegend: legend, tiles: tiles.map((r) => r.join("")) };
}
```

- [ ] **Step 3: 선언 파일**

```ts
// tools/editor/stage-io.d.ts — stage-io.js 의 TS 선언 (vitest/typecheck 용)
export type Json = Record<string, unknown>;
export interface MapModel { id: string; name: string; width: number; height: number; tileLegend: Record<string, string> | null; tiles: string[][] }
export const TERRAINS: ReadonlyArray<readonly [string, string, readonly [number, number, number]]>;
export function loadStage(obj: Json): Json;
export function serializeStage(model: Json): Json;
export function cloneUnits(units: Json[]): Json[];
export function loadMap(obj: Json): MapModel;
export function serializeMap(model: MapModel): Json;
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `pnpm --filter @tk/data test -- editor-roundtrip`
Expected: PASS — `stages/*.json` 27+ · `maps/*.json` 30+ · 의미론 9 케이스 전부 green. 실패하면 **모듈을 고친다**(테스트나 데이터를 고치지 않는다 — 데이터 불일치는 spec §8의 별도 태스크).

- [ ] **Step 5: 전체 게이트**

Run: `pnpm --filter @tk/data test && pnpm --filter @tk/data typecheck`
Expected: 기존 테스트 전부 PASS, typecheck Done (`.d.ts` 사이드카가 해석됨 — TS6307/TS7016 없음).

- [ ] **Step 6: 커밋**

```bash
git add tools/editor/stage-io.js tools/editor/stage-io.d.ts packages/data/test/editor-roundtrip.test.ts
git commit -m "feat(editor): stage-io module with original-preserving load/save + round-trip gate (27 stages, 30 maps)

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

## Chunk 2: 에디터 배선 + Publish 검사

### Task 3: serve.py `POST /validate-data`

**Files:**
- Modify: `tools/serve.py:12` (import), `:287-291` (do_POST 허용 목록·분기), 모듈 레벨 헬퍼 추가

- [ ] **Step 1: import 확장** — 12행 `import sys, os, json, base64, mimetypes, subprocess, re` → `import sys, os, json, base64, mimetypes, subprocess, re, shutil, threading`

- [ ] **Step 2: 헬퍼 추가** (`do_POST` 가 속한 클래스 정의 **위**, 모듈 레벨)

```python
_VALIDATE_LOCK = threading.Lock()  # ThreadingHTTPServer 는 동시 요청 가능 — Publish 검사는 1개만


def _validate_data():
    """Publish 검사 = 레포의 packages/data/json/* 을 @tk/data 테스트(zod safeParse 전수)로 검증.
    index.ts 의 loadJson 은 첫 실패 파일에서 throw 하므로 에러는 한 번에 1건이다."""
    pnpm = shutil.which("pnpm")
    if not pnpm:
        return {"ok": False, "error": "pnpm 미발견 — PATH 확인"}
    env = {**os.environ, "CI": "1", "NO_COLOR": "1"}  # ANSI 제거
    try:
        p = subprocess.run([pnpm, "--filter", "@tk/data", "test"], cwd=ROOT, shell=False,
                           capture_output=True, text=True, errors="replace", env=env, timeout=120)
    except subprocess.TimeoutExpired:
        return {"ok": False, "error": "timeout(120s)"}
    tail = "\n".join(((p.stdout or "") + "\n" + (p.stderr or "")).strip().splitlines()[-60:])
    return {"ok": p.returncode == 0, "code": p.returncode, "output": tail}
```

- [ ] **Step 3: 라우팅** — `do_POST` 허용 튜플에 `"/validate-data"` 추가하고, `/rebuild-audio-manifest` 분기 **바로 아래**(payload 파싱 전)에:

```python
        if endpoint == "/validate-data":
            if not _VALIDATE_LOCK.acquire(blocking=False):
                self._json(409, {"ok": False, "error": "Publish 검사가 이미 진행 중"})
                return
            try:
                self._json(200, _validate_data())
            finally:
                _VALIDATE_LOCK.release()
            return
```

- [ ] **Step 4: 수동 확인** — `python tools/serve.py 8081` 띄우고 다른 터미널에서:

Run: `curl -s -X POST http://localhost:8081/validate-data`
Expected: `{"ok": true, "code": 0, "output": "... Test Files  N passed ..."}` (약 5~15초). 두 번 동시에 보내면 하나는 409.

- [ ] **Step 5: 커밋**

```bash
git add tools/serve.py
git commit -m "feat(serve): POST /validate-data runs @tk/data tests as the editor's Publish check

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

### Task 4: `stage-editor.html` 배선

**Files:**
- Modify: `tools/stage-editor.html` — 236행 `<script>`, 244~260 `TERRAINS`, 440~443 `pushUndo`, 1075~1088 `refreshValidation`, 1094~1136 `serializeStage`, 1137~1150 `serializeMap`, 1153~1185 `loadStageObject`/`loadMapObject`, 1198~1216 `saveStageFile`/`saveMapFile`, 1300 `setMapOnlyMode`, 160행 툴바

- [ ] **Step 1: 모듈 스크립트 + 로드 실패 안내**

236행 `<script>` 를 다음으로 교체(모듈은 자동 strict — 237행 `'use strict';` 는 삭제):

```html
<div id="modfail" style="background:#5a1e1e;color:#ffd7d7;padding:8px 12px;font-size:13px">
  에디터 모듈을 불러오지 못했습니다 — <code>file://</code> 로 열면 동작하지 않습니다. serve.py로 여세요 (launch <code>tools</code> = :8081, 기본 :8080).
</div>
<script type="module">
import {
  TERRAINS,
  loadStage as loadStageModel, serializeStage as serializeStageModel, cloneUnits,
  loadMap as loadMapModel, serializeMap as serializeMapModel,
} from './editor/stage-io.js';
document.getElementById('modfail').remove();
```

(alias 를 쓰는 이유: HTML 에 이미 `serializeStage()`/`serializeMap()` 이라는 문자열 반환 래퍼가 있고, 그 이름을 호출하는 곳이 여럿이라 이름을 유지한다.)

- [ ] **Step 2: 인라인 `TERRAINS` 삭제** — 244~260행 `const TERRAINS = [ ... ];` 블록 제거. 바로 아래 `const LEGEND = Object.fromEntries(TERRAINS.map(...))` 는 그대로(import 된 상수를 쓴다).

- [ ] **Step 3: Undo 스냅샷** — `pushUndo` 의 `units: JSON.parse(JSON.stringify(stage.units))` → `units: cloneUnits(stage.units)`. (`doUndo` 는 그대로.)

- [ ] **Step 4: I/O 함수를 래퍼로 교체**

`serializeStage()` (1094~1136) 본문 전체를:
```js
function serializeStage() { return JSON.stringify(serializeStageModel(stage), null, 2) + '\n'; }
```

`serializeMap()` (1137~1150) 본문을:
```js
function serializeMap() {
  return JSON.stringify(serializeMapModel({ id: mapId, name: mapName, width: W, height: H, tileLegend: loadedLegend, tiles }), null, 2) + '\n';
}
```

`loadStageObject(obj)` (1153~1173) 의 `stage = { ... };` 리터럴 전체를 `stage = loadStageModel(obj);` 한 줄로 (앞의 타입 가드와 뒤의 `selUnit = null; undoStack.length = 0; renderAll(); …` 은 유지).

`loadMapObject(m)` (1176~1185) 의 `W = …; H = …; mapId = …; mapName = …; loadedLegend = …; tiles = …; while (…) …` 부분을:
```js
  const mm = loadMapModel(m);
  W = mm.width; H = mm.height; mapId = mm.id || 'map'; mapName = mm.name || mapId; loadedLegend = mm.tileLegend; tiles = mm.tiles;
```
(`|| 'map'` 은 표시용 — 실데이터 30개 맵은 id/name 을 모두 가져 round-trip 에 영향 없음.)

- [ ] **Step 5: 저장 차단 제거 3지점 + 배너 문구**

`refreshValidation()` 을:
```js
function refreshValidation() {
  const errs = validate();
  const b = document.getElementById('valbanner');
  if (errs.length) {
    b.className = 'on';
    b.innerHTML = `⚠ 테스트 불가 ${errs.length}건 (저장은 가능):<br>` + errs.slice(0, 8).map(esc).join('<br>') + (errs.length > 8 ? '<br>…' : '');
  } else {
    b.className = 'on ok';
    b.innerHTML = '✓ 테스트 가능 — Publish 검사는 레포에 저장 후 「Publish 검사」';
  }
  return errs.length === 0;
}
```
(`saveStage.disabled` / `saveMap.disabled` 두 줄 삭제.)

`saveStageFile()` 첫 줄 `if (!refreshValidation()) { toast('오류가 있어 저장 차단됨', true); return; }` 삭제, 성공 토스트를
```js
    const n = validate().length;
    toast(`stage 저장 → ${stageHandle.name}` + (n ? ` · 테스트 불가 ${n}건` : ''));
```
로. `saveMapFile()` 도 첫 줄 가드 삭제.

`setMapOnlyMode` 1300행 `document.getElementById('saveStage').disabled = on || validate().length > 0;` → `document.getElementById('saveStage').disabled = on;`

- [ ] **Step 6: 「Publish 검사」 버튼 + 패널**

160행 `id="saveMap"` 버튼 바로 뒤에:
```html
<button class="btn" id="publishCheck" title="레포에 저장된 packages/data/json/* 을 zod 로 전수 검사 (pnpm --filter @tk/data test)">Publish 검사</button>
```
`id="valbanner"` 요소 바로 뒤에:
```html
<pre id="publishOut" style="display:none;max-height:220px;overflow:auto;font-size:12px;background:#111;color:#ddd;padding:8px;margin:6px 0"></pre>
```
스크립트 끝(초기화 코드 앞)에:
```js
document.getElementById('publishCheck').onclick = async () => {
  const out = document.getElementById('publishOut');
  out.style.display = ''; out.textContent = 'Publish 검사 중… (pnpm --filter @tk/data test, 5~15초)';
  try {
    const r = await fetch('/validate-data', { method: 'POST' });
    const j = await r.json();
    out.textContent = (j.ok ? '✓ Publish 검사 통과\n' : `✗ Publish 검사 실패${j.error ? ' — ' + j.error : ''} (첫 실패 파일만 표시됨)\n`) + (j.output || '');
  } catch (e) { out.textContent = '검사 요청 실패: ' + e.message + ' — serve.py로 여세요 (launch tools = :8081, 기본 :8080)'; }
};
```

- [ ] **Step 7: 브라우저 검증 (serve.py :8081)**

1. `http://localhost:8081/tools/stage-editor.html` 열기 → 빨간 `modfail` 배너가 **없어야** 함(모듈 로드 성공). 콘솔 에러 0.
2. 스테이지 드롭다운에서 `02-yingchuan` 선택.
3. 아무것도 수정하지 않고 「stage 저장」(붙여넣기 내보내기 또는 파일 저장) → 결과를 원본과 비교:
   `python -c "import json,sys;a=json.load(open(sys.argv[1],encoding='utf-8'));b=json.load(open(sys.argv[2],encoding='utf-8'));print('SAME' if json.dumps(a,ensure_ascii=False)==json.dumps(b,ensure_ascii=False) else 'DIFF')" <저장본> packages/data/json/stages/02-yingchuan.json` → `SAME` (camera 안의 decorations 까지 보존).
4. 유닛 하나를 한 칸 옮기고 Ctrl+Z(Undo) 후 저장 → 다시 `SAME`.
5. 검증 에러가 있는 상태(예: 유닛 좌표를 맵 밖으로 편집)에서도 저장 버튼이 활성이고 저장되며 토스트에 "테스트 불가 N건".
6. 「Publish 검사」 클릭 → 패널에 `✓ Publish 검사 통과` + vitest 요약.

- [ ] **Step 8: 커밋**

```bash
git add tools/stage-editor.html
git commit -m "feat(editor): stage-editor uses stage-io (lossless save), save always allowed, Playtest/Publish tiers

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

### Task 5: 문서 한 줄 + 전체 게이트

**Files:**
- Modify: `tools/CLAUDE.md` 「도구 지도」 에디터 항목

- [ ] **Step 1:** `tools/CLAUDE.md` 의 `- **에디터**(정적 HTML, JSON 직접 편집): …` 줄 끝에 추가:
` stage-editor 는 `tools/editor/stage-io.js`(원본 보존 저장 — 미지 필드 무손실, 게이트 `packages/data/test/editor-roundtrip.test.ts`)를 쓰고, 저장은 항상 허용·검증은 Save/Playtest(로컬)/Publish(`POST /validate-data` = @tk/data 테스트) 3단.`

- [ ] **Step 2:** `pnpm test && pnpm typecheck` → 전부 green.

- [ ] **Step 3: 커밋**

```bash
git add tools/CLAUDE.md
git commit -m "docs(tools): note stage-io lossless save and 3-tier validation

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```
