/**
 * HUD용 셀렉터 (설계 §2.1 viewmodel) — 전부 settledState 기준 순수 함수.
 * committed가 연출보다 앞서가도 HUD 수치는 드레인 시점(settled)에만 갱신된다 — 스포일러 차단.
 * 반환값은 전부 직렬화 가능한 평면 객체 (useSyncExternalStore 스냅샷에 그대로 실린다).
 */
import type { ClassGrades, Side } from "@tk/data";
import { terrainAt, attackPower, defensePower, spiritPower } from "@tk/engine";
import type { BattleContext, BattleState, UnitState, PendingReward } from "@tk/engine";

/** 장비 탭 1행 — unit.items를 gameData.items 효과로 해석한 표시용 (UnitPanel §8 장비탭) */
export interface ItemVM {
  id: string;
  name: string;
  category: string;
  /** 사람이 읽는 효과 요약 (예: "공격 +15%", "회복 80", "특수") */
  effect: string;
}

/** 책략 탭 1행 — 병종 strategies를 gameData.strategies로 해석 (UnitPanel §8 책략탭) */
export interface StrategyVM {
  id: string;
  name: string;
  mp: number;
  category: string;
  target: "enemy" | "ally";
}

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
  // ── 장수 패널 탭화(Tier 3 §8). 전부 optional — 기존 UnitVM 리터럴(테스트 등) 무파손 ──
  classId?: string;             // 병종 id (특성/책략 탭 lookup 키)
  grades?: ClassGrades;         // 병종 5스탯 등급 [공·방·정·순·사] (특성 탭 뱃지)
  equipment?: ItemVM[];         // 소지품(장비/소모품) 해석 목록 (장비 탭)
  strategies?: StrategyVM[];    // 병종 보유 책략 해석 목록 (책략 탭)
}

/** 도구/장비 효과 요약 문구 — category + power/bonusPercent를 사람이 읽는 한 줄로 */
function itemEffect(category: string, power: number, bonusPercent: number): string {
  switch (category) {
    case "weapon":
      return bonusPercent > 0 ? `공격 +${bonusPercent}%` : "무기";
    case "book":
      return bonusPercent > 0 ? `정신 +${bonusPercent}%` : "병법서";
    case "horse":
      return "기동";
    case "supplyItem":
      return power < 255 ? `회복 ${power}` : "회복";
    case "attackItem":
      return power < 255 ? `피해 ${power}` : "공격 도구";
    case "treasure":
      return "보물";
    default:
      return "기타";
  }
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
  /** 전략조건으로 적립된 보상(보물·자금) — 결산에서 stage.reward와 병합·중복제거(M3① §2-1) */
  pendingRewards: PendingReward[];
}

export function unitVM(ctx: BattleContext, u: UnitState): UnitVM {
  const terrain = terrainAt(ctx, u.x, u.y);
  const cls = ctx.data.unitClasses[u.classId];
  // 소지품 → 장비 탭 행 (gameData.items 미등록 id는 id를 이름으로 폴백)
  const equipment: ItemVM[] = u.items.map((id) => {
    const it = ctx.data.items[id];
    return {
      id,
      name: it?.name ?? id,
      category: it?.category ?? "기타",
      effect: it ? itemEffect(it.category, it.power, it.bonusPercent) : "—",
    };
  });
  // 병종 책략 → 책략 탭 행 (strategies.json 해석)
  const strategies: StrategyVM[] = (cls?.strategies ?? []).map((id) => {
    const s = ctx.data.strategies[id];
    return {
      id,
      name: s?.name ?? id,
      mp: s?.mp ?? 0,
      category: s?.category ?? "—",
      target: s?.target ?? "enemy",
    };
  });
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
    classId: u.classId,
    grades: cls?.grades,
    equipment,
    strategies,
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
    pendingRewards: settled.pendingRewards,
  };
}
