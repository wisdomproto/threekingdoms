# 전투 특성 엔진 (Phase C — 피해/반격 수정자) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 무반격·관통(다단N)·재반격/연환·고정피해·필중 5종 전투 특성을 ItemEffects→UnitState→attack 해석에 결정론으로 추가한다(흡혈은 Phase E). 실제 아이템 미할당 → 밸런스 불변.

**Architecture:** ItemEffects에 5필드 → spawnUnit이 UnitState로 집약 → actions.ts attack을 단일 타격 헬퍼 `resolveStrike`로 리팩터하고 개시(관통)·반격(재반격) 루프로 특성을 합성한다. **특성 미보유 시 명중 롤 시퀀스가 Phase B와 동일** → 시드42 결과 바이트 동일(밸런스/결정론 회귀 0).

**Tech Stack:** TypeScript, pnpm 모노레포, vitest(핀 2.1 — `pnpm --filter @tk/<pkg> exec vitest run`).

**Spec:** docs/superpowers/specs/2026-06-16-phaseC-combat-traits-design.md

---

## 파일 구조

| 파일 | 변경 |
|---|---|
| `packages/data/src/schemas.ts` | ItemEffectsSchema +5필드 (T1) |
| `packages/engine/src/types.ts` | UnitState +5 트레잇 필드 (T2) |
| `packages/engine/src/createBattle.ts` (spawnUnit) | effects 집약 (T2) |
| `packages/engine/src/actions.ts` | `resolveStrike` 헬퍼 + attack 루프 리팩터/특성 (T3) |
| `apps/web/src/battle/attackPreview.ts` | 특성 예측 반영 (T4) |

---

## Task 1: ItemEffects 스키마 (5필드)

**Files:**
- Modify: `packages/data/src/schemas.ts:108-114`
- Test: `packages/data/test/schemas.test.ts`

- [ ] **Step 1: 실패 테스트**

`packages/data/test/schemas.test.ts`의 마지막 `it(...)` 다음, describe 닫기 `});` 앞에 추가:
```ts
  it("ItemEffects 전투 특성(Phase C) 파싱 + 미지정 무파손", () => {
    const e = ItemSchema.parse({
      id: "t", name: "t", category: "weapon", power: 255, bonusPercent: 0,
      effects: { noCounter: true, multiHit: 3, counterStrikes: 2, flatDamagePerLevel: 15, alwaysHit: true },
    });
    expect(e.effects).toMatchObject({ noCounter: true, multiHit: 3, counterStrikes: 2, flatDamagePerLevel: 15, alwaysHit: true });
    // 기존 effects(말) 무파손
    expect(ItemSchema.parse({ id: "m", name: "말", category: "horse", power: 255, bonusPercent: 0, effects: { move: 1 } }).effects?.multiHit).toBeUndefined();
  });
```
(상단 import에 `ItemSchema`가 이미 있음 — 확인. 없으면 추가.)

- [ ] **Step 2: 실패 확인**

Run: `pnpm --filter @tk/data exec vitest run schemas`
Expected: FAIL (multiHit 등 미정의 → effects가 그 키를 버림 → toMatchObject 실패).

- [ ] **Step 3: 스키마 구현**

`packages/data/src/schemas.ts`의 `ItemEffectsSchema`에서 `doubleStrike` 줄 다음에 추가:
```ts
  noCounter: z.boolean().optional(),                       // 무반격(공격 시 상대 반격 안 받음)
  multiHit: z.number().int().min(2).optional(),            // 관통: 개시 공격 N회 전타격(레거시 doubleStrike 대체)
  counterStrikes: z.number().int().min(1).optional(),      // 재반격/연환: 이 유닛이 반격 시 치는 횟수(기본 1)
  flatDamagePerLevel: z.number().int().min(0).optional(),  // 고정 피해 = 값×(레벨+1), 방어/지형/협공 무시
  alwaysHit: z.boolean().optional(),                       // 필중(명중 롤 생략)
```

- [ ] **Step 4: 통과 + 데이터 회귀**

Run: `pnpm --filter @tk/data exec vitest run`
Expected: PASS (전부).

- [ ] **Step 5: 커밋**

```bash
git add packages/data/src/schemas.ts packages/data/test/schemas.test.ts
git commit -m "feat(data): ItemEffects 전투 특성 5필드(무반격·관통·재반격·고정뎀·필중)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: UnitState 트레잇 + spawnUnit 집약

**Files:**
- Modify: `packages/engine/src/types.ts` (UnitState — `grantsDoubleStrike` 근처)
- Modify: `packages/engine/src/createBattle.ts` (spawnUnit 집약 + 리터럴)
- Test: `packages/engine/test/createBattle.test.ts`

- [ ] **Step 1: 실패 테스트**

`packages/engine/test/createBattle.test.ts`에 추가(describe 안):
```ts
  it("전투 특성(Phase C): 아이템 effects가 UnitState에 집약된다", () => {
    const item = { id: "관통검", name: "관통검", category: "weapon" as const, power: 255, bonusPercent: 0,
      effects: { noCounter: true, multiHit: 3, counterStrikes: 2, flatDamagePerLevel: 15, alwaysHit: true } };
    const data = { ...gameData, items: { ...gameData.items, 관통검: item } };
    const stage = { ...testStage, units: [{ ...testStage.units[0]!, commanderId: "관우", items: ["관통검"] }] };
    const u = createBattle({ data, stage, map: testMap }, 1).units.find((x) => x.id === "관우")!;
    expect(u).toMatchObject({ noCounter: true, multiHit: 3, counterStrikes: 2, flatDamagePerLevel: 15, alwaysHit: true });
    // 미보유 유닛은 트레잇 미설정(기본 동작)
    const plain = createBattle(testCtx, 1).units.find((x) => x.id === "유비")!;
    expect(plain.multiHit).toBeUndefined();
    expect(plain.noCounter).toBeUndefined();
  });
```
(`gameData`, `testStage`, `testMap` import 확인 — createBattle.test.ts 상단에 이미 일부 있음. 없는 것 추가: `import { gameData } from "@tk/data";` 이미 있음.)

- [ ] **Step 2: 실패 확인**

Run: `pnpm --filter @tk/engine exec vitest run createBattle`
Expected: FAIL (UnitState에 필드 없음 / spawnUnit 미집약).

- [ ] **Step 3: UnitState 필드 추가**

`packages/engine/src/types.ts` — `grantsDoubleStrike?: boolean;` 줄 다음에:
```ts
  // §7/Phase C 전투 특성(아이템 effects 집약). 미설정=기본 동작.
  noCounter?: boolean;            // 무반격(공격 시 상대 반격 없음)
  multiHit?: number;             // 관통: 개시 공격 N회 전타격(레거시 doubleStrike 대체)
  counterStrikes?: number;       // 재반격/연환: 반격 시 치는 횟수(미설정=1)
  flatDamagePerLevel?: number;   // 고정 피해 = 값×(레벨+1), 방어/지형/협공 무시
  alwaysHit?: boolean;           // 필중(명중 롤 생략)
```

- [ ] **Step 4: spawnUnit 집약 로직**

`packages/engine/src/createBattle.ts`의 effects 합산 루프(`for (const itemId of p.items)` 내부, `if (e.doubleStrike) grantDouble = true;` 다음)에 누적 변수 처리. 먼저 루프 위 선언부
(`let moveBonus = 0, atkPct = 0, ...grantDouble = false;`)를 확장:
```ts
  let moveBonus = 0, atkPct = 0, spiritPct = 0, defPct = 0, grantDouble = false;
  let noCounter = false, alwaysHit = false;
  let multiHit: number | undefined, counterStrikes: number | undefined, flatDamagePerLevel: number | undefined;
```
루프 내 `if (e.doubleStrike) grantDouble = true;` 다음에:
```ts
      if (e.noCounter) noCounter = true;
      if (e.alwaysHit) alwaysHit = true;
      if (e.multiHit != null) multiHit = Math.max(multiHit ?? 0, e.multiHit);
      if (e.counterStrikes != null) counterStrikes = Math.max(counterStrikes ?? 1, e.counterStrikes);
      if (e.flatDamagePerLevel != null) flatDamagePerLevel = Math.max(flatDamagePerLevel ?? 0, e.flatDamagePerLevel);
```
반환 리터럴의 `grantsDoubleStrike: grantDouble,` 다음에:
```ts
    noCounter: noCounter || undefined,
    multiHit,
    counterStrikes,
    flatDamagePerLevel,
    alwaysHit: alwaysHit || undefined,
```
(`|| undefined`로 false 대신 미설정 — toMatchObject/하위호환 깔끔.)

- [ ] **Step 5: 통과 + 엔진 회귀**

Run: `pnpm --filter @tk/engine exec vitest run`
Expected: PASS (신규 + 기존 144 — 트레잇 미보유라 동작 불변).

- [ ] **Step 6: 커밋**

```bash
git add packages/engine/src/types.ts packages/engine/src/createBattle.ts packages/engine/test/createBattle.test.ts
git commit -m "feat(engine): UnitState 전투 특성 + spawnUnit effects 집약(Phase C)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: resolveStrike 헬퍼 + attack 루프 리팩터/특성

**Files:**
- Modify: `packages/engine/src/actions.ts` (resolveStrike 추가 + attack 케이스 재작성)
- Test: `packages/engine/test/actions.test.ts`

> ⚠️ 핵심 불변식: **특성 미보유 시 명중 롤 호출 시퀀스가 Phase B와 동일**해야 한다(1타·레거시2타·반격 각 1롤)
> → 시드42 결과 바이트 동일 → 밸런스/결정론 회귀 0. resolveStrike는 롤·피해·dealDamage·경험치를
> 한 번에 처리하는 추출일 뿐, 호출 횟수/순서를 바꾸지 않는다.

- [ ] **Step 1: 특성 실패 테스트 작성**

`packages/engine/test/actions.test.ts`의 "명중/회피 롤" describe 다음에 추가:
```ts
describe("전투 특성 (Phase C)", () => {
  // 관우(공격자) 인접 (1,3)에 이숙, 관우 순발 우위로 항상 명중하게 만든 베이스.
  const base = () => patchUnit(patchUnit(fresh(), "이숙", { x: 1, y: 3, agility: 1 }), "관우", { agility: 100 });
  const ddNonCounter = (evs: ReturnType<typeof applyAction>["events"]) =>
    evs.filter((e) => e.type === "damageDealt" && !e.counter);
  const ddCounter = (evs: ReturnType<typeof applyAction>["events"]) =>
    evs.filter((e) => e.type === "damageDealt" && e.counter);

  it("무반격: 공격자 noCounter면 반격 damageDealt 없음", () => {
    // 이숙을 사거리1 보병처럼 — 반격 성립 위치. 그러나 noCounter면 반격 안 함.
    let s = patchUnit(base(), "이숙", { x: 1, y: 3, agility: 1, rangeMin: 1, rangeMax: 1 });
    s = patchUnit(s, "관우", { agility: 100, noCounter: true, baseMove: 2 }); // doubleStrike 비활성
    const { events } = applyAction(testCtx, s, { type: "attack", unitId: "관우", targetId: "이숙" });
    expect(ddCounter(events).length).toBe(0);
  });

  it("관통 multiHit=3: 개시 공격 damageDealt 3개(레거시 2타 미적용)", () => {
    const s = patchUnit(base(), "관우", { agility: 100, multiHit: 3 });
    const { events } = applyAction(testCtx, s, { type: "attack", unitId: "관우", targetId: "이숙" });
    // 대상이 3타 전에 퇴각하지 않도록 이숙 병력 충분(픽스처 기본). 비반격 damageDealt = 3.
    expect(ddNonCounter(events).length).toBe(3);
  });

  it("재반격 counterStrikes=2: 반격 damageDealt 2개", () => {
    let s = patchUnit(base(), "이숙", { x: 1, y: 3, agility: 1, rangeMin: 1, rangeMax: 1, counterStrikes: 2 });
    s = patchUnit(s, "관우", { agility: 100, baseMove: 2 }); // doubleStrike 비활성
    const { events } = applyAction(testCtx, s, { type: "attack", unitId: "관우", targetId: "이숙" });
    expect(ddCounter(events).length).toBe(2);
  });

  it("고정 피해 flatDamagePerLevel: 방어/상성 무관 = 값×(lv+1)", () => {
    const s = patchUnit(base(), "관우", { agility: 100, flatDamagePerLevel: 10, baseMove: 2, level: 1 });
    const { events } = applyAction(testCtx, s, { type: "attack", unitId: "관우", targetId: "이숙" });
    const dd = ddNonCounter(events)[0]!;
    expect(dd.type === "damageDealt" && dd.damage).toBe(10 * (1 + 1)); // 20, 방어 무시
  });

  it("필중 alwaysHit: 순발 열세여도 항상 명중", () => {
    // 관우 순발 1, 이숙 순발 100 → 평소 미스 가능, alwaysHit면 항상 hit.
    let s = patchUnit(fresh(), "이숙", { x: 1, y: 3, agility: 100 });
    s = patchUnit(s, "관우", { agility: 1, alwaysHit: true, baseMove: 2 });
    const { events } = applyAction(testCtx, s, { type: "attack", unitId: "관우", targetId: "이숙" });
    const dd = ddNonCounter(events)[0]!;
    expect(dd.type === "damageDealt" && dd.hit).toBe(true);
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `pnpm --filter @tk/engine exec vitest run actions`
Expected: FAIL (특성 미구현 — 무반격인데 반격 발생, multiHit 무시 등).

- [ ] **Step 3: resolveStrike 헬퍼 추가**

`packages/engine/src/actions.ts`의 `rollHit` 헬퍼 다음에:
```ts
/**
 * 단일 물리 타격 — 시드 명중 롤(attacker.alwaysHit면 생략) → 피해(flat or computeDamage) →
 * dealDamage(hit 플래그) + 경험치. counter=true면 반격(경험치는 타격자). 미스면 damageDealt{0,hit:false}만.
 * ratio = computeDamage 배율(개시=1·반격=counterRatio·레거시2타=secondHitPercent). flat은 ratio 무시.
 */
function resolveStrike(
  ctx: BattleContext, state: BattleState, attackerId: string, defenderId: string,
  opts: { counter: boolean; mult: number; ratio: number },
): { state: BattleState; events: BattleEvent[]; hit: boolean } {
  let next = state;
  const events: BattleEvent[] = [];
  const attacker = getUnit(next, attackerId);
  const defender = getUnit(next, defenderId);
  if (!attacker.alwaysHit) {
    const r = rollHit(ctx, next, attacker, defender);
    next = r.state;
    if (!r.hit) {
      events.push({ type: "damageDealt", attackerId, defenderId, damage: 0, counter: opts.counter, hit: false });
      return { state: next, events, hit: false };
    }
  }
  const dmg = attacker.flatDamagePerLevel != null
    ? Math.max(ctx.data.combat.minDamage, attacker.flatDamagePerLevel * (attacker.level + 1))
    : computeDamage(ctx, attacker, defender, opts.ratio, opts.mult);
  const defLvl = defender.level;
  const dd = dealDamage(next, attacker, defender, dmg, opts.counter);
  next = dd.state;
  events.push(...dd.events);
  const exp = grantExp(ctx, next, attackerId, dmg, getUnit(next, defenderId).retreated, defLvl);
  next = exp.state;
  events.push(...exp.events);
  return { state: next, events, hit: true };
}
```

- [ ] **Step 4: attack 케이스 본문 재작성**

`packages/engine/src/actions.ts` attack 케이스의 Phase B 블록(주석 `// 일반 공격 — 명중/회피는 시드…`
부터 콤보 블록까지)을 아래로 교체. (1타→레거시2타→반격을 resolveStrike 루프로; 특성 합성.)
```ts
      // 일반 공격 — 명중/회피 시드(§2-1) + 전투 특성(Phase C: 무반격·관통·재반격·고정뎀·필중).
      const flankN = flankingCount(state, unit, target);
      const flankMult = flankMultiplier(ctx, flankN);
      const chargeMult = chargeMultiplier(ctx, unit);
      const mult = flankMult * chargeMult;
      let attackerHit = false; // 개시 타격이 한 번이라도 명중했나(참여 SP)
      let defenderHit = false; // 방어자가 피해를 입었나(피격 SP)
      let flankShown = false;

      // 개시 타수: multiHit(관통) 지정이면 그 수(전타격), 아니면 1타.
      const primaryStrikes = unit.multiHit ?? 1;
      for (let i = 0; i < primaryStrikes; i++) {
        if (getUnit(next, target.id).retreated) break;
        const r = resolveStrike(ctx, next, unit.id, target.id, { counter: false, mult, ratio: 1 });
        next = r.state;
        if (r.hit && !flankShown && flankMult > 1) {
          events.push({ type: "flank", attackerId: unit.id, defenderId: target.id, surround: flankN, bonusPercent: Math.round((flankMult - 1) * 100) });
          flankShown = true;
        }
        events.push(...r.events);
        if (r.hit) { attackerHit = true; defenderHit = true; }
      }

      // 레거시 연속공격(2중공격) — multiHit 미지정 시에만. 이동력 우위 + 대상 생존이면 2타(부분피해).
      if (unit.multiHit == null) {
        const afterHit1 = getUnit(next, target.id);
        if (!afterHit1.retreated && doubleStrikes(ctx, unit, target)) {
          const r2 = resolveStrike(ctx, next, unit.id, target.id, { counter: false, mult, ratio: ctx.data.combat.doubleStrike.secondHitPercent / 100 });
          next = r2.state;
          if (r2.hit) {
            events.push({ type: "doubleStrike", attackerId: unit.id, defenderId: target.id });
            attackerHit = true; defenderHit = true;
          }
          events.push(...r2.events);
        }
      }

      // 반격: 공격자 noCounter면 생략. 아니면 방어측 생존 + 공격측이 방어측 사거리 안 → counterStrikes회.
      if (!unit.noCounter) {
        const defender = getUnit(next, target.id);
        if (!defender.retreated) {
          const d = distance({ x: unit.x, y: unit.y }, { x: defender.x, y: defender.y });
          if (d >= defender.rangeMin && d <= defender.rangeMax) {
            const counterStrikes = defender.counterStrikes ?? 1;
            for (let i = 0; i < counterStrikes; i++) {
              if (getUnit(next, unit.id).retreated) break;
              const rc = resolveStrike(ctx, next, target.id, unit.id, { counter: true, mult: 1, ratio: ctx.data.combat.counterRatio });
              next = rc.state;
              events.push(...rc.events);
            }
          }
        }
      }

      // 필살 게이지(SP) — 명중한 타격에만. 공격자=onAttack(+격파 시 onKill), 피격자 생존+피격 시 onHitTaken.
      {
        const spCfg = ctx.data.combat.sp;
        const killed = getUnit(next, target.id).retreated;
        if (attackerHit) {
          next = replaceUnit(next, addSp(getUnit(next, unit.id), spCfg.onAttack + (killed ? spCfg.onKill : 0)));
        }
        const def2 = getUnit(next, target.id);
        if (!def2.retreated && defenderHit) next = replaceUnit(next, addSp(def2, spCfg.onHitTaken));
      }
      // 콤보(연속 격파) — 격파는 명중으로만 → 자연 게이트.
      {
        const combo = registerComboKill(ctx, next, unit.side, getUnit(next, target.id).retreated);
        next = combo.state;
        events.push(...combo.events);
      }
```

- [ ] **Step 5: 특성 테스트 통과**

Run: `pnpm --filter @tk/engine exec vitest run actions`
Expected: PASS (신규 특성 5 + 기존 actions).

- [ ] **Step 6: 엔진 전체 회귀 — 리팩터 무회귀 증명**

Run: `pnpm --filter @tk/engine exec vitest run`
Expected: PASS 전부(기존 SP/필살/연속/반격/fullBattle·재현성 동일 — 롤 시퀀스 보존). ⚠️ 깨지면
**리팩터가 롤 횟수/순서를 바꿈** — resolveStrike 호출 위치를 Phase B와 1:1 대조.

- [ ] **Step 7: 커밋**

```bash
git add packages/engine/src/actions.ts packages/engine/test/actions.test.ts
git commit -m "feat(engine): 전투 특성 — resolveStrike 루프 + 무반격/관통/재반격/고정뎀/필중

attack을 단일 타격 헬퍼로 리팩터하고 개시(관통)·반격(재반격) 루프로 특성 합성.
특성 미보유 시 명중 롤 시퀀스가 Phase B와 동일 → 시드42 결과 불변(밸런스/결정론 회귀 0).

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: 예측창 특성 반영

**Files:**
- Modify: `apps/web/src/battle/attackPreview.ts`
- Test: `apps/web/src/battle/__tests__/attackPreview.test.ts`

> 예측이 엔진과 일치해야(특성 적용 피해/반격). Phase C는 실제 아이템 미할당이라 인게임 트리거는 없지만
> 예측 로직 정합을 테스트로 못박는다(Phase E 배선 시 즉시 정확).

- [ ] **Step 1: 실패 테스트**

`apps/web/src/battle/__tests__/attackPreview.test.ts`에 추가:
```ts
  it("전투 특성(Phase C): multiHit/flat/noCounter가 예측에 반영", () => {
    let s = meleeState();
    s = withUnit(s, "장비", { multiHit: 3, noCounter: true });
    const zf = findUnit(s, "장비");
    const cao = findUnit(s, "조잠");
    const pv = buildAttackPreview(ctx, s, "장비", { x: cao.x, y: cao.y })!;
    const res = applyAction(ctx, s, { type: "attack", unitId: "장비", targetId: "조잠" });
    const hits = damageEvents(res.events).filter((d) => !d.counter && d.defenderId === "조잠");
    expect(pv.damage).toBe(hits.reduce((a, h) => a + h.damage, 0)); // 관통 합산 일치
    expect(pv.counter).toBeUndefined(); // 무반격 → 반격 예측 없음
  });
```

- [ ] **Step 2: 실패 확인**

Run: `pnpm --filter web exec vitest run attackPreview`
Expected: FAIL (예측이 multiHit/noCounter 미반영).

- [ ] **Step 3: attackPreview 특성 반영**

`apps/web/src/battle/attackPreview.ts`에서:
- 개시 피해 산출부(dmg1/doubles/dmg2)를 특성 인지로 교체. `attacker.flatDamagePerLevel`면
  타당 = `max(minDamage, flat×(lv+1))`, 아니면 computeDamage. 타수 = `attacker.multiHit ?? (doubles? 2 : 1)`.
  관통 시 `damage = 타당 × multiHit`(각 전타격 동일 피해), 레거시 2타는 기존(secondHitPercent).
- 반격 블록을 `if (!attacker.noCounter && !willRetreat) { ... }`로 가드.
구체 편집은 실행 시 정독 후 — 핵심: 엔진 resolveStrike와 동일 피해/타수/반격조건.

- [ ] **Step 4: 통과 + web 회귀**

Run: `pnpm --filter web exec vitest run`
Expected: PASS (신규 + 기존 465).

- [ ] **Step 5: 커밋**

```bash
git add apps/web/src/battle/attackPreview.ts apps/web/src/battle/__tests__/attackPreview.test.ts
git commit -m "feat(web): 예측창 전투 특성 반영(관통·무반격·고정뎀)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: 전 패키지 회귀 + 타입체크 + 밸런스 불변 확인

- [ ] **Step 1: 모노레포 테스트**

Run: `pnpm -r test`
Expected: data/engine/sim/web/import-hero 전부 green.

- [ ] **Step 2: 타입체크**

Run: `pnpm -r typecheck`
Expected: 에러 0.

- [ ] **Step 3: 밸런스 불변 확인**

Run: `pnpm --filter @tk/sim report-card` 후 `git diff --stat docs/reference/balance-report.md`
Expected: **변경 없음**(실제 아이템 미할당 → 라벨·턴 동일). 변경이 있으면 리팩터가 롤 시퀀스를 바꾼 것 →
Task 3 Step 6으로 회귀.

---

## Self-Review

- **Spec 커버리지**: §1 5필드(T1)·§2 집약(T2)·§3 resolveStrike/루프/무반격/관통/재반격(T3)·고정/필중(T3)·
  §5 예측(T4)·§6 테스트(각)·§7 비침범(밸런스 불변 T5 Step3). 흡혈은 스펙대로 제외(Phase E).
- **플레이스홀더**: 순수/엔진 코드 완전. T4 Step3만 "정독 후 편집"(기존 예측 분기 구조 의존) — 핵심 계약
  (엔진과 동일 피해/타수/반격조건) 명시.
- **타입 일관성**: `noCounter`·`multiHit`·`counterStrikes`·`flatDamagePerLevel`·`alwaysHit` 전 태스크 일치.
  `resolveStrike(opts:{counter,mult,ratio})` 시그니처 T3 내 일관.
- **불변식**: 특성 미보유 → 롤 시퀀스 Phase B 동일 → 밸런스/결정론 회귀 0(T3 Step6·T5 Step3로 검증).
