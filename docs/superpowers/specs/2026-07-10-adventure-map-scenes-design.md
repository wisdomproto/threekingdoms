# 막간 씬 v4 — 어드벤처 맵 씬 설계 (2026-07-10)

> **v3(디에게틱 근경 무대) 대체.** 경쟁작 플레이 영상 프레임 실측
> (docs/reference/competitor-shu-han-yubijeon-video-analysis.md)으로 원본 막간 문법이
> "근경 무대 + 대형 배우"가 아니라 **어드벤처 맵 씬**(타일 맵 위를 SD 캐릭터가 걸어 다니며 대사 진행)
> 임을 확정 — 길중 지적("캐릭터들이 움직여, 2차원 배열느낌")이 계기. v3 산출물은 **삭제**(길중 결정).
> ⚠ 원본은 **문법·레이아웃 참고만** — 맵·대사·아트는 전부 우리 창작(법적 라인, CLAUDE.md §1).

## 길중 지시사항 (설계 구속)

1. **초반 퀄리티 최우선.** 첫 10분(01 도원결의)이 게임 인상을 결정 — 수직 완성은 원본 프롤로그
   밀도(3장소 순회·선택지·의식 포즈)를 기준점으로 삼는다. 01 게이트 통과 후 롤아웃도
   **1장(02~04)을 마퀴에 준해 우선 저작**(마퀴 목록에 없더라도).
2. 적용 범위 = **마퀴 씬만**(+위 1장 우선 조항). 나머지 스테이지는 기존 VN 유지.
3. 도보 SD = **idle + move + 의식 포즈**(무릎 꿇기 등 마퀴 비트 전용 소수).
4. 두루마리 선택지 **포함**(분기 없음 — 반응 대사만).
5. v3 근경 무대 = **삭제**(컷인 축소 유지 아님).

## 접근 결정

| 접근 | 요지 | 판정 |
|---|---|---|
| A. BattleRenderer 씬 모드 | 전투 렌더러에 분기 플래그 | 전투 크리티컬 패스에 조건문 — 회귀 위험, 기각 |
| **B. 씬 전용 경량 러너** | 전투 렌더러 불변, **구성 레이어만 재사용**해 얇은 오케스트레이터 신설 | **채택** |
| C. DOM 맵 재현 | 격자·이동을 DOM 재발명 | 기각 |

B의 재사용 부품(전부 검증됨): painted 배경 로더 + 타일 폴백, ObjectLayer(데코·오브젝트),
UnitView(스프라이트·moveAlong 걷기+발소리·병력바 없이), 카메라/뷰포트, textures/loadSprites.

## 데이터 모델 (계약)

### 씬 슬롯 = 파트 배열 (하위호환)

`stage.scenario.{intro,outro,outroDefeat}`가 **단일 VN 객체 또는 파트 배열**을 받는다:

```ts
SceneSlot = ScenarioScene | ScenePart[]     // 기존 단일 객체 = VN 1파트로 정규화(로더)
ScenePart = ScenarioScene                   // VN 파트 (기존 그대로 — 내레이션 카드·초상 대사)
          | MapScene                        // 맵 파트 (신규)
```

판별 = `map` 필드 존재 여부. 기존 27스테이지 씬(단일 VN)은 무변경으로 유효.

### MapScene

```ts
MapScene = {
  map: string;                   // 씬 맵 id ("scene-01-street" — maps/scene-*.json)
  label?: string;                // 좌상단 장소 라벨 ("탁군 · 거리")
  units: SceneUnit[];            // 씬 등장 유닛(초기 배치)
  decorations?: Decoration[];    // 씬 소품(실내 탁자·카펫 등 — StageSchema.decorations와 동일 스키마)
  lines: MapSceneLine[];         // 진행 스크립트 (min 1)
}

SceneUnit = {
  id: string;                    // 씬 내 안정 참조 ("liubei", "farmer1")
  sprite: string;                // 스프라이트 폴더 키 직접 저작 ("liubei-foot", "footman_player")
  cell: [number, number];        // 초기 격자 좌표 [x, y]
  facing?: "left" | "right";     // 기본 left(코드 미러 규약 동일)
  hidden?: boolean;              // true = 등장 전(후속 enter로 걸어 들어옴)
}

MapSceneLine = {
  // ── 액션(대사 전에 순차 실행, 탭 = 즉시 완료 상태로 스킵) ──
  move?: { id: string; to: [number, number] }[];   // 걷기(경로 = 통행 가능 칸 BFS, moveAlong)
  face?: { id: string; dir: "left" | "right" }[];
  enter?: { id: string; from: [number, number]; to: [number, number] }[]; // hidden 유닛 등장(걸어 들어옴)
  exit?: { id: string; to: [number, number] }[];   // 걸어 나가서 hidden
  pose?: { id: string; pose: string }[];           // 의식 포즈 전환("kneel" — 해제는 pose:"idle")
  // ── 대사(액션 완료 후 표시. 전부 생략 = 액션만 있는 비트) ──
  speaker?: string;              // 대사창 화자명(생략 = 내레이션 오버레이)
  portraitId?: string;           // 대사창 초상(한국어 키 — 기존 규약)
  side?: Side;                   // 화자명 진영색(기존 규약)
  text?: string;                 // 본문(타자기). 생략 = 액션 비트(자동 진행)
  bubble?: { id: string; mark: "..." | "!" | "?" }; // 유닛 머리 위 말풍선(그 줄 동안)
  // ── 선택지(두루마리 — 분기 없음) ──
  choice?: {
    prompt?: string;             // 상단 질문(생략 가능)
    options: { label: string; react?: ReactLine[] }[];     // 선택 → react 줄들 재생 후 다음 줄
  };
}

// react 줄 = 대사·말풍선만(액션·choice 금지 — zod로 강제). 근거: ①분기 없음 결정과 정합
// ②순수 인터프리터가 "어떤 옵션을 골랐나"를 입력받지 않아도 유닛 상태가 결정됨(리뷰 #1)
// ③스킵 시 미선택 react를 무시해도 상태 비결정이 없음.
ReactLine = Pick<MapSceneLine, "speaker" | "portraitId" | "side" | "text" | "bubble">;
```

**계약 확정:**
- **액션 → 대사 순서**: 한 줄의 move/enter/exit/pose가 전부 끝난 뒤 text 타자기 시작.
  진행 중 탭 = 액션을 종료 상태로 점프(이동 완료 위치·포즈 적용). text 없는 줄은 액션 완료 후 자동 다음 줄.
- **id 미매칭 = no-op**(크래시 금지 — v2 계약 계승). move 목적지가 통행 불가/점유 칸이면
  가장 가까운 인접 통행 칸으로 보정(저작 실수 무붕괴).
- **choice는 분기 없음**: 어떤 옵션이든 react 재생 후 같은 다음 줄로 합류. 저장 없음.
  한 줄에 text와 choice가 같이 있으면 **text 타자기 완료 → choice 표시** 순서.
- **스킵 버튼** = 파트 잔여 줄 전부 종료 상태 적용 후 다음 파트(또는 onComplete). 미선택 choice의
  react는 적용하지 않음(react가 액션 불가라 상태 비결정 없음). VN 파트 스킵과 동일 UX.
- 파트 전환 = 페이드 아웃/인(기존 씬 전환 문법).
- **SceneSlot zod 판별 = `map` 키 우선**: 단순 union에 VN을 먼저 두면 MapScene이 비-strict
  ScenarioScene으로 *조용히 오파싱*되어 map/units가 벗겨진다 — MapScene을 union 앞에 두거나
  map 존재를 먼저 검사. "MapScene이 VN으로 오파싱되지 않음" 테스트 필수(§테스트).

### v3 필드 정리 (삭제)

`ScenarioScene.actors` / `ScenarioLine.{actor,enter,exit,emote}` / `StageActorSchema` 제거.
01-zhuojun.json의 v3 저작(actors·enter·bg 전환)도 함께 되돌림(§수직 완성에서 v4로 재저작).
`line.bg`(줄 단위 배경 전환)는 **유지** — VN 파트 문법(씬 v2)이며 v3와 무관.

## 씬 맵

- **시점 = 직교 격자 + 3/4 painted** (2026-07-10 길중 확정). 원본 실측상 시나리오 맵은
  쿼터뷰(아이소)인데 — 우리는 격자·이동·엔진은 지금 그대로(직교, §3-1) 두고 **painted 배경을
  높은 3/4 각도로 그려** 입체감을 낸다(RPG쯔꾸르/포켓몬 문법: 벽·가구에 높이와 정면 파사드,
  바닥은 직교 평면). 유닛 SD가 이미 3/4 정면이라 정합. 다이아몬드 아이소 재도입은 §3-1 폐기
  결정 번복이라 기각 — 씬 맵 프롬프트에 "elevated 3/4 view, front facades visible" 지시가 핵심.
- **전용 소형 맵 신규 저작**(~15×10, 원본 문법): 거리·주점(실내)·과수원·(후속) 성루·나루터 등.
- 포맷 = 기존 BattleMap JSON 그대로, id 규약 `scene-{stage}-{장소}` (`maps/scene-01-street.json`).
  ⚠ **맵 레지스트리 등록 필요**: `gameData.maps`는 `packages/data/src/index.ts`의 정적 import
  수동 레지스트리 — 신규 씬 맵마다 등록 1줄(리뷰 #2). 롤아웃 목표는 "데이터+에셋+맵 등록 1줄"로 정정.
- painted 배경 = 기존 청크 파이프라인(export_chunks → 보드 stitch) **재사용하되 씬 전용 프롬프트
  변형 필수**(리뷰 #6): 기존 `CHUNK_PROMPT`는 엄격 top-down·구조물 금지 — 씬 맵은 정반대
  ("elevated 3/4 view, front facades visible, 실내 가구 허용") 지시가 핵심이라 보드에 씬 맵용
  프롬프트 분기를 신설.
- **씬 소품 = `MapScene.decorations`**(데이터 모델 참조). `DECORATION_KINDS`는 야외 화이트리스트라
  **실내 kind 신설**(table·carpet·screen·counter 등) + ⚠ `textures.ts OBJECT_FILES` 등록 필수
  (미등록 키는 조용히 생략 — §3-1에서 두 번 밟은 함정, 리뷰 #3).
- 실내 맵 지형 = 벽=wall·바닥=평지 재사용(통행 데이터가 이동 경로의 진실). 단 **SceneStage는
  지형 구동 오브젝트(성벽 오토타일·성문)를 끈다**(리뷰 #5) — ObjectLayer가 wall에 성곽 아트를
  얹으면 주점 벽이 성벽이 됨. 씬 맵의 벽·건물은 painted가 그리고, 격자는 통행만 담당.
- 카메라 = **맵 전체 fit**(소형이라 한 화면). 팬/줌 연출은 YAGNI(후속).

## 도보 SD (에셋)

- **규약**: `sprites/{key}-foot/` — 기존 스프라이트 폴더 문법(front_idle/front_move + 의식 포즈
  `front_kneel` 등). ⚠ **의식 포즈는 "코드 무변경"이 아님 — 3지점 확장 필요**(리뷰 #4):
  ① `rebuild_manifest.py`의 `POSE_ORDER`가 idle/move/attack 고정 화이트리스트라 kneel이 조용히
  누락 — 포즈 목록 확장. ② `UnitView` pose 타입이 `"idle"|"move"|"attack"` 유니온 — 커스텀 포즈
  스왑 API 확장. ③ 보드 📤 자동 컷 경로가 기본 3포즈 매핑이라 kneel 칸이 `front_attack.png`로
  오명명 — 도보 시트 카드가 serve.py에 포즈 인자를 전달하는 배선 추가.
- **물량**: 마퀴 등장 8명(유비·관우·장비·조운·제갈량·여포·조조·주유) × idle/move (+의식 포즈는
  비트 필요분만 — 도원결의 무릎 3명 등). 무명 조연(농민·점원)은 **기존 도보 병종 제네릭 재사용**
  (footman/civilian 계열 — 백성 스프라이트 보유).
- **생성**: 에셋보드 SD 포즈시트 카드 변형 — 탈것/무기 주입 제거한 "도보 시트"(idle/move/의식 3칸).
  기존 컷 파이프라인(cut_posesheet) 그대로. v3 「SA. 씬 배우」 대형 배우 카드는 **삭제**하고 이 카드로 대체.
- 씬 유닛은 `sprite` 키 직접 저작(전투 리졸버 우회 — v2 결정 4 계승). 전투 스프라이트와 스케일·화풍
  동일(같은 파이프라인 산출물)이라 씬↔전투 시각 일관성 확보.

## 러너 구조

**순수 인터프리터 / 렌더 분리** (테스트 가능 코어 — actorStage 헬퍼 전통 계승):

- `apps/web/src/scene/map/interpreter.ts` (순수, vitest 대상):
  - `sceneUnitStates(scene, lineIdx): Map<id, {cell, facing, pose, hidden}>` — idx까지 액션 누적한
    유닛 상태(선행 스캔 불필요 — hidden 초기값+enter/exit 명시라 v3보다 단순).
  - `lineActions(line): Action[]` — 한 줄의 실행 큐(정렬: exit→move/face→enter→pose).
  - 목적지 보정(`nearestWalkable`), 경로(BFS — 기존 경로 유틸 재사용 가능하면 재사용).
- `apps/web/src/scene/map/SceneStage.ts` (Pixi 조립, BattleRenderer 불변):
  - 맵 로드(painted+타일 폴백) → ObjectLayer(데코) → 유닛 스폰(UnitView, 병력바·SP바 숨김)
  - 액션 실행(`moveAlong` 걷기+발소리, facing 미러, 포즈 스왑) — 인터프리터 상태로 검증 가능
  - 말풍선 = UnitView 위 소형 Pixi 텍스트 마크(bubble)
- `apps/web/src/scene/MapScenePlayer.tsx` (셸): 캔버스 + 하단 대사창(**기존 parts/DialoguePanel·
  NarrationPanel 재사용**) + SkipBar + 장소 라벨 + 두루마리 선택지 오버레이(DOM). 탭 진행 계약 상동.
- `apps/web/app/scene/page.tsx`: 슬롯 정규화(단일→배열) 후 파트 순차 재생 —
  `part.map ? MapScenePlayer : ScenePlayer`. 캠페인 루프·페이드 내비 불변.

```
scenario.intro (ScenePart[])
  → /scene?stage=ID&type=intro
  → [VN 카드] → fade → [맵: 거리] → fade → [맵: 주점] → fade → [맵: 과수원] → onComplete
        ScenePlayer         MapScenePlayer(SceneStage + DialoguePanel + 선택지)
```

전투 밖 컷신 = 엔진/결정론 무관(§2-1). 씬 내 아이템 지급은 **비범위**(결산 지급 유지 — 메타 영속 규칙).

## v3 삭제 목록

| 대상 | 처분 |
|---|---|
| `StagedScenePlayer.tsx`, `parts/ActorStage.tsx` | 삭제 |
| `actorStage.ts`의 `actorSpriteCandidates`/`actorFrameUrls`/`visibleActorIds` + 테스트 | 삭제(인터프리터 테스트가 대체) |
| 스키마 `StageActorSchema`·`actors`·line `actor/enter/exit/emote` | 삭제(§데이터 모델) |
| serve.py `_split_actor_frames`(플립북 분할)·보드 SA 대형 배우 카드·staged 근경 배경 11카드 | 삭제(도보 시트 카드로 대체) |
| `/assets/scene-actors/*`(대형 배우 3장)·`01-zhuojun-staged.webp` | 로컬+R2 삭제 |
| 01-zhuojun.json v3 저작 | v4 파트 배열로 재저작 |
| **유지**: ScenePlayer(VN)·useSceneProgression·parts 조각(추출 리팩터 전부)·씬 v2 문법 | 맵 파트도 대사창 재사용 |

## 수직 완성 — 01 도원결의 (품질 기준점)

- 구성: **VN 개막 카드(정세 내레이션) → 거리(방문자 소문·장비 조우) → 주점(관우 합류) →
  과수원(맹세·무릎 포즈·선택지 1개)**. 대사·연출 전부 우리 창작(§5 챕터 톤) — 원본 밀도만 참고.
- 필요 에셋: 씬 맵 3장(거리·주점·과수원 — 지형 저작+painted) + 삼형제 도보 시트 3장(idle/move/kneel).
- **게이트**: 길중이 원본 프롤로그 영상과 나란히 판정. 통과 → 1장(02~04) → 마퀴 순 롤아웃.
- 이후 롤아웃 = 데이터+에셋 저작 + 맵 레지스트리 등록 1줄(index.ts — 리뷰 #2 정정). 그 외 코드 무변경이 목표.

## 테스트

- **인터프리터**(순수) vitest: 상태 누적(초기 hidden·enter·exit·move·pose), id 미매칭 no-op,
  목적지 보정, 액션 정렬. 스키마 zod: 파트 배열/단일 하위호환, MapScene 파싱, choice 구조
  (react에 액션 필드 거부), **MapScene이 VN으로 오파싱되지 않음**(union 판별), v3 필드 거부(제거 확인).
- **시각 = 길중 눈** + 프리뷰 DOM 검증 한계(Pixi는 hidden rAF 정지 — 대사창·선택지 DOM만 확인 가능,
  걷기·말풍선은 실기기).

## 리스크 / 하위호환

- 기존 27 VN 씬 무변경(단일 객체 = 1파트 정규화). 캠페인 루프 불변.
- v3 삭제로 오늘(07-10) 생성 에셋 4장 매몰 — 결정 사항(재생성 비용 낮음, 도보 시트가 대체).
- UnitView 재사용 시 전투 전용 부속(병력바·SP바·틴트) 노출 위험 — 씬 모드 생성 옵션으로 숨김(신규 플래그 1개).
- 의식 포즈는 스프라이트 시트 1칸 추가라 파이프라인 부담 낮음. 걷기 루프 없음(move 포즈+주스)은
  전투와 동일 트레이드오프(§4) — 원본도 프레임 수 적음.

## 파일 요약 (신규/변경/삭제)

- `packages/data/src/schemas.ts` — SceneSlot 배열화·MapScene/SceneUnit/MapSceneLine/ReactLine 신설·v3 필드 삭제·`DECORATION_KINDS` 실내 kind 확장
- `packages/data/src/index.ts` — 씬 맵 레지스트리 등록(맵당 1줄)
- `apps/web/src/scene/map/{interpreter.ts, SceneStage.ts}` + `MapScenePlayer.tsx` (신규)
- `apps/web/src/scene/{StagedScenePlayer,parts/ActorStage}.tsx`·`actorStage.ts` (삭제)
- `apps/web/app/scene/page.tsx` — 파트 순차 재생
- `apps/web/src/pixi/layers/UnitView.ts` — 씬 모드(병력/SP바 숨김)·커스텀 포즈 스왑 / `textures.ts` — 실내 데코 OBJECT_FILES
- `tools/serve.py` — 플립북 분할 제거·도보 시트 포즈 인자 / `tools/sprite-pipeline/rebuild_manifest.py` — POSE_ORDER 확장
- `docs/art/asset-board.html` — SA·staged 카드 삭제 → 도보 시트 카드·씬 맵 청크 프롬프트 변형
- `packages/data/json/maps/scene-01-*.json` ×3 + `stages/01-zhuojun.json` 재저작
- `sprites/{liubei,guanyu,zhangfei}-foot/` (에셋 — 생성 게이트)

## 후속 (비범위)

- 1장(02~04)·마퀴 나머지 롤아웃(데이터+에셋 저작). 카메라 팬/줌 연출. 씬 내 아이템 지급.
- 막간 허브(군영 맵 — /prep 셸 격상)는 v1.5 마을 탐방 백로그와 합류 검토.
- 가상 분기 도입 시 choice의 실분기 확장.
