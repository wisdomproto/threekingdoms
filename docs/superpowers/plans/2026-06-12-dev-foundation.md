# 개발 준비 (Dev Foundation) 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 모노레포 + 헤드리스 전투 엔진 + 사수관 데이터 + 시뮬레이션 러너 + 에셋 가이드 문서를 만들어 1스테이지 수직 완성의 토대를 놓는다.

**Architecture:** pnpm workspaces 모노레포. `@tk/data`(zod 스키마+JSON, 의존성 제로) ← `@tk/engine`(순수 함수 전투 엔진, 시드 RNG 결정론) ← `@tk/sim`(Node CLI 시뮬 러너). 전투 상태는 직렬화 가능한 plain object, `applyAction(ctx, state, action) → {state, events}`가 유일한 상태 변경 진입점.

**Tech Stack:** TypeScript(strict, ESM), pnpm, vitest, zod, tsx

**Spec:** `docs/superpowers/specs/2026-06-12-dev-foundation-design.md`

---

## 파일 구조

```
threekingdoms/
├── package.json                  # 워크스페이스 루트, 공통 스크립트
├── pnpm-workspace.yaml
├── tsconfig.base.json
├── .gitignore
├── README.md                     # Task 13
├── packages/
│   ├── data/
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── src/
│   │   │   ├── schemas.ts        # zod 스키마 전부 (단일 파일 — 스키마는 함께 변한다)
│   │   │   └── index.ts          # JSON 로드 + 검증 + 타입 익스포트
│   │   ├── json/
│   │   │   ├── terrains.json
│   │   │   ├── unitClasses.json
│   │   │   ├── commanders.json
│   │   │   ├── combat.json
│   │   │   └── stages/05-sishuiguan.json
│   │   └── test/
│   │       ├── schemas.test.ts
│   │       └── data.test.ts
│   ├── engine/
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── src/
│   │   │   ├── types.ts          # BattleState/Action/BattleEvent/BattleContext
│   │   │   ├── rng.ts            # 순수 시드 RNG (mulberry32)
│   │   │   ├── createBattle.ts   # Stage+GameData → 초기 BattleState
│   │   │   ├── movement.ts       # getMovableTiles (다익스트라)
│   │   │   ├── combat.ts         # computeDamage / getAttackableTargets
│   │   │   ├── events.ts         # 스테이지 이벤트(일기토) 트리거 평가
│   │   │   ├── actions.ts        # applyAction + 페이즈 전환 + 승패 판정
│   │   │   └── index.ts
│   │   └── test/ (모듈별 *.test.ts)
│   └── sim/
│       ├── package.json
│       ├── tsconfig.json
│       ├── src/
│       │   ├── policy.ts         # 그리디 AI 정책
│       │   ├── runner.ts         # 1판 자동 실행
│       │   └── cli.ts            # N판 실행 + 리포트
│       └── test/runner.test.ts
├── apps/web/                     # Next.js 빈 골격 (Task 13)
└── docs/asset-pipeline/          # 가이드 3종 (Task 12)
```

**의존 방향:** `data`(의존성 제로) ← `engine` ← `sim`. 역방향 import 금지. engine은 React/DOM/PixiJS를 모른다.

---

### Task 1: 모노레포 스캐폴딩

**Files:**
- Create: `package.json`, `pnpm-workspace.yaml`, `tsconfig.base.json`, `.gitignore`

- [ ] **Step 1: 루트 설정 파일 4개 작성**

`package.json`:
```json
{
  "name": "threekingdoms",
  "private": true,
  "scripts": {
    "test": "pnpm -r test",
    "typecheck": "pnpm -r typecheck",
    "sim": "pnpm --filter @tk/sim start"
  }
}
```

`pnpm-workspace.yaml`:
```yaml
packages:
  - "packages/*"
  - "apps/*"
```

`tsconfig.base.json`:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "resolveJsonModule": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true
  }
}
```

`.gitignore`:
```
node_modules/
.next/
dist/
*.tsbuildinfo
```

- [ ] **Step 2: 설치 확인**

Run: `pnpm install`
Expected: 에러 없이 완료 (워크스페이스 패키지가 아직 없어도 정상). pnpm 미설치 시 `npm install -g pnpm` 먼저.

- [ ] **Step 3: Commit**

```bash
git add package.json pnpm-workspace.yaml tsconfig.base.json .gitignore
git commit -m "chore: pnpm 모노레포 스캐폴딩"
```

---

### Task 2: @tk/data — zod 스키마

**Files:**
- Create: `packages/data/package.json`, `packages/data/tsconfig.json`, `packages/data/src/schemas.ts`
- Test: `packages/data/test/schemas.test.ts`

- [ ] **Step 1: 패키지 설정 작성**

`packages/data/package.json`:
```json
{
  "name": "@tk/data",
  "version": "0.0.1",
  "private": true,
  "type": "module",
  "exports": { ".": "./src/index.ts" },
  "scripts": {
    "test": "vitest run",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": { "zod": "^3.23.8" },
  "devDependencies": { "typescript": "^5.6.0", "vitest": "^2.1.0" }
}
```

`packages/data/tsconfig.json`:
```json
{
  "extends": "../../tsconfig.base.json",
  "include": ["src", "test", "json"]
}
```

- [ ] **Step 2: 실패하는 테스트 작성** — `packages/data/test/schemas.test.ts`

```ts
import { describe, it, expect } from "vitest";
import {
  TerrainSchema, UnitClassSchema, CommanderSchema, CombatConfigSchema, StageSchema,
} from "../src/schemas";

describe("스키마 검증", () => {
  it("지형: 정상 데이터 통과", () => {
    expect(() => TerrainSchema.parse({
      id: "plain", name: "평지", guard: 0, moveCost: { default: 1 },
    })).not.toThrow();
  });

  it("지형: guard 범위(0~0.9) 밖이면 거부", () => {
    expect(() => TerrainSchema.parse({
      id: "x", name: "x", guard: 1.5, moveCost: { default: 1 },
    })).toThrow();
  });

  it("병종: 사거리 min > max면 거부", () => {
    expect(() => UnitClassSchema.parse({
      id: "archer", name: "궁병", move: 4, rangeMin: 2, rangeMax: 1,
    })).toThrow();
  });

  it("장수: 음수 스탯 거부", () => {
    expect(() => CommanderSchema.parse({
      id: "x", name: "x", classId: "infantry", level: 1,
      stats: { hp: -1, mp: 0, atk: 10, def: 10, int: 10 },
    })).toThrow();
  });

  it("스테이지: 맵 타일 행 길이가 width와 다르면 거부", () => {
    expect(() => StageSchema.parse({
      id: "s", name: "s", map: { width: 3, height: 1, tileLegend: { ".": "plain" }, tiles: [".."] },
      units: [], victory: { kind: "defeatAll" }, defeat: { kind: "lordRetreat", unitId: "liubei" },
      events: [],
    })).toThrow();
  });

  it("전투 계수: 정상 데이터 통과", () => {
    expect(() => CombatConfigSchema.parse({
      defFactor: 0.5, levelCoef: 0.05, minDamage: 1, varianceRatio: 0.1,
      classAdvantage: { cavalry: { infantry: 1.3 } },
    })).not.toThrow();
  });
});
```

- [ ] **Step 3: 실패 확인**

Run: `pnpm install` (루트에서, zod/vitest 설치) 후 `pnpm --filter @tk/data test`
Expected: FAIL — `Cannot find module '../src/schemas'`

- [ ] **Step 4: 스키마 구현** — `packages/data/src/schemas.ts`

```ts
import { z } from "zod";

/** 지형. moveCost는 병종 classId별 오버라이드, 없으면 default. 99 이상 = 통행 불가 */
export const TerrainSchema = z.object({
  id: z.string(),
  name: z.string(),
  guard: z.number().min(0).max(0.9), // 피해 감소율
  moveCost: z.object({ default: z.number().int().min(1) }).catchall(z.number().int().min(1)),
});
export type Terrain = z.infer<typeof TerrainSchema>;

export const UnitClassSchema = z.object({
  id: z.string(),
  name: z.string(),
  move: z.number().int().min(1).max(10),
  rangeMin: z.number().int().min(1),
  rangeMax: z.number().int().min(1),
}).refine((c) => c.rangeMin <= c.rangeMax, { message: "rangeMin must be <= rangeMax" });
export type UnitClass = z.infer<typeof UnitClassSchema>;

export const StatsSchema = z.object({
  hp: z.number().int().min(1),
  mp: z.number().int().min(0),
  atk: z.number().int().min(0),
  def: z.number().int().min(0),
  int: z.number().int().min(0),
});

export const CommanderSchema = z.object({
  id: z.string(),
  name: z.string(),
  classId: z.string(),
  level: z.number().int().min(1).max(50),
  stats: StatsSchema,
});
export type Commander = z.infer<typeof CommanderSchema>;

/** 데미지 공식 계수 — 시뮬레이션 튜닝의 손잡이 (CLAUDE.md §11) */
export const CombatConfigSchema = z.object({
  defFactor: z.number(),       // 방어력 반영 비율
  levelCoef: z.number(),       // 레벨 차 1당 데미지 증감률
  minDamage: z.number().int().min(0),
  varianceRatio: z.number().min(0).max(0.5), // 데미지 분산 ±비율
  classAdvantage: z.record(z.record(z.number())), // attacker classId → defender classId → 배율
});
export type CombatConfig = z.infer<typeof CombatConfigSchema>;

export const SideSchema = z.enum(["player", "enemy"]);
export type Side = z.infer<typeof SideSchema>;

export const StageEventSchema = z.object({
  id: z.string(),
  type: z.literal("duel"), // v0: 스토리 일기토만
  trigger: z.object({
    kind: z.literal("attack"), // attackerId가 defenderId를 공격 선언 시
    attackerId: z.string(),
    defenderId: z.string(),
  }),
  outcome: z.object({
    winnerId: z.string(),
    loserRetreats: z.boolean(),
  }),
  once: z.boolean(),
});
export type StageEvent = z.infer<typeof StageEventSchema>;

export const StageSchema = z.object({
  id: z.string(),
  name: z.string(),
  map: z.object({
    width: z.number().int().min(1),
    height: z.number().int().min(1),
    tileLegend: z.record(z.string()), // 1글자 코드 → terrain id
    tiles: z.array(z.string()),       // height개의 행 문자열
  }),
  units: z.array(z.object({
    commanderId: z.string(),
    side: SideSchema,
    x: z.number().int().min(0),
    y: z.number().int().min(0),
  })),
  victory: z.discriminatedUnion("kind", [
    z.object({ kind: z.literal("defeatAll") }),
    z.object({ kind: z.literal("defeatUnit"), unitId: z.string() }),
  ]),
  defeat: z.discriminatedUnion("kind", [
    z.object({ kind: z.literal("lordRetreat"), unitId: z.string() }),
  ]),
  events: z.array(StageEventSchema),
}).refine(
  (s) => s.map.tiles.length === s.map.height && s.map.tiles.every((r) => r.length === s.map.width),
  { message: "tiles must be height rows of width chars" },
);
export type Stage = z.infer<typeof StageSchema>;
```

- [ ] **Step 5: 통과 확인**

Run: `pnpm --filter @tk/data test`
Expected: PASS (6 tests)

- [ ] **Step 6: Commit**

```bash
git add packages/data
git commit -m "feat(data): 지형/병종/장수/전투계수/스테이지 zod 스키마"
```

---

### Task 3: @tk/data — 사수관 데이터 JSON + 로더

**Files:**
- Create: `packages/data/json/terrains.json`, `unitClasses.json`, `commanders.json`, `combat.json`, `stages/05-sishuiguan.json`, `packages/data/src/index.ts`
- Test: `packages/data/test/data.test.ts`

- [ ] **Step 1: 실패하는 테스트 작성** — `packages/data/test/data.test.ts`

```ts
import { describe, it, expect } from "vitest";
import { gameData, stages } from "../src/index";

describe("게임 데이터 무결성", () => {
  it("모든 JSON이 스키마를 통과해 로드된다", () => {
    expect(Object.keys(gameData.terrains).length).toBeGreaterThan(0);
    expect(Object.keys(gameData.unitClasses).length).toBeGreaterThan(0);
    expect(Object.keys(gameData.commanders).length).toBeGreaterThan(0);
  });

  it("장수의 classId는 전부 병종 테이블에 존재한다", () => {
    for (const c of Object.values(gameData.commanders)) {
      expect(gameData.unitClasses[c.classId], `${c.id}.classId=${c.classId}`).toBeDefined();
    }
  });

  it("사수관: 배치 유닛의 commanderId가 전부 존재하고 맵 범위 안이다", () => {
    const stage = stages["05-sishuiguan"]!;
    for (const u of stage.units) {
      expect(gameData.commanders[u.commanderId], u.commanderId).toBeDefined();
      expect(u.x).toBeLessThan(stage.map.width);
      expect(u.y).toBeLessThan(stage.map.height);
    }
  });

  it("사수관: 타일 코드가 전부 legend에 있고 legend의 지형이 전부 존재한다", () => {
    const stage = stages["05-sishuiguan"]!;
    for (const row of stage.map.tiles) {
      for (const ch of row) expect(stage.map.tileLegend[ch], `tile '${ch}'`).toBeDefined();
    }
    for (const tid of Object.values(stage.map.tileLegend)) {
      expect(gameData.terrains[tid], tid).toBeDefined();
    }
  });

  it("사수관: 일기토 이벤트 참가자가 전부 배치되어 있다", () => {
    const stage = stages["05-sishuiguan"]!;
    const placed = new Set(stage.units.map((u) => u.commanderId));
    for (const e of stage.events) {
      expect(placed.has(e.trigger.attackerId)).toBe(true);
      expect(placed.has(e.trigger.defenderId)).toBe(true);
    }
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `pnpm --filter @tk/data test`
Expected: FAIL — `Cannot find module '../src/index'`

- [ ] **Step 3: JSON 데이터 작성**

`packages/data/json/terrains.json`:
```json
{
  "plain":    { "id": "plain",    "name": "평지", "guard": 0,    "moveCost": { "default": 1 } },
  "road":     { "id": "road",     "name": "가도", "guard": 0,    "moveCost": { "default": 1 } },
  "forest":   { "id": "forest",   "name": "숲",   "guard": 0.15, "moveCost": { "default": 2, "infantry": 1, "bandit": 1 } },
  "mountain": { "id": "mountain", "name": "산악", "guard": 0.3,  "moveCost": { "default": 3, "bandit": 1, "cavalry": 4 } },
  "wall":     { "id": "wall",     "name": "성벽", "guard": 0,    "moveCost": { "default": 99 } },
  "gate":     { "id": "gate",     "name": "관문", "guard": 0.2,  "moveCost": { "default": 1 } }
}
```

`packages/data/json/unitClasses.json` (사수관 등장분만 — CLAUDE.md §7의 부분집합):
```json
{
  "lord":       { "id": "lord",       "name": "군주",   "move": 5, "rangeMin": 1, "rangeMax": 1 },
  "cavalry":    { "id": "cavalry",    "name": "기병",   "move": 6, "rangeMin": 1, "rangeMax": 1 },
  "infantry":   { "id": "infantry",   "name": "보병",   "move": 4, "rangeMin": 1, "rangeMax": 1 },
  "archer":     { "id": "archer",     "name": "궁병",   "move": 4, "rangeMin": 2, "rangeMax": 2 },
  "strategist": { "id": "strategist", "name": "책사",   "move": 4, "rangeMin": 1, "rangeMax": 1 },
  "healer":     { "id": "healer",     "name": "풍수사", "move": 4, "rangeMin": 1, "rangeMax": 1 }
}
```

`packages/data/json/commanders.json` (수치는 시뮬 튜닝 전 초안):
```json
{
  "liubei":    { "id": "liubei",    "name": "유비", "classId": "lord",     "level": 7,
                 "stats": { "hp": 58, "mp": 10, "atk": 14, "def": 12, "int": 12 } },
  "guanyu":    { "id": "guanyu",    "name": "관우", "classId": "cavalry",  "level": 8,
                 "stats": { "hp": 64, "mp": 6,  "atk": 19, "def": 14, "int": 11 } },
  "zhangfei":  { "id": "zhangfei",  "name": "장비", "classId": "cavalry",  "level": 8,
                 "stats": { "hp": 66, "mp": 4,  "atk": 18, "def": 13, "int": 7 } },
  "jianyong":  { "id": "jianyong",  "name": "간옹", "classId": "strategist", "level": 6,
                 "stats": { "hp": 40, "mp": 22, "atk": 8,  "def": 7,  "int": 15 } },
  "mizhu":     { "id": "mizhu",     "name": "미축", "classId": "healer",   "level": 6,
                 "stats": { "hp": 42, "mp": 24, "atk": 7,  "def": 8,  "int": 14 } },
  "huaxiong":  { "id": "huaxiong",  "name": "화웅", "classId": "cavalry",  "level": 10,
                 "stats": { "hp": 78, "mp": 4,  "atk": 21, "def": 15, "int": 8 } },
  "dong_inf1": { "id": "dong_inf1", "name": "동탁군 보병", "classId": "infantry", "level": 7,
                 "stats": { "hp": 50, "mp": 0, "atk": 14, "def": 13, "int": 5 } },
  "dong_inf2": { "id": "dong_inf2", "name": "동탁군 보병", "classId": "infantry", "level": 7,
                 "stats": { "hp": 50, "mp": 0, "atk": 14, "def": 13, "int": 5 } },
  "dong_arc1": { "id": "dong_arc1", "name": "동탁군 궁병", "classId": "archer",   "level": 7,
                 "stats": { "hp": 42, "mp": 0, "atk": 15, "def": 9,  "int": 6 } },
  "dong_arc2": { "id": "dong_arc2", "name": "동탁군 궁병", "classId": "archer",   "level": 7,
                 "stats": { "hp": 42, "mp": 0, "atk": 15, "def": 9,  "int": 6 } },
  "dong_cav1": { "id": "dong_cav1", "name": "동탁군 기병", "classId": "cavalry",  "level": 8,
                 "stats": { "hp": 54, "mp": 0, "atk": 16, "def": 12, "int": 5 } }
}
```

`packages/data/json/combat.json`:
```json
{
  "defFactor": 0.6,
  "levelCoef": 0.04,
  "minDamage": 1,
  "varianceRatio": 0.1,
  "classAdvantage": {
    "cavalry":  { "infantry": 1.3 },
    "infantry": { "archer": 1.3 },
    "archer":   { "cavalry": 1.3 }
  }
}
```

`packages/data/json/stages/05-sishuiguan.json` — 12×12, 아래(남)에서 위(북) 관문으로 진격. `#`=성벽, `G`=관문, `r`=가도, `f`=숲, `m`=산악, `.`=평지:
```json
{
  "id": "05-sishuiguan",
  "name": "사수관 전투",
  "map": {
    "width": 12,
    "height": 12,
    "tileLegend": { ".": "plain", "r": "road", "f": "forest", "m": "mountain", "#": "wall", "G": "gate" },
    "tiles": [
      "mm########mm",
      "mm#....G.#mm",
      "m.#....G.#.m",
      "m..........m",
      "f....r.r...f",
      "f....r.r..ff",
      ".....r.r....",
      "..f..r.r..f.",
      ".....r.r....",
      "..f..r.r....",
      ".....r.r..f.",
      ".....r.r...."
    ]
  },
  "units": [
    { "commanderId": "liubei",    "side": "player", "x": 5,  "y": 11 },
    { "commanderId": "guanyu",    "side": "player", "x": 4,  "y": 10 },
    { "commanderId": "zhangfei",  "side": "player", "x": 7,  "y": 10 },
    { "commanderId": "jianyong",  "side": "player", "x": 5,  "y": 10 },
    { "commanderId": "mizhu",     "side": "player", "x": 6,  "y": 11 },
    { "commanderId": "huaxiong",  "side": "enemy",  "x": 6,  "y": 2 },
    { "commanderId": "dong_inf1", "side": "enemy",  "x": 4,  "y": 4 },
    { "commanderId": "dong_inf2", "side": "enemy",  "x": 8,  "y": 4 },
    { "commanderId": "dong_arc1", "side": "enemy",  "x": 5,  "y": 3 },
    { "commanderId": "dong_arc2", "side": "enemy",  "x": 7,  "y": 3 },
    { "commanderId": "dong_cav1", "side": "enemy",  "x": 6,  "y": 6 }
  ],
  "victory": { "kind": "defeatUnit", "unitId": "huaxiong" },
  "defeat":  { "kind": "lordRetreat", "unitId": "liubei" },
  "events": [
    {
      "id": "duel_guanyu_huaxiong",
      "type": "duel",
      "trigger": { "kind": "attack", "attackerId": "guanyu", "defenderId": "huaxiong" },
      "outcome": { "winnerId": "guanyu", "loserRetreats": true },
      "once": true
    }
  ]
}
```

주의: `tiles`의 각 행은 정확히 12자 — 스키마의 refine이 검증하므로 어긋나면 테스트가 잡는다. 관문(`G`)은 x=7 열, 화웅은 성벽 안쪽 (6,2)에 있고 (6,3)이 비어 있어 관우가 인접 공격(일기토 트리거) 가능하다.

- [ ] **Step 4: 로더 구현** — `packages/data/src/index.ts`

```ts
import { z } from "zod";
import {
  TerrainSchema, UnitClassSchema, CommanderSchema, CombatConfigSchema, StageSchema,
  type Terrain, type UnitClass, type Commander, type CombatConfig, type Stage,
} from "./schemas";
import terrainsJson from "../json/terrains.json";
import unitClassesJson from "../json/unitClasses.json";
import commandersJson from "../json/commanders.json";
import combatJson from "../json/combat.json";
import sishuiguanJson from "../json/stages/05-sishuiguan.json";

export * from "./schemas";

export interface GameData {
  terrains: Record<string, Terrain>;
  unitClasses: Record<string, UnitClass>;
  commanders: Record<string, Commander>;
  combat: CombatConfig;
}

/** import 시점에 전부 검증 — 잘못된 JSON은 여기서 즉시 터진다 */
export const gameData: GameData = {
  terrains: z.record(TerrainSchema).parse(terrainsJson),
  unitClasses: z.record(UnitClassSchema).parse(unitClassesJson),
  commanders: z.record(CommanderSchema).parse(commandersJson),
  combat: CombatConfigSchema.parse(combatJson),
};

export const stages: Record<string, Stage> = {
  "05-sishuiguan": StageSchema.parse(sishuiguanJson),
};
```

- [ ] **Step 5: 통과 확인**

Run: `pnpm --filter @tk/data test`
Expected: PASS (Task 2의 6개 + 신규 5개 = 11 tests). 타일 행 길이 오류가 나면 JSON의 해당 행을 12자로 교정.

- [ ] **Step 6: Commit**

```bash
git add packages/data
git commit -m "feat(data): 사수관 스테이지·유닛 데이터 및 검증 로더"
```

---

### Task 4: @tk/engine — 타입, RNG, createBattle

**Files:**
- Create: `packages/engine/package.json`, `tsconfig.json`, `src/types.ts`, `src/rng.ts`, `src/createBattle.ts`, `src/index.ts`
- Test: `packages/engine/test/createBattle.test.ts`, `packages/engine/test/rng.test.ts`

- [ ] **Step 1: 패키지 설정 작성**

`packages/engine/package.json`:
```json
{
  "name": "@tk/engine",
  "version": "0.0.1",
  "private": true,
  "type": "module",
  "exports": { ".": "./src/index.ts" },
  "scripts": { "test": "vitest run", "typecheck": "tsc --noEmit" },
  "dependencies": { "@tk/data": "workspace:*" },
  "devDependencies": { "typescript": "^5.6.0", "vitest": "^2.1.0" }
}
```

`packages/engine/tsconfig.json`:
```json
{ "extends": "../../tsconfig.base.json", "include": ["src", "test"] }
```

- [ ] **Step 2: 실패하는 테스트 작성**

`packages/engine/test/rng.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { nextRandom } from "../src/rng";

describe("시드 RNG", () => {
  it("같은 상태 → 같은 결과 (결정론)", () => {
    const [v1, s1] = nextRandom(42);
    const [v2, s2] = nextRandom(42);
    expect(v1).toBe(v2);
    expect(s1).toBe(s2);
  });
  it("0 이상 1 미만 값을 내고 상태가 전진한다", () => {
    const [v, s] = nextRandom(42);
    expect(v).toBeGreaterThanOrEqual(0);
    expect(v).toBeLessThan(1);
    expect(s).not.toBe(42);
  });
});
```

`packages/engine/test/createBattle.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { gameData, stages } from "@tk/data";
import { createBattle } from "../src/createBattle";

const stage = stages["05-sishuiguan"]!;

describe("createBattle", () => {
  it("스테이지의 모든 유닛이 스탯 해석되어 배치된다", () => {
    const state = createBattle(stage, gameData, 42);
    expect(state.units).toHaveLength(stage.units.length);
    const guanyu = state.units.find((u) => u.id === "guanyu")!;
    expect(guanyu.hp).toBe(64);
    expect(guanyu.move).toBe(6);       // cavalry
    expect(guanyu.side).toBe("player");
  });
  it("턴 1, 아군 페이즈, ongoing으로 시작한다", () => {
    const state = createBattle(stage, gameData, 42);
    expect(state.turn).toBe(1);
    expect(state.phase).toBe("player");
    expect(state.status).toBe("ongoing");
    expect(state.rngState).toBe(42);
  });
});
```

- [ ] **Step 3: 실패 확인**

Run: `pnpm install` 후 `pnpm --filter @tk/engine test`
Expected: FAIL — 모듈 없음

- [ ] **Step 4: 구현**

`packages/engine/src/types.ts`:
```ts
import type { GameData, Stage, Side } from "@tk/data";

export interface Coord { x: number; y: number }

export interface UnitState {
  id: string;          // commanderId 재사용 (스테이지 내 유일)
  classId: string;
  side: Side;
  x: number; y: number;
  level: number;
  hp: number; maxHp: number;
  mp: number; maxMp: number;
  atk: number; def: number; int: number;
  move: number;
  rangeMin: number; rangeMax: number;
  moved: boolean;      // 이번 페이즈에 이동했는가
  acted: boolean;      // 이번 페이즈 행동(공격/대기) 완료했는가
  retreated: boolean;  // HP 0 = 퇴각 (사망 없음 — CLAUDE.md §10)
}

export interface BattleState {
  turn: number;
  phase: Side;
  status: "ongoing" | "victory" | "defeat";
  units: UnitState[];
  rngState: number;
  firedEvents: string[]; // once 이벤트 중복 발동 방지
}

export type Action =
  | { type: "move"; unitId: string; to: Coord }
  | { type: "attack"; unitId: string; targetId: string }
  | { type: "wait"; unitId: string };

export type BattleEvent =
  | { type: "unitMoved"; unitId: string; from: Coord; to: Coord }
  | { type: "damageDealt"; attackerId: string; defenderId: string; damage: number; counter: boolean }
  | { type: "unitRetreated"; unitId: string }
  | { type: "duelTriggered"; eventId: string; attackerId: string; defenderId: string; winnerId: string }
  | { type: "phaseChanged"; phase: Side; turn: number }
  | { type: "battleEnded"; result: "victory" | "defeat" };

/** 정적 컨텍스트 — 상태와 분리해 BattleState를 직렬화 가능하게 유지 */
export interface BattleContext { data: GameData; stage: Stage }

export interface ActionResult { state: BattleState; events: BattleEvent[] }
```

`packages/engine/src/rng.ts`:
```ts
/** mulberry32 — 순수 함수형: [0,1) 값과 다음 상태를 반환 */
export function nextRandom(state: number): [number, number] {
  const t = (state + 0x6d2b79f5) | 0;
  let r = Math.imul(t ^ (t >>> 15), 1 | t);
  r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
  return [((r ^ (r >>> 14)) >>> 0) / 4294967296, t];
}
```

`packages/engine/src/createBattle.ts`:
```ts
import type { GameData, Stage } from "@tk/data";
import type { BattleState, UnitState } from "./types";

export function createBattle(stage: Stage, data: GameData, seed: number): BattleState {
  const units: UnitState[] = stage.units.map((p) => {
    const cmd = data.commanders[p.commanderId];
    if (!cmd) throw new Error(`unknown commander: ${p.commanderId}`);
    const cls = data.unitClasses[cmd.classId];
    if (!cls) throw new Error(`unknown class: ${cmd.classId}`);
    return {
      id: cmd.id, classId: cls.id, side: p.side,
      x: p.x, y: p.y, level: cmd.level,
      hp: cmd.stats.hp, maxHp: cmd.stats.hp,
      mp: cmd.stats.mp, maxMp: cmd.stats.mp,
      atk: cmd.stats.atk, def: cmd.stats.def, int: cmd.stats.int,
      move: cls.move, rangeMin: cls.rangeMin, rangeMax: cls.rangeMax,
      moved: false, acted: false, retreated: false,
    };
  });
  return { turn: 1, phase: "player", status: "ongoing", units, rngState: seed, firedEvents: [] };
}
```

`packages/engine/src/index.ts` (이후 Task에서 export 추가):
```ts
export * from "./types";
export { nextRandom } from "./rng";
export { createBattle } from "./createBattle";
```

- [ ] **Step 5: 통과 확인**

Run: `pnpm --filter @tk/engine test`
Expected: PASS (4 tests)

- [ ] **Step 6: Commit**

```bash
git add packages/engine
git commit -m "feat(engine): 전투 상태 타입·시드 RNG·createBattle"
```

---

### Task 5: @tk/engine — 이동 (getMovableTiles)

**Files:**
- Create: `packages/engine/src/movement.ts`
- Modify: `packages/engine/src/index.ts` (export 추가)
- Test: `packages/engine/test/movement.test.ts`

- [ ] **Step 1: 실패하는 테스트 작성** — `packages/engine/test/movement.test.ts`

```ts
import { describe, it, expect } from "vitest";
import { gameData, stages } from "@tk/data";
import { createBattle } from "../src/createBattle";
import { getMovableTiles, terrainAt } from "../src/movement";
import type { BattleContext } from "../src/types";

const ctx: BattleContext = { data: gameData, stage: stages["05-sishuiguan"]! };

describe("getMovableTiles", () => {
  it("이동력 범위 안의 타일만 반환하고 제자리를 포함한다", () => {
    const state = createBattle(ctx.stage, ctx.data, 42);
    const guanyu = state.units.find((u) => u.id === "guanyu")!;
    const tiles = getMovableTiles(ctx, state, "guanyu");
    expect(tiles).toContainEqual({ x: guanyu.x, y: guanyu.y });
    for (const t of tiles) {
      const manhattan = Math.abs(t.x - guanyu.x) + Math.abs(t.y - guanyu.y);
      expect(manhattan).toBeLessThanOrEqual(guanyu.move); // 비용 1 미만 지형은 없으므로 상한
    }
  });

  it("성벽(비용 99)은 포함되지 않는다", () => {
    const state = createBattle(ctx.stage, ctx.data, 42);
    const tiles = getMovableTiles(ctx, state, "guanyu");
    for (const t of tiles) {
      expect(terrainAt(ctx, t.x, t.y).id).not.toBe("wall");
    }
  });

  it("다른 유닛이 점유한 타일은 목적지가 될 수 없다", () => {
    const state = createBattle(ctx.stage, ctx.data, 42);
    const occupied = state.units
      .filter((u) => u.id !== "guanyu" && !u.retreated)
      .map((u) => `${u.x},${u.y}`);
    const tiles = getMovableTiles(ctx, state, "guanyu");
    for (const t of tiles) expect(occupied).not.toContain(`${t.x},${t.y}`);
  });

  it("적 유닛은 통과도 불가, 아군 유닛은 통과 가능", () => {
    // 사수관 초기 배치에서 유비(5,11)는 관우(4,10)·미축(6,11) 등 아군에 둘러싸여 있다.
    // 아군 통과가 안 되면 도달 타일 수가 급감하므로, 아군 점유 타일 너머의 타일이 포함되는지 본다.
    const state = createBattle(ctx.stage, ctx.data, 42);
    const tiles = getMovableTiles(ctx, state, "liubei");
    expect(tiles.some((t) => t.y <= 7)).toBe(true); // 아군 라인 너머 북쪽으로 도달 가능
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `pnpm --filter @tk/engine test`
Expected: FAIL — `Cannot find module '../src/movement'`

- [ ] **Step 3: 구현** — `packages/engine/src/movement.ts`

```ts
import type { Terrain } from "@tk/data";
import type { BattleContext, BattleState, Coord, UnitState } from "./types";

export function terrainAt(ctx: BattleContext, x: number, y: number): Terrain {
  const row = ctx.stage.map.tiles[y];
  if (row === undefined) throw new Error(`y out of range: ${y}`);
  const ch = row[x];
  if (ch === undefined) throw new Error(`x out of range: ${x}`);
  const tid = ctx.stage.map.tileLegend[ch];
  const terrain = tid ? ctx.data.terrains[tid] : undefined;
  if (!terrain) throw new Error(`unknown tile '${ch}' at (${x},${y})`);
  return terrain;
}

export function moveCostFor(terrain: Terrain, classId: string): number {
  return terrain.moveCost[classId] ?? terrain.moveCost.default;
}

export function unitAt(state: BattleState, x: number, y: number): UnitState | undefined {
  return state.units.find((u) => !u.retreated && u.x === x && u.y === y);
}

const IMPASSABLE = 99;

/** 다익스트라. 적 점유 타일은 통과 불가, 아군 점유 타일은 통과 가능·정지 불가 */
export function getMovableTiles(ctx: BattleContext, state: BattleState, unitId: string): Coord[] {
  const unit = state.units.find((u) => u.id === unitId);
  if (!unit || unit.retreated) return [];
  const { width, height } = ctx.stage.map;

  const dist = new Map<string, number>();
  const key = (x: number, y: number) => `${x},${y}`;
  dist.set(key(unit.x, unit.y), 0);
  // 이동력이 한 자릿수라 우선순위 큐 없이 단순 배열로 충분 (맵 12×12)
  const frontier: Array<{ x: number; y: number; cost: number }> = [{ x: unit.x, y: unit.y, cost: 0 }];

  while (frontier.length > 0) {
    frontier.sort((a, b) => a.cost - b.cost);
    const cur = frontier.shift()!;
    if (cur.cost > (dist.get(key(cur.x, cur.y)) ?? Infinity)) continue;
    for (const [dx, dy] of [[0, -1], [0, 1], [-1, 0], [1, 0]] as const) {
      const nx = cur.x + dx, ny = cur.y + dy;
      if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
      const occupant = unitAt(state, nx, ny);
      if (occupant && occupant.side !== unit.side) continue; // 적은 통과 불가
      const cost = moveCostFor(terrainAt(ctx, nx, ny), unit.classId);
      if (cost >= IMPASSABLE) continue;
      const next = cur.cost + cost;
      if (next > unit.move) continue;
      if (next < (dist.get(key(nx, ny)) ?? Infinity)) {
        dist.set(key(nx, ny), next);
        frontier.push({ x: nx, y: ny, cost: next });
      }
    }
  }

  const result: Coord[] = [];
  for (const k of dist.keys()) {
    const [x, y] = k.split(",").map(Number) as [number, number];
    const occupant = unitAt(state, x, y);
    if (occupant && occupant.id !== unit.id) continue; // 점유 타일에 정지 불가
    result.push({ x, y });
  }
  return result;
}
```

`packages/engine/src/index.ts`에 추가:
```ts
export { getMovableTiles, terrainAt, moveCostFor, unitAt } from "./movement";
```

- [ ] **Step 4: 통과 확인**

Run: `pnpm --filter @tk/engine test`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/engine
git commit -m "feat(engine): 지형 비용 기반 이동 범위 계산"
```

---

### Task 6: @tk/engine — 데미지 공식과 공격 대상

**Files:**
- Create: `packages/engine/src/combat.ts`
- Modify: `packages/engine/src/index.ts`
- Test: `packages/engine/test/combat.test.ts`

- [ ] **Step 1: 실패하는 테스트 작성** — `packages/engine/test/combat.test.ts`

```ts
import { describe, it, expect } from "vitest";
import { gameData, stages } from "@tk/data";
import { createBattle } from "../src/createBattle";
import { computeDamage, getAttackableTargets } from "../src/combat";
import type { BattleContext } from "../src/types";

const ctx: BattleContext = { data: gameData, stage: stages["05-sishuiguan"]! };

function unitsOf(state: ReturnType<typeof createBattle>) {
  const get = (id: string) => state.units.find((u) => u.id === id)!;
  return { get };
}

describe("computeDamage", () => {
  it("같은 입력 + 같은 rngState = 같은 데미지 (결정론)", () => {
    const state = createBattle(ctx.stage, ctx.data, 42);
    const { get } = unitsOf(state);
    const a = computeDamage(ctx, state, get("guanyu"), get("dong_inf1"));
    const b = computeDamage(ctx, state, get("guanyu"), get("dong_inf1"));
    expect(a.damage).toBe(b.damage);
    expect(a.nextRngState).toBe(b.nextRngState);
  });

  it("상성 우위(기병→보병)가 비우위(기병→기병)보다 큰 데미지", () => {
    const state = createBattle(ctx.stage, ctx.data, 42);
    const { get } = unitsOf(state);
    // 분산 영향을 없애기 위해 varianceRatio 0인 설정으로 비교
    const ctx0: BattleContext = {
      ...ctx, data: { ...ctx.data, combat: { ...ctx.data.combat, varianceRatio: 0 } },
    };
    const vsInf = computeDamage(ctx0, state, get("guanyu"), get("dong_inf1")).damage;
    const vsCav = computeDamage(ctx0, state, get("guanyu"), get("dong_cav1")).damage;
    expect(vsInf).toBeGreaterThan(0);
    // dong_inf1(def 13) vs dong_cav1(def 12): 방어가 더 높아도 상성 1.3배가 이긴다
    expect(vsInf).toBeGreaterThan(vsCav);
  });

  it("최소 데미지가 보장된다", () => {
    const state = createBattle(ctx.stage, ctx.data, 42);
    const { get } = unitsOf(state);
    const weak = { ...get("jianyong"), atk: 1 };
    const r = computeDamage(ctx, state, weak, get("huaxiong"));
    expect(r.damage).toBeGreaterThanOrEqual(ctx.data.combat.minDamage);
  });
});

describe("getAttackableTargets", () => {
  it("사거리 안의 적만 반환한다", () => {
    const state = createBattle(ctx.stage, ctx.data, 42);
    // 관우(rangeMin=rangeMax=1)를 dong_inf1 (4,4) 옆 (4,5)에 둔 가상 위치에서 판정
    const ids = getAttackableTargets(ctx, state, "guanyu", { x: 4, y: 5 });
    expect(ids).toContain("dong_inf1");
    expect(ids).not.toContain("huaxiong"); // 멀리 있음
  });

  it("궁병은 인접(거리 1) 적을 공격할 수 없다 (rangeMin=2)", () => {
    const state = createBattle(ctx.stage, ctx.data, 42);
    const ids = getAttackableTargets(ctx, state, "dong_arc1", { x: 4, y: 5 }); // dong_inf1과 거리 1
    expect(ids).not.toContain("dong_inf1");
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `pnpm --filter @tk/engine test`
Expected: FAIL — 모듈 없음

- [ ] **Step 3: 구현** — `packages/engine/src/combat.ts`

```ts
import type { BattleContext, BattleState, Coord, UnitState } from "./types";
import { nextRandom } from "./rng";
import { terrainAt } from "./movement";

/**
 * 데미지 공식 (계수는 전부 data/combat.json — CLAUDE.md §11 데이터-코드 분리):
 * base  = atk - def * defFactor
 * mult  = 상성 배율 × (1 - 방어측 지형 guard) × (1 + 레벨차 × levelCoef)
 * 분산  = ±varianceRatio (시드 RNG)
 * 결과  = max(minDamage, floor(base × mult × variance))
 */
export function computeDamage(
  ctx: BattleContext, state: BattleState, attacker: UnitState, defender: UnitState,
): { damage: number; nextRngState: number } {
  const cfg = ctx.data.combat;
  const base = Math.max(0, attacker.atk - defender.def * cfg.defFactor);
  const advantage = cfg.classAdvantage[attacker.classId]?.[defender.classId] ?? 1;
  const guard = terrainAt(ctx, defender.x, defender.y).guard;
  const levelFactor = 1 + (attacker.level - defender.level) * cfg.levelCoef;
  const [rand, nextRngState] = nextRandom(state.rngState);
  const variance = 1 - cfg.varianceRatio + rand * cfg.varianceRatio * 2;
  const damage = Math.max(cfg.minDamage, Math.floor(base * advantage * (1 - guard) * levelFactor * variance));
  return { damage, nextRngState };
}

export function distance(a: Coord, b: Coord): number {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

/** from 위치 기준 사거리 내 적 id 목록. from 생략 시 현재 위치 */
export function getAttackableTargets(
  ctx: BattleContext, state: BattleState, unitId: string, from?: Coord,
): string[] {
  const unit = state.units.find((u) => u.id === unitId);
  if (!unit || unit.retreated) return [];
  const pos = from ?? { x: unit.x, y: unit.y };
  return state.units
    .filter((t) => t.side !== unit.side && !t.retreated)
    .filter((t) => {
      const d = distance(pos, t);
      return d >= unit.rangeMin && d <= unit.rangeMax;
    })
    .map((t) => t.id);
}
```

`packages/engine/src/index.ts`에 추가:
```ts
export { computeDamage, getAttackableTargets, distance } from "./combat";
```

- [ ] **Step 4: 통과 확인**

Run: `pnpm --filter @tk/engine test`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/engine
git commit -m "feat(engine): 상성·지형·레벨차 데미지 공식과 사거리 판정"
```

---

### Task 7: @tk/engine — 일기토 트리거 평가

applyAction(Task 8)이 사용할 순수 헬퍼를 먼저 만든다.

**Files:**
- Create: `packages/engine/src/events.ts`
- Modify: `packages/engine/src/index.ts`
- Test: `packages/engine/test/events.test.ts`

- [ ] **Step 1: 실패하는 테스트 작성** — `packages/engine/test/events.test.ts`

```ts
import { describe, it, expect } from "vitest";
import { gameData, stages } from "@tk/data";
import { createBattle } from "../src/createBattle";
import { findDuelTrigger } from "../src/events";
import type { BattleContext } from "../src/types";

const ctx: BattleContext = { data: gameData, stage: stages["05-sishuiguan"]! };

describe("findDuelTrigger", () => {
  it("관우가 화웅 공격 시 일기토 트리거가 잡힌다", () => {
    const state = createBattle(ctx.stage, ctx.data, 42);
    const ev = findDuelTrigger(ctx, state, "guanyu", "huaxiong");
    expect(ev?.id).toBe("duel_guanyu_huaxiong");
  });

  it("다른 조합(장비→화웅)은 트리거되지 않는다", () => {
    const state = createBattle(ctx.stage, ctx.data, 42);
    expect(findDuelTrigger(ctx, state, "zhangfei", "huaxiong")).toBeUndefined();
  });

  it("이미 발동된(once) 이벤트는 다시 잡히지 않는다", () => {
    const state = createBattle(ctx.stage, ctx.data, 42);
    const fired = { ...state, firedEvents: ["duel_guanyu_huaxiong"] };
    expect(findDuelTrigger(ctx, fired, "guanyu", "huaxiong")).toBeUndefined();
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `pnpm --filter @tk/engine test`
Expected: FAIL — 모듈 없음

- [ ] **Step 3: 구현** — `packages/engine/src/events.ts`

```ts
import type { StageEvent } from "@tk/data";
import type { BattleContext, BattleState } from "./types";

/** attackerId가 defenderId를 공격 선언했을 때 발동할 일기토 이벤트를 찾는다 */
export function findDuelTrigger(
  ctx: BattleContext, state: BattleState, attackerId: string, defenderId: string,
): StageEvent | undefined {
  return ctx.stage.events.find((e) =>
    e.type === "duel" &&
    e.trigger.kind === "attack" &&
    e.trigger.attackerId === attackerId &&
    e.trigger.defenderId === defenderId &&
    !(e.once && state.firedEvents.includes(e.id)),
  );
}
```

`packages/engine/src/index.ts`에 추가:
```ts
export { findDuelTrigger } from "./events";
```

- [ ] **Step 4: 통과 확인**

Run: `pnpm --filter @tk/engine test`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/engine
git commit -m "feat(engine): 스토리 일기토 트리거 평가"
```

---

### Task 8: @tk/engine — applyAction (이동/공격/반격/대기/페이즈/승패)

엔진의 심장. 유일한 상태 변경 진입점.

**Files:**
- Create: `packages/engine/src/actions.ts`
- Modify: `packages/engine/src/index.ts`
- Test: `packages/engine/test/actions.test.ts`

- [ ] **Step 1: 실패하는 테스트 작성** — `packages/engine/test/actions.test.ts`

```ts
import { describe, it, expect } from "vitest";
import { gameData, stages } from "@tk/data";
import { createBattle } from "../src/createBattle";
import { applyAction } from "../src/actions";
import type { BattleContext, BattleState } from "../src/types";

const ctx: BattleContext = { data: gameData, stage: stages["05-sishuiguan"]! };
const fresh = () => createBattle(ctx.stage, ctx.data, 42);
const get = (s: BattleState, id: string) => s.units.find((u) => u.id === id)!;

/** 테스트용: 유닛을 강제로 특정 위치/상태로 옮긴 사본 */
function patchUnit(s: BattleState, id: string, patch: Partial<ReturnType<typeof get>>): BattleState {
  return { ...s, units: s.units.map((u) => (u.id === id ? { ...u, ...patch } : u)) };
}

describe("applyAction: move", () => {
  it("이동하면 위치가 바뀌고 unitMoved 이벤트, moved=true", () => {
    const s0 = fresh();
    const g0 = get(s0, "guanyu");
    const { state, events } = applyAction(ctx, s0, { type: "move", unitId: "guanyu", to: { x: 4, y: 7 } });
    expect(get(state, "guanyu")).toMatchObject({ x: 4, y: 7, moved: true, acted: false });
    expect(events).toContainEqual({ type: "unitMoved", unitId: "guanyu", from: { x: g0.x, y: g0.y }, to: { x: 4, y: 7 } });
    expect(s0).toEqual(fresh()); // 원본 불변
  });

  it("이동 불가 타일이면 에러", () => {
    expect(() => applyAction(ctx, fresh(), { type: "move", unitId: "guanyu", to: { x: 0, y: 0 } })).toThrow();
  });

  it("이미 행동한 유닛은 이동 불가", () => {
    const s = patchUnit(fresh(), "guanyu", { acted: true });
    expect(() => applyAction(ctx, s, { type: "move", unitId: "guanyu", to: { x: 4, y: 9 } })).toThrow();
  });
});

describe("applyAction: attack", () => {
  it("공격하면 피해·반격이 일어나고 acted=true", () => {
    // 관우를 dong_inf1(4,4) 옆에 배치
    const s = patchUnit(fresh(), "guanyu", { x: 4, y: 5 });
    const { state, events } = applyAction(ctx, s, { type: "attack", unitId: "guanyu", targetId: "dong_inf1" });
    const dmg = events.filter((e) => e.type === "damageDealt");
    expect(dmg.length).toBeGreaterThanOrEqual(1);
    expect(dmg[0]).toMatchObject({ attackerId: "guanyu", defenderId: "dong_inf1", counter: false });
    expect(get(state, "dong_inf1").hp).toBeLessThan(50);
    expect(get(state, "guanyu").acted).toBe(true);
    // 보병(rangeMax 1)이 살아 있으면 반격 — 관우 HP도 깎인다
    if (!get(state, "dong_inf1").retreated) {
      expect(dmg.some((e) => e.type === "damageDealt" && e.counter)).toBe(true);
      expect(get(state, "guanyu").hp).toBeLessThan(64);
    }
  });

  it("궁병 공격(거리 2)에는 근접 유닛이 반격하지 못한다", () => {
    // 적 궁병의 공격이므로 적 페이즈로 전환해 테스트
    const s = { ...patchUnit(fresh(), "dong_arc1", { x: 4, y: 8 }), phase: "enemy" as const }; // 관우(4,10)와 거리 2
    const { events } = applyAction(ctx, s, { type: "attack", unitId: "dong_arc1", targetId: "guanyu" });
    expect(events.filter((e) => e.type === "damageDealt" && e.counter)).toHaveLength(0);
  });

  it("HP 0이 되면 퇴각(unitRetreated), 사망 없음", () => {
    const s = patchUnit(patchUnit(fresh(), "guanyu", { x: 4, y: 5 }), "dong_inf1", { hp: 1 });
    const { state, events } = applyAction(ctx, s, { type: "attack", unitId: "guanyu", targetId: "dong_inf1" });
    expect(get(state, "dong_inf1")).toMatchObject({ retreated: true, hp: 0 });
    expect(events).toContainEqual({ type: "unitRetreated", unitId: "dong_inf1" });
  });

  it("사거리 밖 공격은 에러", () => {
    expect(() => applyAction(ctx, fresh(), { type: "attack", unitId: "guanyu", targetId: "huaxiong" })).toThrow();
  });
});

describe("applyAction: 일기토", () => {
  it("관우→화웅 공격 시 일기토 발동: 화웅 퇴각, 일반 데미지 교환 없음", () => {
    const s = patchUnit(fresh(), "guanyu", { x: 6, y: 3 }); // 화웅(6,2) 인접
    const { state, events } = applyAction(ctx, s, { type: "attack", unitId: "guanyu", targetId: "huaxiong" });
    expect(events).toContainEqual({
      type: "duelTriggered", eventId: "duel_guanyu_huaxiong",
      attackerId: "guanyu", defenderId: "huaxiong", winnerId: "guanyu",
    });
    expect(events.filter((e) => e.type === "damageDealt")).toHaveLength(0);
    expect(get(state, "huaxiong").retreated).toBe(true);
    expect(state.firedEvents).toContain("duel_guanyu_huaxiong");
  });

  it("화웅 퇴각으로 승리 조건(defeatUnit) 충족 → battleEnded(victory)", () => {
    const s = patchUnit(fresh(), "guanyu", { x: 6, y: 3 });
    const { state, events } = applyAction(ctx, s, { type: "attack", unitId: "guanyu", targetId: "huaxiong" });
    expect(state.status).toBe("victory");
    expect(events).toContainEqual({ type: "battleEnded", result: "victory" });
  });
});

describe("페이즈 전환", () => {
  it("아군 전원이 행동하면 적 페이즈로 넘어간다", () => {
    let s = fresh();
    const players = s.units.filter((u) => u.side === "player").map((u) => u.id);
    let last: ReturnType<typeof applyAction> | undefined;
    for (const id of players) {
      last = applyAction(ctx, s, { type: "wait", unitId: id });
      s = last.state;
    }
    expect(s.phase).toBe("enemy");
    expect(last!.events).toContainEqual({ type: "phaseChanged", phase: "enemy", turn: 1 });
    // 적 유닛의 moved/acted가 리셋되어 있어야 한다
    for (const u of s.units.filter((u) => u.side === "enemy")) {
      expect(u.acted).toBe(false);
    }
  });

  it("적 전원이 행동하면 턴이 증가하고 아군 페이즈로 돌아온다", () => {
    let s = fresh();
    for (const id of s.units.filter((u) => u.side === "player").map((u) => u.id)) {
      s = applyAction(ctx, s, { type: "wait", unitId: id }).state;
    }
    for (const id of s.units.filter((u) => u.side === "enemy").map((u) => u.id)) {
      s = applyAction(ctx, s, { type: "wait", unitId: id }).state;
    }
    expect(s.phase).toBe("player");
    expect(s.turn).toBe(2);
  });

  it("자기 페이즈가 아닌 유닛의 행동은 에러", () => {
    expect(() => applyAction(ctx, fresh(), { type: "wait", unitId: "huaxiong" })).toThrow();
  });
});

describe("패배 조건", () => {
  it("유비(군주) 퇴각 시 defeat", () => {
    // (4,11)은 빈 평지 — 다른 유닛과 겹치지 않게 배치
    const s = patchUnit(patchUnit(fresh(), "dong_cav1", { x: 4, y: 11 }), "liubei", { hp: 1, x: 5, y: 11 });
    // 적 페이즈로 강제 전환해 dong_cav1이 유비를 공격
    const enemyPhase = { ...s, phase: "enemy" as const };
    const { state, events } = applyAction(ctx, enemyPhase, { type: "attack", unitId: "dong_cav1", targetId: "liubei" });
    expect(state.status).toBe("defeat");
    expect(events).toContainEqual({ type: "battleEnded", result: "defeat" });
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `pnpm --filter @tk/engine test`
Expected: FAIL — 모듈 없음

- [ ] **Step 3: 구현** — `packages/engine/src/actions.ts`

```ts
import type { Action, ActionResult, BattleContext, BattleEvent, BattleState, UnitState } from "./types";
import { getMovableTiles } from "./movement";
import { computeDamage, distance, getAttackableTargets } from "./combat";
import { findDuelTrigger } from "./events";

function getUnit(state: BattleState, id: string): UnitState {
  const u = state.units.find((u) => u.id === id);
  if (!u) throw new Error(`unknown unit: ${id}`);
  return u;
}

function replaceUnit(state: BattleState, unit: UnitState): BattleState {
  return { ...state, units: state.units.map((u) => (u.id === unit.id ? unit : u)) };
}

function assertCanAct(state: BattleState, unit: UnitState, forMove: boolean): void {
  if (state.status !== "ongoing") throw new Error("battle already ended");
  if (unit.retreated) throw new Error(`${unit.id} already retreated`);
  if (unit.side !== state.phase) throw new Error(`not ${unit.side} phase`);
  if (unit.acted) throw new Error(`${unit.id} already acted`);
  if (forMove && unit.moved) throw new Error(`${unit.id} already moved`);
}

/** HP 차감 → 0이면 퇴각. 새 유닛 상태와 이벤트를 반환 */
function dealDamage(
  state: BattleState, attacker: UnitState, defender: UnitState, damage: number, counter: boolean,
): { state: BattleState; events: BattleEvent[] } {
  const hp = Math.max(0, defender.hp - damage);
  const retreated = hp === 0;
  const events: BattleEvent[] = [
    { type: "damageDealt", attackerId: attacker.id, defenderId: defender.id, damage, counter },
  ];
  if (retreated) events.push({ type: "unitRetreated", unitId: defender.id });
  return { state: replaceUnit(state, { ...defender, hp, retreated }), events };
}

/** 승패 판정. 충족 시 status 변경 + battleEnded 이벤트 */
function checkOutcome(ctx: BattleContext, state: BattleState): { state: BattleState; events: BattleEvent[] } {
  if (state.status !== "ongoing") return { state, events: [] };
  const v = ctx.stage.victory;
  const d = ctx.stage.defeat;
  const retreated = (id: string) => getUnit(state, id).retreated;

  if (d.kind === "lordRetreat" && retreated(d.unitId)) {
    return { state: { ...state, status: "defeat" }, events: [{ type: "battleEnded", result: "defeat" }] };
  }
  const enemiesAlive = state.units.some((u) => u.side === "enemy" && !u.retreated);
  const victoryMet =
    (v.kind === "defeatAll" && !enemiesAlive) ||
    (v.kind === "defeatUnit" && retreated(v.unitId));
  if (victoryMet) {
    return { state: { ...state, status: "victory" }, events: [{ type: "battleEnded", result: "victory" }] };
  }
  return { state, events: [] };
}

/** 현재 페이즈 전원이 acted면 페이즈 전환 (+적→아군이면 턴 증가), 다음 페이즈 측 moved/acted 리셋 */
function maybeAdvancePhase(state: BattleState): { state: BattleState; events: BattleEvent[] } {
  if (state.status !== "ongoing") return { state, events: [] };
  const remaining = state.units.some((u) => u.side === state.phase && !u.retreated && !u.acted);
  if (remaining) return { state, events: [] };
  const nextPhase = state.phase === "player" ? "enemy" : "player";
  const nextTurn = nextPhase === "player" ? state.turn + 1 : state.turn;
  const units = state.units.map((u) =>
    u.side === nextPhase ? { ...u, moved: false, acted: false } : u,
  );
  return {
    state: { ...state, phase: nextPhase, turn: nextTurn, units },
    events: [{ type: "phaseChanged", phase: nextPhase, turn: nextTurn }],
  };
}

export function applyAction(ctx: BattleContext, state: BattleState, action: Action): ActionResult {
  const unit = getUnit(state, action.unitId);
  const events: BattleEvent[] = [];
  let next = state;

  switch (action.type) {
    case "move": {
      assertCanAct(state, unit, true);
      const reachable = getMovableTiles(ctx, state, unit.id);
      if (!reachable.some((t) => t.x === action.to.x && t.y === action.to.y)) {
        throw new Error(`(${action.to.x},${action.to.y}) is not reachable`);
      }
      const from = { x: unit.x, y: unit.y };
      next = replaceUnit(state, { ...unit, x: action.to.x, y: action.to.y, moved: true });
      events.push({ type: "unitMoved", unitId: unit.id, from, to: action.to });
      break; // 이동은 acted 아님 — 이후 공격/대기 가능
    }

    case "attack": {
      assertCanAct(state, unit, false);
      const target = getUnit(state, action.targetId);
      if (target.retreated || target.side === unit.side) throw new Error("invalid target");
      const inRange = getAttackableTargets(ctx, state, unit.id).includes(target.id);
      if (!inRange) throw new Error(`${target.id} out of range`);

      const duel = findDuelTrigger(ctx, state, unit.id, target.id);
      if (duel) {
        // 스토리 일기토: 스크립트 고정 결과, 일반 데미지 교환 없음 (CLAUDE.md §9)
        const loserId = duel.outcome.winnerId === unit.id ? target.id : unit.id;
        events.push({
          type: "duelTriggered", eventId: duel.id,
          attackerId: unit.id, defenderId: target.id, winnerId: duel.outcome.winnerId,
        });
        next = { ...state, firedEvents: [...state.firedEvents, duel.id] };
        if (duel.outcome.loserRetreats) {
          const loser = getUnit(next, loserId);
          next = replaceUnit(next, { ...loser, hp: 0, retreated: true });
          events.push({ type: "unitRetreated", unitId: loserId });
        }
        next = replaceUnit(next, { ...getUnit(next, unit.id), acted: true });
        break;
      }

      // 일반 공격
      const atkResult = computeDamage(ctx, state, unit, target);
      next = { ...state, rngState: atkResult.nextRngState };
      const hit = dealDamage(next, unit, getUnit(next, target.id), atkResult.damage, false);
      next = hit.state;
      events.push(...hit.events);

      // 반격: 방어측 생존 + 공격측이 방어측 사거리 안
      const defender = getUnit(next, target.id);
      if (!defender.retreated) {
        const d = distance(unit, defender);
        if (d >= defender.rangeMin && d <= defender.rangeMax) {
          const ctrResult = computeDamage(ctx, next, defender, getUnit(next, unit.id));
          next = { ...next, rngState: ctrResult.nextRngState };
          const ctr = dealDamage(next, defender, getUnit(next, unit.id), ctrResult.damage, true);
          next = ctr.state;
          // counter 플래그 보정
          events.push(...ctr.events.map((e) =>
            e.type === "damageDealt" ? { ...e, counter: true } : e,
          ));
        }
      }
      next = replaceUnit(next, { ...getUnit(next, unit.id), acted: true });
      break;
    }

    case "wait": {
      assertCanAct(state, unit, false);
      next = replaceUnit(state, { ...unit, acted: true });
      break;
    }
  }

  const outcome = checkOutcome(ctx, next);
  next = outcome.state;
  events.push(...outcome.events);

  const phase = maybeAdvancePhase(next);
  next = phase.state;
  events.push(...phase.events);

  return { state: next, events };
}
```

`packages/engine/src/index.ts`에 추가:
```ts
export { applyAction } from "./actions";
```

- [ ] **Step 4: 통과 확인**

Run: `pnpm --filter @tk/engine test`
Expected: PASS (전체). `dealDamage`가 이미 counter 플래그를 받으므로 반격 보정 map이 중복이면 정리해도 된다 — 동작 동일 확인 후.

- [ ] **Step 5: Commit**

```bash
git add packages/engine
git commit -m "feat(engine): applyAction — 이동·공격·반격·일기토·페이즈·승패"
```

---

### Task 9: @tk/sim — 그리디 정책 + 러너 + 결정론 테스트

**Files:**
- Create: `packages/sim/package.json`, `tsconfig.json`, `src/policy.ts`, `src/runner.ts`
- Test: `packages/sim/test/runner.test.ts`

- [ ] **Step 1: 패키지 설정 작성**

`packages/sim/package.json`:
```json
{
  "name": "@tk/sim",
  "version": "0.0.1",
  "private": true,
  "type": "module",
  "scripts": {
    "start": "tsx src/cli.ts",
    "test": "vitest run",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@tk/data": "workspace:*",
    "@tk/engine": "workspace:*",
    "tsx": "^4.19.0"
  },
  "devDependencies": { "typescript": "^5.6.0", "vitest": "^2.1.0" }
}
```

`packages/sim/tsconfig.json`:
```json
{ "extends": "../../tsconfig.base.json", "include": ["src", "test"] }
```

- [ ] **Step 2: 실패하는 테스트 작성** — `packages/sim/test/runner.test.ts`

```ts
import { describe, it, expect } from "vitest";
import { runBattle } from "../src/runner";

describe("runBattle", () => {
  it("같은 시드 = 같은 결과 (결정론 회귀 방지)", () => {
    const a = runBattle("05-sishuiguan", 42);
    const b = runBattle("05-sishuiguan", 42);
    expect(a).toEqual(b);
  });

  it("결과는 victory/defeat/timeout 중 하나이고 턴 수가 기록된다", () => {
    const r = runBattle("05-sishuiguan", 7);
    expect(["victory", "defeat", "timeout"]).toContain(r.result);
    expect(r.turns).toBeGreaterThanOrEqual(1);
    expect(r.playerRetreats).toBeGreaterThanOrEqual(0);
  });

  it("maxTurns에 걸리면 timeout", () => {
    const r = runBattle("05-sishuiguan", 42, 1); // 1턴 제한
    expect(["victory", "defeat", "timeout"]).toContain(r.result);
    expect(r.turns).toBeLessThanOrEqual(2);
  });
});
```

- [ ] **Step 3: 실패 확인**

Run: `pnpm install` 후 `pnpm --filter @tk/sim test`
Expected: FAIL — 모듈 없음

- [ ] **Step 4: 구현**

`packages/sim/src/policy.ts`:
```ts
import {
  getAttackableTargets, getMovableTiles, distance,
  type Action, type BattleContext, type BattleState, type UnitState,
} from "@tk/engine";

/**
 * 그리디 정책 (양 진영 공용):
 * 1) 현재 위치에서 공격 가능하면 HP가 가장 낮은 적 공격
 * 2) 아직 안 움직였으면 가장 가까운 적과의 거리를 최소화하는 타일로 이동
 * 3) 그 외 대기
 */
export function chooseAction(ctx: BattleContext, state: BattleState): Action | undefined {
  const unit = state.units.find(
    (u) => u.side === state.phase && !u.retreated && !u.acted,
  );
  if (!unit) return undefined; // applyAction이 페이즈를 자동 전환하므로 정상적으론 도달 안 함

  const targets = getAttackableTargets(ctx, state, unit.id);
  if (targets.length > 0) {
    const weakest = targets
      .map((id) => state.units.find((u) => u.id === id)!)
      .sort((a, b) => a.hp - b.hp)[0]!;
    return { type: "attack", unitId: unit.id, targetId: weakest.id };
  }

  if (!unit.moved) {
    const enemies = state.units.filter((u) => u.side !== unit.side && !u.retreated);
    if (enemies.length > 0) {
      const tiles = getMovableTiles(ctx, state, unit.id);
      const score = (t: { x: number; y: number }) =>
        Math.min(...enemies.map((e) => distance(t, e)));
      const best = tiles.sort((a, b) => score(a) - score(b))[0];
      if (best && !(best.x === unit.x && best.y === unit.y)) {
        return { type: "move", unitId: unit.id, to: best };
      }
    }
  }

  return { type: "wait", unitId: unit.id };
}
```

`packages/sim/src/runner.ts`:
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

export function runBattle(stageId: string, seed: number, maxTurns = 30): RunResult {
  const stage = stages[stageId];
  if (!stage) throw new Error(`unknown stage: ${stageId}`);
  const ctx: BattleContext = { data: gameData, stage };
  let state = createBattle(stage, gameData, seed);

  let guard = 0;
  while (state.status === "ongoing" && state.turn <= maxTurns) {
    if (++guard > 10_000) throw new Error("simulation runaway"); // 무한 루프 안전장치
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

- [ ] **Step 5: 통과 확인**

Run: `pnpm --filter @tk/sim test`
Expected: PASS (3 tests)

- [ ] **Step 6: Commit**

```bash
git add packages/sim
git commit -m "feat(sim): 그리디 정책 자동 플레이 러너와 결정론 테스트"
```

---

### Task 10: @tk/sim — CLI 리포트

**Files:**
- Create: `packages/sim/src/cli.ts`

- [ ] **Step 1: 구현** — `packages/sim/src/cli.ts`

```ts
import { runBattle } from "./runner";

function arg(name: string, fallback: string): string {
  const i = process.argv.indexOf(`--${name}`);
  const v = i >= 0 ? process.argv[i + 1] : undefined;
  return v ?? fallback;
}

const stageId = arg("stage", "05-sishuiguan");
const runs = Number(arg("runs", "200"));
const seed = Number(arg("seed", "42"));

const results = Array.from({ length: runs }, (_, i) => runBattle(stageId, seed + i));

const wins = results.filter((r) => r.result === "victory").length;
const timeouts = results.filter((r) => r.result === "timeout").length;
const avg = (xs: number[]) => (xs.reduce((a, b) => a + b, 0) / xs.length).toFixed(1);

console.log(`스테이지: ${stageId} | ${runs}판 (시드 ${seed}~${seed + runs - 1})`);
console.log(`승률: ${((wins / runs) * 100).toFixed(1)}% (승 ${wins} / 패 ${runs - wins - timeouts} / 시간초과 ${timeouts})`);
console.log(`평균 턴: ${avg(results.map((r) => r.turns))}`);
console.log(`평균 아군 퇴각: ${avg(results.map((r) => r.playerRetreats))}`);
console.log(`일기토 발동률: ${((results.filter((r) => r.duelsFired.length > 0).length / runs) * 100).toFixed(1)}%`);
```

- [ ] **Step 2: 실행 확인**

Run: `pnpm sim` (루트에서) 또는 `pnpm --filter @tk/sim start -- --runs 50`
Expected: 승률/평균 턴/퇴각/일기토 발동률 리포트 출력. 수치 자체는 튜닝 전이므로 목표치(90%+)와 달라도 정상 — 출력이 나오는 것이 이 Task의 완료 조건.

- [ ] **Step 3: 루트에서 전체 테스트**

Run: `pnpm test`
Expected: data/engine/sim 전부 PASS

- [ ] **Step 4: Commit**

```bash
git add packages/sim
git commit -m "feat(sim): CLI 시뮬레이션 리포트 — 밸런스 튜닝 루프의 골격"
```

---

### Task 11: 에셋 파이프라인 가이드 문서 3종

**Files:**
- Create: `docs/asset-pipeline/01-character-reference-sheet.md`, `02-duel-video-test.md`, `03-spine-setup.md`

코드 없음 — 문서 Task. 각 문서는 길중이 도구를 열고 그대로 실행할 수 있는 수준으로 작성한다. 아래 구성/핵심 내용을 포함해 작성 (CLAUDE.md §4 에셋 파이프라인과 §16 첫 기술 검증이 출처):

- [ ] **Step 1: `01-character-reference-sheet.md` 작성**

포함 내용:
1. **목적**: 관우 레퍼런스 시트 = 모든 파생 에셋(스프라이트/Spine/영상)의 원본. 게임 미수록
2. **산출물 정의**: 전신 3뷰(정면/측면/후면) 1장 + 표정·포즈 2~3종. 청룡언월도 장착 상태 — 시그니처 무기는 캐릭터 정체성(CLAUDE.md §4)
3. **Gemini 프롬프트 템플릿** (그대로 복사해 사용할 한국어+영어 프롬프트, 변수 자리 `{캐릭터 설명}` 표기):
   - 스타일 고정 문구(독자 화풍 — 코에이 스타일 모방 금지 명시), 3뷰 캐릭터 시트 요구 문구, 배경 무지/전신/T포즈 지시
4. **일관성 워크플로**: 1차 생성 → 마음에 드는 결과를 레퍼런스 이미지로 재투입 → 표정/포즈 변형 생성. 시드/프롬프트를 결과물 옆에 기록
5. **보관 규칙**: `assets/characters/guanyu/` 에 `ref-sheet.png` + `ref-sheet.prompt.md`(사용 프롬프트 전문) 커밋 — 재생성 가능 원칙(CLAUDE.md §2-7)
6. **체크리스트**: 무기 디테일 3뷰 일관 / 복식 색상 일관 / 얼굴 동일인 / 배경 무지

- [ ] **Step 2: `02-duel-video-test.md` 작성**

포함 내용:
1. **목적**: 시트 → Seedance I2V 일기토 클립 테스트. 결과로 "Spine 합 연출 vs 영상 컷신" 하이브리드 비율 결정(CLAUDE.md §16 검증 2)
2. **입력**: 01번 가이드의 관우 시트 (+ 상대는 임시로 생성한 화웅 1장)
3. **테스트 매트릭스**: 클립 길이(2초/4초) × 액션(말 위 언월도 횡베기 / 돌진 교차) × 카메라(측면 고정/추적) — 총 4~6클립
4. **프롬프트 템플릿**: I2V용 모션 프롬프트 예문 (한국어 설명 + 영어 프롬프트)
5. **평가 기준표**: 캐릭터 동일성 유지(시트 대비) / 무기 형태 유지 / 모션 자연스러움 / 1~2초 컷인으로 잘라 쓸 수 있는 구간 존재 여부 — 각 5점 척도
6. **판정 규칙**: 동일성·무기 유지가 평균 3점 미만이면 영상은 스토리 일기토 전용으로 한정하고 일반 일기토는 Spine 단독으로 확정
7. **보관 규칙**: `assets/duel-tests/` + 프롬프트 전문 기록

- [ ] **Step 3: `03-spine-setup.md` 작성**

포함 내용:
1. **라이선스**: Esoteric Software 공식 가격 (Spine Essential $69 / Professional $345 — 작성 시점에 공식 사이트에서 재확인해 명시). 런타임 사용엔 에디터 라이선스 필수라는 점, 1인 개발이므로 Essential로 시작 가능하나 메시 변형·IK가 필요하면 Professional 필요 — 무기 파츠 교체 데모에는 Essential로 충분한지 검증 후 업그레이드 권장
2. **병종 골격 규격화 방침** (CLAUDE.md §4): 같은 병종 = 같은 골격, 무기는 슬롯 교체. 골격 명명 규칙(`skel_cavalry`, `slot_weapon_main` 등) 초안
3. **첫 데모 범위**: 관우 1체 — 파츠 분리(몸통/팔/무기), 대기·공격 2모션, 무기 스킨 2종 교체 시연
4. **웹 런타임**: spine-ts(PixiJS 런타임) 링크와 라이선스 조건 요약

- [ ] **Step 4: Commit**

```bash
git add docs/asset-pipeline
git commit -m "docs: 에셋 파이프라인 가이드 3종 — 길중 실행용 (시트/영상/Spine)"
```

---

### Task 12: apps/web 빈 골격 + 루트 README

**Files:**
- Create: `apps/web/package.json`, `apps/web/tsconfig.json`, `apps/web/next.config.ts`, `apps/web/app/layout.tsx`, `apps/web/app/page.tsx`, `README.md`

- [ ] **Step 1: Next.js 최소 골격 작성** (create-next-app 대신 수동 — 불필요 파일 없이)

`apps/web/package.json`:
```json
{
  "name": "@tk/web",
  "version": "0.0.1",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "test": "echo \"no tests yet\"",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@tk/data": "workspace:*",
    "@tk/engine": "workspace:*",
    "next": "^15.0.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0"
  },
  "devDependencies": {
    "@types/react": "^19.0.0",
    "@types/node": "^22.0.0",
    "typescript": "^5.6.0"
  }
}
```

`apps/web/tsconfig.json`:
```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "jsx": "preserve",
    "lib": ["dom", "dom.iterable", "es2022"],
    "allowJs": true,
    "noEmit": true,
    "incremental": true,
    "plugins": [{ "name": "next" }]
  },
  "include": ["app", "next-env.d.ts", ".next/types/**/*.ts"]
}
```

`apps/web/next.config.ts`:
```ts
import type { NextConfig } from "next";
const config: NextConfig = {
  // 워크스페이스 패키지는 TS 소스 그대로 export하므로 Next가 직접 트랜스파일해야 한다
  transpilePackages: ["@tk/data", "@tk/engine"],
};
export default config;
```

`apps/web/app/layout.tsx`:
```tsx
export const metadata = { title: "삼국지 SRPG (가칭)" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
```

`apps/web/app/page.tsx` — 엔진이 웹에서 import되는지 확인하는 최소 연결:
```tsx
import { gameData, stages } from "@tk/data";

export default function Home() {
  const stage = stages["05-sishuiguan"]!;
  return (
    <main>
      <h1>삼국지 SRPG — 개발 중</h1>
      <p>첫 스테이지: {stage.name} ({stage.map.width}×{stage.map.height})</p>
      <p>등록 장수: {Object.keys(gameData.commanders).length}명</p>
    </main>
  );
}
```

- [ ] **Step 2: 동작 확인**

Run: `pnpm install` 후 `pnpm --filter @tk/web dev` → 브라우저에서 `http://localhost:3000`
Expected: "사수관 전투 (12×12)" 텍스트 표시. 확인 후 서버 종료.

- [ ] **Step 3: 루트 `README.md` 작성**

```markdown
# 삼국지 턴제 전술 SRPG (가칭)

영걸전 문법을 계승한 웹 기반 턴제 전술 SRPG. 기획 SSOT는 [CLAUDE.md](./CLAUDE.md).

## 구조

| 패키지 | 역할 |
|---|---|
| `packages/data` | zod 스키마 + 게임 데이터 JSON (의존성 제로) |
| `packages/engine` | 헤드리스 전투 엔진 — 순수 함수, 시드 RNG 결정론 |
| `packages/sim` | 자동 플레이 시뮬레이션 CLI (밸런스 튜닝 루프) |
| `apps/web` | Next.js 클라이언트 (렌더링은 차기 작업) |
| `docs/asset-pipeline` | AI 에셋 생성 가이드 (Gemini/Seedance/Spine) |

## 명령어

```bash
pnpm install        # 의존성 설치
pnpm test           # 전체 테스트
pnpm sim            # 사수관 200판 시뮬레이션 리포트
pnpm sim -- --stage 05-sishuiguan --runs 500 --seed 1
```

## 개발 규칙

- 전투 룰 변경은 CLAUDE.md(기획 문서) 먼저 업데이트
- 스테이지/밸런스 수치는 코드가 아니라 `packages/data/json/`에서
- engine은 React/DOM을 모른다 — 렌더링 의존성 추가 금지
```

- [ ] **Step 4: 전체 검증**

Run: `pnpm test && pnpm sim`
Expected: 전체 테스트 PASS + 시뮬 리포트 출력

- [ ] **Step 5: Commit**

```bash
git add apps/web README.md pnpm-lock.yaml
git commit -m "feat(web): Next.js 빈 골격 — 엔진·데이터 import 연결 확인"
```

---

## 완료 기준 (Definition of Done)

1. `pnpm test` — data/engine/sim 전체 PASS
2. `pnpm sim` — 사수관 200판 리포트 출력 (승률 수치는 튜닝 전이므로 무관)
3. 같은 시드 두 번 실행 = 동일 결과 (결정론 테스트 PASS)
4. `docs/asset-pipeline/` 3종 — 길중이 문서만 보고 Gemini/Seedance 작업을 시작할 수 있음
5. 모든 작업이 작은 커밋 단위로 기록됨

## 다음 서브 프로젝트 (이 계획 범위 밖)

- 시뮬 결과로 사수관 밸런스 1차 튜닝 (목표 승률 90%+)
- PixiJS 렌더러 (맵/유닛 표시, 입력 처리)
- 책략/MP 시스템, 경험치/레벨업




