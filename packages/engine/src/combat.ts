import type { BattleContext, BattleState, Coord, UnitState } from "./types";
import { terrainAt, unitAt } from "./movement";
import { corpsStat } from "./growth";

/**
 * 조조전 전투 공식 (docs/reference/sosoden-combat-formula.md + sosoden-class-grades.md).
 * 부대 능력 = floor(장수능력 / 2) + 성장. commanders.json 무력/통솔/지력 = 장수 원값.
 * 병력(troops)도 조조전 스케일(~100~150) — 영걸전 천 단위가 아님.
 * 성장 = **병과 등급계수 증분형 누적**(growth.ts corpsStat). 단일 LV_GROWTH 상수 폐기 —
 * 레벨마다 그 시점 누적값의 구간으로 등급 가산치를 재조회한다(결정론, 난수 없음).
 */
const DMG_BASE = 25; // 데미지 상수항 (조조전 + 25)

/** 부대 공격력 = floor(무력/2) + 등급계수 누적성장 (← 무력, grades.atk) */
export function attackPower(u: UnitState): number {
  return corpsStat(u.war, u.grades.atk, u.level);
}
/** 부대 방어력 = floor(통솔/2) + 등급계수 누적성장 (← 통솔, grades.def) */
export function defensePower(u: UnitState): number {
  return corpsStat(u.leadership, u.grades.def, u.level);
}
/**
 * 부대 정신력 = (floor(지력/2) + 등급계수 누적성장) × 병법서 보정 (← 지력, grades.spirit).
 * bookBonus = 1 + 최고 book bonusPercent/100 (createBattle에서 산정, 없으면 1.0).
 */
export function spiritPower(u: UnitState): number {
  return Math.floor(corpsStat(u.intelligence, u.grades.spirit, u.level) * u.bookBonus);
}

/** 다음 레벨까지 필요 경험치 = level × 50 (§10 행동 기반 성장). */
export function expForNextLevel(level: number): number {
  return level * 50;
}

/** 영걸전 레거시 보정 커브 — 미사용(호환 위해 보존). */
export function adjustedStat(x: number): number {
  return Math.round(4000 / (140 - x));
}

/** 공격측 line 기준 방어력 배율: 유리 0.75 / 불리 1.25 / 그 외 1.0 */
function defFactor(ctx: BattleContext, attacker: UnitState, defender: UnitState): number {
  const cfg = ctx.data.combat;
  if (cfg.lineAdvantage[attacker.line] === defender.line) return cfg.advantageDefFactor;
  if (cfg.lineAdvantage[defender.line] === attacker.line) return cfg.disadvantageDefFactor;
  return 1.0;
}

/**
 * 조조전 데미지 공식 — 명중 100%, 분산 없음 (퍼즐성 = 계산 가능성).
 * 데미지 = ((부대공격력 − 부대방어력 × 상성계수) ÷ 2 + 공격자레벨 + 25) × (1 − 지형 guard)
 *   - 상성계수: 유리 0.75 / 불리 1.25 (방어력에 곱)
 *   - +Lv +25 상수항이 조조전 특유의 "압축된 저(低)데미지 공방전" 페이싱을 만든다
 *   - ratio: 반격 0.5용. guard: 지형 방어보정(영걸전 잔존 — 조조전 점유 ×1.2는 후속)
 */
export function computeDamage(
  ctx: BattleContext, attacker: UnitState, defender: UnitState, ratio = 1,
): number {
  const guard = terrainAt(ctx, defender.x, defender.y).guard;
  const atk = attackPower(attacker);
  const def = defensePower(defender) * defFactor(ctx, attacker, defender);
  const raw = (atk - def) / 2 + attacker.level + DMG_BASE;
  return Math.max(ctx.data.combat.minDamage, Math.floor(Math.max(0, raw) * (1 - guard) * ratio));
}

export function distance(a: Coord, b: Coord): number {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

// ── 책략 (§8 스킬 1층) ────────────────────────────────────────────────────────

/**
 * 책략 데미지 (docs/reference/sosoden-combat-formula.md §3 책략):
 *   ((시전 정신력 − 대상 정신력)/3 + 시전Lv + 25) × power/10, 최소 1.
 * power/10 정규화 — 초열(6)≈0.6배 … 화룡(20)≈2.0배. (원작 "× 기본치"의 잠정 스케일)
 */
export function strategyDamage(caster: UnitState, target: UnitState, power: number): number {
  const raw = (spiritPower(caster) - spiritPower(target)) / 3 + caster.level + DMG_BASE;
  return Math.max(1, Math.floor((Math.max(0, raw) * power) / 10));
}

/** 책략 영향 칸 = 대상 칸 + AoE 모양 (cross = 상하좌우 십자) */
export function strategyAoeCells(target: Coord, aoe: "single" | "cross"): Coord[] {
  if (aoe === "single") return [target];
  return [
    target,
    { x: target.x - 1, y: target.y }, { x: target.x + 1, y: target.y },
    { x: target.x, y: target.y - 1 }, { x: target.x, y: target.y + 1 },
  ];
}

/**
 * 시전 가능한 대상 칸 목록 — 시전자에서 castRange 이내(맨해튼) + AoE 안에 유효 표적(적/아군)이 1명 이상.
 * 입력 UI(하이라이트)와 검증에 공용.
 */
export function getStrategyTargets(
  ctx: BattleContext, state: BattleState, unitId: string, strategyId: string, from?: Coord,
): Coord[] {
  const u = state.units.find((x) => x.id === unitId);
  const strat = ctx.data.strategies[strategyId];
  if (!u || u.retreated || !strat) return [];
  if (!(u.classId in ctx.data.unitClasses) ||
      !ctx.data.unitClasses[u.classId]!.strategies.includes(strategyId)) return [];
  if (u.mp < strat.mp) return [];
  const origin = from ?? { x: u.x, y: u.y }; // 프리뷰 이동 후 위치에서 시전 가능 판정
  const W = ctx.map.width, H = ctx.map.height;
  const out: Coord[] = [];
  for (let dy = -strat.castRange; dy <= strat.castRange; dy++) {
    const rem = strat.castRange - Math.abs(dy);
    for (let dx = -rem; dx <= rem; dx++) {
      const tile = { x: origin.x + dx, y: origin.y + dy };
      if (tile.x < 0 || tile.y < 0 || tile.x >= W || tile.y >= H) continue;
      const hit = strategyAoeCells(tile, strat.aoe).some((c) => {
        const t = unitAt(state, c.x, c.y);
        if (!t || t.retreated) return false;
        return strat.target === "enemy" ? t.side !== u.side : t.side === u.side;
      });
      if (hit) out.push(tile);
    }
  }
  return out;
}

/** from 위치 기준 사거리 내 적 id 목록. from 생략 시 현재 위치 */
export function getAttackableTargets(
  ctx: BattleContext,
  state: BattleState,
  unitId: string,
  from?: Coord,
): string[] {
  const unit = state.units.find((u) => u.id === unitId);
  if (!unit || unit.retreated) return [];
  const pos = from ?? { x: unit.x, y: unit.y };
  return state.units
    .filter((t) => t.side !== unit.side && !t.retreated)
    .filter((t) => {
      const d = distance(pos, { x: t.x, y: t.y });
      return d >= unit.rangeMin && d <= unit.rangeMax;
    })
    .map((t) => t.id);
}
