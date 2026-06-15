# 밸런스 리포트 카드 + 회귀 게이트 (§11-A) — 설계 (2026-06-15)

> 설계 기준: CLAUDE.md §11(밸런스 자동화 파이프라인 — "AI 자동 플레이 시뮬레이션 → 승률/평균턴/사망
> 리포트", "승률 90%+·진행 불가 구간 제로"), §2-1/§15(전투 결정론), §2-3(캐주얼 우선·S랭크 분리).

## 0. 배경 — §11 분해 중 1순위

§11 밸런스 자동화는 독립 서브시스템 3개(A 리포트·게이트 / B 페이싱 생성기 / C 지형 템플릿).
**A부터** — 측정·게이트 없이 B/C 생성기를 만들면 신뢰 불가. B/C는 각자 스펙.

## 1. 핵심 전환 — 결정론이라 시드 변주는 무의미

엔진은 무분산 결정론(§2-1). 같은 스테이지·같은 정책·같은 편성이면 **시드와 무관하게 결과 1개**.
따라서 §11의 "승률 90%+"라는 *분포* 개념은 시드로 안 나온다. 분포를 만드는 축은 **플레이 조건**:
**{정책 실력 티어} × {플레이어 레벨 오프셋}** 매트릭스가 시드 루프를 대체한다.

- 스테이지당 셀 = 2 티어 × 3 오프셋 = 6. 전체 27 × 6 = **162 결정적 런**(빠름).
- "승률"의 재해석 = *그럴듯한 플레이 조건 중 승리 비율*. 게이트는 핵심 셀의 승/패로 판정.

## 2. 매트릭스 축

### 2.1 정책 실력 2티어
- `greedy` — 현 `chooseAction`(협공/돌격/최적표적 탐색). = **숙련 플레이어** 하한.
- `naive` — 가장 가까운 도달 가능 적을 그냥 공격(표적·협공 최적화 없음, 퇴각위험 회피 없음).
  = **캐주얼 플레이어** 근사. 도달 가능 적 없으면 턴 종료.
- 정책 인터페이스 = `(ctx, state) => Action | null`. 티어 교체로 sim 결합도 낮춤.

### 2.2 레벨 오프셋 3단
- `−2 / 0 / +2`. **0 = 스테이지 JSON 작성값 = 정준 밸런스**(별도 레벨 공식 불필요 — 작성값이 진실).
- 적용 = stage 사본에서 **플레이어 유닛 `level`만** `clamp(level+offset, 1, 99)`. 적·엔진·createBattle 무수정
  (BattleScreen.applySortie 패턴과 동형). 적 레벨/배치 불변.

## 3. 스테이지별 분류 (6셀 → 1 라벨)

우선순위 순(위가 먼저 매칭). g0=정렙 숙련(정준 베이스라인), g2=+2 고렙 숙련:
- **IMPASSABLE**: `g0`·`g2` **둘 다** 패 → 숙련이 정렙·고렙 다 못 깸 = 진짜 데이터 버그. **게이트 하드 실패.**
- **BRITTLE**(구현 중 발견): `g0` 승·`g2` 패 → **비단조**(+2가 그리디 봇 결정을 교란해 진다). 사람은 +2면
  더 쉬우므로 *봇 아티팩트*지 데이터 불가가 아님 → **게이트 비차단**, 사람 검토 플래그. 그리디 정책의
  myopic 한계 신호(17 여남이 실제 사례 — g0 승18/3퇴각, g±2 패). "취약 오라클"(메모리 기록)의 자동 표면화.
- **HARD**: `g0` 패(단 `g2` 승) → 오버레벨 필요. 플래그(보스/후반 의도 가능 — 사람 판단).
- **EASY**: `g0`·`g2` 승 + `naive@−2`가 저턴(≤ EASY_TURNS)·무퇴각 승 → 너무 쉬움. 플래그.
- **HEALTHY**: 그 외(= `g0`·`g2` 승, trivial 아님).

부가 신호(라벨과 별개 컬럼, 게이트 아님 — 사람 튜닝 참고):
- `harsh`: `greedy@0` 퇴각 ≥ RETREAT_FLAG.
- `slow`: `greedy@0` 턴 > turnLimit × SLOW_RATIO.

## 4. 회귀 게이트 (`packages/sim/test/reportCard.test.ts`, vitest)

- **하드 1 (베이스라인 회귀)**: 전 스테이지 `greedy@0` = victory(timeout 아님).
  → 게임성 격상·데이터 변경이 어떤 스테이지를 깨면 **자동 실패**. (A의 핵심 가치, 현재 27/27)
- **하드 2 (진짜 불가 제로)**: IMPASSABLE 라벨 스테이지 없음(= g0·g2 둘 다 패인 곳 없음).
- **BRITTLE는 비차단**: `g0` 승·`g2` 패는 봇 비단조 아티팩트라 하드 실패시키지 않는다(`greedy@+2` 승을
  하드 조건으로 걸면 17 여남이 봇 한계로 빨갛게 떠 게이트가 의미를 잃는다). 스냅샷이 추적만.
- **스냅샷 (드리프트)**: 스테이지별 분류 라벨 맵을 **테스트 내 상수**(`BASELINE_LABELS`)와 대조.
  불일치 = 실패. 의도적 변경이면 상수 1줄 갱신(report-card CLI 출력 복붙) — diff가 PR에 그대로 보이게.

## 5. 산출물 (전부 `packages/sim`)

- `src/policy.ts` — `naivePolicy(ctx, state)` 추가. 기존 `chooseAction`은 `greedyPolicy` 별칭 노출.
  `Policy` 타입 export.
- `src/runner.ts` — `runBattle(stageId, seedOrOpts)` 확장. 옵션 `{ policy?, levelOffset?, maxTurns? }`.
  **하위호환**: 기존 `runBattle(id, seed)` 시그니처 유지(두번째 인자가 number면 seed). 레벨 오프셋은
  stage 사본 변환 헬퍼 `withLevelOffset(stage, offset)`(순수).
- `src/reportCard.ts`(신규) — 순수 빌더:
  - `runMatrix(stageId): MatrixResult`(6셀) · `classify(matrix): Label` · `buildReportCard(): { rows, markdown, summary }`.
  - md 표: 스테이지 | 분류 | greedy@−2/0/+2 (승패·턴·퇴각) | naive@−2/0/+2 | 부가신호.
- `src/report-card-cli.ts`(신규) — 실행 시 `docs/reference/balance-report.md` 생성 + 콘솔 요약(라벨 카운트).
  package.json script `report-card` 추가.
- `test/reportCard.test.ts`(신규) — §4 게이트 + `classify`/`withLevelOffset` 단위테스트.

## 6. 튜닝 파라미터(초기값, reportCard.ts 상수)
- `LEVEL_OFFSETS = [-2, 0, 2]`, 정책 = `[greedy, naive]`.
- `EASY_TURNS = 4`(naive@−2가 4턴 이내 무퇴각 승이면 trivial).
- `RETREAT_FLAG = 3`(greedy@0 퇴각 3+ = harsh).
- `SLOW_RATIO = 1.0`(greedy@0 턴 > turnLimit이면 slow — 사실상 cap 근접 경고).

## 7. 비범위(후속)
- 정책 3티어 이상·MCTS·완전 최적 봇 — YAGNI. 2티어로 플레이어 폭 브래킷.
- 편성/장비 변주(다른 파티 comp) — 후속(A2). v1 A는 스테이지 작성 편성 기준.
- 자동 조정 루프(수치 자동 수렴) — §11-B(생성기)에 묶임. A는 측정·게이트만.
- 리더보드/리플레이(§14)·페이싱 생성(§11-B)·지형 템플릿(§11-C) — 별도.

## 8. 결정론·정합 점검
- 매트릭스 각 셀 1런(시드 불필요) — 엔진 무분산이라 재현 100%. 게이트도 결정적(플래키 없음).
- 봇 승률은 *플레이어 실력 하한*(greedy) ~ *캐주얼 근사*(naive). "전투력은 실력으로"(§2-5)와 정합 —
  밸런스는 봇으로 측정하되 게이트는 "숙련자가 정렙에 깰 수 있는가"를 보증.
- 테스트는 핀 vitest로(`pnpm -r test`) — npx v4 트랜스폼 오탐 주의(메모리 기록됨).
