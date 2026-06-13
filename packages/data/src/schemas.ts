import { z } from "zod";

/** 능력치 1~100 (원작 범위) */
export const Stat = z.number().int().min(1).max(100);

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
  code: z.number().int().min(0).max(63),     // 0x00~0x12=영걸전 병종, 19+=조조전 추가 병종(책사 등)
  baseAtk: z.number().int().min(0).max(200), // 병종 공격력 기초치
  baseDef: z.number().int().min(0).max(200),
  move: z.number().int().min(0).max(10), // 0 = 비전투(백성 등) — 엔진에서 이동 불가 처리
  rangeMin: z.number().int().min(1),
  rangeMax: z.number().int().min(1),
  line: LineSchema,
  tier: z.number().int().min(1).max(3),      // 승급 단계
  moveClass: MoveClassSchema,
  strategies: z.array(z.string()).default([]), // 이 병종이 쓰는 책략 id 목록 (§8 병종별 리스트)
}).refine((c) => c.rangeMin <= c.rangeMax, { message: "rangeMin must be <= rangeMax" });
export type UnitClass = z.infer<typeof UnitClassSchema>;

/**
 * 책략 (§8 스킬 1층, 액티브·MP). 효과 정의는 조조전 원작(strategies.json 73종) 기반.
 * "어느 병종이 무슨 책략"의 할당은 원작 데이터 미추출 → §8대로 우리가 설계(UnitClass.strategies).
 */
export const StrategySchema = z.object({
  id: z.string(),
  name: z.string(),
  category: z.enum(["fire", "water", "earth", "wind", "heal", "debuff"]),
  mp: z.number().int().min(0),
  power: z.number().int().min(0),       // 위력 — 데미지 배수(×power/10)
  castRange: z.number().int().min(1),   // 시전 거리 (시전자→대상 칸)
  aoe: z.enum(["single", "cross"]),     // 대상 칸만 / 십자(대상+상하좌우)
  target: z.enum(["enemy", "ally"]),
});
export type Strategy = z.infer<typeof StrategySchema>;

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
  // attacker line → 유리한 defender line. 키도 Line으로 검증, 자기참조 금지
  lineAdvantage: z.record(LineSchema, LineSchema),
}).refine(
  (c) => Object.entries(c.lineAdvantage).every(([k, v]) => k !== v),
  { message: "lineAdvantage must not be self-referential" },
);
export type CombatConfig = z.infer<typeof CombatConfigSchema>;

export const SideSchema = z.enum(["player", "enemy"]);
export type Side = z.infer<typeof SideSchema>;

export const BattleMapSchema = z.object({
  id: z.string(),
  name: z.string(),
  width: z.number().int().min(1),
  height: z.number().int().min(1),
  tileLegend: z.record(z.string().length(1), z.string()), // 키 = 타일 1글자 코드
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

/**
 * 스테이지별 카메라 초기 연출 (feel-spec §데이터). 맵마다 스케일/긴장도가 달라
 * 초기 줌·포커스를 데이터로 둔다. 없으면 렌더러 기본값(줌 1.5 + 아군 군주 스냅).
 *  - zoom: 초기 배율 (없으면 기본). CameraController가 줌 한계로 클램프.
 *  - focus: 초기 중심 그리드 칸 [x, y] (없으면 아군 군주, 그것도 없으면 맵 중앙).
 * "기본 줌 복귀" 버튼도 이 값으로 되돌린다.
 */
export const StageCameraSchema = z.object({
  zoom: z.number().positive().optional(),
  focus: z.tuple([z.number().int().min(0), z.number().int().min(0)]).optional(),
});
export type StageCamera = z.infer<typeof StageCameraSchema>;

export const StageSchema = z.object({
  id: z.string(),
  name: z.string(),
  mapId: z.string(),
  turnLimit: z.number().int().min(1),
  camera: StageCameraSchema.optional(),
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

export const InitialForceSchema = z.object({
  commanderId: z.string(),
  faction: z.number().int().min(0).max(255), // 0x80=유비군 … (레퍼런스 §2 구획 D)
  troops: z.number().int().min(1), // 0 병력 편성은 변환기에서 skip — 엔진 나눗셈 안전
  classId: z.string(),
  level: z.number().int().min(1).max(99),
  items: z.array(z.string()),
});
export type InitialForce = z.infer<typeof InitialForceSchema>;
