# PixiJS 렌더러 v0 최종 설계 — 사수관 수직 슬라이스

> 기준: 우승안(씬그래프/성능 관점) + 심사단 합성 지시 반영. 엔진(@tk/engine)·심(@tk/sim)은 소비자 계약으로만 사용하며, 단 하나의 예외(turnLimit 선행 PR)만 엔진을 수정한다.

---

## 1. 결정 요약

| 결정 | 선택 | 핵심 근거 |
|---|---|---|
| **투영** | 직교(orthogonal), TILE_SIZE=48 | 엔진이 맨해튼 거리 직교 그리드 — "엔진이 보는 것 = 화면에 보이는 것". 에셋 전무 단계에서 아이소는 이득 0, 비용 실재. 모든 grid↔world 변환을 `projection.ts` 단일 관문에 봉인해 쿼터뷰 전환 비용을 코드 2~4일로 통제 (실 비용은 어차피 쿼터뷰 스프라이트 에셋 생산 시점) |
| **React↔Pixi 경계** | React는 canvas mount/unmount + DOM HUD만. Pixi 객체는 `BattleRenderer` 내부 봉인. HUD는 `useSyncExternalStore`로 직렬화 가능 뷰모델만 구독 | React 리렌더와 Pixi 프레임 루프 완전 분리. @pixi/react 미사용(React 19 호환성 리스크 회피), vanilla pixi.js v8 |
| **입력 모델** | **movePreview 지연 커밋** (합성 채택): 이동 탭 → 고스트 표시, 엔진 무커밋 → 확정 시 move+attack / move+wait **연쇄 원자 커밋** | 엔진에 undo가 없으므로 즉시 커밋은 모바일 오터치 회복 불가. `getAttackableTargets(ctx, state, unitId, from)`의 `from` 파라미터가 엔진에 실존(combat.ts:42)해 구현 비용 낮음. 원작 영걸전의 이동 취소 문법과 일치 |
| **상태 흐름** | committed(엔진 진실, 동기) → EventPlayer 직렬 연출 → settled 스냅샷(드레인 시 갱신). HUD는 **settled만** 구독 | 연출 전 결과 스포일러(병력 수치 선노출) 차단 — 우승안의 리스크 항목을 설계 본문으로 승격 |
| **턴 제한** | 렌더러 임의 판정 **금지**. 엔진 `checkOutcome`에 turnLimit 패배 판정을 추가하는 **선행 소형 PR** | stage 데이터에 `turnLimit: 30` 실존하나 미집행 — 엔진=단일 진실 원칙 |
| **이동 연출 경로** | 렌더러 `path.ts`가 엔진 export `moveCostFor`/`terrainAt` 재사용 BFS로 재계산, 타이브레이크는 `getMovableTiles` 정렬(y우선, x차선)과 일치 | 직선 트윈의 벽/성문 관통 방지 + 규칙 이중 구현 회피. 장기적으로 엔진 `unitMoved` 이벤트에 `path` 필드 추가 제안 |
| **리플레이 기반** | v0부터 `actionLog: Action[]` 기록 (재생 기능은 미구현) | 몇 줄 비용으로 v1.5 리더보드/리플레이의 결정론 기반 + seed+log 버그 재현 수단 확보 |

---

## 2. 컴포넌트와 책임

### 2.1 헤드리스 계층 (Pixi import 금지 — vitest 무균 지대)

- **BattleStore** (`src/battle/store.ts`) — 단일 진실 상태 컨테이너. `{ ctx, committedState, settledState, uiState, mode, actionLog }` 보유. `dispatchUi(uiEvent)` → InputMachine 리듀서 → 산출된 effect(엔진 액션 커밋/카메라 포커스/메뉴 표시) 실행. 커밋마다 `actionLog.push(action)`. `useSyncExternalStore` 어댑터로 React에 직렬화 가능 뷰모델 슬라이스만 노출. **HUD 뷰모델은 settledState에서 파생** — 연출 중 committed가 앞서가도 화면 수치는 드레인 시점에만 갱신.
- **InputMachine** (`src/battle/inputMachine.ts`) — 순수 함수 리듀서 `(state, event, ctx, battleState) => { next, effects[] }`. `getMovableTiles`/`getAttackableTargets`(movePreview 좌표는 `from` 파라미터)를 호출해 하이라이트 집합·고스트 좌표를 상태에 포함 — 렌더러는 그리기만 한다.
- **EventPlayer** (`src/battle/eventPlayer.ts`) — `BattleEvent[]` 직렬 큐 소비기. 이벤트 1개 → Presenter 인터페이스 메서드 1개(Promise) 매핑. 재정렬/병합/스킵 금지(배속은 duration만 단축). 드레인 시: ① `presenter.sync(committedState)` ② **dev 단언**: 화면 투영 상태(좌표/troops/retreated/phase)와 committed의 deepEqual 검사 — sync가 드리프트를 "덮어서" 버그를 숨기는 것을 방지 ③ settledState 갱신 ④ `onDrained` 콜백. FakePresenter로 vitest 검증 가능.
- **EnemyTurnDriver** (`src/battle/enemyTurnDriver.ts`) — 적 페이즈 자동 루프. `phaseChanged(enemy)` 드레인 감지 → `while(phase==='enemy' && ongoing) { chooseAction(@tk/sim 그리디 재사용) → applyAction → 카메라 포커스 → await play(events) }`. 엔진이 페이즈를 자동 전환하므로 `phaseChanged(player)` 수신이 종료 신호. 안전망으로 최대 반복 가드(유닛 수×4).
- **path** (`src/battle/path.ts`) — 이동 연출용 BFS 경로 재계산. 엔진 export `moveCostFor`·`terrainAt`(movement.ts) 그대로 재사용, 타이브레이크는 `getMovableTiles` 정렬 규칙과 일치시켜 결정론 유지. *우승안의 "경로 트윈"에서 미정의였던 경로 출처를 메우는 컴포넌트.*
- **viewmodel** (`src/battle/viewmodel.ts`) — HUD용 셀렉터(유닛 패널/턴/결과 VM). 전부 settledState 기준 순수 함수.

### 2.2 Pixi 계층

- **Projection** (`src/pixi/projection.ts`) — `TILE_SIZE=48`, `gridToWorld`/`worldToGrid`/`depthOf(y)` 순수 함수. 모든 좌표 변환의 유일한 관문. 쿼터뷰 전환 시 이 파일만 교체.
- **TextureResolver** (`src/pixi/textures.ts`) — `(kind, id) => Texture`. v0: 부팅 시 Graphics로 지형 14종+진영 2색 베이스를 RenderTexture로 1회 베이크 → 전 스프라이트 공유 텍스처(풀 배칭). 향후 atlas frame 반환 구현으로 교체해도 소비측 불변 — placeholder→에셋 교체 경로의 핵심.
- **gesture** (`src/pixi/gesture.ts`) — **순수 로직으로 분리된 제스처 인식기** (합성 채택): 포인터 이벤트 시퀀스 → 탭/팬/핀치 분류. 슬롭 10px(CSS px 기준)/300ms/2포인터. 합성 이벤트 시퀀스로 vitest 검증 — InputAdapter의 테스트 사각지대 제거.
- **InputAdapter** (`src/pixi/inputAdapter.ts`) — stage 전역 pointer(eventMode='static') → gesture 분류 호출 → 탭이면 `worldToGrid` 변환 후 `store.dispatchUi({type:'tapTile', coord})`. 팬/핀치는 카메라로. canvas `touch-action: none`.
- **CameraController** (`src/pixi/camera.ts`) — scale+pivot 조작. 줌 클램프 [0.5, 2.0] + **최소줌에서도 타일 화면 크기 ≥24px 보장** 제약(합성 채택 — TILE_SIZE 48 기준 0.5가 정확히 24px이므로 하한의 의미를 "오탭률 기준 불변량"으로 명문화, 타일 크기 변경 시 자동 추종). 맵 경계 팬 클램프, 앵커 고정 줌, `focusOn(grid, ms)` 트윈. 수학부는 순수 함수 분리.
- **TerrainLayer** — 1792타일을 16×16 청크 8개로 분할, 청크별 cacheAsTexture 베이크 + 청크 AABB 뷰포트 컬링. (구현이 막히면 v0는 `cullable=true` 단순 폴백 허용 — 직교+유닛 7기는 컬링 없이도 60fps.)
- **HighlightLayer** — 이동(청)/공격(적)/고스트/커서. 스프라이트 풀 재사용. InputMachine 상태의 수동적 뷰.
- **UnitLayer + UnitView** — UnitView = "애니메이션 시퀀스 재생기" 파사드: `play('idle'|'move'|'attack'|'hit'|'retreat') => Promise` + `setFacing`/`setPosition`. v0 구현은 색 사각형+Pixi Text(장수명)+병력 바. 인터페이스가 시퀀스 기반이라 Spine/스프라이트로 에셋만 교체. `sortableChildren` + `zIndex=depthOf(y)` 선확보(아이소 전환 시 깊이 정렬 공짜).
- **FxLayer** — 데미지 팝업/배너/오버레이 이펙트. Text 풀링.
- **BattleRenderer** (`src/pixi/BattleRenderer.ts`) — Pixi 조립 루트이자 **Presenter 구현체**. Application 비동기 init(StrictMode 가드), 씬그래프 구성, resize, destroy. React에서 보면 `mount(canvas)`/`destroy()` 블랙박스.

### 2.3 React 계층

- **BattleScreen + HUD** (`src/battle/BattleScreen.tsx`, `src/battle/hud/*`) — React 셸. UnitPanel/ActionMenu(공격·대기·**취소** — 버튼 56px, 하단 엄지 존 배치)/TurnBanner+턴종료/ResultOverlay. `app/battle/page.tsx`에서 `dynamic(ssr:false)` 로드.

---

## 3. 파일 레이아웃 (신규 ~25 + 수정 3)

```
apps/web/
  app/battle/page.tsx                     — dynamic(ssr:false) 라우트
  app/page.tsx                            — (수정) 스테이지 정보 + /battle 링크
  src/battle/
    BattleScreen.tsx                      — React 셸, StrictMode 가드
    store.ts                              — BattleStore + actionLog + settled 스냅샷
    inputMachine.ts                       — 순수 입력 상태기계 (movePreview 포함)
    eventPlayer.ts                        — 직렬 큐 + Presenter 인터페이스 + dev 단언
    enemyTurnDriver.ts                    — 적 페이즈 자동 루프
    path.ts                               — moveCostFor/terrainAt 재사용 BFS 경로
    viewmodel.ts                          — settled 기준 HUD 셀렉터
    hud/UnitPanel.tsx ActionMenu.tsx TurnBanner.tsx ResultOverlay.tsx
    __tests__/inputMachine.test.ts eventPlayer.test.ts fullBattle.test.ts
               path.test.ts replay.test.ts
  src/pixi/
    projection.ts textures.ts camera.ts gesture.ts inputAdapter.ts
    BattleRenderer.ts
    layers/TerrainLayer.ts HighlightLayer.ts UnitLayer.ts UnitView.ts FxLayer.ts
    __tests__/projection.test.ts camera.test.ts gesture.test.ts
  vitest.config.ts                        — node 환경, Pixi 미로드 계층 대상
  package.json                            — (수정) pixi.js@^8, vitest

packages/engine/  — (선행 소형 PR) checkOutcome에 turnLimit 패배 판정 + 테스트
```

---

## 4. 데이터 흐름

단방향 루프:

```
[Pixi 포인터] → gesture(순수 분류) → InputAdapter(worldToGrid)
  → store.dispatchUi(uiEvent)
  → InputMachine 순수 리듀서 → (다음 UI상태, effects)
  → effect가 엔진 액션이면: applyAction 커밋(동기, committed 즉시 갱신) + actionLog.push
     · movePreview 확정 시 move+attack / move+wait를 연쇄 커밋, events를 이어붙여 큐 투입
  → EventPlayer가 Presenter(=BattleRenderer) 호출로 순차 번역 (트윈/팝업 Promise 직렬 await)
  → 큐 드레인: renderer.sync(committed) + dev 정합 단언 + settledState 갱신 + 입력 잠금 해제
```

- **3단계 상태 흐름**: committed(논리, 즉시) → 연출(직렬 재생) → settled(화면/HUD). 렌더러는 어떤 경우에도 상태를 만들지 않는 순수 소비자.
- **React 경계**: React는 canvas 생명주기와 DOM HUD만. HUD는 settled 파생 뷰모델만 구독 — 연출보다 결과가 먼저 보이는 스포일러 구조적 차단.
- **카메라는 항상 자유**: 팬/줌 제스처는 InputAdapter 단계에서 처리되어 animating/enemyTurn 중에도 동작.

---

## 5. 입력 상태기계 (7상태, 순수 리듀서)

| 상태 | 이벤트 → 전이 |
|---|---|
| **idle** | tapTile(아군·미행동) → selected (이 시점 getMovableTiles + 현위치 getAttackableTargets 계산, 하이라이트 집합 보관) · tapTile(적/빈 타일) → 정보 표시만, idle 유지 · endTurnPressed → 미행동 아군 전원 wait 순차 커밋 → animating |
| **selected** | tapTile(이동 가능 타일) → **movePreview** (엔진 무커밋, 고스트 표시) · tapTile(현위치 사거리 내 적) → effect: attack 커밋 → animating · tapTile(자기 자신/제자리) → postMoveMenu(from=현위치) · tapTile(범위 밖)/cancel → idle (무손실 취소) |
| **movePreview** | 고스트를 목적지에 표시 → 즉시 **postMoveMenu** 진입. 이 상태의 존재 이유: 커밋 전이므로 취소가 공짜 |
| **postMoveMenu** | ActionMenu(공격/대기/**취소**). 공격은 `getAttackableTargets(ctx, state, unitId, from=프리뷰 좌표)` 비면 비활성 · menuAttack → targetSelect · menuWait → effect: **move+wait 연쇄 커밋** → animating · menuCancel → 고스트 제거, selected 복귀 (원작 이동 취소 문법) |
| **targetSelect** | 공격 가능 적 적색 하이라이트(프리뷰 좌표 기준) · tapTile(대상) → effect: **move+attack 연쇄 커밋** → animating · cancel → postMoveMenu |
| **animating** | EventPlayer 재생 중 모든 탭 무시(카메라 제외). 드레인 시: phase=enemy → enemyTurn / ongoing+player → idle / battleEnded → battleOver |
| **enemyTurn** | EnemyTurnDriver 진행, 입력 잠금(카메라 제외). phaseChanged(player) → idle |
| **battleOver** | 종료. ResultOverlay만 |

모든 전이는 `(현재상태, 이벤트, ctx, battleState)`의 순수 함수 — vitest 전수 검증.

> **설계 노트**: movePreview는 "엔진의 이동 후 상태를 클라이언트가 가정하는 구간"을 만든다. 현 엔진은 이동 중 트리거(복병 등)가 없어 안전하지만, 향후 추가되면 프리뷰-커밋 불일치가 생기므로 그 시점에 엔진 시뮬레이션 API 협의 필요. 이 전환은 InputMachine 전이 3개의 국소 변경으로 격리되어 있다.

---

## 6. 엔진 통합

**applyAction 호출 지점은 정확히 4곳** (전부 store 경유, 동기 커밋):
1. selected에서 제자리 공격 확정 — `attack`
2. postMoveMenu/targetSelect 확정 — `move`+`wait` 또는 `move`+`attack` **연쇄 커밋** (두 호출의 events를 이어붙여 큐 투입 → 이동 트윈→공격 연출이 자연 직렬화)
3. 턴 종료 버튼 — 미행동 아군 전원 `wait` 순차
4. EnemyTurnDriver 루프 — 적 행동 1스텝씩

**이벤트 연출 순서** (받은 순서 그대로, 재정렬 금지 — 엔진이 순서를 이미 보장):

| 이벤트 | 연출 |
|---|---|
| unitMoved | path.ts BFS 경로를 따라 타일당 150ms 트윈 (직선 금지 — 벽/성문 관통 방지) |
| damageDealt | 공격 시퀀스+데미지 팝업. `counter=true`면 방향 반전+색 구분 |
| unitRetreated | 페이드아웃 |
| duelTriggered | 일기토 배너 텍스트 (v0 텍스트 수준) |
| phaseChanged | 페이즈 배너 600ms. enemy면 드레인 후 드라이버 기동 |
| battleEnded | ResultOverlay + 입력 영구 잠금. **항상 큐 마지막에 재생됨을 테스트로 고정** (현재는 maybeAdvancePhase의 종료 후 조기 반환으로 자연 보장 — 회귀 방어) |

엔진/심 패키지 수정 금지의 **유일한 예외 — 선행 소형 PR**: `checkOutcome`(packages/engine/src/actions.ts)에 `state.turn > stage.turnLimit` 패배 판정 추가 + 기존 74개 테스트에 케이스 보강. 렌더러에서 턴 제한을 임의 판정하는 것은 엔진=단일 진실 위반이므로 금지.

**장기 제안 (이번 범위 아님)**: 엔진 `unitMoved` 이벤트에 `path: Coord[]` 필드 추가 — path.ts의 이중 계산 제거.

---

## 7. 테스트 전략

vitest를 apps/web에 도입. **Pixi 무균 지대 강제**: `src/battle/*` 전체와 `src/pixi/{projection,camera 수학부,gesture}.ts`는 pixi.js를 import하지 않는다 (node 환경, jsdom 불필요).

| # | 스위트 | 검증 내용 |
|---|---|---|
| 1 | inputMachine.test | 7상태 × 유효/무효 이벤트 전이 전수. 실제 ctx(gameData+sishuiguan) 픽스처. 특히: movePreview 취소가 **엔진 무호출**임, from 기준 공격 대상 산출, animating 중 입력 무시 |
| 2 | eventPlayer.test | FakePresenter로 이벤트→연출 매핑·직렬 순서·드레인 콜백·**battleEnded 최후 재생 계약**·dev 단언 발화 검증 |
| 3 | fullBattle.test | 실제 엔진+양측 chooseAction으로 사수관을 battleEnded까지 자동 완주 — 무한루프/교착 부재 + applyAction 페이즈 전환 계약 고정 (황금 테스트). **결정론 회귀 1건 포함**: 복제 상태 드라이런 damageDealt = 실제 커밋 damageDealt (분산 없음 계약 고정 — v0.1 예보 UI의 기반) |
| 4 | replay.test | `createBattle(ctx, seed)` + actionLog fold ≡ committedState deepEqual — v1.5 리플레이 결정론 불변식 |
| 5 | path.test | BFS 경로의 비용 합 = 엔진 이동 비용, 벽/성문 미통과, 타이브레이크가 getMovableTiles 정렬과 일치 |
| 6 | projection.test | gridToWorld∘worldToGrid 항등, 경계 (0,0)·(55,31). 아이소 추가 시 동일 스위트 재사용 |
| 7 | camera.test | 줌 클램프(타일 ≥24px 불변량 포함), 팬 경계 클램프, 앵커 고정 줌의 월드 좌표 보존 |
| 8 | gesture.test | 합성 포인터 시퀀스(10px/300ms/2포인터)로 탭/팬/핀치 분류 정확성 |

Pixi 의존부(레이어/렌더러)는 단위 테스트 제외 — 수동 검증 + 추후 Claude Preview 스크린샷. WebGL 모킹은 비용 대비 무가치. 런타임 안전망: 큐 드레인마다 dev 모드 정합 단언(§6).

---

## 8. 구현 순서 (의존 순서, 6단계)

| 단계 | 작업 | 완료 기준 |
|---|---|---|
| **1. 엔진 선행 PR** | checkOutcome에 turnLimit 패배 판정 + 테스트 보강 | 엔진 테스트 75개+ green. 턴 31에서 defeat 판정 케이스 통과 |
| **2. 순수 기반 계층** | projection / path / camera 수학부 / gesture + vitest 셋업 | 스위트 5~8 green. pixi.js 미설치 상태에서도 테스트 실행 가능 |
| **3. 헤드리스 전투 계층** | store(actionLog·settled 포함) / inputMachine / eventPlayer(FakePresenter) / enemyTurnDriver / viewmodel | 스위트 1~4 green. **fullBattle이 사수관을 battleEnded까지 완주** — 이 시점에 게임 로직은 화면 없이 완성 |
| **4. Pixi 렌더링 계층** | textures / Terrain·Highlight·Unit·Fx 레이어 / BattleRenderer(Presenter 구현) / camera 적용 / inputAdapter | 데스크톱 브라우저에서 맵 표시+스크롤/줌+유닛 표시. renderer.sync로 정적 상태 일치 (typecheck green) |
| **5. React 셸 + HUD** | BattleScreen(StrictMode 가드) / HUD 4종 / 라우트 / dynamic(ssr:false) | 마우스로 사수관 1판 완주 가능: 선택→프리뷰→취소→확정→공격→적 턴 관전→승패 표시. StrictMode 이중 마운트에서 크래시/누수 없음 |
| **6. 모바일 검증·조정** | touch-action/viewport meta, 실기기(iOS Safari 포함) 터치, dev 단언 켠 채 수동 완주 | 실기기에서 탭/팬/핀치 충돌 없이 완주. 드레인 단언 0건 발화. 제스처 임계·줌 클램프 튜닝 항목 기록 |

각 단계는 독립 커밋 가능 단위 — 몇 달 공백 후에도 단계 경계에서 복귀 가능(프로젝트 지속성 원칙).

---

## 9. 리스크

1. **Pixi v8 비동기 init × React 19 StrictMode 이중 마운트** — init 완료 전 destroy 시 크래시. "init 중 destroy 요청 시 init 완료 후 파괴" 가드 필수 (첫 구현 최다 빈도 함정).
2. **movePreview의 가정 구간** — 향후 엔진에 이동 중 트리거(복병)가 생기면 프리뷰-커밋 불일치. 그 시점에 엔진 시뮬레이션 API 협의. InputMachine 국소 변경으로 격리됨.
3. **applyAction 페이즈 자동 전환 타이밍 의존** — 마지막 아군 행동 events에 phaseChanged(enemy) 포함 가정 위에 적 턴 루프가 서 있음. fullBattle 테스트로 계약 고정, 어긋나면 엔진이 아니라 드라이버를 수정.
4. **모바일 제스처 충돌** — 핀치줌 vs 브라우저 줌/당겨서 새로고침. touch-action:none + viewport meta 필수, iOS Safari 실기 검증 전까지 미확정.
5. **제스처 임계(10px/300ms) DPI 체감차** — CSS px 기준 통일, 실기기 튜닝 항목.
6. **이중 부기 드리프트** — sync가 덮는 구조라 버그 은폐 가능 → 드레인 dev 단언이 안전망. 단언 발화 시 연출 코드가 아니라 settled/presented 적용 로직을 의심.
7. **한글 라벨 비용** — 유닛 ~7기라 Pixi Text 캐시로 충분. 20+기 대형맵에서 재검토.
8. **56×32 맵 + 아군 동측/적 서측 극단 분리** — 초반 턴이 스크롤·이동 반복로 지루할 수 있음. 카메라 자동 추적으로 완화, 확인되면 스테이지 데이터 배치 이슈로 격상.
9. **cacheAsTexture 청크 텍스처 ~19MB** — v0 단일맵 무해, 768px²는 모바일 한도(4096) 내 안전. 구현 난항 시 cullable=true 폴백 허용.
10. **직교 투영의 시각적 밋밋함** — 이해관계자 퀄리티 판정 오염 가능. "v0는 조작감 검증, 쿼터뷰는 에셋 도착 후 projection.ts 교체"임을 명시 공유.

### v0.1 후보 (기록만, 이번 범위 제외)
- **드라이런 데미지 예보 UI** (ForecastPanel 또는 대상 탭 시 한 줄 표시) — 결정론 계약은 v0 회귀 테스트로 이미 고정됨. 원작도 전투 예보를 보여주는 장르 관례라 채택 가치 높음.
- actionLog 기반 리플레이 **재생** 기능 (기록과 fold 테스트는 v0 포함).
- 적 턴 배속/화면 밖 행동 요약 연출.

---

## 부록: 심사 결과와 합성 근거

**우승안**: 안 1 "PixiJS 렌더러 v0 설계 — 사수관 수직 슬라이스 (씬그래프/성능 관점)". 컴포넌트 분해(Presenter 인터페이스, TextureResolver 교체점, 청크 컬링), 테스트 무균 지대 설계, 투영 전환 비용 분석이 가장 구체적이라는 평가. (개별 점수 수치는 본 합성 단계에 전달되지 않음 — 합성 지시문 기준으로 기술한다.)

**비우승안에서 흡수한 아이디어와 처리**:

| 출처 | 아이디어 | 처리 |
|---|---|---|
| 안 0 | turnLimit 미집행 (코드 검증으로 사실 확인: schemas.ts:120 정의, checkOutcome 미참조) | **단계 1 선행 엔진 PR로 채택** — 렌더러 임의 판정 금지 원칙 |
| 안 0 | path.ts — moveCostFor/terrainAt 재사용 BFS + getMovableTiles 정렬 일치 타이브레이크 | **v0 채택** — 우승안 "경로 트윈"의 경로 출처 미정의 구멍을 정확히 메움. 엔진 path 필드 추가는 장기 제안으로 병기 |
| 안 0 | 큐 드레인 dev 정합 단언 (presented ≡ committed) | **v0 채택** — sync가 드리프트를 덮는 우승안 구조의 안전망 |
| 안 0 | seed+actionLog 기록 + fold ≡ committed 테스트 | **v0 채택** (기록+테스트 1건, 재생 기능은 미구현) — 비용 몇 줄로 v1.5 결정론 기반 고정 |
| 안 2 | movePreview 지연 커밋 (+취소) | **v0 채택** — 심사단 3건 중 2건이 v0 포함 권고. `getAttackableTargets`의 `from` 파라미터 실존(combat.ts:42)으로 비용 낮고, 모바일 오터치 회복과 원작 이동 취소 문법 재현. 우승안의 postMoveMenu(취소 불가)를 교체하되 전이 변경을 국소 격리 |
| 안 2 | 제스처 인식기 순수 분리 (gesture.ts) | **v0 채택** — 우승안 InputAdapter의 테스트 사각지대 제거 |
| 안 2 | 최소줌 타일 ≥24px 클램프 + HUD 56px 엄지 존 | **v0 채택** — 비용 ≈ 0인 정량 오탭 방지 규칙, camera.test 항목 추가 |
| 안 2 | battleEnded 최후 재생 계약 테스트 | **v0 채택** — 현재는 엔진 구조상 자연 보장이나 회귀 방어로 명문화 |
| 안 1 (자체 리스크 승격) | HUD settled 스냅샷 구독 | **설계 본문 승격** — 안 0의 presentedState 이중 부기가 풀던 스포일러 문제를 더 가벼운 방식으로 흡수 |
| 안 2 | 드라이런 데미지 예보 | **UI는 v0.1 후보**, 결정론 회귀 테스트(예보=확정값)만 v0에 차용 |

**합성으로 기각된 것**: 안 0의 presentedState 전면 이중 부기(이벤트별 상태 재현) — settled 스냅샷+dev 단언 조합이 같은 문제를 더 적은 부기 비용으로 해결. 안 2의 ForecastPanel 풀 구현 — v0 YAGNI.