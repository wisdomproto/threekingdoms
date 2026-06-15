# 시드 고정 RNG 기반 (Phase A) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 전투 모델을 "결정론 전용"에서 "시드 고정 확률"로 전환할 토대를 깐다 — 정책 문서(CLAUDE.md) 개정 + RNG 소비 계약 확립 + 재현성 가드. **엔진 동작은 불변**(아직 RNG 소비처 0).

**Architecture:** 레일은 대부분 기존재(`packages/engine/src/rng.ts`의 순수 `nextRandom(state)`, `BattleState.rngState`, `createBattle(ctx, seed)`, `RunOpts.seed`). 이 Phase는 새 코드를 거의 안 짜고, ① SSOT(CLAUDE.md)를 시드확률 모델로 개정 ② 재현성 가드 테스트로 "같은 (시드,행동열)→같은 state" 계약을 못박음 ③ 주석으로 "롤은 이벤트에 실어 프레젠터 정합" 계약을 명시(Phase B 함정 예방).

**Tech Stack:** TypeScript, pnpm 모노레포(@tk/engine), vitest(핀 2.1 — `pnpm --filter @tk/engine exec vitest run`).

**Spec:** docs/superpowers/specs/2026-06-16-seeded-rng-foundation-design.md
**Reference:** docs/reference/yeonggeoljeon-rifine-combat.md

---

## 파일 구조

| 파일 | 책임 | 이 Phase의 변경 |
|---|---|---|
| `CLAUDE.md` | 프로젝트 SSOT | §15/§2-1/§2-5/§11/§13/§7 시드확률 모델로 개정 (Task 1) |
| `packages/engine/test/reproducibility.test.ts` (신규) | 시드 재현성 가드 | Task 2 |
| `packages/engine/src/rng.ts` | 순수 PRNG | 소비 계약 주석 추가 (Task 3) |
| `packages/engine/src/createBattle.ts` | 전투 초기화 | `rngState` 주석을 "시드확률 활성"으로 갱신 (Task 3) |
| `packages/engine/src/types.ts` | `BattleState.rngState` 주석 | 동상 (Task 3) |

---

## Task 1: CLAUDE.md SSOT 개정 (docs-first)

**Files:**
- Modify: `CLAUDE.md` (§15, §2-1, §2-5, §11, §13, §7 — 6개 지점)

> 코드 아님. 각 지점의 **현재 문구(anchor)** 를 찾아 **새 문구**로 교체. 정확히 한 번만 등장하는 문자열이라 Edit 도구로 안전.

- [ ] **Step 1: §15 금지 목록 — 전투 RNG 항목 개정**

찾기:
```
풀 3D 전환(생성 파이프라인 성립 전까지) / 코에이 에셋·명칭·스타일 모방 / **전투 RNG(치명타·명중%·데미지 분산) — 결정론 유지**(밸런스 시뮬·리더보드·"전투력은 실력으로" 기둥, 2026-06-15 §2-1)
```
교체:
```
풀 3D 전환(생성 파이프라인 성립 전까지) / 코에이 에셋·명칭·스타일 모방 / **순수(언시드) 전투 RNG·세이브스컴 — 금지. 전투 확률은 시드 고정만 허용**(같은 상태=같은 롤 → 리플레이/리더보드/밸런스 sim 보존. 2026-06-16 §2-1 전환, 이식 카탈로그 docs/reference/yeonggeoljeon-rifine-combat.md)
```

- [ ] **Step 2: §2 철학 1번(§2-1) 결정론 문장 개정**

찾기:
```
   - **단, 격상은 전부 결정론(RNG 없음).** 손맛 "대박"은 *확정* 이벤트(상성/협공/약점 적중)에 잭팟 연출을 얹어 만든다. 치명타·명중%·데미지 분산 같은 전투 RNG는 금지 — 밸런스 자동 시뮬(§11)·리더보드/리플레이(§14)·"전투력은 실력으로"(§2-5)가 결정론 위에 서 있기 때문. (§15 금지목록 명문화)
```
교체:
```
   - **격상은 시드 고정 확률 + 확정 이벤트 혼합.** (2026-06-16 전환 — 종전 "전부 결정론·RNG 없음"을 대체.) 손맛 "대박"은 *확정* 이벤트(상성/협공/약점)와 *시드확률* 이벤트(명중/회피·상태이상·회심) 양쪽으로 만든다. 단 **순수 랜덤은 금지 — 전투 확률은 전부 (게임상태+시드)로 고정**(세이브스컴 불가, 영걸전 리파인 2.3.3 선례). 시드를 기록하므로 밸런스 자동 시뮬(§11, N시드 분포)·리더보드/리플레이(§14, 시드 재현)·"기댓값 실력으로"(§2-5)가 그 위에 선다. (§15 명문화, 이식=docs/reference/yeonggeoljeon-rifine-combat.md)
```

- [ ] **Step 3: §2 철학 5번(§2-5) 개정**

찾기:
```
5. **랜덤은 재미로, 돈은 확정으로, 전투력은 실력으로.** (BM 절 참조)
```
교체:
```
5. **랜덤은 재미로, 돈은 확정으로, 전투력은 *기댓값* 실력으로.** (2026-06-16 시드확률 전환 — 한 판엔 운이 섞이되 시드 고정이라 리플레이/리더보드 유효; 실력=분포 상단. BM 절 참조)
```

- [ ] **Step 4: §11 말미 경고문 개정**

찾기:
```
> ⚠️ "승률 90%+"(§11 본문)는 RNG 전제의 잔재 — 결정론 전환(§2-1) 후엔 *분포*가 안 나온다. A의 매트릭스 라벨이 그 자리를 대체(숙련 하한 greedy가 정렙에 깰 수 있는가 = 게이트).
```
교체:
```
> ⚠️ "승률 90%+"(§11 본문)는 **시드확률 전환(2026-06-16 §2-1)으로 부활** — 시드 분포로 다시 측정 가능. A 매트릭스에 **시드 차원**을 더해 {정책 티어 × 레벨 오프셋 × N시드}로 승률 분포를 낸다(결정론 시절 단일 결과 라벨을 분포로 격상). greedy 정렙 게이트는 유지. (실제 분포는 RNG 소비가 생기는 Phase B부터 — 그 전엔 시드 무관 동일.)
```

- [ ] **Step 5: §13 불가침선 — 랜덤 금지 항목 명확화**

찾기:
```
- 전투력에 영향 주는 모든 랜덤 옵션 금지
```
교체:
```
- **전투력에 영향 주는 *현금·장비* 랜덤 옵션 금지**(확률 강화·장비 랜덤스탯·현금 가챠). ⚠️ *전투 내* 시드확률(명중/상태이상 등)은 별개 — 밸런스 sim·리더보드가 시드 재현으로 유지되므로 BM 가드와 무관(2026-06-16)
```

- [ ] **Step 6: §7 게임성 격상 절 헤더 — 로드맵 포인터 추가**

찾기:
```
### 게임성 격상 (결정론 깊이 — 원작 재현 검증 후 1순위, 2026-06-15)
> §2-1 경계: 시나리오·맵은 재현, 전투 게임성은 RNG 없이 깊이로 올린다. 아래는 우선순위 순.
```
교체:
```
### 게임성 격상 (2026-06-16 전환: 결정론 깊이 → **시드확률 + 결정론 혼합**)
> §2-1 경계: 시나리오·맵은 재현, 전투 게임성은 깊이로 올린다. **2026-06-16 시드확률 도입**으로 영걸전 리파인 전투 깊이(명중/회피·상태이상·회심·재반격/무반격/관통/선제/흡혈)를 이식한다. 이식 로드맵 = **Phase A 시드RNG기반 → B 기본전투RNG(명중/분산) → C 전투특성엔진 → D 상태이상 → E 시그니처무기/아이템 → F 상점·편성UX.** 카탈로그=docs/reference/yeonggeoljeon-rifine-combat.md, Phase A 설계=docs/superpowers/specs/2026-06-16-seeded-rng-foundation-design.md. 아래는 *완료된* 결정론 격상(시드확률 도입 후에도 베이스라인 유지).
```

- [ ] **Step 7: 커밋**

```bash
git add CLAUDE.md
git commit -m "docs: CLAUDE.md SSOT — 전투 모델 결정론→시드 고정 확률 전환

§15/§2-1/§2-5/§11/§13/§7을 시드확률 모델로 개정. 순수 랜덤·세이브스컴은
금지하되 시드 고정 확률은 허용(리플레이/리더보드/밸런스 sim은 시드 재현으로 보존).
영걸전 리파인 전투 깊이 이식 로드맵(Phase A~F) 포인터 추가.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: 시드 재현성 가드 테스트

**Files:**
- Create: `packages/engine/test/reproducibility.test.ts`

> Phase A엔 RNG 소비처가 없어 red→green이 아니라 **가드 테스트**다(처음부터 PASS). "같은 (시드,행동)→같은 state"를 못박아, Phase B에서 RNG가 들어와도 시드 재현이 유지되는지 회귀로 잡는다. 둘째 케이스는 "지금은 시드 무관 동일"을 명시 — Phase B에서 이 단언이 *의도적으로* 깨지며 분기 지점을 표시한다.

- [ ] **Step 1: 가드 테스트 작성**

`packages/engine/test/reproducibility.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { createBattle } from "../src/createBattle";
import { applyAction } from "../src/actions";
import type { BattleState } from "../src/types";
import { testCtx } from "./fixtures";

/** 고정 시드 + 고정 행동(관우 1회 대기)으로 전투를 진행해 최종 state를 낸다. */
function runFixed(seed: number): BattleState {
  const s0 = createBattle(testCtx, seed);
  return applyAction(testCtx, s0, { type: "wait", unitId: "관우" }).state;
}

describe("Phase A: 시드 재현성 (전투 RNG 토대)", () => {
  it("같은 (시드, 행동) → 동일 최종 state (리플레이/세이브스컴 방지 토대)", () => {
    expect(runFixed(42)).toEqual(runFixed(42));
  });

  it("RNG 소비처 0 → 다른 시드여도 rngState 외 진행 동일 (Phase B에서 분기될 자리)", () => {
    const a = runFixed(42);
    const b = runFixed(99);
    // rngState(=저장된 seed)만 다르고 나머지 전개는 동일해야 한다(소비 0 증명).
    expect({ ...a, rngState: 0 }).toEqual({ ...b, rngState: 0 });
  });
});
```

- [ ] **Step 2: 테스트 실행 — PASS 확인**

Run: `pnpm --filter @tk/engine exec vitest run reproducibility`
Expected: PASS (2 tests). 만약 `wait`가 픽스처에서 무효라 throw하면, 관우가 testCtx의 player 유닛인지 확인(`createBattle.test.ts`가 `get(s,"관우")`로 참조 → 존재 보장).

- [ ] **Step 3: 커밋**

```bash
git add packages/engine/test/reproducibility.test.ts
git commit -m "test(engine): 시드 재현성 가드 — 같은 (시드,행동)→같은 state

Phase A 토대 계약을 회귀로 못박는다. 둘째 케이스는 'RNG 소비처 0이라
시드 무관 동일'을 명시 — Phase B에서 의도적으로 깨지며 분기점을 표시.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: RNG 소비 계약 주석 + rngState 정책 갱신

**Files:**
- Modify: `packages/engine/src/rng.ts` (계약 주석 추가)
- Modify: `packages/engine/src/createBattle.ts:56` 영역 (rngState 주석)
- Modify: `packages/engine/src/types.ts:64` (BattleState.rngState 주석)

> 코드 동작 무변경 — 주석만. Phase B 첫 소비 때 "롤을 이벤트에 실어 프레젠터 투영 정합" 계약을 잊지 않도록 명문화.

- [ ] **Step 1: rng.ts 상단에 소비 계약 주석 추가**

`packages/engine/src/rng.ts` 파일 맨 위(`/** mulberry32 ...` 줄 위)에 블록 추가:
```ts
/**
 * 시드 고정 전투 RNG (2026-06-16 §2-1 전환 — docs/reference/yeonggeoljeon-rifine-combat.md).
 *
 * 계약(Phase B 이후 소비 시 필수):
 *  - 모든 전투 확률은 BattleState.rngState로만 굴린다(벽시계·Math.random 금지) → 시드 재현·세이브스컴 방지.
 *  - 롤로 갈린 결과(명중/빗맞음·분산 피해·상태이상 발동)는 **반드시 BattleEvent에 실어** 프레젠터 투영이
 *    커밋 상태와 일치하게 한다("이벤트가 상태 변화를 전부 서술한다" — dev diffSnapshot 단언). rngState 전진도
 *    그 이벤트 적용으로 재현된다. 누락 시 기존 드레인 단언이 자동 적발한다.
 */
```

- [ ] **Step 2: createBattle.ts의 rngState 초기화 의미 주석 보강**

`packages/engine/src/createBattle.ts`에서 `rngState: seed` 가 있는 객체 리터럴 줄 바로 위(`return {` 다음 줄 근처)에 한 줄 주석을 추가하거나, 기존에 `rngState`를 설명하는 주석이 없으면 줄 끝에 인라인 주석:

찾기:
```
    turn: 1, phase: "player", status: "ongoing", units, rngState: seed, firedEvents: [],
```
교체:
```
    // rngState = 전투 시드(시드 고정 확률 — 같은 시드+행동열이면 동일 재현, 리플레이/세이브스컴 방지).
    turn: 1, phase: "player", status: "ongoing", units, rngState: seed, firedEvents: [],
```

- [ ] **Step 3: types.ts의 BattleState.rngState 주석 갱신**

찾기:
```
  /** mulberry32 내부 상태. signed int32라 음수 가능. 원작 공식은 분산이 없어 전투 중 갱신되지 않음 — 기연/일반 일기토 확률 등 미래 RNG 용도로 보존 */
```
교체:
```
  /** mulberry32 내부 상태(signed int32, 음수 가능). 시드 고정 전투 RNG의 스트림(2026-06-16 §2-1). 롤마다 nextRandom으로 전진 — Phase A는 소비처 0이라 불변, Phase B(명중/분산)부터 갱신. rng.ts 소비 계약 참조. */
```

- [ ] **Step 4: 엔진 전체 테스트 — 회귀 green**

Run: `pnpm --filter @tk/engine exec vitest run`
Expected: 전부 PASS(기존 + reproducibility 2개). 동작 불변 증명.

- [ ] **Step 5: 모노레포 전체 회귀**

Run: `pnpm -r test`
Expected: data/engine/sim/web/import-hero 전부 green(행동 불변이므로 sim/web도 무영향).

- [ ] **Step 6: 커밋**

```bash
git add packages/engine/src/rng.ts packages/engine/src/createBattle.ts packages/engine/src/types.ts
git commit -m "docs(engine): RNG 소비 계약 명문화 + rngState 정책 주석

Phase B 첫 소비 시 '롤을 BattleEvent에 실어 프레젠터 정합'을 잊지 않도록
rng.ts에 계약 주석. createBattle/types의 rngState 주석을 시드확률 활성으로 갱신.
동작 무변경(주석만).

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Self-Review (작성자 점검 결과)

- **Spec 커버리지**: §2-5(CLAUDE.md 개정 Task1)·§2-1(2-1 계약 Task1+3)·§2-2(재현성 Task2)·§2-3(§11 분포 준비 Task1 Step4)·§2-4(리플레이 토대 = 재현성 보장 Task2)·§2-5(CLAUDE 6지점 Task1) 전부 매핑됨. Phase A "동작 불변" = Task3 Step4/5 회귀로 검증.
- **플레이스홀더**: 없음. 모든 교체 문자열·테스트 코드·명령 완전 기술.
- **타입 일관성**: `runFixed(seed:number):BattleState`, `applyAction(ctx,state,{type:"wait",unitId})→{state}` — actions.test.ts 실제 시그니처와 일치. `nextRandom`은 변경 안 함.
- **주의**: Task1은 prose 교체라 anchor가 정확히 1회 등장해야 함 — 교체 전 해당 문자열이 유일한지 확인(중복 시 더 긴 문맥으로 anchor 확장).
