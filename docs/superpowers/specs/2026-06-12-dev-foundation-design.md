# 개발 준비 (Dev Foundation) 설계 문서

- 날짜: 2026-06-12
- 상태: 승인됨
- 상위 문서: 루트 `CLAUDE.md` (기획 문서 v1.0) — 본 설계는 그 첫 마일스톤 "1스테이지 수직 완성"의 첫 서브 프로젝트다.

## 목적

그린필드 상태(코드 0줄)에서 첫 마일스톤을 향한 토대를 만든다. 두 트랙 병행:

1. **코드 트랙**: 모노레포 + 헤드리스 전투 엔진 코어 + 데이터 스키마 + 시뮬레이션 러너 골격
2. **에셋 트랙**: 길중이 Gemini/Seedance로 직접 실행할 수 있는 생성 가이드 문서 (도구 현황: Gemini 보유, Seedance 보유, Spine 라이선스 미보유)

수직 완성 대상 스테이지: **사수관** (5번 스테이지 — 관문 돌파 + 관우 vs 화웅 일기토 데뷔). 호로관 대비 구성이 단순해 첫 수직 완성에 적합하고, 관우가 에셋 검증 1순위 대상이라 재활용된다.

## 범위

### 포함

1. **모노레포 스캐폴딩** — pnpm workspaces + TypeScript + vitest. `apps/web`은 Next.js 빈 골격만
2. **`packages/engine` v0** — 사각 그리드, 이동, 병종 상성, 턴 시스템, 공격/반격/데미지, 스테이지 이벤트 트리거 골격(일기토 발동 포함). 순수 함수, 렌더링 의존성 제로
3. **`packages/data`** — zod 스키마(병종/장수/스테이지/전투계수) + 사수관 스테이지 데이터 + 등장 유닛 데이터
4. **`packages/sim`** — CLI 시뮬레이션 러너: 그리디 AI 정책으로 자동 플레이 N판 → 승률/평균 턴 리포트
5. **에셋 가이드 문서** — `docs/asset-pipeline/` 3종 (레퍼런스 시트 / 일기토 영상 테스트 / Spine 셋업)

### 제외 (다음 서브 프로젝트)

PixiJS 렌더링, Spine 런타임, 책략/MP 시스템, 경험치/레벨업, 장비/상점, 결산 연출, Supabase 연동, 실제 에셋 생성 실행

## 아키텍처

```
threekingdoms/
├── packages/
│   ├── engine/   # 순수 TS. data의 타입만 import. 결정론적(시드 RNG)
│   ├── data/     # zod 스키마 + JSON. 의존성 제로
│   └── sim/      # engine + data 사용. Node CLI
├── apps/
│   └── web/      # Next.js (이번엔 빈 골격)
└── docs/
    └── asset-pipeline/
```

### 구조에 박는 핵심 원칙

- **결정론**: 엔진의 모든 랜덤은 시드 RNG 주입. 같은 시드 + 같은 액션 시퀀스 = 같은 결과. v1.5 리플레이(턴 로그 JSON 재생)와 시뮬레이션 재현성의 전제조건.
- **상태 = 데이터**: 전투 상태는 직렬화 가능한 plain object. 액션 적용 → 새 상태 + 이벤트 목록 반환. 렌더러는 이벤트 목록을 연출로 번역만 한다.
- **데이터-코드 분리**: 상성 테이블, 데미지 계수, 스테이지 정의 전부 JSON. 코드 하드코딩 금지 (CLAUDE.md §11).

## 엔진 코어 (`packages/engine`)

### 핵심 타입

- `BattleState` — 턴 번호, 현재 페이즈(아군/적), 유닛 목록(위치/HP/MP/사기/행동완료), 맵 참조, RNG 상태
- `Action` — `Move | Attack | Wait` (책략은 타입 자리만 확보, v0 미구현)
- `BattleEvent` — `UnitMoved | DamageDealt | UnitRetreated | DuelTriggered | StageEventFired | VictoryAchieved` 등. 렌더러/시뮬레이터가 소비하는 연출·로그 단위

### 핵심 함수 (전부 순수 함수)

- `getMovableTiles(state, unitId)` — 이동력 + 지형 비용 기반 도달 가능 타일 (다익스트라)
- `getAttackableTargets(state, unitId, from)` — 사거리(근접 1 / 궁병 2) 내 적
- `applyAction(state, action) → { nextState, events }` — 유일한 상태 변경 진입점
- `runEnemyPhase(state, policy) → { nextState, events }` — 적 AI도 동일 액션 인터페이스 사용

### 전투 룰 (영걸전 문법, 원작 보수주의)

- 데미지 = 공격력·방어력·병종 상성·지형 보정·레벨 차 기반. 계수는 `combat.json`에 분리, 시뮬레이션으로 튜닝
- 상성: 기병 > 보병 > 궁병 > 기병 — 데이터의 상성 테이블 참조
- 반격: 사거리 내 생존 시 자동 반격. 궁병의 간접 공격은 무반격
- 사망 없음: HP 0 = 퇴각 이벤트 (CLAUDE.md §10 사망 룰)
- 스테이지 이벤트: 트리거 조건(예: 관우가 화웅을 공격)을 스테이지 데이터로 선언. 엔진은 조건 평가 + `DuelTriggered` 이벤트 발행만. 스토리 일기토 결과는 스크립트 고정이므로 연출·결과 적용은 트리거 정의에 따름

## 데이터 (`packages/data`)

- zod 스키마 → TypeScript 타입 자동 도출 (`z.infer`). 스키마가 곧 문서
- `unitClasses.json` — 사수관 등장 병종 우선 (기병/보병/궁병/책사/도사/풍수사 + 적 도적계 등 6~7종)
- `commanders.json` — 유비/관우/장비/간옹/미축 + 화웅/적 네임드
- `stages/05-sishuiguan.json` — 지형 그리드, 초기 배치, 승리/패배 조건, 이벤트 트리거(화웅 일기토)
- `combat.json` — 데미지 공식 계수 (시뮬 튜닝 루프의 손잡이)

## 시뮬레이션 (`packages/sim`)

- 실행: `pnpm sim --stage 05 --runs 200 --seed 42`
- v0 AI 정책: 그리디 (가장 가까운/상성 유리 대상에게 이동+공격). 양 진영 모두 정책 플레이
- 리포트: 승률, 평균 턴, 평균 퇴각 수, 유닛별 피해 기여
- CLAUDE.md §11 "AI 자동 플레이 시뮬레이션 → 목표치 수렴 루프"의 골격

## 에셋 가이드 (`docs/asset-pipeline/`)

- `01-character-reference-sheet.md` — 관우 레퍼런스 시트: Gemini 프롬프트 템플릿(전신 3뷰 + 청룡언월도 + 표정 2~3종), 일관성 유지 워크플로, 산출물 보관 규칙(프롬프트를 에셋 옆에 커밋 — 재생성 가능 원칙)
- `02-duel-video-test.md` — Seedance I2V 테스트: 시트 → 일기토 클립 프롬프트, 평가 기준(Spine vs 영상 하이브리드 비율 판정 기준)
- `03-spine-setup.md` — Spine 라이선스 종류/가격/구매 가이드, 병종 골격 규격화 방침

## 테스트 전략

- 엔진: vitest 단위 테스트, TDD. 이동 범위 / 상성 데미지 / 반격 / 턴 전환 / 퇴각 / 이벤트 트리거 각각
- 데이터: zod 스키마 검증 테스트 — 잘못된 스테이지 JSON이 테스트에서 잡히게
- 시뮬: 고정 시드 스모크 테스트 — 같은 시드 = 같은 결과 (결정론 회귀 방지)

## 결정 기록

| 결정 | 선택 | 이유 |
|---|---|---|
| 첫 서브 프로젝트 | 코드 + 에셋 가이드 병행 | 엔진은 Claude 담당, 에셋 도구 실행은 길중 담당 — 분담 원칙(CLAUDE.md §16) |
| 수직 완성 스테이지 | 사수관 | 호로관보다 구성 단순(일기토 1개, 일반 맵), 관우 재활용 |
| 코드 구조 | 모노레포 + 헤드리스 엔진 | 시뮬 파이프라인·데이터-코드 분리가 구조로 강제됨 |
| 에셋 도구 현황 | Gemini O, Seedance O, Spine X | Spine 가이드에 라이선스 구매 정보 포함 |
