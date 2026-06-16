# 시그니처 무기 배선 + 흡혈 + rangeBonus (Phase E) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ★4 시작 시그니처 무기(청룡언월도 무반격·사모 관통·쌍고검 재반격→유비·용담창 range→조운)를 배선하고, 신규 효과 2개(rangeBonus·lifestealPercent=흡혈)와 troopsHealed 이벤트를 추가한 뒤 밸런스를 재기준선화한다.

**Architecture:** 신규 효과는 ItemEffects 확장 → spawnUnit 집약(rangeBonus는 rangeMax에 흡수, lifesteal은 UnitState 필드). 흡혈은 resolveStrike에서 회복 + troopsHealed 이벤트로 서술(diffSnapshot 정합). 아이템/시작장비 배선으로 실제 전투가 바뀌므로 report-card 재생성 + BASELINE_LABELS 재스냅샷.

**Tech Stack:** TypeScript, pnpm 모노레포, vitest(핀 2.1 — `pnpm --filter @tk/<pkg> exec vitest run`).

**Spec:** docs/superpowers/specs/2026-06-16-phaseE-signature-weapons-design.md

---

## 파일 구조

| 파일 | 변경 |
|---|---|
| `packages/data/src/schemas.ts` | ItemEffects.rangeBonus·lifestealPercent (T1) |
| `packages/engine/src/types.ts` | UnitState.lifestealPercent + BattleEvent troopsHealed (T2) |
| `packages/engine/src/createBattle.ts` | spawnUnit rangeMax += rangeBonus, lifesteal 집약 (T2) |
| `packages/engine/src/actions.ts` | resolveStrike 흡혈 (T3) |
| `apps/web/src/battle/eventPlayer.ts` + presenters | troopsHealed 투영 (T4) |
| `apps/web/src/pixi/BattleRenderer.ts` | troopsHealed 회복 연출 (T4) |
| `packages/data/json/items.json` | 효과 추가 + 신규 2종 (T5) |
| `packages/data/json/initialForces.json` | 유비 쌍고검·조운 용담창 (T5) |
| `packages/sim/test/reportCard.test.ts` | BASELINE_LABELS 재스냅샷 (T6) |
| `docs/reference/balance-report.md` | 재생성 (T6) |

---

## Task 1: 스키마 (rangeBonus·lifestealPercent)

**Files:**
- Modify: `packages/data/src/schemas.ts` (ItemEffectsSchema)
- Test: `packages/data/test/schemas.test.ts`

- [ ] **Step 1: 실패 테스트**

`packages/data/test/schemas.test.ts`에 추가(describe 안):
```ts
  it("시그니처 효과(Phase E): rangeBonus·lifestealPercent 파싱", () => {
    const e = ItemSchema.parse({ id: "용담창", name: "용담창", category: "weapon", power: 255, bonusPercent: 0,
      effects: { rangeBonus: 1, lifestealPercent: 50 } });
    expect(e.effects).toMatchObject({ rangeBonus: 1, lifestealPercent: 50 });
    expect(() => ItemSchema.parse({ id: "x", name: "x", category: "weapon", power: 0, bonusPercent: 0,
      effects: { lifestealPercent: 150 } })).toThrow(); // 0~100 초과 거부
  });
```

- [ ] **Step 2: 실패 확인** — Run: `pnpm --filter @tk/data exec vitest run schemas` → FAIL.

- [ ] **Step 3: 구현**

`packages/data/src/schemas.ts`의 `ItemEffectsSchema`에서 `inflictStatus` 정의 다음에 추가:
```ts
  rangeBonus: z.number().int().min(1).optional(),          // 사거리 +N (용담창 — 원거리 타격, 자연 무반격)
  lifestealPercent: z.number().int().min(0).max(100).optional(), // 흡혈: 입힌 피해 × % 자가 회복
```

- [ ] **Step 4: 통과 + 회귀** — Run: `pnpm --filter @tk/data exec vitest run` → PASS.

- [ ] **Step 5: 커밋**
```bash
git add packages/data/src/schemas.ts packages/data/test/schemas.test.ts
git commit -m "feat(data): ItemEffects rangeBonus·lifestealPercent(흡혈)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: UnitState 흡혈 + troopsHealed 이벤트 + spawnUnit 집약

**Files:**
- Modify: `packages/engine/src/types.ts`
- Modify: `packages/engine/src/createBattle.ts`
- Test: `packages/engine/test/createBattle.test.ts`

- [ ] **Step 1: 실패 테스트**

`packages/engine/test/createBattle.test.ts`에 추가:
```ts
  it("시그니처 효과(Phase E): rangeBonus는 rangeMax에 흡수, lifesteal 집약", () => {
    const items = {
      용담창: { id: "용담창", name: "용담창", category: "weapon" as const, power: 255, bonusPercent: 0, effects: { rangeBonus: 1 } },
      방천: { id: "방천", name: "방천", category: "weapon" as const, power: 255, bonusPercent: 0, effects: { lifestealPercent: 50 } },
    };
    const data = { ...gameData, items: { ...gameData.items, ...items } };
    const stage = { ...testStage, units: testStage.units.map((u) => (u.commanderId === "관우" ? { ...u, items: ["용담창", "방천"] } : u)) };
    const u = createBattle({ data, stage, map: testMap }, 1).units.find((x) => x.id === "관우")!;
    const baseMax = gameData.unitClasses[u.classId]!.rangeMax;
    expect(u.rangeMax).toBe(baseMax + 1);      // rangeBonus 흡수
    expect(u.lifestealPercent).toBe(50);
  });
```

- [ ] **Step 2: 실패 확인** — Run: `pnpm --filter @tk/engine exec vitest run createBattle` → FAIL.

- [ ] **Step 3: UnitState + 이벤트**

`packages/engine/src/types.ts` UnitState의 `inflictStatuses?: ...;` 다음에:
```ts
  lifestealPercent?: number;     // 흡혈: 입힌 피해 × % 자가 회복(아이템 집약)
```
BattleEvent union에 (statusTick 근처):
```ts
  | { type: "troopsHealed"; unitId: string; amount: number }
```

- [ ] **Step 4: spawnUnit 집약**

`packages/engine/src/createBattle.ts` 누적 선언부(`const inflictStatuses ...`) 다음에:
```ts
  let rangeBonus = 0, lifestealPercent = 0;
```
루프 내 `if (e.inflictStatus) ...` 다음에:
```ts
      rangeBonus += e.rangeBonus ?? 0;
      lifestealPercent = Math.min(100, lifestealPercent + (e.lifestealPercent ?? 0));
```
반환 리터럴에서 `rangeMin: cls.rangeMin, rangeMax: cls.rangeMax,` 를:
```ts
    rangeMin: cls.rangeMin, rangeMax: cls.rangeMax + rangeBonus,
```
로 바꾸고, `inflictStatuses: ...,` 다음에:
```ts
    lifestealPercent: lifestealPercent || undefined,
```

- [ ] **Step 5: 통과 + 엔진 회귀** — Run: `pnpm --filter @tk/engine exec vitest run` → PASS(신규 + 기존 159).

- [ ] **Step 6: 커밋**
```bash
git add packages/engine/src/types.ts packages/engine/src/createBattle.ts packages/engine/test/createBattle.test.ts
git commit -m "feat(engine): UnitState.lifestealPercent + troopsHealed 이벤트 + rangeBonus 흡수

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: resolveStrike 흡혈

**Files:**
- Modify: `packages/engine/src/actions.ts`
- Test: `packages/engine/test/actions.test.ts`

- [ ] **Step 1: 실패 테스트**

`packages/engine/test/actions.test.ts`의 "상태이상 (Phase D)" describe 다음에:
```ts
describe("흡혈 (Phase E)", () => {
  it("lifestealPercent: 입힌 피해 비례 자가 회복 + troopsHealed", () => {
    let s = patchUnit(fresh(), "이숙", { x: 1, y: 3, agility: 1, rangeMin: 1, rangeMax: 1, troops: 9999, maxTroops: 9999 });
    s = patchUnit(s, "관우", { agility: 100, baseMove: 2, troops: 100, maxTroops: 9999, lifestealPercent: 50 });
    const { state, events } = applyAction(testCtx, s, { type: "attack", unitId: "관우", targetId: "이숙" });
    const dmg = events.filter((e) => e.type === "damageDealt" && e.counter === false && e.hit)[0];
    const heal = events.find((e) => e.type === "troopsHealed" && e.unitId === "관우");
    expect(heal).toBeTruthy();
    if (heal && heal.type === "troopsHealed" && dmg && dmg.type === "damageDealt") {
      expect(heal.amount).toBe(Math.floor(dmg.damage * 0.5));
      expect(get(state, "관우").troops).toBe(100 + heal.amount);
    }
  });

  it("흡혈 회복은 maxTroops 상한", () => {
    let s = patchUnit(fresh(), "이숙", { x: 1, y: 3, agility: 1, rangeMin: 1, rangeMax: 1, troops: 9999, maxTroops: 9999 });
    s = patchUnit(s, "관우", { agility: 100, baseMove: 2, troops: 95, maxTroops: 100, lifestealPercent: 100 });
    const { state } = applyAction(testCtx, s, { type: "attack", unitId: "관우", targetId: "이숙" });
    expect(get(state, "관우").troops).toBe(100); // 상한 클램프
  });
});
```

- [ ] **Step 2: 실패 확인** — Run: `pnpm --filter @tk/engine exec vitest run actions` → FAIL.

- [ ] **Step 3: 구현**

`packages/engine/src/actions.ts` resolveStrike에서, dealDamage + grantExp 처리 **뒤**(상태이상 부여 루프 **앞**)에 삽입:
```ts
  // 흡혈(Phase E) — 입힌 피해 비례 자가 회복 + troopsHealed 이벤트(회복도 이벤트로 서술).
  if (attacker.lifestealPercent && dmg > 0) {
    const heal = Math.floor(dmg * attacker.lifestealPercent / 100);
    if (heal > 0) {
      const h = healTroops(next, getUnit(next, attackerId), heal);
      next = h.state;
      if (h.healed > 0) events.push({ type: "troopsHealed", unitId: attackerId, amount: h.healed });
    }
  }
```
(`healTroops`는 actions.ts에 이미 정의됨 — `{ state, healed }` 반환.)

- [ ] **Step 4: 통과 + 엔진 회귀** — Run: `pnpm --filter @tk/engine exec vitest run` → PASS.

- [ ] **Step 5: 커밋**
```bash
git add packages/engine/src/actions.ts packages/engine/test/actions.test.ts
git commit -m "feat(engine): 흡혈 — resolveStrike 피해 비례 회복 + troopsHealed

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: troopsHealed 프레젠터 투영

**Files:**
- Modify: `apps/web/src/battle/eventPlayer.ts` (Presenter + dispatch)
- Modify: `apps/web/src/battle/__tests__/fakePresenter.ts` (투영)
- Modify: `apps/web/src/pixi/BattleRenderer.ts` (연출)
- Test: `apps/web/src/battle/__tests__/eventPlayer.test.ts`

- [ ] **Step 1: 실패 테스트**

`apps/web/src/battle/__tests__/eventPlayer.test.ts`의 "상태이상 statusTick 투영" describe 안(또는 새 it):
```ts
  it("troopsHealed는 TrackingPresenter troops를 증가(이벤트 자기서술)", async () => {
    const tp = new TrackingPresenter();
    tp.prime(state0);
    const u = state0.units.find((x) => x.troops > 0)!;
    await tp.troopsHealed!({ type: "troopsHealed", unitId: u.id, amount: 25 });
    expect(tp.snapshot!()!.units.find((x) => x.id === u.id)!.troops).toBe(u.troops + 25);
  });
```

- [ ] **Step 2: 실패 확인** — Run: `pnpm --filter web exec vitest run eventPlayer` → FAIL.

- [ ] **Step 3: Presenter + dispatch**

`eventPlayer.ts` Presenter 인터페이스에 `statusTick?` 근처:
```ts
  /** 회복(흡혈·회복책략) — troops 증가 투영 필수. */
  troopsHealed?(e: Ev<"troopsHealed">): Promise<void>;
```
dispatch에 `case "statusExpired"` 다음:
```ts
      case "troopsHealed":
        return p.troopsHealed?.(e) ?? Promise.resolve();
```

- [ ] **Step 4: FakePresenter 투영**

`fakePresenter.ts` FakePresenter에 메서드 추가(`statusExpired` 다음):
```ts
  troopsHealed(e: Ev<"troopsHealed">): Promise<void> {
    return this.handle(e);
  }
```
TrackingPresenter `onEvent` switch에 `case "statusTick"` 다음:
```ts
      case "troopsHealed": { // 회복 — troops 증가(damageDealt의 역)
        const u = this.units.get(e.unitId);
        if (u) u.troops += e.amount;
        break;
      }
```

- [ ] **Step 5: BattleRenderer 연출**

`apps/web/src/pixi/BattleRenderer.ts`에 statusApplied 근처:
```ts
  async troopsHealed(e: Ev<"troopsHealed">): Promise<void> {
    const s = this.scene;
    if (!s) return;
    const u = s.units.view(e.unitId);
    const at = gridToWorld({ x: u.gridX, y: u.gridY });
    await s.fx.healPopup?.(at, e.amount); // healPopup 없으면 damagePopup 음수/별색 — 정독 후 맞춤
    u.setTroops(u.troops + e.amount);
  }
```
⚠️ `s.fx.healPopup` 존재 여부 정독 — 없으면 기존 회복 연출 API(useItem 회복 경로) 재사용 또는 간단 flash.
핵심: `setTroops(+amount)` 필수.

- [ ] **Step 6: 통과 + web 회귀** — Run: `pnpm --filter web exec vitest run` → PASS.

- [ ] **Step 7: 타입체크(web)** — Run: `pnpm --filter web exec tsc --noEmit` → 에러 0.

- [ ] **Step 8: 커밋**
```bash
git add apps/web/src/battle/eventPlayer.ts apps/web/src/battle/__tests__/fakePresenter.ts apps/web/src/battle/__tests__/eventPlayer.test.ts apps/web/src/pixi/BattleRenderer.ts
git commit -m "feat(web): troopsHealed 프레젠터 투영 + 회복 연출(흡혈)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: 아이템 데이터 + 시작 장비 배선

**Files:**
- Modify: `packages/data/json/items.json`
- Modify: `packages/data/json/initialForces.json`
- Test: `packages/data/test/data.test.ts` (또는 engine createBattle 통합 테스트)

- [ ] **Step 1: 실패 테스트 (★ 로드아웃 통합)**

`packages/engine/test/createBattle.test.ts`에 추가:
```ts
  it("Phase E 배선: ★4 시그니처 무기 효과가 적용된다", () => {
    const s = createBattle(testCtx, 1);
    const guan = s.units.find((u) => u.id === "관우");
    const yu = s.units.find((u) => u.id === "유비");
    const fei = s.units.find((u) => u.id === "장비");
    // testCtx(사수관)엔 유비/관우/장비 존재. 조운은 후반 — initialForces 직접 검증.
    if (guan) expect(guan.noCounter).toBe(true);       // 청룡언월도
    if (fei) expect(fei.multiHit).toBe(2);             // 사모 관통
    if (yu) expect(yu.counterStrikes).toBe(2);         // 쌍고검 재반격
  });
```
(⚠️ 사수관 testCtx에 유비가 있는지 정독 — 없으면 해당 단언은 if 가드로 스킵, initialForces 데이터 테스트로 보강.)

- [ ] **Step 2: 실패 확인** — Run: `pnpm --filter @tk/engine exec vitest run createBattle` → FAIL.

- [ ] **Step 3: items.json — 기존 효과 추가**

청룡언월도(라인 ~116)의 `"bonusPercent": 12` 를:
```json
    "bonusPercent": 12,
    "effects": { "noCounter": true }
```
사모(라인 ~138)의 `"bonusPercent": 10` 를:
```json
    "bonusPercent": 10,
    "effects": { "multiHit": 2 }
```
방천화극(라인 ~131)의 `"bonusPercent": 18` 를:
```json
    "bonusPercent": 18,
    "effects": { "lifestealPercent": 50, "inflictStatus": { "kind": "immobilize", "chance": 100, "turns": 1 } }
```

- [ ] **Step 4: items.json — 신규 2종**

마지막 항목 `"오자의병법서": {...}` 다음(닫는 `}` 전)에 추가:
```json
  ,
  "쌍고검": {
    "id": "쌍고검",
    "name": "쌍고검",
    "category": "weapon",
    "power": 255,
    "bonusPercent": 0,
    "effects": { "counterStrikes": 2 }
  },
  "용담창": {
    "id": "용담창",
    "name": "용담창",
    "category": "weapon",
    "power": 255,
    "bonusPercent": 0,
    "effects": { "rangeBonus": 1 }
  }
```

- [ ] **Step 5: initialForces.json — 시작 장비**

유비 `"items": []` → `"items": ["쌍고검"]`.
조운 `"items": []` → `"items": ["용담창"]`.
(유비는 파일 상단, 조운은 ~464행. 정확히 해당 블록만. CRLF 보존 — 한 줄 교체라 Edit 안전.)

- [ ] **Step 6: 통과 + 데이터·엔진 회귀**

Run: `pnpm --filter @tk/data exec vitest run` → PASS(items 로드).
Run: `pnpm --filter @tk/engine exec vitest run createBattle` → PASS(★ 효과 적용).

- [ ] **Step 7: 커밋**
```bash
git add packages/data/json/items.json packages/data/json/initialForces.json packages/engine/test/createBattle.test.ts
git commit -m "feat(data): ★ 시그니처 무기 배선 — 청룡언월도 무반격·사모 관통·쌍고검·용담창·방천화극 흡혈

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 6: 재밸런스 (report-card 재생성 + BASELINE 재스냅샷)

**Files:**
- Modify: `docs/reference/balance-report.md` (재생성)
- Modify: `packages/sim/test/reportCard.test.ts` (BASELINE_LABELS)

> ⚠️ E는 **의도적 밸런스 변동**. greedy@0 전 스테이지 승리 + IMPASSABLE 0 유지가 불가침. 라벨 변동은 검수 후 갱신.

- [ ] **Step 1: report-card 재생성 + 변동 확인**

Run: `pnpm --filter @tk/sim report-card`
그다음: `git diff docs/reference/balance-report.md` 로 어떤 스테이지 라벨이 바뀌었는지 본다.
Expected: 일부 HEALTHY→EASY(플레이어 강화). **IMPASSABLE 0·greedy@0 전승**이어야 함.

- [ ] **Step 2: 게이트 우선 검증 (라벨 갱신 전)**

Run: `pnpm --filter @tk/sim exec vitest run reportCard`
- 게이트가 "greedy@0 전 스테이지 승리 + 불가 0"이면 PASS여야 함(라벨 스냅샷만 실패 가능).
- 만약 greedy@0 **패배** 스테이지가 생겼으면 → 플레이어 강화로 패배는 비정상 → 원인 조사(버그). 패배 0 확인 필수.

- [ ] **Step 3: BASELINE_LABELS 재스냅샷**

`packages/sim/test/reportCard.test.ts`의 `BASELINE_LABELS`를 Step 1 재생성 결과의 새 라벨로 갱신
(바뀐 스테이지만). 주석에 "Phase E 배선으로 의도적 변동(2026-06-16)" 한 줄 남긴다.

- [ ] **Step 4: 게이트 통과** — Run: `pnpm --filter @tk/sim exec vitest run reportCard` → PASS.

- [ ] **Step 5: 커밋**
```bash
git add packages/sim/test/reportCard.test.ts docs/reference/balance-report.md
git commit -m "balance(sim): Phase E 배선 재기준선 — BASELINE_LABELS 갱신(의도적 변동)

★ 시그니처 무기 배선으로 플레이어 강화 → 일부 스테이지 EASY化. greedy@0 전승·불가 0 유지.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 7: 전 패키지 회귀 + 타입체크

- [ ] **Step 1: 모노레포 테스트** — Run: `pnpm -r test` → 전부 green.
- [ ] **Step 2: 타입체크** — Run: `pnpm -r typecheck` → 에러 0.

---

## Self-Review

- **Spec 커버리지**: §1 효과2(T1)·§2 흡혈이벤트(T2,T3)·§3 rangeBonus(T2)·§4 아이템데이터(T5)·§5 시작장비(T5)·
  §6 재밸런스(T6)·§7 표시(T4 BattleRenderer)·§9 테스트(각)·§10 비침범(T6 게이트).
- **플레이스홀더**: 순수/엔진/데이터 코드 완전. T4 Step5(healPopup)·T5 Step1(유비 존재 여부)은 "정독 후 맞춤"
  명시 — 핵심 계약(setTroops 증가·효과 적용) 고정.
- **타입 일관성**: `rangeBonus`·`lifestealPercent`·`troopsHealed`·`counterStrikes`·`multiHit`·`noCounter` 일치.
  healTroops·resolveStrike 기존 시그니처 재사용.
- **재밸런스 특수성**: A~D는 "불변" 게이트였으나 E는 의도적 변동 — Step2가 greedy@0 패배 0(불가침)을 먼저
  검증하고 Step3에서 라벨만 갱신. 패배 발생 시 버그로 간주(플레이어 강화는 승률을 낮추지 않음).
