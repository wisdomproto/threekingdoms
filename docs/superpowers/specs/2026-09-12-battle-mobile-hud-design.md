# 모바일 전투 HUD — 하단 패널 · 터치 타깃 (2026-09-12)

> design-guide §2 Touch targets(44/48/52), §3 Responsive(Mobile <768px), §6 Battle HUD Mobile("상단 최소 정보 / MAP / 하단 유닛 정보+큰 터치 버튼, 패널은 collapsed/expanded"), §7 Touch(Tap 선택·Second tap 확정), §14 Battle QA(모바일 버튼 충분히 큰가). master-plan §18 "모바일은 상단 최소 정보, 하단 유닛 정보+공격 예측, 큰 터치 버튼". design-guide §15 P1 "모바일 터치 타깃".

## 1. 문제
전투 HUD는 데스크톱 전용이다: 반응형 분기가 **한 곳도 없다**(`matchMedia`·`viewport.width` 비교 0건). <768px에서 좌/우 컬럼(각 `min(64vw,280px)`·미니맵+컨트롤 스택)이 맵을 덮고, 행동 메뉴(`ActionMenu`, 폭 96·버튼 34px)는 손가락보다 작으며, 턴종료(우하단 56px)·AudioControl(전역 좌하단 40px)·대사창이 하단을 나눠 갖는다.

성공 기준: 390×844에서 상단은 턴 띠 + 목표 칩 + `☰` 하나, 하단은 **한 패널**이 선택 유닛(이름·Lv·병력바·SP)과 행동 버튼(≥52px)을 보여주고, 아무것도 안 골랐을 땐 44px 바(턴종료)로 접힌다. 대사 중엔 대사창이 위를 덮는다(패널 z < 8). 데스크톱(≥768)은 픽셀 하나 안 바뀐다. CDP(모바일 에뮬레이션)로 검증.

## 2. 결정
- **게이트 = `viewport.width < 768`**(BattleScreen의 ResizeObserver — 이미 있음). 순수 `hudMode(width)` → `"mobile"|"desktop"`. 미측정(0)은 desktop.
- **행동 모델 재사용**: `ActionMenu.itemsFor(ui, dispatch)`를 export해 하단 패널이 같은 `Item[]`을 큰 버튼으로 그린다 — 로직 중복 0. 모바일에선 부유 `ActionMenu`를 렌더하지 않는다.
- **패널 상태(순수)**: `bottomPanelState(ui)` → `"collapsed"`(idle·enemyTurn·autoTurn·animating·battleOver·confirmEndTurn) / `"expanded"`(selected·postMoveMenu·targetSelect·confirmAttack·strategyMenu·strategyTarget·itemMenu·itemTarget). idle에 `inspectedId`가 있으면 collapsed 바에 그 유닛 한 줄(탭하면 상세 시트). 사용자 토글 없음(YAGNI — 상태기계가 곧 상태).
- **턴종료는 패널 안으로**: 모바일에선 `TurnBanner`의 절대좌표 턴종료를 숨기고(`hideEndTurn` prop) collapsed 바 우측에 같은 이벤트(`endTurnPressed`)를 52px 버튼으로.
- **AudioControl 충돌 = CSS 변수 한 줄**: BattleScreen이 `--tk-bottom-inset`(패널 높이)을 `documentElement`에 쓰고 `AudioController`의 `bottom`이 `calc(max(10px, safe) + var(--tk-bottom-inset, 0px))`. 언마운트 시 0.
- **정보 패널**: 모바일 `#hudLeft`엔 목표 칩만. 유닛 상세(`UnitPanel` 탭 4개)는 패널 유닛 행의 `상세` 버튼 → 하단 시트(패널 위에 `UnitPanel` 그대로, 닫기 버튼). 공격 예측(`AttackForecast` 목록/VS 카드)은 패널 안 행동 버튼 위에 그대로 렌더(이미 흐름 자식·`dispatch` 보유).
- **우측 스택**: 모바일에선 미니맵 숨김, `BattleControls`를 `☰`(48px) 하나로 — 나머지(배속·자동전투·기본 줌·음악)는 PauseMenu에 이미 있거나(소리) 추가(배속·자동전투·기본 줌 3버튼 행). 데스크톱 BattleControls 불변.

## 3. 파일
| 파일 | 역할 |
|---|---|
| `apps/web/src/battle/hudLayout.ts` (수정) | `hudMode(width)`, `bottomPanelState(ui)` 순수 |
| `apps/web/src/battle/hud/ActionMenu.tsx` (수정) | `itemsFor` export(+`Item` 타입) |
| `apps/web/src/battle/hud/UnitPanel.tsx` (수정) | `TroopsBar`·`sideColor` export |
| `apps/web/src/battle/hud/BottomPanel.tsx` (신규) | 모바일 패널: collapsed 바 / expanded(유닛 행 + `AttackForecast` + 행동 그리드) / 상세 시트 |
| `apps/web/src/battle/hud/TurnBanner.tsx` (수정) | `hideEndTurn?: boolean` |
| `apps/web/src/battle/hud/PauseMenu.tsx` (수정) | `mobileControls?: { speed, onCycleSpeed, auto, onToggleAuto, canAutoFight, onResetCamera }` → 「전투 제어」 행(모바일에서만 전달) |
| `apps/web/src/battle/BattleScreen.tsx` (수정) | `mode` 분기: 모바일이면 `#hudLeft`=칩만, `#hudRight`=`☰`만, `ActionMenu` 미렌더, `<BottomPanel>`, `--tk-bottom-inset` |
| `apps/web/src/audio/AudioController.tsx` (수정) | `bottom` calc에 `var(--tk-bottom-inset, 0px)` |
| 테스트 | `hudLayout.test.ts`(+`hudMode`·`bottomPanelState` 전 kind), `actionMenuItems.test.ts`(신규: `itemsFor` 각 kind의 라벨·disabled — 회귀 가드) |
| `tools/editor/e2e/battle-mobile.mjs` (신규) | CDP `Emulation.setDeviceMetricsOverride` 390×844 mobile + `setTouchEmulationEnabled` |

## 4. 레이아웃 (모바일)
```
┌ TurnBanner 띠 (불변) ─────────────────────── [☰ 48px] ┐
│ [목표 칩 (max 60vw)]                                   │
│                       MAP                              │
│                                                        │
├ #hudBottom (absolute; left/right 0; bottom 0; z 6) ────┤
│ collapsed: [♪AudioControl 자리 56px] [유닛 한 줄?]   [턴 종료 52px] │
│ expanded:  ┌ 유닛 행: 초상40 · 이름 · Lv · 병력바 · SP · [상세] ┐│
│            │ (AttackForecast 목록 / VS 카드 — 있을 때만)       ││
│            │ [공격][책략][도구][교환]  ← itemsFor, 52px, 4열   ││
│            │ [협공][필살][대기][취소]                            ││
│            └───────────────────────────────────────────────┘│
└────────────────────────────────────────────────────────────┘
```
- 패널 배경 `HUD_INK` 불투명, 상단 1px `HUD_BRONZE_DIM`, `padding-bottom: env(safe-area-inset-bottom)`, `pointer-events:auto`(맵 탭은 패널 영역만 먹는다 — collapsed 44px가 기본이라 맵 손실 최소).
- 버튼: `minHeight:52`, `fontSize:16`, 4열 grid(`repeat(4, 1fr)`), `gap:6`. `disabled`는 기존 dim 규칙. `accent` 색은 기존 `Item.accent`.
- 유닛 행 데이터 = `UnitVM`(`name/className/level/troops/maxTroops/sp/maxSp/side/acted`) — 활성 유닛 id는 `UnitPanel.activeUnitId` 규칙(export) — `confirmAttack`은 `prior.unitId`.
- 패널 높이는 `ResizeObserver`로 측정해 `--tk-bottom-inset`에 반영(collapsed ≈ 56, expanded ≈ 200~320).
- 상세 시트: expanded 상태에서 `상세` → `#hudSheet`(absolute, bottom 0, maxHeight 70vh, overflow auto, z 7) 안에 `<UnitPanel/>` + 상단 `닫기`. 상태 바뀌면(ui.kind 전이) 자동 닫힘.
- 대사(z 8)·결산·PauseMenu(z 80)는 그대로 위를 덮는다.

## 5. 이벤트 흐름
- 행동 버튼 = `itemsFor`의 `onPress`(이미 `dispatch` 클로저). 턴종료 = `dispatch({type:"endTurnPressed"})`(TurnBanner와 동일 이벤트명 — 실제 이름은 TurnBanner 코드에서 확인). 취소 = `Item`에 이미 포함.
- targetSelect/confirmAttack: 맵 탭으로 대상 선택은 그대로(패널 밖). VS 카드의 [공격]/[취소]는 패널 안.
- 데스크톱 경로: `mode==="desktop"`이면 기존 JSX 그대로(변경 없음 — 회귀 0).

## 6. 테스트·E2E
- 순수: `hudMode(0)→desktop, 767→mobile, 768→desktop`; `bottomPanelState` 전 InputState kind 표.
- `itemsFor` 스냅샷: postMoveMenu 8항목 라벨 순서·disabled 플래그(attackable 빈 배열 → 공격 disabled), targetSelect → [취소] 1개, strategyMenu → 책략 수+취소.
- E2E `battle-mobile.mjs`(cdp.mjs 하네스, next dev :3000): `Emulation.setDeviceMetricsOverride {width:390,height:844,deviceScaleFactor:2,mobile:true}` + touch on → `/battle` → 개전 대사 넘김 → `#hudBottom` 존재·높이 ≤ 64·턴종료 버튼 rect.height ≥ 52 · `#hudRight` 버튼 1개(☰) 48px · `#hudLeft`에 UnitPanel 없음 · 부유 ActionMenu 없음(`[data-testid=action-menu]` 부재 — 데스크톱에서 있는 testid를 붙여 대조) → `__tkBattle.dispatchUi(tapTile 아군)` → expanded: 유닛 행 이름 일치, 버튼 수 = 0(선택 상태는 메뉴 없음 → 패널은 유닛 행+안내 "이동할 칸을 탭") → 이동 가능 칸 탭 → postMoveMenu → 버튼 8개·각 height ≥ 52 → `대기` 탭 → `animating`→idle → collapsed → 턴종료 탭 → `confirmEndTurn`(모달) → 확인 → enemyTurn → whenIdle. `상세` → `#hudSheet` 안 UnitPanel 탭 4개 → 닫기. 데스크톱 메트릭(1280×800)로 전환 → `#hudBottom` 없음·`#hudRight` 버튼 5개.

## 7. 범위 밖
가로 모드 전용 레이아웃, 롱프레스 상세(제스처 없음 — `상세` 버튼으로 대체), 맵 탭 확대(핀치는 기존), 미니맵 모바일 표시, 목표 칩 펼치기, 데스크톱 터치 타깃 확대.
