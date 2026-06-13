/**
 * HUD용 셀렉터 (설계 §2.1 viewmodel) — 전부 settledState 기준 순수 함수.
 * committed가 연출보다 앞서가도 HUD 수치는 드레인 시점(settled)에만 갱신된다 — 스포일러 차단.
 * 반환값은 전부 직렬화 가능한 평면 객체 (useSyncExternalStore 스냅샷에 그대로 실린다).
 */
import type { Side } from "@tk/data";
import { terrainAt, attackPower, defensePower, spiritPower } from "@tk/engine";
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
  // 조조전 장수 정보 패널 대응 (sosoden-battle-ux-analysis §1·§6)
  // 부대 능력치(전투에 실제로 쓰이는 값) = floor(장수능력/2) + 성장. 장수 원값은 *Stat에 보존.
  atk: number;          // 부대 공격력 (← 무력)
  def: number;          // 부대 방어력 (← 통솔)
  spirit: number;       // 부대 정신력 (← 지력)
  warStat: number;      // 장수 무력 (원값)
  leadershipStat: number;
  intelligenceStat: number;
  move: number;         // 이동력
  rangeMin: number;
  rangeMax: number;
  terrainName: string;  // 현재 칸 지형명
  terrainGuard: number; // 지형 방어 보정 (0~0.5)
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
  const terrain = terrainAt(ctx, u.x, u.y);
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
    atk: attackPower(u),
    def: defensePower(u),
    spirit: spiritPower(u),
    warStat: u.war,
    leadershipStat: u.leadership,
    intelligenceStat: u.intelligence,
    move: u.move,
    rangeMin: u.rangeMin,
    rangeMax: u.rangeMax,
    terrainName: terrain.name,
    terrainGuard: terrain.guard,
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
