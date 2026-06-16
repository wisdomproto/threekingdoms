import { z } from "zod";

/** 능력치 1~100 (원작 범위) */
export const Stat = z.number().int().min(1).max(100);

export const CommanderSchema = z.object({
  id: z.string(),            // 한글 이름 기반 (동명이인은 _2 접미)
  name: z.string(),
  leadership: Stat,          // 통솔 → 방어 공식
  war: Stat,                 // 무력 → 공격 공식
  intelligence: Stat,        // 지력 → 책략치(MP)
  agility: Stat.optional(),  // 민첩 → 순발력(명중/회피, §2-1 시드확률). 미지정 시 spawnUnit 기본 50
  faceId: z.number().int().min(0).max(255),
  /**
   * 네임드 시그니처 궁극기(§8 고유 스킬) — 필살 발동 시 이 장수만의 이름·위력. 미지정=일반 필살.
   * percent 미지정 시 combat.sp.ultimatePercent 사용. 효과는 결정론(추가 피해 %).
   */
  ultimate: z.object({
    name: z.string(),              // 「청룡언월」 등 — 발동 배너
    percent: z.number().min(0).optional(), // 추가 피해 %(미지정=기본 필살치)
  }).optional(),
});
export type Commander = z.infer<typeof CommanderSchema>;

/** 승급 라인 — 상성 판정 단위 */
export const LineSchema = z.enum(["infantry", "archer", "cavalry", "bandit", "support"]);
export type Line = z.infer<typeof LineSchema>;

/** 이동 비용 분류 — terrains.moveCost의 오버라이드 키 */
export const MoveClassSchema = z.enum(["foot", "cavalry", "bandit", "archerFoot"]);
export type MoveClass = z.infer<typeof MoveClassSchema>;

/**
 * 조조전 병과 5스탯 등급 (docs/reference/sosoden-class-grades.md §1).
 * 4=S / 3=A / 2=B / 1=C / (0=D). 레벨당 능력 상승치(등급계수)의 입력.
 */
export const GradeSchema = z.enum(["S", "A", "B", "C", "D"]);
export type Grade = z.infer<typeof GradeSchema>;

/**
 * 병과별 5스탯 등급 [공·방·정·순·사]. terrain_c2_6 추출값(§1)을 우리 병종에 매핑.
 *  - atk: 공격(←무력 성장), def: 방어(←통솔), spirit: 정신(←지력),
 *    agility: 순발(←민첩, 명중/회피 — 현재 미사용 보존), morale: 사기(현재 고정 100 — 보존).
 * optional + 미지정 시 전부 "C"(안전 기본) → 기존 JSON 무파손.
 */
export const ClassGradesSchema = z.object({
  atk: GradeSchema,
  def: GradeSchema,
  spirit: GradeSchema,
  agility: GradeSchema,
  morale: GradeSchema,
});
export type ClassGrades = z.infer<typeof ClassGradesSchema>;

/** grades 미지정 병종의 안전 기본 — 전 스탯 C */
export const DEFAULT_GRADES: ClassGrades = { atk: "C", def: "C", spirit: "C", agility: "C", morale: "C" };

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
  // 조조전 5스탯 등급(§1). 미지정 시 전부 "C" — 기존 JSON 무파손.
  grades: ClassGradesSchema.default(DEFAULT_GRADES),
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

/** 상태이상 종류 (Phase D: 부동·금책·중독. 확장: confuse/debuff 후속). */
export const StatusKindSchema = z.enum(["poison", "seal", "immobilize"]);
export type StatusKind = z.infer<typeof StatusKindSchema>;

/** 활성 상태이상 1건 (런타임 부여분). turns = 남은 지속 턴. */
export const StatusEffectSchema = z.object({
  kind: StatusKindSchema,
  turns: z.number().int().min(1),
});
export type StatusEffect = z.infer<typeof StatusEffectSchema>;

/**
 * 아이템 장착 효과(§7 아이템 효과 시스템 / §10 보물 "고유 효과 고정") — 전부 결정론.
 * 기존 weapon/book의 bonusPercent와 별개의 *추가* 필드. 말·보물이 실제 효과를 갖게 한다.
 * 미지정(생략) = 효과 없음. 전 효과는 createBattle에서 합산돼 UnitState에 반영된다.
 */
export const ItemEffectsSchema = z.object({
  move: z.number().int().optional(),                       // 이동력 +N (말 등) — 연속공격 사거리도 ↑
  atkPercent: z.number().min(0).optional(),                // 부대 공격력 +N% (보물 무기류)
  spiritPercent: z.number().min(0).optional(),             // 부대 정신력 +N% (보물 병서류)
  defensePercent: z.number().min(0).max(90).optional(),    // 받는 피해 −N% (방어 보물 — 철벽처럼)
  doubleStrike: z.boolean().optional(),                    // 연속공격 무조건 부여(이동력 무관)
  // Phase C 전투 특성(결정론) — 미지정=무효. spawnUnit에서 UnitState로 집약.
  noCounter: z.boolean().optional(),                       // 무반격(공격 시 상대 반격 안 받음)
  multiHit: z.number().int().min(2).optional(),            // 관통: 개시 공격 N회 전타격(레거시 doubleStrike 대체)
  counterStrikes: z.number().int().min(1).optional(),      // 재반격/연환: 이 유닛이 반격 시 치는 횟수(기본 1)
  flatDamagePerLevel: z.number().int().min(0).optional(),  // 고정 피해 = 값×(레벨+1), 방어/지형/협공 무시
  alwaysHit: z.boolean().optional(),                       // 필중(명중 롤 생략)
  inflictStatus: z.object({                                // 적중 시 상태이상 부여(시드 chance%, Phase D)
    kind: StatusKindSchema,
    chance: z.number().int().min(0).max(100),
    turns: z.number().int().min(1),
  }).optional(),
  rangeBonus: z.number().int().min(1).optional(),          // 사거리 +N (용담창 — 원거리 타격, 자연 무반격)
  lifestealPercent: z.number().int().min(0).max(100).optional(), // 흡혈: 입힌 피해 × % 자가 회복(Phase E)
});
export type ItemEffects = z.infer<typeof ItemEffectsSchema>;

export const ItemSchema = z.object({
  id: z.string(),
  name: z.string(),
  category: z.enum(["weapon", "treasure", "attackItem", "supplyItem", "horse", "book"]),
  power: z.number().int().min(0).max(255),        // b13: 소모품 효과량, 255=비소모
  bonusPercent: z.number().int().min(0).max(100), // b14: 무기/병법서 % 가산
  effects: ItemEffectsSchema.optional(),          // §7 장착 효과(말·보물). 생략=없음
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
  /**
   * 협공(결정론 게임성 격상, CLAUDE.md §7) — 대상 인접(4방)에 공격자 진영 부대가
   * threshold기 이상이면 발동. 초과 1기당 stepPercent% 추가 피해, maxStacks까지 누적.
   * 난수 없음. 미지정 데이터도 통과하게 default 제공.
   */
  flank: z.object({
    threshold: z.number().int().min(2),   // 발동 최소 포위 수(공격자 포함)
    stepPercent: z.number().min(0),        // threshold 초과 1기당 추가 피해 %
    maxStacks: z.number().int().min(0),    // 추가 피해 누적 상한(스택 수)
  }).default({ threshold: 2, stepPercent: 20, maxStacks: 3 }),
  /**
   * 병종 패시브(결정론 게임성 격상, CLAUDE.md §7) — 자동 발동, 난수 없음.
   *  - cavalryChargePercent: 기병 돌격 — 이동 후 개시 공격 시 피해 +%.
   *  - infantryBulwarkPercent: 보병 철벽 — 방어자가 보병 계열이면 피격 피해 −%.
   *  - archerSnipePiercePercent: 궁병 저격 — 공격자가 궁병 계열이면 대상 지형 guard를 −% 관통.
   */
  passives: z.object({
    cavalryChargePercent: z.number().min(0),
    infantryBulwarkPercent: z.number().min(0).max(100),
    archerSnipePiercePercent: z.number().min(0).max(100),
  }).default({ cavalryChargePercent: 20, infantryBulwarkPercent: 15, archerSnipePiercePercent: 50 }),
  /**
   * 연속공격(2중공격, 결정론 게임성 격상 §7) — 원작 조조전의 순발력 기반 연속공격확률을
   * RNG 없이 *이동력 우위*로 치환. 공격자 이동력이 대상보다 moveGap 이상 높으면 개시 공격이
   * 2회 타격(2타는 secondHitPercent 비율). 빠른 병종(경기병 등)이 느린 적에게 추가타.
   */
  doubleStrike: z.object({
    moveGap: z.number().int().min(1),       // 발동 최소 이동력 차
    secondHitPercent: z.number().min(0).max(100), // 2타 피해 비율
  }).default({ moveGap: 2, secondHitPercent: 50 }),
  /**
   * 필살 게이지(SP, §7/§9 — 레퍼런스 ⚔0/255 누적 게이지의 결정론 구현). 전투 참여로 SP 누적,
   * max 도달 시 필살 발동 가능(2단계). 누적은 전부 결정론(난수 없음).
   */
  sp: z.object({
    max: z.number().int().min(1),       // 게이지 상한(레퍼런스 255)
    onAttack: z.number().int().min(0),  // 공격 1회 시 공격자 SP +
    onHitTaken: z.number().int().min(0),// 피격 1회 시 피격자 SP +
    onKill: z.number().int().min(0),    // 격파 시 공격자 SP +
    ultimatePercent: z.number().min(0), // 필살 추가 피해 %(2단계 — 발동 시 ×(1+%/100))
  }).default({ max: 255, onAttack: 25, onHitTaken: 20, onKill: 60, ultimatePercent: 150 }),
  /**
   * 콤보(§7/§12 도파민) — 아군 페이즈 연속 격파 시 확정 보너스 자금(전투력 아님 → 밸런스 중립).
   * 격파마다 goldPerStack × 현재콤보수 적립. 결산에서 「콤보!」 연출.
   */
  combo: z.object({
    goldPerStack: z.number().int().min(0),
  }).default({ goldPerStack: 15 }),
  /**
   * 명중/회피 (시드 고정 확률, §2-1 2026-06-16). 명중% = clamp(100 − missSlope×max(0, defAgi−atkAgi), floorPercent, 100).
   * 동급 100%·완만 미스(하한 floorPercent). 전부 데이터 노브. 롤은 actions.ts에서 rngState로.
   */
  accuracy: z.object({
    missSlope: z.number().min(0),
    floorPercent: z.number().min(0).max(100),
  }).default({ missSlope: 0.5, floorPercent: 80 }),
  /** 상태이상(Phase D). poisonDamage = 중독 1틱 확정 피해(데이터 노브). */
  status: z.object({
    poisonDamage: z.number().int().min(0),
  }).default({ poisonDamage: 20 }),
}).refine(
  (c) => Object.entries(c.lineAdvantage).every(([k, v]) => k !== v),
  { message: "lineAdvantage must not be self-referential" },
);
export type CombatConfig = z.infer<typeof CombatConfigSchema>;

/**
 * 진영(Side) — 3종 (Tier 2-1).
 *  - player: 플레이어가 조종하는 아군.
 *  - ally: AI가 조종하는 아군측 NPC(우군). 플레이어는 조종/공격 불가.
 *  - enemy: 적군.
 * 피아식별은 Side가 아니라 camp(진영군)로 한다 — player·ally = "friendly", enemy = "hostile".
 * camp 헬퍼는 @tk/engine에 있다(데이터 패키지는 zod 스키마만 보유).
 */
export const SideSchema = z.enum(["player", "ally", "enemy"]);
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
export type StageUnit = z.infer<typeof StageUnitSchema>;

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

/**
 * 스테이지 클리어 보상 (M1 결산 — §10/§12).
 *  - gold: 클리어 자금. exp: 추가 경험치(전투 중 누적과 별도, 결산 시 분배 — 현재는 데이터만).
 *  - treasures: 이 스테이지에서 확정 지급되는 보물 item id 목록.
 */
export const StageRewardSchema = z.object({
  gold: z.number().int().min(0),
  exp: z.number().int().min(0).default(0),
  treasures: z.array(z.string()).default([]),
});
export type StageReward = z.infer<typeof StageRewardSchema>;

/**
 * 승리 목표 (M3① — yeonggeoljeon-remake-stages.md §2-4 비섬멸 목표 카탈로그).
 * objectives는 AND 결합: optional:false 인 목표가 **전부** 충족되면 승리.
 * optional:true 는 보너스 목표(승리 판정에 영향 없음 — 평가/보상 게이트용 추적 슬롯).
 *  - defeatAll: 적대 진영(camp=hostile) 전원 퇴각 (기존 victory.defeatAll과 동치).
 *  - defeatUnit: 특정 유닛 퇴각 (기존 victory.defeatUnit과 동치).
 *  - reachTile: unitId(생략 시 아무 아군=camp friendly) 가 (x,y) 칸에 도달 — 탈출/도하.
 *  - surviveTurns: 그 turns 까지 패배조건에 안 걸리고 버티면 충족 — 방어전.
 *    (turn > turns 즉 turns번째 라운드를 온전히 끝낸 직후 충족. turnLimit 의미론과 동일.)
 *  - captureTile: side(기본 player) 진영 유닛이 (x,y) 칸을 점유 중이면 충족 — 점령.
 */
export const ObjectiveSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("defeatAll"), optional: z.boolean().default(false) }),
  z.object({ kind: z.literal("defeatUnit"), unitId: z.string(), optional: z.boolean().default(false) }),
  z.object({
    kind: z.literal("reachTile"),
    unitId: z.string().optional(),
    x: z.number().int().min(0),
    y: z.number().int().min(0),
    optional: z.boolean().default(false),
  }),
  z.object({ kind: z.literal("surviveTurns"), turns: z.number().int().min(1), optional: z.boolean().default(false) }),
  z.object({
    kind: z.literal("captureTile"),
    x: z.number().int().min(0),
    y: z.number().int().min(0),
    side: SideSchema.default("player"),
    optional: z.boolean().default(false),
  }),
]);
export type Objective = z.infer<typeof ObjectiveSchema>;

/**
 * 패배 조건 (M3① — §2-4 호위/탈출/시간압박). 하나라도 충족되면 즉시 패배.
 *  - unitRetreated: 그 유닛(군주 등)이 퇴각하면 패배 (기존 defeat.lordRetreat과 동치).
 *  - allRetreated: unitIds(호위 대상=백성 등)가 **전부** 퇴각하면 패배. 일부 손실은 허용.
 *  - turnLimitExceeded: turnLimit 초과 시 패배. 명시한 스테이지에서만 "시간 내 목표 미달=패배".
 *    (미명시 시 turnLimit 초과는 기존대로 단순 종료=defeat — 하위호환 절 참조.)
 */
export const FailConditionSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("unitRetreated"), unitId: z.string() }),
  z.object({ kind: z.literal("allRetreated"), unitIds: z.array(z.string()).min(1) }),
  z.object({ kind: z.literal("turnLimitExceeded") }),
]);
export type FailCondition = z.infer<typeof FailConditionSchema>;

/**
 * 증원 트리거 (M3① — §2-6 증원/적대 전환). 트리거 충족 시 units를 전장에 투입.
 *  - kind:"turn": 그 turn 의 페이즈 전환(턴 증가) 시점에 스폰.
 *  - kind:"unitDefeated": unitId 가 퇴각한 직후 스폰.
 * once:true 고정 — 한 번만 투입(spawnedReinforcements로 중복 방지). units는 StageUnit 형식.
 */
export const ReinforcementTriggerSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("turn"), turn: z.number().int().min(1) }),
  z.object({ kind: z.literal("unitDefeated"), unitId: z.string() }),
]);
export const ReinforcementSchema = z.object({
  id: z.string(),
  side: SideSchema,
  units: z.array(StageUnitSchema),
  trigger: ReinforcementTriggerSchema,
  once: z.literal(true).default(true),
});
export type Reinforcement = z.infer<typeof ReinforcementSchema>;

/**
 * 전략조건 = 보물 게이트 (M3① — §2-1). 충족 시 보상 적립 + strategyConditionMet 이벤트.
 * 승패에 직접 영향 없음(서브 클리어 조건 — S랭크/보물 도감용). 트리거:
 *  - duelOccurred: 그 duelId 일기토가 발동되면 충족.
 *  - duelsInOrder: duelIds 가 **그 순서대로** 발동되면 충족(강하 [적로] 패턴).
 *    (duelHistory가 duelIds를 부분수열이 아닌 "순서 보존 포함"으로 만족하면 충족 — 아래 엔진 규칙.)
 *  - unitReachedTile: unitId 가 (x,y) 에 도달하면 충족(회남 성채 피신 패턴).
 * reward: 충족 시 적립되는 보물 item id 목록(+선택적 gold). pendingRewards로 누적.
 */
export const StrategyConditionTriggerSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("duelOccurred"), duelId: z.string() }),
  z.object({ kind: z.literal("duelsInOrder"), duelIds: z.array(z.string()).min(1) }),
  z.object({ kind: z.literal("unitReachedTile"), unitId: z.string(), x: z.number().int().min(0), y: z.number().int().min(0) }),
]);
export const StrategyConditionSchema = z.object({
  id: z.string(),
  description: z.string(),
  trigger: StrategyConditionTriggerSchema,
  reward: z.object({
    treasures: z.array(z.string()).default([]),
    gold: z.number().int().min(0).optional(),
  }),
});
export type StrategyCondition = z.infer<typeof StrategyConditionSchema>;

/**
 * 스테이지 대사/스토리 (C — 레퍼런스 §344 말풍선 대화창 복제).
 * 순수 표현 데이터 — 엔진/결정론 불변. apps/web의 대사 디렉터가 전투 진행을
 * read-only로 구독하다가 트리거 충족 시 해당 dialogue를 큐잉, DialogueOverlay가
 * 말풍선으로 한 줄씩 재생한다(탭→다음, 초상 좌/우, 화자명 파랑, 청동 액자).
 *
 * 트리거 종류 (레퍼런스 동작 충실 복제 — 전투 인트로/일기토/목표·패배 시점):
 *  - battleStart: 전투 개시 직후 1회 (인트로 컷).
 *  - battleEnd: 종료 시. result 지정 시 그 결과(victory|defeat)에만 발동, 생략 시 결과 무관.
 *  - turn: 그 turn(아군 페이즈 진입)에 도달하면 1회.
 *  - unitRetreated: 그 unitId가 퇴각하면 1회.
 *  - duelOccurred: 그 duelId 일기토가 발동되면 1회 (duelHistory 기준).
 * 각 dialogue는 한 번만 재생된다(디렉터가 id로 중복 방지).
 */
export const DialogueTriggerSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("battleStart") }),
  z.object({ kind: z.literal("battleEnd"), result: z.enum(["victory", "defeat"]).optional() }),
  z.object({ kind: z.literal("turn"), n: z.number().int().min(1) }),
  z.object({ kind: z.literal("unitRetreated"), unitId: z.string() }),
  z.object({ kind: z.literal("duelOccurred"), duelId: z.string() }),
]);
export type DialogueTrigger = z.infer<typeof DialogueTriggerSchema>;

/**
 * 대사 한 줄 (말풍선 1개 = 탭 1회).
 *  - speaker: 화자명(파랑 글씨로 표시). text: 본문(검정).
 *  - side: 초상 좌/우 코너 배치 결정 — player/ally=좌, enemy=우 (레퍼런스 §344 가변 코너).
 *  - portraitId: 초상 이미지 키(선택). 미지정 시 화자명만.
 */
export const DialogueLineSchema = z.object({
  speaker: z.string(),
  side: SideSchema.optional(),
  portraitId: z.string().optional(),
  text: z.string(),
});
export type DialogueLine = z.infer<typeof DialogueLineSchema>;

export const StageDialogueSchema = z.object({
  id: z.string(),
  trigger: DialogueTriggerSchema,
  lines: z.array(DialogueLineSchema).min(1),
});
export type StageDialogue = z.infer<typeof StageDialogueSchema>;

/**
 * 막간 시나리오 씬 (전투 밖 컷신 — §5 스토리). 풀스크린 배경 + 화자 초상 대사.
 *  - bg: 씬 배경 이미지 키(선택, /assets/scenes/{bg}.webp). 미지정 시 수묵 placeholder.
 *  - lines: DialogueLine 재사용(화자·진영·초상·본문). 최소 1줄.
 * 전투 내 dialogue(트리거 구동)와 별개 — intro(전투 전)·outro(전투 후) 스토리.
 */
export const ScenarioSceneSchema = z.object({
  bg: z.string().optional(),
  lines: z.array(DialogueLineSchema).min(1),
});
export type ScenarioScene = z.infer<typeof ScenarioSceneSchema>;

/** 스테이지 막간 시나리오 — intro(전투 전)·outro(승리 후)·outroDefeat(패배 후, 선택). 전부 optional. */
export const StageScenarioSchema = z.object({
  intro: ScenarioSceneSchema.optional(),
  outro: ScenarioSceneSchema.optional(),
  outroDefeat: ScenarioSceneSchema.optional(),
});
export type StageScenario = z.infer<typeof StageScenarioSchema>;

export const StageSchema = z.object({
  id: z.string(),
  name: z.string(),
  mapId: z.string(),
  turnLimit: z.number().int().min(1),
  camera: StageCameraSchema.optional(),
  // 대사/스토리 (C — §344 말풍선). 순수 표현·하위호환(미지정 = 대사 없음). 디렉터가 read-only 구독.
  dialogue: z.array(StageDialogueSchema).optional(),
  // 막간 시나리오 씬 (§5 — 전투 밖 컷신). intro→상점→전투→outro 캠페인 루프. 하위호환(미지정 = 씬 없음).
  scenario: StageScenarioSchema.optional(),
  // 결산 보상 (선택 — 미지정 스테이지는 보상 없음으로 취급)
  reward: StageRewardSchema.optional(),
  // 이 스테이지에서의 레벨캡 (§10 — 스테이지 진행 연동). 미지정 시 엔진 기본 99.
  levelCap: z.number().int().min(1).max(99).optional(),
  units: z.array(StageUnitSchema),
  // ── M3① 신규 목표 시스템 (있으면 victory/defeat보다 우선) ──────────────────
  // objectives: 승리 목표(AND, optional은 보너스). failConditions: 패배 조건(OR).
  // 둘 다 optional — 미지정 스테이지는 기존 victory/defeat로 폴백(하위호환 절).
  objectives: z.array(ObjectiveSchema).optional(),
  failConditions: z.array(FailConditionSchema).optional(),
  // 증원 (§2-6). 트리거 시 units를 전장 투입. 미지정 = 증원 없음.
  reinforcements: z.array(ReinforcementSchema).optional(),
  // 전략조건=보물 게이트 (§2-1). 충족 시 보상 적립 + 이벤트(승패 무관). 미지정 = 없음.
  strategyConditions: z.array(StrategyConditionSchema).optional(),
  // ── 레거시 승패 계약 (하위호환 — objectives/failConditions 미지정 시 사용) ──
  victory: z.discriminatedUnion("kind", [
    z.object({ kind: z.literal("defeatAll") }),
    z.object({ kind: z.literal("defeatUnit"), unitId: z.string() }),
  ]).optional(),
  defeat: z.discriminatedUnion("kind", [
    z.object({ kind: z.literal("lordRetreat"), unitId: z.string() }),
  ]).optional(),
  events: z.array(StageEventSchema),
}).refine(
  (s) => (s.objectives && s.objectives.length > 0) || s.victory !== undefined,
  { message: "stage must define objectives or legacy victory" },
);
export type Stage = z.infer<typeof StageSchema>;

/**
 * 로스터 엔트리 (§6 — 정규 로스터 + 게스트). 메타 진행에서 "보유 장수" 목록의 단위.
 *  - commanderId: commanders.json id. classId: unitClasses.json id (초기 병종).
 *  - joinChapter: 합류 장(1~5, §5 챕터).
 *  - role: 편성/UI 분류. uniqueSkillId: §8 고유 스킬(있으면) — strategies.json 또는 별도 정의.
 */
export const RosterRoleSchema = z.enum(["lord", "melee", "caster", "support", "guest"]);
export type RosterRole = z.infer<typeof RosterRoleSchema>;

export const RosterEntrySchema = z.object({
  commanderId: z.string(),
  classId: z.string(),
  joinChapter: z.number().int().min(1).max(5),
  role: RosterRoleSchema,
  uniqueSkillId: z.string().optional(),
});
export type RosterEntry = z.infer<typeof RosterEntrySchema>;

/**
 * 상점 (§10/§13 — 막간 출진 준비). 장 진행에 따라 재고가 해금된다.
 *  - ShopItem.unlockChapter: 그 아이템이 구매 가능해지는 장(1~5). price: 자금.
 *  - Shop.items: 이 상점에 진열되는 항목 목록.
 */
export const ShopItemSchema = z.object({
  itemId: z.string(),
  price: z.number().int().min(0),
  unlockChapter: z.number().int().min(1).max(5).default(1),
});
export type ShopItem = z.infer<typeof ShopItemSchema>;

export const ShopSchema = z.object({
  id: z.string(),
  name: z.string(),
  items: z.array(ShopItemSchema),
});
export type Shop = z.infer<typeof ShopSchema>;

export const InitialForceSchema = z.object({
  commanderId: z.string(),
  faction: z.number().int().min(0).max(255), // 0x80=유비군 … (레퍼런스 §2 구획 D)
  troops: z.number().int().min(1), // 0 병력 편성은 변환기에서 skip — 엔진 나눗셈 안전
  classId: z.string(),
  level: z.number().int().min(1).max(99),
  items: z.array(z.string()),
});
export type InitialForce = z.infer<typeof InitialForceSchema>;
