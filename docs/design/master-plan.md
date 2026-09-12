> **문서 상태**: 2026-09-11 반입, 같은 날 **v2**로 갱신(원본 `three_kingdoms_web_srpg_master_plan_v2.md` — 말미에 **Character Presentation System** 추가: Gameplay/Presentation 분리·2D 리그·장비 비주얼·스킨·Character Studio·P1~P4 우선순위). **제품 방향의 SSOT.** 게임 규칙의 SSOT는 `game-design.md`(구 기획 문서 v1.0 절 번호 보존). 둘이 충돌하면 이 문서가 우선하되, 금지 목록·법적 라인(game-design §1·§15)은 유지한다. 구 SSOT와의 충돌 조항과 결정은 맨 아래 **부록 A**.

# 삼국지 웹 SRPG 플랫폼 --- 마스터 기획 및 제품 방향

> **핵심 비전:** 이야기를 읽는 것이 아니라, 중요한 순간을 직접
> 플레이한다.\
> **콘텐츠 원칙:** 카툰만 보면 책 한 권, 게임까지 하면 그 이야기 속
> 전투를 직접 경험한다.

## 1. 프로젝트 정의

현재 개발 중인 프로젝트는 **삼국지를 기반으로 한 웹 SRPG**다. 이
삼국지는 프로토타입이 아니라 첫 완성 게임, 엔진 대표작, 저작도구 실전
검증 작품, 향후 UGC 플랫폼의 첫 킬러 콘텐츠다.

장기적으로 삼국지를 만드는 데 사용한 **엔진 + 저작도구 + 배포 시스템**을
일반 사용자에게 공개한다.

``` text
삼국지 웹 SRPG
→ 삼국지 완성 + 저작도구 고도화
→ 저작도구 공개
→ 유저 제작 SRPG
→ 웹 SRPG 콘텐츠 플랫폼
→ 광고 / 제작자 수익배분
→ 다양한 역사·고전·창작 콘텐츠
```

## 2. 초기 시장

초기 시장은 이미 존재한다.

-   영걸전/조조전 기존 매니아
-   한국 MOD 플레이어와 제작자
-   중국어권 영걸전/조조전 팬덤
-   구형 저작도구로 장편 MOD를 만들어 온 제작자

기존의 다운로드, 압축, 엔진 버전, OS 호환, 로케일, 패치 재배포 문제를
웹으로 제거한다.

> **링크 클릭 → 즉시 플레이**\
> **웹에서 제작 → 테스트 → Publish → URL 공유**

## 3. 새로운 세대

장기 목표는 기존 팬을 옮기는 것에 그치지 않는다.

> **오늘의 10살에게 첫 영걸전을 제공한다.**

-   아이들이 멋있다고 느끼는 고퀄 비주얼
-   이동/공격부터 단계적으로 학습
-   Story/Easy/Adventure: 힌트, 추천 이동, 턴 되돌리기
-   Classic/Hard: 턴 제한, 숨겨진 보물, 전원 생존 등
-   플레이어가 장차 제작자로 성장하는 순환

## 4. 핵심 콘텐츠 포맷

``` text
STORY → BATTLE → STORY / RESULT → NEXT CHAPTER
```

정치, 인간관계, 감정, 사랑, 배신은 STORY에서 다루고 플레이할 가치가 있는
충돌만 BATTLE로 만든다.

## 5. STORY --- 카툰만 봐도 책 한 권

STORY만 연속 감상해도 **삼국지 전체 흐름을 제대로 이해할 수 있는
수준**을 목표로 한다.

-   고퀄 카툰 / 모션코믹
-   부분 애니메이션
-   Pan / Zoom / Shake / Fade
-   음악 / 효과음
-   내레이션 / 캐릭터 음성

``` text
PLAY  : Story → Battle → Story → Battle
STORY : Story → Story → Story → Story
```

## 6. 명화풍 핵심 장면

평상시는 현대적인 고퀄 카툰으로 진행하고 결정적인 순간에는
**르네상스·바로크 회화처럼 강한 명화풍 대형 일러스트**를 삽입한다. 일반
카툰은 전달, 명화풍 컷은 기억의 각인을 담당한다.

## 7. 학습과 게임

교육용 게임처럼 보이기보다 먼저 재미있는 고퀄 SRPG여야 한다.

-   전투에서 인물 이름과 관계를 반복 노출
-   사건을 직접 플레이해 기억 강화
-   퀴즈를 진행 장벽으로 사용하지 않음
-   실제 역사 / 삼국지연의 / 게임 각색을 구분하는 선택형 정보 제공

## 8. 왜 SRPG인가

-   STORY → 전투 → 결과의 결합이 자연스럽다.
-   장수 이름, 위치, 병종, 능력, 세력 관계를 반복해서 생각하게 된다.
-   공성, 방어, 탈출, 호위, 추격, 일기토, 복병, 증원 등을 표현하기 좋다.
-   `맵 + 유닛 + 승리조건 + 이벤트`만으로 UGC 한 스테이지가 성립한다.

## 9. 삼국지의 역할

현재 삼국지는 플랫폼의 **첫 공식 대표작이자 첫 번째 Creator
프로젝트**다.

삼국지를 만들며 엔진, 밸런스, 전투 UI, Story, 저작도구, Playtest,
Publish를 동시에 검증한다.

> **삼국지를 만드는 데 사용하는 도구 = 나중에 일반 제작자가 사용하는
> 도구**

운영자 전용 하드코딩과 별도 내부 제작 파이프라인은 가능한 한 줄인다.

## 10. 플랫폼 핵심 기능

-   **PLAY** --- 설치 없는 웹 실행, 저장/이어하기, PC/모바일
-   **DISCOVER** --- Featured, 인기작, 신작, 완결작, 태그
-   **CREATE** --- 맵/캐릭터/이벤트/승패조건/Story Editor
-   **PUBLISH** --- 원클릭 공개, URL, 버전 업데이트
-   **CREATOR** --- 프로필, 작품, 플레이/수익 통계
-   **STORY** --- 카툰/모션코믹 연속 감상
-   **REMIX** --- 허용된 작품의 템플릿·맵·규칙 재사용

## 11. 저작도구와 실제 게임의 통합

최종 제품에서 저작도구와 게임은 별개의 프로그램처럼 느껴지면 안 된다.

``` text
                    GAME PROJECT
                       삼국지
                         │
          ┌──────────────┼──────────────┐
          │              │              │
     Characters       Chapters        Assets
                         │
                ┌────────┼────────┐
                │        │        │
              Story    Battle   Events
                └────────┴────────┘
                         │
                     SAME DATA
                         │
                ┌────────┴────────┐
                │                 │
              EDIT              PLAY
```

핵심은 **Edit와 Play가 동일한 Project Store를 사용하는 것**이다.

## 12. Project Store

``` text
Project
 ├─ metadata
 ├─ characters
 ├─ classes
 ├─ items
 ├─ skills
 ├─ maps
 ├─ chapters
 │    ├─ story
 │    ├─ battle
 │    ├─ events
 │    └─ rewards
 ├─ assets
 └─ localization
```

-   Runtime → Project Store 읽기
-   Editor → 같은 Store 수정
-   Playtest → 현재 Draft 실행
-   Publish → Draft 검증 후 Published Version 생성

## 13. Draft / Published

``` text
Published: 삼국지 v1.2 → 일반 플레이어
Draft:     삼국지 v1.3-dev → 제작자 편집/테스트
```

완성 후 `Publish v1.3`. 제작 중 변경이 서비스 버전을 망가뜨리지 않게
한다.

## 14. EDIT ↔ PLAY 왕복

에디터:

``` text
삼국지 / 제5장 사수관 전투
[스토리] [전투] [이벤트] [등장인물] [보상]
                              [▶ 이 장 테스트]
```

현재 편집 상태 그대로 게임 엔진을 실행하고, 종료 후
`[에디터로 돌아가기]`. 가능하면 선택 상태, 지도 위치, 줌, 편집 상태를
유지한다.

개발/제작 모드의 게임에서는 `[✏ 이 스테이지 편집]`으로 역방향 진입도
가능하게 한다.

목표:

> **수정 → 플레이 → 수정 → 플레이**를 몇 초 안에 반복한다.

## 15. Quick Edit / Full Editor

### Quick Edit

-   유닛 위치
-   레벨/병력
-   간단한 지형
-   기본 배치
-   간단한 승리조건

### Full Editor

-   캐릭터 전체 설정
-   병종/스킬
-   복잡한 이벤트
-   Story/카툰/BGM
-   에셋
-   캠페인 분기
-   다국어

## 16. 현재 저작도구 UI/UX 검토

현재 저작도구는 기능적 기반은 좋지만 **개발자용 내부 툴 성격이 강하다.**

### 좋은 점

-   맵 편집 / 유닛 배치
-   Inspector
-   목표/패배조건
-   증원/이벤트
-   JSON 기반 데이터
-   실제 게임 데이터 연결
-   헤드리스 엔진과 데이터 분리

### 최우선 개선

**데이터 Round-trip 안전성**\
에디터가 이해하지 못하는 필드를 저장 중 버리지 않는다.

> `Load → 수정 없음 → Save` 결과가 의미상 동일해야 한다.

**Save / Playtest / Publish 분리** - Save: 미완성이어도 가능 - Playtest:
실행 최소 조건 검사 - Publish: 전체 검증

**Autosave** `저장 중... → 저장됨 ✓`

**Undo / Redo** 지형, 유닛, 이벤트, 목표, 메타데이터, 삭제까지 일관되게
적용.

**챕터 중심 UX**

``` text
제5장 사수관 전투
① 전투 전 이야기
② 전투
③ 전투 후 이야기
```

## 17. Story Editor

프로그래밍 없이 모션코믹을 제작한다.

-   컷 / 이미지 / 캐릭터
-   대사 / 내레이션
-   음성 / BGM / 효과음
-   Zoom / Pan / Shake / Fade / Transition
-   타임라인 기반 편집

## 18. 현재 전투 UI/UX 검토

전투 UI는 저작도구보다 완성도가 높은 편이다.

### 좋은 점

-   맵 직접 클릭
-   이동/공격 흐름
-   공격 예측, 명중률, 반격 피해
-   턴 종료 확인
-   대화 Overlay
-   모바일 입력 고려
-   카메라 이동
-   엔진/UI 분리

### 개선 방향

**HUD 영역 통합**\
PC는 상단 턴/목표, 측면 유닛 정보, 중앙 전장, 유닛 근처 행동 메뉴.\
모바일은 상단 최소 정보, 하단 유닛 정보+공격 예측, 큰 터치 버튼. ✅ 2026-09-12 (`BottomPanel`, <768px)

**공격 확정** - 입문: `대상 선택 → 결과 예측 → 공격/취소` - 클래식:
`대상 클릭 → 즉시 공격`

**공격 예측 VS 카드**

``` text
관우 → 화웅
명중 86%
피해 421
반격 168
[공격]
```

**승리/패배조건**

``` text
목표: 화웅 격파
주의: 유비 퇴각 시 패배
3 / 20턴
```

**행동 메뉴**\
초보자에게는 공격/특기/도구/대기 중심. 고급 행동은 상황에 따라 노출.
모바일 터치 영역 확대.

**대화 UX** - 첫 입력: 현재 문장 완성 - 다음 입력: 다음 대사 - AUTO /
SKIP / LOG 후보 - 텍스트/자동진행 속도 설정

**전투 중단**\
웹 특성상 `저장하고 나가기 → 다음 접속에서 이어하기`를 중요하게 본다.

## 19. UGC와 수익모델

초기에는 제작·호스팅·플레이를 무료로 열어 콘텐츠 공급을 우선한다.

기본 수익원은 플레이 페이지 광고. 일정 규모 이후 제작자와 수익을
공유한다.

단순 조회수보다: - 일정 시간 이상 플레이 - 스테이지 완료 - 비정상 반복
제외

등을 반영한 **Qualified Play** 기반 보상을 검토한다.

장기 후보: - 제작자 후원 - 유료 캠페인/DLC - 스킨/에셋팩 - Creator
Marketplace

초기에는 복잡한 자체 화폐보다 단순한 실제 수익배분을 우선한다.

## 20. AI 시대의 콘텐츠 운영

AI로 시나리오 초안, 캐릭터 디자인, 초상화, 스프라이트, 배경, 카툰,
모션코믹, 번역 생산 속도가 빨라졌다.

공식 콘텐츠 하나를 만들 때마다 시대·장르별 에셋팩이 플랫폼 자산으로
축적되고 이후 UGC 제작자가 재사용할 수 있게 한다.

## 21. IP 및 UGC 운영 원칙

-   공식 콘텐츠는 권리관계가 명확한 소재와 자체 에셋 중심
-   타 게임/영화의 로고, 배우 외모, 고유 디자인, 대사 등 직접 복제 금지
-   UGC 저작권 신고 / 비공개 / 이의신청 / 반복 침해자 제재
-   개인 팬 MOD와 광고수익 공개 플랫폼의 권리 리스크가 다름을 전제로
    운영

## 22. 구현 우선순위

### P0 --- 데이터 안전성

-   ✅ Editor round-trip 무손실 (2026-09-11, `tools/editor/stage-io.js` + 게이트)
-   ✅ 기존 데이터 필드 보존

### P1 --- 제작 루프

-   Project Store (미결 ③ — 이연)
-   ✅ Autosave (2026-09-12, 로컬 복구본 + 저장 상태 칩)
-   ✅ Undo / Redo (2026-09-12, 전범위 스냅샷 히스토리)
-   Draft (미결 ③ — 이연)
-   ✅ 현재 챕터 Playtest (2026-09-12, ▶ 이 스테이지 테스트 → `/playtest?draft=`)
-   ✅ Editor 복귀 (2026-09-12, sandbox 종료 시 에디터 탭 복귀)

### P1 --- 전투 UX

-   ✅ HUD 충돌 정리 (2026-09-12, 좌/우 flex 컬럼 중재 — 모바일 하단 패널은 별도)
-   ✅ 입문 공격 확인 (2026-09-12, `confirmAttack` VS 카드, 입문/클래식 토글)
-   ✅ 핵심 패배조건 표시 (2026-09-12, 목표 칩 `주의:`)
-   ✅ 저장하고 나가기 (2026-09-12, actionLog 복원 + /stages 이어하기)
-   ✅ 모바일 터치 타깃 (2026-09-12, <768px 하단 패널 `BottomPanel` — 52px 행동 버튼·☰ 48px, CDP e2e `e2e:mobile`)

### P2 --- Creator UX

-   ✅ 챕터 중심 편집 (2026-09-12, Project Bar·Chapter rail·전투 전/전투/대사/전투 후/보상 탭)
-   ✅ Quick Edit (2026-09-12, 빠른 편집 탭 + 게임 ☰ ✏ 진입)
-   ✅ Story Editor **v1** (2026-09-12, VN 씬·전투 중 대사 편집 + 씬 미리보기 왕복; 타임라인/모션코믹 = v2, 포맷 결정 후)
-   ✅ Publish UX (2026-09-12, 체크리스트·변경사항·레포 쓰기+검사+롤백)

### P3 --- 플랫폼

-   Discover
-   Creator Page
-   UGC
-   수익배분
-   Remix

## 23. 핵심 지표

-   첫 전투 시작률 / 첫 장 클리어율
-   D1 / D7 재방문
-   STORY 시청 완료율
-   STORY → BATTLE 전환율
-   에디터 클릭 → 프로젝트 생성 → Playtest → Publish 전환
-   기존 MOD 제작자 전환 수
-   완결 UGC 작품 수
-   Qualified Play
-   난이도별 이탈 구간

## 24. 장기 비전

초기에는 기존 영걸전/조조전 팬덤을 웹으로 이전한다.

그 다음에는 **스토리로 보고 전투로 체험하는 SRPG 포맷** 자체를 확장한다.

플레이어가 제작자가 되고, 제작자의 작품이 다시 새로운 플레이어를
데려오는 순환을 만든다.

삼국지는 단순한 첫 게임이 아니다.

> **삼국지를 완성하는 과정 자체가 플랫폼을 완성하는 과정이어야 한다.**

------------------------------------------------------------------------

## 한 문장 요약

> **고퀄 스토리로 삼국지를 보고, 중요한 전투는 직접 플레이하며, 같은
> 도구로 누구나 자신의 SRPG를 만들어 웹에 공개하는 플랫폼.**

------------------------------------------------------------------------

# Character Presentation System

현대 게임처럼 장비·스킨에 따라 캐릭터 외형, 애니메이션, 스킬 연출, VFX,
컷인, 음성이 달라질 수 있도록 **Gameplay와 Presentation을 분리**한다.

``` text
Character
├─ GameplayProfile
├─ VisualProfile
├─ RigProfile
├─ EquipmentVisual
├─ AnimationSet
├─ SkillPresentation
├─ Skin
└─ VFXProfile
```

## 2D Rig / Skeleton

``` text
root
├─ torso
│  ├─ head
│  ├─ arm_L
│  └─ arm_R
├─ leg_L
├─ leg_R
├─ weapon_socket
├─ shield_socket
├─ cape_socket
├─ helmet_socket
└─ mount_socket
```

실제 리깅 런타임은 추후 결정해도 데이터 모델과 에셋 규격은 교체 가능하게
유지한다.

## Modular Equipment Visuals

Weapon, Armor, Helmet, Cape, Shield, Mount, Accessory가 능력치뿐 아니라
실제 외형을 선택적으로 변경한다. 장비는 socket에 연결하고 필요하면 전용
Animation Set을 지정한다.

## Weapon Animation Archetypes

`SWORD`, `SPEAR`, `POLEARM`, `BOW` 등 공용 Animation Set을 제공한다. 각
세트는 idle/move/attack/critical 등을 가진다. 유명 장수는
`GUAN_YU_POLEARM` 같은 Unique Set으로 override 가능하다.

## Animation State Machine

Idle, Move, Attack, Hit, Critical, Skill, Guard, Victory, Death,
Mount/Dismount 등을 기본 상태 후보로 둔다. Gameplay Engine은 의미
이벤트를 발생시키고 Presentation Layer가 animation/VFX/camera/sound를
재생한다.

## Skill Presentation

피해·범위·상태이상은 Gameplay 데이터에 두고
Animation/VFX/Camera/Cut-in/Voice는 Presentation 데이터에 둔다. 같은
스킬도 기본 스킨, 적토마 스킨, 전설 스킨에서 서로 다른 연출을 사용할 수
있다.

**Presentation Skin이 전투 계산을 강제로 변경하지 않는 것을 기본
원칙으로 한다.**

## Skin Types

-   Cosmetic Skin --- 외형만 변경
-   Equipment Visual --- 실제 장비 외형 변경
-   Legendary Presentation Skin --- 외형 + Animation + VFX + Skill
    Presentation + Cut-in + Voice 변경

## Character Studio

``` text
Character Studio
├─ Identity
├─ Gameplay
├─ Appearance
├─ Rig
├─ Equipment
├─ Animation
├─ Skills
├─ VFX
├─ Cut-ins
├─ Voice
└─ Skins
```

### Rig Editor

Bone hierarchy, pivot, parent/child, sprite attachment, socket, draw
order, facing preview. 기본 제작자는 Rig Template을 선택하고 Advanced
Creator만 직접 수정한다.

### Equipment Visual Editor

장비 슬롯/socket, Animation Archetype, Unique Override를 지정하고
Idle/Attack/Critical/Skill을 즉시 Preview한다.

### Animation Editor

Timeline에서 keyframe, bone transform, sprite swap, HIT event,
VFX/SFX/Camera marker를 편집한다.

### Skill Presentation Editor

``` text
0.00 Animation
0.15 Camera Zoom
0.30 VFX
0.52 HIT EVENT
0.52 Impact VFX
0.55 SFX
0.70 Camera Shake
1.20 Return Camera
```

실제 피해 계산은 Engine이 담당한다.

### Skin Editor

Portrait, body parts, equipment visuals, animation overrides, skill
presentation, VFX, cut-in, voice를 Skin Package로 묶는다.

## Asset Package / Marketplace

공유·판매 가능한 패키지 후보: - Character Parts / Portrait - Weapon /
Armor - Rig Template - Animation Pack - VFX Pack - Skill Presentation -
Cut-in - BGM/SFX - Complete Skin

패키지는 ID, dependency, license, metadata를 가진다.

## Runtime 원칙

-   Gameplay determinism 유지
-   Unique Animation → Weapon Archetype → Generic Animation fallback
-   전용 VFX/Voice/Cut-in이 없어도 게임 진행 가능
-   texture atlas, lazy loading, pooling, skin on-demand loading,
    low-quality mode 고려
-   **Character Studio Preview와 Battle Renderer는 가능한 한 같은 렌더러
    재사용**

## 구현 우선순위 추가

### P1 Architecture

Gameplay/Presentation 분리 인터페이스,
VisualProfile/RigProfile/AnimationSet 모델, Asset Package 규격,
fallback.

### P2 Foundation

기본 Rig Template, Equipment socket, Weapon Archetype Animation,
Character Studio Preview.

### P3 Advanced

Skill Presentation Editor, Skin Editor, VFX/Camera/Cut-in timeline,
Mount.

### P4 Economy

Skin/Animation/VFX Package 공유 및 Marketplace.

------------------------------------------------------------------------

## 부록 A. 구 SSOT(기획 문서 v1.0)와의 충돌·결정 정리 (2026-09-11)

| # | 구 문서 | 이 문서 | 결정 |
|---|---|---|---|
| 1 | §1 시리즈 로드맵(1탄 유비전 → 2탄 진시황, 엔진 재사용 30%) | §1 플랫폼 로드맵(삼국지 → 도구 공개 → UGC) | **플랫폼 로드맵으로 대체.** 진시황·TROIA·DAVID는 "공식 콘텐츠 후보"로 별도 결정(초안 `SRPG_스토리_플랫폼_기획정리.docx` 참조). |
| 2 | §2-4 "전투 사이의 모든 것은 다음 전투 준비 / 내정 금지" | §4~5 STORY 3~5분이 막간의 본체 | **충돌 아님.** 내정·자원생산 금지 유지, 막간 = STORY(카툰) + 출진 준비. 문구만 갱신(루트 원칙 4). |
| 3 | §5 막간 씬 v1 VN → v2 → v3(폐기) → v4 어드벤처 맵 씬(01 구현) | §5·17 STORY = 고퀄 카툰/모션코믹 + Story Editor | **출시는 현행**(VN 27편 + v4 맵씬 01). 모션코믹 전환은 Story Editor(P2~P3)와 함께 — 다섯 번째 갈아엎기를 막기 위해 도구 없이 포맷만 또 바꾸지 않는다. 2026-09-10 웹툰(v5) 브레인스토밍 결정(페이지 단위 · 칸 이미지와 대사 데이터 분리 · 지면 통짜 생성 후 슬라이스)은 모션코믹의 **소재 원칙**으로 흡수(칸/대사 분리 = 다국어·음성·YouTube 재활용의 전제). |
| 4 | §4 저작도구 = 운영자 내부 도구(보드·serve.py·정적 에디터·Gemini 파이프라인) | §9·§16 "삼국지 도구 = 유저 도구", 하드코딩·내부 파이프라인 최소화 | 현 도구는 **유지**하되 신규 내부 전용 하드코딩 금지. P0 round-trip 무손실 → P1 Project Store로 이행. Gemini 생성 파이프라인은 운영자 도구로 남고 산출물은 에셋팩(§20)으로 공개. |
| 5 | §13 광고 F2P + 챕터 판매/코스메틱, 애드센스 탈락 → 포털 SDK | §19 광고 + Qualified Play 제작자 수익배분 | **층위 분리.** 삼국지 v1 BM은 구 §13 그대로(bm.md), 플랫폼 단계에서 수익배분 추가. 불가침선(현금 확률 상품·스태미나 금지)은 플랫폼에도 적용. |
| 6 | §11 기본 난이도 + S랭크/챌린지 레이어 | §3 Story/Easy/Adventure(힌트·추천 이동·되돌리기) vs Classic/Hard | **통합.** 모드명은 이 문서, 힌트 3단계·턴 되돌리기는 P2. 밸런스 게이트(HEALTHY)는 Classic 기준 유지. |
| 7 | 전투 HUD 청동 크롬(`frames.ts` 토큰, 2026-06-30) | design-guide §6·§11 "장식 프레임 최소·역사적 재질 얇게·현대적 가독" | **design-guide가 상위.** 적용은 P1 "HUD 충돌 정리"에서 토큰 재정의로(별도 스펙). 그 전까지 현행 유지 — 출시 트랙을 막지 않는다. |
| 8 | §14 커뮤니티 레이어(리더보드·리플레이, v1.5) | §10 DISCOVER·CREATOR·REMIX | **유지, P3.** 리플레이 = 시드 재현(구 §2-1)이 그대로 기반. |
| 9 | §15 출시 게이트(에셋 커버리지 + 포털 제출) | §22 P0 데이터 안전성 | **병행.** 출시 트랙(에셋 게이트 닫힘 → 배포 → 포털)과 P0(에디터 round-trip)는 독립 — 출시가 P0를 기다리지 않는다. |
| 10 | §4 프레임 애니메이션 정책(2026-06-16): v1 = **베이크 완성 포즈 프레임**, 컷아웃 리그(`skeleton.ts`·`rig-editor.html`·`rig_render.py`)는 v1.5+ 드롭인 · §13 무기 스킨 BM | Character Presentation System: Gameplay/Presentation 분리, 2D 리그(root/torso/head/arm/leg + weapon/shield/cape/helmet/mount socket), 장비 비주얼·Weapon Archetype Animation·Skin·Character Studio | **출시는 베이크 프레임 유지(무회귀).** Presentation 모델은 **P1 Architecture = 데이터 계약부터**(VisualProfile/RigProfile/AnimationSet, fallback 사다리 Unique → Archetype → Generic) — 현행 `UnitView.renderMode('skeleton')` 드롭인·`skeleton.json`(본+슬롯+무기 어태치먼트)이 착지점이고, 문서대로 리깅 런타임은 추후 결정. 기존 리그 도구는 Character Studio(P2 Foundation)의 씨앗. **Presentation Skin은 전투 계산을 바꾸지 않는다** = 구 §13 코스메틱·불가침선과 동일 원칙. |
| 11 | §11·§12 "Edit와 Play가 동일한 Project Store를 사용" | 벤치마크 §10 | **같은 콘텐츠 계약 + 불변 Playtest 스냅샷 + 독립 런타임 상태**로 읽는다. 편집기와 실행 중 게임이 같은 가변 객체를 만지지 않는다. 첫 실물 = Playtest 스냅샷(`draftId·revision·stage·map·seed·returnUrl`, 서버 드래프트 파일) — 공통 데이터 접근 계층은 두 번째 소비자가 생길 때 일반화(YAGNI). |
| 12 | Character Presentation "Studio Preview와 Battle Renderer는 가능한 한 같은 렌더러 재사용" | 벤치마크 §12.4 | 현황 정정: `rig-editor.html`은 Canvas2D, 전투는 Pixi `SkeletonView` — **같은 렌더러가 아니다.** 같은 렌더러는 *목표*(P2 Foundation). 그 전엔 포즈 계산·외형 조합·이벤트 시간 해석을 공유하고 동일 입력 캡처 비교로 차이를 잡는다. |
| 13 | Character Presentation "armor socket" 하나 | 벤치마크 §7·§12.2 | 갑옷·망토는 **여러 본에 걸친 부착물 묶음**일 수 있다(Sulis 이미지 레이어). 게임 규칙의 `armor` 슬롯 하나 ≠ 표현의 부위 하나. 장비 호환성 메타(rigId/schemaVersion·slot·weaponArchetype·gripOffset/facing·animationSet·fallback)는 설계 예시이지 현 스키마가 아님. 말은 탑승자+말 합성 리그. |

**미결(길중 결정 필요)**: ① 공식 콘텐츠 2탄(진시황 / TROIA / DAVID) ② ~~Story Editor 착수 시점~~ → **v1(현행 VN·대사 편집)은 P2에서 착수·완료(2026-09-12)**; 남은 결정 = 모션코믹 **포맷**(타임라인 데이터 계약) — 그것이 정해지면 Story Editor v2 ③ 저작도구 공개 형태(Project Store가 로컬 JSON인지 Supabase인지) ④ 리깅 런타임(자체 컷아웃 확장 vs Spine 도입 — Presentation 데이터 계약은 어느 쪽이든 교체 가능하게) ⑤ GPL 부품(RPGAtlas 등) 코드 차용 여부 — 원하는 엔진 공개 정책과 라이선스 공개 범위를 먼저 결정(벤치마크 §13).
