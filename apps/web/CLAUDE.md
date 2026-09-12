# apps/web — 앱 배선 가이드

> 루트 CLAUDE.md의 모듈 문서. 아래 §3은 기획 문서 v1.0 원문(절 번호 보존). UX 규칙은 [docs/design/design-guide.md](../../docs/design/design-guide.md), 씬·캠페인 루프는 docs/design/scenario.md §5 블록, 일기토·광고는 game-design §9 / bm.md.

## 작업 규칙 (요약)
- **렌더링 3레이어**: 바닥(painted webp → 타일 폴백) → `ObjectLayer` 격자 오브젝트(zIndex 1.8, always-visible) → 유닛/하이라이트/FX. 유닛 = 베이크 프레임 재생기(`UnitView`), 리그(`SkeletonView`)는 드롭인 격상.
- **새 연출 이벤트 = 3곳 세트**: `BattleRenderer`(렌더) + `eventPlayer` + `PresenterDelegate`. 하나라도 빠지면 연출이 조용히 무음 통과한다(2026-07-03 협공/필살 사고).
- **텍스처**: sprites/tiles/ground/deco/objects = `.webp`, fx·bg = png. 전투는 `loadSprites(onlySpriteIds)`(초기 배치 + 증원, 승급 시 `unitPromoted`에서 추가 로드) — 매니페스트 전 종 로드 금지(Poki 8MB). `OBJECT_FILES` 미등록 키는 조용히 생략 → 데코 kind 추가 시 등록. 로더는 파일별 allSettled(한 404가 전체를 죽이지 않게).
- **오디오**: manifest 드롭인(파일 없으면 절차적 신스). BGM은 `playBgm` 시점에 그 트랙만 지연 로드 — 부팅 일괄 preload 금지. 보스 BGM = 교전 트리거(`bossOf`).
- **광고**: `AdService` 어댑터(stub/poki/crazygames/gd, `NEXT_PUBLIC_AD_PROVIDER`), 리워드 4지점 + 전면 1, adFree·타임아웃 폴백 = 진행 무손실.
- **씬**: `stage.scenario` 슬롯 = VN 또는 파트 배열 — 파트 3종 **VN | MapScene | ComicScene**(`isComicScene` 판별, `app/scene/page.tsx` 분기). `ScenePlayer` / `MapScenePlayer`(SceneStage·interpreter) / **`ComicScenePlayer`**(story editor v2, 2026-09-12: 페이지 지면 `/assets/comics/{image}.webp` 1장을 `comic-camera` 요소(transform-origin 0 0)에 놓고 칸 rect 마다 `comicCamera.cameraFor` 로 translate/scale 600ms 이징 — 칸 순서 = 타임라인; `useComicProgression` {pi,ci,li} 탭/hold/AUTO, fx shake·flash = CSS keyframes, sfx/bgm 키는 `isSfxKey`/`isBgmTrackId` 가드 뒤 재생; 이미지 부재 = 가상 1500×2000 + 칸 테두리 placeholder라 아트 없이도 동작; testid `comic-scene`/`comic-camera`/`comic-auto`). 빈 씬 가드. 배우 모션 = `/motion-editor` ↔ `assets/scene-motions/library.json`(POST `/api/scene-motions`, dev 전용).
- **실험실·플레이테스트**: sandbox 판정은 `makeCtx`의 `__lab` 분기 플래그(스테이지 id 비교 금지 — 플레이테스트 스냅샷은 실제 id 유지). 종료 3지점은 `leaveSandbox()`(returnUrl 있으면 탭 닫기, 없으면 /lab). 착륙 `/playtest?draft=` → `parsePlaytestSnapshot`(zod).
- **Presentation 분리**(master-plan v2): 엔진은 의미 이벤트만, 연출(애니·VFX·카메라·컷인·음성)은 Presentation 데이터. 출시는 베이크 프레임, 리그는 `UnitView.renderMode='skeleton'` 드롭인 — 그 인터페이스가 VisualProfile/RigProfile/AnimationSet(P1 Architecture)의 착지점. **스킨은 전투 계산을 바꾸지 않는다.** Studio Preview(현재 rig-editor = Canvas2D)와 Battle Renderer(Pixi)는 **아직 다른 렌더러** — 같은 렌더러는 P2 목표, 그 전엔 포즈 계산·외형 조합 공유 + 캡처 비교(master-plan 부록 A #12).
- **HUD**: `battle/hud/frames.ts` 토큰(청동), 컬러 이모지 금지. **패널은 절대좌표 금지 — `BattleScreen`의 `#hudLeft`(목표 칩 → 유닛 정보 → 공격 예측)/`#hudRight`(미니맵 → 컨트롤 → 유닛 정보(우측 슬롯)) flex 컬럼의 흐름 자식**(2026-09-12, `hudLayout.unitPanelSide`). 컬럼은 pointer-events:none·overflow:hidden(bottom 84 = 턴종료/AudioControl 위). 목표 칩·플래시는 `display.fails`를 `주의:`로 표시. **모바일(<768px, `hudLayout.hudMode`)**: 부유 ActionMenu·InspectPopup·절대좌표 턴종료 대신 `hud/BottomPanel`(collapsed=턴종료 52px / expanded=유닛 행+AttackForecast+`itemsFor` 4열 52px 버튼, 상세 시트) 하나, `#hudLeft`는 목표 칩만·`#hudRight`는 ☰ 48px(배속·자동전투·기본 줌은 PauseMenu `mobileControls`). 패널이 `--tk-bottom-inset`을 써 AudioControl을 밀어올린다. E2E `pnpm e2e:mobile`(2026-09-12).
- **입문 공격 확인**: `inputMachine` `confirmAttack` 상태(`prior`=selected|targetSelect) — 두 커밋 지점이 `attackCommit` 하나. `store.setConfirmAttacks`(설정 `tk.controls.v1`, 기본 입문; PauseMenu 조작 토글). VS 카드 = `AttackForecast`(`data-testid=attack-confirm*`). 클래식 경로는 종전과 바이트 동일. `"targetSelect"` 분기를 건드리면 `confirmAttack`(prior 언랩)도 같이 — HighlightLayer·BattleRenderer 2곳·ActionMenu·UnitPanel/BattleScreen activeUnitId·store.setAutoBattle.
- **씬 미리보기·에디터 진입(P2, 2026-09-12)**: `/playtest?draft=X&scene=intro|outro|outroDefeat` → `/scene?stage=__lab&type=…`(scene 페이지가 `readLab().stage`를 마운트 효과로 읽음 — 렌더 중 sessionStorage 읽기는 hydration 불일치; 페이로드 없으면 `/lab`), 종료 = `leaveSandbox`. PauseMenu(dev·non-sandbox) `✏ 이 스테이지 편집` = `editorUrlFor(stageId, NEXT_PUBLIC_TOOLS_ORIGIN ?? http://localhost:8081)` → 에디터 `?stage=&quick=1`.
- **저장하고 나가기 / 이어하기**: `battle/suspend.ts` — `tk.battle.suspend.v1 {stageId, seed, sortie, log, playthroughCount, turn}`; 저장은 아군 페이즈 idle에서만(`canSuspend`), 복원은 `/battle?stage=…&resume=1`(`useSearchParams` — `window.location`은 router.push 직후 stale) → `BattleStoreOptions.replayLog` fold + `DialogueOverlay.initialPlayedIds`(지나간 대사 재생 억제) + `introDone=true`. 승리·새 출진 진입 시 삭제. `writeSuspend`는 boolean — false면 나가지 않는다. dev 핸들 `window.__tkBattle`. E2E `pnpm e2e:battle`(CDP 실 Chrome, next dev :3000 필요).
- **초기 로드 예산 = Poki 8MB**: 프리로드를 추가하기 전에 `next build` + 실제 네트워크 바이트로 측정(scene-motions 9MB PNG가 현재 최대 항목).
- **결산(ResultSequence)이 메타 영속 책임**: 새 진행 데이터 = ①UnitVM 노출 ②metaStore reducer ③결산 저장 호출 3종 세트. `/battle?stage=__lab`(실험실)은 메타 불가침.

## 3. 기술 스택

| 영역 | 선택 | 비고 |
|---|---|---|
| 전투 맵 | **톱다운 직교 + 스테이지별 painted 배경 + 보이지 않는 격자 데이터**, PixiJS | 풀 3D 금지. 시점/맵아트 방식은 §3-1 참조 (아이소 타일 방식은 폐기 — 2026-06-13) |
| 캐릭터 애니메이션 | **자체 컷아웃 리그**(강체 본 affine·메시/IK 없음) — `tools/rig-editor.html`(저작) + `apps/web/src/pixi/skeleton.ts`·`SkeletonView`(런타임). **상용 Spine 미보유** — 메시·IK 폴리시 필요 시 선택 업그레이드(docs/asset-pipeline/03-spine-setup.md, 2026-06-16) | SD에 파츠 분리 + 무기 슬롯 실시간 교체(스킨 BM §13). idle/move/attack/hit 클립. 같은 병종=골격 공유 |
| 일기토 연출 | **Seedance 영상 컷신** (일반·스토리 모두 동영상으로 제작 — 자체 리그와 무관, 2026-06-16) | 리그는 SD 맵 유닛 애니 전용 |
| 프론트 | Next.js / React, 모바일 웹 우선 | 세션 10~15분/스테이지 목표 (v1은 원작 맵 기준 — 측정 후 조정, §11) |
| 백엔드 | Supabase (계정, 클라우드 세이브, 리더보드, 리플레이) | 전투 연산은 100% 클라이언트 |
| 배포/CDN | Vercel + Cloudflare R2(생성 에셋 전부, 이그레스 무료) | 영상+이미지 트래픽 비용·git 비대화 방지. 코드는 `apps/web/src/assetUrl.ts`(`NEXT_PUBLIC_ASSET_BASE`)로 호스트 한 겹 전환 — 미설정 시 로컬 `/public`, 설정 시 R2/CDN. 업로드 `tools/upload-assets.py`(로컬→R2)·다운로드 `tools/sync-from-r2.py`(R2→로컬, R2가 정답일 때), 설정 docs/asset-pipeline/03-r2-asset-hosting.md. dev 정적서버 `tools/serve.py`(:8080, 경로 자동) (2026-06-15) |
| 일러스트 | Gemini 이미지 모델 (nano banana). v1 생성=**`gemini-3-pro-image`(나노바나나 Pro)** | 레퍼런스 시트 기반 일관성. ⚠️ 이미지 생성은 **유료(paid tier) 전용** — 키 프로젝트에 결제 활성화 필수(무료 등급 호출 0). 자동 파이프라인=§4 `tools/sprite-pipeline/gen/` |
| 영상 | Seedance I2V | 일기토/이벤트 컷신 |
| 음성 | ElevenLabs | 네임드 일기토 대사 + 내레이션 |
| 음악 | **v1=절차적 Web Audio 신스 BGM**(`apps/web/src/audio/`, synth.ts·bgm.ts·경로별 트랙). 최종=AI 작곡(Suno/Udio급) | 생성 트랙은 manifest 드롭인 교체(코드 불변). 6~8트랙 + 변형. **오디오 파이프라인(2026-06-28)**: 에셋보드 「🔊 오디오」탭 BGM 5트랙(title/menu/battle/battleBoss/scene) Suno/Udio 프롬프트 SSOT → 파일을 카드에 드롭 → `assets/audio/bgm/{id}.{ext}` 로컬+R2 저장 + `POST /rebuild-audio-manifest`(serve.py) → `assets/audio/manifest.json` 자동 재빌드+R2 → 게임 코드 불변(드롭인 교체). `PROCEDURAL_BGM_ENABLED=false`라 파일 없는 트랙은 현재 무음 |
| 효과음 | **v1=절차적 신스 SFX**(`apps/web/src/audio/sfx.ts` — `SFX.slash`·`playSfx`, 전투/결산 배선) | 파일 SFX도 manifest 드롭인. 호출부=배럴 `../audio`(`playSfx`/`playBgm`/`<AudioController/>` layout 마운트). **오디오 파이프라인(2026-06-28)**: 에셋보드 SFX 탭 22종(click·confirm·cancel·slash·pierce·hit·crit·ultimate·defeat·**step(이동)**·spell·flank·combo·duel·reinforce·phase·star·chest·coin·levelup·victory·lose) ElevenLabs 프롬프트 → 파일 드롭 → `assets/audio/sfx/{key}.{ext}` 저장+R2+매니페스트 재빌드. 파일 없는 키는 절차적 synth 자동 폴백. **이동음·음악토글(2026-06-28)**: `UnitView.moveAlong`이 타일 진입마다 `playSfx(SFX.step)`(발소리, BattleRenderer 주입). 전투 우측 `BattleControls`에 BGM on/off 토글 추가(좌하단 `AudioControl` 패널이 전투 대사창에 가릴 때용 — `settings.bgm` 0↔기본) |

### 3-1. 시점·맵 아트 방식 (2026-06-13 확정 — 시행착오 끝에 정착)
- **시점: 톱다운 직교** (원작 영걸전·조조전이 그렇다). 아이소메트릭(쿼터뷰)은 시도했다가 폐기 — 원작과 다르고 카메라/정합 비용만 큼.
- **맵 = painted 배경 1장 + 보이지 않는 격자 데이터 1쌍.** 타일을 깔아 예쁘게 만드는 건 천장이 명확(전환·팔레트·반복 한계). 대신:
  1. 격자 지형 데이터(JSON, 진실의 원천)를 **색깔 블록 레이아웃 PNG로 export** (`tools/sprite-pipeline/export_layout.py`, 지형별 색 규약 고정)
  2. 그 블록아웃을 **Gemini(nano banana) img2img**로 "이 배치 그대로 수묵 톱다운 전장으로 칠해" → painted 배경. **그리드가 삽화를 결정**(순서를 뒤집어 위치 어긋남 해결)
  3. 게임은 **격자 데이터로 동작**(이동/상성/충돌), 화면엔 painted 배경. 유닛·하이라이트·VFX는 그 위 스프라이트
  4. `apps/web/public/assets/maps/{stageId}.{webp,png}` 있으면 배경으로 깔고 타일 렌더는 폴백 (webp 우선 — 고해상 배경 용량 절감)
- **3레이어로 확정** (2026-06-21 §3-1 개정 — 종전 "2레이어: painted가 풍경 전부 그림"을 대체. 사유: 원작 영걸전은 성벽·성문을 *별도 타일*로 그리고(yeonggeoljeon-data.md §8-2), painted-only는 전술 가독성 부족): ① **바닥**(painted/저대비 시임리스 — *지형·앰비언트만*, 벽·건물 제외) ② **오브젝트 레이어**(구별되는 top-down 스프라이트 — 성벽 오토타일·성문 상태·망루·나무·엄폐; **격자 정렬·지형 구동**(terrains.json wall/gate/forest/… → 스프라이트)·파괴상태 스왑; `apps/web/src/pixi/layers/ObjectLayer.ts` + 순수 `objects/autotile.ts`·`objectModel.ts`, **zIndex 1.8 always-visible** — painted 배경에도 안 가려짐) ③ 유닛/하이라이트/VFX(항상 맨 위, 깊이정렬 없음) + 비가시 격자(진실). 벽이 격자 오브젝트라 painted 배경은 **바닥만** 그리면 됨(벽-격자 정합 부담 소멸). 오브젝트는 엄격 top-down(아이소 금지, 보드 `TOPDOWN_OBJ` 상수). 키트=보드 K-4~K-7(top-down), 컷=`tools/sprite-pipeline/cut_object_sheet.py`. ⏳ Chunk 1·2(렌더러) 구현 완료, **K-4 성벽/성문 아트 컷 완료→게임 렌더 검증**(`assets/objects/{wall_*,gate_*,fort_*}.png`, 간격감지 컷). **K-5/6 데코 게임 소비 완료(2026-06-22, `DECO_OBJECT_MAP` — §4)**. **`decorations` 정밀 배치 완료(2026-06-30)** — `DecorationSchema{cell,kind,flip?,scale?}`(kind=바닥 소품 12종 z.enum 화이트리스트 — 통행 칸 위 "막는 것처럼 보이는" 대형물은 로드 시점 차단, 시각 정직성)·ObjectLayer가 지형 자동 데코 위에 얹음·**스테이지 01~09 서사 소품 113개**(진영 깃발·화공 화로·공성 잔해·동탁 도주로 버린 수레·물가 갈대 — 지형 자동만으론 평지맵이 휑하던 문제 해소)·계약 테스트(경계/평지·초지·황무지만/유닛 등장칸 회피/중복 금지 = `packages/data/test/decorations.test.ts`, 신규 스테이지도 자동 강제). ⚠ **kind 추가 시 `textures.ts OBJECT_FILES`에도 등록 필수** — 미등록 키는 getObject=null로 조용히 생략("수레만 보이던" 2026-06-30 버그; K-5/6 때(06-22)도 같은 실수 = 세 번째는 없게). loadObjects는 **파일별 allSettled**(종전 일괄 Assets.load는 한 파일 404에 성벽까지 전멸 — loadSprites 06-28 수정과 동일 계열). Chunk 3 잔여=성문 상태 이벤트만. **데코 10~27 완료(2026-07-04)** — 신규 154개(결정론 저작: 진영=앵커 센트로이드, 궤주 스테이지=잔해 밭, 화공=화로/신호기, 물가=갈대(riverbank 인접 탐색), 계약 규칙 그대로+배치 간격 2) → **27/27 전 스테이지 데코 완성**. **K-9 거점·다리(2026-07-04)**: 마을=`village_hut`(+`village_hut2` 1/2 결정론 믹스 — 하비2 73칸 도장 방지, 산 바위 믹스 문법)/병영=`camp_tent`/창고=`depot_store`(종전 수레/진영문 대용의 "벌판에 성문" 오독 교정, 옛 hut/camp/storehouse 데코 폴백) + **다리 전용 렌더**(`ObjectLayer.addBridge` — 강 이웃 방향으로 `bridge_v`/`bridge_h` 자동, 아트 없으면 기존 painted 숨김/타일 표식 유지). 컷 프리셋 `--sheet k9`. 설계·플랜=docs/superpowers/{specs,plans}/2026-06-21-hybrid-map-rendering*.
- **스테이지별 카메라 = 데이터**: 맵마다 적정 줌/포커스가 달라 `stage.camera{zoom,focus}` JSON으로 분리(렌더러가 읽어 초기 연출, 미지정 시 기본 1.5+아군 군주). "기본 줌 복귀" 버튼으로 수동 줌/팬 후 복귀. 상세 docs/design/feel-spec.md §A.
- **대형맵**: 청크 분할 + 오버랩 img2img (적벽급 소수만, 대부분 맵은 모바일 다이어트라 통짜 생성 OK).
- **맵·스테이지 에디터** (`tools/stage-editor.html`): 지형 칠하기(맵 단독 모드) + 유닛 배치 + 스테이지 전체 편집. 칸 칠하기 → map JSON + 블록아웃 PNG export. 27스테이지를 "칠하고→생성" 데이터 작업으로. `tools/map-editor.html`은 이 파일로 리다이렉트하는 stub.

### 서버 비용 전망
- 싱글 게임 + 정적 배포 + 비동기 기록 구조라 수천 유저 월 0~5만 원, 수만 유저 월 10~30만 원 수준
- 비용의 본체는 개발 단계 생성 API (1회성, 콘텐츠 비례) — 유저 증가에 비용이 비례하지 않는 건강한 구조

---
