# Project Store v1 (로컬 Draft/Published + 자동 저장) — Implementation Plan

> **상태: 구현 완료 (2026-09-12)** — Chunk 1~3 전부 완료, E2E `draft.mjs` 40건 PASS.

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 스펙 `docs/superpowers/specs/2026-09-12-project-store-draft-design.md` — serve.py Draft 파일 저장소 + 에디터 자동 저장(디바운스·재시도·409 정지) + Draft 우선 로드·배지·rail 점 + Publish 시 Draft 삭제. CDP 검증.

**Conventions:** 브랜치 `feat/project-store-draft`, `C:\projects\threekingdoms`; `pnpm --filter @tk/data test|typecheck`; `stage-editor.html`·`serve.py` CRLF 보존(python 패치, `newline=""`); 트레일러 `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`; 영어 커밋.

## Chunk 1: 순수 저장 상태기계 + 서버

### Task 1: `tools/editor/draft-store.js` (TDD)
- [x] 테스트 `packages/data/test/editor-draft.test.ts`: `saveState` 표 — `{dirty:false, draftAt:"14:32"}`→`Draft 저장됨 ✓ 14:32`/`ok`; `{dirty:true}`→`수정됨`/`warn`; `{saving:true}`→`저장 중…`/`warn`; `{lastError:"net"}`→`오프라인 — 로컬에 보관됨`/`bad`; `{conflict:true}`→`다른 탭에서 수정됨 — 새로고침`/`bad`; `{dirty:false, draftAt:null, publishedAt:"14:40"}`→`Published ✓ 14:40`. `createDraftSaver({ post, debounceMs:1500, retryMs:30000, now, setTimeout, clearTimeout })` with fake timers: `touch()` 두 번(500ms 간격) → post 1회(1500ms 후 마지막 touch 기준); post 성공 `{ok:true, revision:2}` → `state().revision===2`, `onSaved` 호출; post reject → `state().lastError`, `retryMs` 뒤 재시도 1회 → 성공 시 정상; 409 `{ok:false, conflict:true}` → `state().conflict`, 이후 `touch()` 무시(정지), `reset()`으로 해제; 저장 중 `touch()` → 완료 후 한 번 더 post; `flush()` = 즉시. 
- [x] 실패 → 구현(`.d.ts` 포함; 순수 — DOM/fetch/timers 전부 주입) → green. 커밋 `feat(editor): draft saver state machine (debounce, retry, conflict stop) + save-state text`.

### Task 2: serve.py Draft 엔드포인트
- [x] `_DRAFT_STAGES_DIR = _DRAFT_DIR/stages`, `_DRAFT_MAPS_DIR = _DRAFT_DIR/maps`. `GET /draft-list`(do_GET 분기), `POST /draft-save`(id fullmatch·5MB·JSON 파싱·`baseRevision` 비교 → 409·`_write_text_atomic`(백업 디렉터리 tmp 재사용 대신 `_draft/.tmp`)·meta `{revision, savedAt, mapId, hasMap}`), `POST /draft-delete`. `_publish_stage` 성공 경로 끝에서 `_delete_draft(stage_id)`(맵은 다른 Draft meta가 같은 mapId를 참조하면 유지) → 응답 `draftDeleted`. 허용 목록 갱신. Draft I/O는 `_VALIDATE_LOCK`과 무관(짧은 파일 쓰기) — 단 같은 stageId의 동시 저장은 `threading.Lock` 하나로 직렬화.
- [x] `python -m py_compile`; 임시 서버(:8099)로 urllib 검증: save→list→save(baseRevision 옛값)→409→delete→list 비어 있음; publish 후 draft 삭제 확인; `_draft` 정리. 커밋 `feat(serve): local draft store — draft-list/save/delete, publish clears draft`.

## Chunk 2: 에디터 배선

### Task 3: 로드·배지·자동 저장·rail
- [x] HTML: `draftIndex`(`/draft-list` 캐시, init·저장·삭제·Publish 후 갱신). `loadStageFromServer(id)`: 레포 원본 fetch(캐시) + `draftIndex[id]`면 `/apps/web/public/_draft/stages/{id}.json`(+맵 `hasMap`이면 `_draft/maps/{mapId}.json`, 아니면 레포 맵) → `loadStageObject(draftObj)`; `draftRevision = meta.revision`; 배지 `#draftBadge` 텍스트/클래스(`Draft`/`Published`), 툴팁. `saver = createDraftSaver({ post: (body) => fetch('/draft-save', …).then(r => r.json()), … })`; `refreshValidation()`의 push 성공 분기에서 `saver.touch()`(맵 단독 모드 제외); `saver.onSaved` → `history.markSaved(); clearRecovery(); draftAt=…; updateSaveState()`; `saver.onState` → `updateSaveState()`가 `saveState(saver.state())`로 칩을 그린다(기존 복구본 문구는 `lastError` 상태에서만 부가). Ctrl+S(텍스트 포커스 여부 무관) + Project Bar `#saveDraft`(「저장」) → `saver.flush()`. ⚙ 「Draft 버리기」 → confirm → `/draft-delete` → `draftRevision=null` → 레포 재로드. `saveStageFile`(파일 피커)은 `markSaved` 호출 제거(내보내기). 새 스테이지(`doNew`)·붙여넣기/파일 열기 로드도 `draftRevision=null`로 시작(다음 편집이 Draft 생성). Publish 성공 → `draftRevision=null; draftIndex 갱신`. `updateRail`이 `draft: !!draftIndex[id]`를 항목에 넘긴다(`rail.js` `●`).
- [x] 스모크(자체 serve.py :8099): 편집→칩 `저장 중…`→`Draft 저장됨 ✓`→파일 존재→새로고침→Draft 배지·편집 유지→Draft 버리기→Published. `node tools/editor/e2e/history.mjs` PASS 유지(복구본 로직은 Draft 저장 실패 시에만 의미 — E2E는 `E2E_DRAFT_OFF=1`이면 자동 저장을 끄도록 `init`에서 `?nodraft=1` 지원 → history.mjs가 `?nodraft=1`로 열게 1줄 수정 허용). 커밋 `feat(editor): draft-first load, autosave to local draft store, save-state chip, rail draft dots, discard draft`.

## Chunk 3: E2E + 문서
- [x] `tools/editor/e2e/draft.mjs`(cdp.mjs): 스펙 §5 시나리오 + 오프라인 시나리오(`E2E_TOOLS_ORIGIN`으로 죽은 포트 페이지는 로드 불가하므로 대신 `fetch`를 페이지에서 monkeypatch해 `/draft-save`만 reject → 칩 `오프라인`; 복구 → 재시도 성공). 루트 `package.json` `e2e:draft`. PASS까지.
- [x] 문서: `tools/CLAUDE.md`(3층 저장·엔드포인트·`?nodraft`), master-plan §22 P1 Project Store·Draft ✅, 부록 미결 ③ → 결정 "로컬 우선(v1) — Supabase는 어댑터 교체", 스펙 상태. 커밋 `docs: project store v1 (local draft) done`.
