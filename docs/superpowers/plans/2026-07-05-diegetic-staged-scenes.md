# 디에게틱 막간 스테이지 씬 Implementation Plan (v2 2026-07-09)

> ✅ **구현 완료 (2026-07-10)** — Tasks 1~11 전부 배송(subagent-driven, 청크별 스펙+품질 2단 리뷰, 최종 통합 리뷰 READY). 잔여 = **Task 12 에셋 생성 게이트**(길중: 보드 SA 삼형제 3장 + 01 복숭아밭 staged 1장 → 경쟁작 비교 판정 → 마퀴 10개 롤아웃). 실행 편차 1건: ActorStage 컴포넌트는 `apps/web/src/scene/parts/ActorStage.tsx`(Windows 대소문자 무구분 FS에서 헬퍼 `actorStage.ts`와 TS1149 충돌 — scene/ 직하 불가). 라이브 검증 완료(초상 폴백·선행 스캔·근경 전환·VN 회귀 없음).

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 마퀴(★) 막간 씬을 "원경 establishing → 근경 무대 전환 + 씬 전용 SD 도보 배우"의 디에게틱 스테이지로 연출한다. 나머지 씬은 기존 VN 그대로.

**Architecture:** 씬 데이터에 optional `actors[]`를 추가하고, 라우트가 `scene.actors?.length`로 새 `StagedScenePlayer`(DOM/CSS 스프라이트 스테이지)와 기존 `ScenePlayer`(VN)를 분기한다. 배우 에셋은 **씬 전용 신규 카테고리 2종**(`/assets/scene-actors/{key}.png` 도보 포즈, `/assets/scenes/{stageId}-staged.webp` 근경 무대) — 전투 스프라이트·기존 원경 배경은 세우지 않는다(v2 재검토 결정). 공유 로직(진행 훅·조각)은 추출해 두 플레이어가 얇게 조립. Pixi 미사용.

**Tech Stack:** Next.js/React (apps/web), Zod 스키마(packages/data), Vitest, 에셋보드(docs/art/asset-board.html)+serve.py 파이프라인.

**Spec:** docs/superpowers/specs/2026-07-05-diegetic-staged-scenes-design.md (**v2** — 반드시 v2 기준. §씬 전용 에셋, 데이터 모델 결정 3~5가 v1과 다름)

---

## 실행 전 준비

- CLAUDE.md 원칙: main 직접 커밋 금지 → **먼저 브랜치**: `git switch feat/diegetic-staged-scenes` (이미 존재, main과 동일 지점).
- 테스트 러너 = **vitest**. 실행: `pnpm --filter @tk/data test`, `pnpm --filter @tk/web test`(web 패키지 name = `@tk/web`).
- **vitest 필터 주의:** ① web 테스트는 `apps/web/vitest.config.ts`의 `include: ["src/**/__tests__/**/*.test.ts"]`만 수집 — 테스트는 반드시 `src/**/__tests__/*.test.ts`에 둔다(다른 위치·`.tsx`는 조용히 스킵). ② `test <문자열>`은 **파일경로 부분일치** 필터.
- **테스트 정책:** web 테스트는 전부 로직 유닛(.test.ts), React 렌더 하니스 없음. **TDD 대상 = zod 스키마 + 순수 헬퍼**. React 컴포넌트 = `pnpm --filter @tk/web typecheck` + 수동 + 길중 눈(프리뷰 MCP는 창 hidden→rAF 정지라 라이브 검증 불가).
- **에셋 생성 게이트:** GEMINI_API_KEY 디스크 부재 → 생성은 **보드 붙여넣기 경로(길중)**가 기본. Chunk 5가 프롬프트를 준비하고, Chunk 6의 시각 판정은 에셋 도착 후.

## File Structure

| 파일 | 책임 | 신규/변경 |
|---|---|---|
| `packages/data/src/schemas.ts` | `StageActorSchema`(portrait 포함), `ScenarioScene.actors`, `ScenarioLine.{actor,enter,exit,emote}` | 변경 |
| `packages/data/test/schemas.test.ts` | 스키마 계약 테스트 | 변경 |
| `apps/web/src/scene/actorStage.ts` | 순수 헬퍼 — `actorSpriteCandidates`, `visibleActorIds`(선행 스캔) | 신규 |
| `apps/web/src/scene/__tests__/actorStage.test.ts` | 헬퍼 유닛 테스트 | 신규 |
| `apps/web/src/scene/useSceneProgression.ts` | 진행 상태 훅(ScenePlayer에서 추출) | 신규 |
| `apps/web/src/scene/parts/{SceneBackground,DialoguePanel,NarrationPanel,SkipBar}.tsx` | 프레젠테이션 조각(순수 이동) | 신규 |
| `apps/web/src/scene/parts/tokens.ts` | 공유 색 상수 | 신규 |
| `apps/web/src/scene/ScenePlayer.tsx` | VN 플레이어(조각 재조립, 동작 보존) | 변경 |
| `apps/web/src/scene/ActorStage.tsx` | 배우 레이어 + 내부 `ActorSprite`(폴백 체인) | 신규 |
| `apps/web/src/scene/StagedScenePlayer.tsx` | 스테이지 플레이어 | 신규 |
| `apps/web/app/scene/page.tsx` | `scene.actors?.length` 분기 | 변경 |
| `docs/art/asset-board.html` | 「SA. 씬 배우」 섹션(8키) + 마퀴 staged 배경 카드(11장) | 변경 |
| `tools/serve.py` | scene-actors 저장 경로 지원(필요 시 — 기존 범용 저장이면 무변경) | 확인/변경 |
| `packages/data/json/stages/01-zhuojun.json` | 01 도원결의 수직 완성 저작 | 변경 |

---

## Chunk 1: 데이터 계약 (스키마)

### Task 1: 씬 스키마에 배우 필드 추가

**Files:**
- Modify: `packages/data/src/schemas.ts` (ScenarioLineSchema ~520, ScenarioSceneSchema ~535 부근)
- Test: `packages/data/test/schemas.test.ts`

- [ ] **Step 1: 실패 테스트 작성** — `packages/data/test/schemas.test.ts`에 추가
  > ⚠ `ScenarioSceneSchema`는 이 파일이 **이미 import 중**(5행 부근) — 신규 import 추가 금지(중복 식별자 컴파일 에러로 TDD 신호 오염). describe 블록만 추가.

```ts
describe("staged scene actors", () => {
  it("actors 배열(portrait 포함)과 line.actor/enter/exit/emote를 파싱한다", () => {
    const parsed = ScenarioSceneSchema.parse({
      bg: "01-zhuojun-intro",
      actors: [
        { id: "liubei", sprite: "liubei", portrait: "유비", x: 50, y: 74 },
        { id: "guanyu", sprite: "guanyu", x: 30, facing: "right", scale: 1.1 },
      ],
      lines: [
        { text: "복숭아밭에 셋이 모였다." },
        { speaker: "유비", portraitId: "유비", actor: "liubei", text: "우리 셋이…", emote: "..." },
        { speaker: "관우", actor: "guanyu", enter: ["guanyu"], exit: ["liubei"], text: "형님." },
      ],
    });
    expect(parsed.actors).toHaveLength(2);
    expect(parsed.actors?.[0]?.portrait).toBe("유비");
    expect(parsed.actors?.[1]?.facing).toBe("right");
    expect(parsed.lines[1]?.actor).toBe("liubei");
    expect(parsed.lines[2]?.enter).toEqual(["guanyu"]);
  });

  it("actors 없는 기존 VN 씬도 그대로 유효하다(하위호환)", () => {
    const parsed = ScenarioSceneSchema.parse({ bg: "x", lines: [{ text: "a" }] });
    expect(parsed.actors).toBeUndefined();
  });

  it("emote·facing은 허용된 값만 받는다", () => {
    expect(() => ScenarioSceneSchema.parse({ lines: [{ text: "a", emote: "wat" }] })).toThrow();
    expect(() =>
      ScenarioSceneSchema.parse({
        actors: [{ id: "a", sprite: "a", x: 0, facing: "up" }],
        lines: [{ text: "a" }],
      }),
    ).toThrow();
  });
});
```

- [ ] **Step 2: 실패 확인** — Run: `pnpm --filter @tk/data test schemas` → Expected: FAIL

- [ ] **Step 3: 스키마 구현** — `packages/data/src/schemas.ts`

`ScenarioLineSchema`에 필드 추가:
```ts
export const ScenarioLineSchema = z.object({
  speaker: z.string().optional(),
  side: SideSchema.optional(),
  portraitId: z.string().optional(),
  text: z.string(),
  bg: z.string().optional(),
  // 디에게틱 스테이지 씬(스펙 v2) — 전부 선택, 하위호환. actors 없는 VN 씬엔 무의미.
  actor: z.string().optional(),          // 이 줄을 말하는 배우 id(스포트라이트). 미매칭/미등장=no-op.
  enter: z.array(z.string()).optional(), // 이 줄에서 등장하는 배우 id (선행 스캔: 나열된 배우는 첫 enter 전 숨김)
  exit: z.array(z.string()).optional(),  // 이 줄에서 퇴장하는 배우 id
  emote: z.enum(["...", "!", "?"]).optional(), // 말하는 배우 위 말풍선 마크
});
```

`ScenarioSceneSchema` 위에 `StageActorSchema` 신설 + `actors` 추가:
```ts
/** 디에게틱 스테이지 배우(스펙 v2). sprite = /assets/scene-actors/{sprite}.png 전용 영문 키(전투 폴더와 무관). */
export const StageActorSchema = z.object({
  id: z.string(),                               // 씬 내 안정 참조
  sprite: z.string(),                           // scene-actors 전용 영문 키
  portrait: z.string().optional(),              // 폴백② 초상 키(한국어 commanderId). 미지정=폴백② 생략
  x: z.number(),                                // 0~100 가로 위치(%)
  y: z.number().optional(),                     // 0~100 바닥선(화면 상단 기준 %, CSS top). 미지정=72
  facing: z.enum(["left", "right"]).optional(), // 기본 "left"(원본 screen-left). "right"=scaleX(-1)
  scale: z.number().optional(),
});
export type StageActor = z.infer<typeof StageActorSchema>;

export const ScenarioSceneSchema = z.object({
  bg: z.string().optional(),
  actors: z.array(StageActorSchema).optional(), // 있으면 디에게틱 스테이지, 없으면 VN
  lines: z.array(ScenarioLineSchema).min(1),
});
```
(기존 ScenarioSceneSchema에 다른 필드가 있으면 보존 — actors만 추가.)

- [ ] **Step 4: 통과 확인** — Run: `pnpm --filter @tk/data test schemas` → PASS. 이어서 `pnpm --filter @tk/data test`(전체) → 기존 테스트 회귀 없음.

- [ ] **Step 5: 커밋**
```bash
git add packages/data/src/schemas.ts packages/data/test/schemas.test.ts
git commit -m "feat(data): staged scene actor schema (actors[] w/ portrait + line.actor/enter/exit/emote)"
```

---

## Chunk 2: 순수 헬퍼

### Task 2: actorStage 헬퍼 + 테스트

**Files:**
- Create: `apps/web/src/scene/actorStage.ts`
- Test: `apps/web/src/scene/__tests__/actorStage.test.ts`

- [ ] **Step 1: 실패 테스트 작성** — `apps/web/src/scene/__tests__/actorStage.test.ts`

```ts
import { describe, it, expect } from "vitest";
import { actorSpriteCandidates, visibleActorIds } from "../actorStage";
import type { StageActor, ScenarioLine } from "@tk/data";

const a = (id: string, portrait?: string): StageActor => ({ id, sprite: id, portrait, x: 50 });

describe("actorSpriteCandidates", () => {
  it("씬 포즈 URL → (portrait 있으면) 초상 URL 순", () => {
    const c = actorSpriteCandidates(a("liubei", "유비"));
    expect(c[0]).toContain("/assets/scene-actors/liubei.png");
    expect(c[1]).toContain("/assets/ui/portraits/유비.webp");
    expect(c).toHaveLength(2);
  });
  it("portrait 미저작이면 씬 포즈 1개만(실루엣은 URL 아님)", () => {
    expect(actorSpriteCandidates(a("zhouyu"))).toHaveLength(1);
  });
});

describe("visibleActorIds (선행 스캔 규칙)", () => {
  const lines: ScenarioLine[] = [
    { text: "0 원경 내레이션" },
    { text: "1 근경 전환", enter: ["liubei", "guanyu"] },
    { text: "2", exit: ["liubei"] },
    { text: "3", enter: ["liubei"] },
  ];
  // liubei·guanyu는 lines 어딘가 enter에 나열 → 첫 enter 전 숨김. zhangfei는 미나열 → 상주.
  const actors = [a("liubei"), a("guanyu"), a("zhangfei")];

  it("enter에 나열된 배우는 그 줄 전까지 숨김, 미나열 배우는 상주", () => {
    expect(visibleActorIds(lines, 0, actors)).toEqual(new Set(["zhangfei"]));
  });
  it("enter 줄부터 보인다", () => {
    expect(visibleActorIds(lines, 1, actors)).toEqual(new Set(["zhangfei", "liubei", "guanyu"]));
  });
  it("exit는 그 줄부터 제거", () => {
    expect(visibleActorIds(lines, 2, actors).has("liubei")).toBe(false);
  });
  it("exit 후 enter 재등장", () => {
    expect(visibleActorIds(lines, 3, actors).has("liubei")).toBe(true);
  });
});
```

- [ ] **Step 2: 실패 확인** — Run: `pnpm --filter @tk/web test actorStage` → FAIL (module not found)

- [ ] **Step 3: 구현** — `apps/web/src/scene/actorStage.ts`

```ts
/**
 * actorStage — 디에게틱 스테이지 씬 순수 헬퍼(스펙 v2). 렌더 없음(테스트 가능).
 * 배우 에셋 = /assets/scene-actors/ 전용 키(전투 스프라이트 리졸버와 무관 — 마퀴 손저작).
 */
import type { StageActor, ScenarioLine } from "@tk/data";
import { assetUrl } from "../assetUrl";

/**
 * 배우 이미지 후보 URL — ① 씬 도보 포즈 → ② 초상(portrait 저작 시에만, 한국어 키).
 * 다 소진하면 ActorSprite가 CSS 실루엣 렌더(URL 아님 — 이 배열엔 없음).
 */
export function actorSpriteCandidates(actor: StageActor): string[] {
  const urls = [assetUrl(`/assets/scene-actors/${actor.sprite}.png`)];
  if (actor.portrait) urls.push(assetUrl(`/assets/ui/portraits/${actor.portrait}.webp`));
  return urls;
}

/**
 * idx까지의 등장 배우 id 집합. 규칙(스펙 v2 결정 3):
 * - 선행 스캔: lines 어딘가 enter에 나열된 배우는 첫 enter 전까지 숨김.
 * - enter 미나열 배우는 처음부터 상주.
 * - 이후 idx까지 exit 제거 → enter 추가 누적(같은 줄은 exit 후 enter — 재등장 우선).
 */
export function visibleActorIds(
  lines: readonly ScenarioLine[],
  idx: number,
  actors: readonly StageActor[],
): Set<string> {
  const enterListed = new Set<string>();
  for (const l of lines) l.enter?.forEach((id) => enterListed.add(id));
  const set = new Set(actors.map((a) => a.id).filter((id) => !enterListed.has(id)));
  for (let i = 0; i <= Math.min(idx, lines.length - 1); i++) {
    const l = lines[i];
    if (!l) continue;
    l.exit?.forEach((id) => set.delete(id));
    l.enter?.forEach((id) => set.add(id));
  }
  return set;
}
```

- [ ] **Step 4: 통과 확인** — Run: `pnpm --filter @tk/web test actorStage` → PASS

- [ ] **Step 5: 커밋**
```bash
git add apps/web/src/scene/actorStage.ts apps/web/src/scene/__tests__/actorStage.test.ts
git commit -m "feat(scene): pure helpers for staged scene actors (pre-scan enter rule)"
```

---

## Chunk 3: 공유 추출 리팩터 (동작 보존)

> 목표: 현 `ScenePlayer.tsx`(171줄 monolithic)에서 진행 상태 훅 + 프레젠테이션 조각을 뽑아,
> VN·스테이지 두 플레이어가 재사용하게 한다. **동작·마크업·스타일 100% 보존**(회귀 없음).
> 각 조각은 현 ScenePlayer의 해당 JSX/스타일을 **그대로 옮긴다**(새 디자인 금지 — 순수 이동).

### Task 3: useSceneProgression 훅 추출

**Files:**
- Create: `apps/web/src/scene/useSceneProgression.ts`
- Reference: `apps/web/src/scene/ScenePlayer.tsx:39-67`(idx/typewriter/advance/currentBg 로직)

- [ ] **Step 1: 훅 작성** — 현 ScenePlayer의 상태 로직을 이관

```ts
"use client";
import { useState } from "react";
import type { ScenarioScene } from "@tk/data";
import { useTypewriter } from "./useTypewriter";

/** 막간 씬 진행 상태(VN·스테이지 공유). idx·타자기·advance·현재 배경·내레이션 판정. */
export function useSceneProgression(scene: ScenarioScene, onComplete: () => void) {
  const [idx, setIdx] = useState(0);
  // 연속 탭 가드: 같은 렌더 클릭 2발이 겹쳐도 범위 초과 안 하도록 클램프(현 ScenePlayer 주석 보존).
  const line = scene.lines[Math.min(idx, scene.lines.length - 1)]!;
  const { shown, done, reveal } = useTypewriter(line.text);

  const advance = () => {
    if (!done) { reveal(); return; }
    if (idx >= scene.lines.length - 1) { onComplete(); return; }
    setIdx((i) => Math.min(i + 1, scene.lines.length - 1));
  };

  // 현재 배경 = idx까지 마지막 bg 지정(없으면 씬 기본) — 현 ScenePlayer 로직 보존.
  let currentBg = scene.bg;
  for (let i = 0; i <= idx; i++) { const b = scene.lines[i]?.bg; if (b) currentBg = b; }

  return { idx, line, shown, done, advance, currentBg, isNarration: !line.speaker };
}
```
> ⚠ 추출 시 현 ScenePlayer 실코드와 대조 — 위는 스케치. useTypewriter 시그니처·클램프 주석 등 실제 코드를 그대로 이관한다.

- [ ] **Step 2: 확인** — Run: `pnpm --filter @tk/web typecheck` → OK

- [ ] **Step 3: 커밋**
```bash
git add apps/web/src/scene/useSceneProgression.ts
git commit -m "refactor(scene): extract useSceneProgression hook"
```

### Task 4: 프레젠테이션 조각 추출

**Files:**
- Create: `apps/web/src/scene/parts/SceneBackground.tsx`, `DialoguePanel.tsx`, `NarrationPanel.tsx`, `SkipBar.tsx`, `tokens.ts`
- Reference: `ScenePlayer.tsx` 해당 JSX 블록(배경 88-95 / SkipBar 97-107 / Narration 110-133 / Dialogue 134-167)

- [ ] **Step 1: 4개 조각 + tokens 작성** — 각 컴포넌트는 현 ScenePlayer의 해당 JSX/인라인스타일을 **그대로** 옮기고 props로 받는다. 색 상수(`PARCHMENT`/`BRONZE_GOLD`/`BRONZE_DIM`/`SIDE_COLOR`)는 `parts/tokens.ts`로 추출.
  - `SceneBackground({ bg, title })` — AssetImage bg + 그라디언트 + 오프닝 페이드 + `<style>` 키프레임(`tkBgIn`/`tkSceneIn`).
  - `SkipBar({ title, onSkip })`
  - `NarrationPanel({ shown, done, idx, total })`
  - `DialoguePanel({ line, shown, done, idx, total })` — 초상 `portraitId`→AssetImage, side 색, 타자기.
  > 마크업/px/색/애니메이션 이름 변경 금지. 순수 이동 + props화.
  > ⚠ 진행 캐럿 `▼`의 `tkBlink` 키프레임은 현재 ScenePlayer 루트 `<style>`(~168행)에 있음 —
  > **(Narration|Dialogue)Panel 쪽으로 함께 이동**(각자 또는 공용). ScenePlayer 루트에 남기면
  > StagedScenePlayer에서 캐럿 깜빡임이 죽는다(시각 회귀).

- [ ] **Step 2: 확인** — Run: `pnpm --filter @tk/web typecheck` → OK

- [ ] **Step 3: 커밋**
```bash
git add apps/web/src/scene/parts/
git commit -m "refactor(scene): extract SceneBackground/Dialogue/Narration/SkipBar parts"
```

### Task 5: ScenePlayer를 조각으로 재조립

**Files:**
- Modify: `apps/web/src/scene/ScenePlayer.tsx`

- [ ] **Step 1: 재조립** — `useSceneProgression` + 4개 조각 조립으로 교체. 루트 `<div onClick={advance}>` + `SceneBackground` + `SkipBar` + (isNarration ? NarrationPanel : DialoguePanel). **최종 렌더 결과가 이전과 픽셀 동일.**

- [ ] **Step 2: 회귀 확인**
  - Run: `pnpm --filter @tk/web typecheck` → OK, `pnpm --filter @tk/web test` → PASS
  - **수동**: `next dev` → `/scene?stage=01-zhuojun&type=intro` 기존 VN 인트로가 동일 재생(타자기·탭·건너뛰기·내레이션·배경 전환).

- [ ] **Step 3: 커밋**
```bash
git add apps/web/src/scene/ScenePlayer.tsx
git commit -m "refactor(scene): recompose ScenePlayer from shared parts (behavior-preserving)"
```

---

## Chunk 4: 스테이지 플레이어

### Task 6: ActorStage + ActorSprite

**Files:**
- Create: `apps/web/src/scene/ActorStage.tsx`
- Uses: `actorStage.ts`(Task 2), `parts/tokens.ts`

- [ ] **Step 1: 구현** — DOM/CSS 레이어. Pixi 없음. 핵심 계약(스펙 v2):

  - **`ActorSprite`(내부) — 폴백 체인 소유**(AssetImage 미사용):
    ```tsx
    function ActorSprite({ actor, speaking, emote }: { actor: StageActor; speaking: boolean; emote?: string }) {
      const candidates = actorSpriteCandidates(actor); // [씬 포즈, 초상?]
      const [ci, setCi] = useState(0);
      const failed = ci >= candidates.length;
      // failed → CSS 실루엣: 어두운 라운드 박스 + 이니셜(= actor.portrait?.[0] ?? actor.id[0]).
      // 아니면 <img src={candidates[ci]} alt={actor.id} onError={() => setCi(i => i + 1)} draggable={false} />
      // facing 기본 "left"(원본). "right"면 transform: scaleX(-1).
      // speaking → brightness(1.06) + scale(1.05) + bob 애니. 비화자 → brightness(0.72)/opacity(0.85) 디밍.
      // emote && speaking → 배우 머리 위 말풍선(둥근 박스 + "…"/"!"/"?").
    }
    ```
  - **`ActorStage({ actors, visibleIds, speakingId, emote })`**:
    - 배우 절대배치: `left: {x}%`, `top: {y ?? 72}%`(화면 상단 기준 %), `transform: translate(-50%, -100%)`(발=바닥선 anchor).
    - z-index = `y` 오름차순(작을수록 뒤), 동률 = `actors[]` 배열 순서(뒤일수록 앞).
    - 발밑 그림자 타원(발 위치 고정, `scale` 무관 크기).
    - `visibleIds`에 없는 배우 = 렌더 제외 + enter/exit CSS transition(측면 슬라이드+페이드).
    - `speakingId`가 visible에 없으면 아무도 강조 안 함(no-op).
    - `<style>` bob 키프레임 — `tkActor*` 프리픽스(충돌 회피).

- [ ] **Step 2: 확인** — Run: `pnpm --filter @tk/web typecheck` → OK

- [ ] **Step 3: 커밋**
```bash
git add apps/web/src/scene/ActorStage.tsx
git commit -m "feat(scene): ActorStage + ActorSprite (scene-actor assets, fallback chain, spotlight)"
```

### Task 7: StagedScenePlayer

**Files:**
- Create: `apps/web/src/scene/StagedScenePlayer.tsx`

- [ ] **Step 1: 구현** — `ScenePlayer`와 동일 props(`{ scene, title, onComplete }`). 레이어 = `SceneBackground` → `ActorStage` → `SkipBar` → (Narration|Dialogue)Panel. 루트 `<div onClick={advance}>`.
  - `ActorStage` props: `actors={scene.actors!}`, `visibleIds={visibleActorIds(scene.lines, idx, scene.actors!)}`, `speakingId={line.actor}`, `emote={line.emote}`.

- [ ] **Step 2: 확인** — Run: `pnpm --filter @tk/web typecheck` → OK

- [ ] **Step 3: 커밋**
```bash
git add apps/web/src/scene/StagedScenePlayer.tsx
git commit -m "feat(scene): StagedScenePlayer composing shared parts + ActorStage"
```

### Task 8: 라우트 분기

**Files:**
- Modify: `apps/web/app/scene/page.tsx:47-52`

- [ ] **Step 1: 분기 한 줄**
```tsx
const Player = scene.actors?.length ? StagedScenePlayer : ScenePlayer;
return (
  <>
    <Player scene={scene} title={stage?.name} onComplete={() => fadeTo(target())} />
    {overlay}
  </>
);
```
상단에 `import { StagedScenePlayer } from "../../src/scene/StagedScenePlayer";` 추가.

- [ ] **Step 2: 회귀 확인** — typecheck OK. 수동: actors 없는 기존 씬은 여전히 VN 경로.

- [ ] **Step 3: 커밋**
```bash
git add apps/web/app/scene/page.tsx
git commit -m "feat(scene): route picks StagedScenePlayer when scene has actors"
```

---

## Chunk 5: 에셋 파이프라인 (보드 프롬프트 + 저장 경로)

> 씬 전용 에셋 2종(스펙 v2 E-1/E-2)의 **생성 준비**. 실제 생성(Gemini)은 길중 붙여넣기 경로.

### Task 9: 에셋보드 「SA. 씬 배우」 섹션 신설

**Files:**
- Modify: `docs/art/asset-board.html` (기존 SECTIONS 패턴 — 씬 섹션 N 부근에 추가)
- Modify(필요 시): `tools/serve.py` — png 저장 지원 확인

- [ ] **Step 1: 섹션 추가** — 8키 각 1카드. DUEL_DESC(보드 내 기존 장수 영문 묘사)를 참조하되 **무기·전투 자세 제거, civil standing** 변형. 카드 구조는 기존 `sceneCard` 패턴을 따라 `sceneActorCard: true` + `gamePath: "assets/scene-actors/{key}.png"`:

```js
/* ── SA. 씬 배우 (디에게틱 막간 스테이지 — 스펙 v2 E-1) ──
   탈것·전투장비 없는 맨몸/평상 차림 standing idle 전신 SD 1장. 투명 배경, facing=screen-left.
   전투 SD와 같은 화풍(같은 모델·스타일 지시)이되 mount/시그니처 무기 주입 없음. */
const SCENE_ACTORS = [
  { key: 'liubei',     name: '유비',   desc: 'Liu Bei as a humble young man in plain hanfu robes with a straw-woven belt, gentle dignified face, standing calmly' },
  { key: 'guanyu',     name: '관우',   desc: 'Guan Yu with his magnificent long black beard, deep-green civilian robe, standing tall with quiet gravity, unarmed' },
  { key: 'zhangfei',   name: '장비',   desc: 'Zhang Fei with bristling whiskers, rough dark tunic, burly frame, standing with arms crossed, unarmed' },
  { key: 'zhaoyun',    name: '조운',   desc: 'Zhao Yun as a young gallant man in a plain white-silver tunic, upright posture, unarmed' },
  { key: 'zhugeliang', name: '제갈량', desc: 'Zhuge Liang in a scholar\'s crane-feather robe holding a feather fan, serene, standing' },
  { key: 'lvbu',       name: '여포',   desc: 'Lu Bu in a crimson-and-gold tunic with twin pheasant-tail plumes, imposing, standing, unarmed' },
  { key: 'caocao',     name: '조조',   desc: 'Cao Cao in a dark noble robe with subtle gold trim, sharp calculating gaze, standing composed' },
  { key: 'zhouyu',     name: '주유',   desc: 'Zhou Yu as an elegant young Wu commander in a refined red-and-white robe, standing gracefully, unarmed' },
];
```
프롬프트 템플릿(카드 `prompt`): 톱다운 아닌 **씬용 3/4 스탠딩 SD** — 기존 SD 스타일 상수 재사용하되 "standing idle full-body, no mount, no weapon, no combat stance, transparent background, facing screen-left" 명시. 여러 명 시트 생성도 허용(초상 시트 문법) — 단 v1은 카드당 1인이 안전.

- [ ] **Step 2: 저장 경로 배선 — 2지점** (⚠ 함수명 정확히):
  ① **`addImageToCard`(asset-board.html ~2089)** — 붙여넣기 저장 분기에 `item.sceneActorCard` 케이스 추가: **webp 변환 없이 png 그대로** `assets/scene-actors/{key}.png` 저장(투명 알파 보존). 분기를 안 넣으면 else 폴백(`assets/_board_dump/`)으로 조용히 엉뚱한 곳에 저장됨.
  ② **`cardGamePaths`(~1791)** — R2 자동복원용 경로 도출에 같은 경로 추가(누락 시 보드 재로드에서 복원 안 됨).
  `applyToGame`(~1514)은 POST 헬퍼라 수정 불필요. serve.py `/save-asset`은 `assets/` 하위 범용 저장이라 무변경.

- [ ] **Step 3: 수동 확인** — serve.py(:8080) 재시작 → 보드에서 임의 png 붙여넣기 → `apps/web/public/assets/scene-actors/{key}.png` 로컬 저장 + R2 업로드 확인.

- [ ] **Step 4: 커밋**
```bash
git add docs/art/asset-board.html tools/serve.py
git commit -m "feat(board): scene actor cards (SA section) - standing SD poses for staged scenes"
```

### Task 10: 마퀴 staged 근경 배경 카드 11장

**Files:**
- Modify: `docs/art/asset-board.html` (섹션 N 씬 카드 빌더 확장)

- [ ] **Step 1: staged 카드 추가** — 마퀴 11개(01·05·06·14·17·18·20·21·22·26·27)에 `saveName: "{num}-{id}-staged.webp"` 카드 생성. 프롬프트 = 기존 intro 씬 묘사(`d.en`)를 **근경 무대 구도로 변환**하는 공통 지시 결합:

```
Close-range ground-level stage composition for character sprites to stand on:
solid walkable ground occupying the bottom third of the frame, eye-level or slightly
elevated camera, middle-ground scenery, NO distant aerial/panoramic view.
No people, no text. {장면별 장소 묘사}
```
장면별 장소(스펙 저작 표): 01 복숭아밭, 05 관문 진영, 06 관문 앞, 14 하비 성루, 17 여남 들길, 18 초려 마당, 20 난전 들판, 21 다리 앞, 22 나루터, 26 강안 진영, 27 산길.

- [ ] **Step 2: 수동 확인** — 보드 로드 → staged 카드 11장 노출·프롬프트 복사 가능. 붙여넣기 시 `assets/scenes/{...}-staged.webp` 저장(기존 sceneCard 경로 재사용이라 대개 무변경).

- [ ] **Step 3: 커밋**
```bash
git add docs/art/asset-board.html
git commit -m "feat(board): staged close-up background cards for 11 marquee scenes"
```

---

## Chunk 6: 01 도원결의 수직 완성

### Task 11: 01 탁군 인트로 저작 (배우 + 원경→근경 전환)

**Files:**
- Modify: `packages/data/json/stages/01-zhuojun.json` (`scenario.intro`)

현 상태: intro 8줄(**내레이션 3 + 대사 5** — 마지막 줄도 내레이션), `bg: "01-zhuojun-intro"`(원경 보유), 화자·portraitId 한국어. ⚠ **첫 대사 화자 = 의병(전령)**으로 `actors[]`에 없는 인물.

- [ ] **Step 1: actors + 전환 저작** — 저작 문법(스펙 v2): 원경 동안 배우 미등장 → 근경 전환 줄에 첫 enter.

```json
"actors": [
  { "id": "guanyu",   "sprite": "guanyu",   "portrait": "관우", "x": 28, "y": 70 },
  { "id": "liubei",   "sprite": "liubei",   "portrait": "유비", "x": 50, "y": 74 },
  { "id": "zhangfei", "sprite": "zhangfei", "portrait": "장비", "x": 72, "y": 71, "facing": "left" }
]
```
lines 조정(기존 텍스트 유지·필드만 추가):
- 앞쪽 내레이션 줄: 그대로 — 원경 `01-zhuojun-intro` 표시, 배우 없음(셋 다 enter 나열이라 숨김).
- **의병(전령) 급보 줄**: `"bg": "01-zhuojun-staged"` + `"enter": ["guanyu", "liubei", "zhangfei"]`,
  **`actor`는 생략**(의병은 배우가 아님 — no-op 계약) — 근경 페이드 + 삼형제 등장만 담당.
- 이후 삼형제 대사 줄에 화자 `actor`(유비 줄=`"liubei"` 등) + 감정 비트에 `emote`(장비 첫 대사 `"!"` 등).
  마지막 내레이션 줄은 필드 없이 그대로(무대 셋만 보임).
- 유비 x=50·y=74(중앙·반보 앞), 관우·장비 양옆 — z-정렬 확인용 y 차등.

- [ ] **Step 2: 파싱 확인** — Run: `pnpm --filter @tk/data test` → PASS (stages 로드/검증 테스트가 새 필드로도 통과)

- [ ] **Step 3: 폴백 상태 수동 확인(에셋 도착 전)** — `next dev` → `/scene?stage=01-zhuojun&type=intro`:
  - 줄 0~1 = 원경 + 내레이션(배우 없음) → 첫 대사 줄에서 배경 페이드 + 배우 3명 등장.
  - 씬 포즈 미생성 상태 = **초상 폴백(유비.webp 등)**으로 무대에 섬 — 폴백 사다리 검증.
  - 말하는 배우 강조/디밍·emote·탭·건너뛰기 정상. 다른 스테이지 씬 = 여전히 VN.

- [ ] **Step 4: 커밋**
```bash
git add packages/data/json/stages/01-zhuojun.json
git commit -m "feat(content): stage 01 도원결의 as diegetic staged scene (vertical slice)"
```

### Task 12: 에셋 생성 게이트 (길중) + 최종 판정

- [ ] **Step 1: 생성 요청** — 보드 SA 카드(삼형제 3장) + staged 카드(01 복숭아밭 1장) 프롬프트로 길중이 생성·붙여넣기 → `assets/scene-actors/{liubei,guanyu,zhangfei}.png` + `assets/scenes/01-zhuojun-staged.webp` 로컬+R2 확인.
- [ ] **Step 2: 시각 판정(길중 눈)** — `/scene?stage=01-zhuojun&type=intro` 실기기: 원경→근경 전환, 삼형제 도보 SD가 지면에 서고 스포트라이트·bob·말풍선 동작. **경쟁작 도원결의와 나란히 비교 판정.**
- [ ] **Step 3: 통과 시** — 나머지 마퀴 10개 롤아웃(에셋+저작 반복, 코드 무변경 — 이 플랜 밖). 불통과 시 문제 축(포즈 품질/배경 구도/연출)별로 재생성 or 스펙 재검토.

---

## 완료 기준

- Chunk 1·2 = 초록 테스트. Chunk 3~5 = typecheck + 기존 VN 씬 회귀 없음(수동). Chunk 6 = 01 디에게틱 렌더 + 길중 판정 게이트.
- 문서 갱신: 완료 후 CLAUDE.md §5·memory 반영은 "업데이트 하자" 워크플로우로.

## 후속(이 플랜 밖)
- 마퀴 나머지 10개 저작 + 씬 포즈 5장(조운·제갈량·여포·조조·주유) + staged 배경 10장 생성.
- 05·06 원경 establishing 생성(출시 게이트 트랙 합류).
- 두루마리 선택지 UI(가상 분기 도입 시). 전투 손맛(회심 틴트·저체력) 별도 트랙.
