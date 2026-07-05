# 디에게틱 막간 스테이지 씬 Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 마퀴(★) 막간 씬을 painted 배경 위에 SD 유닛을 세우는 "디에게틱 스테이지"로 연출하되, 나머지 씬은 기존 VN 그대로 둔다.

**Architecture:** 씬 데이터에 optional `actors[]`를 추가하고, 라우트가 `scene.actors?.length`로 새 `StagedScenePlayer`(DOM/CSS 스프라이트 스테이지)와 기존 `ScenePlayer`(VN)를 분기한다. 공유 로직(진행 훅·프레젠테이션 조각)은 추출해 두 플레이어가 얇게 조립한다. Pixi 전투 렌더러는 쓰지 않는다.

**Tech Stack:** Next.js/React (apps/web), Zod 스키마(packages/data), Vitest 테스트.

**Spec:** docs/superpowers/specs/2026-07-05-diegetic-staged-scenes-design.md

---

## 실행 전 준비

- CLAUDE.md 원칙: main 직접 커밋 금지 → **먼저 브랜치**. 예: `git switch -c feat/diegetic-staged-scenes`.
- 테스트 러너 = **vitest**. 실행: `pnpm --filter @tk/data test`, `pnpm --filter @tk/web test`(web 패키지 name = `@tk/web`).
- **vitest 필터 주의(2가지):** ① web 테스트는 `apps/web/vitest.config.ts`의 `include: ["src/**/__tests__/**/*.test.ts"]`만 수집 — 테스트는 반드시 `src/**/__tests__/*.test.ts`에 둔다(다른 위치·`.tsx`는 조용히 스킵됨). ② `test <문자열>`은 **파일경로 부분일치** 필터(`schemas`→`schemas.test.ts`), 테스트명 아님.
- **테스트 정책(중요):** 이 저장소 web 테스트는 전부 *로직 유닛 테스트*(.test.ts)다. React 렌더 테스트 하니스(jsdom/RTL) 없음. 따라서:
  - **TDD 대상 = zod 스키마 + 순수 헬퍼**(actorStage.ts). 여기만 실패테스트→구현.
  - **React 컴포넌트**(ActorStage/StagedScenePlayer/추출 조각) = `pnpm typecheck` + 기존 씬 회귀 없음(수동) + 길중 눈. 프리뷰 MCP는 창 hidden→rAF 정지라 라이브 검증 불가(game-polish-backlog 기재).

## File Structure

| 파일 | 책임 | 신규/변경 |
|---|---|---|
| `packages/data/src/schemas.ts` | 데이터 계약 — `StageActorSchema`, `ScenarioScene.actors`, `ScenarioLine.{actor,enter,exit,emote}` | 변경 |
| `packages/data/test/schemas.test.ts` | 스키마 계약 테스트 | 변경 |
| `apps/web/src/scene/actorStage.ts` | 순수 헬퍼 — `actorSpriteCandidates`, `visibleActorIds` | 신규 |
| `apps/web/src/scene/__tests__/actorStage.test.ts` | 헬퍼 유닛 테스트 | 신규 |
| `apps/web/src/scene/useSceneProgression.ts` | 진행 상태 훅(ScenePlayer에서 추출) | 신규 |
| `apps/web/src/scene/parts/SceneBackground.tsx` | 배경 + 페이드 레이어 | 신규 |
| `apps/web/src/scene/parts/DialoguePanel.tsx` | 화자 초상 + 대사창 | 신규 |
| `apps/web/src/scene/parts/NarrationPanel.tsx` | 내레이션 중앙 박스 | 신규 |
| `apps/web/src/scene/parts/SkipBar.tsx` | 상단 타이틀 + 건너뛰기 | 신규 |
| `apps/web/src/scene/parts/tokens.ts` | 공유 색 상수(PARCHMENT/BRONZE_*/SIDE_COLOR) | 신규 |
| `apps/web/src/scene/ScenePlayer.tsx` | VN 플레이어(조각 재조립, 동작 보존) | 변경 |
| `apps/web/src/scene/ActorStage.tsx` | 배우 레이어 + 내부 `ActorSprite`(폴백 체인) | 신규 |
| `apps/web/src/scene/StagedScenePlayer.tsx` | 스테이지 플레이어(공유 + ActorStage) | 신규 |
| `apps/web/app/scene/page.tsx` | `scene.actors?.length`로 플레이어 분기 | 변경 |
| `packages/data/json/stages/01-zhuojun.json` | 마퀴 수직 완성 — 도원결의 배우 저작 | 변경 |

---

## Chunk 1: 데이터 계약 (스키마)

### Task 1: 씬 스키마에 배우 필드 추가

**Files:**
- Modify: `packages/data/src/schemas.ts` (ScenarioLineSchema ~520, ScenarioSceneSchema ~535 부근)
- Test: `packages/data/test/schemas.test.ts`

- [ ] **Step 1: 실패 테스트 작성** — `packages/data/test/schemas.test.ts`에 추가

```ts
import { ScenarioSceneSchema } from "../src/schemas";

describe("staged scene actors", () => {
  it("actors 배열과 line.actor/enter/exit/emote를 파싱한다", () => {
    const parsed = ScenarioSceneSchema.parse({
      bg: "peach-garden",
      actors: [
        { id: "liubei", sprite: "liubei", x: 40 },
        { id: "guanyu", sprite: "guanyu", x: 55, facing: "left", scale: 1.1 },
      ],
      lines: [
        { text: "복숭아밭에 셋이 모였다." },
        { speaker: "유비", portraitId: "유비", actor: "liubei", text: "우리 셋이…", emote: "..." },
        { speaker: "관우", actor: "guanyu", enter: ["guanyu"], text: "형님.", },
      ],
    });
    expect(parsed.actors).toHaveLength(2);
    expect(parsed.actors?.[1]?.facing).toBe("left");
    expect(parsed.lines[1]?.actor).toBe("liubei");
    expect(parsed.lines[2]?.enter).toEqual(["guanyu"]);
  });

  it("actors 없는 기존 VN 씬도 그대로 유효하다(하위호환)", () => {
    const parsed = ScenarioSceneSchema.parse({ bg: "x", lines: [{ text: "a" }] });
    expect(parsed.actors).toBeUndefined();
  });

  it("emote는 허용된 값만 받는다", () => {
    expect(() =>
      ScenarioSceneSchema.parse({ lines: [{ text: "a", emote: "wat" }] }),
    ).toThrow();
  });
});
```

- [ ] **Step 2: 실패 확인** — Run: `pnpm --filter @tk/data test schemas` → Expected: FAIL (`actors`/`emote` unknown 또는 stripped)

- [ ] **Step 3: 스키마 구현** — `packages/data/src/schemas.ts`

`ScenarioLineSchema`(현재 ~520)에 필드 추가:
```ts
export const ScenarioLineSchema = z.object({
  speaker: z.string().optional(),
  side: SideSchema.optional(),
  portraitId: z.string().optional(),
  text: z.string(),
  bg: z.string().optional(),
  // 스테이지 씬(§디에게틱) — 전부 선택, 하위호환. actors 없는 VN 씬엔 무의미.
  actor: z.string().optional(),          // 이 줄을 말하는 배우 id(스포트라이트). 미매칭/미등장=no-op.
  enter: z.array(z.string()).optional(), // 이 줄에서 등장하는 배우 id
  exit: z.array(z.string()).optional(),  // 이 줄에서 퇴장하는 배우 id
  emote: z.enum(["...", "!", "?"]).optional(), // 말하는 배우 위 말풍선 마크
});
```

`ScenarioSceneSchema`(현재 ~535) 위에 `StageActorSchema` 신설 + `actors` 추가:
```ts
/** 디에게틱 스테이지 배우(§막간 v3). sprite=/assets/sprites/{sprite}/ 폴더명 직접 저작(리졸버 우회). */
export const StageActorSchema = z.object({
  id: z.string(),                               // 씬 내 안정 참조
  sprite: z.string(),                           // 스프라이트 폴더명(영문 override 또는 한국어 commanderId)
  x: z.number(),                                // 0~100 가로 위치(%)
  y: z.number().optional(),                     // 0~100 바닥선(미지정=하단 1/3)
  facing: z.enum(["left", "right"]).optional(),
  scale: z.number().optional(),
});
export type StageActor = z.infer<typeof StageActorSchema>;

export const ScenarioSceneSchema = z.object({
  bg: z.string().optional(),
  actors: z.array(StageActorSchema).optional(), // 있으면 디에게틱 스테이지, 없으면 VN
  lines: z.array(ScenarioLineSchema).min(1),
});
```

- [ ] **Step 4: 통과 확인** — Run: `pnpm --filter @tk/data test schemas` → Expected: PASS. 그리고 `pnpm --filter @tk/data test`(전체) → 기존 스키마 테스트 회귀 없음.

- [ ] **Step 5: 커밋**
```bash
git add packages/data/src/schemas.ts packages/data/test/schemas.test.ts
git commit -m "feat(data): staged scene actor schema (actors[] + line.actor/enter/exit/emote)"
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

const a = (id: string, sprite = id): StageActor => ({ id, sprite, x: 50 });

describe("actorSpriteCandidates", () => {
  it("front 포즈 URL, 초상 URL 순서로 후보를 낸다(실루엣은 배열에 없음)", () => {
    const c = actorSpriteCandidates(a("liubei"));
    expect(c[0]).toContain("/assets/sprites/liubei/front_idle.png");
    expect(c[1]).toContain("/assets/ui/portraits/liubei.webp");
    expect(c).toHaveLength(2);
  });
});

describe("visibleActorIds", () => {
  const lines: ScenarioLine[] = [
    { text: "0" },
    { text: "1", enter: ["guanyu"] },
    { text: "2", exit: ["liubei"] },
    { text: "3", enter: ["liubei"] },
  ];
  const actors = [a("liubei"), a("zhangfei")]; // 기본 상주 = enter 없이 처음부터
  it("기본 상주 배우는 처음부터 보인다", () => {
    expect(visibleActorIds(lines, 0, actors)).toEqual(new Set(["liubei", "zhangfei"]));
  });
  it("enter는 그 줄부터 추가된다", () => {
    expect(visibleActorIds(lines, 1, actors)).toEqual(new Set(["liubei", "zhangfei", "guanyu"]));
  });
  it("exit는 그 줄부터 제거된다", () => {
    expect(visibleActorIds(lines, 2, actors).has("liubei")).toBe(false);
  });
  it("퇴장 후 재등장(enter)도 반영된다", () => {
    expect(visibleActorIds(lines, 3, actors).has("liubei")).toBe(true);
  });
});
```

- [ ] **Step 2: 실패 확인** — Run: `pnpm --filter @tk/web test actorStage` → Expected: FAIL (module not found).

- [ ] **Step 3: 구현** — `apps/web/src/scene/actorStage.ts`

```ts
/**
 * actorStage — 디에게틱 스테이지 씬 순수 헬퍼(§막간 v3). 렌더 없음(테스트 가능).
 * 배우 스프라이트는 sprite 폴더명을 직접 저작(spriteCandidates 리졸버 우회 — 마퀴 손저작).
 */
import type { StageActor, ScenarioLine } from "@tk/data";
import { assetUrl } from "../assetUrl";

/**
 * 배우 이미지 후보 URL — front 포즈 → 초상 순. ActorSprite가 onError로 순차 시도하고,
 * 둘 다 실패하면 CSS 실루엣(URL 아님)으로 폴백한다. 초상 폴백은 sprite 키에 초상이 있을 때만
 * 유효(마퀴 캐릭터는 포즈가 있어 대개 ①에서 끝남). 실루엣이 무붕괴 안전망.
 */
export function actorSpriteCandidates(actor: StageActor): string[] {
  return [
    assetUrl(`/assets/sprites/${actor.sprite}/front_idle.png`),
    assetUrl(`/assets/ui/portraits/${actor.sprite}.webp`),
  ];
}

/**
 * idx까지 enter/exit를 누적한 등장 배우 id 집합.
 * 규칙: actors[]는 기본 상주(처음부터 보임). line.enter는 그 줄부터 추가, line.exit는 그 줄부터 제거.
 * (재등장 지원 — exit 후 enter면 다시 보임.)
 */
export function visibleActorIds(
  lines: readonly ScenarioLine[],
  idx: number,
  actors: readonly StageActor[],
): Set<string> {
  const set = new Set(actors.map((a) => a.id)); // 기본 상주
  for (let i = 0; i <= Math.min(idx, lines.length - 1); i++) {
    const l = lines[i];
    if (!l) continue;
    l.exit?.forEach((id) => set.delete(id));
    l.enter?.forEach((id) => set.add(id));
  }
  return set;
}
```

> 참고: enter/exit 순서 — 같은 줄에서 exit 후 enter 적용(재등장 우선). 배열 순서 무관.

- [ ] **Step 4: 통과 확인** — Run: `pnpm --filter @tk/web test actorStage` → Expected: PASS.

- [ ] **Step 5: 커밋**
```bash
git add apps/web/src/scene/actorStage.ts apps/web/src/scene/__tests__/actorStage.test.ts
git commit -m "feat(scene): pure helpers for staged scene actors"
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
  // 연속 탭 가드: 같은 렌더 클릭 2발이 겹쳐도 범위 초과 안 하도록 클램프(현 ScenePlayer:40-42 주석 보존).
  const line = scene.lines[Math.min(idx, scene.lines.length - 1)]!;
  const { shown, done, reveal } = useTypewriter(line.text);

  const advance = () => {
    if (!done) { reveal(); return; }
    if (idx >= scene.lines.length - 1) { onComplete(); return; }
    setIdx((i) => Math.min(i + 1, scene.lines.length - 1));
  };

  // 현재 배경 = idx까지 마지막 bg 지정(없으면 씬 기본) — 현 ScenePlayer:63-67 보존.
  let currentBg = scene.bg;
  for (let i = 0; i <= idx; i++) { const b = scene.lines[i]?.bg; if (b) currentBg = b; }

  return { idx, line, shown, done, advance, currentBg, isNarration: !line.speaker };
}
```

- [ ] **Step 2: 확인** — Run: `pnpm --filter @tk/web typecheck` → Expected: 신규 파일 타입 OK(아직 미사용 경고 없음 — export만).

- [ ] **Step 3: 커밋**
```bash
git add apps/web/src/scene/useSceneProgression.ts
git commit -m "refactor(scene): extract useSceneProgression hook"
```

### Task 4: 프레젠테이션 조각 추출

**Files:**
- Create: `apps/web/src/scene/parts/SceneBackground.tsx`, `DialoguePanel.tsx`, `NarrationPanel.tsx`, `SkipBar.tsx`
- Reference: `ScenePlayer.tsx` 해당 JSX 블록(배경 88-95 / SkipBar 97-107 / Narration 110-133 / Dialogue 134-167)

- [ ] **Step 1: 4개 조각 작성** — 각 컴포넌트는 현 ScenePlayer의 해당 JSX/인라인스타일을 **그대로** 옮기고 props로 받는다. 색 상수(`PARCHMENT`/`BRONZE_GOLD`/`BRONZE_DIM`/`SIDE_COLOR`)는 조각들이 공유하므로 `parts/tokens.ts`로 함께 추출.

  - `SceneBackground({ bg, title })` — 현 88-95(AssetImage bg + 그라디언트 + 오프닝 페이드 + `<style>` 키프레임 `tkBgIn`/`tkSceneIn`).
  - `SkipBar({ title, onSkip })` — 현 97-107.
  - `NarrationPanel({ shown, done, idx, total })` — 현 110-133.
  - `DialoguePanel({ line, shown, done, idx, total })` — 현 134-167(초상 `portraitId`→AssetImage, side 색, 타자기).

  > 마크업/px/색/애니메이션 이름 변경 금지. 순수 이동 + props화.

- [ ] **Step 2: 확인** — Run: `pnpm --filter @tk/web typecheck` → Expected: OK.

- [ ] **Step 3: 커밋**
```bash
git add apps/web/src/scene/parts/
git commit -m "refactor(scene): extract SceneBackground/Dialogue/Narration/SkipBar parts"
```

### Task 5: ScenePlayer를 조각으로 재조립

**Files:**
- Modify: `apps/web/src/scene/ScenePlayer.tsx`

- [ ] **Step 1: 재조립** — ScenePlayer가 `useSceneProgression` + 4개 조각을 조립하도록 교체. 루트 `<div onClick={advance} ...>` + `SceneBackground` + `SkipBar` + (isNarration ? NarrationPanel : DialoguePanel). 인라인이던 상태/JSX는 훅·조각으로 대체. **최종 렌더 결과가 이전과 픽셀 동일**해야 함.

- [ ] **Step 2: 회귀 확인**
  - Run: `pnpm --filter @tk/web typecheck` → OK.
  - Run: `pnpm --filter @tk/web test` → 기존 씬 관련 테스트(있으면) 통과.
  - **수동**: `next dev` → `/scene?stage=01-zhuojun&type=intro` 진입해 기존 VN 인트로가 이전과 동일하게 재생(타자기·탭·건너뛰기·내레이션·배경 전환)되는지 길중 확인.

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

- [ ] **Step 1: 구현** — DOM/CSS 레이어. Pixi 없음. 핵심 요소:

  - **`ActorSprite`(내부 컴포넌트) — 폴백 체인 소유**(AssetImage 미사용):
    ```tsx
    function ActorSprite({ actor, speaking }: { actor: StageActor; speaking: boolean }) {
      const candidates = actorSpriteCandidates(actor); // [front, portrait]
      const [ci, setCi] = useState(0);
      const failed = ci >= candidates.length;
      // failed면 CSS 실루엣(어두운 라운드 박스 + 이니셜) 렌더.
      // 아니면 <img src={candidates[ci]} onError={() => setCi(i => i + 1)} .../>
      // facing=left면 transform: scaleX(-1). speaking이면 brightness↑+scale~1.05+bob, 아니면 디밍.
    }
    ```
    > onError로 ci 증가 → 다음 후보. 다 소진(failed)하면 실루엣. `<img>`엔 `alt=actor.id`.

  - **`ActorStage({ actors, visibleIds, speakingId, emote })`**:
    - 각 배우 절대배치: `left: {x}%`, `bottom` = `y`(미지정=하단 1/3 기준). z-index = y 오름차순, 동률은 `actors[]` 배열 순서.
    - 발밑 그림자 타원(배우당, 발=바닥선 고정, scale 무관).
    - `visibleIds`에 없는 배우는 렌더 안 함(또는 페이드아웃 — enter/exit CSS transition).
    - `speakingId===actor.id`면 speaking=true 전달 + `emote` 말풍선을 그 배우 위에 표시.
    - `speakingId`가 visible에 없으면 아무도 강조 안 함(no-op — 크래시 금지).

  - `<style>`에 bob 키프레임(예: `@keyframes tkActorBob { 50% { transform: translateY(-4px) } }`) — 이름 충돌 피해 `tkActor*` 프리픽스.

- [ ] **Step 2: 확인** — Run: `pnpm --filter @tk/web typecheck` → OK.

- [ ] **Step 3: 커밋**
```bash
git add apps/web/src/scene/ActorStage.tsx
git commit -m "feat(scene): ActorStage + ActorSprite (fallback chain, spotlight, shadows)"
```

### Task 7: StagedScenePlayer

**Files:**
- Create: `apps/web/src/scene/StagedScenePlayer.tsx`

- [ ] **Step 1: 구현** — `ScenePlayer`와 동일 props(`{ scene, title, onComplete }`). `useSceneProgression`으로 진행, 레이어 순서 = `SceneBackground` → `ActorStage` → SkipBar → (isNarration ? NarrationPanel : DialoguePanel). 루트 `<div onClick={advance}>`.
  - `ActorStage` props: `actors={scene.actors!}`, `visibleIds={visibleActorIds(scene.lines, idx, scene.actors!)}`, `speakingId={line.actor}`, `emote={line.emote}`.
  - 배경/대사창은 VN과 동일 조각 재사용(디에게틱은 그 사이에 배우 레이어만 낌).

- [ ] **Step 2: 확인** — Run: `pnpm --filter @tk/web typecheck` → OK.

- [ ] **Step 3: 커밋**
```bash
git add apps/web/src/scene/StagedScenePlayer.tsx
git commit -m "feat(scene): StagedScenePlayer composing shared parts + ActorStage"
```

### Task 8: 라우트 분기

**Files:**
- Modify: `apps/web/app/scene/page.tsx:47-52`

- [ ] **Step 1: 분기 한 줄** — `ScenePlayer` 렌더를 조건 분기로 교체:
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

- [ ] **Step 2: 회귀 확인** — Run: `pnpm --filter @tk/web typecheck` → OK. 수동: actors 없는 기존 씬은 여전히 VN 경로(01 인트로가 현 상태 그대로 — Task 9 전).

- [ ] **Step 3: 커밋**
```bash
git add apps/web/app/scene/page.tsx
git commit -m "feat(scene): route picks StagedScenePlayer when scene has actors"
```

---

## Chunk 5: 수직 완성 (01 도원결의)

### Task 9: 01 탁군 인트로에 배우 저작

**Files:**
- Modify: `packages/data/json/stages/01-zhuojun.json` (`scenario.intro`)

현 상태: intro 8줄, `bg: "01-zhuojun-intro"`, 화자 한국어(`장비` 등), portraitId 한국어. 삼형제 스프라이트 폴더 = `liubei`/`guanyu`/`zhangfei`(front_idle.png 존재 — 폴백 안 탐).

- [ ] **Step 1: actors 추가 + line.actor 배선** — `scenario.intro`에:
  ```json
  "actors": [
    { "id": "liubei",  "sprite": "liubei",  "x": 42 },
    { "id": "guanyu",  "sprite": "guanyu",  "x": 30, "facing": "right" },
    { "id": "zhangfei","sprite": "zhangfei","x": 58, "facing": "left" }
  ]
  ```
  각 대사 줄에 말하는 배우 `actor`(유비 줄→`"actor":"liubei"` 등) + 등장/감정 비트에 `enter`/`emote`(예: 의병 급보 줄은 배우 없음=무대 셋만, 장비 첫 대사 `"emote":"!"`). 내레이션 줄(0·1)은 actor 없음(무대만 보임).
  - ⚠ 스키마 변경(Task 1)이 데이터 로드에 반영되려면 `@tk/data` 빌드/타입 최신화 — `pnpm --filter @tk/data test` 재실행으로 파싱 확인.

- [ ] **Step 2: 파싱 확인** — Run: `pnpm --filter @tk/data test`(stages 로드/검증 테스트가 새 필드로도 통과). Expected: PASS.

- [ ] **Step 3: 수동 검증(길중)** — `next dev` → `/scene?stage=01-zhuojun&type=intro`:
  - 삼형제 SD 유닛이 painted 배경 위에 섬(폴백 아님 — front 포즈).
  - 말하는 형제가 강조(밝기·bob·말풍선), 나머지 디밍.
  - 타자기·탭·건너뛰기·배경 전환이 VN과 동일하게 동작.
  - 기존 다른 스테이지 인트로(actors 없음)는 여전히 VN.

- [ ] **Step 4: 커밋**
```bash
git add packages/data/json/stages/01-zhuojun.json
git commit -m "feat(content): stage 01 도원결의 as diegetic staged scene (vertical slice)"
```

---

## 완료 기준

- Chunk 1·2 = 초록 테스트(스키마·헬퍼). Chunk 3~5 = typecheck 통과 + 기존 VN 씬 회귀 없음 + 01 도원결의 디에게틱 렌더(길중 눈).
- 나머지 마퀴 10개(스펙 표)는 **후속** — 01 손맛 확인 후 같은 저작 패턴(Task 9)만 반복. 코드 변경 없음.
- 문서 갱신: 완료 후 CLAUDE.md §5·memory(game-polish-backlog·competitor 분석) 반영은 "업데이트 하자" 워크플로우로.

## 후속(이 플랜 밖)
- 마퀴 나머지 저작(06·14·17·18·20·21·22·26·27) + 각 씬 painted 배경 생성(출시 게이트 트랙).
- 두루마리 선택지 UI(가상 분기 도입 시). 전투 손맛(회심 틴트·저체력) 별도 트랙.
