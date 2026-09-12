# Project Store v1 — 로컬 Draft/Published + 자동 저장 (2026-09-12)

> **상태: 구현 완료 (2026-09-12)** — 통합 브랜치 `feat/battle-mobile-hud`. 추가 결정: undo로 레포와 같아지면 Draft를 디바운스 없이 즉시 삭제(유령 Draft 방지), 파일/붙여넣기/새로 로드도 서버 index의 revision을 물려받음(409 오탐 방지), 오프라인 E2E는 죽은 포트 대신 페이지 내 `fetch` 몽키패치(`/draft-save`만 reject). 실브라우저 E2E `tools/editor/e2e/draft.mjs` 40건 PASS(`pnpm e2e:draft`).

> master-plan §12 Project Store("Runtime → 읽기 / Editor → 같은 Store 수정 / Playtest → 현재 Draft / Publish → Draft 검증 후 Published"), §13 Draft/Published("제작 중 변경이 서비스 버전을 망가뜨리지 않게"), §16 Autosave(`저장 중… → 저장됨 ✓`), §22 P1 "Project Store·Draft". design-guide §4 Save states(`저장 중… / 저장됨 ✓ / 오프라인 — 로컬에 보관됨 / 저장 실패 — 다시 시도`), 벤치마크 §10 저장 정책("로컬 복구본 저장"과 "서버에 저장"을 다른 상태로 표시; 병합 불가 다중 탭 변경은 조용히 덮어쓰지 않는다). 부록 미결 ③ "저작도구 공개 형태(Project Store가 로컬 JSON인지 Supabase인지)".

## 1. 결정 (미결 ③)
**로컬 우선.** 1인 개발·정적 도구·Supabase 미도입 상태에서 Project Store v1 = **serve.py가 관리하는 파일**: Published = `packages/data/json`(git), Draft = `apps/web/public/_draft/stages/{id}.json` + `maps/{mapId}.json`(gitignore, 이미 존재하는 `_draft/`). 저장 상태 3층 = **로컬 복구본(localStorage, 크래시용) → Draft(서버 파일, 자동 저장) → Published(레포, Publish)**. 클라우드(Supabase)는 같은 4개 엔드포인트를 어댑터로 바꾸면 되는 자리 — 지금 짓지 않는다.

## 2. 문제
현재 "저장"은 브라우저 파일 피커(`showSaveFilePicker`)라 ①어디에 저장했는지 에디터가 모르고 ②다음에 열면 레포 파일(Published)이 뜨며 ③자동 저장이 없어 복구본(localStorage)만이 크래시 방어선이다. Draft라는 개념이 없어 "편집 중인 것"과 "게임이 플레이하는 것"의 구분이 저장 칩에 보이지 않는다.

성공 기준: 편집을 멈추면 1.5초 뒤 칩이 `저장 중…` → `Draft 저장됨 ✓ 14:32`로 바뀌고, 탭을 닫았다 열면 그 Draft가 그대로 뜬다(레포와 다르면 `Draft` 배지 + `Published와 다름`). rail에 Draft 있는 장은 점(●)이 붙는다. Publish 성공 시 Draft가 지워지고 배지가 `Published`가 된다. serve.py가 죽어 있으면 칩이 `오프라인 — 로컬에 보관됨`(복구본)으로 바뀌고 다시 살면 자동으로 밀어 넣는다. 다른 탭이 같은 Draft를 먼저 저장했으면 조용히 덮어쓰지 않고 `다른 탭에서 수정됨 — 새로고침` 경고.

## 3. 서버 (`tools/serve.py`)
- `GET /draft-list` → `{ ok, drafts: { [stageId]: { savedAt, revision, mapId } } }` (`_draft/stages/*.json` 스캔 + 각 파일의 `_meta`).
- `POST /draft-save { stageId, stage: <json string>, map?: <json string>, baseRevision?: number }` → 파일 `_draft/stages/{id}.json`에 **stage JSON 그대로**(끝 개행), 별도 `_draft/stages/{id}.meta.json` `{ revision, savedAt, mapId, hasMap }`; `baseRevision`이 있고 현재 revision과 다르면 **409** `{ ok:false, conflict:true, revision }`(다중 탭 보호). 성공 `{ ok:true, revision, savedAt }`. id 검사 `_DRAFT_ID_RE.fullmatch`, 크기 5MB, tmp→replace(`newline="\n"`). 맵은 `_draft/maps/{mapId}.json`.
- `POST /draft-delete { stageId }` → stage·meta·(맵은 다른 스테이지 Draft가 안 쓰면) 삭제. `{ ok, deleted:[…] }`.
- Draft 파일 읽기는 정적 GET `/apps/web/public/_draft/stages/{id}.json`(serve.py 루트 서빙) — 별도 엔드포인트 불필요.
- `/publish-stage` 성공 시 서버가 그 stageId의 Draft를 **삭제**(응답에 `draftDeleted:true`) — Published가 곧 Draft이므로.

## 4. 에디터
- **로드 순서**(`loadStageFromServer(id)`): Draft가 있으면(`/draft-list` 캐시 → 정적 GET) Draft를 모델로, 레포 원본은 `repoStageCache`(변경사항 기준). 배지: Draft 있음 → `Draft`(주황) + 툴팁 `Published와 다름 · 저장 HH:MM`; 없음 → `Published`(회색). `⚙▾`에 「Draft 버리기(Published로 되돌리기)」 = `/draft-delete` 후 레포 재로드(dirty면 confirm).
- **자동 저장**: `refreshValidation()` 훅(히스토리 push 성공 시) → `scheduleDraftSave()` 1.5초 디바운스 → `isDirty()`면 `POST /draft-save`(stage+map 직렬화, `baseRevision = draftRevision`) → 성공 시 `draftRevision`, `history.markSaved()`, `clearRecovery()`, 칩 `Draft 저장됨 ✓ HH:MM`. 진행 중 `저장 중…`. 실패(네트워크/5xx) → 칩 `오프라인 — 로컬에 보관됨`(복구본은 그대로 유지) + 30초 후 재시도(백오프 1회). 409 → 칩 `다른 탭에서 수정됨 — 새로고침`(자동 저장 중단, 사용자 결정). 맵 단독 모드는 자동 저장 없음(맵 단독은 파일 내보내기 경로 유지).
- **복구본과의 관계**: Draft 저장 성공 = 복구본 삭제. Draft 저장 실패 동안은 복구본이 살아 있다(기존 동작). 재진입 시 복구본이 Draft보다 새로우면 기존 복구 배너가 뜬다(비교 = `savedAt`; 배너 문구에 `Draft 이후 편집` 명시).
- **Ctrl+S / 「저장」 버튼**(Project Bar) = 디바운스 무시하고 즉시 `draftSave()`. 파일 피커 저장(`⬇ stage JSON`)은 ⚙ 메뉴에 「파일로 내보내기」로 남는다(`markSaved`는 이제 Draft 저장만 부른다 — 내보내기는 dirty를 바꾸지 않는다).
- **rail**: `renderRail` 항목에 `draft:boolean` → 이름 앞 `●`(주황, title `Draft 있음`). `/draft-list`는 init 1회 + 자동 저장/삭제/Publish 후 갱신.
- **Publish 모달**: 체크리스트에 `Draft → Published` 문구; 성공 시 `draftRevision=null`, rail 점 제거, 배지 `Published`.
- **플레이테스트**는 이미 편집 중 상태(=Draft)로 실행되므로 불변. 게임(`/battle`)은 Published(레포)를 플레이 — master-plan §13 그대로.

## 5. 파일
| 파일 | 역할 |
|---|---|
| `tools/serve.py` (수정) | `/draft-list`, `/draft-save`, `/draft-delete`, publish 시 Draft 삭제 |
| `tools/editor/draft-store.js` (신규, +`.d.ts`) | 순수 `saveState({dirty, saving, lastError, conflict, draftAt})` → 칩 텍스트/클래스; `createDraftSaver({ post, debounceMs, retryMs, now, setTimeout, clearTimeout })` — 디바운스·재시도·409 정지의 상태기계(DOM/fetch 주입) |
| `tools/stage-editor.html` (수정) | 로드 순서·배지·자동 저장 훅·Ctrl+S·「저장」 버튼·⚙ Draft 버리기·rail 점·Publish 연동 |
| `tools/editor/rail.js` (수정) | `draft` 점 |
| `packages/data/test/editor-draft.test.ts` (신규) | `saveState` 표, `createDraftSaver` 시나리오(디바운스 병합·성공·실패→재시도·409 정지·저장 중 재편집은 완료 후 한 번 더) |
| `tools/editor/e2e/draft.mjs` (신규) | CDP: 편집→1.5s→`Draft 저장됨` 칩·`_draft/stages/05-sishuiguan.json` 존재→새로고침→Draft 배지·편집 유지→rail ●→Publish(변경→롤백 대신 「Draft 버리기」로 정리)→배지 Published·파일 삭제; serve.py를 죽인 상태 흉내는 `E2E_TOOLS_ORIGIN`로 죽은 포트를 넘겨 `오프라인` 칩 확인(별도 짧은 시나리오) |
| 문서 | `tools/CLAUDE.md`, master-plan §22 P1 Project Store·Draft ✅ + 부록 미결 ③ 결정(로컬 우선), 스펙 상태 |

## 6. 범위 밖
Supabase/계정·권한, 프로젝트 단위(캐릭터/아이템 Draft — 스테이지·맵만), Draft 버전 목록/되돌리기(git이 Published 이력, Draft는 1개), 충돌 병합(409 = 정지·안내만), 맵 단독 모드 Draft.
