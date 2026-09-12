# 전투 UX P1 — HUD 충돌 정리 · 입문 공격 확인 · 핵심 패배조건 표시 · 저장하고 나가기 (2026-09-12)

> master-plan §18 개선 방향("HUD 영역 통합", "공격 확정 입문/클래식", "승리/패배조건 3줄", "전투 중단 = 저장하고 나가기 → 이어하기"), §22 P1 전투 UX. design-guide §3("HUD 패널들이 각자 고정 좌표를 점유해 겹치는 구조는 최소화"), §6 Battle HUD(선택 유닛·목표를 패널이 가리지 않게), §7 Beginner confirmation / Attack Forecast / Cancelability, §14 Battle QA(선택 유닛 미가림·목표와 핵심 패배조건·확정 전 결과 이해·실수 취소).

## 1. 문제 (실측)

1. **HUD 충돌**: `UnitPanel`(좌상단 `top:44,left:12`)이 `ObjectiveStrip`(좌상단 `top:40`)을 **항상 덮는다** — 유닛을 고르면 목표가 안 보인다. 우측 플립은 `top:220` 매직넘버로 미니맵/버튼 스택을 피하는데 `BattleControls`가 늘면 깨진다. `AttackForecast`(좌 42%)는 좌측 `ActionMenu`와 겹칠 수 있다. 배치 결정이 `menuPlacement.ts`·`ActionMenu.placeMenu`·`InspectPopup.placeInspect`·`UnitPanel` 4곳에 흩어져 서로 모른다.
2. **공격 확인 없음**: `inputMachine`이 `selected` ②(사거리 내 적 탭)와 `targetSelect`(tapTile) **두 곳에서 즉시 커밋**한다. 예측(`buildAttackPreview`)은 `targetSelect`에서 대상 목록으로만 보이고, 확정 전에 "이 한 명을 치면 어떻게 되나"를 보고 취소할 단계가 없다.
3. **패배조건 비표시**: `buildObjectiveDisplay()`가 `fails`("유비 퇴각 시 패배")를 만들지만 `ObjectiveStrip`/`ObjectiveFlash`가 `primary`+`turnLimit`만 그린다. 1~7장 전 스테이지에 `unitRetreated 유비`가 있는데 플레이어는 모른다.
4. **저장 없는 이탈**: 「전투 그만두기」는 `/stages`로 나가며 진행이 사라진다. 엔진은 `(ctx, seed, actionLog)`로 결정론 재현이 검증돼 있고(`__tests__/replay.test.ts`, JSON 왕복 포함) store가 `seed`·`actionLog`를 이미 갖고 있지만 복원 경로가 없다.

성공 기준: 유닛을 골라도 목표·패배조건이 보이고 패널끼리 안 겹친다. 입문 모드에서 공격은 `대상 선택 → VS 카드 → [공격]/[취소]`, 클래식은 종전 즉시 공격. 목표 칩에 `주의: 유비 퇴각 시 패배`가 뜬다. 메뉴 「저장하고 나가기」 → 스테이지 선택의 「이어하기」 → 같은 턴·같은 배치로 복귀한다. 전부 실제 Chrome에서 CDP로 검증.

## 2. 결정

- **레이아웃 중재 = 두 개의 flex 컬럼.** 패널이 각자 절대좌표를 갖지 않고 `BattleScreen`이 좌/우 컬럼에 **흐름(flow) 자식**으로 꽂는다. 좌 컬럼 = 목표 칩 → 유닛 정보(좌측일 때) → 공격 예측. 우 컬럼(기존 미니맵+컨트롤 스택) = 미니맵 → 컨트롤 → 유닛 정보(우측 플립일 때). 겹침이 구조적으로 불가능해지고 `top:220`이 사라진다. `ActionMenu`·`InspectPopup`(유닛 옆 앵커)은 이번 범위 밖 — 컬럼은 `pointer-events:none`(버튼만 auto)이라 맵 탭을 막지 않는다.
- **입문/클래식 = 조작 설정**(난이도와 분리, design-guide §7). `localStorage tk.controls.v1 {attackConfirm: boolean}` 기본 **true(입문)**. 상태기계에 `confirmAttack` 상태 하나를 추가하고 **두 커밋 지점 모두** 이 상태를 거친다(클래식이면 종전 그대로). 예측 카드 = 기존 `buildAttackPreview` 재사용, VS 카드 한 장 + [공격][취소]. 같은 대상 재탭 = 확정(design-guide Touch "Second tap: 확정").
- **패배조건 = 이미 있는 `display.fails`를 그린다.** 칩·플래시 둘 다 `주의: …` 줄 추가. 부가 목표 펼치기(§6 "부가 목표는 펼쳐보기")는 안 한다 — 칩이 pointer-events:none이고 P1 항목이 아님.
- **중단 저장 = actionLog 스냅샷.** `localStorage tk.battle.suspend.v1 { version, stageId, seed, sortie, log, playthroughCount, turn, savedAt }`. 복원 = 같은 `makeCtx()`로 ctx를 만들고 store 생성 시 `replayLog`를 접어 넣는다(연출 없이 `applyAction` fold). **저장 가능 시점 = 아군 페이즈 `idle`**(적 페이즈 중간·행동 선택 중 저장 없음 — 드라이버 재개 경로를 안 만든다). 스테이지 클리어 시·새 출진 시 삭제. `playthroughCount` 불일치(2회차 배율이 ctx에 박힘)·스테이지 부재면 복원 불가로 무시.

## 3. 파일

| 파일 | 역할 |
|---|---|
| `apps/web/src/battle/BattleScreen.tsx` (수정) | 좌/우 컬럼 컨테이너, `unitPanelSide()`로 UnitPanel 슬롯 결정, `ObjectiveFlash`/`ObjectiveStrip` 분리 렌더, 조작 설정 로드 → `store.setConfirmAttacks`, 복원(`?resume=1`) 처리·새 전투 시 `clearSuspend()`, PauseMenu에 `canSuspend/onSuspend`, dev에서 `window.__tkBattle = store` |
| `apps/web/src/battle/hud/ObjectiveBanner.tsx` (수정) | `ObjectiveFlash`(절대, 상단 중앙, 기존 훅)와 `ObjectiveStrip`(흐름 자식) **두 export**로 분리, 둘 다 `display.fails` 렌더 |
| `apps/web/src/battle/hud/UnitPanel.tsx` (수정) | 절대좌표·플립 제거 → 흐름 자식. `anchor/viewport` prop 제거 |
| `apps/web/src/battle/hud/AttackForecast.tsx` (수정) | 절대좌표 제거 → 흐름 자식. `targetSelect`=기존 목록, `confirmAttack`=VS 카드 + [공격][취소] |
| `apps/web/src/battle/hudLayout.ts` (신규) | 순수: `unitPanelSide(anchor, viewportWidth): "left" \| "right"` (UnitPanel의 기존 반쪽 규칙 이전) |
| `apps/web/src/battle/controlSettings.ts` (신규) | 순수 `normalizeControls` + `loadControls/saveControls`(`tk.controls.v1`) — `audio/settings.ts` 동형 |
| `apps/web/src/battle/inputMachine.ts` (수정) | `confirmAttack` 상태, `confirmAttack` 이벤트, `reduceInput(..., auto, confirmAttacks=false)` |
| `apps/web/src/battle/store.ts` (수정) | `_confirmAttacks` + `setConfirmAttacks`, 스냅샷 노출; `BattleStoreOptions.replayLog` fold; `turn` 노출은 기존 committedState로 |
| `apps/web/src/battle/suspend.ts` (신규) | `SuspendedBattle` 타입, `canSuspend(ui, battle)`, `isResumable(s, {playthroughCount, hasStage})`, `readSuspend/writeSuspend/clearSuspend` |
| `apps/web/src/battle/hud/PauseMenu.tsx` (수정) | 「저장하고 나가기」(sandbox 아님) + 불가 사유, 「조작: 입문/클래식」 토글 |
| `apps/web/src/meta/screens/StageSelect.tsx` (수정) | 상단 「이어하기」 배너(복원 가능할 때만) → sortie 복원 후 `/battle?stage=…&resume=1` |
| `apps/web/src/pixi/BattleRenderer.ts`, `pixi/layers/HighlightLayer.ts`, `hud/ActionMenu.tsx` (수정) | `"targetSelect"` 분기에 `"confirmAttack"` 동반(하이라이트·앵커 유지, 메뉴 숨김) |
| `apps/web/src/battle/hud/ResultSequence.tsx` (수정) | 승리 메타 반영 시 `clearSuspend()` (clearSortie 옆) |
| 테스트 | `__tests__/inputMachine.test.ts`(confirmAttack 6케이스), `__tests__/suspend.test.ts`(순수 판정), `__tests__/replay.test.ts`(replayLog 옵션 = fold 결과 동일), `__tests__/hudLayout.test.ts`, `__tests__/controlSettings.test.ts` |
| `tools/editor/e2e/battle-ux.mjs` (신규) | CDP 실브라우저: 칩 `주의` 표시, 유닛 선택 시 칩/패널 rect 비겹침, 입문 확인 카드→취소→공격, 저장→/stages 이어하기→복원 턴/로그 일치 |

## 4. HUD 레이아웃

```
BattleScreen root (fixed inset 0)
├ TurnBanner (상단 띠 + 우하단 턴종료 — 불변)
├ ObjectiveFlash (absolute top 58, 중앙, 1회 — 불변 위치)
├ <LeftColumn>  absolute; top:44+safe; left:10+safe; bottom:84 (전역 AudioControl 위); width:min(64vw,280px);
│                display:flex; flex-direction:column; gap:8; pointer-events:none; overflow:hidden
│   ├ ObjectiveStrip (흐름)
│   ├ UnitPanel        (side==="left" 일 때)
│   └ AttackForecast   (targetSelect 목록 / confirmAttack VS 카드 — 카드 버튼만 pointer-events:auto)
├ <RightColumn> 기존 스택(absolute top:44 right:12, flex column, align end, gap 8)
│   ├ Minimap
│   ├ BattleControls
│   └ UnitPanel        (side==="right" 일 때)
├ InspectPopup, ActionMenu (유닛 앵커 — 불변)
└ 오버레이(대사/확인/컷인/결산/메뉴 — 불변)
```

- `unitPanelSide(anchor, viewportWidth)`: `anchor && viewportWidth>0 && anchor.x < viewportWidth/2 ? "right" : "left"` — UnitPanel 469~473행 규칙을 순수 함수로 옮긴 것. 앵커는 종전대로 `ui.kind==="idle" ? inspectAnchor : menuAnchor`.
- 컬럼 `overflow:hidden`은 저해상도에서 하단 패널이 잘리는 걸 감수한다(겹침보다 낫다). 모바일 하단 패널(§6 Mobile)은 별도 항목(P1 "모바일 터치 타깃")이라 이번엔 안 한다.
- UnitPanel·AttackForecast·ObjectiveStrip에서 `position/top/left/right/zIndex` 제거, 폭은 컬럼이 결정(`maxWidth:100%`).

## 5. 입문 공격 확인 (상태기계)

```ts
| { kind: "confirmAttack"; targetId: string;
    prior: Extract<InputState, { kind: "targetSelect" }> | Extract<InputState, { kind: "selected" }> }
type UiEvent = … | { type: "confirmAttack" }
```

- `reduceInput(state, event, ctx, battle, auto = false, confirmAttacks = false)`.
- `selected` ②(사거리 내 적 탭)와 `targetSelect` tapTile: 종전 커밋 대신 `confirmAttacks`면 `{ kind:"confirmAttack", targetId, prior: state }` (effects 없음). 아니면 종전 커밋(회귀 0).
- `confirmAttack` 처리:
  - `confirmAttack` 이벤트 또는 **같은 targetId 재탭** → 종전과 동일한 커밋(`prior.kind==="selected"`면 `attack` 단일, `targetSelect`면 `chainActions(unitId, from, preview, final)`·`ultimate` 반영) → `animating`.
  - 다른 공격 가능 대상 탭 → `targetId` 교체(카드 갱신).
  - `cancel`(Esc/우클릭/[취소]) 또는 그 외 탭 → `prior`로 복귀.
- `activeUnitId(ui)`(UnitPanel), `ActionMenu`(메뉴 숨김), `HighlightLayer`/`BattleRenderer`의 `"targetSelect"` 분기: `confirmAttack`은 `prior`의 공격 가능 하이라이트를 유지하고 대상 칸을 강조. 렌더러 메뉴 앵커(`menuAnchor`)는 `prior.unitId` 기준 유지.
- 자동전투·적 AI는 `commit()` 직행이라 무관. `sandbox`/실험실도 같은 설정을 따른다.
- 설정: `store.setConfirmAttacks(on)` → `_confirmAttacks`; `dispatchUi`가 `reduceInput(..., this._autoBattle, this._confirmAttacks)`. 스냅샷에 `confirmAttacks` 노출(PauseMenu 토글 표시). BattleScreen 마운트 시 `loadControls().attackConfirm`으로 초기화, PauseMenu 토글 → `saveControls` + `store.setConfirmAttacks`.

VS 카드(design-guide §7 Attack Forecast):
```
관우 → 화웅
명중 86%   피해 421   반격 168
행동 후 예상 병력  관우 782 / 화웅 293
[공격]  [취소]
```
`buildAttackPreview(ctx, committed, prior.unitId, targetCoord, prior.kind==="targetSelect" ? prior.preview : undefined, ultimate)` — `damage/hitPercent/counter`에서 계산. 예상 병력 = `troops - damage`(0 하한), 반격 없으면 "반격 없음". [공격]=`dispatch({type:"confirmAttack"})`, [취소]=`dispatch({type:"cancel"})`. 버튼 최소 44px 높이(design-guide Touch targets).

## 6. 패배조건 표시

- `ObjectiveStrip`: `primary` 줄들 → `fails.map(f => "주의: " + f)`(색 `#e7b4ac`, 12.5px) → `turnLimit`. `fails`가 비면 줄 없음.
- `ObjectiveFlash`: 같은 `주의:` 줄을 `primary` 아래 dim으로.
- `buildObjectiveDisplay`는 불변(`fails` 텍스트 규칙은 이미 테스트됨).

## 7. 저장하고 나가기 / 이어하기

```ts
interface SuspendedBattle { version: 1; stageId: string; seed: number; sortie: SortiePayload | null;
  log: Action[]; playthroughCount: number; turn: number; savedAt: string }
canSuspend(ui, battle) = ui.kind === "idle" && battle.phase === "player" && battle.status === "ongoing"
isResumable(s, { playthroughCount, hasStage }) = s?.version === 1 && hasStage(s.stageId) && s.playthroughCount === playthroughCount
```

- **저장**: PauseMenu 「저장하고 나가기」(sandbox면 미표시). `canSuspend`가 아니면 비활성 + 사유 "아군 차례에 행동을 고르기 전에만 저장할 수 있습니다"(design-guide "행동 불가 이유"). 클릭 → `writeSuspend({ stageId: ctx.stage.id, seed: store.seed, sortie: readSortie(), log: [...store.actionLog], playthroughCount: getPlaythroughCount(), turn: committed.turn, savedAt })` → `router.push("/stages")`. 「전투 그만두기」 문구·동작 불변(저장 안 함, 기존 복구본은 건드리지 않음 = 세이브 파일처럼 남는다).
- **이어하기**: `StageSelect` 최상단 배너 `이어하기 — {stageName} · {turn}턴 · {savedAt 시:분}` (`isResumable`일 때만). 클릭 → `writeSortie(s.sortie ?? { stageId, members: [], sharedItems: [] })`(members 빈 배열 = 원본 배치 유지, `applySortieToStage` 미적용) → `router.push('/battle?stage='+stageId+'&resume=1')`.
- **복원**(`BattleScreen.createSession`): `resume = URL '?resume=1'`. `s = readSuspend()`; `isResumable && s.stageId === ctx.stage.id`면 `new BattleStore(ctx, s.seed, { …, replayLog: s.log })`. store 생성자: `createBattle` 뒤 `for (a of replayLog) committed = applyAction(ctx, committed, a).state`(실패 시 throw), `log.push(...replayLog)`, `settled = committed`, 초기 `ui = initialUiFor(committed, false)`(기존 함수 — 저장 시점이 아군 idle이라 idle). throw 시 BattleScreen이 `clearSuspend()` 후 새 전투로 폴백(console.warn). `introDone` 초기값 = `!hasOpeningDialogue || resumed`(개전 대사는 재생 안 함 — 이벤트가 없으므로 어차피 큐 비고, 목표 칩이 안 뜨는 함정 방지).
- **삭제**: ResultSequence 승리 메타 반영(`clearSortie` 옆) + BattleScreen 새 전투 진입(`!resume && !sandbox`)에서 `clearSuspend()`.
- 실험실/플레이테스트(sandbox)는 저장 없음(메뉴 미표시).

## 8. 테스트

- `inputMachine.test.ts`: (1) 클래식=즉시 커밋 회귀 (2) 입문 selected 사거리 내 탭 → confirmAttack (3) 입문 targetSelect 탭 → confirmAttack (4) confirmAttack 이벤트 → 종전과 같은 actions (5) 같은 대상 재탭 = 커밋, 다른 대상 = 교체 (6) cancel → prior 복귀.
- `suspend.test.ts`: `canSuspend` 4분기, `isResumable`(version/hasStage/playthrough 불일치).
- `replay.test.ts` 추가: `new BattleStore(ctx, seed, { replayLog: log }).committedState` deepEqual 라이브 fold 결과, `actionLog` 길이 일치.
- `hudLayout.test.ts`·`controlSettings.test.ts`: 순수 함수.
- E2E `tools/editor/e2e/battle-ux.mjs`(cdp.mjs 재사용, next dev :3000 필요): `/battle` 진입 → 칩에 `주의:` 포함 → `__tkBattle.dispatchUi(tapTile 아군)` 후 `#hudLeft` 자식 rect 두 개가 비겹침 → 사거리 내 적이 있는 배치(`__tkBattle.committedState`에서 탐색; 없으면 endTurn 후 재시도)에서 입문 탭 → `uiState.kind==="confirmAttack"` → [취소] 클릭 → `targetSelect`/`selected` → 재탭·[공격] → `animating`→idle → ☰ → 「저장하고 나가기」 → `/stages`에 「이어하기」 → 클릭 → `/battle?…resume=1` → `__tkBattle.actionLog.length`·`committedState.turn` 저장값과 일치.

## 9. 범위 밖

모바일 하단 패널·collapsed 상태, ActionMenu/InspectPopup 상호 회피, 부가 목표 펼치기, 목표 클릭 하이라이트, 적 페이즈 중 저장, 자동 저장, 클라우드 세이브.
