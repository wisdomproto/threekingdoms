# 기연(奇緣) 시스템 — 설계 (2026-06-15)

> 설계 기준 문서: CLAUDE.md §12(도파민 — 기연 시스템), §2-5(랜덤은 재미로·전투력은 실력으로),
> §10(보물·도감), §11(노가다 방지), §13(광고 — 기연 2배/+1회), §15(v1 범위·금지목록).

## 1. 목표

클리어로 쌓인 **콤보 골드·필살·보물**의 도파민이 "출구"를 갖도록, §12 기연 시스템을
신규 구현한다. 클리어 시 **기연 포인트**를 적립하고, 막간의 전용 화면에서 텍스트 연출과
함께 뽑아 보상(자금/소모품/기연 전용 경미 보물)을 얻는다. 천장 포함.

## 2. 범위 결정 (확정)

- **기연 시스템 신규** 구현이 무게중심. 결산 폴리시는 이미 충분(별·상자·코인·exp·잭팟·2배 광고).
- **보물 처리 = 기연 전용 경미 보물만.** §10 스테이지 고유·도감 보물은 기연 풀에서 **제외**
  (도감 2회차 동력·스테이지 설계·밸런스 sim 불침범). 기연 전용 보물은 약한 고정효과 2~3종,
  `qiyuan-*` id 네임스페이스로 분리해 도감 목록에 섞이지 않게 한다.
- **스킨 조각·소재(제작)** = v1에 시스템 부재(§15 스킨 가챠 본격운영 제외) → 기연 풀에서 제외.
- 풀 공통: **자금 + 소모품(`attackItem`/`supplyItem`)** + (rare)**기연 전용 경미 보물**.

## 3. 결정론·가드레일 점검

- 기연 RNG는 **전투 밖 메타**라 리플레이/리더보드/밸런스 sim과 무관(§14 "전투 연산만 결정론").
  → "랜덤은 재미로"(§2-5)에 정확히 부합. §15 전투 RNG 금지와 충돌 없음.
- 경미 보물만 → 도감·스테이지 설계·밸런스 sim 불침범.
- **재도전 적립 최소화** → 파밍 루트 차단(§11 노가다 없음).
- 뽑기 무작위는 **순수 함수에 roll 주입** 방식 — 화면이 `Math.random()`을 넘기고, 로직은
  결정적·테스트 가능(resultSummary 패턴 동일). 천장 카운터는 메타에 영속.

## 4. 아키텍처

### 4.1 데이터 (`packages/data`)
- `json/items.json`에 **기연 전용 경미 보물 3종** 추가. `category:"treasure"`, id `qiyuan-*`,
  약한 고정 `effects`(예: `defensePercent:5` / `move:1` / `spiritPercent:5`).
- `Codex.tsx`는 스테이지 `reward.treasures`만 나열하므로 기연 보물은 도감에 안 섞인다(검증).

### 4.2 순수 로직 (`apps/web/src/meta/serendipity.ts`)
- `SerendipityReward` = `{ kind:"gold"; amount:number } | { kind:"item"; itemId:string }`.
- 풀은 성격이 달라 **둘로 분리**: `SERENDIPITY_COMMON`(가중 엔트리 — 자금 소·중·대 + 소모품) +
  `SERENDIPITY_RARE`(기연 전용 보물 풀, 천장/자연 rare에서 균등 추첨).
- `PULL_COST = 3`, `PITY_CAP = 10`, `RARE_CHANCE = 0.08`.
- `weightedPick<T>(entries, roll)` — 가중 추첨(순수, 상한 클램프). common/rare/flavor가 공유.
- `rollSerendipity(pity:number, rng:() => number): { reward, nextPity, wasRare }` **순수**.
  - 무작위원은 **rng 함수 주입**(단일 roll이 아님 — rare 게이트·풀 선택이 독립 draw라 2회 소비).
    화면이 `Math.random`을, 테스트가 스크립트 rng를 주입 → 결정적·테스트 가능.
  - `pity+1 >= PITY_CAP`(천장) 또는 `rng() < RARE_CHANCE` → rare(기연 보물) 산출, `nextPity=0`.
  - 아니면 common 가중 추첨, `nextPity=pity+1`.
- `FLAVOR_LINES: string[]` — "이야기처럼" 포장용 **창작 한국어** 텍스트(코에이 무관).
  `pickFlavor(roll)`로 선택(순수).
- `clearReward(grade, firstClear): number` — 클리어 적립 포인트(S5/A4/B3/C2, 재도전=1).
- `isSerendipityTreasure(itemId)` — `qiyuan-*` 판정(§10 도감 분리에 Codex가 사용).

### 4.3 메타 (`metaStore.ts`)
- `MetaState`에 `serendipity:number`, `serendipityPity:number` 추가. 로드 마이그레이션(누락=0).
- 순수 reducer:
  - `reduceAddSerendipity(s, n)` — 포인트 가산(floor·clamp).
  - `reducePull(s)` → `MetaState | null` — `PULL_COST` 차감(부족 시 null). **보상 적용은 안 함**
    (호출부가 roll 결과로 addGold/addItem + pity 갱신). pity 자체는 `setPity` reducer로 반영.
  - 또는 단일 `reduceApplyPull(s, result)` — cost 차감 + pity 갱신을 한 번에(보상 골드/아이템은
    기존 reduceAddGold/reduceAddItem 재사용). → **이 방식 채택**(원자적, 테스트 단순).
- 공개 API: `getSerendipity()`, `getSerendipityPity()`, `addSerendipity(n)`,
  `pullSerendipity(roll)` → `{ reward, wasRare } | null`(포인트 부족 시 null).
  `pullSerendipity`가 내부에서 load→roll 적용→save까지(화면은 roll만 주입).

### 4.4 적립 (결산 통합, `ResultSequence.tsx`)
- 메타-커밋부(승리 1회)에서 `addSerendipity(clearReward(grade, firstClear))`.
  - `firstClear` = `markCleared` 이전 `clearedStages.includes(stageId)` 여부로 판정.
- 결산 패널에 **"기연 포인트 +N"** 한 줄(자금 줄 근처, EXP 스텝과 함께 공개).
- `result_double` 광고 콜백(`onDoubleReward`)에서 **기연 포인트도 baseline만큼 추가**(총 2배).
  표시도 +N → +2N로 갱신(§13 "골드·기연P 2배").

### 4.5 화면 (`/serendipity`)
- `apps/web/app/serendipity/page.tsx` + `apps/web/src/meta/screens/SerendipityScreen.tsx`.
- 상단: 보유 기연 포인트, 천장까지 N회. `StageSelect`·`Shop` 톤(수묵/청동 프레임) 재사용.
- 「기연 (3 포인트)」 버튼 → `Math.random()`을 `pullSerendipity`에 주입 →
  연출: 플레이버 1줄 페이드인 → 보상 카드 reveal(보물=잭팟 톤, ResultSequence 키프레임 재사용).
  반영 후 포인트/천장 갱신. 포인트 < `PULL_COST`면 비활성 + "전장에서 기연을 쌓으세요" 안내.
- `StageSelect` 헤더에 「기연」 링크(보물 도감 옆).

### 4.6 테스트
- `serendipity.test.ts` — `rollSerendipity` 가중·천장 경계(pity 도달 시 rare 확정), `clearReward`
  (등급·첫/재도전), 플레이버 선택 결정성.
- `metaStore.test.ts` 확장 — `reduceAddSerendipity`, `reduceApplyPull`(차감·pity·부족 null),
  마이그레이션(누락 필드 0).
- `resultSummary`/결산 적립 — 첫 클리어 vs 재도전 포인트, 2배 경로(가능한 범위에서).

## 5. 튜닝 파라미터(초기값, 추후 sim/플레이 조정)
- `PULL_COST = 3`, `PITY_CAP = 10`.
- 클리어 적립: S5 / A4 / B3 / C2, 재도전 1.
- 자금 버킷: 소 30G / 중 80G(가중 common). 소모품: items.json 소모품 풀에서 가중.
- rare(기연 보물) 기본 확률 ≈ 8%, 천장 10회.

## 6. 비범위(후속)
- §13 리워드 광고 "기연 뽑기 +1회" 실연동 — 훅 자리만 남기고 본격은 광고 SDK 검증 단계에서.
- 스킨 조각/소재 풀 — 스킨/제작 시스템 생기면 풀에 가산.
- 10연차·연출 고도화·기연 히스토리 갤러리 — YAGNI, 추후.

## 7. 영속 호환
- `tk.meta.v1` JSON에 두 필드 추가. 구버전 로드 시 누락 → 0(파괴적 마이그레이션 없음).
- gold는 기존 legacy mirror 유지. 기연 포인트는 legacy 미러 불필요(신규 필드).
