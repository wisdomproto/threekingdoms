# 에디터 Undo/Redo 전범위 + Autosave 복구본 + 저장 상태 — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `tools/stage-editor.html`의 모든 편집이 Ctrl+Z/Ctrl+Y로 되돌리기·다시 하기가 되고(타이핑은 한 묶음), Undo 뒤 저장해도 P0 무손실이 유지되며, 탭을 닫았다 열어도 마지막 편집이 복구본으로 돌아오고, 툴바가 저장 상태를 항상 보여준다.

**Architecture:** DOM 무관 스냅샷 히스토리 모듈 `tools/editor/history.js`(문자열 스택, dedupe·coalesce·undo/redo·saved 표식)를 `refreshValidation()`에 걸어 전범위 Undo를 얻는다. 스냅샷 = `serializeStage/serializeMap` JSON(미지 필드 포함), 복원 = `loadStage/loadMap`(ORIG 재부착) — P0 게이트가 무손실을 보증. 복구본은 `localStorage`(1초 디바운스, dirty일 때만), 진입점 4곳 꼬리에서 복원 배너. 브라우저 검증은 CDP(:9334)로 실제 Chrome을 구동하는 스크립트(`tools/editor/e2e/`)로 자동화한다.

**Tech Stack:** 브라우저 ESM(빌드 없음) · vitest(`packages/data`, node) · Chrome DevTools Protocol(Node 22 내장 `WebSocket`/`fetch`, 의존성 0).

**Spec:** `docs/superpowers/specs/2026-09-12-editor-history-autosave-design.md`

**작업 위치:** 메인 체크아웃 `C:\projects\threekingdoms`, 브랜치 `feat/editor-history`(main에서 분기). 커밋 트레일러 `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`. 파일 편집은 Bash(python)로 — Write/Edit 도구는 워크트리 밖 경로를 거부한다. 커밋 전 `pnpm --filter @tk/data test` green. 서버 포트: serve.py는 **8095+**(8081·8082는 다른 인스턴스), CDP Chrome은 `--remote-debugging-port=9334`.

---

## File Structure

| 파일 | 책임 |
|---|---|
| `tools/editor/history.js` (신규) | `createHistory({limit, coalesceMs, now})` — 스냅샷 문자열 스택. DOM 없음 |
| `tools/editor/history.d.ts` (신규) | TS 선언 |
| `packages/data/test/editor-history.test.ts` (신규) | 코어 단위 테스트(시간 주입) |
| `packages/data/test/editor-roundtrip.test.ts` (수정) | "편집 → 스냅샷 → 복원 → 직렬화 = 편집본, 미지 필드 보존" 1건 |
| `tools/stage-editor.html` (수정) | snapshot/restore, `refreshValidation` 훅, `suspendHistory`, 옛 undo 제거, 미도달 5곳 `refreshValidation()`, `loadMapOnlyFromServer` reset 순서, 키보드, ↶↷·저장 상태 칩·복구본 배너, `beforeunload`, `__stageEditor` 확장 |
| `tools/editor/e2e/cdp.mjs` (신규) | CDP 미니 클라이언트(Tab open/eval/targets) — playtest·history E2E 공용 |
| `tools/editor/e2e/history.mjs` (신규) | 실제 Chrome에서 Undo/Redo·coalesce·복구본·저장 칩 검증 |
| `tools/editor/e2e/playtest.mjs` (신규) | 기존 Playtest 왕복 검증(세션 스크래치 스크립트를 레포로 이관) |
| `tools/CLAUDE.md` (수정) | E2E 실행법 + 히스토리/복구본 한 줄 |

---

## Chunk 1: 히스토리 코어

### Task 1: `history.js` (TDD)

**Files:** Create `packages/data/test/editor-history.test.ts`, `tools/editor/history.js`, `tools/editor/history.d.ts`

- [ ] **Step 1: 테스트 작성**

```ts
import { describe, it, expect } from "vitest";
import { createHistory } from "../../../tools/editor/history.js";

function clock(start = 1000) { let t = start; return { now: () => t, tick: (ms: number) => { t += ms; } }; }

describe("editor history — 스냅샷 스택 (spec §4)", () => {
  it("같은 스냅샷 push 는 무시(false), 다른 스냅샷은 true", () => {
    const h = createHistory({ now: clock().now });
    h.reset("A");
    expect(h.push("A")).toBe(false);
    expect(h.push("B")).toBe(true);
    expect(h.current()).toBe("B");
  });
  it("undo/redo 왕복, 새 push 가 redo 를 비운다", () => {
    const c = clock(); const h = createHistory({ now: c.now });
    h.reset("A"); c.tick(1000); h.push("B"); c.tick(1000); h.push("C");
    expect(h.undo()).toBe("B"); expect(h.undo()).toBe("A"); expect(h.undo()).toBe(null);
    expect(h.redo()).toBe("B"); expect(h.canRedo()).toBe(true);
    c.tick(1000); h.push("D");
    expect(h.canRedo()).toBe(false); expect(h.current()).toBe("D");
    expect(h.undo()).toBe("B");
  });
  it("coalesce:true 로 400ms 안 연속 push 는 한 항목 — undo 한 번에 버스트 전으로", () => {
    const c = clock(); const h = createHistory({ now: c.now, coalesceMs: 400 });
    h.reset("A"); c.tick(1000);
    h.push("B1", { coalesce: true }); c.tick(100); h.push("B12", { coalesce: true }); c.tick(100); h.push("B123", { coalesce: true });
    expect(h.current()).toBe("B123");
    expect(h.undo()).toBe("A");
    expect(h.redo()).toBe("B123");
  });
  it("coalesce:false 는 400ms 안이어도 별 항목", () => {
    const c = clock(); const h = createHistory({ now: c.now });
    h.reset("A"); c.tick(1000); h.push("B"); c.tick(100); h.push("C");
    expect(h.undo()).toBe("B");
  });
  it("버스트 밖(500ms 뒤) push 는 별 항목", () => {
    const c = clock(); const h = createHistory({ now: c.now, coalesceMs: 400 });
    h.reset("A"); c.tick(1000); h.push("B", { coalesce: true }); c.tick(500); h.push("C", { coalesce: true });
    expect(h.undo()).toBe("B");
  });
  it("undo 뒤 300ms 안 push 는 병합하지 않는다 (돌아간 상태 보존)", () => {
    const c = clock(); const h = createHistory({ now: c.now, coalesceMs: 400 });
    h.reset("A"); c.tick(1000); h.push("B", { coalesce: true });
    c.tick(100); expect(h.undo()).toBe("A");
    c.tick(100); h.push("C", { coalesce: true });
    expect(h.undo()).toBe("A");
    expect(h.redo()).toBe("C");
  });
  it("coalesce:false 항목 직후 400ms 안의 coalesce:true push 는 그 항목을 덮지 않는다", () => {
    const c = clock(); const h = createHistory({ now: c.now, coalesceMs: 400 });
    h.reset("A"); c.tick(1000); h.push("CHK"); c.tick(100); h.push("T1", { coalesce: true });
    expect(h.undo()).toBe("CHK"); expect(h.undo()).toBe("A");
  });
  it("같은 스냅샷 push(false) 는 redo 스택을 지우지 않는다", () => {
    const c = clock(); const h = createHistory({ now: c.now });
    h.reset("A"); c.tick(1000); h.push("B"); h.undo();
    expect(h.push("A")).toBe(false); expect(h.canRedo()).toBe(true);
  });
  it("버스트 첫 항목은 reset 직후 baseline 을 덮지 않는다", () => {
    const c = clock(); const h = createHistory({ now: c.now });
    h.reset("A"); c.tick(10); h.push("B", { coalesce: true });
    expect(h.undo()).toBe("A");
  });
  it("limit 초과 시 가장 오래된 항목 제거", () => {
    const c = clock(); const h = createHistory({ now: c.now, limit: 3 });
    h.reset("A"); for (const s of ["B", "C", "D"]) { c.tick(1000); h.push(s); }
    expect(h.undo()).toBe("C"); expect(h.undo()).toBe("B"); expect(h.undo()).toBe(null);
  });
  it("reset / markSaved / isDirty — 첫 reset 전엔 dirty 아님", () => {
    const c = clock(); const h = createHistory({ now: c.now });
    expect(h.isDirty()).toBe(false);
    h.push("X"); expect(h.isDirty()).toBe(false);
    h.reset("A"); expect(h.isDirty()).toBe(false);
    c.tick(1000); h.push("B"); expect(h.isDirty()).toBe(true);
    h.markSaved(); expect(h.isDirty()).toBe(false);
    h.undo(); expect(h.isDirty()).toBe(true);
    h.redo(); expect(h.isDirty()).toBe(false);
  });
});
```

- [ ] **Step 2: 실패 확인** — `pnpm --filter @tk/data test editor-history` → FAIL (`Failed to load url ../../../tools/editor/history.js`)

- [ ] **Step 3: 구현** — `tools/editor/history.js`

```js
// tools/editor/history.js — 에디터 스냅샷 히스토리 (DOM 무관). spec 2026-09-12-editor-history-autosave-design §4
// 스택 원소 = 전체 상태의 직렬화 문자열. 복원은 호출측(loadStage/loadMap)이 한다.
export function createHistory({ limit = 100, coalesceMs = 400, now = () => Date.now() } = {}) {
  let stack = [];
  let index = -1;
  let saved = null;
  let lastPushAt = -Infinity;   // 병합 창 기준 시각. undo/redo/reset 이 닫는다(-Infinity).
  let lastWasPush = false;      // 마지막 호출이 새 항목/교체를 만든 push 였는가
  let lastCoalesce = false;     // 그 push 가 coalesce:true 였는가 (체크박스 직후 타이핑이 체크박스 항목을 덮지 않게)
  let didReset = false;         // 첫 reset 전엔 dirty 판정 안 함(init 렌더 push 무시)
  const current = () => (index >= 0 ? stack[index] : null);
  return {
    /** 새 상태. 직전과 같으면 false. coalesce 면 병합 창(coalesceMs) 안에서 top 교체(baseline 은 절대 안 덮음). */
    push(snapshot, { coalesce = false } = {}) {
      if (snapshot === current()) return false;
      const t = now();
      const burst = coalesce && lastWasPush && lastCoalesce && t - lastPushAt <= coalesceMs && index >= 1;
      stack.length = index + 1; // redo 비움
      if (burst) stack[index] = snapshot;
      else { stack.push(snapshot); index = stack.length - 1; }
      if (stack.length > limit) { const drop = stack.length - limit; stack.splice(0, drop); index -= drop; }
      lastPushAt = t; lastWasPush = true; lastCoalesce = coalesce;
      return true;
    },
    undo() { if (index <= 0) return null; index -= 1; lastWasPush = false; lastPushAt = -Infinity; return stack[index]; },
    redo() { if (index >= stack.length - 1) return null; index += 1; lastWasPush = false; lastPushAt = -Infinity; return stack[index]; },
    canUndo: () => index > 0,
    canRedo: () => index < stack.length - 1,
    current,
    /** 로드 직후: 스택 = [snapshot], saved = snapshot */
    reset(snapshot) { stack = [snapshot]; index = 0; saved = snapshot; lastWasPush = false; lastPushAt = -Infinity; didReset = true; },
    markSaved() { saved = current(); },
    isDirty: () => didReset && current() !== saved,
  };
}
```
`tools/editor/history.d.ts`:
```ts
export interface History {
  push(snapshot: string, opts?: { coalesce?: boolean }): boolean;
  undo(): string | null; redo(): string | null;
  canUndo(): boolean; canRedo(): boolean;
  current(): string | null;
  reset(snapshot: string): void; markSaved(): void; isDirty(): boolean;
}
export function createHistory(opts?: { limit?: number; coalesceMs?: number; now?: () => number }): History;
```

- [ ] **Step 4: 통과** — `pnpm --filter @tk/data test editor-history` → 11 passed; `pnpm --filter @tk/data typecheck` clean.
- [ ] **Step 5: 커밋** — `feat(editor): history module — snapshot stack with dedupe, text coalescing, undo/redo, saved mark`

### Task 2: round-trip 게이트에 "복원 뒤 무손실" 케이스

**Files:** Modify `packages/data/test/editor-roundtrip.test.ts`

- [ ] **Step 1:** 편집 의미론 describe 끝에 추가(모듈 이름 `loadStage/serializeStage/loadMap/serializeMap` 사용):
```ts
  it("스냅샷(직렬화 문자열) → 복원(loadStage) → 직렬화 = 편집본, 유닛 미지 필드 보존 (Undo 복원 뒤 저장 무손실)", () => {
    const m = loadStage(base()) as Json & { units: Json[] };
    m.units[0]!.x = 7;
    const snap = JSON.stringify({ stage: serializeStage(m) });
    const restored = loadStage(JSON.parse(snap).stage);
    const out = serializeStage(restored) as Json & { units: Json[] };
    const want = base() as Json & { units: Json[] };
    want.units[0]!.x = 7;
    same(out, want);
    expect(out.units[0]!.note).toBe("미지");
  });
```
- [ ] **Step 2:** `pnpm --filter @tk/data test` → 전부 green (roundtrip 70 → 71).
- [ ] **Step 3: 커밋** — `test(editor): round-trip after snapshot restore keeps unknown fields`

---

## Chunk 2: 에디터 배선

### Task 3: `stage-editor.html`

**Files:** Modify `tools/stage-editor.html`

- [ ] **Step 1: import + 상태**
  import 문에 `import { createHistory } from './editor/history.js';` 추가. `cloneUnits` import 제거(`stage-io.js`의 export는 유지).
  `const undoStack = [];`(291행)를 다음으로 교체:
```js
const history = createHistory();  // 전범위 Undo/Redo — spec 2026-09-12-editor-history-autosave-design
let suspendHistory = false;       // 로드/복원 중 refreshValidation 의 push 차단
let recoveryTimer = null;
let lastRecoveryAt = null;        // 칩 표시용
```

- [ ] **Step 2: 옛 undo 제거** — `function pushUndo(){…}`·`function doUndo(){…}`(436~445) 삭제; `pushUndo();` 호출 4곳(≈474·494·751·940) 삭제; `undoStack.length = 0` 3곳(≈1095·1104·1178) 삭제(대신 Step 5의 reset).

- [ ] **Step 3: 스냅샷·복원·훅** — `refreshValidation` 정의 **위**에 추가:
```js
/* ═══════════════════════ 히스토리·복구본 ═══════════════════════ */
const isTextLike = (el) => !!el && ((el.tagName === 'INPUT' && (el.type === 'text' || el.type === 'number')) || el.tagName === 'TEXTAREA' || el.isContentEditable);
function snapshot() {
  return JSON.stringify({ stage: serializeStageModel(stage), map: serializeMapModel({ id: mapId, name: mapName, width: W, height: H, tileLegend: loadedLegend, tiles }) });
}
function restore(snap) {  // Undo/Redo/복구본 공용 — 복원된 모델은 ORIG 를 새로 갖는다(무손실)
  const prev = suspendHistory; suspendHistory = true;
  try {
    const s = JSON.parse(snap);
    stage = loadStageModel(s.stage);
    const mm = loadMapModel(s.map);
    W = mm.width; H = mm.height; mapId = mm.id; mapName = mm.name; loadedLegend = mm.tileLegend; tiles = mm.tiles;
    selUnit = null; resizeCanvas(); renderAll(); renderTab(); refreshUnitList(); refreshValidation();
  } finally { suspendHistory = prev; }
  updateSaveState();
}
function doUndo() { const s = history.undo(); if (s != null) { restore(s); toast('되돌리기'); } }
function doRedo() { const s = history.redo(); if (s != null) { restore(s); toast('다시 하기'); } }
function recoveryKey() { return mapOnlyMode ? `tk.editor.recovery.map:${mapId}` : `tk.editor.recovery.stage:${stage.id}`; }
function scheduleRecovery() {
  if (recoveryTimer) clearTimeout(recoveryTimer);
  recoveryTimer = setTimeout(() => {
    recoveryTimer = null;
    if (!history.isDirty()) { clearRecovery(); updateSaveState(); return; } // 울리는 시점에 판정 — undo로 clean이면 옛 복구본도 제거
    try {
      localStorage.setItem(recoveryKey(), JSON.stringify({ savedAt: new Date().toISOString(), snapshot: history.current() }));
      lastRecoveryAt = new Date();
    } catch { lastRecoveryAt = 'fail'; }
    updateSaveState();
  }, 1000);
}
function cancelRecoveryTimer() { if (recoveryTimer) { clearTimeout(recoveryTimer); recoveryTimer = null; } }
function clearRecovery() { try { localStorage.removeItem(recoveryKey()); } catch {} lastRecoveryAt = null; }
function checkRecovery() {  // 진입점 4곳의 꼬리에서 1회
  let rec = null;
  try { rec = JSON.parse(localStorage.getItem(recoveryKey()) || 'null'); } catch {}
  const bar = document.getElementById('recoveryBar');
  if (!rec || typeof rec.snapshot !== 'string' || rec.snapshot === history.current()) { bar.style.display = 'none'; return; }
  document.getElementById('recoveryTime').textContent = new Date(rec.savedAt).toLocaleTimeString();
  bar.style.display = '';
  document.getElementById('recoveryRestore').onclick = () => {
    restore(rec.snapshot);                                  // suspend 하에 복원
    history.push(rec.snapshot, { coalesce: false });        // 스택 [로드 시점, 복구본] → dirty, Undo 1회면 디스크 상태
    scheduleRecovery();
    bar.style.display = 'none'; updateSaveState(); toast('복구본 복원');
  };
  document.getElementById('recoveryDiscard').onclick = () => { clearRecovery(); bar.style.display = 'none'; updateSaveState(); };
}
function updateSaveState() {
  const chip = document.getElementById('saveState');
  const u = document.getElementById('undo'), r = document.getElementById('redo');
  if (u) u.disabled = !history.canUndo();
  if (r) r.disabled = !history.canRedo();
  if (!chip) return;
  if (!history.isDirty()) { chip.textContent = lastSavedAt ? `저장됨 ✓ ${lastSavedAt}` : '저장됨 ✓'; chip.className = 'chip ok'; return; }
  chip.className = 'chip warn';
  chip.textContent = lastRecoveryAt === 'fail' ? '수정됨 · 복구본 보관 실패' : lastRecoveryAt ? `수정됨 · 복구본 보관 ${lastRecoveryAt.toLocaleTimeString()}` : '수정됨';
}
let lastSavedAt = null;
```
  `refreshValidation()`의 `return errs.length === 0;` 앞에:
```js
  if (!suspendHistory) {
    if (history.push(snapshot(), { coalesce: isTextLike(document.activeElement) })) scheduleRecovery();
  }
  updateSaveState();
```
  그리고 `refreshValidation` 안 배너 갱신은 `if (!mapOnlyMode) { …배너… }`로 감싼다(push 는 그대로).

- [ ] **Step 4: 미도달 5곳** — 각 줄에 `refreshValidation();` 추가:
  - 495행: `if (tool === 'fill') { floodFill(c[0], c[1]); refreshValidation(); } else {…}`
  - 704행: `inputText(mapName, v => { mapName = v; refreshValidation(); })`
  - 809행: `oc.onchange = () => { o.optional = oc.checked; refreshValidation(); };`
  - 895행: `lc.onchange = () => { e.outcome.loserRetreats = lc.checked; refreshValidation(); };`
  - 898행: `occ.onchange = () => { e.once = occ.checked; refreshValidation(); };`

- [ ] **Step 5: 로드 경로 = suspend + reset 마지막**
  `loadStageObject(obj)`: 본문 시작에 `const prevSuspend = suspendHistory; suspendHistory = true; cancelRecoveryTimer();`, `return true` 직전에 `suspendHistory = prevSuspend; history.reset(snapshot()); updateSaveState();`(early-return 가드 경로에서도 `suspendHistory = prevSuspend` 복원). `loadMapObject(m)`·`doNew()` 동일. `doNew()`의 `confirm(...)`은 `if (history.isDirty() && !confirm(...)) return;` 로. `loadMapOnlyFromServer`: `loadMapObject(m)` 뒤 `stage.mapId = …; setMapOnlyMode(true);` 다음에 `history.reset(snapshot()); updateSaveState();` 한 번 더(mapId 반영된 baseline). `init()` 마지막에도 `history.reset(snapshot());`.
  진입점 4곳 **성공 분기** 꼬리에 `checkRecovery();`: `loadStageFromServer`(스테이지 로드 성공 뒤), `loadMapOnlyFromServer`(toast 뒤), `openFile`(`loadXObject`가 true 반환한 뒤), `doPasteLoad`(로드 성공 뒤).

- [ ] **Step 6: 저장 성공 훅** — `saveStageFile`·`saveMapFile`의 성공 토스트 뒤에 `history.markSaved(); clearRecovery(); lastSavedAt = new Date().toLocaleTimeString(); updateSaveState();`. `openPasteExport` 경로는 그대로.

- [ ] **Step 7: 키보드·버튼**
  keydown(522~)의 첫 줄을 교체:
```js
    if ((e.ctrlKey || e.metaKey) && !e.altKey) {
      const k = e.key.toLowerCase();
      if (isTextLike(document.activeElement)) { /* 텍스트 undo 는 브라우저에 양보 */ }
      else if (k === 'z' && e.shiftKey) { e.preventDefault(); if (!coordPick) doRedo(); return; }
      else if (k === 'z') { e.preventDefault(); if (!coordPick) doUndo(); return; }
      else if (k === 'y') { e.preventDefault(); if (!coordPick) doRedo(); return; }
    }
    if (isTextLike(document.activeElement)) return;   // 1~9 지형 단축키도 텍스트 입력 중엔 무시
```
  (기존 `mode === 'terrain' && e.key >= '1' …` 줄과 Escape 처리는 그 아래 그대로.)
  521행 `document.getElementById('undo').onclick = doUndo;` 유지 + `document.getElementById('redo').onclick = doRedo;`.
  툴바 166행 `<button class="btn" id="undo">↶</button>` 뒤에 `<button class="btn" id="redo">↷</button>`; `#saveMap` 뒤에 `<span id="saveState" class="chip"></span>`. CSS에 `.chip{font-size:12px;padding:3px 8px;border-radius:10px;border:1px solid var(--dim);color:var(--dim)} .chip.ok{color:#8fd19e;border-color:#8fd19e} .chip.warn{color:#e7c27a;border-color:#e7c27a}` 추가.
  `#valbanner` 뒤에:
```html
<div id="recoveryBar" style="display:none;background:#3a2f1a;color:#ffe2a8;padding:6px 10px;font-size:12.5px;margin:6px 0">
  복구본 있음 (<span id="recoveryTime"></span>) — 저장하지 않은 편집이 있습니다
  <button class="btn" id="recoveryRestore" style="margin-left:8px">복원</button>
  <button class="btn" id="recoveryDiscard">버리기</button>
</div>
```
- [ ] **Step 8: beforeunload + 훅** — 1191행을 `window.onbeforeunload = e => { if (history.isDirty()) { e.preventDefault(); e.returnValue = ''; } };`(**프로퍼티** — E2E가 `onbeforeunload = null`로 끌 수 있어야 한다; addEventListener 금지). `window.__stageEditor = { serializeStage, serializeMap, getStage: () => stage, history, snapshot, restore, refreshValidation, doUndo, doRedo };`
- [ ] **Step 9: 정적 점검** — 브라우저에서 `http://localhost:8095/tools/stage-editor.html`(serve.py 8095 백그라운드) 열어 `#modfail` 없음·콘솔 에러 0(`read_console_messages`); `grep -c "pushUndo\|undoStack\|cloneUnits" tools/stage-editor.html` → 0.
- [ ] **Step 10: 커밋** — `feat(editor): full-range undo/redo via snapshot history, local recovery autosave, save-state chip`

### Task 4: CDP E2E 스크립트 (실제 Chrome)

**Files:** Create `tools/editor/e2e/cdp.mjs`, `tools/editor/e2e/history.mjs`, `tools/editor/e2e/playtest.mjs`

- [ ] **Step 1: `cdp.mjs`** (공용)
```js
// tools/editor/e2e/cdp.mjs — Chrome DevTools Protocol 미니 클라이언트 (Node 22 내장 WebSocket/fetch, 의존성 0)
// 사용: chrome.exe --remote-debugging-port=9334 --user-data-dir=%TEMP%\tk-cdp --no-first-run --disable-popup-blocking <url>
export const PORT = Number(process.env.CDP_PORT || 9334);
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
export const targets = async () => (await fetch(`http://127.0.0.1:${PORT}/json`)).json();
export const pages = async () => (await targets()).filter((t) => t.type === "page");
export class Tab {
  constructor(ws) { this.ws = ws; this.id = 0; this.pending = new Map();
    ws.onmessage = (m) => { const d = JSON.parse(m.data); if (d.id && this.pending.has(d.id)) { this.pending.get(d.id)(d); this.pending.delete(d.id); } }; }
  static async open(target) { const ws = new WebSocket(target.webSocketDebuggerUrl); await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; }); const t = new Tab(ws); await t.send("Runtime.enable"); return t; }
  send(method, params = {}) { const id = ++this.id; this.ws.send(JSON.stringify({ id, method, params })); return new Promise((r) => this.pending.set(id, r)); }
  async eval(expr) { const r = await this.send("Runtime.evaluate", { expression: expr, awaitPromise: true, returnByValue: true, userGesture: true }); if (r.result?.exceptionDetails) throw new Error(JSON.stringify(r.result.exceptionDetails)); return r.result?.result?.value; }
  async clickText(prefix) { return this.eval(`(() => { const b = Array.from(document.querySelectorAll('button')).find(b => b.textContent.trim().startsWith(${JSON.stringify(prefix)})); if (!b) return 'no:' + ${JSON.stringify(prefix)}; b.click(); return 'ok'; })()`); }
  async waitFor(expr, tries = 60, ms = 500) { for (let i = 0; i < tries; i++) { if (await this.eval(expr)) return true; await sleep(ms); } return false; }
  close() { this.ws.close(); }
}
export async function launchChrome(url) {
  const { spawn } = await import("node:child_process");
  const exe = process.env.CHROME || "C:/Program Files/Google/Chrome/Application/chrome.exe";
  const dir = `${process.env.TEMP || "/tmp"}/tk-cdp-${PORT}`;
  spawn(exe, [`--remote-debugging-port=${PORT}`, `--user-data-dir=${dir}`, "--no-first-run", "--no-default-browser-check", "--disable-popup-blocking", "--window-size=1400,900", url], { detached: true, stdio: "ignore" }).unref();
  for (let i = 0; i < 40; i++) { try { await targets(); return; } catch { await sleep(250); } }
  throw new Error("CDP 포트가 열리지 않음");
}
export function check(name, ok, detail) { console.log(`${ok ? "PASS" : "FAIL"} ${name}${detail !== undefined ? " — " + JSON.stringify(detail) : ""}`); if (!ok) process.exitCode = 1; }
```
- [ ] **Step 2: `history.mjs`**
```js
// tools/editor/e2e/history.mjs — Undo/Redo·coalesce·복구본·저장 칩 (실제 Chrome). 전제: serve.py 가 EDITOR_ORIGIN(기본 http://localhost:8095) 에 떠 있음.
import { Tab, pages, launchChrome, sleep, check } from "./cdp.mjs";
const EDITOR = `${process.env.EDITOR_ORIGIN || "http://localhost:8095"}/tools/stage-editor.html`;
if (!(await pages().catch(() => null))) await launchChrome(EDITOR);
let ed = (await pages()).find((t) => t.url.includes("stage-editor.html"));
if (!ed) { await launchChrome(EDITOR); ed = (await pages()).find((t) => t.url.includes("stage-editor.html")); }
const t = await Tab.open(ed);
await t.eval("localStorage.clear(); location.reload(); 'r'"); await sleep(2500);
await t.waitFor("window.__stageEditor && window.__stageEditor.getStage().id === '05-sishuiguan'");
const H = "window.__stageEditor";
check("초기 상태: dirty 아님 · undo 불가", await t.eval(`!${H}.history.isDirty() && !${H}.history.canUndo()`));
// 1) 유닛 이동 → 목표 optional 토글 → turnLimit 타이핑(2키) → 3개 항목 → Undo ×3
await t.eval(`(() => { const s = ${H}.getStage(); s.units[0].x += 1; ${H}.refreshValidation(); })()`);
await t.eval(`(() => { const s = ${H}.getStage(); s.objectives[0].optional = !s.objectives[0].optional; ${H}.refreshValidation(); })()`);
await t.eval(`(() => { const inp = Array.from(document.querySelectorAll('input[type=number]')).find(i => Number(i.value) === ${H}.getStage().turnLimit); inp.focus(); inp.value = '2'; inp.dispatchEvent(new Event('input', { bubbles: true })); inp.value = '21'; inp.dispatchEvent(new Event('input', { bubbles: true })); inp.blur(); })()`);
check("3개 편집 후 turnLimit=21", (await t.eval(`${H}.getStage().turnLimit`)) === 21);
const x0 = await t.eval(`${H}.getStage().units[0].x`);
await t.eval(`${H}.doUndo()`); check("Undo 1: 타이핑 버스트가 한 번에 원복", (await t.eval(`${H}.getStage().turnLimit`)) !== 21);
await t.eval(`${H}.doUndo()`); await t.eval(`${H}.doUndo()`);
check("Undo 3: 유닛 x 원복", (await t.eval(`${H}.getStage().units[0].x`)) === x0 - 1);
check("Undo 뒤 dirty 아님(로드 상태)", await t.eval(`!${H}.history.isDirty()`));
await t.eval(`${H}.doRedo()`); check("Redo: 유닛 x 재적용", (await t.eval(`${H}.getStage().units[0].x`)) === x0);
// 2) 복구본: 편집 상태로 새로고침 → 배너 → 복원
await sleep(1300);
check("복구본 localStorage 기록", await t.eval("!!localStorage.getItem('tk.editor.recovery.stage:05-sishuiguan')"));
await t.eval("window.onbeforeunload = null; location.reload(); 'r'"); await sleep(2500);
await t.waitFor(`${H} && ${H}.getStage().id === '05-sishuiguan'`);
check("새로고침 후 복구본 배너 표시", await t.eval("document.getElementById('recoveryBar').style.display !== 'none'"));
await t.eval("document.getElementById('recoveryRestore').click()"); await sleep(300);
check("복원 후 유닛 x 유지", (await t.eval(`${H}.getStage().units[0].x`)) === x0);
check("복원 후 dirty(저장됨 아님)", await t.eval(`${H}.history.isDirty()`));
check("칩 문구 '수정됨'", (await t.eval("document.getElementById('saveState').textContent")).startsWith("수정됨"));
// 3) 무손실: 현재 직렬화 = 원본 + x 편집
const cur = JSON.parse(await t.eval(`${H}.serializeStage()`));
const orig = await (await fetch(`${process.env.EDITOR_ORIGIN || "http://localhost:8095"}/packages/data/json/stages/05-sishuiguan.json`)).json();
orig.units[0].x = x0;
check("복원 뒤 직렬화 = 원본+편집(무손실)", JSON.stringify(cur) === JSON.stringify(orig));
t.close();
```
- [ ] **Step 3: `playtest.mjs`** — 세션에서 검증에 썼던 스크립트를 `cdp.mjs` 기반으로 옮긴다: 유닛 x+1 → `#playtestBtn.click()` → 새 탭 `/battle?stage=__lab` → `tk.lab.stage.units[0].x` 일치·`returnUrl`·`opener` → ☰/전투 그만두기/나가기 → 게임 탭 닫힘 → 에디터 x 유지. `check()`로 6개 항목 출력. (내용은 위 history.mjs 와 같은 스타일 — 구현자가 작성.)
- [ ] **Step 4: 실행** — `python tools/serve.py 8095`(백그라운드), next dev 는 playtest 에만 필요(:3000 떠 있으면 재사용). `node tools/editor/e2e/history.mjs` → 전부 PASS; `node tools/editor/e2e/playtest.mjs` → 전부 PASS. Chrome CDP 인스턴스 종료(`taskkill` on the pid using 9334 or leave — 프로필은 `%TEMP%\tk-cdp-9334`).
- [ ] **Step 5: 커밋** — `test(editor): CDP-driven Chrome E2E for history/recovery and playtest round-trip`

### Task 5: 문서 + 전체 게이트

- [ ] `tools/CLAUDE.md` 에디터 bullet 끝에: ` Undo/Redo 전범위 = `tools/editor/history.js` 스냅샷 스택(`refreshValidation` 훅, 텍스트 타이핑 병합), 복구본 = `localStorage tk.editor.recovery.*`(1초 디바운스, 저장 시 삭제), 저장 상태 칩. **E2E** = `node tools/editor/e2e/{history,playtest}.mjs`(실제 Chrome을 CDP :9334 로 자동 구동, 의존성 0; serve.py :8095 + next dev :3000 필요).`
- [ ] `pnpm test && pnpm typecheck` green.
- [ ] 커밋 — `docs(tools): history/recovery and CDP e2e notes`
