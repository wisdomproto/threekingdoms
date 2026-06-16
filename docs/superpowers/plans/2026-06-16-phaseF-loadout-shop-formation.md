# ★ 시작 로드아웃 + 상점·편성 UX (Phase F) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 네임드(★4)가 캠페인 시작부터 시그니처 무기를 장착하게 하고(roster startItems), `/prep` 막간을 탭 셸 [편성|상점]로 재구성해 전 효과(무반격·관통·흡혈·상태이상 등)를 문구로 보여주고 전력·장착 미리보기·정렬·NEW·출진 바를 더한다.

**Architecture:** 표시·전력·요약 로직을 순수 헬퍼(effectText/unitStats/rosterSort/sortieSummary)로 빼 node 테스트하고, React(PrepShell/Shop/Formation/SortieBar)는 표현에 집중. ★ 로드아웃은 RosterEntry.startItems → selectRoster 기본값. 전력은 전투와 같은 엔진 함수(attackPower+defensePower) 재사용.

**Tech Stack:** TypeScript, Next.js, React, pnpm 모노레포, vitest(핀 2.1 — `pnpm --filter @tk/<pkg> exec vitest run` / `pnpm --filter web exec vitest run`).

**Spec:** docs/superpowers/specs/2026-06-16-phaseF-loadout-shop-formation-design.md (+ 베이스 2026-06-16-prep-shop-formation-ux-design.md)

---

## 파일 구조

| 파일 | 변경 |
|---|---|
| `packages/data/src/schemas.ts` | RosterEntry.startItems (T1) |
| `packages/data/json/rosters.json` | ★4 startItems (T1) |
| `apps/web/src/meta/metaStore.ts` | selectRoster equipped 기본값 (T1) |
| `apps/web/src/meta/screens/shopItemView.ts` | effectText 확장 + buildShopGroups (T2,T3) |
| `apps/web/src/meta/unitStats.ts` (신규) | 순수 전력/스탯 (T4) |
| `apps/web/src/meta/screens/rosterSort.ts` (신규) | 순수 정렬 (T5) |
| `apps/web/src/meta/screens/sortieSummary.ts` (신규) | 순수 요약/경고 (T6) |
| `apps/web/src/meta/screens/SortieBar.tsx` (신규) | 고정 출진 바 (T7) |
| `apps/web/app/prep/PrepShell.tsx` | 탭 셸 + SortieBar (T7) |
| `apps/web/src/meta/screens/Shop.tsx` | 카테고리 그룹 헤더 (T8) |
| `apps/web/src/meta/screens/Formation.tsx` | 정렬칩·전력·NEW·인라인 장착+델타+효과문구 (T9) |

---

## Task 1: ★ 시작 로드아웃 (RosterEntry.startItems)

**Files:**
- Modify: `packages/data/src/schemas.ts` (RosterEntrySchema)
- Modify: `packages/data/json/rosters.json` (★4)
- Modify: `apps/web/src/meta/metaStore.ts` (selectRoster)
- Test: `packages/data/test/data.test.ts` + `apps/web/src/meta/__tests__/metaStore.test.ts`

- [ ] **Step 1: 실패 테스트 (metaStore selectRoster)**

`apps/web/src/meta/__tests__/metaStore.test.ts`에 추가(describe 안):
```ts
import { gameData } from "@tk/data";
it("selectRoster: 진행 없는 ★는 equipped=startItems, 진행 있으면 진행 우선 (Phase F)", () => {
  const fresh = initialMeta();
  const r = selectRoster(fresh, gameData.rosters, 1);
  expect(r.find((u) => u.commanderId === "유비")!.equipped).toEqual(["쌍고검"]);
  expect(r.find((u) => u.commanderId === "관우")!.equipped).toEqual(["청룡언월도"]);
  const withProg = { ...fresh, rosterProgress: { 유비: { level: 1, exp: 0, equipped: ["청강검"] } } };
  expect(selectRoster(withProg, gameData.rosters, 1).find((u) => u.commanderId === "유비")!.equipped).toEqual(["청강검"]);
});
```
(`initialMeta`·`selectRoster` import 확인 — metaStore.test.ts에 이미 reducer import 패턴 있음. `gameData` 추가.)

- [ ] **Step 2: 실패 확인** — Run: `pnpm --filter web exec vitest run metaStore` → FAIL (startItems 없음 → equipped []).

- [ ] **Step 3: 스키마**

`packages/data/src/schemas.ts` `RosterEntrySchema`의 `uniqueSkillId` 줄 다음에:
```ts
  startItems: z.array(z.string()).default([]),  // ★ 시작 장비(Phase F) — selectRoster equipped 기본값
```

- [ ] **Step 4: rosters.json ★4**

`packages/data/json/rosters.json`의 유비/관우/장비/조운 항목에 `"startItems"` 추가:
```json
  "유비": { "commanderId": "유비", "classId": "lord", "joinChapter": 1, "role": "lord", "uniqueSkillId": "인덕", "startItems": ["쌍고검"] },
  "관우": { "commanderId": "관우", "classId": "lightCavalry", "joinChapter": 1, "role": "melee", "uniqueSkillId": "무성", "startItems": ["청룡언월도"] },
  "장비": { "commanderId": "장비", "classId": "lightCavalry", "joinChapter": 1, "role": "melee", "uniqueSkillId": "포효", "startItems": ["사모"] },
  "조운": { "commanderId": "조운", "classId": "lightCavalry", "joinChapter": 3, "role": "melee", "uniqueSkillId": "단기필마", "startItems": ["용담창"] },
```
(각 줄의 기존 필드 보존 + startItems만 추가. CRLF 보존 — 한 줄 교체.)

- [ ] **Step 5: selectRoster 기본값**

`apps/web/src/meta/metaStore.ts` selectRoster의 `equipped: p?.equipped ?? [],` 를:
```ts
      equipped: p?.equipped ?? entry.startItems,
```
(RosterEntry.startItems는 schema default []라 항상 배열 — 안전.)

- [ ] **Step 6: 통과 + 데이터·web 회귀**

Run: `pnpm --filter @tk/data exec vitest run` → PASS.
Run: `pnpm --filter web exec vitest run metaStore sortieFlow` → PASS.

- [ ] **Step 7: 커밋**
```bash
git add packages/data/src/schemas.ts packages/data/json/rosters.json apps/web/src/meta/metaStore.ts apps/web/src/meta/__tests__/metaStore.test.ts
git commit -m "feat: ★ 시작 로드아웃 — RosterEntry.startItems + selectRoster 기본값(유비 쌍고검 등)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: effectText 전 효과 확장

**Files:**
- Modify: `apps/web/src/meta/screens/shopItemView.ts` (effectText)
- Test: `apps/web/src/meta/__tests__/shopItemView.test.ts`

- [ ] **Step 1: 실패 테스트**

`apps/web/src/meta/__tests__/shopItemView.test.ts`에 추가:
```ts
import { effectText } from "../screens/shopItemView";
describe("effectText 전 효과(Phase F)", () => {
  const it_ = (effects: any) => ({ id: "x", name: "x", category: "weapon" as const, power: 255, bonusPercent: 0, effects });
  it("무반격·관통·재반격·고정뎀·필중", () => {
    expect(effectText(it_({ noCounter: true }))).toBe("무반격");
    expect(effectText(it_({ multiHit: 3 }))).toBe("관통 3격");
    expect(effectText(it_({ counterStrikes: 2 }))).toBe("재반격 2회");
    expect(effectText(it_({ flatDamagePerLevel: 15 }))).toBe("고정 피해(방어무시)");
    expect(effectText(it_({ alwaysHit: true }))).toBe("필중");
  });
  it("흡혈·사거리·상태이상·복합", () => {
    expect(effectText(it_({ lifestealPercent: 50 }))).toBe("흡혈 50%");
    expect(effectText(it_({ rangeBonus: 1 }))).toBe("사거리 +1");
    expect(effectText(it_({ inflictStatus: { kind: "poison", chance: 75, turns: 3 } }))).toBe("중독 부여 75%");
    expect(effectText(it_({ move: 1, atkPercent: 10, noCounter: true }))).toBe("이동 +1 · 공격 +10% · 무반격");
  });
});
```
> ⚠️ `effectText`를 export해야 함(현재 모듈 내부 함수). Step 3에서 export 추가.

- [ ] **Step 2: 실패 확인** — Run: `pnpm --filter web exec vitest run shopItemView` → FAIL.

- [ ] **Step 3: effectText 확장 + export**

`apps/web/src/meta/screens/shopItemView.ts`의 `effectText`를 교체(+ `export`):
```ts
const STATUS_LABEL: Record<"poison" | "seal" | "immobilize", string> = {
  poison: "중독", seal: "금책", immobilize: "부동",
};

/** 아이템 효과 한 줄 — 소모품은 회복/피해, 그 외는 effects+bonusPercent를 ' · '로 연결. */
export function effectText(item: Item): string {
  if (isConsumable(item)) {
    const verb = item.category === "supplyItem" ? "회복" : "피해";
    return `${verb} ${item.power}`;
  }
  const parts: string[] = [];
  const e = item.effects;
  if (e) {
    if (e.move) parts.push(`이동 +${e.move}`);
    if (e.atkPercent) parts.push(`공격 +${e.atkPercent}%`);
    if (e.spiritPercent) parts.push(`정신 +${e.spiritPercent}%`);
    if (e.defensePercent) parts.push(`받는 피해 −${e.defensePercent}%`);
    if (e.rangeBonus) parts.push(`사거리 +${e.rangeBonus}`);
    if (e.multiHit) parts.push(`관통 ${e.multiHit}격`);
    if (e.counterStrikes && e.counterStrikes > 1) parts.push(`재반격 ${e.counterStrikes}회`);
    if (e.noCounter) parts.push("무반격");
    if (e.doubleStrike) parts.push("연속공격");
    if (e.flatDamagePerLevel) parts.push("고정 피해(방어무시)");
    if (e.alwaysHit) parts.push("필중");
    if (e.lifestealPercent) parts.push(`흡혈 ${e.lifestealPercent}%`);
    if (e.inflictStatus) parts.push(`${STATUS_LABEL[e.inflictStatus.kind]} 부여 ${e.inflictStatus.chance}%`);
  }
  if (item.bonusPercent > 0) parts.push(`+${item.bonusPercent}%`);
  return parts.length ? parts.join(" · ") : "고유 효과";
}
```

- [ ] **Step 4: 통과 + web 회귀** — Run: `pnpm --filter web exec vitest run shopItemView` → PASS.

- [ ] **Step 5: 커밋**
```bash
git add apps/web/src/meta/screens/shopItemView.ts apps/web/src/meta/__tests__/shopItemView.test.ts
git commit -m "feat(web): effectText 전 효과 문구 확장(무반격·관통·흡혈·상태이상 등)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: buildShopGroups (카테고리 그룹)

**Files:**
- Modify: `apps/web/src/meta/screens/shopItemView.ts`
- Test: `apps/web/src/meta/__tests__/shopItemView.test.ts`

- [ ] **Step 1: 실패 테스트**
```ts
import { buildShopGroups } from "../screens/shopItemView";
it("buildShopGroups: 카테고리 순서대로 그룹, 빈 그룹 제외", () => {
  const rows = [
    { itemId: "a", name: "검", category: "weapon" as const, categoryLabel: "무기", effect: "", consumable: false, price: 1, affordable: true, owned: 0 },
    { itemId: "b", name: "약", category: "supplyItem" as const, categoryLabel: "소모품", effect: "", consumable: true, price: 1, affordable: true, owned: 0 },
    { itemId: "c", name: "말", category: "horse" as const, categoryLabel: "탈것", effect: "", consumable: false, price: 1, affordable: true, owned: 0 },
  ];
  const g = buildShopGroups(rows);
  expect(g.map((x) => x.category)).toEqual(["weapon", "horse", "supplyItem"]); // 정의 순서, 빈 그룹 없음
  expect(g[0]!.rows.map((r) => r.itemId)).toEqual(["a"]);
});
```

- [ ] **Step 2: 실패 확인** — Run: `pnpm --filter web exec vitest run shopItemView` → FAIL.

- [ ] **Step 3: 구현**

`shopItemView.ts`에 추가:
```ts
const CATEGORY_ORDER: Item["category"][] = ["weapon", "treasure", "horse", "book", "supplyItem", "attackItem"];

export interface ShopGroup { category: Item["category"]; label: string; rows: ShopRow[]; }

/** 진열 행을 카테고리별로 그룹(정의 순서, 빈 그룹 제외). 순수. */
export function buildShopGroups(rows: ShopRow[]): ShopGroup[] {
  return CATEGORY_ORDER.flatMap((cat) => {
    const rs = rows.filter((r) => r.category === cat);
    return rs.length ? [{ category: cat, label: rs[0]!.categoryLabel, rows: rs }] : [];
  });
}
```

- [ ] **Step 4: 통과** — Run: `pnpm --filter web exec vitest run shopItemView` → PASS.

- [ ] **Step 5: 커밋**
```bash
git add apps/web/src/meta/screens/shopItemView.ts apps/web/src/meta/__tests__/shopItemView.test.ts
git commit -m "feat(web): buildShopGroups — 상점 카테고리 그룹핑(순수)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: unitStats.ts (순수 전력/스탯)

**Files:**
- Create: `apps/web/src/meta/unitStats.ts`
- Test: `apps/web/src/meta/__tests__/unitStats.test.ts` (신규)

- [ ] **Step 1: 실패 테스트**

`apps/web/src/meta/__tests__/unitStats.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { unitStats } from "../unitStats";

describe("unitStats (전력 — 전투 엔진 재사용)", () => {
  it("결정론 + 아이템 단조성(atkPercent↑→power↑)", () => {
    const base = unitStats("관우", "lightCavalry", 1, []);
    expect(unitStats("관우", "lightCavalry", 1, [])).toEqual(base); // 결정론
    expect(base.power).toBe(base.atk + base.def);
  });
  it("청룡언월도(공격% 등) 장착 시 전력 ≥ 미장착", () => {
    const bare = unitStats("관우", "lightCavalry", 1, []);
    const armed = unitStats("관우", "lightCavalry", 1, ["청룡언월도"]);
    expect(armed.power).toBeGreaterThanOrEqual(bare.power);
  });
});
```

- [ ] **Step 2: 실패 확인** — Run: `pnpm --filter web exec vitest run unitStats` → FAIL (모듈 없음).

- [ ] **Step 3: 구현**

`apps/web/src/meta/unitStats.ts`:
```ts
/**
 * 편성/상점 표시용 전력·스탯 — 전투와 동일 엔진 함수 재사용(결정론, §2-1). 병력 무관(명목 100).
 * 전력 = attackPower + defensePower (장수+병종+레벨+아이템 반영, force.ts와 동일 정의).
 */
import { spawnUnit, attackPower, defensePower, spiritPower } from "@tk/engine";
import { gameData } from "@tk/data";

export interface UnitStatLine { atk: number; def: number; spirit: number; move: number; power: number; }

export function unitStats(commanderId: string, classId: string, level: number, items: string[]): UnitStatLine {
  const u = spawnUnit(gameData, {
    commanderId, classId, level, troops: 100, items: [...items], side: "player", x: 0, y: 0,
  });
  const atk = attackPower(u);
  const def = defensePower(u);
  return { atk, def, spirit: spiritPower(u), move: u.move, power: atk + def };
}
```

- [ ] **Step 4: 통과** — Run: `pnpm --filter web exec vitest run unitStats` → PASS.

- [ ] **Step 5: 커밋**
```bash
git add apps/web/src/meta/unitStats.ts apps/web/src/meta/__tests__/unitStats.test.ts
git commit -m "feat(web): unitStats — 편성/상점 전력(전투 엔진 재사용, 순수)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: rosterSort.ts (순수 정렬)

**Files:**
- Create: `apps/web/src/meta/screens/rosterSort.ts`
- Test: `apps/web/src/meta/__tests__/rosterSort.test.ts` (신규)

- [ ] **Step 1: 실패 테스트**

`apps/web/src/meta/__tests__/rosterSort.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { sortRoster, type SortKey } from "../screens/rosterSort";
import type { RosterUnit } from "../metaStore";

const U = (commanderId: string, role: RosterUnit["role"], joinChapter: number, level: number): RosterUnit =>
  ({ commanderId, classId: "footman", joinChapter, role, level, exp: 0, equipped: [] });

describe("sortRoster", () => {
  const roster = [U("a", "melee", 1, 5), U("b", "lord", 1, 3), U("c", "melee", 3, 9)];
  it("레벨순 내림차순", () => {
    expect(sortRoster(roster, "level", 1).map((u) => u.commanderId)).toEqual(["c", "a", "b"]);
  });
  it("역할순: lord 먼저", () => {
    expect(sortRoster(roster, "role", 1)[0]!.role).toBe("lord");
  });
  it("NEW: 현재 챕터 합류 먼저", () => {
    expect(sortRoster(roster, "new", 3)[0]!.commanderId).toBe("c"); // joinChapter 3 == 챕터 3
  });
});
```

- [ ] **Step 2: 실패 확인** — Run: `pnpm --filter web exec vitest run rosterSort` → FAIL.

- [ ] **Step 3: 구현**

`apps/web/src/meta/screens/rosterSort.ts`:
```ts
import type { RosterUnit } from "../metaStore";
import { unitStats } from "../unitStats";

export type SortKey = "power" | "level" | "role" | "new";

const ROLE_ORDER: Record<RosterUnit["role"], number> = { lord: 0, melee: 1, caster: 2, support: 3, guest: 4 };
const power = (u: RosterUnit): number => unitStats(u.commanderId, u.classId, u.level, u.equipped).power;

/** 후보 정렬(순수) — 동률은 commanderId 안정 정렬. */
export function sortRoster(roster: RosterUnit[], key: SortKey, chapter: number): RosterUnit[] {
  const tie = (a: RosterUnit, b: RosterUnit) => a.commanderId.localeCompare(b.commanderId);
  const arr = [...roster];
  switch (key) {
    case "power": return arr.sort((a, b) => power(b) - power(a) || tie(a, b));
    case "level": return arr.sort((a, b) => b.level - a.level || tie(a, b));
    case "role": return arr.sort((a, b) => ROLE_ORDER[a.role] - ROLE_ORDER[b.role] || tie(a, b));
    case "new": return arr.sort((a, b) =>
      Number(b.joinChapter === chapter) - Number(a.joinChapter === chapter) || power(b) - power(a) || tie(a, b));
  }
}
```

- [ ] **Step 4: 통과** — Run: `pnpm --filter web exec vitest run rosterSort` → PASS.

- [ ] **Step 5: 커밋**
```bash
git add apps/web/src/meta/screens/rosterSort.ts apps/web/src/meta/__tests__/rosterSort.test.ts
git commit -m "feat(web): rosterSort — 후보 정렬(전력/레벨/역할/NEW, 순수)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 6: sortieSummary.ts (순수 요약/경고)

**Files:**
- Create: `apps/web/src/meta/screens/sortieSummary.ts`
- Test: `apps/web/src/meta/__tests__/sortieSummary.test.ts` (신규)

- [ ] **Step 1: 실패 테스트**

`apps/web/src/meta/__tests__/sortieSummary.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { sortieSummary } from "../screens/sortieSummary";
import type { RosterUnit } from "../metaStore";
import type { SortieMember } from "../sortie";

const RU = (id: string, role: RosterUnit["role"]): RosterUnit =>
  ({ commanderId: id, classId: "footman", joinChapter: 1, role, level: 1, exp: 0, equipped: [] });
const SM = (id: string): SortieMember => ({ commanderId: id, classId: "footman", level: 1, exp: 0, items: [] });

describe("sortieSummary", () => {
  const roster = [RU("유비", "lord"), RU("관우", "melee")];
  it("선택 0명 → emptyDefault, 경고 없음", () => {
    const r = sortieSummary([], roster, 3, 1);
    expect(r.emptyDefault).toBe(true);
    expect(r.count).toBe(0);
  });
  it("군주 미편성 + 빈 슬롯 경고", () => {
    const r = sortieSummary([SM("관우")], roster, 3, 1);
    expect(r.count).toBe(1);
    expect(r.warnings.some((w) => w.includes("군주"))).toBe(true);
    expect(r.warnings.some((w) => w.includes("빈 슬롯"))).toBe(true);
    expect(r.emptyDefault).toBe(false);
  });
});
```

- [ ] **Step 2: 실패 확인** — Run: `pnpm --filter web exec vitest run sortieSummary` → FAIL.

- [ ] **Step 3: 구현**

`apps/web/src/meta/screens/sortieSummary.ts`:
```ts
import type { RosterUnit } from "../metaStore";
import type { SortieMember } from "../sortie";
import { unitStats } from "../unitStats";

export interface SortieSummary { count: number; totalPower: number; warnings: string[]; emptyDefault: boolean; }

/** 출진 요약·권고 경고(순수). 출진은 항상 가능 — 경고는 노란 권고일 뿐(sortie.ts 계약). */
export function sortieSummary(
  selected: SortieMember[], roster: RosterUnit[], maxSlots: number, chapter: number,
): SortieSummary {
  if (selected.length === 0) {
    return { count: 0, totalPower: 0, warnings: [], emptyDefault: true };
  }
  const totalPower = selected.reduce((s, m) => s + unitStats(m.commanderId, m.classId, m.level, m.items).power, 0);
  const warnings: string[] = [];
  const slotsLeft = maxSlots - selected.length;
  if (slotsLeft > 0) warnings.push(`빈 슬롯 ${slotsLeft}개`);
  const lordInRoster = roster.some((u) => u.role === "lord");
  const lordSelected = selected.some((m) => roster.find((u) => u.commanderId === m.commanderId)?.role === "lord");
  if (lordInRoster && !lordSelected) warnings.push("군주 미편성");
  return { count: selected.length, totalPower, warnings, emptyDefault: false };
}
```

- [ ] **Step 4: 통과** — Run: `pnpm --filter web exec vitest run sortieSummary` → PASS.

- [ ] **Step 5: 커밋**
```bash
git add apps/web/src/meta/screens/sortieSummary.ts apps/web/src/meta/__tests__/sortieSummary.test.ts
git commit -m "feat(web): sortieSummary — 출진 요약·권고 경고(순수)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 7: SortieBar + PrepShell 탭 셸

**Files:**
- Create: `apps/web/src/meta/screens/SortieBar.tsx`
- Modify: `apps/web/app/prep/PrepShell.tsx`

> React 통합 — 단위 테스트 대신 타입체크 + 기존 web 테스트 + 수동 검증. 정독 후 정확 배치.

- [ ] **Step 1: SortieBar.tsx (고정 바)**

`apps/web/src/meta/screens/SortieBar.tsx` — props `{ summary: SortieSummary; maxSlots: number; onSortie: () => void }`:
```tsx
"use client";
import type { CSSProperties } from "react";
import type { SortieSummary } from "./sortieSummary";

const BAR: CSSProperties = {
  position: "sticky", bottom: 0, marginTop: 12, padding: "10px 14px", display: "flex",
  justifyContent: "space-between", alignItems: "center", gap: 12,
  border: "2px solid #c9a24b", borderRadius: 8, background: "#1a1610", color: "#e8e6e3",
};

export function SortieBar({ summary, maxSlots, onSortie }: { summary: SortieSummary; maxSlots: number; onSortie: () => void }): React.ReactElement {
  return (
    <div style={BAR}>
      <span style={{ fontSize: 13 }}>
        출전 <b style={{ color: "#4da3ff" }}>{summary.count}</b><span style={{ color: "#6b727c" }}>/{maxSlots}</span>
        {summary.emptyDefault
          ? <span style={{ color: "#9aa3ad" }}> · 기본 편성으로 출진</span>
          : <>
              <span style={{ color: "#caa86a" }}> · 총전력 {summary.totalPower}</span>
              {summary.warnings.map((w) => <span key={w} style={{ color: "#e0a030" }}> · ⚠ {w}</span>)}
            </>}
      </span>
      <button type="button" onClick={onSortie} style={{ padding: "8px 24px", border: "1px solid #c9a24b", borderRadius: 6, background: "rgba(201,162,75,0.18)", color: "#caa86a", cursor: "pointer", fontWeight: 700 }}>
        출진 ▶
      </button>
    </div>
  );
}
```

- [ ] **Step 2: PrepShell 탭 셸**

`apps/web/app/prep/PrepShell.tsx` 정독 후:
- `const [tab, setTab] = useState<"formation" | "shop">("formation");` 추가.
- `const summary = useMemo(() => sortieSummary(selected, roster, maxSlots, chapter), [selected, roster, maxSlots, chapter]);` (import sortieSummary).
- 기존 `<Shop/>`+`<Formation/>` 세로 스택을 **탭 전환**으로: 상단에 탭 버튼 2개([편성][상점]), 활성 탭만 렌더.
- 하단의 기존 `<button>출진 ▶</button>`을 `<SortieBar summary={summary} maxSlots={maxSlots} onSortie={onSortie} />`로 교체.
- import: `import { SortieBar } from "../../src/meta/screens/SortieBar"; import { sortieSummary } from "../../src/meta/screens/sortieSummary";`
구체 JSX는 기존 구조(헤더/Shop/Formation props 불변)를 보존하며 탭+바만 교체.

- [ ] **Step 3: web 회귀 + 타입체크**

Run: `pnpm --filter web exec vitest run` → PASS(기존).
Run: `pnpm --filter web exec tsc --noEmit` → 에러 0.

- [ ] **Step 4: 커밋**
```bash
git add apps/web/src/meta/screens/SortieBar.tsx apps/web/app/prep/PrepShell.tsx
git commit -m "feat(web): 탭 셸 [편성|상점] + 고정 출진 바(요약·권고 경고)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 8: Shop 카테고리 그룹 렌더

**Files:**
- Modify: `apps/web/src/meta/screens/Shop.tsx`

- [ ] **Step 1: 그룹 렌더**

`Shop.tsx` 정독 후: `buildShopRows`로 만든 rows를 `buildShopGroups(rows)`로 그룹화해, 각 그룹마다
**그룹 헤더(label)** + 그 그룹 행들을 렌더. 기존 `ShopRowView`·구매 로직 불변. import `buildShopGroups`.
효과 문구는 이미 `row.effect`(확장된 effectText)라 자동 반영.

- [ ] **Step 2: web 회귀 + 타입체크** — Run: `pnpm --filter web exec vitest run` + `pnpm --filter web exec tsc --noEmit` → PASS/에러0.

- [ ] **Step 3: 커밋**
```bash
git add apps/web/src/meta/screens/Shop.tsx
git commit -m "feat(web): 상점 카테고리 그룹 헤더 + 확장 효과 문구 노출

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 9: Formation 정렬·전력·NEW·인라인 장착

**Files:**
- Modify: `apps/web/src/meta/screens/Formation.tsx`

> Formation.tsx(442줄) 정독 필수. 핵심 변경만 — 나머지 표현 보존.

- [ ] **Step 1: 정렬 칩 + 카드 전력 + NEW 배지**

후보 목록 위에 정렬 칩 4개([전력순][레벨][역할][NEW]) — `const [sort, setSort] = useState<SortKey>("power");`,
후보를 `sortRoster(roster, sort, chapter)`로 렌더(import sortRoster). 각 후보 카드에 `unitStats(u.commanderId,
u.classId, u.level, u.equipped).power` 표시. `u.joinChapter === chapter`면 빨강 `NEW` 배지.
(`chapter`는 props로 받아야 — PrepShell에서 `chapter` 전달 추가. 없으면 Formation에 chapter prop 추가 + PrepShell Step에서 주입.)

- [ ] **Step 2: SortieRow 인라인 장착 + 델타 + 효과 문구**

SortieRow의 `<details>` 아코디언(390-419)을 **인라인 칩**으로 교체:
- 장착 후보 each: `effectText(items[itemId])`(import) + 전력 델타
  `unitStats(m.commanderId, m.classId, m.level, [...m.items, itemId]).power − unitStats(..., m.items).power`
  → 칩 라벨 `{name} 전력 +{delta}`. 탭하면 기존 `addItem`.
- 장착된 칩에도 `effectText` 요약(작게).

- [ ] **Step 3: web 회귀 + 타입체크** — Run: `pnpm --filter web exec vitest run` + `pnpm --filter web exec tsc --noEmit` → PASS/에러0.

- [ ] **Step 4: 커밋**
```bash
git add apps/web/src/meta/screens/Formation.tsx apps/web/app/prep/PrepShell.tsx
git commit -m "feat(web): 편성 — 정렬칩·카드 전력·NEW 배지·인라인 장착(델타+효과문구)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 10: 전 패키지 회귀 + 타입체크 + 수동 검증

- [ ] **Step 1: 모노레포 테스트** — Run: `pnpm -r test` → 전부 green.
- [ ] **Step 2: 타입체크** — Run: `pnpm -r typecheck` → 에러 0.
- [ ] **Step 3: 밸런스 불변 확인** — Run: `pnpm --filter @tk/sim report-card` 후 `git diff --stat docs/reference/balance-report.md` → 변경 없음(편성 UX는 sim 무관). ⚠️ startItems는 roster(메타)라 stage/sim 무영향 — 변경 0이어야 함.
- [ ] **Step 4: 수동 검증(선택)** — preview_*로 `/prep` 진입: 탭 전환·★ 기본 무기 장착 표시·효과 문구(무반격 등)·전력·NEW·출진 바 경고 확인.

---

## Self-Review

- **Spec 커버리지**: §A startItems(T1)·§B effectText(T2)·그룹(T3)·전력(T4)·정렬(T5)·요약(T6)·셸/바(T7)·
  상점(T8)·편성(T9). 베이스 스펙 4보강 전부 매핑.
- **플레이스홀더**: 순수 헬퍼(T1-T6) 완전 코드. React(T7-T9)는 "정독 후 배치" + 소비 헬퍼·핵심 변경 명시
  (large 파일이라 전체 재현 대신 편집점 특정).
- **타입 일관성**: `startItems`·`effectText`(export)·`buildShopGroups`/`ShopGroup`·`unitStats`/`UnitStatLine`·
  `sortRoster`/`SortKey`·`sortieSummary`/`SortieSummary`·`SortieBar` 전 태스크 일치. `unitStats(commanderId,
  classId, level, items)` 시그니처 T4 정의 → T5/T6/T9 동일 사용.
- **chapter prop**: Formation NEW 배지·정렬에 chapter 필요 → T9 Step1에서 Formation에 chapter prop 추가 +
  PrepShell 주입(T9 커밋에 PrepShell 포함). T7에서 PrepShell이 이미 chapter 보유(useMemo).
- **비침범**: 전력=엔진 재사용(결정론), startItems=메타라 sim 무영향(T10-3), sortie 하드블록 없음.
