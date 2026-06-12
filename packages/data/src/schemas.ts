import { z } from "zod";

/** 능력치 1~100 (원작 범위) */
const Stat = z.number().int().min(1).max(100);

export const CommanderSchema = z.object({
  id: z.string(),            // 한글 이름 기반 (동명이인은 _2 접미)
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
  healTroopsRatio: z.number().min(0).max(1).optional(), // 병영/촌락 0.1
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
