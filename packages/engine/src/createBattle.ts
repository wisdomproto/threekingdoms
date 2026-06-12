import type { GameData, Stage } from "@tk/data";
import type { BattleState, UnitState } from "./types";

export function createBattle(stage: Stage, data: GameData, seed: number): BattleState {
  const units: UnitState[] = stage.units.map((p) => {
    const cmd = data.commanders[p.commanderId];
    if (!cmd) throw new Error(`unknown commander: ${p.commanderId}`);
    const cls = data.unitClasses[cmd.classId];
    if (!cls) throw new Error(`unknown class: ${cmd.classId}`);
    return {
      id: cmd.id, classId: cls.id, side: p.side,
      x: p.x, y: p.y, level: cmd.level,
      hp: cmd.stats.hp, maxHp: cmd.stats.hp,
      mp: cmd.stats.mp, maxMp: cmd.stats.mp,
      atk: cmd.stats.atk, def: cmd.stats.def, int: cmd.stats.int,
      move: cls.move, rangeMin: cls.rangeMin, rangeMax: cls.rangeMax,
      moved: false, acted: false, retreated: false,
    };
  });
  return { turn: 1, phase: "player", status: "ongoing", units, rngState: seed, firedEvents: [] };
}
