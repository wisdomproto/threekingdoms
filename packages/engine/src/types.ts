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
  agility: number;       // 민첩(장수 원값) → agilityPower(순발력) 입력. 미보유 장수=기본 50
  baseAtk: number; baseDef: number;
  grades: ClassGrades;                // 병과 5스탯 등급(§1) — corpsStat 성장 입력
  weaponBonus: number;                // 1 + 최고 무기 bonusPercent/100 (소지품 중 최고 1개 — 원작 룰)
  bookBonus: number;                  // 1 + 최고 병법서(book) bonusPercent/100 — 정신력(spiritPower)에 곱
  move: number;                   // 이동 범위(병종 + 말 보너스)
  baseMove?: number;              // 병종 기본 이동력(말 보너스 제외) — 연속공격 판정용(속도 정체성 고정). 미설정=move
  rangeMin: number; rangeMax: number;
  items: string[];       // 소지품 item id 목록 — useItem 시 1개씩 소모. weapon/book 보정은 createBattle에서 미리 산정됨
  moved: boolean; acted: boolean; retreated: boolean;
  // §7 아이템 효과(말·보물). createBattle에서 산정. 기존 리터럴 무파손 위해 optional(미설정=무효).
  damageReduction?: number;       // 받는 피해 경감 0~0.9 (방어 보물)
  grantsDoubleStrike?: boolean;   // 아이템으로 연속공격 무조건 부여
  // §7/§9 필살 게이지(레퍼런스 ⚔0/255). 전투 참여로 누적, max에서 필살 발동 가능(2단계).
  sp?: number;                    // 현재 SP (미설정=0)
  maxSp?: number;                 // SP 상한 (미설정=combat.sp.max)
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
  /** mulberry32 내부 상태(signed int32, 음수 가능). 시드 고정 전투 RNG의 스트림(2026-06-16 §2-1). 롤마다 nextRandom으로 전진 — Phase A는 소비처 0이라 불변, Phase B(명중/분산)부터 갱신. rng.ts 소비 계약 참조. */
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
  /** 콤보(§7/§12) — 현재 아군 페이즈의 연속 격파 수. 아군 페이즈 시작 시 0으로 리셋. 미설정=0 */
  combo?: number;
}

export type Action =
  | { type: "move"; unitId: string; to: Coord }
  | { type: "attack"; unitId: string; targetId: string }
  | { type: "ultimate"; unitId: string; targetId: string }   // 필살(SP 가득 시) — 대형 확정피해
  | { type: "strategy"; unitId: string; strategyId: string; target: Coord }
  // 도구(아이템) 사용 — 소모품 2종: supplyItem(회복약)/attackItem(공격아이템).
  // target은 효과 대상 유닛의 좌표(supplyItem=아군, attackItem=적). 생략 시 시전자 자신.
  // 행동 1회 소비(acted). 사용한 itemId를 unit.items에서 1개 제거(소모).
  | { type: "useItem"; unitId: string; itemId: string; target?: Coord }
  | { type: "wait"; unitId: string };

/** 증원 도착 이벤트가 싣는 유닛 렌더 데이터 — 렌더러가 스프라이트를 생성하기에 충분한 최소 집합. */
export interface ReinforcedUnit {
  id: string;
  classId: string;
  x: number;
  y: number;
  troops: number;
  maxTroops: number;
}

export type BattleEvent =
  | { type: "unitMoved"; unitId: string; from: Coord; to: Coord }
  | { type: "damageDealt"; attackerId: string; defenderId: string; damage: number; counter: boolean }
  // 협공 발동(결정론) — surround = 대상 포위도(공격자 포함), bonusPercent = 추가피해%. 연출용.
  | { type: "flank"; attackerId: string; defenderId: string; surround: number; bonusPercent: number }
  // 연속공격(2중공격) 발동 — 이동력 우위로 개시 공격이 2회 타격. 연출용.
  | { type: "doubleStrike"; attackerId: string; defenderId: string }
  // 필살 발동 — SP 소진하며 대형 확정피해. name=네임드 시그니처명(있으면). 연출용.
  | { type: "ultimate"; attackerId: string; defenderId: string; damage: number; name?: string }
  // 콤보(연속 격파) — count=현재 콤보 수, gold=이번 격파로 적립된 보너스 자금. 연출·도파민용.
  | { type: "combo"; count: number; gold: number }
  | { type: "strategyCast"; casterId: string; strategyId: string; target: Coord }
  // 도구 사용 결과 — amount = 실제 회복/피해량(상한·하한 클램프 후). target = 효과 대상 좌표.
  | { type: "itemUsed"; unitId: string; itemId: string; target?: Coord; amount: number }
  | { type: "unitRetreated"; unitId: string }
  | { type: "levelUp"; unitId: string; newLevel: number }
  | { type: "duelTriggered"; eventId: string; attackerId: string; defenderId: string; winnerId: string }
  | { type: "phaseChanged"; phase: Side; turn: number }
  // M3① 증원 도착 — units = 새로 투입된 유닛의 렌더 데이터(BattleState.units에 추가된 직후).
  // 렌더러가 이벤트만으로 스프라이트를 생성할 수 있게 자기서술적("이벤트가 상태 변화를 전부 서술" 계약).
  | { type: "reinforcementArrived"; reinforcementId: string; side: Side; units: ReinforcedUnit[] }
  // M3① 전략조건 충족 — reward = 적립된 보물/자금 (결산 지급 대기). 승패 무관
  | { type: "strategyConditionMet"; id: string; treasures: string[]; gold: number }
  | { type: "battleEnded"; result: "victory" | "defeat" };

/** 정적 컨텍스트 — map은 stage.mapId로 해석된 BattleMap */
export interface BattleContext { data: GameData; stage: Stage; map: BattleMap }

export interface ActionResult { state: BattleState; events: BattleEvent[] }
