import type { BattleContext, BattleState, UnitState } from "./types";

export function createBattle(ctx: BattleContext, seed: number): BattleState {
  const { data, stage } = ctx;
  const units: UnitState[] = stage.units.map((p) => {
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
      baseAtk: cls.baseAtk, baseDef: cls.baseDef, weaponBonus, bookBonus,
      move: cls.move, rangeMin: cls.rangeMin, rangeMax: cls.rangeMax,
      moved: false, acted: false, retreated: false,
    };
  });
  return { turn: 1, phase: "player", status: "ongoing", units, rngState: seed, firedEvents: [] };
}
