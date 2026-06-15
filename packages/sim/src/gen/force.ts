/**
 * 전력 측정 (§11-B) — 페이싱 예산 배분의 단위. 순수(엔진 stat 합성).
 *
 * unitForce = (공격력 + 방어력) × 병력/100. 공격력/방어력은 spawnUnit으로 합성한 UnitState에서
 * attackPower/defensePower로 파생(무력·통솔·등급계수·아이템 보정 반영). 위치·맵 무관(balance.ts 전제).
 * 절대 스케일은 오토튠 노브가 보정하므로, 여기선 *상대 전력*만 일관되면 충분하다.
 */
import { spawnUnit, attackPower, defensePower } from "@tk/engine";
import type { GameData, StageUnit } from "@tk/data";

export function unitForce(data: GameData, unit: StageUnit): number {
  const u = spawnUnit(data, unit);
  return ((attackPower(u) + defensePower(u)) * unit.troops) / 100;
}

export function totalForce(data: GameData, units: StageUnit[]): number {
  return units.reduce((sum, u) => sum + unitForce(data, u), 0);
}
