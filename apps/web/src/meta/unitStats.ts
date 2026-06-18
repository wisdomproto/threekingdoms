/**
 * 편성/상점 표시용 전력·스탯 — 전투와 동일 엔진 함수 재사용(결정론, §2-1). 병력 무관(명목 100).
 * 전력 = attackPower + defensePower (장수+병종+레벨+아이템 반영, sim force.ts와 동일 정의).
 * 무반격·관통·흡혈 등 *행동* 특성은 전력 숫자를 안 바꾼다 — 그건 효과 문구(shopItemView)로 보여준다.
 */
import { spawnUnit, attackPower, defensePower, spiritPower } from "@tk/engine";
import { gameData } from "@tk/data";

export interface UnitStatLine {
  atk: number;
  def: number;
  spirit: number;
  move: number;
  power: number;
}

export function unitStats(
  commanderId: string, classId: string, level: number, items: string[],
): UnitStatLine {
  const u = spawnUnit(gameData, {
    commanderId, classId, level, troops: 100, items: [...items], side: "player", x: 0, y: 0,
  });
  const atk = attackPower(u);
  const def = defensePower(u);
  return { atk, def, spirit: spiritPower(u), move: u.move, power: atk + def };
}
