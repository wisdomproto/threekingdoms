# P2 Creator UX — Implementation Plan

> **상태: 완료 (2026-09-12)** — Task 1~14 구현·커밋. Task 6 게이트는 `publish-gate` 테스트로 변경(리뷰).

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 스펙 `docs/superpowers/specs/2026-09-12-creator-ux-p2-design.md` — 챕터 중심 셸(Project Bar·Chapter rail·탭 재편), Story Editor v1(VN 씬·전투 중 대사), Quick Edit(탭 + 게임→에디터 진입), Publish UX(검사·변경사항·레포 쓰기·롤백), 씬 미리보기 왕복 — 를 구현하고 CDP로 검증한다.

**Architecture:** 정적 `tools/stage-editor.html` 유지. 새 로직은 `tools/editor/*.js` ES 모듈(DOM 렌더 함수 + 순수 함수, node 테스트는 `packages/data/test/editor-*.test.ts`가 상대경로 import). 서버는 `tools/serve.py`(Python stdlib). 게임 쪽은 `apps/web` 소수 파일. 모든 모델 변형은 제자리 + `refreshValidation()`(P1 히스토리).

**Tech Stack:** Vanilla ESM(브라우저 직접 로드 — 번들 없음, `.d.ts` 동반), Python 3 `http.server`, Next 15 client 컴포넌트, vitest, CDP E2E(`tools/editor/e2e/cdp.mjs`).

**Conventions:** 코드·커밋 영어(주석 한국어 OK), 트레일러 `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`, 브랜치 `feat/creator-ux-p2`, 작업 디렉터리 `C:\projects\threekingdoms`. 테스트: `pnpm --filter @tk/data test <pattern>`, `pnpm --filter @tk/web test`, `pnpm --filter @tk/web typecheck`. `stage-editor.html`은 CRLF — 파이썬 패치 시 `newline=""` 보존. 모듈 스크립트 문법 검사: HTML에서 `<script type="module">` 본문을 추출해 `node --check`.

## File Structure

| 파일 | 상태 | 책임 |
|---|---|---|
| `tools/editor/chapters.js` + `.d.ts` | 신규 | `CHAPTERS`, `stageNumber(id)`, `chapterOf(id)`, `chapterTitle(id)` |
| `tools/editor/validate-story.js` + `.d.ts` | 신규 | `validateStory(stage, { placedIds, duelIds })` |
| `tools/editor/story-model.js` + `.d.ts` | 신규 | 순수: `describeTrigger`, `newDialogueId`, `slotParts(slot)`, `collectSceneBgs(stages)`, `sceneCount(stage)` |
| `tools/editor/publish.js` + `.d.ts` | 신규 | 순수 `diffStage(before, after)`, `checklist({ localErrors, hasVictory, hasFail, missingAssets })`; DOM `renderPublishModal(...)`; fetch `publishStage/rollbackStage` |
| `tools/editor/rail.js` | 신규 | `renderRail(el, model)` |
| `tools/editor/story-editor.js` | 신규 | `renderSceneSlot`, `renderDialogueList`, 공용 `renderLines` |
| `tools/editor/quick-edit.js` | 신규 | `renderQuick` |
| `tools/editor/stage-io.js` (+ `.d.ts`) | 수정 | `KEYS.stage`에 `scenario`, `dialogue`; 로드 시 깊은 복제 |
| `tools/stage-editor.html` | 수정 | 레이아웃·Project Bar·rail·탭·URL 파라미터·모달 배선 |
| `tools/serve.py` | 수정 | `/publish-stage`, `/publish-rollback` |
| `apps/web/src/lab/{playtest.ts,PlaytestLanding.tsx,editorLink.ts}`, `apps/web/app/scene/page.tsx`, `apps/web/src/battle/hud/PauseMenu.tsx`, `apps/web/src/battle/BattleScreen.tsx`, `apps/web/.env.local.example` | 수정/신규 | 씬 미리보기·✏ 편집 진입 |
| 테스트 | 신규/수정 | `packages/data/test/editor-{chapters,story,publish}.test.ts`, `editor-roundtrip.test.ts`(+2), `apps/web/src/lab/__tests__/{editorLink,playtest}.test.ts` |
| `tools/editor/e2e/creator.mjs`, 루트 `package.json` `e2e:creator` | 신규 | CDP E2E |
| 문서 | 수정 | `tools/CLAUDE.md`, `apps/web/CLAUDE.md`, master-plan §22·부록 미결 ②, 스펙 상태 |

---

## Chunk 1: 순수 모듈 + stage-io 확장 (TDD)

### Task 1: chapters.js

- [x] **Step 1 테스트** `packages/data/test/editor-chapters.test.ts`: `CHAPTERS`가 5개, `chapterOf("05-sishuiguan")===2`, `chapterOf("27-huarong")===5`, `chapterOf("zz")===0`, `chapterTitle("05-…")==="반동탁연합"`, `stageNumber("05-sishuiguan")===5`. 그리고 **campaign.ts 대조**: `readFileSync("apps/web/src/meta/campaign.ts")`에서 `{ chapter: N, title: "…", from: a, to: b }` 5행을 정규식으로 뽑아 deepEqual(SSOT 드리프트 가드).
- [x] **Step 2** 실패 확인 → **Step 3** 구현(표 사본 + 상단 주석 "SSOT = apps/web/src/meta/campaign.ts — 바꾸면 둘 다") → **Step 4** 통과, 커밋 `feat(editor): chapter table mirror of campaign.ts`.

### Task 2: story-model.js + validate-story.js

- [x] **Step 1 테스트** `editor-story.test.ts`:
  - `describeTrigger({kind:"battleStart"}, nameOf)` → `전투가 시작되면`; `turn n:5` → `5턴이 시작되면`; `unitRetreated 유비` → `유비이(가) 퇴각하면`(조사는 `이(가)` 고정); `duelOccurred duelId` with `duelLabel` → `일기토 관우 vs 화웅이(가) 일어나면`; `battleEnd` (result 없음/`victory`/`defeat`) → `전투가 끝나면` / `전투에서 이기면` / `전투에서 지면`.
  - `newDialogueId(["dlg-1","dlg-2"])` → `"dlg-3"`; 빈 배열 → `"dlg-1"`; 비정형 id 섞여도 충돌 없음.
  - `slotParts(undefined)`→`[]`, 단일 VN→`[vn]`, 배열→그대로. `sceneCount(stage)` = intro+outro 파트 수. `collectSceneBgs([stageA, stageB])` = 정렬·중복 제거된 bg 키(파트 bg + 줄 bg).
  - `validateStory`: 정상→`[]`; VN 파트 lines 빈 배열; 줄 text 공백; dialogue id 중복; dialogue speaker 빈; `turn.n` 0; `unitRetreated.unitId` 미배치; `duelOccurred.duelId` 없음; MapScene 파트 `units` 빈 배열 → 각각 사람 말 오류 1건(문구에 `전투 전 이야기 1번째 장면 2번째 줄` 형식).
- [x] **Step 2** 실패 → **Step 3** 구현(순수, DOM 없음) → **Step 4** 통과, 커밋 `feat(editor): story model helpers + story validation`.

### Task 3: publish.js 순수부

- [x] **Step 1 테스트** `editor-publish.test.ts`: `diffStage(a, a)`→`[]`; turnLimit 변경→`{ key:"turnLimit", kind:"changed", before:30, after:25 }`; units 길이 변경→`{ key:"units", kind:"count", before:12, after:13 }`; dialogue 추가→count; scenario.intro 줄 수 변화→`{ key:"scenario.intro", kind:"lines", before:6, after:8 }`; 키 추가/삭제→`added`/`removed`; 미지 키(예 `foo`) 변화도 `changed`. `checklist({ localErrors:[], hasVictory:true, hasFail:false, missingAssets:["maps/05.webp"] })` → items 4개(필수/승패/에셋/전수) with `status: "ok"|"warn"|"error"` and `canPublish:true`; `localErrors:["x"]` → 필수 `error`, `canPublish:false`.
- [x] **Step 2** 실패 → **Step 3** 구현(`diffStage`는 최상위 키 합집합 순회, 배열은 길이 비교 + `JSON.stringify` 불일치면 `changed`, `scenario.*`는 슬롯별 줄 수) → **Step 4** 통과, 커밋 `feat(editor): publish diff + checklist (pure)`.

### Task 4: stage-io — scenario/dialogue 소유

- [x] **Step 1 테스트** `editor-roundtrip.test.ts` 추가: (a) 05 로드 → `stage.scenario.intro` 첫 줄 `text` 변경 → `serializeStage` → 그 줄만 다르고 나머지 deepEqual(미지 키 포함); ORIG 원본 객체는 **불변**(깊은 복제 확인: 원본 obj의 text가 그대로). (b) `dialogue` 카드 push → 직렬화에 포함, 다시 로드→같음. (c) scenario 없는 스테이지에서 `stage.scenario` 미설정이면 출력에 키 없음; `stage.dialogue = []`(원본에 키 없음)이면 출력에 키 없음(기존 빈 배열 규칙).
- [x] **Step 2** 실패 → **Step 3** 구현: `KEYS.stage`에 `"scenario"`, `"dialogue"` 추가(위치: `levelCap` 뒤 — 파일 관행 순서와 무관하게 merge는 orig 순서 유지); `loadStage`에서 `if (obj.scenario) m.scenario = structuredClone(obj.scenario); if (obj.dialogue) m.dialogue = structuredClone(obj.dialogue);`(`pickShallow`는 1-level만 복사하므로 별도). `merge`의 `stripNulls(v)`는 얕음 — scenario 객체에 `intro: undefined`가 남지 않게 에디터가 `delete`로 지운다(스펙 §5). `.d.ts` 갱신. → **Step 4** 전 테스트 green, 커밋 `feat(editor): stage-io owns scenario/dialogue (deep-copied) for story editing`.

### Task 5: web 순수부

- [x] `apps/web/src/lab/editorLink.ts`: `editorUrlFor(stageId, origin)`; `playtest.ts`: `parseSceneParam(v: string|null): "intro"|"outro"|"outroDefeat"|null`. 테스트 `editorLink.test.ts`(인코딩·origin 끝 슬래시 제거), `playtest.test.ts`에 3케이스. 커밋 `feat(web): editor link + playtest scene param (pure)`.

---

## Chunk 2: 서버 Publish + 게임 쪽 배선

### Task 6: serve.py `/publish-stage` · `/publish-rollback`

- [x] **Step 1**: 허용 목록에 두 엔드포인트 추가(기존 `/playtest-draft`와 같이 본문 직접 파싱 분기). 상수 `_PUBLISH_BACKUP_DIR = os.path.join(_DRAFT_DIR, "publish-backup")`, `_STAGES_DIR = ROOT/packages/data/json/stages`, `_MAPS_DIR = …/maps`, `_ID_RE = _DRAFT_ID_RE`.
- [x] **Step 2** `_publish_stage(payload)`:
  1. `stage_txt = payload.get("stage")`(str 필수, ≤5MB), `map_txt = payload.get("map")`(선택). 각각 `json.loads`로 파싱해 `id` 추출·`_ID_RE` 검사(맵은 `map.id`). 끝 개행 보장(`if not txt.endswith("\n"): txt += "\n"`).
  2. 대상 경로 계산 + 기존 파일 있으면 백업(`publish-backup/{id}.json` / `publish-backup/map-{mapId}.json`, `shutil.copyfile`). `had_backup` 기록.
  3. tmp→`os.replace` 쓰기(둘 다).
  4. **락은 0단계**: 핸들러가 `_VALIDATE_LOCK.acquire(blocking=False)` 실패면 409, 성공 시 `try/finally`로 1~5 전 구간 보호(`/publish-rollback`도 동일). `map.id`도 `_ID_RE` + `stage.mapId == map.id` 검사. 백업 파일명 `{stageId}.json`/`{stageId}.map.json` + `{stageId}.meta.json`(`wrote`, `hadBackup`, `at`). 파일 쓰기는 `open(tmp, "w", encoding="utf-8", newline="\n")`. 맵 쓰기 실패 시 스테이지 복원. 그 다음 `_validate_data()`.
  5. 실패: 백업 있으면 복원(`os.replace(backup, dest)`), 없으면 새 파일 삭제 → `{ok:false, rolledBack:true, output}`. 성공: `{ok:true, wrote:[rel paths], backup: had_backup, at: iso}`. 백업 파일은 성공 시 **유지**(롤백용).
- [x] **Step 3** `_publish_rollback(payload)`: `stageId` 검사 → 백업 존재 확인(없으면 404) → 백업을 대상으로 `os.replace`(맵 백업도 있으면 함께) → `_validate_data()` → 결과 반환. 로그 stdout.
- [x] **Step 4** 수동 검증: `python - <<EOF`로 `urllib.request`를 써 05 파일 내용을 그대로 publish → `git status --porcelain packages/data/json` 출력이 publish 전과 동일(델타 0); turnLimit 바꿔 publish → 변경 확인 → rollback → 원복·git 무변화. `python -m py_compile tools/serve.py`. 커밋 `feat(serve): publish-stage (backup→write→validate→rollback on failure) + publish-rollback`.

### Task 7: 씬 미리보기 + ✏ 편집 진입

- [x] **Step 1** `PlaytestLanding.tsx`: `scene = parseSceneParam(params.get("scene"))`; `writeLab` 뒤 `router.replace(scene ? `/scene?stage=${LAB_STAGE_ID}&type=${scene}` : `/battle?stage=${LAB_STAGE_ID}`)`.
- [x] **Step 2** `app/scene/page.tsx`: `const lab = useMemo(() => (stageId === LAB_STAGE_ID ? readLab() : null), [stageId]); const stage = lab?.stage ?? stages[stageId];` `target()`은 lab이면 특별값 → `next()`에서 `lab ? leaveSandbox((to) => router.push(to)) : fadeTo(target())`; 빈 씬 가드도 lab이면 `leaveSandbox`. `readLab`/`leaveSandbox`/`LAB_STAGE_ID` import from `../../src/lab/lab`. (`useFadeNav`는 유지.)
- [x] **Step 3** PauseMenu `editorUrl?: string` prop → 「전투 그만두기」 위 `✏ 이 스테이지 편집`(`data-testid="pause-edit-stage"`, `window.open(editorUrl, "_blank", "noopener")`). BattleScreen: `editorUrl = process.env.NODE_ENV !== "production" && !sandbox ? editorUrlFor(ctx.stage.id, process.env.NEXT_PUBLIC_TOOLS_ORIGIN ?? "http://localhost:8081") : undefined`. `.env.local.example`에 `NEXT_PUBLIC_TOOLS_ORIGIN=http://localhost:8081`(launch "tools" 포트).
- [x] **Step 4** typecheck/test green. 브라우저 스모크: `/battle` ☰ → 버튼 존재·href. 커밋 `feat(web): scene preview via playtest draft (__lab) + edit-this-stage link in pause menu`.

---

## Chunk 3: 에디터 셸 (Project Bar · rail · 탭 · 빠른 편집 · 보상)

### Task 8: 레이아웃 + Project Bar + ⚙ 메뉴 + URL 파라미터

- [x] **Step 1** `<header>` 재구성: 좌 `#crumb`(`삼국지 / 제n장 · 이름`, 맵 단독이면 `맵 · 이름`) + `<span class="badge">Draft</span>`; 중 `#undo #redo #saveState`(기존 요소 이동); 우 `#playtestBtn`(라벨 `▶ 이 장 테스트`) + `#playtestMenuBtn`(`▾`, 클릭 시 `#playtestMenu` 드롭다운: `전투 전 이야기`/`전투 후 이야기`/`패배 후 이야기` — 슬롯 없으면 `disabled`) + `#publishOpen`(`Publish…`) + `#gearBtn`(`⚙▾` → `#gearMenu`에 기존 버튼들 **이동**: `newStage openStage openMap pasteIn saveStage saveMap expBlock publishCheck` + 맵 단독 `<select>`(기존) + `#stageSelect`). 드롭다운은 body 클릭으로 닫힘. 기존 id·핸들러 불변.
- [x] **Step 2** `updateCrumb()`를 `loadStageObject`/`loadMapObject`/`setMapOnlyMode`/`updateSaveState` 뒤에 호출(간단히 `updateSaveState` 안에서 호출).
- [x] **Step 3** URL: `init()`에서 `const q = new URLSearchParams(location.search)`; `autoLoadDefault`가 `q.get("stage") || "05-sishuiguan"`; `q.get("quick") === "1"`이면 rail 접기 + `switchTab("battle:quick")`(Task 9·10 뒤 동작).
- [x] **Step 4** 문법 검사 + 브라우저 스모크(버튼 전부 메뉴 안에서 동작). 커밋 `feat(editor): project bar (crumb/draft/save/test menu/publish/gear) + ?stage/?quick params`.

### Task 9: Chapter rail

- [x] **Step 1** `tools/editor/rail.js`: `renderRail(el, { groups: [{chapter,title,stages:[{id,name,scenes}]}], currentId, collapsed, onPick, onToggle })` — DOM만. 항목 `.rail-item`(`data-stage-id`), `.on` 현재, 부제 `컷신 N · 전투`, 하단 `[◂ 접기]/[▸]`. 접힘 = 44px, 장 번호만.
- [x] **Step 2** HTML: `<aside id="rail">`를 `#left` 앞에. 로드 시 `STAGE_IDS`(기존 `<option>`에서 추출 — `Array.from(stageSelect.options).map(o=>o.value).filter(Boolean)`)로 27 JSON 병렬 fetch(`/packages/data/json/stages/{id}.json`, 실패는 `{id, name:id, scenes:0}`) → `chapters.chapterOf`로 그룹 → `renderRail`. `onPick(id)` → `loadStageFromServer(id)`. **`loadStageFromServer` 머리에 `if (history.isDirty() && !confirm('저장하지 않은 편집이 있습니다. 다른 장을 열까요?')) return;` 추가**(현재 confirm은 doNew에만 있다; rail·드롭다운 공통). 스테이지 로드 후 `currentId` 갱신(리렌더). `localStorage tk.editor.rail`.
- [x] **Step 3** 스모크 + 커밋 `feat(editor): chapter rail (5 chapters, scene counts, collapse)`.

### Task 10: 탭 재편 + 빠른 편집 + 보상

- [x] **Step 1** `.tabs` = 5탭(`data-tab`: `story-intro`, `battle`, `dialogue`, `story-outro`, `reward`); `battle` 탭 본문 상단에 서브탭 바(`data-sub`: `quick meta unit obj duel adv`). `activeTab` 문자열 `battle:quick` 등; `switchTab(t)`가 `t.split(":")`로 두 바의 `.on` 갱신. `renderTab()` 분기 확장. **기존 5 렌더 함수는 서브탭에서 그대로 호출.** 하드코딩 `switchTab('unit')` 4곳(≈479/489/606/953) → `'battle:unit'`; `setMapOnlyMode`(≈1295/1298) `'meta'` → `'battle:meta'`, 맵 단독 모드는 상단 `전투`만·서브탭 `메타`만 활성. `renderMetaTab`의 `reward` 카드 블록을 `renderRewardTab`으로 이동.
- [x] **Step 2** `tools/editor/quick-edit.js` `renderQuick(el, { stage, commanders, classes, sides, onChange, onPick(u), onPlaytest })`: 표 행(진영 점·이름·병종·`Lv [−][n][+]`·병력 input·`(x,y) 📍`) + 주 목표 문구 + turnLimit + `▶ 전투 테스트`. HTML 배선: `onChange` = `renderUnits(); refreshUnitList(); refreshValidation()`; `📍` = 기존 `coordPick` 패턴(`selUnit = u` 후 좌표 선택 → 재렌더).
- [x] **Step 3** 스모크(빠른 편집 Lv+ → 유닛 탭에서 반영·Undo) + 커밋 `feat(editor): tab regroup (story/battle/dialogue/story/reward), quick edit tab, reward tab`.

---

## Chunk 4: Story Editor v1 + Publish 모달

### Task 11: story-editor.js (씬 슬롯 + 대사)

- [x] **Step 1** `renderLines(el, lines, { narration: boolean, speakers: string[], commit, withBg })` — 줄 카드(내레이션 체크(withNarration)·화자 datalist·좌/우·초상·본문 textarea 자동높이·줄 bg(withBg)·↑↓✕) + `+ 줄 추가`(`newSceneLine`). 제자리 변형 후 `commit()`. 빈 문자열 필드(speaker/portraitId/bg/side)는 **키 삭제**; 내레이션 체크 = speaker·portraitId 삭제. 화자 입력 시 portraitId가 비어 있거나 이전 화자와 같았으면 화자로 동기.
- [x] **Step 2** `renderSceneSlot(el, { stage, key: "intro"|"outro"|"outroDefeat", label, bgOptions, assetBase, speakers, commit })`: 빈 상태 카드 → `[첫 장면 만들기]`; VN 파트 카드(배경 datalist + 썸네일 `${assetBase}/assets/scenes/{bg}.webp` onerror→"미생성") + `renderLines(withBg:true, narration:true)`; MapScene 카드(고급 JSON textarea + `적용`); 파트 `↑↓✕`, `+ VN 장면 추가`(단일 VN→배열 승격). 0파트→`delete stage.scenario[key]`, scenario 비면 `delete stage.scenario`.
- [x] **Step 3** `renderDialogueList(el, { stage, placed: [{id,name}], duels: [{id,label}], speakers, commit })`: 카드 머리 `describeTrigger`, WHEN 빌더, `renderLines(narration:false, withBg:false)`, `Advanced ▾`(id), `✕`, `+ 대사 추가`, 빈 상태.
- [x] **Step 4** HTML: `renderTab` 분기 `story-intro`/`story-outro`(outro + 접힌 `outroDefeat`)/`dialogue`. `bgOptions` = rail fetch 때 모은 27 JSON에서 `collectSceneBgs` + 현재 stage. `speakers` = commanders 이름. `validate()` 끝에 `validateStory(stage, { placedIds, duelIds })` 합류. `▶ ▾` 메뉴 항목 → 기존 playtest 핸들러를 `runPlaytest(scene)`로 리팩터(`scene` 있으면 URL에 `&scene=`; 메뉴 `disabled` = `slotParts(stage.scenario?.[key]).length === 0`).
- [x] **Step 5** 스모크: 05 intro 줄 편집 → 칩 수정됨 → Undo 복귀; `+ 대사 추가` → 카드; `▶ ▾ 전투 전 이야기` → 게임 탭 씬 재생·복귀. 커밋 `feat(editor): story editor v1 — scene slots (VN parts, MapScene advanced) and battle dialogue with trigger builder`.

### Task 12: Publish 모달

- [x] **Step 1** `publish.js` DOM: `openPublishModal({ stage, mapText, stageText, repoStage, repoMap, localErrors, probe, onPublished })` — 체크리스트(필수/승패/에셋(프로브 결과)/전수 "Publish 시 실행"), `변경사항 보기 ▾`(diffStage 사람 말 목록: `turnLimit 30 → 25`, `units 12 → 13`, `dialogue +1`, `scenario.intro 줄 6 → 8`; 맵 변경은 `맵 타일 변경됨`), `[취소] [Publish]`(오류면 disabled). Publish → `fetch('/publish-stage', {stage, map?})` → 결과 화면(성공: 경로·시각·`[롤백]`; 실패: 출력 + "자동 롤백됨") → `onPublished(result)`.
- [x] **Step 2** 에셋 프로브 `probeAssets(stage, base)`: `HEAD` `${base}/assets/maps/{stage.id}.webp`, 씬 bg들, 초상(씬 줄 `portraitId`·전투 대사 `speaker` 집합 → `/assets/ui/portraits/{id}.webp`) → 누락 목록(`fetch(..., {method:"HEAD"})` — serve.py는 stdlib `SimpleHTTPRequestHandler`라 HEAD 지원). 실패(네트워크)는 "확인 불가" 경고 1건.
- [x] **Step 3** HTML: `#publishOpen` → `localErrors = validate()`(story 포함), `repoStage` = `loadStageFromServer`가 받은 원본 객체를 캐시(`repoStageCache`)해 재사용(없으면 fetch; 404면 null → 체크리스트에 "! 새 스테이지 — index.ts 등록 필요" 경고), `repoMap` 동일; `mapText`는 `serializeMap()`이 repoMap과 다를 때만 전달. 성공 시 `history.markSaved(); clearRecovery(); lastSavedAt=…; updateSaveState()`. 맵 단독 모드에선 Publish 비활성(맵만 publish는 범위 밖 — 안내).
- [x] **Step 4** 스모크: 05 무변경 Publish → 성공·`git status` 무변화; turnLimit 변경 Publish → 파일 반영 → 롤백 → 원복. 커밋 `feat(editor): publish modal — checklist, diff, repo write with validate + rollback`.

---

## Chunk 5: E2E + 문서

### Task 13: `tools/editor/e2e/creator.mjs`

- [x] 스펙 §11 ①~⑦ 구현(cdp.mjs 하네스: 자체 Chrome :9334 + serve.py :8095, next dev :3000 필요). 게임 origin은 에디터의 `GAME_ORIGIN`(3000). Publish 단계는 사전 `execSync('git status --porcelain packages/data/json')` 기록 → **05 무변경** Publish → 같은 출력(델타 0) → turnLimit 변경 Publish → 파일의 turnLimit 확인 → `[롤백]` → 원복·git 무변화. 종료 시 `apps/web/public/_draft/publish-backup` 삭제. 루트 `package.json` `"e2e:creator"`. PASS까지 실행. 커밋 `test(editor): CDP e2e — creator shell, story editor, quick edit, publish/rollback`.

### Task 14: 문서

- [x] `tools/CLAUDE.md`(도구 지도: 셸 구조·모듈 목록·Publish 엔드포인트·URL 파라미터·E2E), `apps/web/CLAUDE.md`(씬 미리보기 `__lab`·`NEXT_PUBLIC_TOOLS_ORIGIN`·PauseMenu 편집 링크), master-plan §22 P2 4항목 ✅(Story Editor = v1, v2는 포맷 결정 후) + 부록 미결 ② 갱신, 스펙·플랜 상태 줄. 커밋 `docs: creator UX P2 done`.
