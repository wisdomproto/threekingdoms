# Story Editor v2 (모션코믹 ComicScene) — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 스펙 `docs/superpowers/specs/2026-09-12-story-editor-v2-comic-design.md` — `ComicScene` 스키마, `ComicScenePlayer` 런타임(페이지·칸 카메라·fx·음성/효과음/BGM 키·AUTO), 에디터 만화 파트(썸네일 위 칸 드래그·칸 인스펙터), 검증·매니페스트·프로브·보드 카드, CDP E2E.

**Conventions:** 브랜치 `feat/story-editor-v2-comic`, `C:\projects\threekingdoms`; `pnpm --filter @tk/data|@tk/web|@tk/sim test`, typecheck; CRLF 보존 패치; 트레일러 `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`; 영어 커밋.

## Chunk 1: 데이터 + 순수 로직 (TDD)
### Task 1: 스키마
- [ ] `packages/data/test/schemas.test.ts`에 comic 케이스: 유효 씬 parse; rect `x+w>1+1e-6` 거부(`0.7+0.3000001`은 통과); 미지 키 거부(strict); `image:""` 거부; `hold:0` 거부; `ScenePartSchema`가 `{kind:"comic",…}`을 comic으로, `{map:…}`을 MapScene으로, `{bg,lines}`를 VN으로 판별; `normalizeSceneSlot` 배열 안 comic 유지. 실패 → `schemas.ts` 구현(스펙 §2 — voice/fadeIn/fadeOut/transition 없음, union 순서 `[MapScene, Comic, VN.strict()]`, refine) → export 타입 `ComicScene/ComicPage/ComicPanel/ComicLine` + `isComicScene` 타입가드 → green. **컴파일 깨지는 소비자 즉시 분기**: `apps/web/app/scene/page.tsx`(comic → 임시로 VN 플레이어 대신 `null` 렌더 + TODO — Chunk 2가 교체), `packages/sim/src/assets/manifest.ts`(comic 분기 + `comics` 배열 + CLI 섹션 — Task 2로). 커밋 `feat(data): ComicScene schema (pages/panels/camera rects/fx)`.
### Task 2: 카메라·에디터 순수
- [ ] `apps/web/src/scene/comicCamera.ts` `cameraFor(rect, img:{w,h}, view:{w,h}, pad=0.06) → {scale, tx, ty}`(스펙 §3 공식) + `__tests__/comicCamera.test.ts`(4케이스 + 전체 rect = fit). `tools/editor/story-model.js` `isComicScene`; `tools/editor/comic-editor.js`(+`.d.ts`) 순수 `rectFromDrag(p0,p1,box)`(소수 3자리), `clampRect(r)`, `newPage()`, `newComicPart()`; `packages/data/test/editor-comic.test.ts`. **VN 폴백 앞 comic 분기 5곳**: `story-editor.js`(comic 파트 → Chunk 3 전까지 읽기 전용 카드 `만화 장면 (편집 UI 다음 단계)` — 절대 `lines ??= []` 변형 금지), `validate-story.js`(comic 규칙 + 테스트 4, 메시지 형식 스펙 §4), `publish.js` `probeAssets`(comics 이미지), `packages/sim/src/assets/manifest.ts` + `asset-manifest-cli.ts`(`comics` 배열·섹션·테스트), `scene/page.tsx`(Task 1에서 처리). 커밋 `feat: comic camera math, panel rect helpers, comic guards in story tooling, asset manifest for comic pages`.

## Chunk 2: 런타임
### Task 3: ComicScenePlayer
- [ ] `apps/web/src/scene/useComicProgression.ts`(pi/ci/li, hold 타이머, AUTO, fx 트리거) + `ComicScenePlayer.tsx`(`data-testid="comic-scene"`, 래퍼 `comic-viewport`, 카메라 요소 `comic-camera`(`transform-origin:0 0`, `ready` 전 `transition:none`, `resize` 재계산), `AssetImage`에 `onLoad?(w,h)` 3줄 추가 + 실패 시 가상 1500×2000 & 칸 테두리 placeholder, `assetUrl` 경유·다음 페이지 `new Image()` 프리로드, 대사 `DialoguePanel/NarrationPanel/useTypewriter`, `SkipBar`, 오프닝 `tkSceneIn` 페이드, AUTO 토글 `data-testid="comic-auto"`, fx keyframes + `prefers-reduced-motion` CSS `<style>` 1회(shake 는 래퍼), `isSfxKey`/`isBgmTrackId` 가드 export(`audio/`) 뒤 `playSfx`/`playBgm`). `scene/page.tsx` 분기(Task 1 의 임시 null 교체). `pnpm --filter @tk/web typecheck|test`. 브라우저 스모크: `tk.lab`에 comic 파트 씬 payload 주입 → `/scene?stage=__lab&type=intro` → 탭 진행·카메라 이동·완료. 커밋 `feat(scene): ComicScenePlayer — page/panel camera, fx, voice/sfx/bgm keys, AUTO`.

## Chunk 3: 에디터 + 보드
### Task 4: 만화 파트 편집
- [ ] `story-editor.js`: `isComicScene(part)` → `renderComicPart(el, part, ctx)`(in `comic-editor.js` DOM 부 — `story-editor.js`의 `h/btn/moveBtns` export 재사용: 페이지 카드(image 입력 + datalist(`/list-dir?path=assets/comics`), 썸네일 `/apps/web/public/assets/comics/{image}.webp`(없으면 300×400 회색 박스 — 드래그 가능), 칸 오버레이 absolute div(`tabindex=0`, Delete 스코프), 드래그 신규·선택 이동·핸들 리사이즈, **commit 은 pointerup 에서만**, 번호), 칸 인스펙터(`renderLines(narration:true, withBg:false)`, fx 체크 2, hold ≥1, sfx datalist 22), 페이지 bgm datalist 5, 페이지 ↑↓✕, `+ 페이지 추가`), 파트 추가 메뉴 `+ 만화 장면 추가`; 파트 ↑↓✕ 기존. 커밋 `feat(editor): comic part editor — pages, panel rects by drag, panel inspector`.
### Task 5: 에셋보드 카드
- [ ] `docs/art/asset-board.html` 「③ 시나리오 씬」 탭에 「만화 지면」 그룹(카드 3장 시드: `05-sishuiguan-intro-p1/p2/p3`, 프롬프트 템플릿) — `comicCard`+`saveName` 플래그로 `assets/scenes/` 하드코딩 4곳(`fixedWebpName`·`addImageToCard`·`cardGamePaths`·프롬프트 조립) 분기, serve.py 무변경. 커밋 `feat(board): comic page cards (assets/comics)`.

## Chunk 4: E2E + 문서
- [ ] `tools/editor/e2e/comic.mjs`(스펙 §6; 페이지 컨텍스트 합성 `PointerEvent`로 썸네일 드래그, `comic-camera` transform `waitFor`), 루트 `package.json` `e2e:comic`, PASS.
- [ ] 문서: `apps/web/CLAUDE.md`(씬 파트 3종·comic 경로 규약), `tools/CLAUDE.md`(만화 파트 편집·보드 카드), master-plan §22 P2 Story Editor → v2 ✅ + 부록 미결 ② 결정(포맷 = 페이지+칸+카메라), `packages/CLAUDE.md` 스키마 줄, 스펙 상태. 커밋 `docs: story editor v2 (comic) done`.
