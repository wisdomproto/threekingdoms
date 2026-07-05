# 디에게틱 막간 스테이지 씬 — 설계 (2026-07-05)

## 배경 / 문제

경쟁작 「삼국지 촉한 유비전」(蜀汉刘备传, docs/reference/competitor-shu-han-yubijeon-analysis.md) 대비
우리 막간 씬의 품질 갭. 길중 평가: "전투 사이 시나리오가 엄청 고퀄, 우리꺼랑 차이가 많이 난다."

원인 분해 (길중이 4개 갭 전부 선택: 연출 포맷·배경 충전율·서사 밀도·부가 UI):
- **핵심 = 연출 포맷.** 우리 §5 막간은 VN 분리형(`ScenePlayer`: 배경 1장 + 화자 초상 1명 + 대사창,
  스프라이트 없음). 경쟁작은 **painted 바닥 위에 SD 유닛을 실제로 세워** 진행(디에게틱) → 인물이
  "장면 안에" 있는 느낌. 우리는 인물이 "화면 밖"에서 말하는 느낌.
- 배경 충전율·서사 밀도는 별도 트랙(에셋 생성·집필). **포맷을 바꾸면 그 둘의 그릇이 커진다** —
  스프라이트가 빈 배경을 채우고, 서사 캔버스가 넓어짐.

이 문제의 핵심은 새 시스템이 아니라 **연출 문법 격상**이다. 배경 생성(출시 게이트)·집필은 이 스펙 밖.

## 범위

- **적용 = 마퀴 순간(★)만** (§4 투자 등급 철학·비용 통제). 전 27스테이지 아님. 나머지는 VN 유지.
- 후보 ~11개 (아래 §저작). 길중 최종 픽/조정.
- **비범위 (YAGNI)**:
  - 두루마리 선택지 UI — 선택 분기(가상 모드)는 §5에서 v1 제외. 분기 도입 시 별도.
  - Pixi 전투 렌더러 재사용(접근 A) — 정적 컷신엔 카메라·VFX·엔진 상태가 오버킬.
  - 줄 단위 카메라 무빙·복잡 안무.
  - 전투 손맛 트랙(회심 틴트·저체력 상태·멀티프레임 공격) — 별도 후속(분석 문서 §2-B).

## 접근 결정

3안 비교 후 **접근 B = DOM/CSS 스프라이트 스테이지** 채택.

| 접근 | 요지 | 판정 |
|---|---|---|
| A. Pixi 전투 렌더러 재사용 | 컷신 스테이지를 BattleRenderer로 | 파리티 100%지만 정적 컷신엔 과투자·엔진 강결합 |
| **B. DOM/CSS 스프라이트 스테이지** | ScenePlayer 형제, front 포즈 PNG를 배경 위 배치 | **채택** — 비용 20%로 손맛 90%, Pixi 결합 없음, 기존 에셋 재사용 |
| C. 초상 구도 VN++ | 초상 유지·구도만 강화 | 디에게틱 느낌 못 냄(탈락) |

근거: 정적 컷신은 전투 렌더러의 가치(라이브 전투·카메라·VFX·엔진 상태)를 하나도 안 쓴다.
top-down SD 유닛을 painted 바닥에 세우는 건 경쟁작이 도원결의에서 실증(통함).

## 데이터 모델 (계약)

새 필드 **전부 optional** → 기존 26개 VN 씬 무변경(하위호환). `scene.actors` 존재 = 스테이지 씬.
스키마 = `packages/data/src/schemas.ts` (`ScenarioSceneSchema`·`ScenarioLineSchema` 확장).

```ts
// ScenarioScene에 추가
actors?: StageActor[];          // 있으면 디에게틱 스테이지, 없으면 기존 VN

StageActor = {
  id: string;                   // 씬 내 안정 참조 ("liubei", "guanyu")
  sprite: string;               // /assets/sprites/{sprite}/front_idle.png 의 {sprite}
  x: number;                    // 0~100 가로 위치(%)
  y?: number;                   // 0~100 바닥선(기본 하단 1/3)
  facing?: "left" | "right";    // 스프라이트 미러(기본 데이터 그대로)
  scale?: number;               // 기본 1
}

// ScenarioLine에 추가 (전부 선택)
actor?: string;                 // 이 줄을 말하는 배우 id → 스포트라이트
enter?: string[];               // 이 줄에서 등장하는 배우 id
exit?: string[];                // 이 줄에서 퇴장하는 배우 id
emote?: "..." | "!" | "?";      // 말하는 배우 위 말풍선 마크
```

**결정 3가지:**
1. **플레이어 선택 = `scene.actors?.length` 여부.** 별도 플래그·라우트 타입 없음. 기존 `intro`/`outro`
   슬롯 그대로 쓰고 배우만 얹음.
2. **화자↔배우 연결 = `line.actor` id 매칭** (이름 문자열 커플링 회피). 기존 `line.speaker`/
   `portraitId`는 하단 대사창 표시용으로 유지 — 스테이지 씬도 대사창은 VN과 동일.
3. **enter/exit 최소 스펙.** 배우는 씬 시작부터 상주가 기본. 필요한 비트만 등장/퇴장 표시.
   미지정이면 전원 상주(YAGNI).
4. **`StageActor.sprite`는 스프라이트 폴더명을 직접 저작** — `spriteCandidates`/`COMMANDER_SPRITE_MAP`
   리졸버를 **우회**한다(마퀴 씬은 손저작이라 병종/side 해석 불필요). 값 = `/assets/sprites/{sprite}/`
   폴더명: 영문 override가 있으면 그것(`liubei`·`guanyu`·`zhangfei`·`lvbu` 등 COMMANDER_SPRITE_MAP),
   없으면 한국어 commanderId(`sprites/{한국어}/` 규약). 저작자가 존재하는 폴더명을 직접 씀.

**엣지 케이스 (계약 확정):**
- `line.actor`가 `scene.actors[]`에 없거나 현재 미등장(enter 전/exit 후)이면 **스포트라이트 no-op**
  — 크래시·에러 없음. 대사창은 `line.speaker`/`portraitId`로 정상 표시(무대와 독립).
- 여러 배우가 같은 기본 `y`를 공유하면 z-정렬 **타이브레이크 = `actors[]` 배열 순서**(뒤일수록 앞).
- `scale`은 스프라이트 크기만 조절, 발밑 앵커·그림자 위치는 불변(발이 바닥선 `y`에 고정).
- `emote` 말풍선 겹침·화면 가장자리 클램프는 **저작 책임**(마퀴 손저작이라 배치로 회피).

## 컴포넌트 구조

원칙: VN과 스테이지 씬은 80% 공유(타자기·탭 진행·스킵·내레이션·배경 전환·대사창).
새 유닛은 배우 레이어 하나. 나머지는 공유 추출(현 171줄 monolithic `ScenePlayer` 정리 겸).

**공유 추출** (모두 `apps/web/src/scene/`):
- `useSceneProgression` (훅) — idx·타자기(shown/done/reveal)·advance·인덱스 클램프·현재 배경 계산.
  현재 ScenePlayer 인라인 상태 로직을 이관. 순수하게 상태/진행만 — 렌더 없음.
- 프레젠테이션 조각:
  - `SceneBackground` — bg 이미지 + 페이드 전환(line.bg key 교체) + 오프닝 페이드-투-블랙.
  - `DialoguePanel` — 화자 초상(96×116) + 이름(side 색) + 타자기 텍스트 + 진행 캐럿.
  - `NarrationPanel` — 초상 없는 중앙 서술 박스(speaker 생략 줄).
  - `SkipBar` — 상단 타이틀 + 건너뛰기 버튼.

**두 플레이어 = 얇은 조립:**
- `ScenePlayer` (VN) = `SceneBackground` + (Dialogue|Narration)Panel + SkipBar. 기존 동작 동일.
- `StagedScenePlayer` (신규) = 위 + `ActorStage`(배경과 대사창 사이 레이어).

**`ActorStage` (유일한 새 렌더 유닛 — DOM/CSS, Pixi 없음):**
- 배우 = 절대배치 `ActorSprite`(아래). z-정렬 = `y` 오름차순(낮을수록 뒤·클수록 앞), 동률은 배열 순서.
  발밑 그림자 타원(발=바닥선 `y`에 고정, `scale` 무관).
- 말하는 배우(`line.actor`): 밝기↑ + `scale ~1.05` + 부드러운 bob(CSS keyframe) + emote 말풍선.
  비화자: 디밍(brightness/opacity↓) — 경쟁작 스포트라이트 문법. `line.actor` 미매칭/미등장 = no-op.
- enter/exit: 측면 슬라이드 + 페이드(CSS transition).
- facing: `transform: scaleX(-1)` 미러.

**`ActorSprite` (ActorStage 내부 — 폴백 체인 소유):**
- ⚠ `AssetImage`를 쓰지 **않는다** — AssetImage는 단일 `failed`→placeholder라 *URL 체인 불가*
  (리뷰 지적). 대신 자체 `<img>` + onError로 후보 URL을 순차 소진:
  ① `/assets/sprites/{sprite}/front_idle.png` → ② `/assets/ui/portraits/{sprite}.webp`(흉상)
  → ③ **CSS 실루엣**(어두운 라운드 실루엣 박스 + 이니셜, ActorStage가 직접 렌더 — AssetImage placeholder 아님).
- 미생성 마퀴 캐릭터도 무언가는 무대에 섬 — 드롭인 원칙 유지, 무붕괴.

**순수 헬퍼** (`apps/web/src/scene/actorStage.ts` — 테스트 대상):
- `actorSpriteCandidates(actor): string[]` → `[front 포즈 URL, 초상 URL]`(assetUrl 경유). ③ 실루엣은
  URL 아닌 렌더 폴백이라 이 배열엔 없음. `ActorSprite`가 이 배열을 onError로 순차 시도.
- `visibleActorIds(lines, idx): Set<string>` → idx까지 `enter`/`exit` 누적한 등장 배우 집합.
  (배우 기본 상주 + enter 추가 + exit 제거. 첫 등장 전 enter 없으면 상주로 간주.)

**라우트 배선** (`apps/web/app/scene/page.tsx`): 한 줄 분기
`const Player = scene.actors?.length ? StagedScenePlayer : ScenePlayer;`
props(`scene`/`title`/`onComplete`) 동일 — 캠페인 루프·페이드 내비 불변.

## 데이터 흐름

```
stage.scenario.intro (ScenarioScene, actors 포함)
  → /scene?stage=ID&type=intro (page.tsx)
  → scene.actors 있음 → StagedScenePlayer
     ├ useSceneProgression(scene) → { idx, line, shown, done, advance, currentBg, isNarration }
     ├ SceneBackground(currentBg)
     ├ ActorStage(actors, visibleActorIds(lines, idx), speakingId=line.actor, emote=line.emote)
     └ DialoguePanel | NarrationPanel (line, shown, done)
  → 마지막 줄 advance → onComplete → fadeTo(다음 단계)
```

전투 밖 컷신 → 엔진/결정론 무관(§2-1). 순수 표현.

## 저작 (마퀴 후보 ~11)

기존 intro/outro 슬롯에 `actors` + `line.actor` 추가. 배경은 painted 씬 배경(없으면 placeholder).

| 스테이지 | 슬롯 | 장면 |
|---|---|---|
| 01 탁군 | intro | 도원결의 (삼형제 — 간판 오프닝) |
| 06 호로관 | intro | 삼형제 vs 여포 대치 |
| 14 하비2 | outro | 여포 최후 |
| 17 여남 | intro | 관우 재회 (감정 비트) |
| 18 박망파 | intro | 삼고초려 / 제갈량 데뷔 |
| 20 장판파 | intro | 조운 단기필마 |
| 21 장판교 | intro | 장비 단신 |
| 22 한진 | outro | 관우 합류 |
| 26 적벽 | intro | 클라이맥스 |
| 27 화용도 | outro | 관우의 선택 (1부 엔딩) |

(+ 여유 1 — 05 사수관 관우 출진 등). 길중 최종 픽.

**수직 완성 우선(§16):** 01 도원결의 1개를 먼저 완성해 손맛 확인 → 나머지 롤아웃.

## 테스트

- **순수 헬퍼** (`actorStage.ts`) → node 유닛 테스트: `actorSpriteCandidates` 후보 URL 조립(포즈→초상 순),
  `visibleActorIds` enter/exit 누적(상주 기본·중간 등장·퇴장·재등장), `line.actor` 미등장 시 스포트라이트 대상 없음.
- **스키마** — zod 검증: 새 optional 필드 파싱, actors 있는 씬 유효 / 없는 씬 VN 경로. 기존 씬 스냅샷 불변.
- **시각 검증 = 길중 눈** — 프리뷰 MCP는 창 hidden→rAF 정지라 Pixi/애니 라이브 검증 불가
  (game-polish-backlog 기재). DOM 스테이지는 정적 스냅샷 일부 가능하나 애니/폴백은 실기기.

## 하위호환 / 리스크

- 새 필드 전부 optional → 기존 26 VN 씬·`ScenePlayer` 동작 무변경.
- 공유 추출은 `ScenePlayer` 리팩터(동작 보존) — 기존 씬 회귀 없어야 함(스냅샷/수동 확인).
- 라우트 분기 한 줄. 캠페인 루프(campaign.ts)·페이드 내비 불변.
- 마퀴 캐릭터 SD 포즈 미생성 시 폴백 사다리로 무붕괴(초상→실루엣).

## 파일 요약 (신규/변경)

- `packages/data/src/schemas.ts` — `StageActor`, `ScenarioScene.actors`, `ScenarioLine.{actor,enter,exit,emote}` (변경)
- `apps/web/src/scene/useSceneProgression.ts` (신규, 추출)
- `apps/web/src/scene/parts/{SceneBackground,DialoguePanel,NarrationPanel,SkipBar}.tsx` (신규, 추출)
- `apps/web/src/scene/ActorStage.tsx` (신규)
- `apps/web/src/scene/actorStage.ts` (신규, 순수 헬퍼 + 테스트)
- `apps/web/src/scene/ScenePlayer.tsx` (변경 — 공유 조각으로 재조립)
- `apps/web/src/scene/StagedScenePlayer.tsx` (신규)
- `apps/web/app/scene/page.tsx` (변경 — 플레이어 분기 한 줄)
- 마퀴 스테이지 JSON `scenario` (저작 — 01 도원결의 선행)

## 후속 (이 스펙 밖)

- 배경 커버리지(출시 게이트) — 마퀴 씬 painted 배경 생성.
- 전투 손맛 트랙 — 회심 틴트·저체력 상태(분석 문서 §2-B).
- 두루마리 선택지 UI — 가상 분기 도입 시.
