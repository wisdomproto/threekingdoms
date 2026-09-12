# 에디터 Undo/Redo 전범위 + Autosave 복구본 + 저장 상태 — 설계 (2026-09-12)

> master-plan §16 "Autosave `저장 중... → 저장됨 ✓`", "Undo/Redo — 지형·유닛·이벤트·목표·메타데이터·삭제까지 일관되게"; §22 P1 제작 루프. design-guide 원칙 8·9("Save is always allowed", "Everything destructive is recoverable"), §4 Save states·Undo/Redo("텍스트 입력 중 Ctrl/Cmd+Z는 텍스트 필드 Undo가 우선"). 벤치마크 §5 RPGAtlas "사용자가 생각하는 한 작업 = Undo 한 번", §10 저장 정책("로컬 복구본 저장"과 "서버 저장"을 다른 상태로 표시).
> 선행: P0 round-trip(`tools/editor/stage-io.js`, 머지) · P1 Playtest(머지).

## 1. 문제

`tools/stage-editor.html`의 Undo는 `tiles + units` 스냅샷뿐(호출 4곳). 목표·패배조건·증원 편집·전략조건·메타·카메라·보상 등 **나머지 25곳의 변형은 되돌릴 수 없고 Redo가 없다.** Ctrl+Z가 텍스트 입력 중에도 전역으로 가로채 브라우저의 텍스트 undo를 죽인다. 저장 상태 표시가 없고, 탭을 닫으면 미저장 편집은 사라진다(`beforeunload` 경고는 수정 여부와 무관하게 내용만 있으면 뜬다).

성공 기준: 에디터의 **모든 편집**이 Ctrl+Z/Ctrl+Y로 되돌리고 다시 하기가 되며(타이핑은 한 묶음), **Undo 뒤 저장해도 P0 무손실이 유지**되고, 탭을 닫았다 열어도 **마지막 편집이 복구본으로 돌아오며**, 툴바가 지금 상태(저장됨/수정됨/저장 중)를 항상 보여준다.

## 2. 결정

**스냅샷 히스토리를 `refreshValidation()`에 건다.** 거의 모든 변형 경로가 마지막에 `refreshValidation()`(50곳)을 부르므로, 거기서 전체 상태를 직렬화해 히스토리에 넣으면 변형 지점 대부분을 안 고치고 전범위가 된다. 예외 = 실측으로 찾은 **미도달 5곳**에 `refreshValidation()` 한 줄씩 추가: ① 채우기(`floodFill`, mousedown 경로 — `painting=false`라 mouseup 훅을 안 탐) ② `mapName` 입력 ③ 목표 `optional` 체크 ④ 이벤트 `outcome.loserRetreats` 체크 ⑤ 이벤트 `once` 체크. 또 `loadMapOnlyFromServer`는 `loadMapObject()` 뒤에 `stage.mapId`를 바꾸므로 히스토리 reset은 그 대입 **뒤**에 한다(§5). 직렬화는 P0의 `serializeStageModel`/`serializeMapModel`(미지 필드 포함 완전한 JSON), 복원은 `loadStageModel`/`loadMapModel` — 복원된 모델은 ORIG 연결까지 새로 갖추므로 **Undo 뒤 저장 = 무손실**이 P0 게이트로 그대로 보증된다.
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
- coalesce: `push(snapshot, { coalesce })`. `coalesce === true`이고 직전 push 시각으로부터 `coalesceMs` 이내이며 **마지막 호출이 push(true 반환)였고 그 뒤 undo/redo/reset이 없었으면** top을 교체(교체 연쇄 허용). 버스트의 첫 항목 이전 상태가 Undo 지점이 된다. **`undo()`·`redo()`·`reset()`은 병합 창을 닫는다**(`lastPushAt = -∞`) — 그렇지 않으면 "편집 → Ctrl+Z → 300ms 안 재편집"이 방금 돌아간 상태를 덮어쓴다.
- `coalesce` 여부는 호출측이 정한다: HTML 훅은 **텍스트류 입력(`input[type=text|number]`·`textarea`·contenteditable)에 포커스가 있을 때만 `true`** — 타이핑 버스트만 한 항목이 되고, 빠른 클릭 두 번(목표 추가 ×2·체크박스 둘)은 각각 별 항목으로 남는다("사용자가 생각하는 한 작업 = Undo 한 번").
- `isDirty()`는 첫 `reset` 전에는 false(초기 `init()` 렌더가 만드는 push는 dirty가 아니다).
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
- `refreshValidation()` 끝에: `if (!suspendHistory) { if (history.push(snapshot(), { coalesce: isTextLike(document.activeElement) })) scheduleRecovery(); } updateSaveState();`
- **`suspendHistory` 플래그**를 `restore()`뿐 아니라 `loadStageObject`·`loadMapObject`·`doNew`·`loadMapOnlyFromServer` 본문 전체에 걸고, 각 함수 **마지막**(`loadMapOnlyFromServer`는 `stage.mapId` 대입 뒤)에 `history.reset(snapshot())` — 로드 중 `setMapOnlyMode(false)`→`refreshValidation()`이 만드는 선행 push를 원천 차단. `init()` 끝에도 `history.reset(snapshot())`. 기존 `undoStack.length = 0` 3곳·`pushUndo`/`doUndo`/`undoStack`·`pushUndo()` 호출 4곳 삭제. `cloneUnits`의 HTML import는 제거하되 **모듈 export는 유지**(`editor-roundtrip.test.ts`가 import).
- 맵 단독 모드도 같은 스냅샷(스테이지가 기본값이어도 포함)으로 다룬다.

## 6. 키보드·버튼
- 기존 keydown(522행)을 교체: 포커스가 **텍스트류**(`input[type=text|number]`·`textarea`·contenteditable)면 가로채지 않는다(브라우저 텍스트 undo 우선 — 그 undo가 `input` 이벤트를 내면 에디터 히스토리에는 *새 항목*이 쌓인다: 두 시스템은 상쇄가 아니라 연쇄. 수용). `select`·체크박스 포커스는 네이티브 undo가 없으니 가로챈다. 아니면 Ctrl/Cmd+Z → undo, Ctrl+Y 또는 Ctrl/Cmd+Shift+Z → redo. 좌표 집기(`coordPick`) 중엔 무시.
- 툴바에 이미 `#undo`(↶, 166행, `doUndo` 배선 521행)가 있다 — **그 버튼을 재배선**하고 옆에 `#redo`(↷) 추가. `canUndo/canRedo`로 `disabled` 갱신(`updateSaveState`에서).

## 7. 저장 상태 칩 + 복구본
- 툴바 `#saveMap` 뒤 `<span id="saveState">`: `저장됨 ✓ HH:MM` / `수정됨 · 복구본 보관 HH:MM:SS` / `저장 중…`. `updateSaveState()`가 `history.isDirty()`와 마지막 복구본 시각으로 그린다. 파일 저장 성공(`saveStageFile`/`saveMapFile`) → `history.markSaved()` + 복구본 삭제 + 칩 갱신. 붙여넣기 내보내기(`openPasteExport`)는 저장으로 치지 않는다(파일에 안 닿음).
- 복구본 키: 스테이지 모드 `tk.editor.recovery.stage:<stage.id>`, 맵 단독 모드 `tk.editor.recovery.map:<mapId>`(맵 단독 세션끼리 충돌 방지). 값 `{ savedAt: ISO, snapshot }`. push 후 **1초 디바운스**로 기록하되 **타이머가 울리는 시점에 `history.isDirty()`를 검사**하고, `history.reset()`(로드)이 대기 중 타이머를 취소한다 — 새로 연 스테이지에 엉뚱한 복구본이 남지 않게. 저장 실패(quota)는 조용히 무시(칩에 "복구본 보관 실패").
- 복원 프롬프트: `checkRecovery()`는 **진입점 4곳의 꼬리**(`loadStageFromServer`·`loadMapOnlyFromServer`·`openFile`·`doPasteLoad`)에서 **한 번** 호출(로드 함수 안에 두면 서버 로드가 맵→스테이지 두 번 부르고 첫 번째는 이전 스테이지 키로 잘못 검사). 현재 모드의 키에 복구본이 있고 `snapshot !== history.current()`면 `#recoveryBar` 표시 — "복구본 있음 (HH:MM) — 저장하지 않은 편집이 있습니다 [복원] [버리기]". 복원 → `restore(rec.snapshot)` 후 `history.reset(rec.snapshot)`(스택은 새로, 단 saved는 로드 시점 스냅샷으로 두어 dirty). 버리기 → 키 삭제. 새 스테이지(`doNew`)는 검사 안 함.
- `beforeunload`: `history.isDirty()`일 때만 경고.
- `window.__stageEditor`에 `history` 노출(검증용).

## 8. 에러·엣지
- 스냅샷 직렬화 실패(순환 등)는 발생하지 않는다(모델은 JSON 유래). 방어적으로 try/catch 후 콘솔 경고, 히스토리 push 생략.
- `restore` 중 `refreshValidation`이 다시 push하지 않도록 `restoring` 플래그.
- `loadStageObject` 안의 `setMapOnlyMode(false)` → `refreshValidation()` 호출 순서: reset은 **마지막**에 하여 로드 직후 상태가 스택의 유일 항목이 되게 한다.
- 스테이지 id를 편집하면 복구본 키가 바뀐다 — 옛 키는 남는다(무해, 다음 저장 때 새 id 키만 삭제). 범위 밖.
- 새 맵(`loadedLegend === null`)은 첫 복원 뒤 `serializeMap`이 만든 범례 객체를 갖게 되어, 지운 문자의 범례 항목이 남을 수 있다 — 무해(여분 범례), 수용.
- 맵 단독 모드에서 `refreshValidation()`이 배너를 스테이지 검증 문구로 덮어쓰는 기존 현상: 배너 갱신만 `mapOnlyMode`면 건너뛴다(push는 그대로).

## 9. 테스트
- `editor-history.test.ts`(node): dedupe(같은 스냅샷 push → false) / coalesce(`{coalesce:true}` 400ms 안 연속 push → undo 한 번에 버스트 전으로) / `{coalesce:false}`는 400ms 안이어도 별 항목 / 버스트 밖(500ms 뒤) push는 별 항목 / **undo 뒤 300ms 안 push는 병합하지 않는다**(돌아간 상태 보존) / undo·redo 왕복 / 새 push가 redo 비움 / limit 초과 시 오래된 것 제거 / reset·markSaved·isDirty(첫 reset 전 false).
- `editor-roundtrip.test.ts` 추가 1건(모듈 이름 `loadStage/serializeStage/loadMap/serializeMap` 사용): 실제 스테이지 x → `load` → 유닛 x 편집 → 스냅샷 문자열 → `parse → loadStage → serializeStage` = 편집본 `want`이고 유닛 미지 필드(`note`)가 살아 있다(복원 뒤 ORIG 재부착 증명).
- 브라우저 E2E(플랜): 지형 칠하기·유닛 이동·목표 추가·turnLimit 입력·증원 추가 → Ctrl+Z ×5 → 전부 원복 → Ctrl+Y → 재적용; turnLimit에 "12" 타이핑(두 키) = Undo 1회로 원복; 입력창 포커스 중 Ctrl+Z는 텍스트만 되돌림; 편집 후 새로고침 → 복구본 배너 → 복원 → 편집 유지; 저장(레포 밖 경로) → 칩 "저장됨 ✓", 복구본 키 삭제; Undo 뒤 저장본 = 원본 동일(P0 비교 스크립트).

## 10. 범위 밖
Project Store/Draft 버전 관리(미결 ③) · 서버 측 Autosave · 여러 탭 동시 편집 충돌 처리 · 히스토리 항목 라벨("유닛 이동" 등) 표시.
