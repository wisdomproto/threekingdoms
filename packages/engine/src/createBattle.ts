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
  // 원작 룰: 소지품 중 최고 무기 1개만 공격력 % 보정 / 병법서(book) 1개만 정신력 % 보정
  let weaponBonus = 1.0;
  let bookBonus = 1.0;
  for (const itemId of p.items) {
    const item = data.items[itemId];
    if (!item) throw new Error(`unknown item: ${itemId}`);
    if (item.category === "weapon") weaponBonus = Math.max(weaponBonus, 1 + item.bonusPercent / 100);
    if (item.category === "book") bookBonus = Math.max(bookBonus, 1 + item.bonusPercent / 100);
  }
  const maxMp = Math.floor((p.level + 10) * cmd.intelligence / 40);
  return {
    id: cmd.id, classId: cls.id, line: cls.line, moveClass: cls.moveClass,
    side: p.side, x: p.x, y: p.y, level: p.level, exp: 0,
    troops: p.troops, maxTroops: p.troops, morale: 100,
    mp: maxMp, maxMp,
    war: cmd.war, leadership: cmd.leadership, intelligence: cmd.intelligence,
    baseAtk: cls.baseAtk, baseDef: cls.baseDef, grades: cls.grades, weaponBonus, bookBonus,
    move: cls.move, rangeMin: cls.rangeMin, rangeMax: cls.rangeMax,
    items: [...p.items], // 소모품 useItem 시 1개씩 제거 (weapon/book 보정은 위에서 이미 산정)
    moved: false, acted: false, retreated: false,
  };
}

export function createBattle(ctx: BattleContext, seed: number): BattleState {
  const { data, stage } = ctx;
  const units: UnitState[] = stage.units.map((p) => spawnUnit(data, p));
  return {
    turn: 1, phase: "player", status: "ongoing", units, rngState: seed, firedEvents: [],
    duelHistory: [], metStrategyConditions: [], spawnedReinforcements: [], pendingRewards: [],
  };
}
