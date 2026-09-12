# 모바일 전투 HUD 하단 패널 — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 스펙 `docs/superpowers/specs/2026-09-12-battle-mobile-hud-design.md` — <768px에서 하단 패널(유닛 행 + 큰 행동 버튼 + 턴종료), 상단 최소화, 데스크톱 무회귀. CDP 모바일 에뮬레이션 검증.

**Architecture:** 순수 `hudMode`/`bottomPanelState` + `ActionMenu.itemsFor` 재사용. 새 컴포넌트 `BottomPanel` 하나. BattleScreen이 `mode`로 JSX 분기. AudioControl 충돌은 CSS 변수.

**Conventions:** 브랜치 `feat/battle-mobile-hud`, `C:\projects\threekingdoms`, `pnpm --filter @tk/web test|typecheck`, 커밋 트레일러 `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`, 코드·커밋 영어.

## Chunk 1: 순수 + 컴포넌트

### Task 1: hudLayout + itemsFor export (TDD)
- [ ] `hudLayout.test.ts`에 `hudMode(0|767|768|1280)`; `bottomPanelState` 전 kind(idle/enemyTurn/autoTurn/animating/battleOver/confirmEndTurn → collapsed; selected/postMoveMenu/targetSelect/confirmAttack/strategyMenu/strategyTarget/itemMenu/itemTarget → expanded). 실패 확인 → `hudLayout.ts`에 구현(`MOBILE_MAX = 767`).
- [ ] `ActionMenu.tsx`: `export function itemsFor`, `export interface Item`. 새 `__tests__/actionMenuItems.test.ts`: postMoveMenu 8라벨 순서 `공격 책략 도구 교환 협공 필살 대기 취소`(실제 코드 순서를 읽고 고정), `attackable:[]`→공격 disabled, `strategies:[]`→책략 disabled, targetSelect→`[취소]`, idle→`[]`; `onPress` 호출 시 dispatch 이벤트 타입 확인(`menuAttack`, `menuWait`, `cancel`). 부유 메뉴 루트에 `data-testid="action-menu"`.
- [ ] `UnitPanel.tsx`: `export { TroopsBar, sideColor, activeUnitId }`. 커밋 `feat(battle): hud mode + bottom panel state (pure); export action items/unit widgets`.

### Task 2: BottomPanel + prop 확장
- [ ] `hud/BottomPanel.tsx`: props `{ ui, vm, ctx, committed, dispatch, canEndTurn, onHeight(px) }`. `state = bottomPanelState(ui)`. collapsed: 좌 56px 스페이서(AudioControl) · idle `inspectedId` 유닛 한 줄(`TroopsBar`) · 우 `턴 종료`(52px, `canEndTurn`일 때, `data-testid="bottom-end-turn"`). expanded: 유닛 행(`activeUnitId(ui)` → `vm.units`; 초상 `/assets/ui/portraits/{name}.webp` 40px onerror 숨김, 이름·`className · Lv.n`, `TroopsBar`, SP `n/max`, `[상세]` `data-testid="bottom-detail"`) → `<AttackForecast ui ctx committed dispatch/>` → `itemsFor(ui, dispatch)` grid 4열 `minHeight:52` `data-testid="bottom-action"`; `selected`(항목 0)면 안내 "이동할 칸이나 적을 탭". 루트 `id="hudBottom"` absolute left/right 0 bottom 0 zIndex 6 `pointerEvents:auto` `HUD_INK` 배경, `paddingBottom: env(safe-area-inset-bottom)`; `ResizeObserver`로 높이 → `onHeight`. 상세 시트 `#hudSheet`(state, `ui.kind` 바뀌면 닫힘) = `<UnitPanel ui vm/>` + 닫기(`data-testid="sheet-close"`).
- [ ] `TurnBanner` `hideEndTurn?: boolean`; `PauseMenu` `mobileControls?: {...}` → 「전투 제어」 행(기본 줌·배속 ×N·자동전투 on/off, 48px 버튼) — 데스크톱은 미전달; `AudioController` `bottom: calc(max(10px, env(safe-area-inset-bottom)) + var(--tk-bottom-inset, 0px))`.
- [ ] typecheck/test green. 커밋 `feat(battle): mobile bottom panel component; end-turn/controls hooks for mobile`.

## Chunk 2: 배선 + E2E + 문서

### Task 3: BattleScreen 분기
- [ ] `const mode = hudMode(viewport.width)`; `mobile = mode === "mobile"`. 모바일: `#hudLeft`에 `ObjectiveStrip`만(`LEFT_COL` width `min(60vw, 260px)`, bottom `calc(var(--tk-bottom-inset,0px) + 12px)`); `#hudRight`에 `☰` 48px 버튼 하나(`data-testid="mobile-menu"`, `BattleControls` 미렌더, Minimap 미렌더); `ActionMenu` 미렌더; `<TurnBanner hideEndTurn/>`; `<BottomPanel … canEndTurn={canEndTurn(snap.ui, committed)} onHeight={h => document.documentElement.style.setProperty("--tk-bottom-inset", h + "px")}/>`(언마운트/데스크톱 전환 시 `0px`); PauseMenu에 `mobileControls`. `canEndTurn` 규칙은 TurnBanner의 것을 순수 함수로 빼서 공유(`hudLayout.canEndTurn(ui, vm)` 또는 TurnBanner export). 데스크톱 JSX는 **그대로**.
- [ ] 브라우저 스모크: in-app Browser `resize_window` mobile(375) → `/battle` → 패널 보임/버튼 크기; desktop → 종전과 동일. 커밋 `feat(battle): mobile HUD — bottom panel replaces floating menu, minimal top bar (<768px)`.

### Task 4: E2E + 문서
- [ ] `tools/editor/e2e/battle-mobile.mjs`(cdp.mjs 하네스; `Tab.send("Emulation.setDeviceMetricsOverride", {width:390,height:844,deviceScaleFactor:2,mobile:true})` + `Emulation.setTouchEmulationEnabled {enabled:true}` 전에 페이지 로드) — 스펙 §6 시나리오 전부; 마지막에 데스크톱 메트릭으로 재로드해 `#hudBottom` 부재·`#hudRight button` 5개·`[data-testid=action-menu]`가 postMoveMenu에서 존재. 루트 `package.json` `e2e:mobile`. PASS까지.
- [ ] `apps/web/CLAUDE.md` HUD 줄에 모바일 분기 1~2문장, master-plan §18/§22·design-guide §15 P1 "모바일 터치 타깃" ✅, 스펙 상태. 커밋 `docs: mobile battle HUD done`.
