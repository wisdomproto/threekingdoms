# 페이싱 커브 기반 적 배치 생성기 (§11-B) — 설계 (2026-06-15)

> 설계 기준: CLAUDE.md §11(밸런스 자동화 — B 페이싱 생성기 "경로 거리 100% 정규화, 구간별 전력
> 비율 배치 + 자동 조정 루프"), §11-A(리포트 카드·게이트 = 측정 하네스), §2-1/§15(전투 결정론),
> §2-9(원작 재현은 *기존 27*에 한정 — 생성은 신규 콘텐츠).

## 0. 배경 — §11 분해 중 2순위

§11 밸런스 자동화 3서브시스템(A 리포트·게이트 / **B 페이싱 생성기** / C 지형 템플릿) 중 B.
A(구현 완료, `reportCard.ts`)가 측정·분류 하네스를 제공하므로 B의 자동 조정 루프가 성립한다.

## 1. 목적·범위

**신규 스테이지의 적 배치를 자동 생성**(챌린지/2회차/what-if 콘텐츠용). 기존 27스테이지는 §2-9
원작 재현이라 건드리지 않는다. 봇이 기존 스테이지를 이미 다 이기므로 자동 조정의 용처는 *신규 생성*.

- 입력: 생성 레시피(`GenSpec`) — 맵·시작·목표·참조 플레이어 전력·적 풀·페이싱 커브·목표 라벨.
- 출력: 분류가 목표(기본 HEALTHY)에 수렴한 Stage JSON 후보 + 수렴 트레이스.
- **결정론**: 레시피 → 스테이지 1:1(시드 불필요). 리플레이/밸런스 sim 정합(§14, §2-1).

## 2. 적 풀 = 제네릭 아키타입

named 시나리오 장수가 아니라 제네릭 적(`{classId, troops, namePrefix}` + 보스 1). 생성 스테이지는
신규 콘텐츠라 "적병-1" 류 제네릭으로 충분. 풀은 레시피 파라미터(기본 = footman/archer/lightCavalry
mook + 강화 보스). commanderId는 `${namePrefix}-${index}`로 유일화(엔진이 id로 유닛 구분).

## 3. 아키텍처 (`packages/sim/src/gen/`)

### 3.1 `force.ts` — 전력 측정(순수, 엔진 의존)
- `unitForce(ctx, stageUnit): number` — 해당 유닛을 1유닛 ctx로 합성(createBattle)해 UnitState를 얻고
  `attackPower(u) + defensePower(u)` × `troops/100`. balance.ts의 makeUnitState 패턴 재사용.
- `totalForce(ctx, units): number` — 합.

### 3.2 `pacingCurve.ts` — 커브·예산 할당(순수, 엔진 무관)
- `PacingCurve = [percent, cumForcePercent][]` — 기본 `[[20,15],[50,40],[90,100]]`(경로%→누적 전력%).
- `bandBudgets(curve, total): Band[]` — 인접 커브점 차분으로 밴드별 전력 예산 산출.
  `Band = { atPercent, force }`(atPercent = 밴드 중심 경로%, force = 그 밴드 배정 전력).
- 단조 증가·합 = total 보장(마지막 밴드가 잔여 흡수).

### 3.3 `placement.ts` — 경로% 진행 필드 + 타일 질의(순수, 엔진 `pathCostField`)
- `pathPercentField(ctx, goal, spawn, moveClass): Map<"x,y", percent>` — **진행% = spawn(0)→goal(100)**.
  goal 거리장을 *spawn까지 거리*로 정규화(`round((1−cost/costSpawn)×100)`, [0,100] 클램프). 보스 밴드(90%)가
  goal 근처가 되도록 spawn 정규화(구현 중 정밀화 — 종전 "0(goal)~100(최원거리)"는 보스를 spawn 쪽에 둬 부정확).
  spawn 미도달/0거리면 빈 필드.
- `tilesNearPercent(field, atPercent, exclude): Coord[]` — atPercent에 가까운 순(동률은 "x,y" 키 사전순 =
  결정론). 배치 로직은 generator가 이 순서로 적을 채운다(밴드 owns 공간 질의, generator owns 전력 예산).
- 보스는 generator가 goal 타일에 직접 배치(최고 atPercent 밴드).

### 3.4 `generator.ts` — 조립 + 오토튠
- `generate(spec, knob): Stage` — knob(전력 예산 배수) × 참조 플레이어 전력 = 총 적 예산 →
  `bandBudgets` → 밴드별 `placeBand` → 참조 플레이어 유닛 + 적 + objectives(defeatUnit 보스 또는
  reachTile goal) + failConditions + turnLimit 조립.
- `autoTune(spec, target=HEALTHY, knobs): { stage, knob, label, converged, trace }` — **노브 그리드 선형 스캔**:
  - 그리드(기본 `[0.5,0.7,0.9,1.1,1.3,1.6,2.0]`)를 쉬움→어려움 순으로 각 knob에서 `generate` →
    `runMatrixOnStage` → `classify`. target(HEALTHY)에 처음 닿으면 즉시 반환(`converged:true`).
  - 못 닿으면 선호 순위(HEALTHY>EASY>BRITTLE>HARD>IMPASSABLE) 최선 후보를 `converged:false`로 반환(trace 동봉).
  - 이분 대신 선형 — 라벨이 단조롭지 않을 수 있어(BRITTLE 등) 경계 탐색보다 그리드가 robust·결정론적.
- **생성 Stage는 엔진 무가드 배열(events/dialogue/strategyConditions/reinforcements)을 `[]`로 직접 제공** —
  zod 기본값을 우회 생성하므로(findDuelTrigger가 `stage.events.find` 무가드).

### 3.5 러너/리포트 확장 (등록 없이 ad-hoc Stage 실행)
- `runner.ts`: 코어 루프를 `runStage(stage, opts): RunResult`로 분리. `runBattle(id, ...)`는
  `stages[id]` 룩업 후 `runStage` 호출(하위호환 유지).
- `reportCard.ts`: `runMatrixOnStage(stage): MatrixResult` 추가(generate한 Stage를 등록 없이 6셀 분류).
  기존 `runMatrix(id)`는 `stages[id]` → `runMatrixOnStage` 위임.

### 3.6 CLI `src/gen/generate-stage-cli.ts`
- 인자/하드코딩 레시피 → `autoTune` → 스테이지 JSON 파일 후보 출력(`packages/sim/out/` 또는 stdout) +
  수렴 트레이스 + 최종 라벨. **gameData/스테이지 디렉토리에 자동 기록하지 않음**(사람이 검수 후 채택).
- package.json script `generate-stage`.

## 4. 튜닝 파라미터(초기값)
- 기본 커브 `[[20,15],[50,40],[90,100]]`. 노브 탐색 범위 `[0.4, 2.0]`, ITER 8.
- 보스 전력 비중 = 최종 밴드. 참조 플레이어 = 레시피 제공(기본 = 표준 5인 파티 정렙).
- 목표 라벨 HEALTHY. (EASY도 허용 옵션 — 튜토리얼 의도면.)

## 5. 비범위(후속)
- 이벤트 트리거 경로%/턴 바인딩(증원·화공) — B2. v1 B는 적 *배치*만.
- 지형 문법 템플릿(맵 타입 생성) — §11-C 별도.
- 다목적 풀(스킬·아이템 적) — 기본 제네릭만. 풀 확장은 레시피로.
- 생성 스테이지의 dialogue/camera/reward 자동 작성 — 최소 stub만(사람 보강).

## 6. 테스트
- `pacingCurve`: 밴드 예산 단조·합=total·차분 정확.
- `force`: unitForce가 level·troops에 단조 증가.
- `placement`: 배치가 통행가능·비중복·非goal·非player, 보스 고경로%, 밴드 전력≈예산.
- `generator`: `generate` 결정론(동일 레시피·knob → 동일 스테이지), `autoTune`가 실맵에서 HEALTHY
  수렴(또는 미수렴 보고). `runStage`/`runMatrixOnStage` 등록 없이 동작.
- 핀 vitest(`pnpm -r test`)로 — npx v4 주의(메모리 기록).

## 7. 결정론·정합 점검
- 생성·측정·오토튠 전부 결정적 → 게이트·리플레이·리더보드 정합(§14).
- 적 풀 제네릭 → 원작 재현(§2-9) 불침범. 생성물은 사람 검수 후 채택(자동 커밋 없음).
- A 하네스(`classify`) 재사용 → B가 A의 라벨 정의를 단일 출처로 공유(중복 임계 없음).
