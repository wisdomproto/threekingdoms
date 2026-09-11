> **문서 상태**: 2026-09-11 반입, 같은 날 **v2**로 갱신(원본 `three_kingdoms_web_srpg_design_guide_v2.md` — 말미에 **Character Studio / Skin / Rig 디자인 가이드** 추가). **UX·디자인 규칙의 SSOT** — 아직 코드에 적용되지 않은 규칙이 많다. 현행과의 주요 차이: ① 전투 HUD는 청동 크롬 토큰(`apps/web/src/battle/hud/frames.ts`) — §6·§11은 P1 "HUD 충돌 정리"에서 적용 ② 에디터는 정적 HTML이 JSON을 직접 노출 — §4·5(Project Bar·Inspector 언어·Event builder)는 P1~P2 ③ 대화 UX는 타자기 + 건너뛰기만 — LOG/AUTO/속도는 P2 ④ 입문/Classic 공격 확정 분리 미구현(P2) ⑤ Character Studio는 미구현 — 현행은 `tools/rig-editor.html`(본·슬롯·클립 편집, Preview) + `/motion-editor`(씬 배우 클립)로, Studio 레이아웃·Progressive Complexity(Basic/Advanced)는 P2 Foundation부터. 새 UI를 짤 때는 이 문서의 토큰·터치 타깃·QA 체크리스트를 먼저 적용한다.

# 삼국지 웹 SRPG 플랫폼 --- DESIGN GUIDE

> **목적:** 삼국지 게임, 전투 HUD, 저작도구, Story, 모바일 UI가 하나의
> 제품처럼 느껴지도록 하는 공통 디자인·UX 규칙.
>
> **핵심 철학:** **역사적 분위기는 콘텐츠에서, 사용성은 현대 웹앱에서
> 가져온다.**

## 1. Design Principles

1.  **Game first** --- 교육용 소프트웨어처럼 보이지 않는다.
2.  **Modern usability, historical atmosphere** --- 삼국지 분위기는
    일러스트·재질·음악·카툰에서 만들고, 버튼과 폼은 현대적으로 설계한다.
3.  **Same world, different density** --- 전투는 몰입감 있게, Creator는
    생산성 있게 만들되 공통 토큰을 공유한다.
4.  **Content over chrome** --- UI 장식보다 지도·캐릭터·카툰·전투가
    우선이다.
5.  **Never punish misunderstanding** --- 잘못된 터치는 쉽게 취소할 수
    있어야 한다.
6.  **Creator should not need JSON** --- JSON/스크립트는 Advanced에서만
    노출한다.
7.  **Three clicks to Playtest** --- 현재 챕터를 최대 3번의 명확한 행동
    안에 테스트한다.
8.  **Save is always allowed** --- 미완성 콘텐츠도 저장 가능하다.
9.  **Everything destructive is recoverable** --- Undo/Redo 또는 Version
    History로 복구한다.
10. **Editor never destroys unknown data** --- 지원하지 않는 필드도
    round-trip에서 보존한다.

## 2. Design Tokens

### Spacing

  Token        Value 용도
  ---------- ------- -------------------
  space-1        4px 미세 간격
  space-2        8px 버튼 내부
  space-3       12px 폼 요소
  space-4       16px 기본 패널 padding
  space-6       24px 섹션 간격
  space-8       32px 큰 섹션
  space-12      48px 페이지 레벨

### Radius

-   radius-sm: 6px
-   radius-md: 10px
-   radius-lg: 16px

### Touch targets

-   절대 최소 44×44px
-   권장 48×48px
-   주요 모바일 행동 52px 이상

### Typography

  용도               Desktop     Mobile
  --------------- ---------- ----------
  Body              14--16px   15--16px
  Secondary         13--14px       14px
  Button            14--16px   15--16px
  Section title     18--22px   18--20px
  Chapter title     24--32px   22--28px

Editor 일반 텍스트는 13px 미만을 피한다. 장식 서체는 챕터 타이틀·명화 컷
등 제한된 곳에만 사용한다.

### Semantic colors

``` text
surface / surfaceRaised / panel / border
textPrimary / textSecondary / textMuted
ally / enemy / neutral
success / warning / danger / info
selected / reachable / attackable / targeted / disabled
hpHigh / hpMedium / hpLow
```

실제 색상값은 테마 파일에서 관리하고 색만으로 상태를 전달하지 않는다.

## 3. Responsive Rules

-   Large: ≥1440px
-   Standard: 1024--1439px
-   Tablet: 768--1023px
-   Mobile: \<768px

모바일 safe area를 고려한다. HUD 패널들이 각자 고정 좌표를 점유해 겹치는
구조는 최소화한다.

## 4. Creator / Editor UX

제작자는 JSON 파일이 아니라 **게임 프로젝트와 챕터**를 편집한다.

``` text
삼국지
 ├─ 제1장
 ├─ 제2장
 └─ 제5장 사수관
       ├ Story Before
       ├ Battle
       ├ Events
       ├ Story After
       └ Rewards
```

### Desktop Layout

``` text
┌──────────────────────────────────────────────────────────┐
│ 삼국지 > 제5장 사수관       저장됨 ✓        ▶ 이 장 테스트 │
├────────────┬────────────────────────────┬────────────────┤
│ Chapters   │                            │ Inspector      │
│            │        WORKSPACE           │                │
│            │                            │                │
├────────────┴────────────────────────────┴────────────────┤
│ Story | Battle | Events | Characters | Rewards | Assets │
└──────────────────────────────────────────────────────────┘
```

권장: - Chapter rail 200--260px, 접기 가능 - Inspector 300--420px,
resize 가능 - Workspace는 남은 공간 전부 - Project Bar는 항상 유지

### Persistent Project Bar

항상 프로젝트명, 현재 챕터, Draft 상태, 저장 상태, Undo/Redo, Playtest,
Publish 진입점을 보여준다.

``` text
삼국지 / 제5장 사수관    Draft    저장됨 ✓    ↶ ↷    ▶ 테스트
```

### Save states

``` text
저장 중…
저장됨 ✓
오프라인 — 로컬에 보관됨
저장 실패 — 다시 시도
```

미완성 상태는 오류가 아니다.

### Validation

-   **Save:** 작업 보존 우선
-   **Playtest:** 실행 최소 조건 검사
-   **Publish:** 참조 무결성, 필수 승패조건, 누락 에셋, 치명적 이벤트
    오류 등 전체 검사

### Inspector language

나쁨:

``` text
commanderId: guan_yu
triggerType: UNIT_DEATH
```

좋음:

``` text
[관우 초상] 관우

관우가 쓰러졌을 때
→ 조조군 증원 등장
```

내부 ID는 Advanced에서만 노출한다.

### Undo / Redo

지형, 유닛, 삭제, 이벤트, 승패조건, 메타데이터, Story 편집 전체에
적용한다. 텍스트 입력 중 Ctrl/Cmd+Z는 텍스트 필드 Undo가 우선한다.

### Playtest

> **수정 → Playtest → 돌아오기 → 수정**이 몇 초 안에 반복되어야 한다.

복귀 시 현재 챕터, 활성 탭, 선택 오브젝트, 지도 위치, zoom, panel
state를 가능한 한 유지한다.

## 5. Editor Components

### Terrain palette

텍스트 목록보다 실제 타일 preview + 이름을 사용한다.

``` text
[🌾 평지] [🌲 숲] [⛰ 산] [🏰 성]
```

### Character picker

``` text
[초상] 관우
       Lv.12 / 기병
```

이름·세력·병종·태그로 검색 가능하게 한다.

### Event builder

``` text
WHEN
[ 5턴이 시작되면 ▼ ]

IF
[ 관우가 생존 중 ▼ ]

DO
[ 조조군 증원 등장 ▼ ]
[ BGM 변경 ▼ ]
[ 대화 재생 ▼ ]
```

Raw data/script는 Advanced에서만 노출한다.

### Empty states

빈 화면에는 다음 행동을 제공한다.

> 아직 이벤트가 없습니다.\
> **\[첫 이벤트 만들기\]**

## 6. Battle HUD

### Desktop

``` text
┌ Turn ─ Objective ───────────────────────────── Menu ┐
│                                                    │
│                     BATTLE MAP                     │
│                                                    │
│ Unit info                                  Minimap │
└────────────────────────────────────────────────────┘
```

전장을 최대한 넓게 유지하고, 선택 유닛과 목표를 패널이 가리지 않게 한다.

### Mobile

``` text
┌ Turn ─ Objective ─ Menu ┐
│                         │
│          MAP            │
│                         │
├─────────────────────────┤
│ 관우 Lv.12  HP ██████   │
│ 공격  특기  도구  대기  │
└─────────────────────────┘
```

하단 패널은 collapsed/expanded 상태를 가진다.

### Objective

``` text
목표: 화웅 격파
주의: 유비 퇴각 시 패배
3 / 20턴
```

부가 목표는 펼쳐보기. 목표 클릭 시 관련 유닛/지역을 지도에서 highlight할
수 있다.

## 7. Battle Interaction

### Pointer / Mouse

-   Click: 선택
-   Second click: 확정 또는 대상 선택
-   Drag: 카메라 pan
-   Wheel: zoom
-   Right click / Esc: 이전 단계

### Touch

-   Tap: 선택
-   Second tap: 확정
-   Drag: pan
-   Pinch: zoom
-   Long press: 상세정보

### Beginner confirmation

입문:

``` text
대상 선택 → 결과 확인 → [공격] [취소]
```

Classic:

``` text
대상 클릭 → 즉시 공격
```

난이도와 조작 방식을 분리한다.

### Attack Forecast

``` text
관우 → 화웅

명중 86%
피해 421
반격 168

행동 후 예상 병력
관우 782 / 화웅 293

[공격]
```

### Action menu

기본: - 공격 - 특기 - 도구 - 대기

교환·협공·필살 등은 상황에 따라 노출한다. 미구현 기능은 숨기고, 조건
부족으로 비활성인 기능은 이유를 알려준다.

### Cancelability

전략적 결과가 발생하기 전 단계는 쉽게 취소 가능해야 한다.

## 8. Dialogue / Story UX

일관된 입력 규칙:

1.  타이핑 중 입력 → 현재 문장 완성
2.  문장 완성 후 입력 → 다음 대사
3.  마지막 대사 → 명확한 종료

후보 기능: - AUTO - SKIP - LOG - Text speed - Auto speed

### Story hierarchy

-   **Normal Story:** 현대적인 고퀄 카툰/모션코믹
-   **Key Moment:** 명화풍 Hero Illustration
-   **Battle Introduction:** 지도·군세·지형·목표 설명
-   **Epilogue:** 결과와 다음 사건 연결

기본 템포 참고: - Story 3--5분 - Battle 15--25분 - Epilogue 1--2분

## 9. Accessibility & Beginner UX

-   색만으로 아군/적군/범위를 구분하지 않는다.
-   지도 위 텍스트는 충분한 대비를 확보한다.
-   Reduced motion 옵션을 고려한다.
-   힌트는 목표 재강조 → 관련 유닛 highlight → 추천 이동 순으로
    단계적으로 제공한다.
-   처음부터 정답을 강제하지 않는다.

## 10. Mobile Creator Strategy

Full Editor는 Desktop/Tablet 우선이다.

모바일 우선 기능: - 프로젝트 확인 - 간단한 텍스트 수정 - 유닛 위치
조정 - Quick Edit - Playtest - Publish 상태 확인

복잡한 Story Timeline과 대형 Map 편집은 큰 화면 사용을 권장할 수 있다.

## 11. Visual Language

### Battle

-   지도와 캐릭터가 주인공
-   장식 프레임 최소화
-   역사적 재질은 얇게 사용
-   정보는 현대적이고 빠르게 읽혀야 함

### Creator

-   생산성 앱처럼 깨끗하게
-   Battle과 semantic colors 공유
-   과도한 두루마리/목재/금속 UI 금지
-   콘텐츠 preview가 UI 장식보다 중요

### Story

-   가장 자유로운 시각 영역
-   고퀄 일러스트와 타이포그래피
-   장면별 분위기 변화 허용
-   중요 장면은 명화처럼 표현 가능

## 12. Feedback & Errors

모든 주요 행동은 즉시 피드백한다.

-   저장됨
-   유닛 배치됨
-   이벤트 연결됨
-   Playtest 준비 중
-   Publish 성공
-   네트워크 끊김

오류는 원인 + 해결 행동을 제공한다.

나쁨: \> Invalid reference.

좋음: \> 삭제된 장수 '화웅'을 참조하는 이벤트가 있습니다.\
\> **\[해당 이벤트 열기\]**

## 13. Publishing UX

Publish 전:

``` text
삼국지 v1.3

✓ 필수 데이터
✓ 에셋
✓ 승패조건
! 선택 경고 2개

[변경사항 보기]
[Publish]
```

Publish 후 버전, 공개 시각, URL, 변경사항, Rollback 가능 여부를 확인할
수 있게 한다.

## 14. Design QA Checklist

### General

-   [ ] Body text가 13px 이상인가?
-   [ ] 터치 타깃이 최소 44px인가?
-   [ ] 색만으로 상태를 전달하지 않는가?
-   [ ] 현재 상태와 다음 행동이 명확한가?
-   [ ] 오류가 해결 방법을 제공하는가?

### Creator

-   [ ] 현재 프로젝트/챕터가 항상 보이는가?
-   [ ] 저장 상태가 보이는가?
-   [ ] 미완성도 저장 가능한가?
-   [ ] Undo/Redo가 가능한가?
-   [ ] 3번의 행동 안에 Playtest 가능한가?
-   [ ] 내부 ID 없이 기본 제작이 가능한가?
-   [ ] Editor round-trip이 데이터를 손실하지 않는가?

### Battle

-   [ ] 선택 유닛이 UI에 가려지지 않는가?
-   [ ] 목표와 핵심 패배조건이 명확한가?
-   [ ] 공격 결과를 확정 전에 이해할 수 있는가?
-   [ ] 실수 입력을 쉽게 취소할 수 있는가?
-   [ ] 모바일 버튼이 충분히 큰가?
-   [ ] 행동 불가 이유를 이해할 수 있는가?

### Story

-   [ ] 대사 진행 규칙이 일관적인가?
-   [ ] 놓친 내용을 다시 볼 수 있는가?
-   [ ] Story와 Battle 전환이 자연스러운가?
-   [ ] 핵심 장면의 시각적 위계가 분명한가?

## 15. 구현 우선순위

### P0

-   Editor round-trip 무손실
-   Save / Playtest / Publish 분리

### P1

-   Project Bar
-   Autosave
-   Undo / Redo
-   Draft
-   Edit ↔ Playtest 왕복
-   HUD 충돌 정리
-   모바일 터치 타깃

### P2

-   챕터 중심 Creator
-   Beginner / Classic 조작 분리
-   Dialogue LOG/AUTO
-   Quick Edit

### P3

-   Story Editor
-   Publish UX
-   Version History
-   Remix/UGC 확장

------------------------------------------------------------------------

## 최종 원칙

> **삼국지를 만드는 데 실제로 쓰기 편한 도구가 곧 유저에게 공개할
> 저작도구가 되어야 한다.**

> **전투 UI는 고전 영걸전의 재미를 유지하되, 사용성은 현대 게임
> 수준이어야 한다.**

> **Creator는 개발툴이 아니라 누구나 이야기를 게임으로 만드는
> 창작도구처럼 느껴져야 한다.**

------------------------------------------------------------------------

# Character Studio / Skin / Rig 디자인 가이드

## Character Studio Layout

``` text
┌─────────────────────────────────────────────────────────┐
│ 관우 / Character Studio       저장됨 ✓       ▶ Preview │
├───────────┬───────────────────────────┬─────────────────┤
│ Category  │       LIVE PREVIEW        │ Inspector       │
│ Appearance│                           │                 │
│ Equipment │                           │                 │
│ Animation │                           │                 │
│ Skills    │                           │                 │
│ Skins     │                           │                 │
├───────────┴───────────────────────────┴─────────────────┤
│ Timeline / Events                                      │
└─────────────────────────────────────────────────────────┘
```

## Progressive Complexity

**Basic:** Body Template, 무기/갑옷/투구/말, 기본 Animation Archetype,
Preview.\
**Advanced:** Rig, Bone, Socket, Timeline, Animation Override, Skill
Presentation, VFX marker.

초보자에게 bone hierarchy를 처음부터 보여주지 않는다.

## Rig Editor UX

Preview 위에서 bone/socket을 직접 선택한다. Bone, selected bone, socket,
attachment, timeline marker를 시각적으로 구분한다. Zoom/Pan, facing
preview, draw order, reset transform, Undo/Redo를 제공한다.

## Equipment Visual UX

Helmet / Armor / Weapon / Shield / Cape / Mount 슬롯을 시각화한다. 선택
즉시 Live Preview에 반영한다. **장비 능력치와 외형 설정은 분리된
탭**으로 제공한다.

## Animation Editor UX

Timeline 기본 Track: - Animation - VFX - Sound - Camera - Gameplay Event

`HIT` marker는 특별히 구분한다. 실제 피해 계산은 편집기가 아니라
Gameplay Skill이 담당한다.

## Skill Presentation Editor UX

목표는 **필살기 연출을 코딩 없이 만드는 것**이다.

Preset 후보: - Quick Slash - Heavy Strike - Charge - Projectile - AoE
Burst - Cinematic Ultimate

Preset 후 Animation/VFX/Camera/Sound/Cut-in/Timing만 교체해도 기본
연출이 완성되게 한다.

## Skin Editor UX

``` text
무신 관우
✓ Portrait
✓ Body
✓ Armor
✓ Weapon
✓ Idle Animation
✓ Attack Animation
✓ Skill Presentation
✓ VFX
✓ Cut-in
✓ Voice
— Gameplay Stats unchanged
```

Presentation-only Skin에는 능력치 변경 없음 표시.

## Character Preview

Idle, Walk, Attack, Hit, Critical, Skill, Victory, Death, Mounted를 즉시
테스트한다. Background/Facing/Speed/Loop/Hit pause/Low-quality mobile
preview도 제공 가능하다.

## Asset Browser

Character, Weapon, Armor, Animation, VFX, Sound, Skin, Creator, Package,
License로 필터링한다. 카드에는 Preview, 이름, 타입, 호환 Rig/Weapon
Archetype, Package, License를 표시한다.

## Character Presentation QA

-   [ ] 장비 교체 시 attachment 정상
-   [ ] 좌/우 facing socket 정상
-   [ ] draw order 정상
-   [ ] fallback animation 존재
-   [ ] HIT marker와 판정 타이밍 연결
-   [ ] animation이 없어도 gameplay 진행
-   [ ] skin이 gameplay 결과를 의도치 않게 변경하지 않음
-   [ ] 모바일 성능 예산 확인
-   [ ] 누락 요소는 base skin으로 fallback
-   [ ] Preview와 Battle Renderer 결과 일치
-   [ ] Basic Creator는 rig를 몰라도 제작 가능
-   [ ] Advanced Creator는 세부 제어 가능
-   [ ] Presentation 편집도 Undo/Redo 지원
