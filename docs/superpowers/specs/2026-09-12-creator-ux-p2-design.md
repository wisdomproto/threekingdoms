# P2 Creator UX — 챕터 중심 셸 · Story Editor v1 · Quick Edit · Publish UX (2026-09-12)

> **상태: 구현 완료 (2026-09-12)** — `feat/creator-ux-p2`. 리뷰 반영: Publish 게이트는 전체 스위트가 아니라 `test/publish-gate.test.ts`(디스크 전수 스키마 + 참조 무결성 — 05 콘텐츠 회귀 테스트가 정당한 편집을 막지 않게), scene 페이지 `readLab`은 마운트 효과(hydration), 맵 에셋 프로브 키 = `stage.mapId`, 씬 미리보기는 이야기 오류만 검사. E2E `tools/editor/e2e/creator.mjs`.

> master-plan §14(EDIT↔PLAY 왕복·▶ 이 장 테스트·✏ 이 스테이지 편집), §15(Quick/Full), §16(챕터 중심 UX ①전투 전 이야기 ②전투 ③전투 후 이야기), §17(Story Editor), §22 P2. design-guide §4(Desktop Layout·Project Bar·Save states·Inspector language·Playtest 복귀), §5(Terrain palette·Character picker·Event builder·Empty states), §13(Publishing UX). 벤치마크 §10("현재 HTML 도구를 살리는 점진 통합 — UI 프레임워크 전환 자체를 목표로 삼지 않는다"), §11.2(이벤트 정의의 진실 = 단일 카탈로그). 목업 = docs/design/creator-shell-mockup.md. 부록 A #3(모션코믹 전환은 도구와 함께 — 도구 없이 포맷만 또 바꾸지 않는다), #11(같은 콘텐츠 계약 + 불변 Playtest 스냅샷).

## 1. 문제

`tools/stage-editor.html`(1,421줄, 단일 모듈 스크립트)은 P0/P1로 무손실·Undo/복구본·Playtest를 갖췄지만 여전히 **"스테이지 JSON 편집기"**다.
- 스테이지는 27개 `<option>` 드롭다운(챕터 개념 없음), 스토리(`scenario`)·전투 중 대사(`dialogue`)는 **편집 UI가 없다**(보존만). 파일 열기/저장/블록아웃 등 개발자 버튼 11개가 툴바를 차지한다.
- "Publish 검사"는 **레포에 저장된 파일**을 zod 전수 검사할 뿐이라 편집 중인 초안과 무관하고, 검사→저장(파일 피커)→검사 사이에 사람이 개입한다. 변경사항·롤백 개념이 없다.
- 게임에서 에디터로 가는 역방향(§14 `✏ 이 스테이지 편집`)이 없다. 빠른 수정(유닛 위치/레벨/병력)은 5개 탭을 오가야 한다.

성공 기준: 좌측 **장 목록**에서 장을 고르면 상단 Project Bar에 `삼국지 / 제2장 · 사수관 전투 · Draft · 저장됨 ✓`가 뜨고, 우측 패널 탭이 `전투 전 이야기 · 전투 · 전투 중 대사 · 전투 후 이야기 · 보상`이다. 이야기 탭에서 줄을 고치고 **▶ 이 장 테스트 ▾ → 전투 전 이야기**를 누르면 게임 탭에 그 대사가 재생되고 끝나면 에디터로 돌아온다. 게임 일시정지 메뉴(dev)의 `✏ 이 스테이지 편집`은 에디터를 그 장의 **빠른 편집** 탭으로 연다. **Publish…**는 초안을 검사(필수 데이터/승패조건/에셋/전수 검사)하고 변경사항을 보여준 뒤 레포 JSON에 쓰며, 실패 시 자동 롤백·성공 후 롤백 버튼이 있다. 전부 실제 Chrome(CDP)로 검증.

## 2. 결정

- **정적 HTML 유지, 코드는 ES 모듈로 분리.** 새 기능은 `tools/editor/*.js`(rail·story·quick·publish)에 DOM 렌더 함수로 쓰고 HTML은 컨테이너+배선만 갖는다(stage-io/history 관례). React 전환 없음(벤치마크 §10).
- **챕터 = campaign.ts `CHAPTERS` 표의 사본**(`tools/editor/chapters.js`, 5행). SSOT는 `apps/web/src/meta/campaign.ts` — 표를 바꾸면 둘 다(주석으로 명시; 테스트가 두 표를 대조).
- **Story Editor v1 = 런타임이 지금 재생하는 포맷을 편집**한다: VN 씬(`ScenarioScene` — bg·줄·내레이션·줄 배경 전환)과 전투 중 대사(`StageDialogue` — 트리거+줄). MapScene 파트는 **고급(JSON) 카드**로 보존·편집. 타임라인·Zoom/Pan/Shake·음성/BGM(§17 모션코믹)은 **포맷 결정(미결 ②·부록 #3) 뒤 Story Editor v2** — 도구 없이 포맷을 또 바꾸지 않는다는 원칙의 역도 같다: 포맷 없이 도구를 먼저 만들지 않는다.
- **Quick Edit = 탭 하나 + 진입 URL.** 별도 앱이 아니라 `전투` 그룹의 첫 탭 「빠른 편집」(유닛 Lv/병력/좌표 + 주 목표 + 제한 턴). `?stage=ID&quick=1`로 열면 rail을 접고 그 탭을 편다. 게임 PauseMenu(dev·non-sandbox)에 `✏ 이 스테이지 편집` = `${NEXT_PUBLIC_TOOLS_ORIGIN ?? "http://localhost:8080"}/tools/stage-editor.html?stage=…&quick=1` 새 탭.
- **Publish = 초안을 레포 JSON에 쓰고 전수 검사, 실패 시 롤백.** 1인 개발·Project Store 이연(미결 ③) 상태에서 "Published"는 **레포의 `packages/data/json`**이고 버전 이력은 git이다. serve.py에 `POST /publish-stage`(백업→쓰기→`_validate_data()`→실패면 백업 복원) + `POST /publish-rollback`. 파일 바이트는 에디터 직렬화 그대로(2칸 들여쓰기·끝 개행·`newline="\n"`) — 보장은 **git 수준**(변경 없는 Publish 전후 `git status --porcelain packages/data/json`이 같다). 작업 트리 일부 JSON이 CRLF(autocrlf)라 "바이트 동일"은 그 파일들에선 성립하지 않는다.
- **씬 미리보기 = 기존 Playtest 스냅샷 재사용.** 스냅샷의 `stage`에 `scenario`가 이미 들어 있다. `/playtest?draft=X&scene=intro|outro|outroDefeat` → `/scene?stage=__lab&type=…`; scene 페이지가 `__lab`이면 `readLab().stage`를 쓰고, 끝나면 `leaveSandbox`(에디터 탭 복귀).

## 3. 파일

| 파일 | 역할 |
|---|---|
| `tools/stage-editor.html` (수정) | 레이아웃 3열+Project Bar(§4), 탭 재편(§5), `?stage`·`?quick` 파라미터, 모듈 배선. 기존 렌더 함수(메타/유닛/목표/일기토/증원)는 유지 |
| `tools/editor/chapters.js` (신규) | `CHAPTERS`(campaign.ts 사본), `chapterOf(stageId)`, `stageNumber` |
| `tools/editor/rail.js` (신규) | `renderRail(el, { stages: [{id,name,scenes,current}], onPick })` — 챕터별 그룹·현재 표시·컷신 수·접기 |
| `tools/editor/story-editor.js` (신규) | `renderSceneSlot(el, slot, ctx)`(VN 파트·MapScene 고급 카드·파트 추가/삭제/이동), `renderDialogueList(el, dialogues, ctx)`(WHEN 빌더+줄), `newDialogueId`, 순수 `describeTrigger(trigger, nameOf)` |
| `tools/editor/quick-edit.js` (신규) | `renderQuick(el, stage, ctx)` — 유닛 표(Lv 스테퍼·병력·좌표 pick)·주 목표 요약·turnLimit·▶ 버튼 |
| `tools/editor/publish.js` (신규) | 순수 `diffStage(before, after)`(최상위 키 추가/삭제/변경 + units/dialogue/scenario 개수 델타), `checklist(stage, map, localErrors, assetProbe)`; `runPublish(snapshot, origin)` fetch 래퍼 |
| `tools/editor/validate-story.js` (신규) | 순수: `validateStory(stage, placedIds, duelIds)` → 오류 목록(씬 줄 0개·빈 text·트리거 참조 없음·dialogue id 중복). `validate()`가 합친다 |
| `tools/serve.py` (수정) | `POST /publish-stage {stage: string, map?: string}`(§7), `POST /publish-rollback {stageId}`, 허용 목록 갱신 |
| `apps/web/src/lab/PlaytestLanding.tsx` (수정) | `scene` 파라미터 → `/scene?stage=__lab&type=…` |
| `apps/web/app/scene/page.tsx` (수정) | `stageId === LAB_STAGE_ID` → `readLab()?.stage`; 종료 = `leaveSandbox` |
| `apps/web/src/battle/hud/PauseMenu.tsx` (수정) | dev·non-sandbox `✏ 이 스테이지 편집`(새 탭) — `editorUrl` prop은 BattleScreen이 만든다 |
| `apps/web/src/lab/editorLink.ts` (신규) | 순수 `editorUrlFor(stageId, toolsOrigin)` |
| `apps/web/.env.local.example` (수정) | `NEXT_PUBLIC_TOOLS_ORIGIN` |
| 테스트 | `packages/data/test/editor-chapters.test.ts`(campaign.ts 표와 동일), `editor-story.test.ts`(describeTrigger·validateStory·newDialogueId), `editor-publish.test.ts`(diffStage·checklist); `apps/web` `lab/__tests__/editorLink.test.ts`, playtest.test 확장(scene 파라미터 파싱) |
| `tools/editor/e2e/creator.mjs` (신규) | CDP: rail·탭·스토리 편집 Undo·씬 미리보기 왕복·빠른 편집·Publish(무변경→git 무변화, 변경→롤백) |
| 문서 | `tools/CLAUDE.md`, `apps/web/CLAUDE.md`, master-plan §22 P2 ✅, 부록 미결 ② 갱신(Story Editor v1 착수·v2=포맷 결정 후) |

## 4. 레이아웃 (design-guide §4 Desktop)

```
┌ Project Bar ──────────────────────────────────────────────────────────────┐
│ 삼국지 / 제2장 · 사수관 전투   [Draft]   ↶ ↷   저장됨 ✓ 14:28   [▶ 이 장 테스트 ▾] [Publish…] [⚙▾] │
├ #rail 220px ┬ #left 178px ┬ #stage(workspace) ──────────────┬ #right 340px ┤
│ 제1장 황건적 │ 지형/유닛    │        격자 맵(기존)             │ 탭: 전투 전 이야기 │
│  01 탁군    │ 팔레트(기존) │                                 │     전투 ▾        │
│  02 영천 ●  │             │                                 │     전투 중 대사   │
│ 제2장 …     │             │                                 │     전투 후 이야기 │
│  05 사수관 ◀│             │                                 │     보상          │
│ [◂ 접기]    │             │                                 │  (탭 본문)         │
└─────────────┴─────────────┴─────────────────────────────────┴───────────────┘
```

- **Project Bar** = 기존 `<header>` 재구성. 브레드크럼 `삼국지 / 제{n}장 · {stage.name}`(맵 단독 모드면 `맵 · {mapName}`), `Draft` 배지(상시), ↶↷(기존 `#undo/#redo`), `#saveState` 칩(기존), **`▶ 이 장 테스트 ▾`** = 기본 클릭 전투(기존 `#playtestBtn`), 드롭다운 항목 `전투 전 이야기`/`전투 후 이야기`/`패배 후 이야기`(해당 슬롯 없으면 비활성), **`Publish…`**(§7), **`⚙▾`** 메뉴에 기존 개발자 버튼(새로·스테이지 열기·맵 열기·붙여넣기·⬇ stage JSON·⬇ map JSON·⬇ 블록아웃 PNG·Publish 검사(레포 전수)·맵 단독 선택). 기존 버튼 id는 유지(E2E·핸들러 불변) — 위치만 메뉴 안으로.
- **Chapter rail** `#rail`: `chapters.js`로 5장 그룹, 항목 = `{번호} {이름}` + 부제 `컷신 {intro+outro 파트 수} · 전투`. 현재 장 `.on`. 클릭 → `loadStageFromServer(id)` — **여기에 `history.isDirty() && !confirm(...)` 가드를 추가**(현재는 `doNew`만 확인한다; rail·드롭다운 공통). 스테이지 id 목록의 출처 = 기존 `#stageSelect`의 `<option>` 값(하드코딩 27개 — 인덱스 파일이 없다); 그 id로 27개 JSON을 로드 시 1회 병렬 fetch해 이름·컷신 수를 채운다(실패 항목은 id만). `[◂ 접기]`로 44px 아이콘 열로 축소(`localStorage tk.editor.rail=collapsed`). `?quick=1`이면 접힌 채 시작. 기존 `#stageSelect`는 ⚙ 메뉴의 "맵 단독 선택" 옆으로 이동(맵 단독 드롭다운은 그대로).
- Inspector는 우측 `#right` 유지(목업의 하단 탭+우측 Inspector 2단 구조는 우측 패널 하나로 합친다 — 340px 안에 탭 본문이 곧 인스펙터).
- 지형 팔레트: 이미 색 견본 + 이름(§5 충족). 변경 없음.

## 5. 탭 재편

`#right .tabs` = `전투 전 이야기` · `전투` · `전투 중 대사` · `전투 후 이야기` · `보상`. `전투` 탭 안에 2단 서브탭 `빠른 편집 · 메타 · 유닛 · 목표/패배 · 일기토 · 증원/전략`(기존 5탭 + 빠른 편집). `activeTab` 값은 `story-intro | battle:quick | battle:meta | … | dialogue | story-outro | reward`. `renderTab()`이 분기; `switchTab(t)`는 `t.split(':')`로 상·하 탭 바의 `.on`을 갱신. **하드코딩 호출부 갱신**: `switchTab('unit')` 4곳(≈479/489/606/953) → `'battle:unit'`; `setMapOnlyMode`(≈1295/1298)는 `'meta'` → `'battle:meta'`로, 맵 단독 모드에선 `battle:meta`만 활성(상단 5탭 중 `전투`만 활성·서브탭은 메타만). 기존 메타 탭의 `reward` 카드는 **보상 탭으로 이동**(전략조건 보상은 증원/전략에 남긴다).

**전투 전/후 이야기 탭** (`story-editor.renderSceneSlot`): 슬롯 = `stage.scenario?.[intro|outro]`(후 탭은 `outro` + 접힌 `outroDefeat` 섹션). 빈 슬롯 = 빈 상태 카드 "아직 이야기가 없습니다 **[첫 장면 만들기]**"(§5 Empty states) → `newVnPart()` = `{ lines: [{ text: "" }] }`(**`bg`는 비어 있으면 키 자체를 쓰지 않는다** — `/assets/scenes/.webp` 방지). 슬롯이 단일 VN이면 그대로(배열로 승격하지 않음 — 무손실), 파트 배열이면 파트 카드 나열.
- VN 파트 카드: `배경` 입력(`<datalist>` = 전 스테이지 scenario에서 수집한 bg 키 54개 + 현재 값; 옆에 48px 썸네일 `/apps/web/public/assets/scenes/{bg}.webp`, 없으면 회색 "미생성"), 줄 목록. 줄 = `[내레이션 ☐] 화자(datalist=commanders 이름) · 좌/우(side, 화자 있을 때) · 초상(portraitId, 기본=화자 → 빈칸이면 미기록) · 본문(textarea, 자동 높이) · 이 줄부터 배경(bg, 선택)` + `↑ ↓ ✕`, 끝에 `+ 줄 추가`. 내레이션 체크 = `speaker`·`portraitId` 삭제, 해제 = `speaker`를 입력받되 **빈 문자열이면 키를 쓰지 않는다**(런타임 `isNarration = !line.speaker`라 `""`도 내레이션 — 파일에 무의미한 `"speaker": ""`를 남기지 않는다; validate-story가 "speaker가 있으면 비어 있지 않음"을 검사). 새 줄의 `portraitId`는 화자와 같게 기록(기존 데이터 관행). 미지 키는 건드리지 않는다(줄 객체를 그대로 변형).
- MapScene 파트 카드(`"map" in part`): 제목 `맵 씬 (고급) — {label ?? map}`, 접힌 `<textarea>` JSON. `적용` 버튼 → `JSON.parse` 성공 시 파트 교체(실패면 인라인 오류, 미적용). 파트 배열 안에서만 존재. 새로 만들기는 제공하지 않는다(맵 씬 저작은 `/motion-editor`·수기 — v2).
- 파트 추가: `+ VN 장면 추가`(단일 VN 슬롯이면 `[기존, 새]` 배열로 승격 — 사용자가 명시적으로 두 번째 파트를 만든 것이므로 형식 변경 OK), 파트 `↑ ↓ ✕`. 파트가 0개가 되면 슬롯 키 삭제(`delete stage.scenario.intro`; scenario가 비면 `delete stage.scenario`).
- 모든 변형 끝에 `ctx.commit()` = `refreshValidation()`(히스토리 진입). textarea/input은 `oninput` → 타이핑 병합.

**전투 중 대사 탭** (`renderDialogueList`): `stage.dialogue ?? []` 카드 목록. 카드 머리 = 사람 말 `describeTrigger`: `전투가 시작되면` / `{n}턴이 시작되면` / `{이름}이(가) 퇴각하면` / `일기토 {공격자} vs {방어자}가 일어나면` / `전투가 끝나면(승리|패배|모두)`. WHEN 빌더 = `<select>`(battleStart/turn/unitRetreated/duelOccurred/battleEnd) + 종속 입력(턴 숫자 / 배치 유닛 select / 일기토 select(`stage.events`) / 결과 select). 줄 편집기는 씬과 같은 컴포넌트(`bg` 없음, `speaker` 필수 — 내레이션 체크 없음). id는 `Advanced ▾` 접힘 안에 표시(수정 가능, 중복은 validate 오류). `+ 대사 추가` → `{ id: newDialogueId(existing), trigger: { kind: "battleStart" }, lines: [{ speaker: "", text: "" }] }`(validate가 빈 화자를 오류로 잡아 Publish를 막는다). 카드를 전부 지우면 `stage.dialogue = undefined`(원본에 키가 있었어도 빈 배열 대신 키 삭제 — scenario 규칙과 동일). 빈 상태 카드.

**보상 탭**: 기존 `reward` 카드(gold/exp/treasures) 그대로 이동 + 안내 "전략조건 보물은 전투 › 증원/전략에서".

**빠른 편집 탭** (`quick-edit.renderQuick`): 표 — 배치 유닛 전부(`stage.units`) 행 = 진영색 점 · 이름(commanders) · 병종 · `Lv [−][n][+]` · 병력 input · `(x,y)` `📍`(기존 `coordPick`) ; 아래 `주 목표` 한 줄(`objectiveText`와 같은 한국어 규칙은 게임 코드에 있으므로 여기선 kind별 간단 문구: 전멸/`{이름}` 격파/`(x,y)` 도달/`n`턴 생존) + `제한 턴` input + `▶ 전투 테스트` 버튼(기존 핸들러). 증원 유닛은 제외(전투 탭에서). 변형은 유닛 탭과 같은 필드 대입 + `renderUnits(); refreshUnitList(); refreshValidation()`.

## 6. 미리보기(씬) 왕복

- 에디터: `▶ ▾` 항목 클릭 → 기존 플레이테스트 핸들러에 `scene` 인자(`'intro'|'outro'|'outroDefeat'`) → 스냅샷 동일, `window.open(`${GAME_ORIGIN}/playtest?draft=${draftId}&scene=${scene}`)`.
- `PlaytestLanding`: `scene` 파라미터가 유효하면 `router.replace(`/scene?stage=__lab&type=${scene}`)`, 아니면 기존 `/battle`.
- `scene/page.tsx`: `const lab = useMemo(() => (stageId === LAB_STAGE_ID ? readLab() : null), [stageId])`(렌더마다 새 객체가 되어 `parts` 메모가 깨지지 않게); `const stage = lab?.stage ?? stages[stageId]`; `target()`이 `__lab`이면 `leaveSandbox`로 종료(`fadeTo` 대신 `leaveSandbox((to) => router.push(to))`); 슬롯 비었으면(빈 씬 가드) 즉시 `leaveSandbox`. `readLab`은 sessionStorage라 클라이언트 전용 — 이 페이지는 이미 `"use client"`. `stage?.name` 제목 유지.
- 편집 상태 유지(§4 Playtest 복귀): 에디터 탭이 그대로 살아 있으므로 선택·탭·카메라 전부 유지(P1과 동일 — 추가 작업 없음).

## 7. Publish UX (design-guide §13)

**모달 `#publishModal`** (Publish… 클릭):
```
사수관 전투 → packages/data/json/stages/05-sishuiguan.json
✓ 필수 데이터        (validate() + validateStory 오류 0)
✓ 승패조건           (objectives|victory 있음; failConditions 없으면 ! 경고)
! 에셋 2개 경고       (painted 맵 배경 없음 · 씬 배경 05-x-intro 없음 · 초상 N명 없음)  ← 서버 HEAD 프로브
✓ 전수 검사           (Publish 시 서버가 수행 — 사전엔 "Publish 시 실행")
[변경사항 보기 ▾]  meta: turnLimit 30→25 · units 12→13 · dialogue +1 · scenario.intro 줄 6→8
[취소]  [Publish]
```
- 체크 항목 중 **오류(✗)가 있으면 Publish 비활성**(경고 `!`는 허용). 에셋 프로브 = `fetch(HEAD)` `/apps/web/public/assets/{maps/{stageId}.webp | scenes/{bg}.webp | ui/portraits/{id}.webp}` — 초상 키는 **씬 줄은 `portraitId`, 전투 대사는 `speaker`**(런타임이 그렇게 읽는다). 없으면 경고(§13 "누락 에셋" — 출시 게이트가 아니라 경고. R2 직독 배포에선 로컬에 없을 수 있음). 새 스테이지(레포에 파일 없음)면 체크리스트에 `! index.ts 등록 필요 — 전수 검사가 이 파일을 보지 않음` 경고.
- 변경사항 = `diffStage(repoJson, JSON.parse(serializeStage()))` — 레포 원본은 `/packages/data/json/stages/{id}.json` fetch(없으면 "새 스테이지 — index.ts 등록 필요" 안내). 맵도 `serializeMap()` vs 레포 맵 비교 → 바뀌었으면 함께 쓴다.
- **Publish** → `POST /publish-stage { stage: <serializeStage() 문자열>, map?: <serializeMap()> }`:
  0. **`_VALIDATE_LOCK`을 먼저 잡는다**(비차단; 실패면 409 "검사/Publish 진행 중") — 백업→쓰기→검사→복원 전 구간을 잠근다(`/publish-rollback`도 동일). 락은 지금 `/validate-data` 핸들러에 있고 `_validate_data()` 안에 없다.
  1. 서버: `stage` JSON 파싱 → `id` 검증(`^[A-Za-z0-9_-]+$`), `map`이 오면 `map.id`도 같은 검사 + `stage.mapId === map.id` 확인, 크기 5MB, 경로 `packages/data/json/stages/{id}.json`(맵은 `maps/{map.id}.json`). 기존 파일이 있으면 `apps/web/public/_draft/publish-backup/{stageId}.json`·`{stageId}.map.json`으로 백업하고 `{stageId}.meta.json`에 `{ wrote:[rel paths], hadBackup:{stage,map}, at }`를 기록(롤백이 짝을 찾는 근거). tmp→`os.replace`로 쓴다 — **`open(..., "w", encoding="utf-8", newline="\n")`**(Windows에서 `\n`→`\r\n` 변환 방지), 끝 개행 보장. 맵 쓰기가 실패하면 스테이지를 백업으로 되돌린다.
  2. `_validate_data()`(기존 pnpm test, `_VALIDATE_LOCK`) → `ok:false`면 **백업 복원** 후 `{ ok:false, rolledBack:true, output }`. 성공이면 `{ ok:true, wrote:[paths], backup: bool, validated: true, at }`.
  3. 새 파일(백업 없음)이 검사 실패면 새 파일 삭제.
- 모달 결과 화면: `Publish 완료 · 14:32 · 05-sishuiguan.json(+ map) · 검사 통과` + `[롤백]`(백업 있을 때: `POST /publish-rollback {stageId}` → 백업을 되돌리고 다시 `_validate_data()`) + "버전 이력은 git — `git log -- packages/data/json/stages/05-sishuiguan.json`". 실패 화면: 검사 출력 + "자동 롤백됨".
- Publish 성공 시 에디터 상태: `history.markSaved(); clearRecovery(); lastSavedAt` 갱신(칩 `저장됨 ✓`), 레포 원본 캐시 갱신(다음 변경사항 비교 기준). 파일 피커 저장(⬇)은 그대로 남는다(외부 파일 내보내기 용도).

## 8. Quick Edit 진입 (게임 → 에디터)

- `editorUrlFor(stageId, origin)` = `${origin}/tools/stage-editor.html?stage=${encodeURIComponent(stageId)}&quick=1`.
- `BattleScreen`: `process.env.NODE_ENV !== "production" && !sandbox`면 `editorUrl = editorUrlFor(ctx.stage.id, process.env.NEXT_PUBLIC_TOOLS_ORIGIN ?? "http://localhost:8080")`을 PauseMenu에 전달. PauseMenu: `editorUrl`이 있으면 「전투 그만두기」 위에 `✏ 이 스테이지 편집` 버튼(`window.open(editorUrl, "_blank")`, `data-testid="pause-edit-stage"`). 전투는 계속 일시정지 상태(플레이어가 돌아와 이어감).
- 에디터: `init()`에서 `URLSearchParams` `stage` → `autoLoadDefault(stage)`(없으면 기존 05), `quick=1` → rail 접기 + `switchTab('battle:quick')`.
- `.env.local.example`에 `NEXT_PUBLIC_TOOLS_ORIGIN=http://localhost:8081  # tools/serve.py 포트(launch "tools"=8081)`. 코드 기본값도 `http://localhost:8081`.

## 9. 검증 규칙 추가 (`validate-story.js`, `validate()`에 합류)

- 씬: 슬롯의 각 VN 파트 `lines.length ≥ 1`, 각 줄 `text` 비어 있지 않음(공백만도 오류), 파트 배열이 비면 슬롯 자체가 없어야 함(에디터가 보장). MapScene 파트는 `map`·`units≥1`·`lines≥1`만 확인(나머진 서버 zod).
- 대사: `id` 비어 있지 않음·중복 없음, `lines ≥ 1`·`speaker`/`text` 비어 있지 않음, `trigger.turn.n ≥ 1`, `unitRetreated.unitId ∈ 배치 유닛(증원 포함)`, `duelOccurred.duelId ∈ stage.events[].id`.
- 오류 문구는 사람 말(`전투 전 이야기 2번째 장면 3번째 줄: 본문이 비어 있습니다`).

## 10. 히스토리·무손실 계약

- 스토리/대사/보상/빠른 편집의 모든 변형은 모델 객체를 **제자리 변형**하고 `refreshValidation()`을 부른다 → P1 히스토리·복구본이 그대로 적용(테스트: Undo 후 `serializeStage()`가 편집 전과 같다).
- `stage-io.js` `KEYS.stage`에는 **`scenario`·`dialogue`가 없다**(사실) — 모델에 두 키가 없어 제자리 편집이 직렬화에 반영되지 않는다. **KEYS에 두 키를 추가**하고 `loadStage`에서 `structuredClone`으로 깊은 복제(ORIG 불변·Undo 복원은 `loadStage(JSON.parse)`라 무관). `merge()`는 `model[k]` 우선이라 그 값이 나간다. `editor-roundtrip.test.ts`에 "scenario 줄 수정 후 저장 → 그 줄만 바뀜, 미지 키·원본 보존", "dialogue 추가", "키 없음 유지" 케이스 추가. 단일 VN → 파트 배열 승격 시 그 VN은 `ScenarioSceneSchema.strict()` 대상이 된다(미지 키가 있었다면 Publish 검사에서 드러남 — 드묾, 감수).

## 11. 테스트

- 순수(`packages/data/test`): `editor-chapters.test.ts`(CHAPTERS가 campaign.ts와 동일 — campaign.ts를 import할 수 없으면 표 상수를 `packages/data`에 두지 말고 apps/web 테스트에서 `tools/editor/chapters.js`를 import해 대조), `editor-story.test.ts`(describeTrigger 5종·validateStory 8케이스·newDialogueId 유일), `editor-publish.test.ts`(diffStage: 키 추가/삭제/변경·units 개수·scenario 줄 수·동일→빈 배열; checklist: 오류→publish 불가·경고만→가능).
- `apps/web`: `editorLink.test.ts`(URL 인코딩), `playtest.test.ts`에 `scene` 파라미터 정규화(`parseSceneParam("intro")→"intro"`, 그 외 null).
- E2E `tools/editor/e2e/creator.mjs`(cdp.mjs 하네스 + next dev :3000): ① rail 5장/27항목·현재 `.on` ② rail에서 `06-huluguan` 클릭 → 브레드크럼 `제2장 · 호로관…` ③ `전투 전 이야기` 탭 → 첫 줄 본문에 문자열 추가 → `history.canUndo()`·칩 `수정됨` → `▶ ▾ 전투 전 이야기` → 새 탭 `/scene?stage=__lab&type=intro` → 화면 텍스트에 추가한 문자열 포함 → 끝까지 클릭 → 탭 닫힘·에디터 x 유지 ④ `전투 중 대사` `+ 대사 추가` → 카드 머리 `전투가 시작되면` → Undo → 카드 사라짐 ⑤ `?stage=05-sishuiguan&quick=1`로 재진입 → rail 접힘·빠른 편집 탭 활성·Lv `+` → 유닛 level +1 ⑥ Publish: `git status --porcelain packages/data/json`을 **먼저 기록**하고 05를 **무변경**으로 Publish → `ok:true` → 같은 명령 출력이 동일(델타 0) → turnLimit 변경 후 Publish → 파일 반영 확인 → `[롤백]` → 파일 원복·git 무변화 ⑦ 게임 `/battle` ☰ → `pause-edit-stage` 존재(dev). 실행 후 `_draft/publish-backup` 정리.

## 12. 범위 밖

타임라인/모션코믹 Story Editor v2(포맷 결정 후), 캐릭터 정의 편집(character-editor.html 별도 유지), 이벤트 카탈로그(§11.2 — 트리거 5종은 스키마 유니온이 곧 카탈로그), Draft/Published 이중 버전·Project Store(미결 ③), 다국어, 모바일 저작(§10), rail 썸네일 이미지, 목표 클릭 하이라이트.
