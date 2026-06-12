import { z } from "zod";

/** 지형. moveCost는 병종 classId별 오버라이드, 없으면 default. 99 이상 = 통행 불가 */
export const TerrainSchema = z.object({
  id: z.string(),
  name: z.string(),
  guard: z.number().min(0).max(0.9), // 피해 감소율
  moveCost: z
    .object({ default: z.number().int().min(1) })
    .catchall(z.number().int().min(1)),
});
export type Terrain = z.infer<typeof TerrainSchema>;

export const UnitClassSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    move: z.number().int().min(1).max(10),
    rangeMin: z.number().int().min(1),
    rangeMax: z.number().int().min(1),
  })
  .refine((c) => c.rangeMin <= c.rangeMax, {
    message: "rangeMin must be <= rangeMax",
  });
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
  defFactor: z.number(), // 방어력 반영 비율
  levelCoef: z.number(), // 레벨 차 1당 데미지 증감률
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

export const StageSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    map: z.object({
      width: z.number().int().min(1),
      height: z.number().int().min(1),
      tileLegend: z.record(z.string()), // 1글자 코드 → terrain id
      tiles: z.array(z.string()), // height개의 행 문자열
    }),
    units: z.array(
      z.object({
        commanderId: z.string(),
        side: SideSchema,
        x: z.number().int().min(0),
        y: z.number().int().min(0),
      })
    ),
    victory: z.discriminatedUnion("kind", [
      z.object({ kind: z.literal("defeatAll") }),
      z.object({ kind: z.literal("defeatUnit"), unitId: z.string() }),
    ]),
    defeat: z.discriminatedUnion("kind", [
      z.object({ kind: z.literal("lordRetreat"), unitId: z.string() }),
    ]),
    events: z.array(StageEventSchema),
  })
  .refine(
    (s) =>
      s.map.tiles.length === s.map.height &&
      s.map.tiles.every((r) => r.length === s.map.width),
    { message: "tiles must be height rows of width chars" }
  );
export type Stage = z.infer<typeof StageSchema>;
