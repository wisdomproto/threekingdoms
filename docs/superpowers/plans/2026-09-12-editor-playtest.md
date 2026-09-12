# 에디터 Playtest 왕복 — Implementation Plan

> **상태: 완료 (2026-09-12)** — 실브라우저 E2E는 `tools/editor/e2e/playtest.mjs`(13건 PASS)로 자동화.

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `tools/stage-editor.html`의 ▶ 이 스테이지 테스트 한 번으로 지금 편집 중인(미저장 포함) 스테이지+맵이 새 탭의 전투로 뜨고, 전투를 끝내거나 나가면 에디터 탭으로 돌아온다. 테스트 전투는 레포 파일·R2·메타를 바꾸지 않는다.

**Architecture:** 에디터(serve.py)와 게임(Next)은 origin이 달라 `sessionStorage`를 공유할 수 없으므로, 에디터가 **불변 Playtest 스냅샷**을 `POST /playtest-draft`로 `apps/web/public/_draft/{draftId}.json`에 쓰고, 게임의 `/playtest?draft=` 착륙 페이지가 그 파일을 같은 origin에서 읽어 zod 검증 후 기존 `__lab` 경로(`writeLab` → `/battle?stage=__lab`)로 넘긴다. sandbox 판정은 스테이지 id 비교 대신 `makeCtx`의 `__lab` 분기 플래그로 바꾸고, 종료 3지점은 `leaveSandbox()`로 에디터 탭에 복귀(`window.close()`, 실패 시 URL 이동 폴백).

**Tech Stack:** Next 15 app router(클라이언트 컴포넌트) · `@tk/data` zod 스키마 · vitest(`apps/web`, `environment: node`, `src/**/__tests__/**/*.test.ts`) · Python `http.server`(`tools/serve.py`) · 브라우저 ESM 에디터.

**Spec:** `docs/superpowers/specs/2026-09-12-editor-playtest-design.md`

**작업 위치:** 메인 체크아웃 `C:\projects\threekingdoms`, 브랜치 `feat/editor-playtest`(main에서 분기). 커밋 트레일러 `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`. 커밋 전 `pnpm --filter @tk/web test && pnpm --filter @tk/web typecheck` green. 포트 8081은 다른 인스턴스가 쓸 수 있으니 검증용 serve.py는 **8090+**, next dev는 **3000**(이미 떠 있으면 재사용).

---

## File Structure

| 파일 | 책임 |
|---|---|
| `apps/web/src/lab/lab.ts` (수정) | `LabPayload.returnUrl?`; 순수 `exitTarget(payload, hasOpener)`; 부수효과 `leaveSandbox(navigate, payload?)` |
| `apps/web/src/lab/playtest.ts` (신규) | `PLAYTEST_KIND/VERSION`, `PlaytestSnapshot` 타입, 순수 `parsePlaytestSnapshot(json)` (zod safeParse → `LabPayload`) |
| `apps/web/src/lab/__tests__/playtest.test.ts` (신규) | `exitTarget`·`parsePlaytestSnapshot` 단위 테스트(node) |
| `apps/web/src/lab/PlaytestLanding.tsx` (신규) | 착륙 클라이언트 컴포넌트: `?draft=` fetch → parse → `writeLab` → `router.replace` / 실패 메시지 + 「닫기」 |
| `apps/web/app/playtest/page.tsx` (신규) | `dynamic(ssr:false)`로 `PlaytestLanding` 마운트(`app/lab/page.tsx`와 동형) |
| `apps/web/src/battle/BattleScreen.tsx` (수정) | `makeCtx` → `sandbox` 플래그 반환·`Session`에 보관; 476~477·529행이 플래그 사용 |
| `apps/web/src/battle/hud/PauseMenu.tsx` (수정) | `sandbox?: boolean` prop — true면 「나가기」가 `leaveSandbox((to) => router.push(to))` |
| `apps/web/src/battle/hud/ResultSequence.tsx` (수정) | 481·958행 sandbox 종료 → `leaveSandbox(fadeTo)`; 라벨 "에디터로 ▶"(returnUrl 있을 때, `useMemo`) |
| `tools/serve.py` (수정) | `POST /playtest-draft` |
| `.gitignore` (수정) | `apps/web/public/_draft/` |
| `tools/stage-editor.html` (수정) | `GAME_ORIGIN`, `#playtestBtn` + 핸들러 |
| `tools/CLAUDE.md`, `apps/web/CLAUDE.md` (수정) | 한 줄씩 |

> 스펙 §3은 PauseMenu에 `onExit` prop을 적었으나, `useRouter`가 PauseMenu 안에 있어 `sandbox?: boolean` prop으로 구현한다(BattleScreen은 router를 갖지 않는다). 스펙에 같은 문구로 정정해 둔다.

---

## Chunk 1: 순수 로직 + 테스트

### Task 1: `exitTarget` / `leaveSandbox` (lab.ts)

**Files:** Modify `apps/web/src/lab/lab.ts`; Create `apps/web/src/lab/__tests__/playtest.test.ts`

- [ ] **Step 1: 실패하는 테스트 작성** — `apps/web/src/lab/__tests__/playtest.test.ts`

```ts
import { describe, it, expect } from "vitest";
import { exitTarget } from "../lab";

describe("exitTarget — 실험실/플레이테스트 종료 목적지 (spec §6)", () => {
  it("returnUrl 없음 → /lab (현행 실험실 동작)", () => {
    expect(exitTarget(null, true)).toEqual({ kind: "navigate", to: "/lab" });
    expect(exitTarget({}, false)).toEqual({ kind: "navigate", to: "/lab" });
  });
  it("returnUrl 있음 + opener 있음 → close (에디터가 연 탭)", () => {
    expect(exitTarget({ returnUrl: "http://localhost:8082/tools/stage-editor.html" }, true)).toEqual({ kind: "close" });
  });
  it("returnUrl 있음 + opener 없음 → returnUrl 로 이동 (탭을 직접 열었거나 복사한 경우)", () => {
    expect(exitTarget({ returnUrl: "http://x/editor" }, false)).toEqual({ kind: "navigate", to: "http://x/editor" });
  });
});
```

- [ ] **Step 2: 실패 확인** — `pnpm --filter @tk/web test playtest` → FAIL (`exitTarget` is not exported)

- [ ] **Step 3: 구현** — `apps/web/src/lab/lab.ts`

`LabPayload`에 필드 추가:
```ts
export interface LabPayload {
  stage: Stage;
  map: BattleMap;
  /** friendly 공유 소모품 풀(원작 창고 §7) — 전투 「도구」 테스트용. */
  sharedItems: string[];
  /** 전투 시드(시드확률 재현 테스트 — 같은 시드+행동열=같은 롤). */
  seed: number;
  /** 에디터 플레이테스트(`/playtest`)가 연 전투일 때 에디터 탭 URL. 없으면 실험실 전투 → 종료 시 /lab. */
  returnUrl?: string;
}
```
파일 끝에 추가:
```ts
export type ExitTarget = { kind: "close" } | { kind: "navigate"; to: string };

/**
 * 실험실/플레이테스트 전투의 종료 목적지 (순수). returnUrl 이 있으면 에디터가 연 탭이므로
 * opener 가 살아 있을 때 닫아서 복귀하고, 없으면(탭 복사·새로고침) 그 URL 로 이동한다.
 */
export function exitTarget(
  payload: Pick<LabPayload, "returnUrl"> | null | undefined,
  hasOpener: boolean,
): ExitTarget {
  const returnUrl = payload?.returnUrl;
  if (!returnUrl) return { kind: "navigate", to: "/lab" };
  return hasOpener ? { kind: "close" } : { kind: "navigate", to: returnUrl };
}

/**
 * 종료 실행 — 3지점(일시정지 나가기·승리 결산·패배 결산)과 착륙 페이지 「닫기」가 공유하는 유일한 부수효과 seam.
 * close 는 브라우저가 조용히 거부할 수 있어 100ms 뒤 닫히지 않았으면 returnUrl 로 이동한다.
 */
export function leaveSandbox(
  navigate: (to: string) => void,
  payload: Pick<LabPayload, "returnUrl"> | null = readLab(),
): void {
  const hasOpener = typeof window !== "undefined" && window.opener != null;
  const target = exitTarget(payload, hasOpener);
  if (target.kind === "navigate") { navigate(target.to); return; }
  window.close();
  window.setTimeout(() => {
    if (!window.closed && payload?.returnUrl) navigate(payload.returnUrl);
  }, 100);
}
```
(`readLab`은 이미 `returnUrl`을 통과시킨다 — 4개 필드만 검사하고 `p as LabPayload` 캐스트. 변경 없음.)

- [ ] **Step 4: 통과 확인** — `pnpm --filter @tk/web test playtest` → 3 passed
- [ ] **Step 5: 커밋**
```bash
git add apps/web/src/lab/lab.ts apps/web/src/lab/__tests__/playtest.test.ts
git commit -m "feat(lab): exitTarget/leaveSandbox — playtest return to editor tab, /lab fallback

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

### Task 2: `parsePlaytestSnapshot` (playtest.ts)

**Files:** Create `apps/web/src/lab/playtest.ts`; Modify `apps/web/src/lab/__tests__/playtest.test.ts`

- [ ] **Step 1: 테스트 추가** (같은 파일 끝에)

```ts
import { gameData } from "@tk/data";
import { parsePlaytestSnapshot, PLAYTEST_KIND, PLAYTEST_VERSION } from "../playtest";

describe("parsePlaytestSnapshot — 드래프트 파일 → LabPayload (spec §4·§7)", () => {
  const snap = () => ({
    kind: PLAYTEST_KIND, version: PLAYTEST_VERSION,
    draftId: "05-sishuiguan-1", revision: 1,
    stage: structuredClone(gameData.stages["05-sishuiguan"]!),
    map: structuredClone(gameData.maps["sishuiguan"]!),
    seed: 1, returnUrl: "http://localhost:8082/tools/stage-editor.html", savedAt: "2026-09-12T00:00:00Z",
  });
  it("유효 스냅샷 → ok + LabPayload (sharedItems [], seed, returnUrl 전달)", () => {
    const r = parsePlaytestSnapshot(snap());
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.payload.stage.id).toBe("05-sishuiguan");
    expect(r.payload.map.id).toBe("sishuiguan");
    expect(r.payload.sharedItems).toEqual([]);
    expect(r.payload.seed).toBe(1);
    expect(r.payload.returnUrl).toBe("http://localhost:8082/tools/stage-editor.html");
  });
  it("kind 불일치 → ok:false 안내", () => {
    const r = parsePlaytestSnapshot({ ...snap(), kind: "something-else" });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.message).toContain("형식");
  });
  it("zod 실패(turnLimit 삭제) → ok:false 메시지에 경로 포함", () => {
    const s = snap();
    delete (s.stage as Record<string, unknown>).turnLimit;
    const r = parsePlaytestSnapshot(s);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.message).toContain("turnLimit");
  });
  it("returnUrl 없으면 payload 에 키가 없다 (실험실과 동일하게 /lab 복귀)", () => {
    const { returnUrl: _omit, ...rest } = snap();
    const r = parsePlaytestSnapshot(rest);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect("returnUrl" in r.payload).toBe(false);
  });
  it("객체가 아니면 ok:false", () => {
    expect(parsePlaytestSnapshot(null).ok).toBe(false);
    expect(parsePlaytestSnapshot("x").ok).toBe(false);
  });
});
```

- [ ] **Step 2: 실패 확인** — `pnpm --filter @tk/web test playtest` → FAIL (`../playtest` 없음)

- [ ] **Step 3: 구현** — `apps/web/src/lab/playtest.ts`

```ts
/**
 * 에디터 플레이테스트 스냅샷(spec 2026-09-12-editor-playtest-design §4) → LabPayload.
 * 서버 드래프트 파일 `/_draft/{draftId}.json` 의 내용을 검증한다. DOM·Next 무관(순수) — node 테스트 대상.
 * 스테이지/맵은 zod 로 검증해 "실행 최소 조건" 을 실제로 검사한다(첫 이슈의 경로·메시지를 돌려준다).
 */
import { StageSchema, BattleMapSchema } from "@tk/data";
import type { LabPayload } from "./lab";

export const PLAYTEST_KIND = "tk-playtest-snapshot";
export const PLAYTEST_VERSION = 1;

export interface PlaytestSnapshot {
  kind: typeof PLAYTEST_KIND;
  version: typeof PLAYTEST_VERSION;
  draftId: string;
  revision: number;
  stage: unknown;
  map: unknown;
  seed: number;
  returnUrl?: string;
  savedAt: string;
}

export type PlaytestParseResult =
  | { ok: true; payload: LabPayload }
  | { ok: false; message: string };

function firstIssue(error: { issues: Array<{ path: PropertyKey[]; message: string }> }): string {
  const i = error.issues[0];
  return i ? `${i.path.map(String).join(".") || "(root)"}: ${i.message}` : "알 수 없는 검증 오류";
}

export function parsePlaytestSnapshot(json: unknown): PlaytestParseResult {
  if (!json || typeof json !== "object") return { ok: false, message: "드래프트가 JSON 객체가 아닙니다" };
  const s = json as Partial<PlaytestSnapshot>;
  if (s.kind !== PLAYTEST_KIND || s.version !== PLAYTEST_VERSION) {
    return { ok: false, message: `드래프트 형식이 다릅니다 (kind=${String(s.kind)}, version=${String(s.version)}) — 에디터에서 ▶ 테스트를 다시 누르세요` };
  }
  const stage = StageSchema.safeParse(s.stage);
  if (!stage.success) return { ok: false, message: `스테이지 검증 실패 — ${firstIssue(stage.error)}` };
  const map = BattleMapSchema.safeParse(s.map);
  if (!map.success) return { ok: false, message: `맵 검증 실패 — ${firstIssue(map.error)}` };
  const seed = typeof s.seed === "number" && Number.isFinite(s.seed) ? s.seed : 1;
  const payload: LabPayload = { stage: stage.data, map: map.data, sharedItems: [], seed };
  if (typeof s.returnUrl === "string" && s.returnUrl) payload.returnUrl = s.returnUrl;
  return { ok: true, payload };
}
```

- [ ] **Step 4: 통과 확인** — `pnpm --filter @tk/web test playtest` → 8 passed; `pnpm --filter @tk/web typecheck` → Done (zod `issues[].path` 타입이 `PropertyKey[]`가 아니면 `(string | number)[]`로 맞춘다 — 설치된 zod 버전 기준 typecheck 가 결정).
- [ ] **Step 5: 커밋**
```bash
git add apps/web/src/lab/playtest.ts apps/web/src/lab/__tests__/playtest.test.ts
git commit -m "feat(lab): parsePlaytestSnapshot — zod-validated draft → LabPayload

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

## Chunk 2: 게임 쪽 배선

### Task 3: sandbox 플래그 + 종료 3지점

**Files:** Modify `apps/web/src/battle/BattleScreen.tsx`, `apps/web/src/battle/hud/PauseMenu.tsx`, `apps/web/src/battle/hud/ResultSequence.tsx`

- [ ] **Step 1: BattleScreen — `makeCtx`가 sandbox 플래그를 반환**

`makeCtx` 시그니처와 3개 return 을 바꾼다:
```ts
function makeCtx(): { ctx: BattleContext; sharedItems: string[]; seed?: number; sandbox: boolean } {
  if (typeof window !== "undefined" &&
      new URLSearchParams(window.location.search).get("stage") === LAB_STAGE_ID) {
    const lab = readLab();
    if (lab) {
      // 실험실·플레이테스트: 결산 sandbox(메타 불가침)·종료 복귀는 이 플래그가 결정한다 — 스테이지 id 비교 금지
      // (플레이테스트 스냅샷은 실제 스테이지 id 를 유지한다).
      return { ctx: { data: gameData, stage: lab.stage, map: lab.map }, sharedItems: lab.sharedItems, seed: lab.seed, sandbox: true };
    }
  }
  …
    return { ctx: { data: { ...gameData, commanders: scaledCommanders }, stage, map }, sharedItems, sandbox: false };
  }
  return { ctx: { data: gameData, stage, map }, sharedItems, sandbox: false };
}
```
`Session`에 `sandbox: boolean` 추가, `createSession`에서 `const { ctx, sharedItems, seed, sandbox } = makeCtx();` 로 받아 세션에 넣는다. 컴포넌트에서 `ctx`를 꺼내는 곳(세션 destructure)에 `sandbox`도 함께 꺼낸다.

476~477행:
```tsx
          stageId={sandbox ? undefined : ctx.stage.id}
          sandbox={sandbox}
```
529행:
```tsx
      <PauseMenu open={paused} onClose={() => setPaused(false)} sandbox={sandbox} />
```
`LAB_STAGE_ID` import 는 makeCtx 에서 계속 쓰이므로 유지.

- [ ] **Step 2: PauseMenu — `sandbox` prop**

```tsx
import { leaveSandbox } from "../../lab/lab";
…
export function PauseMenu({
  open,
  onClose,
  exitTo = "/stages",
  sandbox = false,
}: {
  open: boolean;
  onClose: () => void;
  /** 「나가기」 목적지 — 기본 전장 선택. */
  exitTo?: string;
  /** 실험실/플레이테스트 전투: 「나가기」가 leaveSandbox(에디터 탭 복귀 또는 /lab) 로 간다. */
  sandbox?: boolean;
}): React.ReactElement | null {
```
「나가기」 onClick:
```tsx
onClick={() => (sandbox ? leaveSandbox((to) => router.push(to)) : router.push(exitTo))}
```
기존 주석 "실험실(__lab) 전투는 /lab 복귀"는 위 문구로 교체.

- [ ] **Step 3: ResultSequence — 종료 2지점 + 라벨**

import 추가: `import { leaveSandbox, readLab } from "../../lab/lab";`
컴포넌트 안(`summary` useMemo 근처):
```ts
  // 플레이테스트(에디터가 연 탭)면 "에디터로", 실험실이면 "실험실로". 렌더마다 sessionStorage 를 읽지 않게 1회.
  const sandboxLabel = useMemo(() => (readLab()?.returnUrl ? "에디터로 ▶" : "실험실로 ▶"), []);
```
481행 버튼:
```tsx
onClick={() => (sandbox ? leaveSandbox(fadeTo) : fadeTo(stageId ? `/scene?stage=${stageId}&type=outroDefeat` : "/stages"))}
…
{sandbox ? sandboxLabel : "이야기 계속 ▶"}
```
958행 버튼:
```tsx
onClick={() => (sandbox ? leaveSandbox(fadeTo) : fadeTo(stageId ? `/scene?stage=${stageId}&type=outro` : "/stages"))}
…
{sandbox ? sandboxLabel : "다음으로 ▶"}
```
(`fadeTo`의 타입이 `(href: string) => void` 인지 확인 — `useFadeNav` 참조. 다르면 `(to) => fadeTo(to)` 로 감싼다.)

- [ ] **Step 4: 게이트** — `pnpm --filter @tk/web test && pnpm --filter @tk/web typecheck` → 전부 green.
- [ ] **Step 5: 실험실 무회귀 수동 확인** — next dev(:3000) 에서 `/lab` → 「전투 시작」 → 일시정지 「나가기」 → `/lab`으로 돌아오는지; 결산 버튼 라벨이 "실험실로 ▶"인지(브라우저 도구로 확인).
- [ ] **Step 6: 커밋**
```bash
git add apps/web/src/battle/BattleScreen.tsx apps/web/src/battle/hud/PauseMenu.tsx apps/web/src/battle/hud/ResultSequence.tsx
git commit -m "feat(battle): sandbox flag from makeCtx (not stage id); lab/playtest exits via leaveSandbox

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

### Task 4: `/playtest` 착륙 페이지

**Files:** Create `apps/web/src/lab/PlaytestLanding.tsx`, `apps/web/app/playtest/page.tsx`

- [ ] **Step 1: 컴포넌트** — `apps/web/src/lab/PlaytestLanding.tsx`

```tsx
"use client";
/**
 * /playtest?draft={draftId} — 에디터 플레이테스트 착륙 페이지 (spec 2026-09-12-editor-playtest-design §5-4·§7).
 * 같은 origin 의 /_draft/{draftId}.json(serve.py 가 쓴 불변 스냅샷)을 읽어 검증하고, 기존 실험실 경로
 * (writeLab → /battle?stage=__lab)로 넘긴다. 실패하면 메시지 + 「닫기」(에디터 탭 복귀).
 */
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { writeLab, leaveSandbox, LAB_STAGE_ID } from "./lab";
import { parsePlaytestSnapshot } from "./playtest";

export default function PlaytestLanding(): React.ReactElement {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [returnUrl, setReturnUrl] = useState<string | undefined>(undefined);

  useEffect(() => {
    let alive = true;
    const draftId = new URLSearchParams(window.location.search).get("draft");
    if (!draftId) { setMessage("draft 파라미터가 없습니다 — 에디터에서 ▶ 테스트를 누르세요"); return; }
    (async () => {
      try {
        const res = await fetch(`/_draft/${encodeURIComponent(draftId)}.json`, { cache: "no-store" });
        if (!res.ok) { if (alive) setMessage("드래프트가 없습니다 — 에디터에서 ▶ 테스트를 다시 누르세요"); return; }
        const json: unknown = await res.json();
        const ru = json && typeof json === "object" ? (json as { returnUrl?: unknown }).returnUrl : undefined;
        if (alive && typeof ru === "string") setReturnUrl(ru);
        const parsed = parsePlaytestSnapshot(json);
        if (!parsed.ok) { if (alive) setMessage(parsed.message); return; }
        writeLab(parsed.payload);
        router.replace(`/battle?stage=${LAB_STAGE_ID}`);
      } catch (e) {
        if (alive) setMessage(`드래프트를 읽지 못했습니다: ${String(e)}`);
      }
    })();
    return () => { alive = false; };
  }, [router]);

  const close = (): void => {
    if (returnUrl) { leaveSandbox((to) => router.push(to), { returnUrl }); return; }
    window.close();
    window.setTimeout(() => { if (!window.closed) setMessage((m) => `${m ?? ""} — 이 탭을 직접 닫아주세요`); }, 100);
  };

  return (
    <main style={{ padding: 24, color: "#9aa3ad", fontFamily: "system-ui, sans-serif" }}>
      {message ? (
        <>
          <p style={{ color: "#e7b4ac", whiteSpace: "pre-wrap" }}>{message}</p>
          <button type="button" onClick={close} style={{ padding: "8px 14px" }}>닫기</button>
        </>
      ) : (
        <p>플레이테스트 준비 중…</p>
      )}
    </main>
  );
}
```

- [ ] **Step 2: 라우트** — `apps/web/app/playtest/page.tsx` (`app/lab/page.tsx` 와 동형)

```tsx
"use client";
/** /playtest 라우트 — 에디터 플레이테스트 착륙. gameData 로드가 클라이언트 전용이라 /lab 과 같이 ssr:false. */
import dynamic from "next/dynamic";

const PlaytestLanding = dynamic(() => import("../../src/lab/PlaytestLanding"), {
  ssr: false,
  loading: () => (
    <main style={{ padding: 24, color: "#9aa3ad" }}>
      <p>플레이테스트 준비 중…</p>
    </main>
  ),
});

export default function PlaytestPage(): React.ReactElement {
  return <PlaytestLanding />;
}
```

- [ ] **Step 3: 게이트** — `pnpm --filter @tk/web typecheck` Done; `pnpm --filter @tk/web build` 가 `/playtest` 라우트를 목록에 포함(○ Static).
- [ ] **Step 4: 수동 확인** — next dev 에서 `/playtest`(파라미터 없음) → 안내 문구 + 「닫기」; `/playtest?draft=nope` → "드래프트가 없습니다".
- [ ] **Step 5: 커밋**
```bash
git add apps/web/src/lab/PlaytestLanding.tsx apps/web/app/playtest/page.tsx
git commit -m "feat(web): /playtest landing — draft snapshot → zod → lab payload → battle

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

## Chunk 3: 서버·에디터·E2E

### Task 5: serve.py `POST /playtest-draft` + gitignore

**Files:** Modify `tools/serve.py`, `.gitignore`

- [ ] **Step 1: 헬퍼** (모듈 레벨, `_validate_data` 아래)

```python
_DRAFT_DIR = os.path.join(PUBLIC, "_draft")          # next dev 가 /_draft/{id}.json 으로 서빙 (gitignore, R2 무관)
_DRAFT_ID_RE = re.compile(r"^[A-Za-z0-9_-]+$")
_DRAFT_MAX_BYTES = 5 * 1024 * 1024


def _save_playtest_draft(payload):
    """에디터 플레이테스트 스냅샷(spec 2026-09-12-editor-playtest-design §4·§5-2)을 원자적으로 저장한다.
    반환 (http_code, body). 검증 실패 400, 쓰기 실패는 호출측에서 500."""
    draft_id = payload.get("draftId")
    if not isinstance(draft_id, str) or not _DRAFT_ID_RE.match(draft_id):
        return 400, {"ok": False, "error": "draftId 형식 오류 ([A-Za-z0-9_-]+)"}
    if payload.get("kind") != "tk-playtest-snapshot":
        return 400, {"ok": False, "error": "kind 가 tk-playtest-snapshot 이 아님"}
    if not isinstance(payload.get("stage"), dict) or not isinstance(payload.get("map"), dict):
        return 400, {"ok": False, "error": "stage/map 누락"}
    os.makedirs(_DRAFT_DIR, exist_ok=True)
    dest = os.path.join(_DRAFT_DIR, draft_id + ".json")
    tmp = dest + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False)
    os.replace(tmp, dest)
    sys.stdout.write(f"[playtest-draft] {draft_id}.json 저장\n")
    return 200, {"ok": True, "draftId": draft_id, "url": f"/_draft/{draft_id}.json"}
```

- [ ] **Step 2: 라우팅** — 허용 튜플에 `"/playtest-draft"` 추가; `/validate-data` 분기 바로 아래(공용 payload 파싱 **전**)에:

```python
        if endpoint == "/playtest-draft":
            length = int(self.headers.get("Content-Length", 0) or 0)
            if length > _DRAFT_MAX_BYTES:
                self._json(400, {"ok": False, "error": f"드래프트가 너무 큼 ({length} bytes > 5MB)"})
                return
            try:
                payload = json.loads(self.rfile.read(length).decode("utf-8")) if length else {}
            except Exception as e:  # noqa: BLE001
                self._json(400, {"ok": False, "error": f"잘못된 요청: {e}"})
                return
            try:
                code, body = _save_playtest_draft(payload)
            except OSError as e:
                code, body = 500, {"ok": False, "error": f"드래프트 쓰기 실패: {e}"}
            self._json(code, body)
            return
```

- [ ] **Step 3: gitignore** — `.gitignore` 끝에:
```
# 에디터 플레이테스트 스냅샷(dev 전용, serve.py POST /playtest-draft 가 씀) — 레포·R2 무관
apps/web/public/_draft/
```

- [ ] **Step 4: 확인** — `python -m py_compile tools/serve.py`; `python tools/serve.py 8091`(백그라운드) 후:
  - `curl -s -X POST localhost:8091/playtest-draft -H "Content-Type: application/json" -d "{\"kind\":\"tk-playtest-snapshot\",\"version\":1,\"draftId\":\"t-1\",\"revision\":1,\"stage\":{},\"map\":{},\"seed\":1,\"returnUrl\":\"x\",\"savedAt\":\"s\"}"` → `{"ok": true, "draftId": "t-1", "url": "/_draft/t-1.json"}`, 파일 `apps/web/public/_draft/t-1.json` 생성, `git status` 에 안 뜸.
  - `draftId` 를 `"../x"` 로 → 400 `draftId 형식 오류`. `kind` 다르면 400.
  - 서버 종료, `t-1.json` 삭제.
- [ ] **Step 5: 커밋**
```bash
git add tools/serve.py .gitignore
git commit -m "feat(serve): POST /playtest-draft writes an immutable playtest snapshot under public/_draft

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

### Task 6: 에디터 ▶ 버튼 + E2E + 문서

**Files:** Modify `tools/stage-editor.html`, `tools/CLAUDE.md`, `apps/web/CLAUDE.md`, `docs/superpowers/specs/2026-09-12-editor-playtest-design.md`(PauseMenu 문구 1줄)

- [ ] **Step 1: 상수** — 모듈 스크립트 import 문 바로 아래:
```js
const GAME_ORIGIN = 'http://localhost:3000'; // next dev. 보드의 「🎮 게임 열기」와 같은 값
```

- [ ] **Step 2: 버튼** — `#publishCheck` 버튼 바로 뒤:
```html
<button class="btn" id="playtestBtn" title="지금 편집 중인 스테이지+맵(미저장 포함)을 게임(:3000)에서 바로 실행 — 결산은 sandbox(메타 불변), 나가면 이 탭으로 복귀">▶ 이 스테이지 테스트</button>
```

- [ ] **Step 3: 핸들러** — `#publishCheck` 핸들러 바로 아래:
```js
document.getElementById('playtestBtn').onclick = async function () {
  const errs = validate();
  if (errs.length) { toast(`테스트 불가 ${errs.length}건 — 배너의 오류를 먼저 고치세요`, true); return; }
  const stamp = Date.now();
  const draftId = `${String(stage.id).replace(/[^A-Za-z0-9_-]/g, '_')}-${stamp}`;
  const snapshot = {
    kind: 'tk-playtest-snapshot', version: 1, draftId, revision: stamp,
    stage: serializeStageModel(stage),
    map: serializeMapModel({ id: mapId, name: mapName, width: W, height: H, tileLegend: loadedLegend, tiles }),
    seed: 1, returnUrl: location.href, savedAt: new Date().toISOString(),
  };
  this.disabled = true;
  try {
    const r = await fetch('/playtest-draft', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(snapshot) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || !j.ok) { toast(`드래프트 저장 실패: ${j.error || r.status}`, true); return; }
    // noopener 금지 — window.opener 가 있어야 게임이 window.close() 로 이 탭에 복귀한다 (spec §6)
    const w = window.open(`${GAME_ORIGIN}/playtest?draft=${encodeURIComponent(j.draftId)}`);
    if (!w) toast('팝업이 차단됐습니다 — 이 사이트의 팝업을 허용하세요', true);
    else toast(`테스트 탭 열림 · ${j.draftId}`);
  } catch (e) {
    toast('테스트 요청 실패: ' + e.message + ' — serve.py로 여세요 (launch tools = :8081, 기본 :8080)', true);
  } finally { this.disabled = false; }
};
```

- [ ] **Step 4: E2E (브라우저)** — next dev `:3000` 이 떠 있어야 함(launch `web` 또는 이미 실행 중). serve.py 는 `python tools/serve.py 8092`(백그라운드).
  1. `http://localhost:8092/tools/stage-editor.html` → `02-yingchuan` 선택 → 유닛 하나의 좌표를 `window.__stageEditor.getStage().units[0].x += 1` 로 바꾸고(또는 UI 드래그) ▶ 클릭.
  2. 새 탭이 `/playtest?draft=02-yingchuan-…` → 자동으로 `/battle?stage=__lab` 로 이동, 전투가 뜨고 첫 유닛이 **바뀐 좌표**에 있다(`read_page`/`javascript_tool` 로 확인; 배경은 yingchuan painted).
  3. `apps/web/public/_draft/02-yingchuan-*.json` 이 생겼고 `git status` 는 무변화(레포 JSON 불변), `git status --porcelain | grep _draft` 없음.
  4. 일시정지 「나가기」 → 게임 탭이 닫히고 에디터 탭이 앞에 온다(브라우저 도구의 tabs_context 로 탭 수 확인); 에디터의 선택·바꾼 좌표가 유지된다.
  5. 다시 ▶ → 이번엔 결산까지(자동전투 또는 「전투 그만두기」) — sandbox 결산: 결산 화면 버튼 라벨 "에디터로 ▶", 클릭 → 탭 닫힘. `localStorage` 메타(골드/클리어)가 바뀌지 않았는지 전후 비교: `JSON.parse(localStorage.getItem("tk.meta.v1"))`(키 = `apps/web/src/meta/metaStore.ts` `STORAGE_KEY`).
  6. 검증 에러 상태(유닛 좌표 999)에서 ▶ → 토스트 "테스트 불가 N건", 탭 열리지 않음.
  7. 실험실 무회귀: `/lab` → 전투 → 나가기 → `/lab`.
  서버 종료, `_draft/*.json` 정리(선택).

- [ ] **Step 5: 문서**
  - `tools/CLAUDE.md` 에디터 bullet 끝에: ` ▶ 이 스테이지 테스트 = `POST /playtest-draft` 스냅샷(`public/_draft/`, gitignore) → 게임 `/playtest?draft=` → `__lab` 경로(sandbox), 종료 시 에디터 탭 복귀.`
  - `apps/web/CLAUDE.md` 「씬」 bullet 뒤에 새 bullet: `- **실험실·플레이테스트**: sandbox 판정은 `makeCtx`의 `__lab` 분기 플래그(스테이지 id 비교 금지 — 플레이테스트 스냅샷은 실제 id 유지). 종료 3지점은 `leaveSandbox()`(returnUrl 있으면 탭 닫기, 없으면 /lab). 착륙 `/playtest?draft=` → `parsePlaytestSnapshot`(zod).`
  - 스펙 §3 PauseMenu 행: "`onExit?: () => void` prop 추가 — 있으면 `router.push(exitTo)` 대신 호출(기본 동작 불변)" → "`sandbox?: boolean` prop 추가 — true면 「나가기」가 `leaveSandbox((to) => router.push(to))`(router가 PauseMenu 안에 있음). 기본 동작 불변".
- [ ] **Step 6: 전체 게이트** — `pnpm test && pnpm typecheck` green.
- [ ] **Step 7: 커밋**
```bash
git add tools/stage-editor.html tools/CLAUDE.md apps/web/CLAUDE.md docs/superpowers/specs/2026-09-12-editor-playtest-design.md
git commit -m "feat(editor): ▶ 이 스테이지 테스트 — playtest snapshot to /playtest, docs

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```
