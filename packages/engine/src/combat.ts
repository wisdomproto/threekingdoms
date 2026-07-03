import type { GameData, UnitClass } from "@tk/data";
import type { BattleContext, BattleState, Coord, UnitState } from "./types";
import { areFoes } from "./types";
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
/** 부대 순발력 = floor(민첩/2) + 등급계수 누적성장 (← 민첩, grades.agility). 명중/회피 입력. */
export function agilityPower(u: UnitState): number {
  return corpsStat(u.agility, u.grades.agility, u.level);
}

/**
 * 명중률(%) — 시드 고정 확률(§2-1 2026-06-16). 동급 100%·완만 미스, 하한 floorPercent.
 *   명중% = clamp(100 − missSlope × max(0, defAgi − atkAgi), floorPercent, 100)
 * 순수·결정론(롤은 actions.ts에서 이 %를 시드로 굴림). 사거리/지형 무관(피해는 computeDamage).
 */
export function hitChance(
  atkAgi: number, defAgi: number, cfg: { missSlope: number; floorPercent: number },
): number {
  const raw = 100 - cfg.missSlope * Math.max(0, defAgi - atkAgi);
  return Math.max(cfg.floorPercent, Math.min(100, raw));
}

/**
 * 회심률(%) — 시드 고정 확률(리파인 카탈로그 "회심/치명일격 — 운 기반 확률 큰 피해").
 *   회심% = clamp(basePercent + luckSlope × (atkLuck − defLuck), minPercent, maxPercent)
 * luck = 장수 운 원값(성장 없음 — grades에 운 등급이 없어 corpsStat 미적용, 원값 비교).
 * 순수·결정론(롤은 actions.ts resolveStrike에서 시드로 굴림). 필살/책략/아이템은 회심 없음.
 */
export function critChance(
  atkLuck: number, defLuck: number,
  cfg: { basePercent: number; luckSlope: number; minPercent: number; maxPercent: number },
): number {
  const raw = cfg.basePercent + cfg.luckSlope * (atkLuck - defLuck);
  return Math.max(cfg.minPercent, Math.min(cfg.maxPercent, raw));
}

/**
 * 가드율(%) — 시드 고정 확률(리파인 카탈로그 "확률/능력 방어"). 통솔 기반 —
 *   가드% = clamp(basePercent + leadSlope × (방어 통솔 − 공격 통솔), minPercent, maxPercent)
 * 발동 시 피해 ×damagePercent/100 (기본 반감). 필살/책략/고정뎀은 가드 불가(호출측 제어).
 */
export function guardChance(
  defLead: number, atkLead: number,
  cfg: { basePercent: number; leadSlope: number; minPercent: number; maxPercent: number },
): number {
  const raw = cfg.basePercent + cfg.leadSlope * (defLead - atkLead);
  return Math.max(cfg.minPercent, Math.min(cfg.maxPercent, raw));
}

/** 다음 레벨까지 필요 경험치 = level × 50 (§10 행동 기반 성장). */
export function expForNextLevel(level: number): number {
  return level * 50;
}

/**
 * 승급(§7) — **레벨의 순수 함수**(메타 상태 없음, 상향 전용). 저작된 병종에서 시작해
 * promotesTo 체인을 레벨 임계(combat.promotion: T2/T3 도달 레벨)만큼 걷는다.
 * 저작이 이미 상위 티어면 그대로(하향 없음 — 하후돈 L9 중기병 등 원작 배치 보존).
 * 군주/책사 등 promotesTo 없는 병종은 항상 자기 자신.
 */
export function effectiveClassId(data: GameData, classId: string, level: number): string {
  const start = data.unitClasses[classId];
  if (!start) return classId;
  let cur: UnitClass = start;
  const cfg = data.combat.promotion;
  while (cur.promotesTo) {
    const next: UnitClass | undefined = data.unitClasses[cur.promotesTo];
    if (!next) break;
    const need = next.tier >= 3 ? cfg.tier3Level : cfg.tier2Level;
    if (level < need) break;
    cur = next;
  }
  return cur.id;
}

/**
 * 전투 중 승급 적용(§7) — 유닛의 병종 유래 필드를 새 병종으로 교체. 아이템 보정(말 move/
 * 사거리 보너스)은 "저작 병종 대비 증분"으로 보존, 병력/SP/MP/경험치/소지품은 불변.
 * 결정론 — 난수 없음. 호출측(grantExp)이 unitPromoted 이벤트를 서술한다.
 */
export function applyPromotion(data: GameData, u: UnitState, newClassId: string): UnitState {
  const oldCls = data.unitClasses[u.classId];
  const cls = data.unitClasses[newClassId];
  if (!oldCls || !cls || newClassId === u.classId) return u;
  return {
    ...u,
    classId: cls.id, line: cls.line, moveClass: cls.moveClass,
    baseAtk: cls.baseAtk, baseDef: cls.baseDef, grades: cls.grades,
    move: cls.move + (u.move - oldCls.move), baseMove: cls.move,
    rangeMin: cls.rangeMin, rangeMax: cls.rangeMax + (u.rangeMax - oldCls.rangeMax),
  };
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
  ctx: BattleContext, attacker: UnitState, defender: UnitState, ratio = 1, flankMult = 1,
): number {
  const p = ctx.data.combat.passives;
  // 궁병 저격(패시브): 공격자가 궁병 계열이면 대상 지형 guard를 일부 관통(엄폐 무시).
  const rawGuard = terrainAt(ctx, defender.x, defender.y).guard;
  const guard = attacker.line === "archer" ? rawGuard * (1 - p.archerSnipePiercePercent / 100) : rawGuard;
  // 장비 런타임: 무기 보정(weaponBonus = 1 + 최고 무기 bonusPercent/100)을 부대 공격력에 곱한다.
  // createBattle에서 산정된 값(미보유 = 1.0). 결정론 — 난수 없음.
  const atk = attackPower(attacker) * (attacker.weaponBonus ?? 1);
  const def = defensePower(defender) * defFactor(ctx, attacker, defender);
  const raw = (atk - def) / 2 + attacker.level + DMG_BASE;
  // flankMult: 협공 배율(결정론 ≥1.0). 지형·반격ratio와 동일하게 최종 곱연산.
  const base = Math.max(0, raw) * (1 - guard) * ratio * flankMult;
  // 보병 철벽(패시브): 방어자가 보병 계열이면 최종 피해를 일부 경감.
  const bulwark = defender.line === "infantry" ? 1 - p.infantryBulwarkPercent / 100 : 1;
  // 아이템 방어 효과(§7): 방어 보물 등의 피해 경감(철벽과 곱연산).
  const itemGuard = 1 - (defender.damageReduction ?? 0);
  return Math.max(ctx.data.combat.minDamage, Math.floor(base * bulwark * itemGuard));
}

/**
 * 기병 돌격(패시브) → 결정론 데미지 배율. 공격자가 기병 계열이고 이번 턴 이동 후
 * 공격(moved=true)할 때만 발동. 제자리 공격·비기병은 1.0. 개시 공격에만 곱한다(반격 제외).
 */
export function chargeMultiplier(ctx: BattleContext, attacker: UnitState): number {
  if (attacker.line !== "cavalry" || !attacker.moved) return 1;
  return 1 + ctx.data.combat.passives.cavalryChargePercent / 100;
}

/**
 * 연속공격(2중공격) 발동 여부 — 공격자 이동력이 대상보다 moveGap 이상 높으면 true(결정론).
 * 원작 조조전의 순발력 기반 연속공격확률을 RNG 없이 이동력 우위로 치환(§7). 개시 공격에만.
 */
/** 필살 발동 가능 — SP가 가득 찼는가(§9). 결정론. */
export function canUltimate(unit: UnitState): boolean {
  return (unit.sp ?? 0) >= (unit.maxSp ?? Infinity);
}

export function doubleStrikes(ctx: BattleContext, attacker: UnitState, defender: UnitState): boolean {
  // 아이템으로 연속공격 부여(§7)면 이동력 무관 발동, 아니면 *병종 기본 이동력* 우위로 판정.
  // (말 보너스는 이동 범위만 — 연속공격 임계를 흔들지 않게 baseMove로 본다.)
  if (attacker.grantsDoubleStrike) return true;
  const am = attacker.baseMove ?? attacker.move;
  const dm = defender.baseMove ?? defender.move;
  return am - dm >= ctx.data.combat.doubleStrike.moveGap;
}

/** 대상 4방(상하좌우)에서 공격자 진영 부대가 점유한 칸 수 — 협공 포위도(공격자 포함). 결정론. */
export function flankingCount(state: BattleState, attacker: UnitState, defender: UnitState): number {
  const dirs: Coord[] = [{ x: 1, y: 0 }, { x: -1, y: 0 }, { x: 0, y: 1 }, { x: 0, y: -1 }];
  let n = 0;
  for (const d of dirs) {
    const u = unitAt(state, defender.x + d.x, defender.y + d.y);
    if (u && !u.retreated && !areFoes(u.side, attacker.side)) n += 1;
  }
  return n;
}

/**
 * 협공 포위도(count) → 결정론 데미지 배율 (cfg.flank).
 *   count < threshold → 1.0(미발동).
 *   그 외 stacks = min(count − threshold + 1, maxStacks), 배율 = 1 + stacks×stepPercent/100.
 * 첫 발동(=threshold)은 항상 1스택 — threshold 값을 바꿔도 점프 없음.
 */
export function flankMultiplier(ctx: BattleContext, count: number): number {
  const f = ctx.data.combat.flank;
  if (count < f.threshold) return 1;
  const stacks = Math.min(count - f.threshold + 1, f.maxStacks);
  return 1 + (stacks * f.stepPercent) / 100;
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
        // target "enemy" = 적대 진영(camp 다름), "ally" = 같은 진영(우군 포함)
        return strat.target === "enemy" ? areFoes(t.side, u.side) : !areFoes(t.side, u.side);
      });
      if (hit) out.push(tile);
    }
  }
  return out;
}

/**
 * from 위치 기준 사거리 내 **적대 진영(camp 다름)** 유닛 id 목록. from 생략 시 현재 위치.
 * 우군(ally)은 player와 같은 camp(friendly)이므로 서로 타깃 후보가 아니다 — 공격 불가.
 */
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
    .filter((t) => areFoes(t.side, unit.side) && !t.retreated)
    .filter((t) => {
      const d = distance(pos, { x: t.x, y: t.y });
      return d >= unit.rangeMin && d <= unit.rangeMax;
    })
    .map((t) => t.id);
}
