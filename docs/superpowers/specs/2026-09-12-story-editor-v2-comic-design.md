# Story Editor v2 — 모션코믹 포맷(ComicScene) + 런타임 + 컷 편집기 (2026-09-12)

> master-plan §5 STORY("카툰만 봐도 책 한 권"), §17 Story Editor("컷/이미지/캐릭터 · 대사/내레이션 · 음성/BGM/효과음 · Zoom/Pan/Shake/Fade/Transition · 타임라인"), 부록 #3(모션코믹 전환은 도구와 함께; 2026-09-10 웹툰 v5 결정 = **페이지 단위 · 칸 이미지와 대사 데이터 분리 · 지면 통짜 생성 후 슬라이스**를 소재 원칙으로 흡수), 미결 ②(포맷 결정 — 이 문서가 결정). design-guide §8 Dialogue/Story UX(타이핑 중 입력=완성, 완성 후=다음, 마지막=명확한 종료; AUTO/SKIP/LOG 후보), §11 Story 시각 언어.

## 1. 결정 (미결 ②)
**포맷 = 페이지 + 칸(panel) + 카메라.** 모션코믹 한 씬은 **페이지 이미지 여러 장**(각 장은 만화 지면 한 면 — 칸이 그려진 통짜 생성물)과, 페이지마다 **칸 목록**(이미지 안의 정규화 사각형)이다. 재생 = 칸 순서대로 카메라가 이동/줌(pan/zoom)하며 그 칸의 대사가 뜬다. 흔들림/섬광/페이드는 칸 단위 효과. 음성은 줄 단위 키, BGM/효과음은 페이지·칸 단위 키. **타임라인 = 칸의 순서와 각 칸의 `hold`(자동 진행 시간)** — 별도 트랙/키프레임 편집기는 만들지 않는다(YAGNI: 카메라는 칸 사각형이 결정하고, 효과는 프리셋 enum). 기존 VN(`ScenarioScene`)·MapScene은 그대로 공존(파트 배열 안에 섞어 쓴다).

이유: ① 칸 이미지(생성물)와 대사(데이터)가 분리돼 다국어·음성·재생성이 자유롭다(v5 원칙). ② 지면 통짜 생성 한 장으로 페이지가 나오고 슬라이스가 필요 없다 — 칸은 사각형 데이터일 뿐. ③ 런타임은 DOM/CSS `transform`(pan/zoom)과 keyframes(shake/flash/fade)로 충분 — Pixi 불필요. ④ 에디터는 썸네일 위에 사각형을 그리는 것이 곧 컷 편집이라 타임라인 UI가 필요 없다.

## 2. 데이터 (`packages/data/src/schemas.ts`)
```ts
export const ComicLineSchema = z.object({ speaker: z.string().optional(), side: SideSchema.optional(), portraitId: z.string().optional(), text: z.string() }).strict(); // = ScenarioLine − bg. voice 는 v1 제외(음성 재생 경로·파일 모두 없음 — strict 라 나중에 additive)
export const ComicPanelSchema = z.object({
  rect: z.tuple([z.number().min(0).max(1), z.number().min(0).max(1), z.number().min(0).max(1), z.number().min(0).max(1)]), // x,y,w,h 정규화(이미지 기준)
  lines: z.array(ComicLineSchema).optional(),        // 없으면 무대사 칸(카메라 비트)
  fx: z.array(z.enum(["shake", "flash"])).optional(),   // fadeIn/fadeOut 은 v1 제외(페이지 fade 와 중복)
  hold: z.number().int().min(1).optional(),           // 자동 진행(ms, AUTO/무대사 칸). 미지정 = 탭 대기(무대사 칸 기본 1200). 0 은 불허
  sfx: z.string().optional(),                         // 칸 진입 효과음 키(/assets/audio/sfx/{key})
}).strict();
export const ComicPageSchema = z.object({
  image: z.string().min(1),                           // /assets/comics/{image}.webp — 지면 한 면(빈 문자열 불허 — 에디터는 빈 페이지를 validate 오류로 막는다)
  panels: z.array(ComicPanelSchema).min(1),
  bgm: z.string().optional(),                         // 페이지 진입 시 BGM 트랙 키(없으면 유지)
}).strict();
export const ComicSceneSchema = z.object({
  kind: z.literal("comic"),
  pages: z.array(ComicPageSchema).min(1),
}).strict();                                          // 페이지 전환은 fade 고정(v1) — transition 필드 없음
export const ScenePartSchema = z.union([MapSceneSchema, ComicSceneSchema, ScenarioSceneSchema.strict()]);
```
- `kind:"comic"`가 판별자(MapScene은 `map`, VN은 나머지 — 기존 순서 규칙 유지: 판별 가능한 것 먼저).
- `rect`는 `w,h > 0`, `x+w ≤ 1+1e-6`, `y+h ≤ 1+1e-6` refine(드래그 float 오차); 에디터는 소수 3자리로 반올림. 첫 칸이 페이지 전체(`[0,0,1,1]`)여도 됨(전체 지면 보여주기).
- **판별 가드 = `isComicScene(p) = p?.kind === "comic"`**(`tools/editor/story-model.js` + web/sim 각자 1줄). "map 아니면 VN" 가정이 박힌 5곳은 **comic 분기를 VN 폴백 앞에** 둔다: `tools/editor/story-editor.js`(VN 카드가 `part.lines ??= []`로 comic 파트를 **변형**해 strict 스키마를 깨뜨림), `tools/editor/validate-story.js`("줄이 없습니다" 오류가 미리보기를 막음), `tools/editor/publish.js` `probeAssets`, `packages/sim/src/assets/manifest.ts`(+ `asset-manifest-cli.ts` 섹션), `apps/web/app/scene/page.tsx`(유니온 확장으로 타입 좁히기가 깨져 컴파일 실패 — 분기 필수).
- 에셋 경로 규약 추가: `/assets/comics/{image}.webp`(페이지). 초상은 기존.

## 3. 런타임 (`apps/web/src/scene/ComicScenePlayer.tsx`)
- `scene/page.tsx` 파트 분기: `"kind" in part && part.kind === "comic"` → `ComicScenePlayer`.
- 구조: 풀스크린 검정(오프닝 페이드 `tkSceneIn` 3줄 복사 — page.tsx 파트 전환이 각 플레이어의 오프닝 페이드에 의존) → 래퍼 `data-testid="comic-viewport"` → **카메라 요소** `data-testid="comic-camera"`(`transform-origin: 0 0`, 자연 px 폭으로 레이아웃 `width: W`) 안에 페이지 `<img>`(`assetUrl("/assets/comics/{image}.webp")`; `AssetImage`에 `onLoad?(w,h)` prop 3줄 추가해 자연 크기 수신, **실패/부재 시 가상 크기 1500×2000(3:4)**로 진행 — 아트 없이도 카메라·E2E 동작, `failed`면 칸 사각형 테두리를 rect로 그려 placeholder). 카메라 = `transform: translate(tx,ty) scale(s)`, `s = min(vw(1−2m)/(w·W), vh(1−2m)/(h·H))`, `tx = vw/2 − (x+w/2)·W·s`, `ty = vh/2 − (y+h/2)·H·s`(순수 `cameraFor(rect, {w:W,h:H}, {w:vw,h:vh}, m=0.06)` — `scene/comicCamera.ts`, node 테스트). `transition: transform 600ms cubic-bezier(.22,.61,.36,1)`은 크기 확정(`ready`) 뒤에만(첫 칸은 `transition:none` 즉시). `resize` 리스너로 재계산(모바일 회전). `shake`는 **래퍼**에 애니메이션(카메라 요소에 걸면 `transform` 애니가 카메라 변환을 덮는다).
- 진행(`useComicProgression`): 상태 `{pi, ci, li}`(페이지·칸·줄). 탭: 타자기 중 → 완성; 줄 남음 → 다음 줄; 칸 끝 → 다음 칸(카메라 이동); 페이지 끝 → 다음 페이지(fade 350ms 검정 경유); 마지막 → `onComplete`. 무대사 칸·`hold` 지정 칸은 타이머로 자동 진행(탭하면 즉시). `fx`: `shake`(keyframes 400ms 래퍼 흔들림), `flash`(흰 오버레이 200ms) — 순수 CSS; 감속 = 플레이어 `<style>`의 `@media (prefers-reduced-motion: reduce) { .tkComicShake,.tkComicFlash{animation:none} .tkComicCam{transition:none} }`(JS 없음).
- 대사 = 기존 `DialoguePanel`/`NarrationPanel`/`useTypewriter` 재사용(`ComicLine` ⊂ `ScenarioLine`, 어댑터 불필요; `useSceneProgression`은 줄 전용이라 재사용하지 않음). `sfx`/`bgm`은 데이터가 `string`이지만 런타임은 **가드 뒤에서만** 호출: `isSfxKey(k)`(`Object.values(SFX).includes`)·`isBgmTrackId(k)`(`k in TRACKS`) 두 export(`audio/`), 아니면 무시. 페이지 `bgm`은 씬 동안 유지되고 라우트 이동 시 `AudioController`가 되돌린다(기존 동작). 에디터 datalist = 그 22/5 키.
- `SkipBar` 재사용(스킵 → onComplete). 상단 우측 `AUTO` 토글(`hold` 없는 칸도 줄당 `text.length*45+900ms`로 자동) — design-guide 후보 중 AUTO만(LOG는 범위 밖).
- 에셋 프리로드: 다음 페이지 이미지를 `new Image()`로 선로드(페이지 전환 끊김 방지).
- 매니페스트(`packages/sim/src/assets/manifest.ts`): `RequiredAssets.comics: {image, stageId, type, firstLine}[]` + 순회에 comic 분기(VN 케이스 앞) → `asset-manifest-cli.ts` 섹션(`has(\`comics/${image}.webp\`)`).

## 4. 에디터 (`tools/editor/story-editor.js` 확장 + `comic-editor.js`)
- 파트 카드 `만화(kind:"comic")`(`isComicScene` 분기가 VN 카드보다 **앞**): 페이지 카드 목록. 페이지 카드 = `image` 입력(datalist = serve.py `/list-dir?path=assets/comics` — 디렉터리 없으면 `[]`) + **썸네일(최대 폭 300px) 위에 칸 사각형 오버레이** + 칸 목록. 이미지가 없어도 오버레이는 3:4 회색 박스로 렌더(아트 전에 칸 저작 가능).
- **칸 편집** = 썸네일 위 드래그로 사각형 그리기(`pointerdown/move/up`, 정규화·소수 3자리 저장), 기존 칸 클릭=선택(핸들 4개 리사이즈, 드래그 이동), `Delete` 키 삭제(오버레이 `tabindex=0`에 스코프 — window 핸들러 금지), 순서 `↑↓`, 번호 라벨. **`commit()`은 pointerup에서만**(move 중엔 로컬 렌더만 — 히스토리 병합은 텍스트용). 순수 `rectFromDrag(p0, p1, box) → [x,y,w,h]`, `clampRect`(`comic-editor.js`, 테스트). `story-editor.js`의 `h/btn/moveBtns` 헬퍼를 export해 재사용.
- 칸 인스펙터(선택 칸): 줄 편집(기존 `renderLines` — 내레이션 허용·bg 없음), `fx` 체크박스 2개(shake/flash), `hold` ms(≥1), `sfx` 키(datalist 22). 페이지: `bgm` 키(datalist 5), `↑↓✕`, `+ 페이지 추가`(`{ image: "", panels: [{ rect: [0,0,1,1] }] }` — 빈 image 는 validate 오류로 Publish/미리보기를 막는다). 파트 추가 메뉴에 `+ 만화 장면 추가`(`{ kind:"comic", pages:[…] }`).
- 검증(`validate-story.js`): 페이지 `image` 비면 오류, 칸 rect 범위, 줄 text 비면 오류, `hold` ≥1 정수. 오류 문구 `${label} ${pi+1}번째 장면 ${pg+1}번째 페이지 ${pn+1}번째 칸 ${li+1}번째 줄: …`(기존 `N번째` 패턴·`label` 접두 유지 — `runPlaytest`가 접두로 필터).
- 미리보기: 기존 `▶ ▾ 전투 전 이야기`가 그대로(파트 배열에 comic 포함되면 `ComicScenePlayer`가 재생).
- Publish 에셋 프로브에 `comics/{image}.webp` 추가. 런타임·프리로드(`new Image()`) 경로는 전부 `assetUrl()` 경유(R2 배포).
- 에셋보드: 「③ 시나리오 씬」 탭에 **「만화 지면」 카드 그룹**(프롬프트 템플릿: 세로 지면 3:4, N칸 만화, 칸 경계 굵은 검정, 말풍선 없음(대사는 데이터), 수묵+현대 카툰 톤, `{장면 설명}`) — 붙여넣기 → `assets/comics/{key}.webp`. 보드는 `assets/scenes/`를 `sceneCard` 기준으로 하드코딩(≈`fixedWebpName` 2143·`addImageToCard` 2172·`cardGamePaths` 1839·프롬프트 조립 1774) → 새 플래그 `comicCard` + `saveName`으로 그 4곳 분기(serve.py 무변경 — `/apply-asset`는 `assets/…` 임의 경로 허용). 카드 그룹 1개 + 저장 경로만(프롬프트 톤 튜닝은 길중).

## 5. 콘텐츠 시드
- 05 사수관 intro를 **만화 1페이지 3칸 샘플**로 파트 배열 앞에 추가(기존 VN 유지 → `[comic, vn]`)? **아니오** — 출시 콘텐츠는 건드리지 않는다(부록 #3 "포맷만 또 바꾸지 않는다"). 대신 `packages/data/json/stages/`가 아닌 **E2E 픽스처**(`tools/editor/e2e/fixtures/comic-sample.json`)와 플레이테스트 스냅샷으로 검증. 페이지 이미지는 placeholder(`AssetImage` 규약 — 없으면 수묵 placeholder + 칸 테두리만) → 런타임은 이미지 없이도 카메라/대사 동작.

## 6. 테스트·E2E
- 순수: `comicCamera.test.ts`(contain 계산 4케이스 + 전체 rect = fit + 여백), `comic-editor` `rectFromDrag/clampRect`(반올림·클램프), schemas(`ComicSceneSchema` 유효/무효 — rect 범위·strict 키·image 빈 문자열·hold 0), `validate-story` comic 케이스 4, manifest `comics` 배열 + CLI 섹션.
- E2E `tools/editor/e2e/comic.mjs`: 에디터 05 → `전투 전 이야기` → `+ 만화 장면 추가` → 페이지 image 입력 `e2e-page` → 썸네일 위 드래그로 칸 2개 추가(페이지 컨텍스트에서 합성 `PointerEvent` dispatch — 다른 e2e 와 동일 방식; rect 는 `getBoundingClientRect` 기준) → 칸 1 줄 추가 `[COMIC]` → `▶ ▾ 전투 전 이야기` → 게임 탭 `[data-testid=comic-scene]` → 화면 텍스트 `[COMIC]` → 탭 진행 → `[data-testid=comic-camera]`의 `transform`이 600ms 뒤 바뀜(`waitFor`) → 완료 → 탭 닫힘(미리보기는 `_draft/`만 쓰므로 원복 불필요). 데스크톱 + 모바일 메트릭 각 1회(`Emulation.setDeviceMetricsOverride`).

## 7. 범위 밖
Live2D/리그 애니메이션 칸, 키프레임 타임라인, LOG/텍스트 속도 설정, 음성 생성 파이프라인(ElevenLabs 호출), 자동 슬라이스(칸 감지), 출시 27씬의 만화 전환(길중 판정 후 콘텐츠 작업).
