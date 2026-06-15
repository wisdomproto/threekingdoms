# 명중/회피 시드확률 (Phase B) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 전투에 순발력(←민첩) 기반 시드 고정 명중/회피를 도입한다 — 동급 100%·완만 미스(하한 80%), 롤 결과는 이벤트에 실어 프레젠터 정합(Phase A 계약), 예측창에 명중%, 밸런스는 시드 분포로 재기준선.

**Architecture:** 명중 판정은 새 순수 함수 `hitChance(atkAgi, defAgi, cfg)`. 순발력 `agilityPower(u)=corpsStat(u.agility, grades.agility, lv)`는 기존 성장식 재사용. 롤은 `actions.ts` attack 경로에서 `nextRandom(state.rngState)`로 굴려 rngState를 전진시키고, 명중/빗맞음을 `damageDealt.hit`로 이벤트에 싣는다. `computeDamage`는 순수·결정론(피해 크기) 그대로.

**Tech Stack:** TypeScript, pnpm 모노레포, vitest(핀 2.1 — `pnpm --filter @tk/<pkg> exec vitest run`).

**Spec:** docs/superpowers/specs/2026-06-16-phaseB-hit-dodge-design.md

---

## 파일 구조

| 파일 | 책임 | 변경 |
|---|---|---|
| `packages/data/src/schemas.ts` | 스키마 | `CommanderSchema.agility?`, `CombatConfig.accuracy` (T1) |
| `packages/data/json/combat.json` | 전투 상수 | `accuracy` 기본값 (T1) |
| `packages/data/json/commanders.json` | 장수 데이터 | 민첩 주입 (T2, 스크립트) |
| `packages/engine/src/types.ts` | 타입 | `UnitState.agility`, `damageDealt.hit` (T3,T5) |
| `packages/engine/src/createBattle.ts` | spawnUnit | `agility` 주입 (T3) |
| `packages/engine/src/combat.ts` | 전투 순수식 | `agilityPower`, `hitChance` (T3,T4) |
| `packages/engine/src/actions.ts` | 행동 적용 | 명중 롤 + 이벤트 hit + rngState 전진 (T5) |
| `apps/web/src/battle/attackPreview.ts` | 예측 | 명중% (T6) |
| `apps/web/src/battle/hud/AttackForecast.tsx` | 예측 표시 | 명중% (T6) |
| `apps/web/src/battle/eventPlayer.ts` (+presenters) | 이벤트 소비 | 빗나감 처리 (T6) |
| `packages/sim/src/policy.ts` | AI | 기댓값(×명중%) (T7) |
| `packages/sim/src/reportCard.ts` (+runner) | 밸런스 | 시드 분포 + 게이트 (T7) |

---

## Task 1: 스키마 + 전투 설정 (accuracy, agility 필드)

**Files:**
- Modify: `packages/data/src/schemas.ts` (CommanderSchema, CombatConfigSchema)
- Modify: `packages/data/json/combat.json`
- Test: `packages/data/test/schemas.test.ts`

- [ ] **Step 1: 실패 테스트 — accuracy 기본값 + agility optional**

`packages/data/test/schemas.test.ts`에 추가:
```ts
import { CommanderSchema, CombatConfigSchema } from "../src/schemas";

it("CombatConfig.accuracy 기본값 (미지정 JSON 무파손)", () => {
  const base = { advantageDefFactor: 0.75, disadvantageDefFactor: 1.25, counterRatio: 0.5,
    minDamage: 1, maxTurns: 30, lineAdvantage: { cavalry: "infantry" } };
  const cfg = CombatConfigSchema.parse(base);
  expect(cfg.accuracy).toEqual({ missSlope: 0.5, floorPercent: 80 });
});

it("Commander.agility는 optional (기존 3스탯 JSON 통과)", () => {
  const c = CommanderSchema.parse({ id: "x", name: "x", leadership: 50, war: 50, intelligence: 50, faceId: 0 });
  expect(c.agility).toBeUndefined();
  const c2 = CommanderSchema.parse({ id: "y", name: "y", leadership: 50, war: 50, intelligence: 50, faceId: 0, agility: 68 });
  expect(c2.agility).toBe(68);
});
```

- [ ] **Step 2: 실패 확인**

Run: `pnpm --filter @tk/data exec vitest run schemas`
Expected: FAIL (`accuracy` undefined, `agility` 미정의).

- [ ] **Step 3: 스키마 구현**

`packages/data/src/schemas.ts` — `CommanderSchema`에 `faceId` 다음 줄 추가:
```ts
  agility: Stat.optional(),   // 민첩 → 순발력(명중/회피). 미지정 시 spawnUnit에서 기본 50
```

`CombatConfigSchema`에 `combo` 객체 다음(닫는 `})` 전)에 추가:
```ts
  /**
   * 명중/회피(시드 고정 확률, §2-1 2026-06-16). 명중% = clamp(100 − missSlope×max(0, defAgi−atkAgi), floorPercent, 100).
   * 동급 100%·완만 미스(하한 floorPercent). 데이터 노브.
   */
  accuracy: z.object({
    missSlope: z.number().min(0),
    floorPercent: z.number().min(0).max(100),
  }).default({ missSlope: 0.5, floorPercent: 80 }),
```

- [ ] **Step 4: combat.json에 accuracy 추가**

`packages/data/json/combat.json`의 최상위 객체에 `"accuracy": { "missSlope": 0.5, "floorPercent": 80 }` 추가(기존 `combo` 옆). 트레일링 콤마 주의.

- [ ] **Step 5: 통과 확인 + 데이터 로드 회귀**

Run: `pnpm --filter @tk/data exec vitest run`
Expected: PASS (신규 2 + 기존 전부).

- [ ] **Step 6: 커밋**

```bash
git add packages/data/src/schemas.ts packages/data/json/combat.json packages/data/test/schemas.test.ts
git commit -m "feat(data): CommanderSchema.agility + CombatConfig.accuracy (명중/회피 설정)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: 민첩 데이터 주입 (조조전 generals.json → commanders.json)

**Files:**
- Create: `tools/inject-agility.cjs` (1회성 스크립트)
- Modify: `packages/data/json/commanders.json` (스크립트 출력)

> commanders.json은 CRLF + 한글 NFC. JSON.stringify 재포맷 금지 — **라인 splice**로 각 장수 객체의
> `"faceId": N,` 줄 뒤에 `"agility": M,`를 끼워넣는다(없는 장수만). 매칭은 이름(`"name"`)으로
> 조조전 generals.json과 대조, 환산 = `clamp(round(agi×2), 1, 100)`(조조전 raw는 표시값 ÷2).

- [ ] **Step 1: 스크립트 작성**

`tools/inject-agility.cjs`:
```js
const fs = require("fs");
const path = require("path");
const root = path.resolve(__dirname, "..");
const cmdPath = path.join(root, "packages/data/json/commanders.json");
const genPath = path.join(root, "packages/data/json/sosoden/generals.json");

const gens = JSON.parse(fs.readFileSync(genPath, "utf8"));
// 이름 → 환산 민첩 (중복 이름은 첫 항목)
const agiByName = new Map();
for (const g of gens) {
  if (!agiByName.has(g.name) && typeof g.agi === "number") {
    agiByName.set(g.name, Math.min(100, Math.max(1, Math.round(g.agi * 2))));
  }
}

const raw = fs.readFileSync(cmdPath, "utf8");
const lines = raw.split(/\r?\n/);
const out = [];
let curName = null;
let injected = 0, skipped = 0;
for (const line of lines) {
  const nm = line.match(/"name":\s*"([^"]+)"/);
  if (nm) curName = nm[1];
  out.push(line);
  // faceId 줄 뒤에 agility 삽입 (이미 agility 있는 블록은 건너뜀)
  if (/"faceId":/.test(line) && curName && agiByName.has(curName)) {
    const indent = line.match(/^(\s*)/)[1];
    out.push(`${indent}"agility": ${agiByName.get(curName)},`);
    injected++;
  } else if (/"faceId":/.test(line)) {
    skipped++;
  }
}
// CRLF 보존
const eol = raw.includes("\r\n") ? "\r\n" : "\n";
fs.writeFileSync(cmdPath, out.join(eol), "utf8");
console.log(`agility 주입: ${injected}명, 미매칭(기본 50 처리): ${skipped}명`);
```

- [ ] **Step 2: 실행**

Run: `node tools/inject-agility.cjs`
Expected: `agility 주입: <N>명, 미매칭...: <M>명` (관우/장비/조운 등 핵심 장수 포함).

- [ ] **Step 3: 데이터 유효성 + 핵심 장수 확인**

Run: `pnpm --filter @tk/data exec vitest run`
Expected: PASS (스키마가 agility 허용). 그리고:
Run: `node -e "const c=require('./packages/data/json/commanders.json'); console.log('관우', c['관우']?.agility, '장비', c['장비']?.agility)"`
Expected: 숫자 출력(undefined 아님).

- [ ] **Step 4: 스크립트 idempotent 확인**

Run: `node tools/inject-agility.cjs`
Expected: `agility 주입: 0명` (이미 있는 블록은 정규식이 faceId 다음에 다시 안 넣음 — ⚠️ 만약 중복 삽입되면 스크립트의 "이미 agility 있으면 skip" 가드를 보강: faceId 줄 다음 줄이 이미 `"agility"`면 push 안 함). 보강 필요 시 Step 1 수정 후 재실행 전 `git checkout packages/data/json/commanders.json`로 되돌리고 다시.

- [ ] **Step 5: 커밋**

```bash
git add tools/inject-agility.cjs packages/data/json/commanders.json
git commit -m "data: 장수 민첩 주입 (조조전 generals.json 이름매칭 환산)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: 순발력 파생 + UnitState.agility

**Files:**
- Modify: `packages/engine/src/types.ts` (UnitState.agility)
- Modify: `packages/engine/src/createBattle.ts` (spawnUnit)
- Modify: `packages/engine/src/combat.ts` (agilityPower)
- Test: `packages/engine/test/combat.test.ts`

- [ ] **Step 1: 실패 테스트 — agilityPower**

`packages/engine/test/combat.test.ts`에 추가:
```ts
import { agilityPower } from "../src/combat";

it("agilityPower = corpsStat(민첩, agility등급, Lv) (← UnitState.agility)", () => {
  const u = { ...createBattle(testCtx, 42).units.find((x) => x.id === "관우")! };
  // 관우 agility(raw) + 병종 agility 등급 + Lv1 → corpsStat 동치
  expect(agilityPower(u)).toBe(corpsStatExpected(u));
  function corpsStatExpected(unit: typeof u) {
    // floor(민첩/2)+등급 구간가산 — corpsStat 직접 호출로 기대값
    return require("../src/growth").corpsStat(unit.agility, unit.grades.agility, unit.level);
  }
});
```

- [ ] **Step 2: 실패 확인**

Run: `pnpm --filter @tk/engine exec vitest run combat`
Expected: FAIL (`agilityPower` 미정의 / `u.agility` undefined).

- [ ] **Step 3: UnitState.agility 추가**

`packages/engine/src/types.ts` — `war: number; leadership: number; intelligence: number;` 줄 다음에:
```ts
  agility: number;       // 민첩(장수 원값) → agilityPower(순발력) 입력. 미보유 장수=기본 50
```

- [ ] **Step 4: spawnUnit에서 agility 주입**

`packages/engine/src/createBattle.ts` — spawnUnit이 UnitState 리터럴을 만드는 곳에서 `war`/`leadership`/`intelligence`를 commander에서 읽는 라인 근처에 추가. commander 객체를 `c`로 참조한다고 가정(없으면 해당 변수명 사용):
```ts
    agility: c.agility ?? 50,
```
(⚠️ 실행 전 spawnUnit을 읽어 commander 변수명·리터럴 위치 확인 후 정확히 삽입.)

- [ ] **Step 5: agilityPower 구현**

`packages/engine/src/combat.ts` — `spiritPower` 다음에:
```ts
/** 부대 순발력 = floor(민첩/2) + 등급계수 누적성장 (← 민첩, grades.agility). 명중/회피 입력. */
export function agilityPower(u: UnitState): number {
  return corpsStat(u.agility, u.grades.agility, u.level);
}
```

- [ ] **Step 6: index export 확인**

`packages/engine/src/index.ts`의 combat re-export 줄에 `agilityPower` 추가(다른 *Power와 같은 줄).

- [ ] **Step 7: 통과 확인**

Run: `pnpm --filter @tk/engine exec vitest run combat`
Expected: PASS.

- [ ] **Step 8: 커밋**

```bash
git add packages/engine/src/types.ts packages/engine/src/createBattle.ts packages/engine/src/combat.ts packages/engine/src/index.ts packages/engine/test/combat.test.ts
git commit -m "feat(engine): 순발력 파생(agilityPower) + UnitState.agility

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: hitChance 순수 함수

**Files:**
- Modify: `packages/engine/src/combat.ts`
- Modify: `packages/engine/src/index.ts` (export)
- Test: `packages/engine/test/combat.test.ts`

- [ ] **Step 1: 실패 테스트**

`packages/engine/test/combat.test.ts`에 추가:
```ts
import { hitChance } from "../src/combat";

describe("hitChance (명중/회피 — 완만)", () => {
  const cfg = { missSlope: 0.5, floorPercent: 80 };
  it("동급 → 100%", () => expect(hitChance(60, 60, cfg)).toBe(100));
  it("공격자 더 빠름 → 100%", () => expect(hitChance(80, 60, cfg)).toBe(100));
  it("방어자 10 빠름 → 95%", () => expect(hitChance(60, 70, cfg)).toBe(95));
  it("방어자 40 빠름 → 하한 80%", () => expect(hitChance(40, 80, cfg)).toBe(80));
  it("방어자 100 빠름 → floor 클램프 80%", () => expect(hitChance(0, 100, cfg)).toBe(80));
});
```

- [ ] **Step 2: 실패 확인**

Run: `pnpm --filter @tk/engine exec vitest run combat`
Expected: FAIL (`hitChance` 미정의).

- [ ] **Step 3: 구현**

`packages/engine/src/combat.ts` — `agilityPower` 다음에:
```ts
/**
 * 명중률(%) — 시드 고정 확률(§2-1 2026-06-16). 동급 100%·완만 미스, 하한 floorPercent.
 *   명중% = clamp(100 − missSlope × max(0, defAgi − atkAgi), floorPercent, 100)
 * 순수·결정론(롤은 actions.ts에서 이 %를 시드로 굴림). 사거리/지형 무관(피해는 computeDamage).
 */
export function hitChance(
  atkAgi: number, defAgi: number, cfg: { missSlope: number; floorPercent: number },
): number {
  const raw = 100 - cfg.missSlope * Math.max(0, defAgi - atkAgi);
  return Math.max(cfg.floorPercent, Math.min(100, raw));
}
```

- [ ] **Step 4: export**

`packages/engine/src/index.ts` combat re-export 줄에 `hitChance` 추가.

- [ ] **Step 5: 통과 확인**

Run: `pnpm --filter @tk/engine exec vitest run combat`
Expected: PASS.

- [ ] **Step 6: 커밋**

```bash
git add packages/engine/src/combat.ts packages/engine/src/index.ts packages/engine/test/combat.test.ts
git commit -m "feat(engine): hitChance 순수 명중률 공식 (완만·데이터 구동)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: 명중 롤 통합 (actions.ts + damageDealt.hit)

**Files:**
- Modify: `packages/engine/src/types.ts` (damageDealt.hit)
- Modify: `packages/engine/src/actions.ts` (rollHit + attack 경로)
- Test: `packages/engine/test/actions.test.ts`

> ⚠️ 실행 전 `actions.ts` 349~470(attack 케이스: 1타/연속/반격, ultimate 457~)을 정독.
> 설계: 물리 타격(1타·연속2타·반격)마다 명중 롤. **필살(ultimate)·책략·useItem은 항상 명중**(롤 없음).
> 롤 = `nextRandom(state.rngState)` → rngState 전진을 결과 state에 반영. 미스면 그 타격의
> 피해·SP·경험치·격파·콤보를 전부 건너뛰고 `damageDealt {damage:0, hit:false}`만 emit.

- [ ] **Step 1: damageDealt.hit 추가 + dealDamage hit 파라미터**

`packages/engine/src/types.ts`:
```ts
  | { type: "damageDealt"; attackerId: string; defenderId: string; damage: number; counter: boolean; hit: boolean }
```

`packages/engine/src/actions.ts` `dealDamage`: 시그니처에 `hit = true` 추가, 이벤트에 `hit` 싣기:
```ts
function dealDamage(
  state: BattleState, attacker: UnitState, defender: UnitState, damage: number, counter: boolean, hit = true,
): { state: BattleState; events: BattleEvent[] } {
  const troops = Math.max(0, defender.troops - damage);
  const retreated = troops === 0;
  const events: BattleEvent[] = [
    { type: "damageDealt", attackerId: attacker.id, defenderId: defender.id, damage, counter, hit },
  ];
  if (retreated) events.push({ type: "unitRetreated", unitId: defender.id });
  return { state: replaceUnit(state, { ...defender, troops, retreated }), events };
}
```
(기존 dealDamage 호출은 hit 생략=true라 무파손. 책략/useItem의 damageDealt도 hit:true로 자동.)

- [ ] **Step 2: rollHit 헬퍼 추가**

`packages/engine/src/actions.ts` 상단 import에 `hitChance, agilityPower`(@tk/engine combat) 와 `nextRandom`(../rng) 추가. `dealDamage` 위에 헬퍼:
```ts
/** 명중 롤(시드 고정) — rngState 전진. value < hitChance/100 이면 명중. */
function rollHit(
  ctx: BattleContext, state: BattleState, attacker: UnitState, defender: UnitState,
): { hit: boolean; state: BattleState } {
  const pct = hitChance(agilityPower(attacker), agilityPower(defender), ctx.data.combat.accuracy);
  const [v, next] = nextRandom(state.rngState);
  return { hit: v * 100 < pct, state: { ...state, rngState: next } };
}
```

- [ ] **Step 3: 1타(primary) 명중 롤 적용**

attack 케이스에서 1타 `dealDamage` 직전(383~389 영역)을 수정 — 롤 먼저, 미스면 피해/후속 생략:
```ts
      // 명중 롤(시드) — 미스면 0뎀·hit:false만, SP/경험치/격파/콤보 없음.
      const roll1 = rollHit(ctx, next, unit, target);
      next = roll1.state;
      if (!roll1.hit) {
        events.push({ type: "damageDealt", attackerId: unit.id, defenderId: target.id, damage: 0, counter: false, hit: false });
      } else {
        // (기존 1타 처리: dealDamage + flank 이벤트 + exp/SP/콤보 — 이 블록으로 이동)
        ...
      }
```
(⚠️ 기존 389~456의 1타 dealDamage·exp·SP·연속·반격·콤보 로직을 `if (roll1.hit)` 블록 안으로 옮기되,
**연속2타와 반격은 각자 별도 rollHit**로 감싼다. 정독 후 정확히 재배치.)

- [ ] **Step 4: 연속2타·반격에도 rollHit 적용**

- 연속2타(399~404 영역): `doubleStrikes` true일 때 `const roll2 = rollHit(ctx, next, unit, afterHit1); next = roll2.state; if (roll2.hit) { ...dealDamage(dmg2)... } else { emit damageDealt hit:false damage:0 }`.
- 반격(417~419 영역): `const rollC = rollHit(ctx, next, defender, unit); next = rollC.state; if (rollC.hit) { ...counter dealDamage... } else { emit damageDealt(counter:true, hit:false, damage:0) }`.

- [ ] **Step 5: 실패→통과 테스트 (명중/미스 결정성·부작용 게이트)**

`packages/engine/test/actions.test.ts`에 추가:
```ts
import { nextRandom } from "../src/rng";
import { agilityPower, hitChance } from "../src/combat";

describe("명중/회피 롤 (시드 고정)", () => {
  it("같은 시드 → 같은 명중 결과 (재현)", () => {
    const a = fresh(); const b = fresh();
    const r1 = applyAction(testCtx, a, { type: "attack", unitId: "관우", targetId: "이숙" });
    const r2 = applyAction(testCtx, b, { type: "attack", unitId: "관우", targetId: "이숙" });
    expect(r1.events).toEqual(r2.events);
    expect(r1.state.rngState).toBe(r2.state.rngState); // 롤로 전진
  });
  it("미스면 피해 0·hit:false, 방어자 병력 불변", () => {
    // 방어자 순발을 압도적으로 높여 미스 유도(floor 80%라 시드 따라 — 시드 스윕으로 미스 1건 확보)
    let missed = false;
    for (let s = 0; s < 40 && !missed; s++) {
      const st = patchUnit(createBattle(testCtx, s), "이숙", { x: 1, y: 3, agility: 100 });
      const before = st.units.find((u) => u.id === "이숙")!.troops;
      const { events, state } = applyAction(testCtx, patchUnit(st, "관우", { agility: 1 }), { type: "attack", unitId: "관우", targetId: "이숙" });
      const dd = events.find((e) => e.type === "damageDealt");
      if (dd && dd.type === "damageDealt" && dd.hit === false) {
        missed = true;
        expect(dd.damage).toBe(0);
        expect(state.units.find((u) => u.id === "이숙")!.troops).toBe(before);
        expect(state.units.find((u) => u.id === "관우")!.sp ?? 0).toBe(0); // 미스=SP 없음
      }
    }
    expect(missed).toBe(true);
  });
  it("rngState가 공격으로 전진한다", () => {
    const s0 = patchUnit(fresh(), "이숙", { x: 1, y: 3 });
    const { state } = applyAction(testCtx, s0, { type: "attack", unitId: "관우", targetId: "이숙" });
    expect(state.rngState).not.toBe(s0.rngState);
  });
});
```

Run: `pnpm --filter @tk/engine exec vitest run actions`
Expected: 처음 FAIL(hit 필드/롤 미구현) → 구현 후 PASS.

- [ ] **Step 6: 엔진 전체 회귀**

Run: `pnpm --filter @tk/engine exec vitest run`
Expected: PASS. ⚠️ 기존 SP/필살/연속/반격 테스트가 명중 100% 케이스(동급/공격자 우위)면 영향 없음. 만약 일부가 미스를 만나 깨지면 → 해당 픽스처는 명중 100% 배치(공격자 순발 ≥ 방어자)라 안전해야 함. 깨지면 원인이 "픽스처가 우연히 미스 시드"인지 확인.

- [ ] **Step 7: 커밋**

```bash
git add packages/engine/src/types.ts packages/engine/src/actions.ts packages/engine/test/actions.test.ts
git commit -m "feat(engine): 명중/회피 시드 롤 — 물리 타격에 명중 판정 + damageDealt.hit

물리 1타·연속2타·반격마다 rngState로 명중 롤(필살/책략/아이템은 항상 명중).
미스=0뎀·hit:false·SP/경험치/격파 없음. 롤 결과를 이벤트에 실어 프레젠터 정합.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 6: 예측 명중% + 빗나감 연출

**Files:**
- Modify: `apps/web/src/battle/attackPreview.ts` (AttackPreview.hitPercent)
- Modify: `apps/web/src/battle/hud/AttackForecast.tsx`
- Modify: `apps/web/src/battle/eventPlayer.ts` (presenter damageDealt hit 처리)
- Test: `apps/web/src/battle/__tests__/attackPreview.test.ts`

- [ ] **Step 1: 실패 테스트 — 예측 명중%**

`apps/web/src/battle/__tests__/attackPreview.test.ts`에 추가:
```ts
it("buildAttackPreview는 명중%를 엔진 hitChance와 일치시킨다", () => {
  // 공격자/방어자 순발 차로 100% 미만 케이스 구성
  // (testCtx 픽스처에서 공격자 < 방어자 순발이 되도록 patch — 헬퍼 사용)
  const pv = buildAttackPreview(ctx, state, "관우", { x: dx, y: dy });
  expect(pv?.hitPercent).toBe(hitChance(agilityPower(atk), agilityPower(def), ctx.data.combat.accuracy));
  expect(pv?.counter?.hitPercent).toBeTypeOf("number");
});
```
(⚠️ 정확한 atk/def·좌표는 실행 시 기존 attackPreview.test.ts 픽스처에 맞춰 채움.)

- [ ] **Step 2: 실패 확인**

Run: `pnpm --filter web exec vitest run attackPreview`
Expected: FAIL (`hitPercent` 미정의).

- [ ] **Step 3: attackPreview.ts에 명중% 추가**

import에 `hitChance, agilityPower` 추가. `AttackPreview`에 `hitPercent: number;` (그리고 `CounterPreview`에 `hitPercent: number;`). 1타·반격 산출부에서:
```ts
const hitPercent = hitChance(agilityPower(attacker), agilityPower(defender), ctx.data.combat.accuracy);
```
필살(ultimate) 분기는 `hitPercent: 100`(항상 명중). 반환 객체들에 `hitPercent` 채움.

- [ ] **Step 4: AttackForecast.tsx 표시**

피해 수치 옆에 명중% 표시(100%면 생략해 노이즈 감소):
```tsx
{preview.hitPercent < 100 && <span className="...">명중 {preview.hitPercent}%</span>}
```
반격도 동일. (⚠️ 실제 JSX 구조는 파일 정독 후 맞춤.)

- [ ] **Step 5: 빗나감 연출 — presenter**

`apps/web/src/battle/eventPlayer.ts`의 `damageDealt` 처리는 그대로 `p.damageDealt(e)`로 위임하되,
Presenter 구현(BattleRenderer 등)에서 `e.hit === false`면 "빗나감"(예: 작은 텍스트 팝/무피해)으로 분기.
FakePresenter/TrackingPresenter는 `e.hit`를 기록만 하면 됨(시그니처 이미 호환 — Ev<"damageDealt">에 hit 포함).
⚠️ Presenter 구현체에서 damage 0·hit:false일 때 격파/숫자팝을 건너뛰는지 확인.

- [ ] **Step 6: 통과 + web 회귀**

Run: `pnpm --filter web exec vitest run`
Expected: PASS (신규 + 기존 464). eventPlayer.test의 damageDealt 단언이 hit 필드로 깨지면 hit:true 추가.

- [ ] **Step 7: 커밋**

```bash
git add apps/web/src/battle/attackPreview.ts apps/web/src/battle/hud/AttackForecast.tsx apps/web/src/battle/eventPlayer.ts apps/web/src/battle/__tests__/attackPreview.test.ts
git commit -m "feat(web): 예측창 명중% + 빗나감 연출

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 7: AI 기댓값 + 밸런스 시드 분포 재기준선

**Files:**
- Modify: `packages/sim/src/policy.ts` (기댓값)
- Modify: `packages/sim/src/reportCard.ts` (시드 분포)
- Modify: `packages/sim/test/reportCard.test.ts` (게이트 재스냅샷)

> ⚠️ 실행 전 policy.ts·reportCard.ts·runner.ts 정독. 가장 변동 큰 작업 — report-card 재생성 후 라벨 검수.

- [ ] **Step 1: 정책 기댓값**

`policy.ts`의 그리디 평가에서 공격 가치에 명중%를 곱한다(기댓값):
```ts
// 행동 가치 = 예상 피해 × 명중% (빗나갈 행동 과대평가 방지). 시드 고정이라 봇도 같은 롤.
const ev = expectedDamage * hitChance(agilityPower(atk), agilityPower(def), ctx.data.combat.accuracy) / 100;
```
(정확한 변수명·구조는 정독 후. naivePolicy는 기존 유지 가능.)

- [ ] **Step 2: reportCard 시드 분포**

`runMatrixOnStage`/`runMatrix`가 셀마다 N시드(상수 `SEED_SAMPLES = 8`)로 `runStage`를 돌려 **승률**(승/N)을
집계하도록 확장. `classify`를 단일 결과 → 승률 기반으로 갱신(예: greedy@0 승률 ≥ 0.5 = 통과선).
md 출력·라벨 정의를 분포로.

- [ ] **Step 3: report-card 재생성 + 라벨 검수**

Run: `pnpm --filter @tk/sim report-card`
Expected: docs/reference/balance-report.md 갱신. 라벨 검수 — IMPASSABLE 0, greedy@0 전 스테이지 승률 양호.
변동 스테이지가 있으면 accuracy.floorPercent↑(예: 85)로 combat.json 조정 후 재생성.

- [ ] **Step 4: 게이트 재스냅샷**

`packages/sim/test/reportCard.test.ts`의 `BASELINE_LABELS`를 재생성 결과로 갱신(승률 기반 게이트 통과 확인).
Run: `pnpm --filter @tk/sim exec vitest run reportCard`
Expected: PASS.

- [ ] **Step 5: sim 전체 회귀**

Run: `pnpm --filter @tk/sim exec vitest run`
Expected: PASS.

- [ ] **Step 6: 커밋**

```bash
git add packages/sim/src/policy.ts packages/sim/src/reportCard.ts packages/sim/test/reportCard.test.ts docs/reference/balance-report.md packages/data/json/combat.json
git commit -m "feat(sim): AI 기댓값(×명중%) + 밸런스 시드 분포 재기준선

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 8: 전 패키지 회귀 + 마무리

- [ ] **Step 1: 모노레포 전체 회귀**

Run: `pnpm -r test`
Expected: data/engine/sim/web/import-hero 전부 green.

- [ ] **Step 2: 타입체크**

Run: `pnpm -r typecheck` (또는 각 패키지 `exec tsc --noEmit`)
Expected: 에러 0.

- [ ] **Step 3: 수동 검증(선택)** — preview_*로 사수관 1전투, 예측창 `명중 %` 표시 + 미스 연출 확인.

---

## Self-Review

- **Spec 커버리지**: §1 공식(T4)·§2 순발력(T3)·§3 민첩 데이터(T1,T2)·§4 롤 통합/이벤트(T5)·§5 예측(T6)·§6 AI(T7)·§7 밸런스(T7)·§8 파일(전 태스크)·§9 테스트(각 태스크)·§10 비침범(시드/이벤트 정합 T5, 캐주얼 floor T1) 매핑됨.
- **플레이스홀더**: 순수 함수(hitChance/agilityPower/스키마/스크립트)는 완전 코드. 통합 태스크(T5 actions, T6 preview, T7 sim)는 "정독 후 정확 삽입" 명시 + 정확한 라인 앵커·삽입 코드 제시 — 기존 대형 함수 전체 재현 대신 편집점 특정.
- **타입 일관성**: `agility`(UnitState raw), `agilityPower`(파생), `hitChance(atkAgi,defAgi,cfg)`, `damageDealt.hit`, `AttackPreview.hitPercent`/`CounterPreview.hitPercent` — 태스크 간 명칭 일치.
- **리스크 노트**: T7(밸런스 재기준선)이 최대 변동 — floorPercent 노브로 완화. T5는 actions.ts 대형 함수 재배치라 정독 필수.
