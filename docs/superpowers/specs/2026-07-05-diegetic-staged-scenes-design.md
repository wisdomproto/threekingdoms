# 디에게틱 막간 스테이지 씬 — 설계 (2026-07-05, **v2 2026-07-09**)

> **v2 개정(2026-07-09)**: 구현 착수 전 재검토에서 v1의 핵심 전제("기존 전투 front 포즈 + 기존 씬 배경을
> 그대로 세운다")가 에셋 실측으로 깨짐을 확인. **씬 전용 에셋 2종을 신설**(스코프 안으로 편입)하고
> 데이터 모델·폴백을 그에 맞춰 조정했다. 코드 구조(DOM 스테이지·공유 추출·라우트 분기)는 v1 유지.

## 배경 / 문제

경쟁작 「삼국지 촉한 유비전」(蜀汉刘备传, docs/reference/competitor-shu-han-yubijeon-analysis.md) 대비
우리 막간 씬의 품질 갭. 길중 평가: "전투 사이 시나리오가 엄청 고퀄, 우리꺼랑 차이가 많이 난다."

원인 분해 (길중이 4개 갭 전부 선택: 연출 포맷·배경 충전율·서사 밀도·부가 UI):
- **핵심 = 연출 포맷.** 우리 §5 막간은 VN 분리형(`ScenePlayer`: 배경 1장 + 화자 초상 1명 + 대사창,
  스프라이트 없음). 경쟁작은 **painted 바닥 위에 SD 유닛을 실제로 세워** 진행(디에게틱) → 인물이
  "장면 안에" 있는 느낌. 우리는 인물이 "화면 밖"에서 말하는 느낌.
- 배경 충전율·서사 밀도는 별도 트랙(에셋 생성·집필). **포맷을 바꾸면 그 둘의 그릇이 커진다.**

### v2 추가 — 에셋 실측이 v1 전제를 깬 지점 (2026-07-09 재검토)

1. **전투 front 포즈 = "탈것 탄 전투 유닛"이라 씬에 못 세운다.** 유비 `front_idle.png` 실측 =
   쌍검 들고 **전차(말 2필) 탑승**(§7 병종↔탈것 매핑: 군주=전차, 기병=말의 산물). 도원결의는
   맨몸의 세 청년이 의형제 맺는 장면 — 완전무장 전차·군마 유닛 셋을 복숭아밭에 세우면 "장면"이
   아니라 "전투 배치도"로 읽힌다. 경쟁작 도원결의의 SD가 통한 건 **맨몸 도보 캐릭터**라서다.
2. **기존 씬 배경 = 원경 establishing이라 인물이 설 지면이 없다.** `01-zhuojun-intro.webp` 실측 =
   해질녘 산·마을 원경 조망(전경 소나무·원경 촌락). VN(빈 공간+초상)용으로 설계된 구도라 배우를
   어디 세워도 허공에 뜬다. 경쟁작 배경은 **인물이 설 근경 무대**(복숭아밭 지면)였다.

→ 결론: v1의 "코드만, 에셋은 스코프 밖" 전제 폐기. **씬 전용 에셋 제작이 이 작업의 본체**다.
(마퀴 후보 11개 중 9개는 씬 배경 자체는 보유 — 구멍은 05·06뿐. 문제는 커버리지가 아니라 **구도**.)

## 범위

- **적용 = 마퀴 순간(★)만** (§4 투자 등급 철학·비용 통제). 전 27스테이지 아님. 나머지는 VN 유지.
- 후보 ~11개 (아래 §저작). 길중 최종 픽/조정.
- **v2 스코프 편입**: 씬 SD 도보 포즈(유니크 ~8명) + 마퀴별 근경 무대 배경(~11장) 생성.
  §4 기존 파이프라인 변형 재사용이라 새 도구는 최소.
- **비범위 (YAGNI)**:
  - 두루마리 선택지 UI — 선택 분기(가상 모드)는 §5에서 v1 제외. 분기 도입 시 별도.
  - Pixi 전투 렌더러 재사용(접근 A) — 정적 컷신엔 카메라·VFX·엔진 상태가 오버킬.
  - 줄 단위 카메라 무빙·복잡 안무. 씬 배우 멀티포즈/애니 클립(1장 + CSS 연출로 충분).
  - 전투 손맛 트랙(회심 틴트·저체력 상태·멀티프레임 공격) — 별도 후속(분석 문서 §2-B).

## 접근 결정

3안 비교 후 **접근 B = DOM/CSS 스프라이트 스테이지** 채택. (v2에서도 유지 — 바뀐 건 세우는
*에셋*이지 세우는 *방식*이 아니다.)

| 접근 | 요지 | 판정 |
|---|---|---|
| A. Pixi 전투 렌더러 재사용 | 컷신 스테이지를 BattleRenderer로 | 파리티 100%지만 정적 컷신엔 과투자·엔진 강결합 |
| **B. DOM/CSS 스프라이트 스테이지** | ScenePlayer 형제, 씬 포즈 PNG를 배경 위 배치 | **채택** — 비용 20%로 손맛 90%, Pixi 결합 없음 |
| C. 초상 구도 VN++ | 초상 유지·구도만 강화 | 디에게틱 느낌 못 냄(탈락) |

v2 재검토에서 C(VN++ 선회)·"현 에셋으로 프로토타입 먼저"도 재고했으나, 길중 결정 =
**씬 전용 에셋 신규 제작으로 정통 디에게틱**(경쟁작 수준이 목표라 어중간한 절충 배제).

## 씬 전용 에셋 (v2 신설 — 이 작업의 본체)

### E-1. 씬 SD 도보 포즈 (scene actor)

- **형태**: 탈것·전투장비 없는 **맨몸/평상 차림 standing idle 전신 SD** 1장, 투명 배경,
  facing=screen-left(§4 규약 동일 — 코드 미러 기준). 경쟁작 도원결의와 동형.
- **물량**: 마퀴 11개 등장인물 유니크 = **유비·관우·장비·조운·제갈량·여포·조조(+주유 게스트) ≈ 7~8명.**
  전원 §4 ★ 풀제작 등급이라 투자 철학 정합.
- **저장**: `/assets/scene-actors/{key}.png` (key = 전투 스프라이트 폴더명과 동일 영문:
  `liubei`·`guanyu`·`zhangfei`·`zhaoyun`·`zhugeliang`·`lvbu`·`caocao`…) + R2.
- **생성**: §4 SD 포즈시트 파이프라인 변형 — **MOUNT_BY_NAME 주입 제거**, 프롬프트를
  "civil/standing, no mount, no combat stance"로. 초상 시트처럼 **여러 명 한 시트→슬라이스**
  (스타일 일관 + 호출 절감). 에셋보드에 「씬 배우」 카드 신설(붙여넣기→자동 컷→로컬+R2,
  기존 시트 컷 인프라 재사용). ⚠ GEMINI_API_KEY 디스크 부재 — 기본 경로는 보드 붙여넣기(길중 생성).

### E-2. 근경 무대 배경 (staged bg)

- **형태**: 인물이 설 **지면이 하단 1/3에 확보된 근경 구도** painted 배경. 기존 원경
  establishing과 역할 분리(아래 데이터 흐름).
- **물량**: 마퀴 씬당 1장 ≈ **11장** (01 복숭아밭, 06 호로관 관문 앞, 18 초려 마당 …).
- **저장**: `/assets/scenes/{stageId}-staged.webp` (기존 씬 배경 경로 규약에 `-staged` 접미) + R2.
- **생성**: 에셋보드 ③ 시나리오 씬 탭에 staged 변형 프롬프트 추가(근경·지면 확보·인물 없음 —
  §2-7 베이킹 금지 유지). 기존 붙여넣기→저장 경로 그대로.

### 배경 2장 구성 — 원경→근경 전환 (길중 결정)

기존 원경 establishing을 버리지 않는다. **오프닝 줄 = `scene.bg`(기존 원경)로 정세·장소를 잡고,
인물이 등장하는 줄에서 `line.bg = "{stageId}-staged"`로 페이드 전환.** `line.bg` 줄 단위 배경
전환은 씬 v2(2026-07-03)에서 이미 구현 — **스키마·코드 무변경, 순수 데이터 저작.**
경쟁작(근경 1장 고정)엔 없는 "풍경→무대 진입" 시퀀스를 덤으로 얻는다.

## 데이터 모델 (계약)

새 필드 **전부 optional** → 기존 26개 VN 씬 무변경(하위호환). `scene.actors` 존재 = 스테이지 씬.
스키마 = `packages/data/src/schemas.ts` (`ScenarioSceneSchema`·`ScenarioLineSchema` 확장).

```ts
// ScenarioScene에 추가
actors?: StageActor[];          // 있으면 디에게틱 스테이지, 없으면 기존 VN

StageActor = {
  id: string;                   // 씬 내 안정 참조 ("liubei", "guanyu")
  sprite: string;               // /assets/scene-actors/{sprite}.png 의 {sprite} (영문 키)
  portrait?: string;            // 폴백② 초상 키(한국어 commanderId, 예 "유비"). 미지정=폴백② 생략
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

**결정 (v2 조정 포함):**
1. **플레이어 선택 = `scene.actors?.length` 여부.** 별도 플래그·라우트 타입 없음. 기존 `intro`/`outro`
   슬롯 그대로 쓰고 배우만 얹음.
2. **화자↔배우 연결 = `line.actor` id 매칭** (이름 문자열 커플링 회피). 기존 `line.speaker`/
   `portraitId`는 하단 대사창 표시용으로 유지 — 스테이지 씬도 대사창은 VN과 동일.
3. **enter/exit 최소 스펙.** 배우는 씬 시작부터 상주가 기본. 필요한 비트만 등장/퇴장 표시.
4. **`StageActor.sprite` = 씬 배우 키(v2 변경).** v1은 전투 스프라이트 폴더(`sprites/{id}/front_idle`)를
   직접 가리켰으나 그 에셋이 탈것 탄 전투 유닛이라 폐기. 이제 `/assets/scene-actors/` 전용 키.
   전투 리졸버(`spriteCandidates`/`COMMANDER_SPRITE_MAP`)와 무관 — 마퀴 손저작.
5. **`portrait` 필드 신설(v2 — v1 폴백 버그 수정).** v1 폴백②는 `portraits/{sprite}.webp`였는데
   sprite는 영문(`liubei`)이고 실제 초상 파일은 한국어 키(`유비.webp`)뿐이라 **항상 실루엣으로
   추락**하는 죽은 폴백이었다. 한국어 초상 키를 명시 저작.

**엣지 케이스 (계약 확정):**
- `line.actor`가 `scene.actors[]`에 없거나 현재 미등장(enter 전/exit 후)이면 **스포트라이트 no-op**
  — 크래시·에러 없음. 대사창은 `line.speaker`/`portraitId`로 정상 표시(무대와 독립).
- 여러 배우가 같은 기본 `y`를 공유하면 z-정렬 **타이브레이크 = `actors[]` 배열 순서**(뒤일수록 앞).
- `scale`은 스프라이트 크기만 조절, 발밑 앵커·그림자 위치는 불변(발이 바닥선 `y`에 고정).
- `emote` 말풍선 겹침·화면 가장자리 클램프는 **저작 책임**(마퀴 손저작이라 배치로 회피).
- 근경 무대 배경(`-staged`) 미생성 상태에서도 무붕괴: `line.bg` 키의 파일이 없으면 `AssetImage`
  placeholder 표준 동작(기존 씬 배경과 동일 — 점진적 콘텐츠 §5).

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
- ⚠ `AssetImage`를 쓰지 **않는다** — AssetImage는 단일 `failed`→placeholder라 *URL 체인 불가*.
  대신 자체 `<img>` + onError로 후보 URL을 순차 소진:
  ① `/assets/scene-actors/{sprite}.png` (씬 도보 포즈)
  → ② `/assets/ui/portraits/{portrait}.webp` (`portrait` 저작 시에만 — 한국어 키)
  → ③ **CSS 실루엣**(어두운 라운드 실루엣 박스 + 이니셜, ActorStage가 직접 렌더).
- 미생성 마퀴 캐릭터도 무언가는 무대에 섬 — 드롭인 원칙 유지, 무붕괴.

**순수 헬퍼** (`apps/web/src/scene/actorStage.ts` — 테스트 대상):
- `actorSpriteCandidates(actor): string[]` → `[씬 포즈 URL, (portrait 있으면) 초상 URL]`(assetUrl 경유).
  ③ 실루엣은 URL 아닌 렌더 폴백이라 이 배열엔 없음.
- `visibleActorIds(lines, idx, actors): Set<string>` → idx까지 `enter`/`exit` 누적한 등장 배우 집합.
  (배우 기본 상주 + enter 추가 + exit 제거.)

**라우트 배선** (`apps/web/app/scene/page.tsx`): 한 줄 분기
`const Player = scene.actors?.length ? StagedScenePlayer : ScenePlayer;`
props(`scene`/`title`/`onComplete`) 동일 — 캠페인 루프·페이드 내비 불변.

## 데이터 흐름

```
stage.scenario.intro (ScenarioScene, actors 포함)
  → /scene?stage=ID&type=intro (page.tsx)
  → scene.actors 있음 → StagedScenePlayer
     ├ useSceneProgression(scene) → { idx, line, shown, done, advance, currentBg, isNarration }
     ├ SceneBackground(currentBg)   ← 오프닝 줄 = 원경(scene.bg) → line.bg로 근경(-staged) 페이드
     ├ ActorStage(actors, visibleActorIds(lines, idx, actors), speakingId=line.actor, emote=line.emote)
     └ DialoguePanel | NarrationPanel (line, shown, done)
  → 마지막 줄 advance → onComplete → fadeTo(다음 단계)
```

저작 문법 표준: **원경 establishing 동안은 배우 미등장(내레이션), 근경 전환 줄에 첫 enter** —
"풍경→무대 진입" 시퀀스. (배우 기본 상주 규칙은 유지 — 이 문법을 쓰려면 첫 배우들에 enter 저작.)
전투 밖 컷신 → 엔진/결정론 무관(§2-1). 순수 표현.

## 저작 (마퀴 후보 ~11 + 에셋 물량)

기존 intro/outro 슬롯에 `actors` + `line.actor` 추가.

| 스테이지 | 슬롯 | 장면 | 등장(씬 포즈 필요) | 근경 배경 | 기존 원경 |
|---|---|---|---|---|---|
| 01 탁군 | intro | 도원결의 (간판 오프닝) | 유비·관우·장비 | 복숭아밭 | ✅ 보유 |
| 05 사수관 | intro | 관우 출진(여유 후보) | 관우 | 관문 진영 | ❌ 없음 |
| 06 호로관 | intro | 삼형제 vs 여포 대치 | 삼형제+여포 | 관문 앞 | ❌ 없음 |
| 14 하비2 | outro | 여포 최후 | 여포·유비 | 하비 성루 | ✅ 보유 |
| 17 여남 | intro | 관우 재회 (감정 비트) | 유비·관우 | 여남 들길 | ✅ 보유 |
| 18 박망파 | intro | 삼고초려/제갈량 데뷔 | 유비·제갈량 | 초려 마당 | ✅ 보유 |
| 20 장판파 | intro | 조운 단기필마 | 조운 | 난전 들판 | ✅ 보유 |
| 21 장판교 | intro | 장비 단신 | 장비 | 다리 앞 | ✅ 보유 |
| 22 한진 | outro | 관우 합류 | 유비·관우 | 나루터 | ✅ 보유 |
| 26 적벽 | intro | 클라이맥스 | 유비·제갈량(·주유) | 강안 진영 | ✅ 보유 |
| 27 화용도 | outro | 관우의 선택 (1부 엔딩) | 관우·조조 | 산길 | ✅ 보유 |

- **씬 포즈 유니크 = 7~8명** (유비·관우·장비·조운·제갈량·여포·조조·주유?). 길중 최종 픽.
- **근경 배경 = 씬당 1장 ≈ 11장.** 05·06은 원경 establishing도 없음(출시 게이트 트랙과 겸사 생성).

**수직 완성 우선(§16, v2 강화):** 01 도원결의 1개를 **에셋 실생성 포함**으로 완성 —
삼형제 씬 포즈 3장 + 복숭아밭 근경 1장 + 데이터 저작 + 코드. **경쟁작 도원결의와 나란히 놓고
길중이 판정하는 게이트.** 통과해야 나머지 10개 롤아웃(이후는 에셋+데이터 반복, 코드 무변경).

## 테스트

- **순수 헬퍼** (`actorStage.ts`) → node 유닛 테스트: `actorSpriteCandidates` 후보 URL 조립
  (씬 포즈→초상 순, `portrait` 미저작 시 1개), `visibleActorIds` enter/exit 누적(상주 기본·중간
  등장·퇴장·재등장), `line.actor` 미등장 시 스포트라이트 대상 없음.
- **스키마** — zod 검증: 새 optional 필드 파싱(portrait 포함), actors 있는 씬 유효 / 없는 씬 VN 경로.
  기존 씬 스냅샷 불변.
- **시각 검증 = 길중 눈** — 프리뷰 MCP는 창 hidden→rAF 정지라 라이브 검증 불가
  (game-polish-backlog 기재). DOM 스테이지는 정적 스냅샷 일부 가능하나 애니/폴백은 실기기.

## 하위호환 / 리스크

- 새 필드 전부 optional → 기존 26 VN 씬·`ScenePlayer` 동작 무변경.
- 공유 추출은 `ScenePlayer` 리팩터(동작 보존) — 기존 씬 회귀 없어야 함(스냅샷/수동 확인).
- 라우트 분기 한 줄. 캠페인 루프(campaign.ts)·페이드 내비 불변.
- 씬 포즈/근경 배경 미생성 시 폴백 사다리(초상→실루엣)·placeholder로 무붕괴.
- **v2 신규 리스크**: ① 씬 포즈 생성 품질(전투 SD와 화풍 일관성 — 같은 모델·같은 스타일 지시로
  완화, 01 수직 완성이 검증 게이트) ② 근경 배경이 또 원경으로 나올 위험 — 프롬프트에 지면·시점
  명시(1장 생성이라 재생성 저비용).

## 파일 요약 (신규/변경)

- `packages/data/src/schemas.ts` — `StageActor`(portrait 포함), `ScenarioScene.actors`,
  `ScenarioLine.{actor,enter,exit,emote}` (변경)
- `apps/web/src/scene/useSceneProgression.ts` (신규, 추출)
- `apps/web/src/scene/parts/{SceneBackground,DialoguePanel,NarrationPanel,SkipBar}.tsx` (신규, 추출)
- `apps/web/src/scene/ActorStage.tsx` (신규)
- `apps/web/src/scene/actorStage.ts` (신규, 순수 헬퍼 + 테스트)
- `apps/web/src/scene/ScenePlayer.tsx` (변경 — 공유 조각으로 재조립)
- `apps/web/src/scene/StagedScenePlayer.tsx` (신규)
- `apps/web/app/scene/page.tsx` (변경 — 플레이어 분기 한 줄)
- `docs/art/asset-board.html` — 「씬 배우」 카드 + 씬 탭 staged 변형 프롬프트 (변경)
- `/assets/scene-actors/{key}.png` ×3(수직 완성)~8, `/assets/scenes/01-zhuojun-staged.webp` (에셋)
- 마퀴 스테이지 JSON `scenario` (저작 — 01 도원결의 선행)

## 후속 (이 스펙 밖)

- 마퀴 나머지 10개 롤아웃(에셋 생성 + 데이터 저작 — 코드 무변경).
- 05·06 원경 establishing 생성(출시 게이트 씬 배경 트랙과 합류).
- 전투 손맛 트랙 — 회심 틴트·저체력 상태(분석 문서 §2-B).
- 두루마리 선택지 UI — 가상 분기 도입 시.
