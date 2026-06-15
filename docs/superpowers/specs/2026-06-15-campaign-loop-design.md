# 캠페인 루프 + 시나리오 씬 + 에셋 매니페스트 (1회차 완성) — 설계 (2026-06-15)

> 설계 기준: CLAUDE.md §5(유비전 27스테이지 시나리오), §3-1(painted 배경·격자), §4(에셋 파이프라인 —
> 모든 에셋은 생성 출력물·재생성 가능), §12(클리어 결산), §16(데이터-코드 분리·문서화 우선).

## 0. 목표

고립된 전투를 **진짜 캠페인 루프**로: **stages → intro 시나리오 씬 → 상점/편성 → 전투 → outro 씬 →
다음 스테이지 intro(자동 연결)**. 27스테이지 1회차를 처음부터 끝까지 "이야기 있는 게임"으로 플레이.
이미지는 **임의 placeholder**로 시작하고, 실제 파일을 경로 규약에 드롭하면 자동 반영. 각 씬에 필요한
이미지는 **에셋 매니페스트**로 길중에게 생성 요청.

## 1. 현황 (재사용 vs 신규)
- 재사용: 27스테이지 전투 데이터(유닛·목표·이벤트·증원·보상) 완성. 전투 내 `DialogueOverlay`(타자기·
  화자/진영·portraitId·이니셜 폴백) 작동. 라우트(/, /stages, /prep, /battle, /codex, /serendipity).
  `DialogueLine{speaker, side?, portraitId?, text}`.
- 신규: 막간 시나리오 씬(전투 밖), 캠페인 자동 시퀀싱, AssetImage placeholder, 에셋 매니페스트,
  26스테이지 시나리오 텍스트(05만 존재).

## 2. 콘텐츠 깊이 (확정: 표준 장면극)
- 스테이지당 **intro 4~6 대사 + outro 2~4 대사**, 배경 1장 + 화자 초상. VN 톤. 핵심 스테이지(일기토·
  보스·분기: 05·06·14·17·20·21·26·27)는 더 길게.
- 창작 한국어(§5 챕터 기반). **법적 라인 준수**: 게임 시스템·역사 인물·실존 전투 자유 / 코에이 텍스트·
  명칭·스타일 모방 금지 — 원작 대사 베끼기 금지, 우리 표현으로.

## 3. 아키텍처

### 3.1 스키마 (`packages/data/src/schemas.ts`)
- `ScenarioSceneSchema = z.object({ bg: z.string().optional(), lines: z.array(DialogueLineSchema).min(1) })`.
- `StageSchema.scenario`(optional): `{ intro?: ScenarioScene, outro?: ScenarioScene, outroDefeat?: ScenarioScene }`.
  하위호환 — 미지정 스테이지는 씬 없이 기존 흐름.
- `DialogueLine.portraitId`(기존) 재사용 = 초상 에셋 키(commanderId 권장).

### 3.2 AssetImage (`apps/web/src/ui/AssetImage.tsx`)
- props `{ src, kind: "portrait"|"bg", label, alt }`. `<img onError>` → **placeholder**(kind별: portrait=진영색
  박스+이름 이니셜, bg=수묵 톤 그라데이션+라벨). 실제 파일이 경로에 있으면 그대로 표시(드롭-인 업그레이드).
- 경로 규약: 초상 `/assets/ui/portraits/{id}.webp`, 씬 배경 `/assets/scenes/{bgId}.webp`.

### 3.3 ScenePlayer (`apps/web/src/scene/`)
- 라우트 `apps/web/app/scene/page.tsx` — `?stage=ID&type=intro|outro`.
- `ScenePlayer.tsx`: 풀스크린 배경(AssetImage bg) + 하단 텍스트박스(화자명·초상·타자기·탭 진행·전체 스킵).
  대사 진행 로직은 in-battle DialogueOverlay 타자기 재사용(공통 훅 `useTypewriter`로 추출).
- 끝나면: intro → `/prep?stage=ID`; outro → `campaign.nextStageId` 있으면 `/scene?stage=NEXT&type=intro`,
  없으면 `/stages`. 시나리오 없으면 씬 건너뛰고 바로 다음 단계(빈 씬 가드).

### 3.4 캠페인 시퀀싱 (`apps/web/src/meta/campaign.ts`)
- 순수: `orderedStageIds()`(번호순), `nextStageId(id)`, `stageNumber(id)`, `chapterOf(num)`(StageSelect 재사용).
- StageSelect "출진 ▶" → `/scene?stage=ID&type=intro`(씬 있으면) 또는 기존 `/prep`(씬 없으면).
- ResultSequence 승리 버튼: "전장 선택"을 **"다음으로 ▶"**(outro 씬 있으면 `/scene?type=outro`, 없으면 다음
  스테이지 prep 또는 /stages)로. 패배는 outroDefeat 있으면 씬, 없으면 기존.

### 3.5 에셋 매니페스트 (`packages/sim/src/asset-manifest-cli.ts` 또는 tool)
- 전 스테이지 scenario(intro/outro lines의 portraitId·bg) + 로스터/전투 유닛 commanderId 스캔 →
  필요한 이미지 집합 산출. 출력 `docs/reference/asset-manifest.md`:
  - **초상**: id·이름·최초 등장 스테이지·경로·존재여부(public 스캔)·프롬프트 힌트.
  - **씬 배경**: bgId·스테이지·intro/outro·경로·존재여부·장면 설명(프롬프트 힌트).
  - **맵 배경**: stageId·경로·치수·존재여부.
- package.json script `asset-manifest`. 결정론(데이터 스캔).

### 3.6 시나리오 콘텐츠 (스테이지 JSON `scenario`)
- 각 스테이지 JSON에 `scenario{intro,outro}` 추가. bgId = `{stageId}-intro`/`{stageId}-outro` 규약.
  portraitId = 화자 commanderId. §5 챕터 서사를 우리 표현으로.

## 4. 구현 웨이브 (커밋 단위)
- **W1 시스템**: 스키마 + AssetImage + ScenePlayer + campaign.ts + 매니페스트 생성기 + 05 사수관
  intro/outro 시나리오(수직 슬라이스). 프리뷰로 stages→intro→prep→battle→outro 검증.
- **W2** 1장(01-04) · **W3** 2장(05-09) · **W4** 3장(10-15) · **W5** 4장(16-22) · **W6** 5장(23-27)
  시나리오 작성 + 매니페스트 갱신. (05는 W1에서 일부, W3에서 보강.)

## 5. 테스트
- 스키마: ScenarioScene 파싱, Stage.scenario optional 하위호환(@tk/data 검증).
- campaign.ts: orderedStageIds·nextStageId·chapterOf 순수 단위테스트.
- 매니페스트: 스캔이 portraitId/bg를 수집, 존재여부 정확(node).
- AssetImage/ScenePlayer: 프리뷰 실증(빈 씬 가드·placeholder·타자기·진행). DOM은 가능 범위 유닛.
- 핀 vitest(`pnpm -r test`).

## 6. 비범위(후속)
- 일기토 컷신 영상(§9 — 애니메이션 에셋 후 v1 막바지). 씬은 정지 배경+초상까지.
- BGM/보이스 — 후속(에셋 파이프라인).
- 가상 모드 분기(§15 v1 제외). 1회차 사실 모드만.
- 실제 일러스트 — 길중 생성(매니페스트가 요청). C는 placeholder + 드롭-인까지.

## 7. 결정론·정합
- 씬·캠페인은 전투 밖 메타 — 결정론 전투(§2-1)·밸런스 sim·리더보드 무관.
- scenario는 데이터(JSON), 코드와 분리(§16). 매니페스트는 데이터 스캔(결정론).
- 에셋 placeholder/드롭-인 = "모든 에셋은 생성 출력물·재생성 가능"(§2-7)에 정합.
