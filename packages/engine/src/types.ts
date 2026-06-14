import type { GameData, Stage, BattleMap, Side, Line, MoveClass, ClassGrades } from "@tk/data";

export interface Coord { x: number; y: number }

/**
 * 진영군(camp) — 피아식별의 단위 (Tier 2-1).
 * player·ally(우군) = "friendly", enemy = "hostile".
 * 상성·데미지·지형은 camp와 무관(병종 line으로만 판정). foe 판정·타깃 필터·승패만 camp로 본다.
 */
export type Camp = "friendly" | "hostile";

/** side → camp. enemy만 hostile, 나머지(player/ally)는 friendly. */
export function camp(side: Side): Camp {
  return side === "enemy" ? "hostile" : "friendly";
}

/** 두 진영이 적대 관계인가 — camp가 다르면 적(foe). 같으면 우군/아군. */
export function areFoes(a: Side, b: Side): boolean {
  return camp(a) !== camp(b);
}

export interface UnitState {
  id: string;            // commanderId
  classId: string;
  line: Line;            // 상성 판정
  moveClass: MoveClass;  // 지형 비용 판정
  side: Side;
  x: number; y: number;
  level: number;
  exp: number;                        // 누적 경험치 (§10 행동 기반). 레벨업 시 expForNextLevel(level)만큼 차감
  troops: number; maxTroops: number;  // 병력 = 원작 HP (병력 0 = 퇴각, 사망 없음)
  morale: number;                     // 사기 — 공/방 직접 가산. 변동 규칙 미해독으로 당분간 고정 100
  mp: number; maxMp: number;          // 책략치 = (레벨+10)×지력÷40
  war: number; leadership: number; intelligence: number;
  baseAtk: number; baseDef: number;
  grades: ClassGrades;                // 병과 5스탯 등급(§1) — corpsStat 성장 입력
  weaponBonus: number;                // 1 + 최고 무기 bonusPercent/100 (소지품 중 최고 1개 — 원작 룰)
  bookBonus: number;                  // 1 + 최고 병법서(book) bonusPercent/100 — 정신력(spiritPower)에 곱
  move: number;
  rangeMin: number; rangeMax: number;
  items: string[];       // 소지품 item id 목록 — useItem 시 1개씩 소모. weapon/book 보정은 createBattle에서 미리 산정됨
  moved: boolean; acted: boolean; retreated: boolean;
}

/** 전략조건 보상 적립분 (M3① — §2-1 보물 게이트). 결산에서 지급. */
export interface PendingReward {
  conditionId: string;       // 어느 strategyCondition에서 나온 보상인가
  treasures: string[];       // 적립된 보물 item id
  gold: number;              // 적립된 자금(없으면 0)
}

export interface BattleState {
  turn: number;
  phase: Side;
  status: "ongoing" | "victory" | "defeat";
  units: UnitState[];
  /** mulberry32 내부 상태. signed int32라 음수 가능. 원작 공식은 분산이 없어 전투 중 갱신되지 않음 — 기연/일반 일기토 확률 등 미래 RNG 용도로 보존 */
  rngState: number;
  firedEvents: string[]; // once 이벤트 중복 발동 방지
  // ── M3① 목표 시스템 추적 필드 ──────────────────────────────────────────
  /** 발동된 일기토 id를 발동 순서대로 기록 — duelsInOrder 전략조건 판정용 */
  duelHistory: string[];
  /** 이미 충족된 전략조건 id — 중복 적립 방지 */
  metStrategyConditions: string[];
  /** 이미 투입된 증원 id — 중복 스폰 방지 */
  spawnedReinforcements: string[];
  /** 전략조건으로 적립된 보상 (결산 지급 대기). 결정론적 누적 */
  pendingRewards: PendingReward[];
}

export type Action =
  | { type: "move"; unitId: string; to: Coord }
  | { type: "attack"; unitId: string; targetId: string }
  | { type: "strategy"; unitId: string; strategyId: string; target: Coord }
  // 도구(아이템) 사용 — 소모품 2종: supplyItem(회복약)/attackItem(공격아이템).
  // target은 효과 대상 유닛의 좌표(supplyItem=아군, attackItem=적). 생략 시 시전자 자신.
  // 행동 1회 소비(acted). 사용한 itemId를 unit.items에서 1개 제거(소모).
  | { type: "useItem"; unitId: string; itemId: string; target?: Coord }
  | { type: "wait"; unitId: string };

export type BattleEvent =
  | { type: "unitMoved"; unitId: string; from: Coord; to: Coord }
  | { type: "damageDealt"; attackerId: string; defenderId: string; damage: number; counter: boolean }
  // 협공 발동(결정론) — surround = 대상 포위도(공격자 포함), bonusPercent = 추가피해%. 연출용.
  | { type: "flank"; attackerId: string; defenderId: string; surround: number; bonusPercent: number }
  | { type: "strategyCast"; casterId: string; strategyId: string; target: Coord }
  // 도구 사용 결과 — amount = 실제 회복/피해량(상한·하한 클램프 후). target = 효과 대상 좌표.
  | { type: "itemUsed"; unitId: string; itemId: string; target?: Coord; amount: number }
  | { type: "unitRetreated"; unitId: string }
  | { type: "levelUp"; unitId: string; newLevel: number }
  | { type: "duelTriggered"; eventId: string; attackerId: string; defenderId: string; winnerId: string }
  | { type: "phaseChanged"; phase: Side; turn: number }
  // M3① 증원 도착 — units = 새로 투입된 유닛 id 목록 (BattleState.units에 추가된 직후)
  | { type: "reinforcementArrived"; reinforcementId: string; side: Side; unitIds: string[] }
  // M3① 전략조건 충족 — reward = 적립된 보물/자금 (결산 지급 대기). 승패 무관
  | { type: "strategyConditionMet"; id: string; treasures: string[]; gold: number }
  | { type: "battleEnded"; result: "victory" | "defeat" };

/** 정적 컨텍스트 — map은 stage.mapId로 해석된 BattleMap */
export interface BattleContext { data: GameData; stage: Stage; map: BattleMap }

export interface ActionResult { state: BattleState; events: BattleEvent[] }
