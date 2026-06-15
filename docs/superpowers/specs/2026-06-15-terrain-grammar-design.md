# 지형 문법 템플릿 (§11-C) — 설계 (2026-06-15)

> 설계 기준: CLAUDE.md §11(밸런스 자동화 — C 지형 문법 "맵 타입 + 파라미터로 변형 생성, 완전 랜덤
> 지형 금지"), §11-A(리포트·게이트)·§11-B(페이싱 생성기), §3-1(격자=진실의 원천), §2-1(결정론).

## 0. 배경 — §11 분해의 마지막 3순위

§11 밸런스 자동화 3서브시스템(A 리포트·게이트 ✅ / B 페이싱 생성기 ✅ / **C 지형 템플릿**) 중 C.
A·B 완료. C는 아키타입+파라미터로 **BattleMap 격자를 결정론 생성**하고, B가 적을 얹고 A가 검증한다.
v1-C는 **C→B→A 풀 합성**까지 포함(생성 지형→적 배치→밸런스 라벨 한 흐름).

## 1. 아키타입 3종 (핵심 — 각 결정론 레이아웃 함수)

아키타입 = 지형 격자의 *전술적 성격*. 각자 `(params) => { grid, spawn, goal }`.
1. **gateBreakthrough(관문돌파)** — 수직 성벽 `#` 라인 + 폭 `chokeWidth` 성문 `G` 병목. spawn=좌, goal=벽 너머 우.
2. **pincerDefense(협공방어)** — 개방 평지/초원 + 산발 forest 엄폐(중앙은 비움). spawn=중앙, goal=가장자리 중점.
3. **escapeCorridor(탈출)** — 절벽(`c`)으로 채운 뒤 시작→먼 출구로 굽은 통로 carve(폭 `corridorWidth`, serpentine). spawn=한쪽 끝, goal=반대 끝. (하천+다리 병목은 `grid.hRiver` 프리미티브로 후속 — carve 교차점 정합 필요해 v1은 통로 폭만으로 병목.)

"완전 랜덤 금지": 레이아웃은 문법(벽/병목/통로)으로 결정. 변형은 **시드 PRNG**로 엄폐 산포 등만 — 재현 가능,
문법 제약 내. tileLegend는 표준 14지형 재사용.

## 2. 아키텍처 (`packages/sim/src/gen/terrain/`)

### 2.1 `grid.ts` — 격자 프리미티브(순수, 시드 rng 주입)
- `TileGrid = { width, height, cells: string[][] }`.
- `createGrid(w,h,fill)`, `setTile`, `fillRect(g,x0,y0,x1,y1,ch)`, `vWall(g,x,ch,gapY0,gapY1,gapCh)`,
  `hRiver(g,y,ch,bridgeX,bridgeCh)`, `scatter(g,ch,density,rng,mask?)`, `carvePath(g,waypoints,width,ch)`.
- `mulberry32(seed)` — 결정론 PRNG(scatter용). `toBattleMap(g, legend, id, name): BattleMap`(행 문자열화).

### 2.2 `archetypes.ts` — 3 레이아웃
- 공통 파라미터 `{ width, height, seed }` + 아키타입별(`chokeWidth`/`coverDensity`/`corridorWidth`).
- 각 함수 → `{ grid: TileGrid, spawn: Coord, goal: Coord }`. 결정론(seed 고정 시 동일).

### 2.3 `mapGen.ts` — 디스패치 + 연결성 검증
- `ARCHETYPES: Record<name, (params)=>{grid,spawn,goal}>`.
- `generateMap(archetype, params): { map: BattleMap, spawn, goal }` — 레이아웃 → BattleMap 조립 →
  **연결성 검증**: `pathCostField(ctx, goal, "foot")`로 spawn 도달 가능 확인. 불통이면 throw
  (생성 단계에서 A의 IMPASSABLE 데이터버그 예방). ctx는 gameData(terrains) + 생성 맵으로 합성.
- `renderAscii(map): string` — 격자 텍스트 프리뷰(격자가 곧 텍스트라 별도 시각화 불필요).

### 2.4 C→B→A 합성 — `RunOpts.mapOverride` 스레딩(1줄씩)
- `runner.ts`: `RunOpts.mapOverride?: BattleMap`. `runStage`가 `opts.mapOverride ?? gameData.maps[s.mapId]`.
- `reportCard.ts`: `runMatrixOnStage(stage, mapOverride?)` — 각 셀 runStage에 override 전달. `runMatrix(id)` 무변.
- `generator.ts`: `GenSpec.map?: BattleMap`(있으면 mapId 룩업 대신 사용). `generate`가 ctx·stage.mapId를
  그 맵으로, `autoTune`이 `runMatrixOnStage(stage, spec.map)`로 override 전달. spec.map 없으면 기존 동작(하위호환).

### 2.5 CLI `src/gen/terrain/generate-map-cli.ts`
- 아키타입+파라미터 → ASCII 프리뷰 + 맵 JSON(packages/sim/out/, gitignore). **+ C→B→A 데모**:
  생성 맵으로 B `GenSpec`(spec.map=생성맵, spawn/goal, 기본 플레이어 파티·적 풀) 구성 → `autoTune` →
  수렴 라벨·트레이스 출력. 한 커맨드로 지형→적→밸런스 확인. package.json script `generate-map`.

## 3. 테스트
- `grid`: 프리미티브(fillRect·vWall gap·scatter 밀도·carvePath 연결)·`mulberry32` 결정론·`toBattleMap` 행 길이.
- `archetypes`: 각 아키타입 치수·핵심 피처(gate 셀 존재·corridor 연결·중앙 개방)·시드 변형 결정론.
- `mapGen`: `generateMap` 연결성(정상 통과 / 병목 0이면 throw)·BattleMap 스키마 정합(행=height·열=width).
- 합성: `runStage`/`runMatrixOnStage`가 mapOverride로 미등록 맵 실행, `autoTune(spec with map)` 수렴.
- 핀 vitest(`pnpm -r test`).

## 4. 비범위(후속)
- painted 배경 생성(§3-1 Gemini img2img) — C는 격자만(B가 JSON만 내듯). 아트는 다운스트림.
- 화공 이벤트 아키타입(불 확산) — forest 밀도 파라미터로 흄내만, 불 시스템은 별도.
- 이벤트/증원 경로%·턴 바인딩(§11-B2), objectives 타입 자동 선택(협공=survive 등) — 후속.
- 생성 맵 자동 등록(gameData 영속) — 사람 검수 후 maps/에 채택. CLI는 out/에만.

## 5. 결정론·정합 점검
- 격자 생성·검증·합성 전부 결정론(시드 고정 시 재현 100%) → 리플레이/밸런스/게이트 정합(§14, §2-1).
- 연결성 검증으로 "도달 불가" 생성 차단 → A의 IMPASSABLE을 생성 단계에서 예방.
- mapOverride는 옵션(미지정 시 기존 gameData 룩업) — A 게이트·기존 sim 무영향(하위호환).
