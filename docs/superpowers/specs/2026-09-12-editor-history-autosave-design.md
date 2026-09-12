# 에디터 Undo/Redo 전범위 + Autosave 복구본 + 저장 상태 — 설계 (2026-09-12)

> master-plan §16 "Autosave `저장 중... → 저장됨 ✓`", "Undo/Redo — 지형·유닛·이벤트·목표·메타데이터·삭제까지 일관되게"; §22 P1 제작 루프. design-guide 원칙 8·9("Save is always allowed", "Everything destructive is recoverable"), §4 Save states·Undo/Redo("텍스트 입력 중 Ctrl/Cmd+Z는 텍스트 필드 Undo가 우선"). 벤치마크 §5 RPGAtlas "사용자가 생각하는 한 작업 = Undo 한 번", §10 저장 정책("로컬 복구본 저장"과 "서버 저장"을 다른 상태로 표시).
> 선행: P0 round-trip(`tools/editor/stage-io.js`, 머지) · P1 Playtest(머지).

## 1. 문제

`tools/stage-editor.html`의 Undo는 `tiles + units` 스냅샷뿐(호출 4곳). 목표·패배조건·증원 편집·전략조건·메타·카메라·보상 등 **나머지 25곳의 변형은 되돌릴 수 없고 Redo가 없다.** Ctrl+Z가 텍스트 입력 중에도 전역으로 가로채 브라우저의 텍스트 undo를 죽인다. 저장 상태 표시가 없고, 탭을 닫으면 미저장 편집은 사라진다(`beforeunload` 경고는 수정 여부와 무관하게 내용만 있으면 뜬다).

성공 기준: 에디터의 **모든 편집**이 Ctrl+Z/Ctrl+Y로 되돌리고 다시 하기가 되며(타이핑은 한 묶음), **Undo 뒤 저장해도 P0 무손실이 유지**되고, 탭을 닫았다 열어도 **마지막 편집이 복구본으로 돌아오며**, 툴바가 지금 상태(저장됨/수정됨/저장 중)를 항상 보여준다.

## 2. 결정

**스냅샷 히스토리를 `refreshValidation()`에 건다.** 모든 변형 경로가 마지막에 `refreshValidation()`(50곳)을 부르므로, 거기서 전체 상태를 직렬화해 히스토리에 넣으면 변형 지점 29곳을 하나도 안 고치고 전범위가 된다. 직렬화는 P0의 `serializeStageModel`/`serializeMapModel`(미지 필드 포함 완전한 JSON), 복원은 `loadStageModel`/`loadMapModel` — 복원된 모델은 ORIG 연결까지 새로 갖추므로 **Undo 뒤 저장 = 무손실**이 P0 게이트로 그대로 보증된다.
기각: 명령 패턴(29곳 래핑 + 앞으로 매번 기억, 현 규모에 과함) / 현행 유지(P1 미달).

## 3. 구조

| 파일 | 역할 |
|---|---|
| `tools/editor/history.js` (신규, ESM·DOM 무관) | `createHistory(opts)` — 스냅샷 문자열 스택. push(dedupe·coalesce)·undo·redo·canUndo/canRedo·reset·markSaved·isDirty |
| `tools/editor/history.d.ts` (신규) | TS 선언(테스트용) |
| `packages/data/test/editor-history.test.ts` (신규) | history 단위 테스트(node). `editor-roundtrip.test.ts`에 "스냅샷 복원 후 직렬화 = 원본" 케이스 1개 추가 |
| `tools/stage-editor.html` (수정) | 스냅샷/복원 함수, `refreshValidation` 훅, 키보드, ↶↷ 버튼, 저장 상태 칩, 복구본 저장/복원 배너, `beforeunload` dirty 기준 |

## 4. 히스토리 코어 (`history.js`) — 계약

```ts
createHistory({ limit = 100, coalesceMs = 400, now = () => Date.now() }): History
interface History {
  push(snapshot: string): boolean;   // 직전 current 와 같으면 false(무시). redo 스택 비움. 직전 push 로부터 coalesceMs 안이면 top 교체(타이핑 버스트 = 한 항목).
  undo(): string | null;             // current 를 한 칸 앞으로. 불가면 null
  redo(): string | null;
  canUndo(): boolean; canRedo(): boolean;
  current(): string | null;
  reset(snapshot: string): void;      // 로드 직후: 스택 = [snapshot], saved = snapshot
  markSaved(): void;                  // 파일 저장 성공: saved = current
  isDirty(): boolean;                 // current !== saved
}
```
- 스택은 상태(문자열)의 배열 + 인덱스. `limit` 초과 시 가장 오래된 것부터 버림.
- coalesce: 직전 push 시각으로부터 `coalesceMs` 이내이고 **직전 push가 새 항목을 만든 것**(교체 연쇄 허용)이면 top을 교체. 버스트의 첫 항목 이전 상태가 Undo 지점이 된다(= "사용자가 생각하는 한 작업").
- 시간은 주입(`now`)해 테스트한다.

## 5. 스냅샷·복원 (HTML)

```js
const snapshot = () => JSON.stringify({ stage: serializeStageModel(stage), map: serializeMapModel({ id: mapId, name: mapName, width: W, height: H, tileLegend: loadedLegend, tiles }) });
function restore(snap) {            // Undo/Redo/복구본 공용
  restoring = true;
  try {
    const s = JSON.parse(snap);
    stage = loadStageModel(s.stage);
    const mm = loadMapModel(s.map); W = mm.width; H = mm.height; mapId = mm.id; mapName = mm.name; loadedLegend = mm.tileLegend; tiles = mm.tiles;
    selUnit = null; resizeCanvas(); renderAll(); renderTab(); refreshUnitList(); refreshValidation();
  } finally { restoring = false; }
}
```
- `refreshValidation()` 끝에: `if (!restoring) { if (history.push(snapshot())) scheduleRecovery(); } updateSaveState();`
- 로드(`loadStageObject`·`loadMapObject`·`doNew`) 끝에 `history.reset(snapshot())` — 기존 `undoStack.length = 0` 3곳을 대체. `pushUndo`/`doUndo`/`undoStack` 삭제(`cloneUnits` import는 더 이상 필요 없으면 제거).
- 맵 단독 모드도 같은 스냅샷(스테이지가 기본값이어도 포함)으로 다룬다.

## 6. 키보드·버튼
- 기존 keydown(522행)을 교체: 포커스가 `input/textarea/select/[contenteditable]`이면 **가로채지 않는다**(브라우저 텍스트 undo 우선). 아니면 Ctrl/Cmd+Z → undo, Ctrl+Y 또는 Ctrl/Cmd+Shift+Z → redo. 좌표 집기(`coordPick`) 중엔 무시.
- 툴바 `#saveStage` 앞에 `↶`(`#undoBtn`)·`↷`(`#redoBtn`), `canUndo/canRedo`로 `disabled` 갱신(`updateSaveState`에서).

## 7. 저장 상태 칩 + 복구본
- 툴바 `#saveMap` 뒤 `<span id="saveState">`: `저장됨 ✓ HH:MM` / `수정됨 · 복구본 보관 HH:MM:SS` / `저장 중…`. `updateSaveState()`가 `history.isDirty()`와 마지막 복구본 시각으로 그린다. 파일 저장 성공(`saveStageFile`/`saveMapFile`) → `history.markSaved()` + 복구본 삭제 + 칩 갱신. 붙여넣기 내보내기(`openPasteExport`)는 저장으로 치지 않는다(파일에 안 닿음).
- 복구본: `localStorage["tk.editor.recovery." + stage.id]` = `{ savedAt: ISO, snapshot }`. push 후 **1초 디바운스**로 기록(dirty일 때만). 저장 실패(quota)는 조용히 무시(칩에 "복구본 보관 실패").
- 복원 프롬프트: `loadStageObject`/`loadMapObject`가 끝난 뒤(서버·파일·붙여넣기 공통) `checkRecovery()`: 그 `stage.id`의 복구본이 있고 `snapshot !== history.current()`면 `#recoveryBar` 표시 — "복구본 있음 (HH:MM) — 저장하지 않은 편집이 있습니다 [복원] [버리기]". 복원 → `restore(rec.snapshot)` 후 `history.reset(rec.snapshot)`(스택은 새로, 단 saved는 로드 시점 스냅샷으로 두어 dirty). 버리기 → 키 삭제. 새 스테이지(`doNew`)는 검사 안 함.
- `beforeunload`: `history.isDirty()`일 때만 경고.
- `window.__stageEditor`에 `history` 노출(검증용).

## 8. 에러·엣지
- 스냅샷 직렬화 실패(순환 등)는 발생하지 않는다(모델은 JSON 유래). 방어적으로 try/catch 후 콘솔 경고, 히스토리 push 생략.
- `restore` 중 `refreshValidation`이 다시 push하지 않도록 `restoring` 플래그.
- `loadStageObject` 안의 `setMapOnlyMode(false)` → `refreshValidation()` 호출 순서: reset은 **마지막**에 하여 로드 직후 상태가 스택의 유일 항목이 되게 한다.
- 스테이지 id를 편집하면 복구본 키가 바뀐다 — 옛 키는 남는다(무해, 다음 저장 때 새 id 키만 삭제). 범위 밖.

## 9. 테스트
- `editor-history.test.ts`(node): dedupe(같은 스냅샷 push → false) / coalesce(400ms 안 연속 push → undo 한 번에 버스트 전으로) / 버스트 밖(500ms 뒤) push는 별 항목 / undo·redo 왕복 / 새 push가 redo 비움 / limit 초과 시 오래된 것 제거 / reset·markSaved·isDirty.
- `editor-roundtrip.test.ts` 추가 1건: 실제 스테이지 x → `s = JSON.stringify({stage: serialize(load(x)), map: …})` → `parse → loadStage → serialize` = x (Undo 복원 후 저장 무손실).
- 브라우저 E2E(플랜): 지형 칠하기·유닛 이동·목표 추가·turnLimit 입력·증원 추가 → Ctrl+Z ×5 → 전부 원복 → Ctrl+Y → 재적용; turnLimit에 "12" 타이핑(두 키) = Undo 1회로 원복; 입력창 포커스 중 Ctrl+Z는 텍스트만 되돌림; 편집 후 새로고침 → 복구본 배너 → 복원 → 편집 유지; 저장(레포 밖 경로) → 칩 "저장됨 ✓", 복구본 키 삭제; Undo 뒤 저장본 = 원본 동일(P0 비교 스크립트).

## 10. 범위 밖
Project Store/Draft 버전 관리(미결 ③) · 서버 측 Autosave · 여러 탭 동시 편집 충돌 처리 · 히스토리 항목 라벨("유닛 이동" 등) 표시.
