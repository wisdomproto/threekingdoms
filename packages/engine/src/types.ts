import type { GameData, Stage, BattleMap, Side, Line, MoveClass } from "@tk/data";

export interface Coord { x: number; y: number }

export interface UnitState {
  id: string;            // commanderId
  classId: string;
  line: Line;            // 상성 판정
  moveClass: MoveClass;  // 지형 비용 판정
  side: Side;
  x: number; y: number;
  level: number;
  troops: number; maxTroops: number;  // 병력 = 원작 HP (병력 0 = 퇴각, 사망 없음)
  morale: number;                     // 사기 — 공/방 직접 가산. 변동 규칙 미해독으로 당분간 고정 100
  mp: number; maxMp: number;          // 책략치 = (레벨+10)×지력÷40
  war: number; leadership: number; intelligence: number;
  baseAtk: number; baseDef: number;
  weaponBonus: number;                // 1 + 최고 무기 bonusPercent/100 (소지품 중 최고 1개 — 원작 룰)
  move: number;
  rangeMin: number; rangeMax: number;
  moved: boolean; acted: boolean; retreated: boolean;
}

export interface BattleState {
  turn: number;
  phase: Side;
  status: "ongoing" | "victory" | "defeat";
  units: UnitState[];
  /** mulberry32 내부 상태. signed int32라 음수 가능. 원작 공식은 분산이 없어 전투 중 갱신되지 않음 — 기연/일반 일기토 확률 등 미래 RNG 용도로 보존 */
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

/** 정적 컨텍스트 — map은 stage.mapId로 해석된 BattleMap */
export interface BattleContext { data: GameData; stage: Stage; map: BattleMap }

export interface ActionResult { state: BattleState; events: BattleEvent[] }
