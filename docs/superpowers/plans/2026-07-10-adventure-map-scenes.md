# 어드벤처 맵 씬 (막간 v4) Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 마퀴 막간 씬을 "걸어 다니는 SD 유닛 + 소형 타일 맵 + 말풍선 + 두루마리 선택지"의 어드벤처 맵 씬으로 격상하고, v3 근경 무대를 전면 삭제한다.

**Architecture:** `scenario.{intro,outro}`가 씬 파트 배열(VN | MapScene)로 확장된다(기존 단일 VN = 1파트 정규화, 27씬 무변경). 맵 파트는 순수 인터프리터(`sceneUnitStates` — 줄 단위 액션 누적)가 상태를 계산하고, `SceneStage`(Pixi — 전투 렌더러 불변, painted 배경·UnitView·데코 레이어만 재사용)가 그리며, `MapScenePlayer`(셸)가 기존 대사창 조각을 재사용한다. 씬 맵은 직교 격자 + 3/4 painted.

**Tech Stack:** Next.js/React + PixiJS (apps/web), Zod (packages/data), Vitest, 에셋보드+serve.py 파이프라인.

**Spec:** docs/superpowers/specs/2026-07-10-adventure-map-scenes-design.md (**필독** — 계약·삭제 목록·길중 지시사항)

---

## 실행 전 준비 (코디네이터가 이미 수행했는지 확인)

- **작업 트리 정리**: main에 미커밋 변경(플립북 코드·보드 SA 프롬프트 변경·serve.py 분할기 + **유지할 인프라 수정**(serve.py 포트 인자, launch.json tools 8081, 보드 SAVE_ENDPOINT 동오리진화))이 섞여 있다.
  ```bash
  git add -A && git commit -m "chore: pending flipbook work + infra fixes before v4 pivot (flipbook superseded by v4)"
  ```
  플립북류는 Chunk 1이 삭제한다 — 커밋해두면 삭제가 깨끗한 diff로 남는다.
- **브랜치**: `git switch -c feat/adventure-map-scenes` (main에서).
- 테스트 러너 = **vitest**: `pnpm --filter @tk/data test`, `pnpm --filter @tk/web test`.
  ⚠ web 테스트는 `src/**/__tests__/**/*.test.ts`만 수집(다른 위치·`.tsx`는 조용히 스킵). `test <문자열>` = 파일경로 부분일치.
- **테스트 정책**: TDD 대상 = zod 스키마 + 순수 인터프리터. React/Pixi(SceneStage·MapScenePlayer) = `pnpm --filter @tk/web typecheck` + 수동 + 길중 눈(프리뷰는 hidden rAF 정지라 Pixi 라이브 불가 — DOM 대사창·선택지만 프리뷰 확인 가능).
- 커밋 = 리포 관례(Co-Authored-By — 최근 커밋 참조).

## File Structure

| 파일 | 책임 | 처분 |
|---|---|---|
| `packages/data/src/schemas.ts` | SceneSlot/MapScene/SceneUnit/MapSceneLine/ReactLine + v3 필드 삭제 + DECORATION_KINDS 실내 확장 | 변경 |
| `packages/data/src/index.ts` | 씬 맵 레지스트리 등록 | 변경 |
| `packages/data/test/schemas.test.ts` | 스키마 계약 테스트(v3 테스트 삭제 포함) | 변경 |
| `packages/data/json/maps/scene-01-{street,tavern,orchard}.json` | 씬 맵 3장 | 신규 |
| `packages/data/json/stages/01-zhuojun.json` | v4 파트 배열 재저작 | 변경 |
| `apps/web/src/scene/map/interpreter.ts` | 순수 인터프리터(상태 누적·경로·보정) | 신규 |
| `apps/web/src/scene/map/__tests__/interpreter.test.ts` | 인터프리터 테스트 (⚠ 위치: `src/scene/map/__tests__/`는 vitest include에 걸림) | 신규 |
| `apps/web/src/scene/map/SceneStage.ts` | Pixi 조립(맵·유닛·액션 실행·말풍선) | 신규 |
| `apps/web/src/scene/MapScenePlayer.tsx` | 셸(캔버스+대사창+선택지+스킵) | 신규 |
| `apps/web/app/scene/page.tsx` | 슬롯 정규화 + 파트 순차 재생 | 변경 |
| `apps/web/src/scene/{StagedScenePlayer.tsx, parts/ActorStage.tsx, actorStage.ts, __tests__/actorStage.test.ts}` | v3 | **삭제** |
| `apps/web/src/pixi/layers/UnitView.ts` | 씬 모드(바 숨김)·커스텀 포즈 | 변경 |
| `apps/web/src/pixi/textures.ts` | 실내 데코 OBJECT_FILES | 변경 |
| `tools/serve.py` | `_split_actor_frames` 삭제·도보 시트 컷 포즈 인자 | 변경 |
| `tools/sprite-pipeline/rebuild_manifest.py` | POSE_ORDER에 kneel 등 확장 | 변경 |
| `docs/art/asset-board.html` | SA 대형 배우·staged 11카드·플립북 프롬프트 삭제 → 도보 시트 카드(8명) | 변경 |
| `docs/art/map-chunk-board.html` | 씬 맵 청크 프롬프트 변형(`promptFor` scene- 분기) | 변경 |

---

## Chunk 1: v3 전면 삭제 (동작 보존 아님 — 계획된 제거)

### Task 1: v3 코드·스키마·데이터·에셋 제거

**Files:**
- Modify: `apps/web/app/scene/page.tsx` (분기 ~49행 — StagedScenePlayer import·분기 제거, ScenePlayer 단일 복귀)
- Delete: `apps/web/src/scene/StagedScenePlayer.tsx`, `apps/web/src/scene/parts/ActorStage.tsx`, `apps/web/src/scene/actorStage.ts`, `apps/web/src/scene/__tests__/actorStage.test.ts`
- Modify: `packages/data/src/schemas.ts` — `StageActorSchema`·`ScenarioSceneSchema.actors`·`ScenarioLineSchema.{actor,enter,exit,emote}` 제거 (`line.bg`는 v2 문법 — **유지**)
- Modify: `packages/data/test/schemas.test.ts` — "staged scene actors" describe 삭제
- Modify: `packages/data/json/stages/01-zhuojun.json` — `scenario.intro`에서 `actors` 블록과 line의 `actor/enter/emote/bg("01-zhuojun-staged")` 필드 제거(텍스트 불변 — 순수 VN 8줄로 복귀. v4 재저작은 Chunk 6)
- Modify: `tools/serve.py` — `_split_actor_frames` 함수 + do_POST의 ⑥ frames 훅 제거 (⚠ 포트 인자 처리는 유지)
- Modify: `docs/art/asset-board.html` — SA 섹션(SCENE_ACTORS/ACTOR_STYLE/ACTOR_NEGATIVE IIFE), TAB_DEFS `actor` 탭, buildPrompt `sceneActorCard` 분기, cardGamePaths sceneActorCard 줄, addImageToCard의 sceneActorCard 이름·저장 분기(frames 플래그 포함), 씬 섹션의 `STAGED_PLACES` staged 11카드 블록 + 섹션 desc의 staged 문구 제거

- [ ] **Step 1**: 위 삭제/수정 수행. 각 지점은 grep으로 재확인: `grep -n "sceneActorCard\|STAGED_PLACES\|StageActor\|actorStage\|_split_actor_frames" -r apps packages tools docs/art`— 잔존 0이어야 함.
- [ ] **Step 2**: 에셋 제거 — 로컬 `apps/web/public/assets/scene-actors/`(3 png)·`apps/web/public/assets/scenes/01-zhuojun-staged.webp` 삭제 + R2 삭제:
  ```bash
  python -c "
  import sys; sys.path.insert(0,'tools'); import serve
  for k in ['assets/scene-actors/liubei.png','assets/scene-actors/guanyu.png','assets/scene-actors/zhangfei.png','assets/scenes/01-zhuojun-staged.webp']:
      print(k, serve._r2_delete(k))"
  ```
- [ ] **Step 3**: 검증 — `pnpm --filter @tk/data test` PASS(스키마 v3 테스트 삭제 후), `pnpm --filter @tk/web test` PASS(actorStage 테스트 삭제 후), `pnpm --filter @tk/web typecheck` OK, `node --check` on board script, `python -c "import ast; ast.parse(open('tools/serve.py',encoding='utf-8').read())"`.
- [ ] **Step 4**: 수동 스모크 — `/scene?stage=01-zhuojun&type=intro`가 순수 VN으로 재생(배우 없음), 02 VN 회귀 없음.
- [ ] **Step 5**: 커밋
```bash
git add -A
git commit -m "refactor(scene)!: remove v3 staged-stage (superseded by v4 adventure map scenes)"
```

---

## Chunk 2: 스키마 v4 (TDD)

### Task 2: SceneSlot 파트 배열 + MapScene 계약

**Files:**
- Modify: `packages/data/src/schemas.ts` (ScenarioSceneSchema 부근 — Chunk 1 후 행번호 변동, 내용으로 위치)
- Test: `packages/data/test/schemas.test.ts`

- [ ] **Step 1: 실패 테스트 작성** — 기존 import 재사용(신규 import는 스키마 심볼만 추가):

```ts
describe("scene slot v4 (parts array)", () => {
  const vn = { bg: "x", lines: [{ text: "a" }] };
  const mapPart = {
    map: "scene-01-street",
    label: "탁군 · 거리",
    units: [
      { id: "liubei", sprite: "liubei-foot", cell: [3, 5] },
      { id: "zhangfei", sprite: "zhangfei-foot", cell: [10, 5], facing: "left", hidden: true },
    ],
    lines: [
      { move: [{ id: "liubei", to: [5, 5] }], text: "무슨 소란이지?", speaker: "유비", portraitId: "유비",
        bubble: { id: "liubei", mark: "..." } },
      { enter: [{ id: "zhangfei", from: [14, 5], to: [6, 5] }] },
      { speaker: "장비", text: "같이 하겠소?", choice: { prompt: "대답은?",
        options: [{ label: "함께 갑시다", react: [{ speaker: "장비", text: "좋소!" }] }, { label: "글쎄..." }] } },
    ],
  };
  it("단일 VN 객체(기존 27씬)와 파트 배열 둘 다 유효하다", () => {
    expect(() => SceneSlotSchema.parse(vn)).not.toThrow();
    expect(() => SceneSlotSchema.parse([vn, mapPart])).not.toThrow();
  });
  it("MapScene이 VN으로 오파싱되지 않는다(map/units 보존)", () => {
    const arr = SceneSlotSchema.parse([mapPart]);
    expect((arr as any)[0].map).toBe("scene-01-street");
    expect((arr as any)[0].units).toHaveLength(2);
  });
  it("react 줄에 액션 필드는 거부된다", () => {
    const bad = { ...mapPart, lines: [{ text: "q", choice: { options: [
      { label: "a", react: [{ text: "r", move: [{ id: "liubei", to: [1, 1] }] }] }, { label: "b" }] } }] };
    expect(() => SceneSlotSchema.parse([bad])).toThrow();
  });
  it("v3 필드는 더 이상 스키마에 없다", () => {
    const parsed = ScenarioSceneSchema.parse({ bg: "x", actors: [{ id: "a", sprite: "a", x: 1 }], lines: [{ text: "a", emote: "!" }] });
    expect((parsed as any).actors).toBeUndefined();       // strip 확인
    expect((parsed as any).lines[0].emote).toBeUndefined();
  });
  it("decorations를 씬 소품으로 받는다", () => {
    expect(() => SceneSlotSchema.parse([{ ...mapPart, decorations: [{ cell: [2, 2], kind: "table" }] }])).not.toThrow();
  });
});
```

- [ ] **Step 2: 실패 확인** — `pnpm --filter @tk/data test schemas` → FAIL (SceneSlotSchema 미존재)
- [ ] **Step 3: 구현** — schemas.ts에 추가(기존 `DecorationSchema`·`SideSchema` 재사용):

```ts
/** 막간 v4 — 어드벤처 맵 씬(스펙 2026-07-10). 씬 슬롯 = 단일 VN(하위호환) 또는 파트 배열. */
const SceneCellSchema = z.tuple([z.number().int().min(0), z.number().int().min(0)]);
export const SceneUnitSchema = z.object({
  id: z.string(),                                   // 씬 내 안정 참조
  sprite: z.string(),                               // 스프라이트 폴더 키 직접 저작("liubei-foot")
  cell: SceneCellSchema,
  facing: z.enum(["left", "right"]).optional(),     // 기본 left
  hidden: z.boolean().optional(),                   // true = enter로 걸어 들어오기 전
});
const SceneBubbleSchema = z.object({ id: z.string(), mark: z.enum(["...", "!", "?"]) });
/** choice.react 전용 — 대사·말풍선만(액션 금지 = strict, 스펙 리뷰 #1). */
const ReactLineSchema = z.object({
  speaker: z.string().optional(),
  portraitId: z.string().optional(),
  side: SideSchema.optional(),
  text: z.string().optional(),
  bubble: SceneBubbleSchema.optional(),
}).strict();
export const MapSceneLineSchema = z.object({
  // 액션(대사 전 순차 실행 — 정렬: exit→move/face→enter→pose)
  move: z.array(z.object({ id: z.string(), to: SceneCellSchema })).optional(),
  face: z.array(z.object({ id: z.string(), dir: z.enum(["left", "right"]) })).optional(),
  enter: z.array(z.object({ id: z.string(), from: SceneCellSchema, to: SceneCellSchema })).optional(),
  exit: z.array(z.object({ id: z.string(), to: SceneCellSchema })).optional(),
  pose: z.array(z.object({ id: z.string(), pose: z.string() })).optional(),
  // 대사(액션 후 표시. text 없으면 액션 비트 = 자동 진행)
  speaker: z.string().optional(),
  portraitId: z.string().optional(),
  side: SideSchema.optional(),
  text: z.string().optional(),
  bubble: SceneBubbleSchema.optional(),
  // 두루마리 선택지(분기 없음 — react 재생 후 다음 줄 합류)
  choice: z.object({
    prompt: z.string().optional(),
    options: z.array(z.object({ label: z.string(), react: z.array(ReactLineSchema).optional() })).min(2),
  }).optional(),
});
export const MapSceneSchema = z.object({
  map: z.string(),
  label: z.string().optional(),
  units: z.array(SceneUnitSchema).min(1),
  decorations: z.array(DecorationSchema).optional(),
  lines: z.array(MapSceneLineSchema).min(1),
});
export type MapScene = z.infer<typeof MapSceneSchema>;
export type SceneUnit = z.infer<typeof SceneUnitSchema>;
export type MapSceneLine = z.infer<typeof MapSceneLineSchema>;
/** ⚠ MapScene을 union 앞에 — 뒤에 두면 비-strict ScenarioScene이 map/units를 벗겨먹는다(오파싱). */
export const ScenePartSchema = z.union([MapSceneSchema, ScenarioSceneSchema]);
export type ScenePart = z.infer<typeof ScenePartSchema>;
export const SceneSlotSchema = z.union([z.array(ScenePartSchema), ScenarioSceneSchema]);
export type SceneSlot = z.infer<typeof SceneSlotSchema>;
```
⚠ **`StageSchema.scenario` 필드 스왑은 여기서 하지 않는다**(리뷰 #5 — 스왑 즉시 page.tsx·sim이 타입 깨져
Chunk 4의 typecheck 게이트와 모순). 이 Task는 **스키마·타입 신설 + SceneSlotSchema 직접 파싱 테스트**까지만.
필드 스왑은 Task 6(소비자 배선과 같은 커밋)에서.
`DECORATION_KINDS`(schemas.ts — z.enum 화이트리스트)에 실내 kind 추가: `"table", "carpet", "screen", "counter", "stool"`.
헬퍼(같은 파일 or index): `export const normalizeSceneSlot = (s: SceneSlot): ScenePart[] => Array.isArray(s) ? s : [s];`

- [ ] **Step 4: 통과 확인** — `pnpm --filter @tk/data test` 전체 PASS (기존 27스테이지 로드 테스트가 단일 VN 하위호환을 실증).
- [ ] **Step 5: 커밋** — `git add packages/data && git commit -m "feat(data): scene slot v4 - part arrays with MapScene contract"`

---

## Chunk 3: 순수 인터프리터 (TDD)

### Task 3: sceneUnitStates + 경로/보정

**Files:**
- Create: `apps/web/src/scene/map/interpreter.ts`
- Test: `apps/web/src/scene/map/__tests__/interpreter.test.ts`

- [ ] **Step 1: 실패 테스트 작성**:

```ts
import { describe, it, expect } from "vitest";
import { sceneUnitStates, findScenePath, nearestWalkable } from "../interpreter";
import type { MapScene } from "@tk/data";

// 5×5 전부 통행, (2,2)만 벽인 격자 스텁
const walkable = (c: readonly [number, number]) =>
  c[0] >= 0 && c[0] < 5 && c[1] >= 0 && c[1] < 5 && !(c[0] === 2 && c[1] === 2);

const scene: MapScene = {
  map: "m", units: [
    { id: "a", sprite: "s", cell: [0, 0] },
    { id: "b", sprite: "s", cell: [4, 4], hidden: true },
  ],
  lines: [
    { text: "0" },
    { move: [{ id: "a", to: [3, 0] }], face: [{ id: "a", dir: "right" }], text: "1" },
    { enter: [{ id: "b", from: [4, 0], to: [4, 1] }], text: "2" },
    { pose: [{ id: "a", pose: "kneel" }], text: "3" },
    { exit: [{ id: "b", to: [4, 0] }], text: "4" },
    { move: [{ id: "x", to: [1, 1] }], text: "5 (미매칭 no-op)" },
  ],
};

describe("sceneUnitStates", () => {
  it("초기: hidden 반영, 기본 facing left·pose idle", () => {
    const s = sceneUnitStates(scene, 0, walkable);
    expect(s.get("a")).toEqual({ cell: [0, 0], facing: "left", pose: "idle", hidden: false });
    expect(s.get("b")!.hidden).toBe(true);
  });
  it("move·face 누적", () => {
    const s = sceneUnitStates(scene, 1, walkable);
    expect(s.get("a")).toMatchObject({ cell: [3, 0], facing: "right" });
  });
  it("enter는 hidden 해제 + 목적지", () => {
    expect(sceneUnitStates(scene, 2, walkable).get("b")).toMatchObject({ cell: [4, 1], hidden: false });
  });
  it("pose 전환·exit 재숨김", () => {
    expect(sceneUnitStates(scene, 3, walkable).get("a")!.pose).toBe("kneel");
    expect(sceneUnitStates(scene, 4, walkable).get("b")!.hidden).toBe(true);
  });
  it("id 미매칭 = no-op(크래시 없음)", () => {
    expect(() => sceneUnitStates(scene, 5, walkable)).not.toThrow();
  });
  it("통행 불가 목적지는 인접 통행 칸으로 보정", () => {
    const s2: MapScene = { ...scene, lines: [{ move: [{ id: "a", to: [2, 2] }] }] };
    const cell = sceneUnitStates(s2, 0, walkable).get("a")!.cell;
    expect(walkable(cell)).toBe(true);
    expect(Math.abs(cell[0] - 2) + Math.abs(cell[1] - 2)).toBe(1);
  });
});

describe("findScenePath", () => {
  it("벽(2,2)을 우회하는 BFS 경로", () => {
    const p = findScenePath(walkable, [0, 2], [4, 2]);
    expect(p[0]).toEqual([0, 2]);
    expect(p[p.length - 1]).toEqual([4, 2]);
    expect(p.some(c => c[0] === 2 && c[1] === 2)).toBe(false);
  });
  it("도달 불가면 출발지만 반환(무붕괴)", () => {
    const boxed = (c: readonly [number, number]) => c[0] === 0 && c[1] === 0;
    expect(findScenePath(boxed, [0, 0], [3, 3])).toEqual([[0, 0]]);
  });
});
```

- [ ] **Step 2: 실패 확인** — `pnpm --filter @tk/web test interpreter` → FAIL
- [ ] **Step 3: 구현** — `interpreter.ts` (순수 — Pixi/React import 금지):

```ts
/** 막간 v4 순수 인터프리터 — 씬 스크립트의 유닛 상태·경로 계산(렌더 없음, 스펙 §러너 구조). */
import type { MapScene } from "@tk/data";

export type Cell = readonly [number, number];
export type SceneUnitState = { cell: Cell; facing: "left" | "right"; pose: string; hidden: boolean };
export type Walkable = (c: Cell) => boolean;

export function nearestWalkable(walkable: Walkable, to: Cell): Cell {
  if (walkable(to)) return to;
  // 저작 실수 무붕괴: 맨해튼 링 확장으로 가장 가까운 통행 칸(결정론 — 정렬된 이웃 순회)
  for (let r = 1; r <= 6; r++) {
    for (let dx = -r; dx <= r; dx++) {
      for (const dy of [-(r - Math.abs(dx)), r - Math.abs(dx)]) {
        const c: Cell = [to[0] + dx, to[1] + dy];
        if (walkable(c)) return c;
      }
    }
  }
  return to; // 전부 막힘 — 원좌표 반환(렌더는 순간이동 폴백)
}

export function findScenePath(walkable: Walkable, from: Cell, to: Cell): Cell[] {
  const goal = nearestWalkable(walkable, to);
  const key = (c: Cell) => `${c[0]},${c[1]}`;
  const prev = new Map<string, Cell | null>([[key(from), null]]);
  const q: Cell[] = [from];
  while (q.length) {
    const cur = q.shift()!;
    if (cur[0] === goal[0] && cur[1] === goal[1]) {
      const path: Cell[] = [];
      for (let c: Cell | null = cur; c; c = prev.get(key(c)) ?? null) path.unshift(c);
      return path;
    }
    for (const d of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const n: Cell = [cur[0] + d[0], cur[1] + d[1]];
      if (!prev.has(key(n)) && walkable(n)) { prev.set(key(n), cur); q.push(n); }
    }
  }
  return [from]; // 도달 불가 — 출발지 유지(무붕괴)
}

/** idx까지 액션 누적한 유닛 상태. 줄 내 정렬 = exit→move/face→enter→pose(스펙 계약). */
export function sceneUnitStates(scene: MapScene, lineIdx: number, walkable: Walkable): Map<string, SceneUnitState> {
  const st = new Map<string, SceneUnitState>();
  for (const u of scene.units) {
    st.set(u.id, { cell: u.cell, facing: u.facing ?? "left", pose: "idle", hidden: u.hidden ?? false });
  }
  const upto = Math.min(lineIdx, scene.lines.length - 1);
  for (let i = 0; i <= upto; i++) {
    const l = scene.lines[i];
    if (!l) continue;
    l.exit?.forEach(({ id, to }) => { const s = st.get(id); if (s) { s.cell = to; s.hidden = true; } });
    l.move?.forEach(({ id, to }) => { const s = st.get(id); if (s) s.cell = nearestWalkable(walkable, to); });
    l.face?.forEach(({ id, dir }) => { const s = st.get(id); if (s) s.facing = dir; });
    l.enter?.forEach(({ id, to }) => { const s = st.get(id); if (s) { s.cell = nearestWalkable(walkable, to); s.hidden = false; } });
    l.pose?.forEach(({ id, pose }) => { const s = st.get(id); if (s) s.pose = pose; });
  }
  return st;
}
```

- [ ] **Step 4: 통과 확인** — `pnpm --filter @tk/web test interpreter` PASS + 전체 `pnpm --filter @tk/web test` 회귀 없음.
- [ ] **Step 5: 커밋** — `git add apps/web/src/scene/map && git commit -m "feat(scene): pure interpreter for map scene scripts"`

---

## Chunk 4: SceneStage + MapScenePlayer + 라우트

> Pixi 파트는 테스트 하니스 없음 — 기존 코드 패턴을 **읽고 미러**하는 게 계약. typecheck + 수동.

### Task 4: UnitView 씬 모드 + 커스텀 포즈

**Files:**
- Modify: `apps/web/src/pixi/layers/UnitView.ts` (읽고 시작 — pose 유니온 ~116·297, 바 생성부)

- [ ] **Step 1**: 생성 옵션 `opts?: { bars?: boolean }`(기본 true) — false면 병력바·SP바 생성/갱신 생략. 기존 호출부(UnitLayer)는 무변경(기본값).
- [ ] **Step 2**: 포즈 타입을 `string`으로 완화하되 텍스처 해석 실패 시 idle 폴백(조용한 색사각 금지 — 기존 스프라이트 폴백 체인 유지). 씬에서 `setPose("kneel")` 호출 가능하게 공개 메서드 확인/추가.
  ⚠ **포즈 화이트리스트는 UnitView(~116·297) 외에 `textures.ts`에도 있다**(리뷰 #7): `SpritePose` 타입(~139)과
  `getSprite(…, pose)` 시그니처(~679) — 함께 완화하지 않으면 typecheck가 깨진다. `loadSprites`는 manifest
  포즈를 그대로 로드하므로(260~261) front_kneel 로딩 자체는 무수정.
- [ ] **Step 3**: `pnpm --filter @tk/web typecheck` OK + `pnpm --filter @tk/web test` 회귀 없음(전투 화면 수동 스모크 1회 — 유닛 바 정상).
- [ ] **Step 4**: 커밋 `git commit -m "feat(pixi): UnitView scene mode (no bars) + custom pose swap"`

### Task 5: SceneStage (Pixi 조립)

**Files:**
- Create: `apps/web/src/scene/map/SceneStage.ts`
- Reference(읽기): `apps/web/src/pixi/BattleRenderer.ts`(painted 배경 로드·카메라 fit 패턴), `apps/web/src/pixi/layers/UnitLayer.ts`(UnitView 스폰·moveAlong 사용법), `ObjectLayer.ts`(addDeco), `textures.ts`(loadSprites/loadGround/getObject)

- [ ] **Step 1**: 클래스 `SceneStage` — 계약(스펙 §러너 구조):
  - `init(canvas, mapScene, gameMap)`: Pixi Application → **`loadGround`/`loadSprites`/`loadObjects` 직접 호출**
    (BattleRenderer가 부팅 시 하던 것 — SceneStage도 자기 부팅에서, 리뷰 #8-③) → painted 배경
    (`/assets/maps/{mapId}.webp` 규약, 없으면 타일 폴백 — BattleRenderer 시딩 미러) → **지형 구동
    오브젝트(성벽 오토타일·성문)는 생성하지 않음**(스펙 리뷰 #5 — 씬 벽은 painted 담당) →
    `mapScene.decorations` 있으면 ObjectLayer.addDeco 경로로 소품 → 유닛 스폰(UnitView, `{bars:false}`,
    hidden 유닛은 visible=false) → 카메라 = 맵 전체 fit(뷰포트 대비 스케일 계산).
  - **스프라이트 키 직접 사용 트릭**(리뷰 #8-①): `UnitViewInit.commanderId`에 `"liubei-foot"`을 그대로
    넣으면 spriteMap 기본 규칙("commanderId = spriteId", spriteCandidates ~84-90)으로 해석된다.
    classId는 제네릭 오폴백을 피하도록 매핑에 없는 값(예: `"scene"`)을 전달.
  - **좌표 변환**(리뷰 #8-②): `moveAlong`은 `Coord{x,y}` 배열 — 인터프리터 `Cell` 튜플을
    `{x: c[0], y: c[1]}`로 변환해 전달.
  - `runLineActions(line, states)`: 줄 액션 순차 실행 — exit(걷기 후 숨김)→move/face(walk =
    `findScenePath` + `moveAlong`, 발소리 콜백 기존 배선 미러)→enter(visible 후 걸어 들어옴)→pose(`setPose`).
    반환 Promise. `skipToState(states)` = 인터프리터 상태를 즉시 적용(이동 중단·순간 배치).
  - `setBubble(id, mark | null)`: 유닛 위 소형 말풍선(Pixi Text + 라운드 배경 Graphics — HUD 청동 톤, frames.ts 토큰 참조).
  - `destroy()`.
- [ ] **Step 2**: **`textures.ts OBJECT_FILES`에 실내 데코 등록**(리뷰 #6 — §3-1에서 두 번 밟은 "미등록 키
  조용히 생략" 함정): `table/carpet/screen/counter/stool` → `assets/objects/{kind}.png` 규약. 아트 미생성
  시 getObject=null → 해당 소품만 생략(무붕괴 — painted가 가구를 그릴 수 있으므로 게이트에서 판단).
- [ ] **Step 3**: typecheck OK.
- [ ] **Step 4**: 커밋 `git commit -m "feat(scene): SceneStage - pixi map scene runner reusing battle layers"`

### Task 6: MapScenePlayer + 라우트 파트 재생

**Files:**
- Create: `apps/web/src/scene/MapScenePlayer.tsx`
- Modify: `apps/web/app/scene/page.tsx`
- Reference(읽기): `ScenePlayer.tsx`(셸 구조·탭/키 진행), `parts/{DialoguePanel,NarrationPanel,SkipBar,tokens}`, `useTypewriter`

- [ ] **Step 1**: `MapScenePlayer({ scene: MapScene, title, onComplete })`:
  - 상태: `idx` + 타자기(useTypewriter — text 없으면 스킵) + `phase: "actions" | "text" | "choice"`.
  - 진행 계약(스펙): 줄 시작 → SceneStage.runLineActions(탭 = skipToState로 즉시 완료) → text 있으면 타자기(탭1 = reveal, 탭2 = 다음 줄) / text 없으면 자동 다음 줄 → choice 있으면 타자기 완료 후 두루마리 오버레이(DOM — 옵션 클릭 → react 줄들을 대사창으로 재생 → 다음 줄). 마지막 줄 → onComplete.
  - 레이어: Pixi 캔버스(SceneStage) + 좌상단 장소 라벨(`scene.label`) + SkipBar(스킵 = 인터프리터 최종 상태 적용 후 onComplete) + 하단 (speaker ? DialoguePanel : NarrationPanel) + 두루마리 선택지 오버레이(양피지 토큰 — parts/tokens).
  - bubble = 줄 시작 시 `setBubble`, 줄 종료 시 해제.
  - 맵 데이터: `gameData.maps[scene.map]`에서 로드. `walkable` 구성(리뷰 #8-④):
    `moveCostFor(gameData.terrains[tileLegend[ch]], moveClass) < 99` — IMPASSABLE(99)은 engine 비공개
    상수라 값 비교로(도보 moveClass는 보병 계열 것 재사용).
- [ ] **Step 1.5**: **`StageSchema.scenario` 필드 스왑 + 소비자 배선을 이 커밋에서 함께**(리뷰 #5 순서 해소):
  ① schemas.ts intro/outro/outroDefeat → `SceneSlotSchema` ② page.tsx 정규화(아래) ③ **sim 소비자 대응**
  (리뷰 #1): `packages/sim/src/assets/manifest.ts`(~64-71)가 단일 ScenarioScene을 가정하고 `scene.bg/lines`를
  직접 읽음 — `normalizeSceneSlot`로 정규화해 VN 파트만 bg/초상 수집(+MapScene 파트의 `map`은 맵 요구
  목록에 추가). 검증: `pnpm --filter @tk/sim test` + `pnpm --filter @tk/sim asset-manifest` 크래시 없음.
- [ ] **Step 2**: `page.tsx` — 슬롯 정규화 + 파트 순차 재생:
```tsx
const parts = normalizeSceneSlot(slot);          // @tk/data
const [pi, setPi] = useState(0);
const part = parts[Math.min(pi, parts.length - 1)];
const next = () => (pi >= parts.length - 1 ? fadeTo(target()) : setPi(i => i + 1));
return "map" in part
  ? <MapScenePlayer scene={part} title={stage?.name} onComplete={next} />
  : <ScenePlayer scene={part} title={stage?.name} onComplete={next} />;
```
  파트 전환 페이드 = 기존 fadeTo/오프닝 페이드 문법 미러(파트 키로 리마운트).
- [ ] **Step 3**: typecheck OK + `pnpm --filter @tk/web test` 회귀 없음. 수동: 기존 VN 씬(01·02) 정상, `/scene` 파트 배열은 Chunk 6 데이터 후 확인.
- [ ] **Step 4**: 커밋 `git commit -m "feat(scene): MapScenePlayer shell + sequential scene parts in route"`

---

## Chunk 5: 에셋 파이프라인 (도보 시트·의식 포즈·씬 맵 프롬프트)

### Task 7: 포즈 파이프라인 확장

**Files:**
- Modify: `tools/sprite-pipeline/rebuild_manifest.py` (POSE_ORDER ~31행)
- Modify: `tools/serve.py` (_run_cut — 포즈 인자 전달)
- Modify: `docs/art/asset-board.html` (도보 시트 카드 섹션 신규)

- [ ] **Step 1**: `rebuild_manifest.py` POSE_ORDER에 `"front_kneel"` 추가(뒤에 — 기존 순서 불변).
- [ ] **Step 2**: 보드에 「FS. 도보 씬 시트」 섹션(씬 탭에 등록) — 마퀴 8명(`liubei,guanyu,zhangfei,zhaoyun,zhugeliang,lvbu,caocao,zhouyu`) 카드. 프롬프트 = 기존 SD 스타일 상수 재사용 + **1행 3칸**(서기/걷기/무릎) + no mount/weapon + facing screen-left + 투명 배경 + 발끝 기준선 공유. 저장 = `sprites/{key}-foot/_posesheet.png` + `cut: true, poses: ["idle","move","kneel"], grid: "1x3"` payload.
  ⚠ **포즈명은 bare로**(리뷰 #3): `cut_posesheet.py`가 스스로 `front_` 접두를 붙인다(~219행 `front_{pose}.png`) — `"front_idle"`을 넘기면 `front_front_idle.png`가 된다.
- [ ] **Step 3**: `serve.py` `_run_cut(sid, flip)` 확장(리뷰 #4): `poses`·`grid` 인자 추가 — 현재 **`--grid=3x3` 하드코딩**(~118-124행)이라 1행 3칸 시트를 3×3 분할하면 인물이 세로 3토막 난다. 도보 카드 payload의 `grid`("1x3" 또는 생략=간격감지)와 `poses`(bare)를 CLI로 전달. 기존 9칸 포즈시트 호출은 기본값으로 무변경. sceneActor용 잔재 없는지 재확인.
- [ ] **Step 4**: 검증 — `node --check`(보드), serve.py 파싱, 합성 3칸 시트로 컷 스모크(가로 3분할 → `{key}-foot/front_idle.png` 등 3파일) + `python tools/sprite-pipeline/rebuild_manifest.py`가 `-foot` 디렉터리·kneel 포즈를 매니페스트에 등록하는지 확인.
- [ ] **Step 5**: 커밋 `git commit -m "feat(pipeline): on-foot scene sheets with kneel pose (board card + cut wiring + manifest)"`

### Task 8: 씬 맵 청크 프롬프트 변형

**Files:**
- Modify: `docs/art/map-chunk-board.html` (⚠ asset-board 아님 — 리뷰 #2. `CHUNK_PROMPT` ~94-108행 + `promptFor(st)`)

- [ ] **Step 1**: `promptFor`에서 mapId가 `scene-` 접두면 **씬 변형 프롬프트** 사용: 기존 top-down·구조물 금지 대신 "elevated 3/4 view, front facades visible, 실내/구조물 허용, 격자 정렬 유지, 인물 없음". 색 매핑·격자 오버레이·사이즈 주입은 기존 그대로.
- [ ] **Step 2**: `node --check` + 보드에서 scene 맵 선택 시 변형 프롬프트 확인(헤드리스 eval).
- [ ] **Step 3**: 커밋 `git commit -m "feat(board): scene-map chunk prompt variant (elevated 3/4, structures allowed)"`

---

## Chunk 6: 01 도원결의 수직 완성 (데이터 + 에셋 게이트)

### Task 9: 씬 맵 3장 + 레지스트리

**Files:**
- Create: `packages/data/json/maps/scene-01-{street,tavern,orchard}.json`
- Modify: `packages/data/src/index.ts` (맵 레지스트리 — 맵당 import 1줄 + 레코드 1줄)

- [ ] **Step 1**: 기존 맵 JSON 포맷(가장 작은 기존 맵을 열어 스키마 확인) 그대로 ~15×10 지형 저작:
  - street: 돌길(평지) 세로+가로 교차, 양측 벽(wall)·건물 자리, 통행로 폭 3~4칸.
  - tavern: 외벽 wall 둘레, 내부 평지, 입구 1칸 — 탁자/카펫은 `decorations`(table/carpet/screen/counter — 씬 데이터 쪽)로.
  - orchard: 평지+초지 혼합, 가장자리 나무(forest 지형 or 데코), 중앙 공터.
- [ ] **Step 2**: index.ts 등록(맵당 **2줄** — import 1줄 + `maps` 레코드 1줄, 기존 패턴 미러) + `pnpm --filter @tk/data test` PASS(맵 스키마 검증 통과).
- [ ] **Step 3**: 커밋 `git commit -m "feat(content): scene maps for stage 01 (street/tavern/orchard)"`

### Task 10: 01 인트로 v4 재저작 (재집필 포함)

**Files:**
- Modify: `packages/data/json/stages/01-zhuojun.json` (`scenario.intro` → 파트 배열)

- [ ] **Step 1**: 구성(스펙 §수직 완성): `[VN 개막 카드, 거리 맵, 주점 맵, 과수원 맵]`.
  - VN 카드 = 기존 내레이션 1~2줄 재사용(bg 기존 원경).
  - 거리: 유비 등장 → 방문객/의병 소문 비트(제네릭 sprite — `footman_player` 등 매니페스트 실존 키 확인) → 장비 enter·조우. 이동·말풍선 적극 저작.
  - 주점: 착석 배치 → 관우 enter·합류 → 건배 비트.
  - 과수원: 삼형제 walk-in → 정렬 → `pose: kneel` 맹세(내레이션 혼용) → 기립 → **choice 1개**(맹세 직전 유비 다짐 2지선다 — react 반응 대사) → 출진 결의.
  - 대사·연출 = **창작**(§5 챕터 톤·기존 8줄의 정서 계승, 각 맵 6~10줄). ⚠ 원본 게임 대사 인용·번역 금지(법적 라인) — 문법(이동→대사 리듬)만 참고.
- [ ] **Step 2**: `pnpm --filter @tk/data test` PASS(스키마 파싱) + `pnpm --filter @tk/web test`·typecheck OK.
- [ ] **Step 3**: 수동(에셋 前 폴백 상태) — `/scene?stage=01-zhuojun&type=intro`: VN 카드 → 맵 파트 전환, 유닛이 색사각/제네릭 폴백으로라도 걷고 말풍선·선택지·kneel(미생성 시 idle 폴백) 동작, 스킵 정상, 02 VN 회귀 없음.
- [ ] **Step 4**: 커밋 `git commit -m "feat(content): stage 01 도원결의 as adventure map scene (VN card + 3 maps)"`

### Task 11: 에셋 게이트 (길중) + 최종 판정

- [ ] **Step 0**: 블록아웃 export — `python tools/sprite-pipeline/export_chunks.py scene-01-street` (tavern·orchard 동일, 리뷰 #10) → 청크 보드가 scene 맵 탭을 띄우는 선행 조건.
- [ ] **Step 1**: 생성 요청 — 보드 FS 카드(삼형제 도보 시트 3장: idle/move/kneel) + 씬 맵 painted 3장(scene 청크 변형 프롬프트) 생성·붙여넣기 → 컷·stitch·R2 확인.
- [ ] **Step 2**: 시각 판정 — 실기기에서 01 인트로 풀 시퀀스, **원본 프롤로그 영상과 나란히 비교**(초반 퀄리티 지시사항 기준).
- [ ] **Step 3**: 통과 → 1장(02~04) → 마퀴 롤아웃(데이터+에셋+맵 등록 1줄). 불통과 → 문제 축(맵 아트/이동 리듬/대사 밀도)별 조정.

---

## 완료 기준

- Chunk 1 = v3 잔존 grep 0 + 전 테스트 green. Chunk 2·3 = 초록 테스트. Chunk 4·5 = typecheck + 수동. Chunk 6 = 01 풀 시퀀스 + 길중 게이트.
- 문서 갱신(CLAUDE.md §5 v4·메모리·스펙/플랜 상태)은 완료 후 "업데이트 하자" 워크플로우로.

## 후속(이 플랜 밖)
- 1장 02~04·마퀴 나머지 저작. 카메라 팬/줌. 씬 내 아이템 지급. 막간 허브(군영 맵 — v1.5 마을 탐방 합류).
