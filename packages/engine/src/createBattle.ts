import type { GameData, StageUnit } from "@tk/data";
import type { BattleContext, BattleState, UnitState } from "./types";

/**
 * 단일 StageUnit → UnitState 초기화. createBattle과 증원 스폰(maybeAdvancePhase)이 공유한다 —
 * exp/grades/weaponBonus/bookBonus/maxMp 등 초기화 규칙을 한 곳에 둬 증원 유닛이 정규 배치와
 * 동일하게 생성되도록 보장. 결정론(난수 없음).
 */
export function spawnUnit(data: GameData, p: StageUnit): UnitState {
  const cmd = data.commanders[p.commanderId];
  if (!cmd) throw new Error(`unknown commander: ${p.commanderId}`);
  const cls = data.unitClasses[p.classId];
  if (!cls) throw new Error(`unknown class: ${p.classId}`);
  // 원작 룰: 소지품 중 최고 무기 1개만 공격력 % 보정 / 병법서(book) 1개만 정신력 % 보정.
  // + §7 아이템 효과(effects): 말·보물의 이동/공격%/정신%/방어%/연속공격 부여를 합산.
  let weaponBonus = 1.0;
  let bookBonus = 1.0;
  let moveBonus = 0, atkPct = 0, spiritPct = 0, defPct = 0, grantDouble = false;
  let noCounter = false, alwaysHit = false;
  let multiHit: number | undefined, counterStrikes: number | undefined, flatDamagePerLevel: number | undefined;
  for (const itemId of p.items) {
    const item = data.items[itemId];
    if (!item) throw new Error(`unknown item: ${itemId}`);
    if (item.category === "weapon") weaponBonus = Math.max(weaponBonus, 1 + item.bonusPercent / 100);
    if (item.category === "book") bookBonus = Math.max(bookBonus, 1 + item.bonusPercent / 100);
    const e = item.effects;
    if (e) {
      moveBonus += e.move ?? 0;
      atkPct += e.atkPercent ?? 0;
      spiritPct += e.spiritPercent ?? 0;
      defPct += e.defensePercent ?? 0;
      if (e.doubleStrike) grantDouble = true;
      if (e.noCounter) noCounter = true;
      if (e.alwaysHit) alwaysHit = true;
      if (e.multiHit != null) multiHit = Math.max(multiHit ?? 0, e.multiHit);
      if (e.counterStrikes != null) counterStrikes = Math.max(counterStrikes ?? 1, e.counterStrikes);
      if (e.flatDamagePerLevel != null) flatDamagePerLevel = Math.max(flatDamagePerLevel ?? 0, e.flatDamagePerLevel);
    }
  }
  weaponBonus *= 1 + atkPct / 100;   // 보물 공격% 는 무기 보정 위에 곱연산
  bookBonus *= 1 + spiritPct / 100;  // 보물 정신% 는 병서 보정 위에 곱연산
  const damageReduction = Math.min(0.9, defPct / 100); // 받는 피해 경감(철벽과 동일 계열, 합산 캡)
  const maxMp = Math.floor((p.level + 10) * cmd.intelligence / 40);
  return {
    id: cmd.id, classId: cls.id, line: cls.line, moveClass: cls.moveClass,
    side: p.side, x: p.x, y: p.y, level: p.level, exp: 0,
    troops: p.troops, maxTroops: p.troops, morale: 100,
    mp: maxMp, maxMp,
    war: cmd.war, leadership: cmd.leadership, intelligence: cmd.intelligence,
    agility: cmd.agility ?? 50,

    baseAtk: cls.baseAtk, baseDef: cls.baseDef, grades: cls.grades, weaponBonus, bookBonus,
    move: cls.move + moveBonus, baseMove: cls.move, rangeMin: cls.rangeMin, rangeMax: cls.rangeMax,
    damageReduction, grantsDoubleStrike: grantDouble,
    noCounter: noCounter || undefined, multiHit, counterStrikes, flatDamagePerLevel, alwaysHit: alwaysHit || undefined,
    sp: 0, maxSp: data.combat.sp.max,
    items: [...p.items], // 소모품 useItem 시 1개씩 제거 (weapon/book 보정은 위에서 이미 산정)
    moved: false, acted: false, retreated: false,
  };
}

export function createBattle(ctx: BattleContext, seed: number): BattleState {
  const { data, stage } = ctx;
  const units: UnitState[] = stage.units.map((p) => spawnUnit(data, p));
  return {
    // rngState = 전투 시드(시드 고정 확률 — 같은 시드+행동열이면 동일 재현, 리플레이/세이브스컴 방지).
    turn: 1, phase: "player", status: "ongoing", units, rngState: seed, firedEvents: [],
    duelHistory: [], metStrategyConditions: [], spawnedReinforcements: [], pendingRewards: [], combo: 0,
  };
}
