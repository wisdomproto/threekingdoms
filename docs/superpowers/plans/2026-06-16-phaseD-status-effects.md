# 상태이상 서브시스템 (Phase D — 부동·금책·중독) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 상태이상 인프라(statuses 리스트·inflictStatuses 능력·status.ts 순수헬퍼·페이즈 시작 틱·3 이벤트)와 부동·금책·중독 3종을 결정론으로 추가한다. 실 아이템 미할당 → 밸런스 불변.

**Architecture:** 상태이상은 `UnitState.statuses[]`(런타임 부여) + `inflictStatuses[]`(아이템이 준 적중 시 부여 능력). `status.ts` 순수헬퍼가 적용/틱을 처리하고, resolveStrike가 명중 시 chance 시드 롤로 부여, maybeAdvancePhase가 페이즈 시작에 틱(중독 피해+만료), assertCanAct/strategy가 부동·금책 차단. diffSnapshot은 troops만 보므로 statusTick(피해)만 프레젠터 투영 필요.

**Tech Stack:** TypeScript, pnpm 모노레포, vitest(핀 2.1 — `pnpm --filter @tk/<pkg> exec vitest run`).

**Spec:** docs/superpowers/specs/2026-06-16-phaseD-status-effects-design.md

---

## 파일 구조

| 파일 | 변경 |
|---|---|
| `packages/data/src/schemas.ts` | StatusKind·StatusEffect·ItemEffects.inflictStatus·CombatConfig.status (T1) |
| `packages/data/json/combat.json` | `status.poisonDamage` (T1) |
| `packages/engine/src/types.ts` | UnitState.statuses/inflictStatuses + BattleEvent +3 (T2) |
| `packages/engine/src/createBattle.ts` | spawnUnit inflictStatuses 집약 (T2) |
| `packages/engine/src/status.ts` (신규) | hasStatus·applyStatus·tickStatuses (T3) |
| `packages/engine/src/index.ts` | status 헬퍼 export (T3) |
| `packages/engine/src/actions.ts` | resolveStrike 부여 + maybeAdvancePhase 틱 + 차단 (T4) |
| `apps/web/src/battle/eventPlayer.ts` | Presenter +3 + dispatch +3 (T5) |
| `apps/web/src/battle/__tests__/fakePresenter.ts` | statusTick troops 투영 (T5) |
| `apps/web/src/pixi/BattleRenderer.ts` | 3 이벤트 최소 처리 (T6) |
| `apps/web/src/battle/attackPreview.ts` | inflicts 예측 (T6) |

---

## Task 1: 스키마 (StatusKind·inflictStatus·status config)

**Files:**
- Modify: `packages/data/src/schemas.ts` (ItemEffectsSchema, CombatConfigSchema, 신규 Status 스키마)
- Modify: `packages/data/json/combat.json`
- Test: `packages/data/test/schemas.test.ts`

- [ ] **Step 1: 실패 테스트**

`packages/data/test/schemas.test.ts`에 추가(describe 안, 마지막 it 뒤):
```ts
  it("상태이상(Phase D): StatusEffect·inflictStatus·status config 파싱", () => {
    const e = ItemSchema.parse({
      id: "독검", name: "독검", category: "weapon", power: 255, bonusPercent: 0,
      effects: { inflictStatus: { kind: "poison", chance: 75, turns: 3 } },
    });
    expect(e.effects?.inflictStatus).toEqual({ kind: "poison", chance: 75, turns: 3 });
    const cfg = CombatConfigSchema.parse({
      advantageDefFactor: 0.75, disadvantageDefFactor: 1.25, counterRatio: 0.5,
      minDamage: 1, maxTurns: 30, lineAdvantage: { cavalry: "infantry" },
    });
    expect(cfg.status).toEqual({ poisonDamage: 20 });
    // 잘못된 kind 거부
    expect(() => ItemSchema.parse({ id: "x", name: "x", category: "weapon", power: 0, bonusPercent: 0,
      effects: { inflictStatus: { kind: "nope", chance: 50, turns: 1 } } })).toThrow();
  });
```

- [ ] **Step 2: 실패 확인**

Run: `pnpm --filter @tk/data exec vitest run schemas`
Expected: FAIL (inflictStatus/status 미정의).

- [ ] **Step 3: 스키마 구현**

`packages/data/src/schemas.ts`의 `ItemEffectsSchema` 정의 **위**에 추가:
```ts
/** 상태이상 종류 (Phase D: 부동·금책·중독. 확장: confuse/debuff 후속). */
export const StatusKindSchema = z.enum(["poison", "seal", "immobilize"]);
export type StatusKind = z.infer<typeof StatusKindSchema>;

/** 활성 상태이상 1건 (런타임 부여분). turns = 남은 지속 턴. */
export const StatusEffectSchema = z.object({
  kind: StatusKindSchema,
  turns: z.number().int().min(1),
});
export type StatusEffect = z.infer<typeof StatusEffectSchema>;
```

`ItemEffectsSchema`의 `alwaysHit` 줄 다음에 추가:
```ts
  inflictStatus: z.object({                                // 적중 시 상태이상 부여(시드 chance%)
    kind: StatusKindSchema,
    chance: z.number().int().min(0).max(100),
    turns: z.number().int().min(1),
  }).optional(),
```

`CombatConfigSchema`의 `accuracy` 줄 다음에 추가:
```ts
  /** 상태이상(Phase D). poisonDamage = 중독 1틱 확정 피해(데이터 노브). */
  status: z.object({
    poisonDamage: z.number().int().min(0),
  }).default({ poisonDamage: 20 }),
```

- [ ] **Step 4: combat.json**

`packages/data/json/combat.json`의 `accuracy` 줄 다음에 `"status": { "poisonDamage": 20 }` 추가(트레일링 콤마 주의).

- [ ] **Step 5: 통과 + 데이터 회귀**

Run: `pnpm --filter @tk/data exec vitest run`
Expected: PASS.

- [ ] **Step 6: 커밋**

```bash
git add packages/data/src/schemas.ts packages/data/json/combat.json packages/data/test/schemas.test.ts
git commit -m "feat(data): 상태이상 스키마 — StatusKind·inflictStatus·status.poisonDamage

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: UnitState 상태 필드 + 이벤트 + spawnUnit 집약

**Files:**
- Modify: `packages/engine/src/types.ts` (UnitState, BattleEvent import + 3 events)
- Modify: `packages/engine/src/createBattle.ts` (spawnUnit)
- Test: `packages/engine/test/createBattle.test.ts`

- [ ] **Step 1: 실패 테스트**

`packages/engine/test/createBattle.test.ts`에 추가:
```ts
  it("상태이상(Phase D): inflictStatus가 UnitState.inflictStatuses로 집약", () => {
    const item = { id: "독검", name: "독검", category: "weapon" as const, power: 255, bonusPercent: 0,
      effects: { inflictStatus: { kind: "poison" as const, chance: 75, turns: 3 } } };
    const data = { ...gameData, items: { ...gameData.items, 독검: item } };
    const stage = { ...testStage, units: testStage.units.map((u) => (u.commanderId === "관우" ? { ...u, items: ["독검"] } : u)) };
    const u = createBattle({ data, stage, map: testMap }, 1).units.find((x) => x.id === "관우")!;
    expect(u.inflictStatuses).toEqual([{ kind: "poison", chance: 75, turns: 3 }]);
    expect(createBattle(testCtx, 1).units.find((x) => x.id === "유비")!.inflictStatuses).toBeUndefined();
  });
```

- [ ] **Step 2: 실패 확인**

Run: `pnpm --filter @tk/engine exec vitest run createBattle`
Expected: FAIL.

- [ ] **Step 3: types.ts — import + UnitState + 이벤트**

`packages/engine/src/types.ts` 최상단 import에 StatusEffect/StatusKind 추가:
```ts
import type { ..., StatusEffect, StatusKind } from "@tk/data";
```
(기존 `@tk/data` import 줄에 병합. 없으면 새 줄 `import type { StatusEffect, StatusKind } from "@tk/data";`.)

UnitState의 `alwaysHit?: boolean;` 줄 다음에:
```ts
  // Phase D 상태이상. statuses=런타임 부여(미설정=[]), inflictStatuses=적중 시 부여 능력(아이템 집약).
  statuses?: StatusEffect[];
  inflictStatuses?: { kind: StatusKind; chance: number; turns: number }[];
```

BattleEvent union에 (damageDealt 줄 근처) 추가:
```ts
  | { type: "statusApplied"; unitId: string; kind: StatusKind; turns: number }
  | { type: "statusTick"; unitId: string; kind: StatusKind; damage: number }
  | { type: "statusExpired"; unitId: string; kind: StatusKind }
```

- [ ] **Step 4: spawnUnit 집약**

`packages/engine/src/createBattle.ts`의 effects 누적 선언부(`let noCounter = false, ...`)에 추가:
```ts
  const inflictStatuses: { kind: import("@tk/data").StatusKind; chance: number; turns: number }[] = [];
```
루프 내 `if (e.flatDamagePerLevel != null) ...` 다음에:
```ts
      if (e.inflictStatus) inflictStatuses.push(e.inflictStatus);
```
반환 리터럴의 `alwaysHit: alwaysHit || undefined,` 다음에:
```ts
    inflictStatuses: inflictStatuses.length ? inflictStatuses : undefined,
```

- [ ] **Step 5: 통과 + 엔진 회귀**

Run: `pnpm --filter @tk/engine exec vitest run`
Expected: PASS(신규 + 기존 150 — 상태 미보유라 동작 불변).

- [ ] **Step 6: 커밋**

```bash
git add packages/engine/src/types.ts packages/engine/src/createBattle.ts packages/engine/test/createBattle.test.ts
git commit -m "feat(engine): UnitState 상태이상 필드 + 3 이벤트 + spawnUnit inflictStatuses 집약

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: status.ts 순수 헬퍼

**Files:**
- Create: `packages/engine/src/status.ts`
- Modify: `packages/engine/src/index.ts` (export)
- Test: `packages/engine/test/status.test.ts` (신규)

- [ ] **Step 1: 실패 테스트**

`packages/engine/test/status.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { createBattle } from "../src/createBattle";
import { hasStatus, applyStatus, tickStatuses } from "../src/status";
import { testCtx } from "./fixtures";

describe("status 헬퍼 (Phase D)", () => {
  it("applyStatus: 신규 추가 / 같은 kind면 turns=max", () => {
    const a = applyStatus(undefined, "poison", 3);
    expect(a).toEqual([{ kind: "poison", turns: 3 }]);
    const b = applyStatus(a, "poison", 2); // 더 짧음 → 유지(max)
    expect(b).toEqual([{ kind: "poison", turns: 3 }]);
    const c = applyStatus(a, "seal", 1);
    expect(c).toEqual([{ kind: "poison", turns: 3 }, { kind: "seal", turns: 1 }]);
  });

  it("hasStatus", () => {
    const s = createBattle(testCtx, 1);
    const u = { ...s.units[0]!, statuses: [{ kind: "immobilize" as const, turns: 2 }] };
    expect(hasStatus(u, "immobilize")).toBe(true);
    expect(hasStatus(u, "poison")).toBe(false);
  });

  it("tickStatuses: 중독 피해 + turns 감소 + 만료, 이벤트 서술", () => {
    const s0 = createBattle(testCtx, 1);
    const target = s0.units.find((u) => u.side === "player")!;
    const s = { ...s0, units: s0.units.map((u) => u.id === target.id
      ? { ...u, troops: 100, statuses: [{ kind: "poison" as const, turns: 2 }, { kind: "seal" as const, turns: 1 }] } : u) };
    const { state, events } = tickStatuses(testCtx, s, "player");
    const after = state.units.find((u) => u.id === target.id)!;
    expect(after.troops).toBe(100 - testCtx.data.combat.status.poisonDamage); // 중독 1틱
    expect(after.statuses).toEqual([{ kind: "poison", turns: 1 }]); // poison 2→1, seal 1→만료
    expect(events.some((e) => e.type === "statusTick" && e.kind === "poison")).toBe(true);
    expect(events.some((e) => e.type === "statusExpired" && e.kind === "seal")).toBe(true);
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `pnpm --filter @tk/engine exec vitest run status`
Expected: FAIL (status.ts 없음).

- [ ] **Step 3: status.ts 구현**

`packages/engine/src/status.ts`:
```ts
import type { StatusEffect, StatusKind } from "@tk/data";
import type { BattleContext, BattleState, BattleEvent, Side, UnitState } from "./types";

export function hasStatus(u: UnitState, kind: StatusKind): boolean {
  return (u.statuses ?? []).some((s) => s.kind === kind);
}

/** 같은 kind 있으면 turns=max로 갱신, 없으면 추가. 순수(새 배열). */
export function applyStatus(statuses: StatusEffect[] | undefined, kind: StatusKind, turns: number): StatusEffect[] {
  const cur = statuses ?? [];
  if (cur.some((s) => s.kind === kind)) {
    return cur.map((s) => (s.kind === kind ? { kind, turns: Math.max(s.turns, turns) } : s));
  }
  return [...cur, { kind, turns }];
}

/**
 * side 진영 유닛의 페이즈 시작 처리 — 중독 피해 + turns−1 + 만료. 결정론(난수 없음).
 * 중독 피해는 statusTick으로, 만료는 statusExpired로 서술(diffSnapshot은 troops만 보지만 표시 정합 위해 전부 emit).
 */
export function tickStatuses(
  ctx: BattleContext, state: BattleState, side: Side,
): { state: BattleState; events: BattleEvent[] } {
  const events: BattleEvent[] = [];
  let units = state.units;
  for (const u of state.units) {
    if (u.side !== side || u.retreated || !u.statuses || u.statuses.length === 0) continue;
    let troops = u.troops;
    let retreated = u.retreated;
    for (const s of u.statuses) {
      if (s.kind === "poison" && !retreated) {
        const dmg = ctx.data.combat.status.poisonDamage;
        troops = Math.max(0, troops - dmg);
        events.push({ type: "statusTick", unitId: u.id, kind: "poison", damage: dmg });
        if (troops === 0) { retreated = true; events.push({ type: "unitRetreated", unitId: u.id }); }
      }
    }
    const next: StatusEffect[] = [];
    for (const s of u.statuses) {
      const t = s.turns - 1;
      if (t <= 0) events.push({ type: "statusExpired", unitId: u.id, kind: s.kind });
      else next.push({ kind: s.kind, turns: t });
    }
    units = units.map((x) => (x.id === u.id ? { ...x, troops, retreated, statuses: next } : x));
  }
  return { state: { ...state, units }, events };
}
```

- [ ] **Step 4: index export**

`packages/engine/src/index.ts`에 추가:
```ts
export { hasStatus, applyStatus, tickStatuses } from "./status";
```

- [ ] **Step 5: 통과**

Run: `pnpm --filter @tk/engine exec vitest run status`
Expected: PASS.

- [ ] **Step 6: 커밋**

```bash
git add packages/engine/src/status.ts packages/engine/src/index.ts packages/engine/test/status.test.ts
git commit -m "feat(engine): status.ts 순수 헬퍼 — hasStatus/applyStatus/tickStatuses

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: actions.ts 통합 (부여 + 틱 + 차단)

**Files:**
- Modify: `packages/engine/src/actions.ts`
- Test: `packages/engine/test/actions.test.ts`

> ⚠️ 시드 불변식: inflictStatuses 미보유 유닛은 상태 롤 0 → 기존 시드 시퀀스/밸런스 보존.

- [ ] **Step 1: 실패 테스트**

`packages/engine/test/actions.test.ts`의 "전투 특성 (Phase C)" describe 다음에 추가:
```ts
describe("상태이상 (Phase D)", () => {
  const base = () => {
    let s = patchUnit(fresh(), "이숙", { x: 1, y: 3, agility: 1, rangeMin: 1, rangeMax: 1, troops: 9999, maxTroops: 9999 });
    s = patchUnit(s, "관우", { agility: 100, baseMove: 2 });
    return s;
  };

  it("부여: chance=100이면 적중 시 statusApplied + 방어자 statuses", () => {
    const s = patchUnit(base(), "관우", { agility: 100, baseMove: 2, inflictStatuses: [{ kind: "poison", chance: 100, turns: 3 }] });
    const { state, events } = applyAction(testCtx, s, { type: "attack", unitId: "관우", targetId: "이숙" });
    expect(events.some((e) => e.type === "statusApplied" && e.kind === "poison")).toBe(true);
    expect(get(state, "이숙").statuses).toEqual([{ kind: "poison", turns: 3 }]);
  });

  it("부여 chance=0: 상태 없음", () => {
    const s = patchUnit(base(), "관우", { agility: 100, baseMove: 2, inflictStatuses: [{ kind: "poison", chance: 0, turns: 3 }] });
    const { state, events } = applyAction(testCtx, s, { type: "attack", unitId: "관우", targetId: "이숙" });
    expect(events.some((e) => e.type === "statusApplied")).toBe(false);
    expect(get(state, "이숙").statuses ?? []).toEqual([]);
  });

  it("중독 틱: 페이즈 한 바퀴 후 중독 피해 + 만료", () => {
    // 이숙(enemy)에 중독 2턴 부여 후, enemy 페이즈 시작 시 틱.
    let s = patchUnit(base(), "이숙", { x: 1, y: 3, troops: 9999, maxTroops: 9999, statuses: [{ kind: "poison", turns: 2 }] });
    // 관우 대기 → 페이즈 전환으로 enemy 페이즈 진입(이숙 틱). 간단히 모든 player 유닛 acted 처리.
    s = { ...s, units: s.units.map((u) => (u.side === "player" ? { ...u, acted: true } : u)) };
    const { events } = applyAction(testCtx, s, { type: "wait", unitId: "유비" }); // 마지막 player 행동 → enemy 전환
    expect(events.some((e) => e.type === "statusTick" && e.unitId === "이숙" && e.kind === "poison")).toBe(true);
  });

  it("부동: immobilize면 move throw, attack은 가능", () => {
    const s = patchUnit(base(), "관우", { statuses: [{ kind: "immobilize", turns: 2 }] });
    const dest = { x: get(s, "관우").x, y: get(s, "관우").y - 1 };
    expect(() => applyAction(testCtx, s, { type: "move", unitId: "관우", to: dest })).toThrow("부동");
    // 공격은 가능(throw 안 함) — 이숙 인접
    expect(() => applyAction(testCtx, patchUnit(s, "관우", { agility: 100, statuses: [{ kind: "immobilize", turns: 2 }] }),
      { type: "attack", unitId: "관우", targetId: "이숙" })).not.toThrow();
  });

  it("금책: seal이면 strategy throw", () => {
    const caster = fresh().units.find((u) => u.side === "player" && u.mp > 0);
    // 책략 보유 유닛에 seal 부여 후 strategy 시도 → throw. (책략 가진 유닛이 없으면 스킵)
    if (!caster) return;
    const s = patchUnit(fresh(), caster.id, { statuses: [{ kind: "seal", turns: 2 }] });
    const cls = testCtx.data.unitClasses[caster.classId];
    const sid = cls?.strategies[0];
    if (!sid) return;
    expect(() => applyAction(testCtx, s, { type: "strategy", unitId: caster.id, strategyId: sid, target: { x: caster.x, y: caster.y } })).toThrow("금책");
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `pnpm --filter @tk/engine exec vitest run actions`
Expected: FAIL (부여/틱/차단 미구현).

- [ ] **Step 3: import 추가**

`packages/engine/src/actions.ts` import에:
```ts
import { hasStatus, applyStatus, tickStatuses } from "./status";
```
(`nextRandom`은 이미 import됨 — Phase B.)

- [ ] **Step 4: resolveStrike — 상태 부여**

`resolveStrike`의 `return { state: next, events, hit: true };` **직전**에 삽입:
```ts
  // 상태이상 부여(Phase D) — 공격자 inflictStatuses 각각 chance 시드 롤 → 발동 시 방어자에 부여.
  for (const inf of attacker.inflictStatuses ?? []) {
    const [v, ns] = nextRandom(next.rngState);
    next = { ...next, rngState: ns };
    const tgt = getUnit(next, defenderId);
    if (!tgt.retreated && v * 100 < inf.chance) {
      next = replaceUnit(next, { ...tgt, statuses: applyStatus(tgt.statuses, inf.kind, inf.turns) });
      events.push({ type: "statusApplied", unitId: defenderId, kind: inf.kind, turns: inf.turns });
    }
  }
```
(⚠️ `attacker`는 resolveStrike 진입 시 스냅샷 — inflictStatuses는 불변이라 OK.)

- [ ] **Step 5: maybeAdvancePhase — 틱 (시그니처에 ctx)**

`maybeAdvancePhase(state: BattleState)` → `maybeAdvancePhase(ctx: BattleContext, state: BattleState)`.
반환 직전을 교체:
```ts
  const advanced: BattleState = { ...state, phase: nextPhase, turn: nextTurn, units, combo };
  const ticked = tickStatuses(ctx, advanced, nextPhase);
  return {
    state: ticked.state,
    events: [{ type: "phaseChanged", phase: nextPhase, turn: nextTurn }, ...ticked.events],
  };
```
호출부(현 638행) `const phase = maybeAdvancePhase(next);` → `const phase = maybeAdvancePhase(ctx, next);`.

- [ ] **Step 6: assertCanAct — 부동**

`assertCanAct`의 `if (forMove && unit.moved) throw ...` 다음에:
```ts
  if (forMove && hasStatus(unit, "immobilize")) throw new Error(`${unit.id} 부동 상태 — 이동 불가`);
```

- [ ] **Step 7: strategy 케이스 — 금책**

strategy 케이스 `assertCanAct(state, unit, false);` 다음 줄에:
```ts
      if (hasStatus(unit, "seal")) throw new Error(`${unit.id} 금책 상태 — 책략 불가`);
```

- [ ] **Step 8: 통과 + 엔진 전체 회귀**

Run: `pnpm --filter @tk/engine exec vitest run`
Expected: PASS 전부(신규 5 + 기존 — 상태 미보유라 시드/밸런스 불변).

- [ ] **Step 9: 커밋**

```bash
git add packages/engine/src/actions.ts packages/engine/test/actions.test.ts
git commit -m "feat(engine): 상태이상 통합 — 부여(resolveStrike)+틱(페이즈)+차단(부동/금책)

inflictStatuses 미보유 유닛은 롤 0 → 시드 시퀀스/밸런스 보존.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: 이벤트 프레젠터 (eventPlayer + FakePresenter 투영)

**Files:**
- Modify: `apps/web/src/battle/eventPlayer.ts` (Presenter +3 optional, dispatch +3)
- Modify: `apps/web/src/battle/__tests__/fakePresenter.ts` (statusTick troops 투영)
- Test: `apps/web/src/battle/__tests__/eventPlayer.test.ts`

- [ ] **Step 1: 실패 테스트**

`apps/web/src/battle/__tests__/eventPlayer.test.ts`에 추가(기존 패턴 따라):
```ts
  it("statusTick은 FakePresenter troops를 차감해 diffSnapshot 통과", async () => {
    const events: BattleEvent[] = [{ type: "statusTick", unitId: "관우", kind: "poison", damage: 30 }];
    const before = committedAfter(events); // 헬퍼: 엔진 상태에 동일 차감 적용한 기대 — 아래 주석 참조
    // 간단 버전: FakePresenter에 관우 troops 100 세팅 후 statusTick 30 → 70 투영 확인
  });
```
> ⚠️ 실제 작성 시 기존 eventPlayer.test.ts의 FakePresenter 시드/헬퍼(`makePresenter`/committed 비교)에 맞춰
> "statusTick 후 presenter troops == committed troops" 형태로. 핵심 단언: statusTick 처리 후 diffSnapshot null.

- [ ] **Step 2: 실패 확인**

Run: `pnpm --filter web exec vitest run eventPlayer`
Expected: FAIL (statusTick 미투영 → troops 불일치 / 메서드 없음).

- [ ] **Step 3: Presenter 인터페이스 +3 (optional)**

`apps/web/src/battle/eventPlayer.ts`의 `Presenter` 인터페이스 `phaseChanged` 근처에:
```ts
  statusApplied?(e: Ev<"statusApplied">): Promise<void>;
  statusTick?(e: Ev<"statusTick">): Promise<void>;
  statusExpired?(e: Ev<"statusExpired">): Promise<void>;
```

- [ ] **Step 4: dispatch +3**

dispatch switch에 `case "phaseChanged"` 근처:
```ts
      case "statusApplied":
        return p.statusApplied?.(e) ?? Promise.resolve();
      case "statusTick":
        return p.statusTick?.(e) ?? Promise.resolve();
      case "statusExpired":
        return p.statusExpired?.(e) ?? Promise.resolve();
```

- [ ] **Step 5: FakePresenter statusTick 투영**

`apps/web/src/battle/__tests__/fakePresenter.ts`의 이벤트 적용 switch에 `case "damageDealt"`(troops 차감) 옆에:
```ts
      case "statusTick": {
        const d = this.units.find((u) => u.id === e.unitId);
        if (d) d.troops = Math.max(0, d.troops - e.damage);
        break;
      }
      case "statusApplied":
      case "statusExpired":
        break; // diffSnapshot은 statuses 미비교 — 표시 전용(투영 불필요)
```
(FakePresenter가 메서드 기반이면 `statusTick(e){...}` 형태로 — 파일 구조 정독 후 맞춤.)

- [ ] **Step 6: 통과 + web 회귀**

Run: `pnpm --filter web exec vitest run`
Expected: PASS.

- [ ] **Step 7: 커밋**

```bash
git add apps/web/src/battle/eventPlayer.ts apps/web/src/battle/__tests__/fakePresenter.ts apps/web/src/battle/__tests__/eventPlayer.test.ts
git commit -m "feat(web): 상태이상 이벤트 프레젠터 — statusTick troops 투영 + dispatch

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 6: 렌더러 최소 처리 + 예측 inflicts

**Files:**
- Modify: `apps/web/src/pixi/BattleRenderer.ts` (statusTick 피해팝/troops + applied/expired 최소)
- Modify: `apps/web/src/battle/attackPreview.ts` (inflicts)
- Test: `apps/web/src/battle/__tests__/attackPreview.test.ts`

- [ ] **Step 1: 예측 실패 테스트**

`attackPreview.test.ts`에 추가:
```ts
  it("상태이상(Phase D): 공격자 inflictStatuses → 예측 inflicts", () => {
    const s = withUnit(meleeState(), "장비", { inflictStatuses: [{ kind: "poison", chance: 75, turns: 3 }], agility: 100, noCounter: true });
    const cao = findUnit(s, "조잠");
    const pv = buildAttackPreview(ctx, s, "장비", { x: cao.x, y: cao.y })!;
    expect(pv.inflicts).toEqual([{ kind: "poison", chance: 75 }]);
  });
```

- [ ] **Step 2: 실패 확인**

Run: `pnpm --filter web exec vitest run attackPreview`
Expected: FAIL.

- [ ] **Step 3: attackPreview inflicts**

`AttackPreview` 인터페이스에 `inflicts?: { kind: string; chance: number }[];` 추가. `buildAttackPreview`
반환 객체들(필살/일반/반격 분기)에 공통으로:
```ts
  const inflicts = (attacker.inflictStatuses ?? []).map((s) => ({ kind: s.kind, chance: s.chance }));
```
계산 후 각 return에 `inflicts: inflicts.length ? inflicts : undefined` 추가(없으면 생략 위해 length 가드).

- [ ] **Step 4: BattleRenderer 최소 처리**

`apps/web/src/pixi/BattleRenderer.ts`에 Presenter 메서드 구현 추가(정독 후 기존 damageDealt 핸들러 패턴 따라):
```ts
  async statusTick(e: Ev<"statusTick">): Promise<void> {
    // 중독 피해 — 해당 유닛 troops 갱신 + 작은 피해팝(기존 damageDealt 연출 재사용).
    this.applyTroopDamage(e.unitId, e.damage); // 기존 헬퍼명에 맞춤(없으면 damageDealt 경로 참고)
  }
  async statusApplied(_e: Ev<"statusApplied">): Promise<void> { /* 상태 아이콘 — 후속(E), 현재 no-op */ }
  async statusExpired(_e: Ev<"statusExpired">): Promise<void> { /* no-op */ }
```
⚠️ BattleRenderer의 실제 troops 갱신 방식(스프라이트 바)에 맞춰 정독 후 구현. statusTick은 troops 반영 필수
(없으면 화면 병력바와 엔진 불일치).

- [ ] **Step 5: 통과 + web 회귀**

Run: `pnpm --filter web exec vitest run`
Expected: PASS.

- [ ] **Step 6: 커밋**

```bash
git add apps/web/src/pixi/BattleRenderer.ts apps/web/src/battle/attackPreview.ts apps/web/src/battle/__tests__/attackPreview.test.ts
git commit -m "feat(web): 렌더러 statusTick 피해 반영 + 예측 inflicts

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 7: 전 패키지 회귀 + 타입체크 + 밸런스 불변

- [ ] **Step 1: 모노레포 테스트** — Run: `pnpm -r test` → 전부 green.
- [ ] **Step 2: 타입체크** — Run: `pnpm -r typecheck` → 에러 0.
- [ ] **Step 3: 밸런스 불변** — Run: `pnpm --filter @tk/sim report-card` 후 `git diff --stat docs/reference/balance-report.md` → **변경 없음**(상태이상 미할당 → 시드 시퀀스 보존). 변경 시 Task 4 시드 불변식 위반 → 회귀.

---

## Self-Review

- **Spec 커버리지**: §1 스키마(T1)·§2 UnitState/spawnUnit(T2)·§2 status.ts(T3)·§3 부여(T4 Step4)·§4 틱(T4 Step5)·
  §5 차단(T4 Step6-7)·§6 이벤트(T2+T5)·§7 예측/표시(T6)·§9 테스트(각)·§10 비침범(밸런스 T7-3).
- **플레이스홀더**: 순수/엔진 코드 완전. T5 Step1·T6 Step4는 "정독 후 맞춤"(FakePresenter/BattleRenderer 구조
  의존) — 핵심 계약(statusTick troops 투영) 명시.
- **타입 일관성**: `statuses`·`inflictStatuses`·`StatusKind`·`StatusEffect`·`statusApplied/Tick/Expired`·
  `tickStatuses(ctx,state,side)`·`applyStatus(statuses,kind,turns)` 전 태스크 일치. maybeAdvancePhase(ctx,state) 시그니처 변경 호출부 동기(T4 Step5).
- **시드 불변식**: inflictStatuses 미보유 → 롤 0 → 밸런스 리포트 바이트 동일(T4 Step8·T7-3 게이트).
