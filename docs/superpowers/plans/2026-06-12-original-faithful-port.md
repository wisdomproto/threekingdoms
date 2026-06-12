# 원작 충실 재현 (Original-Faithful Port) 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 장수 능력치·병종·맵·전투 공식을 영걸전 원작과 동일하게 이식해 사수관(56×32 원작 맵)을 원작 룰로 시뮬레이션 가능하게 만든다.

**Architecture:** `tools/import-hero/`(TS 변환기)가 C:\HERO 바이너리(BAKDATA.R3/HEXZMAP.R3)를 직독해 `packages/data/json/`을 생성. 엔진은 applyAction/이벤트/페이즈 아키텍처를 유지하고 스탯 해석·데미지 공식만 원작식으로 교체. HP→병력(troops), 사기(morale) 도입, 분산 제거(명중 100%).

**Tech Stack:** 기존 모노레포 + `iconv-lite`(CP949 디코딩, importer 전용)

**Spec:** `docs/superpowers/specs/2026-06-12-original-faithful-port-design.md`
**1차 출처:** `docs/reference/yeonggeoljeon-data.md` (이하 "레퍼런스") — 모든 수치·오프셋·공식의 근거

---

## 파일 구조

```
threekingdoms/
├── .gitignore                          # 수정: out/, __pycache__ 추가
├── CLAUDE.md                           # 수정: §2/§7/§11 전략 갱신
├── tools/
│   ├── hero-extract/*.py               # 커밋 (다른 세션 작업물, out/은 제외)
│   └── import-hero/                    # 신규 TS 변환기 패키지 (@tk/import-hero)
│       ├── package.json, tsconfig.json
│       ├── src/ls11.ts                 # LS11 해제 (Python 검증 구현 포팅)
│       ├── src/bakdata.ts              # 장수 384/아이템 63/초기 편성 파싱
│       ├── src/hexzmap.ts              # 맵 58개 파싱 + 타일→지형 매핑
│       ├── src/cli.ts                  # pnpm import-hero --hero-dir C:\HERO
│       └── test/*.test.ts              # C:\HERO 없으면 skip되는 조건부 테스트
├── packages/data/
│   ├── src/schemas.ts                  # v2로 전면 개정
│   ├── src/index.ts                    # 로더 갱신
│   └── json/
│       ├── unitClasses.json            # 수동 작성: 원작 19종 (Task 3)
│       ├── terrains.json               # 수동 작성: 원작 지형 테이블 (Task 3)
│       ├── combat.json                 # 수동 작성: 원작 상수 (Task 3)
│       ├── commanders.json             # 변환기 생성: 384명 (Task 5)
│       ├── items.json                  # 변환기 생성: 63종 (Task 5)
│       ├── initialForces.json          # 변환기 생성: 초기 편성 384 (Task 5)
│       ├── maps/sishuiguan.json        # 변환기 생성: 56×32 (Task 6)
│       └── stages/05-sishuiguan.json   # 수동 작성: 원작판 (Task 9, v0 파일 교체)
└── packages/engine/src/                # types/createBattle/combat/movement 개정
```

**의존 방향 유지:** data ← engine ← sim. import-hero는 data의 스키마만 import (생성 검증용).

---

### Task 1: 하우스키핑 — 레퍼런스 커밋 · .gitignore · CLAUDE.md 갱신

**Files:**
- Modify: `.gitignore`, `CLAUDE.md`
- Commit (기존 미추적): `docs/reference/*.md`, `tools/hero-extract/*.py`

- [ ] **Step 1: .gitignore에 추가**

```
tools/hero-extract/out/
__pycache__/
test-output.txt
```

- [ ] **Step 2: 코에이 에셋이 스테이징되지 않는지 확인**

Run: `git add docs/reference tools/hero-extract .gitignore` 후 `git status --short`
Expected: `docs/reference/*.md` 2개, `tools/hero-extract/*.py`들, `.gitignore`만 스테이징. **out/ 하위 파일이 하나라도 보이면 중단하고 .gitignore 재확인** (스프라이트 PNG/음악 bin = 코에이 저작물, 푸시 금지).

- [ ] **Step 3: CLAUDE.md 갱신** — 3군데 수정:

① §2 게임 철학 리스트 끝에 추가:
```markdown
9. **v1 전략 = 원작 충실 재현 우선.** 능력치·병종·맵·전투 공식은 영걸전 원작 수치를 그대로 이식한다(근거: docs/reference/yeonggeoljeon-data.md). 차별화(병종 재편, 모바일 맵 축소, 병종 패시브 등)는 원작 재현으로 재미가 검증된 뒤 별도 단계에서 한다. 아트/연출은 처음부터 독자 노선.
```

② §7 병종 체계 섹션 전체를 다음으로 교체:
```markdown
## 7. 병종 체계 (v1 = 원작 19종)

원작 충실 재현 원칙(§2-9)에 따라 v1은 영걸전 원작 병종 19종 + 승급 3단계를 그대로 사용한다.
수치 전체는 docs/reference/yeonggeoljeon-data.md §5 및 packages/data/json/unitClasses.json 참조.

- 승급 라인: 보병(단병→장병→전차) / 궁병(궁병→연노병→발석차) / 기병(경기병→중기병→친위대) / 적병(산적→흉적→의적)
- 지원/특수: 군악대·맹수부대·무도가대·주술사·이민족·백성·수송대
- 상성: 기병계 > 보병계 > 궁병계 > 기병계 (방어력 보정 유리 0.75 / 불리 1.25)
- 간접 공격(궁병계 2칸, 발석차 3칸)은 무반격

### 차별화 백로그 (원작 재현 검증 후 별도 단계)
- 병종 10종+승급 2단계 재편 (기존 v1.0 문서의 결정 — 보류)
- 병종 패시브 1개씩 추가 (기병 돌격/보병 철벽/궁병 저격 등 — 보류)
- 수송대 삭제·인벤토리 공유 (보류)
```

③ §11 첫 줄 목록에 추가:
```markdown
- **맵 크기**: v1은 원작 맵 그대로(평균 57×39). 모바일 10~15분 세션용 축소(원작의 50~60%)는 차별화 백로그
```

- [ ] **Step 4: Commit** (한국어 메시지는 임시 파일 + `git commit -F`, UTF-8 — 이하 모든 커밋 동일)

```bash
git add .gitignore CLAUDE.md docs/reference tools/hero-extract
git commit -F <msgfile>  # "docs: 영걸전 분석 레퍼런스 커밋, 원작 충실 재현 전략을 SSOT에 반영"
```

---

### Task 2: @tk/data 스키마 v2 (TDD)

**Files:**
- Modify: `packages/data/src/schemas.ts` (전면 개정), `packages/data/test/schemas.test.ts` (전면 개정)

기존 v0 스키마/테스트는 교체한다 (git 이력에 남음). v0의 StageEventSchema(일기토)와 맵 tiles/tileLegend 메커니즘은 계승.

- [ ] **Step 1: 실패하는 테스트로 교체** — `packages/data/test/schemas.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import {
  CommanderSchema, UnitClassSchema, TerrainSchema, ItemSchema,
  CombatConfigSchema, BattleMapSchema, StageSchema, StageEventSchema,
} from "../src/schemas";

describe("스키마 v2 (원작 모델)", () => {
  it("장수: 통솔/무력/지력 1~100", () => {
    expect(() => CommanderSchema.parse({
      id: "관우", name: "관우", leadership: 100, war: 98, intelligence: 80, faceId: 1,
    })).not.toThrow();
    expect(() => CommanderSchema.parse({
      id: "x", name: "x", leadership: 101, war: 50, intelligence: 50, faceId: 0,
    })).toThrow();
  });

  it("병종: 승급 라인/티어/지형등급/사거리", () => {
    expect(() => UnitClassSchema.parse({
      id: "lightCavalry", name: "경기병", code: 6, baseAtk: 120, baseDef: 60,
      move: 6, rangeMin: 1, rangeMax: 1, line: "cavalry", tier: 1, moveClass: "cavalry",
    })).not.toThrow();
    expect(() => UnitClassSchema.parse({
      id: "x", name: "x", code: 0, baseAtk: 80, baseDef: 80,
      move: 4, rangeMin: 2, rangeMax: 1, line: "infantry", tier: 1, moveClass: "foot",
    })).toThrow(); // rangeMin > rangeMax
  });

  it("아이템: 분류/효과치/% 보정", () => {
    expect(() => ItemSchema.parse({
      id: "청룡언월도", name: "청룡언월도", category: "weapon", power: 255, bonusPercent: 12,
    })).not.toThrow();
    expect(() => ItemSchema.parse({
      id: "x", name: "x", category: "snack", power: 0, bonusPercent: 0,
    })).toThrow(); // 잘못된 분류
  });

  it("전투 설정: 원작 상수 형태", () => {
    expect(() => CombatConfigSchema.parse({
      advantageDefFactor: 0.75, disadvantageDefFactor: 1.25,
      counterRatio: 0.5, minDamage: 1, maxTurns: 30,
      lineAdvantage: { cavalry: "infantry", infantry: "archer", archer: "cavalry" },
    })).not.toThrow();
  });

  it("맵: tiles 행 길이 검증 (v0 메커니즘 계승)", () => {
    expect(() => BattleMapSchema.parse({
      id: "m", name: "m", width: 3, height: 1,
      tileLegend: { ".": "plain" }, tiles: [".."],
    })).toThrow();
  });

  it("스테이지: 배치에 병종/레벨/병력 포함, 맵은 id 참조", () => {
    expect(() => StageSchema.parse({
      id: "s", name: "s", mapId: "sishuiguan", turnLimit: 30,
      units: [{ commanderId: "관우", classId: "lightCavalry", level: 1, troops: 1120,
                items: ["청룡언월도"], side: "player", x: 0, y: 0 }],
      victory: { kind: "defeatUnit", unitId: "화웅" },
      defeat: { kind: "lordRetreat", unitId: "유비" },
      events: [],
    })).not.toThrow();
  });

  it("일기토 이벤트: winnerId 교차 검증 유지", () => {
    expect(() => StageEventSchema.parse({
      id: "e", type: "duel",
      trigger: { kind: "attack", attackerId: "관우", defenderId: "화웅" },
      outcome: { winnerId: "장비", loserRetreats: true }, once: true,
    })).toThrow();
  });
});
```

- [ ] **Step 2: 실패 확인**: `pnpm --filter @tk/data test` → FAIL

- [ ] **Step 3: 스키마 구현** — `packages/data/src/schemas.ts` 전체 교체:

```ts
import { z } from "zod";

/** 능력치 1~100 (원작 범위) */
const Stat = z.number().int().min(1).max(100);

export const CommanderSchema = z.object({
  id: z.string(),            // 한글 이름 기반 (중복 시 _2 접미)
  name: z.string(),
  leadership: Stat,          // 통솔 → 방어 공식
  war: Stat,                 // 무력 → 공격 공식
  intelligence: Stat,        // 지력 → 책략치(MP)
  faceId: z.number().int().min(0).max(255),
});
export type Commander = z.infer<typeof CommanderSchema>;

/** 승급 라인 — 상성 판정 단위 */
export const LineSchema = z.enum(["infantry", "archer", "cavalry", "bandit", "support"]);
export type Line = z.infer<typeof LineSchema>;

/** 이동 비용 분류 — terrains.moveCost의 오버라이드 키 */
export const MoveClassSchema = z.enum(["foot", "cavalry", "bandit", "archerFoot"]);
export type MoveClass = z.infer<typeof MoveClassSchema>;

export const UnitClassSchema = z.object({
  id: z.string(),
  name: z.string(),
  code: z.number().int().min(0).max(18),     // 원작 병종 코드 0x00~0x12
  baseAtk: z.number().int().min(0).max(200), // 병종 공격력 기초치
  baseDef: z.number().int().min(0).max(200),
  move: z.number().int().min(0).max(10),
  rangeMin: z.number().int().min(1),
  rangeMax: z.number().int().min(1),
  line: LineSchema,
  tier: z.number().int().min(1).max(3),      // 승급 단계
  moveClass: MoveClassSchema,
}).refine((c) => c.rangeMin <= c.rangeMax, { message: "rangeMin must be <= rangeMax" });
export type UnitClass = z.infer<typeof UnitClassSchema>;

export const TerrainSchema = z.object({
  id: z.string(),
  name: z.string(),
  guard: z.number().min(0).max(0.5),  // 데미지 경감률 (원작 최대 30%)
  // moveClass별 오버라이드, 없으면 default. 99 이상 = 통행 불가
  moveCost: z.object({ default: z.number().int().min(1) }).catchall(z.number().int().min(1)),
  healTroopsRatio: z.number().min(0).max(1).optional(), // 병영 0.1, 촌락 0.1
  healMp: z.boolean().optional(),                       // 촌락 true
});
export type Terrain = z.infer<typeof TerrainSchema>;

export const ItemSchema = z.object({
  id: z.string(),
  name: z.string(),
  category: z.enum(["weapon", "treasure", "attackItem", "supplyItem", "horse", "book"]),
  power: z.number().int().min(0).max(255),        // b13: 소모품 효과량, 255=비소모
  bonusPercent: z.number().int().min(0).max(100), // b14: 무기/병법서 % 가산
});
export type Item = z.infer<typeof ItemSchema>;

export const CombatConfigSchema = z.object({
  advantageDefFactor: z.number().positive(),     // 0.75 — 공격측 상성 유리 시 방어력 배율
  disadvantageDefFactor: z.number().positive(),  // 1.25
  counterRatio: z.number().min(0).max(1),        // 0.5
  minDamage: z.number().int().min(0),
  maxTurns: z.number().int().min(1),
  lineAdvantage: z.record(LineSchema),           // attacker line → 유리한 defender line
});
export type CombatConfig = z.infer<typeof CombatConfigSchema>;

export const SideSchema = z.enum(["player", "enemy"]);
export type Side = z.infer<typeof SideSchema>;

export const BattleMapSchema = z.object({
  id: z.string(),
  name: z.string(),
  width: z.number().int().min(1),
  height: z.number().int().min(1),
  tileLegend: z.record(z.string()),
  tiles: z.array(z.string()),
}).refine(
  (m) => m.tiles.length === m.height && m.tiles.every((r) => r.length === m.width),
  { message: "tiles must be height rows of width chars" },
);
export type BattleMap = z.infer<typeof BattleMapSchema>;

export const StageEventSchema = z.object({
  id: z.string(),
  type: z.literal("duel"),
  trigger: z.object({
    kind: z.literal("attack"),
    attackerId: z.string(),
    defenderId: z.string(),
  }),
  outcome: z.object({ winnerId: z.string(), loserRetreats: z.boolean() }),
  once: z.boolean(),
}).refine(
  (e) => e.outcome.winnerId === e.trigger.attackerId || e.outcome.winnerId === e.trigger.defenderId,
  { message: "winnerId must be attackerId or defenderId" },
);
export type StageEvent = z.infer<typeof StageEventSchema>;

export const StageUnitSchema = z.object({
  commanderId: z.string(),
  classId: z.string(),
  level: z.number().int().min(1).max(99),
  troops: z.number().int().min(1),
  items: z.array(z.string()).default([]),
  side: SideSchema,
  x: z.number().int().min(0),
  y: z.number().int().min(0),
});

export const StageSchema = z.object({
  id: z.string(),
  name: z.string(),
  mapId: z.string(),
  turnLimit: z.number().int().min(1),
  units: z.array(StageUnitSchema),
  victory: z.discriminatedUnion("kind", [
    z.object({ kind: z.literal("defeatAll") }),
    z.object({ kind: z.literal("defeatUnit"), unitId: z.string() }),
  ]),
  defeat: z.discriminatedUnion("kind", [
    z.object({ kind: z.literal("lordRetreat"), unitId: z.string() }),
  ]),
  events: z.array(StageEventSchema),
});
export type Stage = z.infer<typeof StageSchema>;
```

- [ ] **Step 4: 통과 확인** — schemas.test.ts만. `data.test.ts`와 `src/index.ts`는 다음 Task들에서 갱신되므로 **이 시점엔 일시적으로 깨진다**: `pnpm --filter @tk/data test -- schemas` 로 스키마 테스트만 실행해 7개 PASS 확인.

- [ ] **Step 5: Commit**: `feat(data): 스키마 v2 — 원작 전투 모델 (통무지·병력·19병종·아이템)`

---

### Task 3: 수동 데이터 v2 — 병종 19종·지형·전투 설정

**Files:**
- Replace: `packages/data/json/unitClasses.json`, `terrains.json`, `combat.json`
- Modify: `packages/data/src/index.ts`, `packages/data/test/data.test.ts`

근거: 레퍼런스 §5(병종/지형 표). **레터 등급 → 수치 변환 가정**: F=40, E=60, D=80, C=100, B=120, A=140 (명시 수치 80~160과의 정합 기준. 데이터 파일이므로 추후 GBA 위키로 정밀화 가능 — 가정임을 JSON 옆 주석 파일이 아니라 이 계획과 레퍼런스 문서에 기록).

- [ ] **Step 1: 실패하는 테스트로 교체** — `packages/data/test/data.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { gameData } from "../src/index";

describe("게임 데이터 v2 무결성", () => {
  it("병종 19종이 원작 코드 0~18과 1:1", () => {
    const codes = Object.values(gameData.unitClasses).map((c) => c.code).sort((a, b) => a - b);
    expect(codes).toEqual(Array.from({ length: 19 }, (_, i) => i));
  });

  it("원작 명시 기초치 스팟 체크 (레퍼런스 §5)", () => {
    const c = gameData.unitClasses;
    expect(c["footman"]).toMatchObject({ baseAtk: 80, baseDef: 80, move: 4 });      // 단병
    expect(c["chariot"]).toMatchObject({ baseAtk: 120, baseDef: 160 });             // 전차
    expect(c["lightCavalry"]).toMatchObject({ baseAtk: 120, baseDef: 60, move: 6 }); // 경기병
    expect(c["guardCavalry"]).toMatchObject({ baseAtk: 160, baseDef: 120, move: 6 }); // 친위대
    expect(c["catapult"]).toMatchObject({ move: 3, rangeMax: 3 });                  // 발석차
    expect(c["archer"]).toMatchObject({ rangeMin: 2, rangeMax: 2 });                // 궁병
  });

  it("승급 라인이 3단계로 완결된다", () => {
    for (const line of ["infantry", "archer", "cavalry", "bandit"] as const) {
      const tiers = Object.values(gameData.unitClasses)
        .filter((c) => c.line === line).map((c) => c.tier).sort();
      expect(tiers).toEqual([1, 2, 3]);
    }
  });

  it("지형: 원작 guard/이동 수치 (레퍼런스 §5 지형 표)", () => {
    const t = gameData.terrains;
    expect(t["plain"]!.guard).toBe(0);
    expect(t["forest"]!).toMatchObject({ guard: 0.2, moveCost: expect.objectContaining({ default: 2, archerFoot: 3 }) });
    expect(t["mountain"]!).toMatchObject({ guard: 0.3, moveCost: expect.objectContaining({ default: 2, cavalry: 3, bandit: 1 }) });
    expect(t["river"]!.moveCost.default).toBeGreaterThanOrEqual(99);  // 통행 불가
    expect(t["barracks"]!.healTroopsRatio).toBe(0.1);
  });

  it("전투 설정: 원작 상수", () => {
    expect(gameData.combat).toMatchObject({
      advantageDefFactor: 0.75, disadvantageDefFactor: 1.25, counterRatio: 0.5, maxTurns: 30,
    });
    expect(gameData.combat.lineAdvantage).toEqual({
      cavalry: "infantry", infantry: "archer", archer: "cavalry",
    });
  });
});
```

- [ ] **Step 2: 실패 확인**: `pnpm --filter @tk/data test` → FAIL

- [ ] **Step 3: JSON 작성**

`packages/data/json/unitClasses.json` (19종 — 레퍼런스 §5 표 그대로, 레터 등급은 위 변환표):
```json
{
  "footman":       { "id": "footman",       "name": "단병",     "code": 0,  "baseAtk": 80,  "baseDef": 80,  "move": 4, "rangeMin": 1, "rangeMax": 1, "line": "infantry", "tier": 1, "moveClass": "foot" },
  "pikeman":       { "id": "pikeman",       "name": "장병",     "code": 1,  "baseAtk": 120, "baseDef": 120, "move": 4, "rangeMin": 1, "rangeMax": 1, "line": "infantry", "tier": 2, "moveClass": "foot" },
  "chariot":       { "id": "chariot",       "name": "전차",     "code": 2,  "baseAtk": 120, "baseDef": 160, "move": 5, "rangeMin": 1, "rangeMax": 1, "line": "infantry", "tier": 3, "moveClass": "foot" },
  "archer":        { "id": "archer",        "name": "궁병",     "code": 3,  "baseAtk": 60,  "baseDef": 80,  "move": 4, "rangeMin": 2, "rangeMax": 2, "line": "archer",   "tier": 1, "moveClass": "archerFoot" },
  "crossbowman":   { "id": "crossbowman",   "name": "연노병",   "code": 4,  "baseAtk": 120, "baseDef": 80,  "move": 4, "rangeMin": 2, "rangeMax": 2, "line": "archer",   "tier": 2, "moveClass": "archerFoot" },
  "catapult":      { "id": "catapult",      "name": "발석차",   "code": 5,  "baseAtk": 160, "baseDef": 100, "move": 3, "rangeMin": 2, "rangeMax": 3, "line": "archer",   "tier": 3, "moveClass": "archerFoot" },
  "lightCavalry":  { "id": "lightCavalry",  "name": "경기병",   "code": 6,  "baseAtk": 120, "baseDef": 60,  "move": 6, "rangeMin": 1, "rangeMax": 1, "line": "cavalry",  "tier": 1, "moveClass": "cavalry" },
  "heavyCavalry":  { "id": "heavyCavalry",  "name": "중기병",   "code": 7,  "baseAtk": 140, "baseDef": 100, "move": 5, "rangeMin": 1, "rangeMax": 1, "line": "cavalry",  "tier": 2, "moveClass": "cavalry" },
  "guardCavalry":  { "id": "guardCavalry",  "name": "친위대",   "code": 8,  "baseAtk": 160, "baseDef": 120, "move": 6, "rangeMin": 1, "rangeMax": 1, "line": "cavalry",  "tier": 3, "moveClass": "cavalry" },
  "bandit":        { "id": "bandit",        "name": "산적",     "code": 9,  "baseAtk": 100, "baseDef": 80,  "move": 4, "rangeMin": 1, "rangeMax": 1, "line": "bandit",   "tier": 1, "moveClass": "bandit" },
  "brigand":       { "id": "brigand",       "name": "흉적",     "code": 10, "baseAtk": 120, "baseDef": 100, "move": 4, "rangeMin": 1, "rangeMax": 1, "line": "bandit",   "tier": 2, "moveClass": "bandit" },
  "outlaw":        { "id": "outlaw",        "name": "의적",     "code": 11, "baseAtk": 140, "baseDef": 120, "move": 4, "rangeMin": 1, "rangeMax": 1, "line": "bandit",   "tier": 3, "moveClass": "bandit" },
  "band":          { "id": "band",          "name": "군악대",   "code": 12, "baseAtk": 40,  "baseDef": 40,  "move": 4, "rangeMin": 1, "rangeMax": 1, "line": "support",  "tier": 1, "moveClass": "foot" },
  "beastUnit":     { "id": "beastUnit",     "name": "맹수부대", "code": 13, "baseAtk": 160, "baseDef": 60,  "move": 4, "rangeMin": 1, "rangeMax": 1, "line": "support",  "tier": 1, "moveClass": "bandit" },
  "brawler":       { "id": "brawler",       "name": "무도가대", "code": 14, "baseAtk": 140, "baseDef": 120, "move": 6, "rangeMin": 1, "rangeMax": 1, "line": "support",  "tier": 1, "moveClass": "bandit" },
  "sorcerer":      { "id": "sorcerer",      "name": "주술사",   "code": 15, "baseAtk": 40,  "baseDef": 40,  "move": 4, "rangeMin": 1, "rangeMax": 1, "line": "support",  "tier": 1, "moveClass": "foot" },
  "tribesman":     { "id": "tribesman",     "name": "이민족",   "code": 16, "baseAtk": 140, "baseDef": 160, "move": 6, "rangeMin": 1, "rangeMax": 1, "line": "support",  "tier": 1, "moveClass": "bandit" },
  "civilian":      { "id": "civilian",      "name": "백성",     "code": 17, "baseAtk": 40,  "baseDef": 40,  "move": 4, "rangeMin": 1, "rangeMax": 1, "line": "support",  "tier": 1, "moveClass": "foot" },
  "transport":     { "id": "transport",     "name": "수송대",   "code": 18, "baseAtk": 40,  "baseDef": 40,  "move": 4, "rangeMin": 1, "rangeMax": 1, "line": "support",  "tier": 1, "moveClass": "foot" }
}
```
(궁병 공E/방D=60/80, 연노병 공B/방D=120/80, 산적 공C/방D=100/80, 흉적 공B/방C=120/100, 의적 공A/방B=140/120, 무도가 공A/방B=140/120, 군악대·주술사·수송대·백성 공F/방F=40/40 — 변환표 적용. 백성 이동력은 원작 '-'이나 엔진 통일성 위해 4.)

`packages/data/json/terrains.json` (레퍼런스 §5 지형 수치 표):
```json
{
  "plain":     { "id": "plain",     "name": "평지",   "guard": 0,    "moveCost": { "default": 1 } },
  "grass":     { "id": "grass",     "name": "초원",   "guard": 0.05, "moveCost": { "default": 1 } },
  "bridge":    { "id": "bridge",    "name": "다리",   "guard": 0,    "moveCost": { "default": 1 } },
  "waste":     { "id": "waste",     "name": "황무지", "guard": 0,    "moveCost": { "default": 1 } },
  "village":   { "id": "village",   "name": "촌락",   "guard": 0.05, "moveCost": { "default": 1 }, "healTroopsRatio": 0.1, "healMp": true },
  "barracks":  { "id": "barracks",  "name": "병영",   "guard": 0.1,  "moveCost": { "default": 1 }, "healTroopsRatio": 0.1 },
  "depot":     { "id": "depot",     "name": "보물창고", "guard": 0,  "moveCost": { "default": 1 } },
  "forest":    { "id": "forest",    "name": "삼림",   "guard": 0.2,  "moveCost": { "default": 2, "archerFoot": 3, "bandit": 1 } },
  "mountain":  { "id": "mountain",  "name": "산지",   "guard": 0.3,  "moveCost": { "default": 2, "cavalry": 3, "bandit": 1 } },
  "fort":      { "id": "fort",      "name": "요새",   "guard": 0.3,  "moveCost": { "default": 2, "cavalry": 3, "bandit": 1 } },
  "gate":      { "id": "gate",      "name": "성문",   "guard": 0.2,  "moveCost": { "default": 1 } },
  "river":     { "id": "river",     "name": "하천",   "guard": 0,    "moveCost": { "default": 99 } },
  "wall":      { "id": "wall",      "name": "성벽",   "guard": 0,    "moveCost": { "default": 99 } },
  "cliff":     { "id": "cliff",     "name": "절벽",   "guard": 0,    "moveCost": { "default": 99, "bandit": 1 } }
}
```

`packages/data/json/combat.json`:
```json
{
  "advantageDefFactor": 0.75,
  "disadvantageDefFactor": 1.25,
  "counterRatio": 0.5,
  "minDamage": 1,
  "maxTurns": 30,
  "lineAdvantage": { "cavalry": "infantry", "infantry": "archer", "archer": "cavalry" }
}
```

- [ ] **Step 4: 로더 임시 갱신** — `packages/data/src/index.ts`: 기존 commanders/stages import를 **일단 제거**하고 (Task 5·9에서 복원) unitClasses/terrains/combat만 로드:

```ts
import { z } from "zod";
import {
  TerrainSchema, UnitClassSchema, CombatConfigSchema,
  type Terrain, type UnitClass, type CombatConfig,
} from "./schemas";
import terrainsJson from "../json/terrains.json";
import unitClassesJson from "../json/unitClasses.json";
import combatJson from "../json/combat.json";

export * from "./schemas";

function loadJson<T>(schema: { safeParse: (d: unknown) => { success: true; data: T } | { success: false; error: { message: string } } }, data: unknown, filename: string): T {
  const result = schema.safeParse(data);
  if (!result.success) throw new Error(`[${filename}] 스키마 검증 실패:\n${result.error.message}`);
  return result.data;
}

export interface GameData {
  terrains: Record<string, Terrain>;
  unitClasses: Record<string, UnitClass>;
  combat: CombatConfig;
}

export const gameData: GameData = {
  terrains: loadJson(z.record(TerrainSchema), terrainsJson, "terrains.json"),
  unitClasses: loadJson(z.record(UnitClassSchema), unitClassesJson, "unitClasses.json"),
  combat: loadJson(CombatConfigSchema, combatJson, "combat.json"),
};
```

기존 `commanders.json`/`stages/05-sishuiguan.json`(v0)은 이 Task에서 삭제 (`git rm`). engine/sim 패키지는 이 시점에 컴파일이 깨진다 — **Task 7~10에서 순차 복구하며, 중간 Task들은 `pnpm --filter @tk/data test`와 `--filter @tk/import-hero test`만 green이면 된다.**

- [ ] **Step 5: 통과 확인**: `pnpm --filter @tk/data test` → 12 PASS (스키마 7 + 데이터 5)

- [ ] **Step 6: Commit**: `feat(data): 원작 병종 19종·지형·전투 상수 이식 (v0 데이터 삭제)`

---

### Task 4: @tk/import-hero 패키지 + LS11 해제

**Files:**
- Create: `tools/import-hero/package.json`, `tsconfig.json`, `src/ls11.ts`
- Test: `tools/import-hero/test/ls11.test.ts`
- Modify: 루트 `package.json` (scripts), `pnpm-workspace.yaml` (tools/* 추가)

- [ ] **Step 1: 워크스페이스/패키지 설정**

`pnpm-workspace.yaml`에 `- "tools/*"` 추가 (hero-extract는 package.json이 없어 무시됨).

`tools/import-hero/package.json`:
```json
{
  "name": "@tk/import-hero",
  "version": "0.0.1",
  "private": true,
  "type": "module",
  "scripts": { "start": "tsx src/cli.ts", "test": "vitest run", "typecheck": "tsc --noEmit" },
  "dependencies": { "@tk/data": "workspace:*", "iconv-lite": "^0.6.3", "tsx": "^4.19.0" },
  "devDependencies": { "typescript": "^5.6.0", "vitest": "^2.1.0", "@types/node": "^22.0.0" }
}
```

`tools/import-hero/tsconfig.json` (`esModuleInterop`: iconv-lite가 CJS라 default import에 필요):
```json
{ "extends": "../../tsconfig.base.json", "compilerOptions": { "types": ["node"], "esModuleInterop": true }, "include": ["src", "test"] }
```

루트 package.json scripts에 추가: `"import-hero": "pnpm --filter @tk/import-hero start"`

- [ ] **Step 2: 실패하는 테스트** — `tools/import-hero/test/ls11.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { ls11Extract } from "../src/ls11";

const HERO = process.env.HERO_DIR ?? "C:\\HERO";
const have = existsSync(`${HERO}\\HEXZMAP.R3`);

describe.skipIf(!have)("LS11 해제 (C:\\HERO 필요 — 없으면 skip)", () => {
  it("HEXZMAP.R3 → 59청크, 각 원본 크기와 일치", () => {
    const chunks = ls11Extract(readFileSync(`${HERO}\\HEXZMAP.R3`));
    expect(chunks).toHaveLength(59); // 맵 58 + 지명 테이블 1 (레퍼런스 §8-2)
  });

  it("맵 청크 56개+ 가 W×H×1.25+2 크기식을 만족 (레퍼런스 검증식)", () => {
    const chunks = ls11Extract(readFileSync(`${HERO}\\HEXZMAP.R3`));
    for (let i = 0; i < 58; i++) {
      const c = chunks[i]!;
      const w = c[0]!, h = c[1]!;
      expect(c.length).toBe(w * h * 1.25 + 2);
    }
  });
});
```

- [ ] **Step 3: 실패 확인**: `pnpm install` 후 `pnpm --filter @tk/import-hero test` → FAIL (모듈 없음)

- [ ] **Step 4: 구현** — `tools/import-hero/src/ls11.ts` (검증된 `tools/hero-extract/ls11_extract.py`의 직역 포팅):

```ts
/** LS11 해제 — 코에이 표준 압축 (영걸전~조조전 공용).
 *  알고리즘 출처: tools/hero-extract/ls11_extract.py (검증 완료) ← github.com/yinchuan/LSReader */
class BitReader {
  private bytePos: number;
  private bitQueue = 0;
  private bitLen = 0;
  constructor(private d: Uint8Array, start: number) { this.bytePos = start; }
  getBits(n: number): number {
    let ret = 0;
    for (let i = 0; i < n; i++) {
      if (this.bitLen === 0) {
        this.bitQueue = this.d[this.bytePos]!;
        this.bytePos += 1;
        this.bitLen = 8;
      }
      ret = (ret << 1) | ((this.bitQueue & 0x80) >>> 7);
      this.bitQueue = (this.bitQueue << 1) & 0xff;
      this.bitLen -= 1;
    }
    return ret;
  }
  getCode(): number {
    let code1 = 0;
    let n = 0;
    for (;;) {
      const bit = this.getBits(1);
      code1 = (code1 << 1) | bit;
      n += 1;
      if (bit === 0) break;
    }
    return code1 + this.getBits(n);
  }
}

function decompressChunk(data: Uint8Array, offset: number, origSize: number, dic: Uint8Array): Uint8Array {
  const br = new BitReader(data, offset);
  const out = new Uint8Array(origSize);
  let len = 0;
  while (len < origSize) {
    const code = br.getCode();
    if (code < 0x100) {
      out[len++] = dic[code]!;
    } else {
      const moveBack = code - 0x100;
      const copies = br.getCode() + 3;
      for (let i = 0; i < copies && len < origSize; i++) {
        out[len] = out[len - moveBack]!;
        len++;
      }
    }
  }
  return out;
}

export function ls11Extract(buf: Uint8Array): Uint8Array[] {
  const magic = String.fromCharCode(buf[0]!, buf[1]!, buf[2]!, buf[3]!);
  if (magic !== "LS11" && magic !== "Ls11") throw new Error(`not LS11: ${magic}`);
  const dic = buf.subarray(0x10, 0x110);
  const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  const out: Uint8Array[] = [];
  for (let pos = 0x110; ; pos += 12) {
    const comp = view.getUint32(pos, false);  // big-endian
    if (comp === 0) break;
    const orig = view.getUint32(pos + 4, false);
    const off = view.getUint32(pos + 8, false);
    out.push(comp === orig ? buf.subarray(off, off + orig) : decompressChunk(buf, off, orig, dic));
  }
  return out;
}
```

- [ ] **Step 5: 통과 확인**: `pnpm --filter @tk/import-hero test` → 2 PASS (C:\HERO 존재 머신 기준). typecheck 0.

- [ ] **Step 6: 교차 검증 (1회성, 커밋 안 함)**: Python 산출물과 바이트 일치 확인 —
`node`(tsx) 스크래치로 `ls11Extract(HEXZMAP.R3)[0]`을 `tools/hero-extract/out/ls11/` 해제본이 있으면 비교, 또는 길이·선두 16바이트 헥스 비교를 보고에 기록. 불일치 시 중단·보고.

- [ ] **Step 7: Commit**: `feat(import): LS11 해제 TS 포팅 — Python 검증 구현 직역`

---

### Task 5: BAKDATA 파싱 → 장수 384·아이템 63·초기 편성 JSON 생성

**Files:**
- Create: `tools/import-hero/src/bakdata.ts`, `tools/import-hero/src/cli.ts`
- Create(생성물): `packages/data/json/commanders.json`, `items.json`, `initialForces.json`
- Modify: `packages/data/src/schemas.ts` (InitialForceSchema 추가), `packages/data/src/index.ts` (commanders/items 로드 복원)
- Test: `tools/import-hero/test/bakdata.test.ts`, `packages/data/test/data.test.ts` (스팟 체크 추가)

레퍼런스 §2: BAKDATA.R3 비압축. 구획 B `0x0D00` 16B×63 아이템(name char[13] + b13효과 + b14% + b15분류), 구획 C `0x1100` 21B×384 장수(+0 name char[6] CP949, +14 u16LE 얼굴, +17 통솔, +18 무력, +19 지력), 구획 D `0x3080` 18B×384 초기 편성(+0 군단, +4 사기, +5 u16LE 병력, +7 병종코드, +8 u16LE 레벨, +10 아이템 슬롯 8B, 0xFF=빈칸). C와 D는 인덱스 1:1.

- [ ] **Step 1: InitialForceSchema 추가** — `packages/data/src/schemas.ts` 끝에:

```ts
export const InitialForceSchema = z.object({
  commanderId: z.string(),
  faction: z.number().int().min(0).max(255), // 0x80=유비군 … (레퍼런스 §2 구획 D)
  troops: z.number().int().min(0),
  classId: z.string(),
  level: z.number().int().min(0).max(99),
  items: z.array(z.string()),
});
export type InitialForce = z.infer<typeof InitialForceSchema>;
```

- [ ] **Step 2: 실패하는 테스트** — `tools/import-hero/test/bakdata.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { parseBakdata } from "../src/bakdata";

const HERO = process.env.HERO_DIR ?? "C:\\HERO";
const have = existsSync(`${HERO}\\BAKDATA.R3`);

describe.skipIf(!have)("BAKDATA 파싱 (C:\\HERO 필요)", () => {
  const parsed = have ? parseBakdata(readFileSync(`${HERO}\\BAKDATA.R3`)) : null!;

  it("레퍼런스 발췌 표와 일치 — 관우/여포/제갈량/화웅", () => {
    const c = parsed.commanders;
    expect(c["관우"]).toMatchObject({ leadership: 100, war: 98, intelligence: 80 });
    expect(c["여포"]).toMatchObject({ war: 100, intelligence: 21 });
    expect(c["제갈량"]).toMatchObject({ intelligence: 100 });
    expect(c["화웅"]).toMatchObject({ leadership: 88, war: 90, intelligence: 29 });
  });

  it("아이템 63종 — 청룡언월도 +12%, 패자검 +24% (레퍼런스 §4)", () => {
    expect(Object.keys(parsed.items)).toHaveLength(63);
    expect(parsed.items["청룡언월도"]).toMatchObject({ category: "weapon", bonusPercent: 12 });
    expect(parsed.items["패자검"]).toMatchObject({ category: "weapon", bonusPercent: 24 });
    expect(parsed.items["적토마"]).toMatchObject({ category: "horse" });
  });

  it("초기 편성 — 관우 경기병 Lv1 병력 1120 청룡언월도, 여포 적토마+방천화극", () => {
    const f = parsed.initialForces;
    expect(f["관우"]).toMatchObject({ classId: "lightCavalry", level: 1, troops: 1120, items: ["청룡언월도"] });
    expect(f["여포"]!.items).toEqual(expect.arrayContaining(["적토마", "방천화극"]));
  });

  it("장수 능력치 전수 1~100 범위", () => {
    for (const c of Object.values(parsed.commanders)) {
      for (const v of [c.leadership, c.war, c.intelligence]) {
        expect(v).toBeGreaterThanOrEqual(1);
        expect(v).toBeLessThanOrEqual(100);
      }
    }
  });
});
```

- [ ] **Step 3: 실패 확인**: `pnpm --filter @tk/import-hero test` → FAIL

- [ ] **Step 4: 구현** — `tools/import-hero/src/bakdata.ts`:

```ts
import iconv from "iconv-lite";
import type { Commander, Item, InitialForce } from "@tk/data";

const SECTION_B = 0x0d00, ITEM_SIZE = 16, ITEM_COUNT = 63;
const SECTION_C = 0x1100, CMD_SIZE = 21, CMD_COUNT = 384;
const SECTION_D = 0x3080, FORCE_SIZE = 18;

const ITEM_CATEGORY = ["weapon", "treasure", "attackItem", "supplyItem", "horse", "book"] as const;

/** 원작 병종 코드(0x00~0x12) → unitClasses.json id (Task 3과 동일 순서) */
export const CLASS_BY_CODE = [
  "footman", "pikeman", "chariot", "archer", "crossbowman", "catapult",
  "lightCavalry", "heavyCavalry", "guardCavalry", "bandit", "brigand", "outlaw",
  "band", "beastUnit", "brawler", "sorcerer", "tribesman", "civilian", "transport",
] as const;

function cp949(buf: Buffer, start: number, len: number): string {
  const raw = buf.subarray(start, start + len);
  const end = raw.indexOf(0);
  return iconv.decode(end >= 0 ? raw.subarray(0, end) : raw, "cp949").trim();
}

export interface BakdataResult {
  commanders: Record<string, Commander>;
  items: Record<string, Item>;
  initialForces: Record<string, InitialForce>;
}

export function parseBakdata(buf: Buffer): BakdataResult {
  // 아이템 63종 (인덱스 순서 = 세이브의 아이템 번호)
  const itemByIndex: string[] = [];
  const items: Record<string, Item> = {};
  for (let i = 0; i < ITEM_COUNT; i++) {
    const o = SECTION_B + i * ITEM_SIZE;
    const name = cp949(buf, o, 13);
    const category = ITEM_CATEGORY[buf[o + 15]!];
    if (!name || !category) { itemByIndex.push(""); continue; }
    const id = name; // 아이템명은 63종 내 유일
    itemByIndex.push(id);
    items[id] = { id, name, category, power: buf[o + 13]!, bonusPercent: buf[o + 14]! };
  }

  // 장수 384 + 초기 편성 (1:1 인덱스)
  const commanders: Record<string, Commander> = {};
  const initialForces: Record<string, InitialForce> = {};
  const used = new Map<string, number>();
  for (let i = 0; i < CMD_COUNT; i++) {
    const o = SECTION_C + i * CMD_SIZE;
    const name = cp949(buf, o, 6);
    if (!name) continue; // 빈 슬롯
    const leadership = buf[o + 17]!, war = buf[o + 18]!, intelligence = buf[o + 19]!;
    if (leadership < 1 || leadership > 100 || war < 1 || war > 100 || intelligence < 1 || intelligence > 100) {
      console.warn(`skip out-of-range stats: #${i} ${name} (${leadership}/${war}/${intelligence})`);
      continue;
    }
    const n = (used.get(name) ?? 0) + 1;
    used.set(name, n);
    const id = n === 1 ? name : `${name}_${n}`; // 동명이인 처리
    commanders[id] = {
      id, name, leadership, war, intelligence,
      faceId: buf.readUInt16LE(o + 14),
    };

    const d = SECTION_D + i * FORCE_SIZE;
    const classId = CLASS_BY_CODE[buf[d + 7]!];
    if (!classId) continue;
    const slot = buf.subarray(d + 10, d + 18);
    const itemIds: string[] = [];
    for (const b of slot) if (b !== 0xff && itemByIndex[b]) itemIds.push(itemByIndex[b]!);
    initialForces[id] = {
      commanderId: id, faction: buf[d]!,
      troops: buf.readUInt16LE(d + 5), classId,
      level: buf.readUInt16LE(d + 8), items: itemIds,
    };
  }
  return { commanders, items, initialForces };
}
```

`tools/import-hero/src/cli.ts`:
```ts
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { parseBakdata } from "./bakdata";

function arg(name: string, fallback: string): string {
  const i = process.argv.indexOf(`--${name}`);
  return (i >= 0 ? process.argv[i + 1] : undefined) ?? fallback;
}

const heroDir = arg("hero-dir", "C:\\HERO");
const outDir = arg("out-dir", join(import.meta.dirname, "..", "..", "..", "packages", "data", "json"));

const bak = parseBakdata(readFileSync(join(heroDir, "BAKDATA.R3")));
mkdirSync(outDir, { recursive: true });
const write = (file: string, data: unknown) =>
  writeFileSync(join(outDir, file), JSON.stringify(data, null, 2) + "\n", "utf8");
write("commanders.json", bak.commanders);
write("items.json", bak.items);
write("initialForces.json", bak.initialForces);
console.log(`장수 ${Object.keys(bak.commanders).length} / 아이템 ${Object.keys(bak.items).length} / 편성 ${Object.keys(bak.initialForces).length} → ${outDir}`);
// 맵 변환은 Task 6에서 이 CLI에 추가
```

- [ ] **Step 5: 테스트 통과 확인 후 생성 실행**: `pnpm --filter @tk/import-hero test` → PASS. `pnpm import-hero` → 3개 JSON 생성, 카운트 출력 (장수 300+ 예상).

- [ ] **Step 6: data 로더 복원 + 스팟 테스트** — `packages/data/src/index.ts`의 GameData에 commanders/items/initialForces 로드 추가 (loadJson 패턴 동일, `z.record(CommanderSchema)` 등). `packages/data/test/data.test.ts`에 추가:

```ts
  it("생성된 장수 데이터가 레퍼런스와 일치 (관우/여포)", () => {
    expect(gameData.commanders["관우"]).toMatchObject({ leadership: 100, war: 98, intelligence: 80 });
    expect(gameData.commanders["여포"]!.war).toBe(100);
    expect(Object.keys(gameData.commanders).length).toBeGreaterThan(300);
  });

  it("초기 편성의 classId·아이템이 전부 실존 참조", () => {
    for (const f of Object.values(gameData.initialForces)) {
      expect(gameData.unitClasses[f.classId], f.commanderId).toBeDefined();
      expect(gameData.commanders[f.commanderId]).toBeDefined();
      for (const it of f.items) expect(gameData.items[it], it).toBeDefined();
    }
  });
```

- [ ] **Step 7: 전체 확인**: `pnpm --filter @tk/data test` && `pnpm --filter @tk/import-hero test` → PASS

- [ ] **Step 8: Commit**: `feat(import): BAKDATA 직독 — 장수 384·아이템 63·초기 편성 JSON 생성`

---

### Task 6: HEXZMAP 파싱 → 사수관 56×32 맵 JSON

**Files:**
- Create: `tools/import-hero/src/hexzmap.ts`
- Create(생성물): `packages/data/json/maps/sishuiguan.json`
- Modify: `tools/import-hero/src/cli.ts` (맵 변환 추가), `packages/data/src/index.ts` (maps 로드)
- Test: `tools/import-hero/test/hexzmap.test.ts`

레퍼런스 §8-2: LS11 59청크 = 맵 58 + 지명 테이블(청크 58, CP949, `\r\n` 구분). 맵 청크 = `[W u8][H u8][타일 W×H][속성 W×H/4]`. 2bit 속성은 이번엔 무시.

- [ ] **Step 1: 타일 인덱스 → 지형 매핑 작업 (탐색 단계 — 구현 전에 수행)**

1. 스크래치(tsx)로 사수관(청크 0)의 타일 바이트 히스토그램을 출력: `값: 출현수` 정렬.
2. `tools/hero-extract/out/maps/zmap00_사수관.png`를 **Read 도구로 열어** 시각 대조: 어느 값이 길/산/성벽/관문/평지인지 위치로 판별 (예: 외곽 띠 = 산, 중앙 가로 구조물 = 성벽+관문, 세로 띠 = 길).
3. 판별 결과를 `TILE_TERRAIN: Record<number, string>` 상수로 확정. **판별 근거(값→지형, 결정 이유 한 줄씩)를 구현 보고에 포함**하고 `docs/reference/yeonggeoljeon-data.md` §8-2 끝에 "타일 인덱스 매핑(사수관 검증분)" 표로 추가한다.
4. 매핑 안 된 값은 `plain` 폴백 + 경고 수집 — 사수관에서 폴백 0건이 목표.

- [ ] **Step 2: 실패하는 테스트** — `tools/import-hero/test/hexzmap.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { parseHexzmap, toBattleMap } from "../src/hexzmap";
import { BattleMapSchema } from "@tk/data";

const HERO = process.env.HERO_DIR ?? "C:\\HERO";
const have = existsSync(`${HERO}\\HEXZMAP.R3`);

describe.skipIf(!have)("HEXZMAP 파싱 (C:\\HERO 필요)", () => {
  const maps = have ? parseHexzmap(readFileSync(`${HERO}\\HEXZMAP.R3`)) : null!;

  it("58개 맵 + 이름, 0번 = 사수관 56×32", () => {
    expect(maps).toHaveLength(58);
    expect(maps[0]!).toMatchObject({ name: "사수관", width: 56, height: 32 });
    expect(maps[1]!.name).toBe("호로관");
  });

  it("사수관 BattleMap 변환: 스키마 통과 + 미매핑 타일 0건", () => {
    const { map, unmapped } = toBattleMap(maps[0]!, "sishuiguan");
    expect(() => BattleMapSchema.parse(map)).not.toThrow();
    expect(unmapped).toEqual([]);
    const all = map.tiles.join("");
    expect(all).toContain("G"); // 관문 존재
    expect(all).toContain("#"); // 성벽 존재
  });
});
```

- [ ] **Step 3: 실패 확인**: `pnpm --filter @tk/import-hero test` → FAIL

- [ ] **Step 4: 구현** — `tools/import-hero/src/hexzmap.ts`:

```ts
import iconv from "iconv-lite";
import { ls11Extract } from "./ls11";
import type { BattleMap } from "@tk/data";

export interface RawMap { index: number; name: string; width: number; height: number; tiles: Uint8Array }

export function parseHexzmap(buf: Buffer): RawMap[] {
  const chunks = ls11Extract(buf);
  if (chunks.length !== 59) throw new Error(`expected 59 chunks, got ${chunks.length}`);
  const names = iconv.decode(Buffer.from(chunks[58]!), "cp949").split("\r\n").map((s) => s.trim()).filter(Boolean);
  return chunks.slice(0, 58).map((c, i) => {
    const width = c[0]!, height = c[1]!;
    const expected = 2 + width * height + (width * height) / 4;
    if (c.length !== expected) throw new Error(`map ${i}: size ${c.length} != ${expected}`);
    return { index: i, name: names[i] ?? `map${i}`, width, height, tiles: c.subarray(2, 2 + width * height) };
  });
}

/** 타일 인덱스 → 지형 id. Step 1 탐색 결과로 채운다 — 아래 키 값은 구현 시 확정 */
export const TILE_TERRAIN: Record<number, string> = {
  // 예시 형태 (실제 값은 사수관 히스토그램 + PNG 대조로 결정):
  // 0: "plain", 1: "grass", 4: "forest", 7: "mountain", 12: "wall", 13: "gate", ...
};

/** 지형 id → 맵 JSON 1글자 코드 (terrains.json 14종과 1:1) */
export const TERRAIN_CHAR: Record<string, string> = {
  plain: ".", grass: "g", bridge: "b", waste: "w", village: "v", barracks: "B",
  depot: "d", forest: "f", mountain: "m", fort: "F", gate: "G", river: "r",
  wall: "#", cliff: "c",
};

export function toBattleMap(raw: RawMap, id: string): { map: BattleMap; unmapped: number[] } {
  const unmapped = new Set<number>();
  const rows: string[] = [];
  for (let y = 0; y < raw.height; y++) {
    let row = "";
    for (let x = 0; x < raw.width; x++) {
      const t = raw.tiles[y * raw.width + x]!;
      const terrain = TILE_TERRAIN[t] ?? (unmapped.add(t), "plain");
      row += TERRAIN_CHAR[terrain]!;
    }
    rows.push(row);
  }
  const tileLegend = Object.fromEntries(Object.entries(TERRAIN_CHAR).map(([k, v]) => [v, k]));
  return {
    map: { id, name: raw.name, width: raw.width, height: raw.height, tileLegend, tiles: rows },
    unmapped: [...unmapped].sort((a, b) => a - b),
  };
}
```

`cli.ts`에 추가:
```ts
import { parseHexzmap, toBattleMap } from "./hexzmap";
// bakdata 출력 뒤에:
const rawMaps = parseHexzmap(readFileSync(join(heroDir, "HEXZMAP.R3")));
mkdirSync(join(outDir, "maps"), { recursive: true });
const { map, unmapped } = toBattleMap(rawMaps[0]!, "sishuiguan");
if (unmapped.length > 0) console.warn(`사수관 미매핑 타일: ${unmapped.join(", ")} → plain 폴백`);
write("maps/sishuiguan.json", map);
console.log(`맵: 사수관 ${map.width}×${map.height}`);
```

- [ ] **Step 5: 통과 확인 + 생성**: `pnpm --filter @tk/import-hero test` → PASS. `pnpm import-hero` → `maps/sishuiguan.json` 생성, 미매핑 경고 0건.

- [ ] **Step 6: data 로더에 maps 추가** — `index.ts`에 `maps: Record<string, BattleMap>` 로드 (`maps/sishuiguan.json`). data.test.ts에:

```ts
  it("사수관 맵: 56×32, legend의 지형이 전부 실존", () => {
    const m = gameData.maps["sishuiguan"]!;
    expect(m.width).toBe(56);
    expect(m.height).toBe(32);
    for (const tid of Object.values(m.tileLegend)) expect(gameData.terrains[tid], tid).toBeDefined();
  });
```

- [ ] **Step 7: Commit**: `feat(import): HEXZMAP 직독 — 사수관 원작 맵 56×32 JSON 생성`

---

### Task 7: 엔진 v2 — 타입·createBattle·테스트 픽스처

**Files:**
- Modify: `packages/engine/src/types.ts`, `src/createBattle.ts`
- Create: `packages/engine/test/fixtures.ts` (합성 스테이지 — 엔진 테스트를 스테이지 저작과 분리)
- Modify: `packages/engine/test/createBattle.test.ts` (전면 개정)
- 삭제 없음: rng.ts/events.ts는 그대로

핵심 변경: hp→**troops**, **morale** 도입, 장수 3능력치 + 병종 기초치 + 무기 보정을 UnitState에 해석해 담는다. BattleContext에 **map** 추가 (스테이지가 mapId 참조로 바뀜).

- [ ] **Step 1: 테스트 픽스처 작성** — `packages/engine/test/fixtures.ts`:

```ts
import { gameData, type BattleMap, type Stage } from "@tk/data";
import type { BattleContext } from "../src/types";

/** 8×6 합성 맵: 평지 위주 + 산/성벽/관문 1열 (실제 terrains.json 지형 사용) */
export const testMap: BattleMap = {
  id: "testmap", name: "테스트맵", width: 8, height: 6,
  tileLegend: { ".": "plain", "m": "mountain", "#": "wall", "G": "gate", "f": "forest" },
  tiles: [
    "########",
    "#..G...#",
    ".....f..",
    "..m.....",
    "........",
    "........",
  ],
};

/** 합성 스테이지: 실제 장수/병종 데이터 사용 (관우·유비 vs 화웅·동탁군) */
export const testStage: Stage = {
  id: "test-stage", name: "테스트", mapId: "testmap", turnLimit: 30,
  units: [
    { commanderId: "유비", classId: "footman",      level: 1, troops: 1120, items: [],            side: "player", x: 2, y: 5 },
    { commanderId: "관우", classId: "lightCavalry", level: 1, troops: 1120, items: ["청룡언월도"], side: "player", x: 1, y: 4 },
    { commanderId: "화웅", classId: "lightCavalry", level: 3, troops: 1760, items: [],            side: "enemy",  x: 5, y: 1 },
    { commanderId: "이숙", classId: "archer",       level: 3, troops: 1760, items: [],            side: "enemy",  x: 6, y: 2 },
  ],
  victory: { kind: "defeatUnit", unitId: "화웅" },
  defeat: { kind: "lordRetreat", unitId: "유비" },
  events: [{
    id: "duel_관우_화웅", type: "duel",
    trigger: { kind: "attack", attackerId: "관우", defenderId: "화웅" },
    outcome: { winnerId: "관우", loserRetreats: true }, once: true,
  }],
};

export const testCtx: BattleContext = { data: gameData, stage: testStage, map: testMap };
```

- [ ] **Step 2: 실패하는 테스트로 개정** — `packages/engine/test/createBattle.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { gameData } from "@tk/data";
import { createBattle } from "../src/createBattle";
import { testCtx, testStage, testMap } from "./fixtures";

describe("createBattle v2 (원작 모델)", () => {
  const state = createBattle(testCtx, 42);

  it("병력/사기/레벨이 스테이지 배치대로 해석된다", () => {
    const guanyu = state.units.find((u) => u.id === "관우")!;
    expect(guanyu).toMatchObject({ troops: 1120, maxTroops: 1120, morale: 100, level: 1, side: "player" });
  });

  it("장수 3능력치 + 병종 기초치가 유닛에 들어간다", () => {
    const guanyu = state.units.find((u) => u.id === "관우")!;
    expect(guanyu).toMatchObject({ war: 98, leadership: 100, intelligence: 80 }); // 관우 원작 수치
    expect(guanyu).toMatchObject({ baseAtk: 120, baseDef: 60, move: 6, line: "cavalry", moveClass: "cavalry" }); // 경기병
  });

  it("무기 보정: 청룡언월도 +12% → weaponBonus 1.12, 무기 없으면 1.0", () => {
    expect(state.units.find((u) => u.id === "관우")!.weaponBonus).toBeCloseTo(1.12, 5);
    expect(state.units.find((u) => u.id === "유비")!.weaponBonus).toBe(1.0);
  });

  it("책략치 MP = (레벨+10)×지력÷40 내림 (레퍼런스 §6)", () => {
    // 관우 Lv1 지력 80 → 11×80/40 = 22
    expect(state.units.find((u) => u.id === "관우")!.mp).toBe(22);
  });

  it("턴 1, 아군 페이즈, ongoing, rngState=seed", () => {
    expect(state).toMatchObject({ turn: 1, phase: "player", status: "ongoing", rngState: 42 });
  });

  it("미지의 commanderId/classId/mapId는 에러", () => {
    const bad = { ...testStage, units: [{ ...testStage.units[0]!, commanderId: "없는장수" }] };
    expect(() => createBattle({ data: gameData, stage: bad, map: testMap }, 1)).toThrow("없는장수");
  });
});
```

- [ ] **Step 3: 실패 확인**: `pnpm --filter @tk/engine test` → FAIL (컴파일 에러 포함 — 정상, 이 Task에서 복구)

- [ ] **Step 4: types.ts 개정** — UnitState/BattleContext 부분 교체 (Action/BattleEvent/ActionResult/Coord는 유지하되 BattleEvent의 damageDealt는 그대로 — damage가 병력 피해를 의미하게 됨):

```ts
import type { GameData, Stage, BattleMap, Side, Line, MoveClass } from "@tk/data";

export interface UnitState {
  id: string;            // commanderId
  classId: string;
  line: Line;            // 상성 판정
  moveClass: MoveClass;  // 지형 비용 판정
  side: Side;
  x: number; y: number;
  level: number;
  troops: number; maxTroops: number;  // 병력 = 원작 HP (0 = 퇴각, 사망 없음)
  morale: number;                     // 사기 — 공/방 직접 가산. 변동 규칙 미해독으로 당분간 고정 100
  mp: number; maxMp: number;          // 책략치 = (레벨+10)×지력÷40
  war: number; leadership: number; intelligence: number;
  baseAtk: number; baseDef: number;
  weaponBonus: number;                // 1 + 최고 무기 bonusPercent/100 (소지품 중 최고 1개 — 원작 룰)
  move: number;
  rangeMin: number; rangeMax: number;
  moved: boolean; acted: boolean; retreated: boolean;
}

/** 정적 컨텍스트 — map은 stage.mapId로 해석된 BattleMap */
export interface BattleContext { data: GameData; stage: Stage; map: BattleMap }
```
(BattleState는 hp 언급 없음 — 변경 불필요. 기존 주석의 "HP 0 = 퇴각"은 "병력 0 = 퇴각"으로 갱신.)

- [ ] **Step 5: createBattle.ts 개정**:

```ts
import type { BattleContext, BattleState, UnitState } from "./types";

export function createBattle(ctx: BattleContext, seed: number): BattleState {
  const { data, stage } = ctx;
  const units: UnitState[] = stage.units.map((p) => {
    const cmd = data.commanders[p.commanderId];
    if (!cmd) throw new Error(`unknown commander: ${p.commanderId}`);
    const cls = data.unitClasses[p.classId];
    if (!cls) throw new Error(`unknown class: ${p.classId}`);
    // 원작 룰: 소지품 중 최고 무기 1개만 공격력 % 보정
    let weaponBonus = 1.0;
    for (const itemId of p.items) {
      const item = data.items[itemId];
      if (!item) throw new Error(`unknown item: ${itemId}`);
      if (item.category === "weapon") weaponBonus = Math.max(weaponBonus, 1 + item.bonusPercent / 100);
    }
    const maxMp = Math.floor((p.level + 10) * cmd.intelligence / 40);
    return {
      id: cmd.id, classId: cls.id, line: cls.line, moveClass: cls.moveClass,
      side: p.side, x: p.x, y: p.y, level: p.level,
      troops: p.troops, maxTroops: p.troops, morale: 100,
      mp: maxMp, maxMp,
      war: cmd.war, leadership: cmd.leadership, intelligence: cmd.intelligence,
      baseAtk: cls.baseAtk, baseDef: cls.baseDef, weaponBonus,
      move: cls.move, rangeMin: cls.rangeMin, rangeMax: cls.rangeMax,
      moved: false, acted: false, retreated: false,
    };
  });
  return { turn: 1, phase: "player", status: "ongoing", units, rngState: seed, firedEvents: [] };
}
```
시그니처 변경: `createBattle(ctx, seed)` (stage/data를 ctx로 통합 — map 해석을 호출자가 책임).

- [ ] **Step 6: 부분 통과 확인**: `pnpm --filter @tk/engine test -- createBattle` → 6 PASS (combat/movement/actions 테스트는 아직 깨져 있음 — Task 8에서 복구).

- [ ] **Step 7: Commit**: `feat(engine): 유닛 상태 v2 — 병력·사기·통무지·무기보정 해석`

---

### Task 8: 엔진 v2 — 원작 데미지 공식·이동·applyAction 정합

**Files:**
- Modify: `packages/engine/src/combat.ts` (공식 교체), `src/movement.ts` (moveClass·map 참조), `src/actions.ts` (시그니처 정합), `src/index.ts`
- Modify: `packages/engine/test/combat.test.ts`, `test/movement.test.ts`, `test/actions.test.ts`, `test/events.test.ts` (전면 개정 — fixtures 사용)

- [ ] **Step 1: 실패하는 테스트로 개정** — `packages/engine/test/combat.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { createBattle } from "../src/createBattle";
import { adjustedStat, attackPower, defensePower, computeDamage, getAttackableTargets } from "../src/combat";
import { testCtx } from "./fixtures";

const state = createBattle(testCtx, 42);
const get = (id: string) => state.units.find((u) => u.id === id)!;

describe("원작 공식 (레퍼런스 §6 검증 수치 고정)", () => {
  it("보정능력치 = 4000÷(140−x): 100→100, 90→80, 80→67, 60→50, 40→40", () => {
    expect(adjustedStat(100)).toBe(100);
    expect(adjustedStat(90)).toBe(80);
    expect(adjustedStat(80)).toBe(67);
    expect(adjustedStat(60)).toBe(50);
    expect(adjustedStat(40)).toBe(40);
  });

  it("공격력 = (병종공격 + 사기 + 보정무력) × (10+Lv)/10 × 무기보정", () => {
    // 관우 Lv1 경기병(120) 사기100 무력98→보정 round(4000/42)=95, 언월도 1.12
    // (120+100+95) × 1.1 × 1.12 = 315 × 1.1 × 1.12 = 388.08
    expect(attackPower(get("관우"))).toBeCloseTo(388.08, 2);
  });

  it("방어력 = (병종방어 + 사기 + 보정통솔) × (10+Lv)/10 (무기보정 없음)", () => {
    // 관우 Lv1 경기병(60) 사기100 통솔100→100: (60+100+100)×1.1 = 286
    expect(defensePower(get("관우"))).toBeCloseTo(286, 2);
  });

  it("데미지 = floor((공격력 − 방어력×상성÷2) × (1−지형guard)), 명중 100% 결정론", () => {
    // 화웅(경기병)→관우(경기병): 동계열 상성 1.0
    // 화웅 atk = (120+100+round(4000/50)=80)×1.3 = 390 / 관우 def 286
    // dmg = floor((390 − 286×1.0/2) × 1) = floor(247) = 247  [관우 위치 (1,4)=plain]
    const a = computeDamage(testCtx, get("화웅"), get("관우"));
    const b = computeDamage(testCtx, get("화웅"), get("관우"));
    expect(a).toBe(247);
    expect(b).toBe(a); // RNG 없음 — 같은 입력 = 같은 값
  });

  it("상성: 기병→보병은 방어 0.75배 → 데미지 증가", () => {
    // 관우(기병)→유비(단병 footman): lineAdvantage cavalry→infantry
    // 유비 def = (80+100+adjusted(91)=round(4000/49)=82)×1.1 = 288.2
    // dmg = floor((388.08 − 288.2×0.75/2)×1) = floor(388.08−108.075) = 280
    expect(computeDamage(testCtx, get("관우"), get("유비"))).toBe(280);
  });

  it("지형 guard: 산지(0.3) 위 방어자는 데미지 30% 경감", () => {
    const onMountain = { ...get("관우"), x: 2, y: 3 }; // testMap (2,3)=m
    const flat = computeDamage(testCtx, get("화웅"), get("관우"));
    const guarded = computeDamage(testCtx, get("화웅"), onMountain);
    expect(guarded).toBe(Math.floor(flat * 0.7));
  });

  it("최소 데미지 보장", () => {
    const weak = { ...get("유비"), war: 1, baseAtk: 1, level: 1, weaponBonus: 1 };
    expect(computeDamage(testCtx, weak, get("화웅"))).toBeGreaterThanOrEqual(testCtx.data.combat.minDamage);
  });
});

describe("getAttackableTargets (모델 무관 — 동작 유지)", () => {
  it("사거리 안의 적만", () => {
    expect(getAttackableTargets(testCtx, state, "관우", { x: 5, y: 2 })).toContain("화웅");
    expect(getAttackableTargets(testCtx, state, "관우", { x: 1, y: 4 })).toHaveLength(0);
  });
  it("궁병(2~2)은 인접 공격 불가", () => {
    expect(getAttackableTargets(testCtx, state, "이숙", { x: 5, y: 2 })).not.toContain("화웅"); // 거리 1
  });
});
```

- [ ] **Step 2: 실패 확인**: `pnpm --filter @tk/engine test -- combat` → FAIL

- [ ] **Step 3: combat.ts 교체**:

```ts
import type { BattleContext, BattleState, Coord, UnitState } from "./types";
import { terrainAt } from "./movement";

/** 보정능력치 — 80 이상에서 가치가 비선형 급증하는 원작 커브 (레퍼런스 §6) */
export function adjustedStat(x: number): number {
  return Math.round(4000 / (140 - x));
}

export function attackPower(u: UnitState): number {
  return (u.baseAtk + u.morale + adjustedStat(u.war)) * (10 + u.level) / 10 * u.weaponBonus;
}

export function defensePower(u: UnitState): number {
  return (u.baseDef + u.morale + adjustedStat(u.leadership)) * (10 + u.level) / 10;
}

/** 공격측 line 기준 방어력 배율: 유리 0.75 / 불리 1.25 / 그 외 1.0 */
function defFactor(ctx: BattleContext, attacker: UnitState, defender: UnitState): number {
  const cfg = ctx.data.combat;
  if (cfg.lineAdvantage[attacker.line] === defender.line) return cfg.advantageDefFactor;
  if (cfg.lineAdvantage[defender.line] === attacker.line) return cfg.disadvantageDefFactor;
  return 1.0;
}

/**
 * 원작 데미지 공식 — 명중 100%, 분산 없음 (퍼즐성 = 계산 가능성).
 * 데미지 = (공격력 − 방어력 × 상성계수 ÷ 2) × (1 − 방어측 지형 guard), ratio는 반격 0.5용
 */
export function computeDamage(
  ctx: BattleContext, attacker: UnitState, defender: UnitState, ratio = 1,
): number {
  const guard = terrainAt(ctx, defender.x, defender.y).guard;
  const raw = attackPower(attacker) - defensePower(defender) * defFactor(ctx, attacker, defender) / 2;
  return Math.max(ctx.data.combat.minDamage, Math.floor(Math.max(0, raw) * (1 - guard) * ratio));
}

export function distance(a: Coord, b: Coord): number {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

export function getAttackableTargets(
  ctx: BattleContext, state: BattleState, unitId: string, from?: Coord,
): string[] {
  const unit = state.units.find((u) => u.id === unitId);
  if (!unit || unit.retreated) return [];
  const pos = from ?? { x: unit.x, y: unit.y };
  return state.units
    .filter((t) => t.side !== unit.side && !t.retreated)
    .filter((t) => {
      const d = distance(pos, { x: t.x, y: t.y });
      return d >= unit.rangeMin && d <= unit.rangeMax;
    })
    .map((t) => t.id);
}
```

- [ ] **Step 4: movement.ts 수정** — 2곳만: `terrainAt`이 `ctx.stage.map` 대신 `ctx.map` 사용, `getMovableTiles`의 비용 조회가 `unit.classId` 대신 `unit.moveClass` 사용:

```ts
// terrainAt 내부
const row = ctx.map.tiles[y];
// ...
const tid = ctx.map.tileLegend[ch];
// getMovableTiles 내부
const { width, height } = ctx.map;
// ...
const cost = moveCostFor(terrainAt(ctx, nx, ny), unit.moveClass);
```
`moveCostFor(terrain, moveClass: MoveClass)` 시그니처의 두 번째 인자명도 갱신 (메커니즘 동일 — catchall 오버라이드 ?? default).

movement.test.ts 개정 (fixtures 사용):
```ts
import { describe, it, expect } from "vitest";
import { gameData } from "@tk/data";
import { createBattle } from "../src/createBattle";
import { getMovableTiles, terrainAt, moveCostFor } from "../src/movement";
import { testCtx } from "./fixtures";

describe("이동 v2", () => {
  const state = createBattle(testCtx, 42);

  it("제자리 포함, 성벽(99) 제외, 점유 타일 정지 불가 — 기존 룰 유지", () => {
    const tiles = getMovableTiles(testCtx, state, "관우");
    expect(tiles).toContainEqual({ x: 1, y: 4 });
    for (const t of tiles) {
      expect(terrainAt(testCtx, t.x, t.y).id).not.toBe("wall");
      const occ = state.units.find((u) => u.id !== "관우" && !u.retreated && u.x === t.x && u.y === t.y);
      expect(occ).toBeUndefined();
    }
  });

  it("moveClass별 지형 비용: 기병 산지 3, 산적계 산지 1, 궁병 숲 3", () => {
    const mountain = gameData.terrains["mountain"]!;
    const forest = gameData.terrains["forest"]!;
    expect(moveCostFor(mountain, "cavalry")).toBe(3);
    expect(moveCostFor(mountain, "bandit")).toBe(1);
    expect(moveCostFor(mountain, "foot")).toBe(2);
    expect(moveCostFor(forest, "archerFoot")).toBe(3);
  });

  it("반환 순서 결정론 (y,x 정렬) 유지", () => {
    const a = getMovableTiles(testCtx, state, "관우");
    const b = getMovableTiles(testCtx, state, "관우");
    expect(a).toEqual(b);
  });
});
```

- [ ] **Step 5: actions.ts 정합** — 구조 유지, 3곳 수정:
1. `dealDamage`: `defender.hp` → `defender.troops` (변수명 hp→troops), `{ ...defender, troops, retreated }`
2. attack 케이스의 일반 공격: RNG 체이닝 제거 —
```ts
      // 일반 공격 — 원작 룰: 명중 100%, 분산 없음
      const dmg = computeDamage(ctx, unit, target);
      const hit = dealDamage(state, unit, target, dmg, false);
      next = hit.state;
      events.push(...hit.events);
      const defender = getUnit(next, target.id);
      if (!defender.retreated) {
        const d = distance({ x: unit.x, y: unit.y }, { x: defender.x, y: defender.y });
        if (d >= defender.rangeMin && d <= defender.rangeMax) {
          const ctrDmg = computeDamage(ctx, defender, getUnit(next, unit.id), ctx.data.combat.counterRatio);
          const ctr = dealDamage(next, defender, getUnit(next, unit.id), ctrDmg, true);
          next = ctr.state;
          events.push(...ctr.events);
        }
      }
```
3. 일기토 패자 처리: `hp: 0` → `troops: 0`

actions.test.ts / events.test.ts 개정: 기존 13+3개 시나리오를 fixtures(`testCtx`, 한글 id "관우"/"화웅"/"유비"/"이숙")로 치환. 시나리오 구성은 v0과 동일 유지 (이동/공격/반격/일기토 발동·패자·loserRetreats=false/사거리/페이즈 전환/턴 증가/패배 조건/이동 후 공격). 반격 테스트의 기대값은 `computeDamage(... , counterRatio)` 결정론 값으로 단언 가능 — 예: 화웅이 관우를 공격받아 반격 시 `floor(247×…)` 대신 **함수 호출값과 이벤트 damage가 일치하는지**로 단언해 공식 변경에 강건하게.

- [ ] **Step 6: 전체 엔진 테스트 통과**: `pnpm --filter @tk/engine test` → 전부 PASS (rng 3 + createBattle 6 + combat 9 + movement 3 + events 3 + actions ~13). typecheck 0.

- [ ] **Step 7: Commit**: `feat(engine): 원작 전투 공식 이식 — 보정식·상성0.75/1.25·반격0.5·명중100%`

---

### Task 9: 사수관 원작판 스테이지 — 위키 조사 + 저작 + 통합 테스트

**Files:**
- Create: `packages/data/json/stages/05-sishuiguan.json` (Task 3에서 삭제된 v0의 원작판 후속)
- Modify: `packages/data/src/index.ts` (stages 로드 복원), `packages/data/test/data.test.ts`, `docs/reference/yeonggeoljeon-data.md` (§8-3 추가)

- [ ] **Step 1: 원작 사수관 전투 조사 (WebFetch/WebSearch)**

1. `https://wikiwiki.jp/rimei/` 시나리오 메뉴에서 사수관(汜水関) 전투 페이지를 찾아 가져온다 (1장 반동탁 구간).
2. 기록할 것: 적 부대 구성(장수명/병종/레벨), 승리·패배 조건, 턴 제한, 일기토(발동 조건·결과·보상), 보물/드랍, 아군 출전 부대.
3. 실패 시 폴백: `https://www.cnblogs.com/lykouyi/p/5688506.html` (전투 전표) + 레퍼런스 §3 표(화웅 Lv3 경기병).
4. 조사 결과를 `docs/reference/yeonggeoljeon-data.md`에 **§8-3 "사수관 전투 상세 (위키 교차)"** 섹션으로 추가 (출처 URL 포함). 좌표는 어느 자료에도 없으므로 "배치 좌표는 맵 구조 기반 재량" 명시.

- [ ] **Step 2: 실패하는 통합 테스트 추가** — `packages/data/test/data.test.ts`:

```ts
  it("사수관 스테이지: 참조 무결성 (장수/병종/아이템/맵/이벤트)", () => {
    const s = gameData.stages["05-sishuiguan"]!;
    const m = gameData.maps[s.mapId]!;
    expect(m).toBeDefined();
    const placed = new Set(s.units.map((u) => u.commanderId));
    for (const u of s.units) {
      expect(gameData.commanders[u.commanderId], u.commanderId).toBeDefined();
      expect(gameData.unitClasses[u.classId], u.classId).toBeDefined();
      for (const it of u.items) expect(gameData.items[it], it).toBeDefined();
      expect(u.x).toBeLessThan(m.width);
      expect(u.y).toBeLessThan(m.height);
      // 배치 타일이 통행 가능해야 한다 (성벽/하천 위 배치 금지)
      const terrainId = m.tileLegend[m.tiles[u.y]![u.x]!]!;
      expect(gameData.terrains[terrainId]!.moveCost.default).toBeLessThan(99);
    }
    if ("unitId" in s.victory) expect(placed.has(s.victory.unitId)).toBe(true);
    expect(placed.has(s.defeat.unitId)).toBe(true);
    for (const e of s.events) {
      expect(placed.has(e.trigger.attackerId)).toBe(true);
      expect(placed.has(e.trigger.defenderId)).toBe(true);
    }
  });

  it("사수관: 아군 초기값이 원작 초기 편성과 일치 (유비/관우/장비)", () => {
    const s = gameData.stages["05-sishuiguan"]!;
    for (const name of ["유비", "관우", "장비"]) {
      const u = s.units.find((x) => x.commanderId === name)!;
      const f = gameData.initialForces[name]!;
      expect(u.classId).toBe(f.classId);
      expect(u.troops).toBe(f.troops);
    }
  });
```

- [ ] **Step 3: 실패 확인**: `pnpm --filter @tk/data test` → FAIL (stages 미로드)

- [ ] **Step 4: 스테이지 JSON 저작** — `packages/data/json/stages/05-sishuiguan.json`

아래는 **레퍼런스 §3 기반 기본 구성**이다. Step 1 조사 결과가 다르면 조사 결과를 우선하고 차이를 §8-3에 기록한다:
```json
{
  "id": "05-sishuiguan",
  "name": "사수관 전투",
  "mapId": "sishuiguan",
  "turnLimit": 30,
  "units": [
    { "commanderId": "유비", "classId": "footman",      "level": 1, "troops": 1120, "items": [], "side": "player", "x": 0, "y": 0 },
    { "commanderId": "관우", "classId": "lightCavalry", "level": 1, "troops": 1120, "items": ["청룡언월도"], "side": "player", "x": 0, "y": 0 },
    { "commanderId": "장비", "classId": "lightCavalry", "level": 1, "troops": 1120, "items": ["사모"], "side": "player", "x": 0, "y": 0 },
    { "commanderId": "화웅", "classId": "lightCavalry", "level": 3, "troops": 1760, "items": [], "side": "enemy", "x": 0, "y": 0 },
    { "commanderId": "이숙", "classId": "archer",       "level": 3, "troops": 1760, "items": [], "side": "enemy", "x": 0, "y": 0 },
    { "commanderId": "호진", "classId": "footman",      "level": 3, "troops": 1760, "items": [], "side": "enemy", "x": 0, "y": 0 }
  ],
  "victory": { "kind": "defeatUnit", "unitId": "화웅" },
  "defeat":  { "kind": "lordRetreat", "unitId": "유비" },
  "events": [
    {
      "id": "duel_guanyu_huaxiong",
      "type": "duel",
      "trigger": { "kind": "attack", "attackerId": "관우", "defenderId": "화웅" },
      "outcome": { "winnerId": "관우", "loserRetreats": true },
      "once": true
    }
  ]
}
```
좌표(`x:0,y:0`은 자리표시)는 변환된 `maps/sishuiguan.json`의 tiles를 열어 결정한다: 아군은 관문 반대편 진입로(가로 진행 — 서/동 어느 쪽이 입구인지 타일 구조로 판단), 적은 관문 안쪽·성벽 라인. 화웅은 관문 뒤. 적 부대 구성(이숙/호진 등)과 아군 게스트(공손찬군 등)는 Step 1 조사를 반영. 모든 유닛은 통행 가능 타일 위 (Step 2 테스트가 강제).

- [ ] **Step 5: 로더 복원**: `index.ts`에 `stages: Record<string, Stage>` 로드 추가 (StageSchema, loadJson 패턴).

- [ ] **Step 6: 통과 확인**: `pnpm --filter @tk/data test` → 전부 PASS

- [ ] **Step 7: Commit**: `feat(data): 사수관 원작판 스테이지 — 위키 교차 조사 기반`

---

### Task 10: 시뮬·CLI·웹 정합 + 전체 검증 + 문서 마감

**Files:**
- Modify: `packages/sim/src/runner.ts`, `src/policy.ts`(시그니처 정합 확인만), `src/cli.ts`, `test/runner.test.ts`
- Modify: `apps/web/app/page.tsx` (stage.map → mapId 참조 정합)
- Modify: `README.md`

- [ ] **Step 1: runner.ts 정합** — ctx에 map 해석 추가, maxTurns 기본값을 데이터에서:

```ts
import { gameData, stages } from "@tk/data";
import { applyAction, createBattle, type BattleContext } from "@tk/engine";
import { chooseAction } from "./policy";

export interface RunResult {
  result: "victory" | "defeat" | "timeout";
  turns: number;
  playerRetreats: number;
  duelsFired: string[];
}

export function runBattle(stageId: string, seed: number, maxTurns = gameData.combat.maxTurns): RunResult {
  const stage = stages[stageId];
  if (!stage) throw new Error(`unknown stage: ${stageId}`);
  const map = gameData.maps[stage.mapId];
  if (!map) throw new Error(`unknown map: ${stage.mapId}`);
  const ctx: BattleContext = { data: gameData, stage, map };
  let state = createBattle(ctx, seed);

  let guard = 0;
  // turn은 아군 페이즈 시작 시 증가 — <= 경계로 maxTurns번째 라운드까지 온전히 실행
  while (state.status === "ongoing" && state.turn <= maxTurns) {
    if (++guard > 100_000) throw new Error("simulation runaway"); // 56×32 맵 기준 상향
    const action = chooseAction(ctx, state);
    if (!action) break;
    state = applyAction(ctx, state, action).state;
  }

  return {
    result: state.status === "ongoing" ? "timeout" : state.status,
    turns: Math.min(state.turn, maxTurns),
    playerRetreats: state.units.filter((u) => u.side === "player" && u.retreated).length,
    duelsFired: state.firedEvents,
  };
}
```
policy.ts는 엔진 공개 API만 쓰므로 무수정 예상 — typecheck로 확인. runner.test.ts는 시나리오 동일 유지(결정론 toEqual / 결과 형태 / maxTurns=1 → turns ≤ 1), seed가 결과에 영향을 주지 않게 된 점(분산 제거)에 유의 — 결정론 테스트는 여전히 유효.

- [ ] **Step 2: cli.ts 갱신** — 참고 문구 교체:

```ts
console.log(`(참고: 원작 공식은 분산 없음 — 시드는 현재 결과에 영향 없음. 그리디 정책은 보수적)`);
```

- [ ] **Step 3: apps/web/app/page.tsx 정합**:

```tsx
import { gameData, stages } from "@tk/data";

export default function Home() {
  const stage = stages["05-sishuiguan"]!;
  const map = gameData.maps[stage.mapId]!;
  return (
    <main>
      <h1>삼국지 SRPG — 개발 중</h1>
      <p>첫 스테이지: {stage.name} ({map.width}×{map.height})</p>
      <p>등록 장수: {Object.keys(gameData.commanders).length}명</p>
    </main>
  );
}
```

- [ ] **Step 4: 전체 검증**

Run: `pnpm test` → data/engine/sim 전부 PASS, `pnpm -r typecheck` → 0
Run: `pnpm sim -- --runs 100` → 베이스라인 리포트 출력. **수치(승률/평균 턴)를 구현 보고에 기록** — 원작 데이터 기준 그리디 베이스라인은 다음 밸런스 작업의 비교 기준점.
Run: `pnpm --filter @tk/web dev` → http://localhost:3000 에 "사수관 전투 (56×32)" + "장수 300+명" 표시 확인 후 종료.

- [ ] **Step 5: README.md 갱신** — 구조 표의 data 행을 "원작(영걸전) 수치 기반 — docs/reference 참조"로, 명령어에 `pnpm import-hero  # C:\HERO 원본에서 데이터 JSON 재생성` 추가.

- [ ] **Step 6: Commit**: `feat(sim,web): 원작 모델 정합 — 사수관 56×32 시뮬 베이스라인`

---

## 완료 기준 (Definition of Done)

1. `pnpm test` 전체 PASS + `pnpm -r typecheck` 0
2. `pnpm import-hero` 재실행 시 동일 JSON 재생성 (멱등) — C:\HERO 보유 머신 기준
3. 공식 단위 테스트가 레퍼런스 검증 수치(보정식 5점, 상성, 반격 0.5, guard)로 고정됨
4. 사수관 56×32에서 `pnpm sim` 베이스라인 리포트 출력·기록
5. 코에이 에셋(`tools/hero-extract/out/`)이 git 추적에 없음 (`git status` + `.gitignore` 확인)
6. CLAUDE.md가 새 전략(원작 충실 재현 v1)을 반영

## 다음 서브 프로젝트 (이 계획 범위 밖)

- 사수관 외 1장 스테이지들 (호로관 등 — 맵 변환기는 이미 58개 지원)
- 책략 시스템 (MP 소비·지력차 성공률 — 원작 책략표는 레퍼런스 §7)
- 경험치/레벨업/승급 (공식: 6+레벨차×2, 퇴각 +32)
- PixiJS 렌더러 (56×32 스크롤 맵)
- 사기 변동 규칙 해명 (세이브 비교 실험 또는 커뮤니티 자료)




