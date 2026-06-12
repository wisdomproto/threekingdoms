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
  /** mulberry32 내부 상태. signed int32라 음수 가능. nextRandom()에 그대로 전달 */
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
