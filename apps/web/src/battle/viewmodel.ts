/**
 * HUD용 셀렉터 (설계 §2.1 viewmodel) — 전부 settledState 기준 순수 함수.
 * committed가 연출보다 앞서가도 HUD 수치는 드레인 시점(settled)에만 갱신된다 — 스포일러 차단.
 * 반환값은 전부 직렬화 가능한 평면 객체 (useSyncExternalStore 스냅샷에 그대로 실린다).
 */
import type { Side } from "@tk/data";
import type { BattleContext, BattleState, UnitState } from "@tk/engine";

export interface UnitVM {
  id: string;
  name: string;
  className: string;
  side: Side;
  level: number;
  x: number;
  y: number;
  troops: number;
  maxTroops: number;
  mp: number;
  maxMp: number;
  moved: boolean;
  acted: boolean;
  retreated: boolean;
}

export interface TurnVM {
  turn: number;
  turnLimit: number;
  phase: Side;
}

export interface BattleVM {
  turn: TurnVM;
  status: BattleState["status"];
  units: UnitVM[];
}

export function unitVM(ctx: BattleContext, u: UnitState): UnitVM {
  return {
    id: u.id,
    name: ctx.data.commanders[u.id]?.name ?? u.id,
    className: ctx.data.unitClasses[u.classId]?.name ?? u.classId,
    side: u.side,
    level: u.level,
    x: u.x,
    y: u.y,
    troops: u.troops,
    maxTroops: u.maxTroops,
    mp: u.mp,
    maxMp: u.maxMp,
    moved: u.moved,
    acted: u.acted,
    retreated: u.retreated,
  };
}

export function unitPanelVM(
  ctx: BattleContext,
  settled: BattleState,
  unitId: string,
): UnitVM | null {
  const u = settled.units.find((x) => x.id === unitId);
  return u ? unitVM(ctx, u) : null;
}

export function turnVM(ctx: BattleContext, settled: BattleState): TurnVM {
  return { turn: settled.turn, turnLimit: ctx.stage.turnLimit, phase: settled.phase };
}

/** 종료 전이면 null — ResultOverlay 표시 여부 판정용 */
export function resultVM(settled: BattleState): "victory" | "defeat" | null {
  return settled.status === "ongoing" ? null : settled.status;
}

export function battleVM(ctx: BattleContext, settled: BattleState): BattleVM {
  return {
    turn: turnVM(ctx, settled),
    status: settled.status,
    units: settled.units.map((u) => unitVM(ctx, u)),
  };
}
