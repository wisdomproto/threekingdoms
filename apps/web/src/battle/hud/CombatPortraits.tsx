"use client";
import type { BattleEvent } from "@tk/engine";
import type { BattleVM } from "../viewmodel";
import { assetUrl } from "../../assetUrl";
import styles from "./CombatPortraits.module.css";

export type CombatHit = Extract<BattleEvent, { type: "damageDealt" }>;

/** Presentation only: the event player owns the lifetime of each exchange. */
export function CombatPortraits({ hit, vm }: { hit: CombatHit | null; vm: BattleVM }): React.ReactElement | null {
  if (!hit) return null;
  const attacker = vm.units.find(unit => unit.id === hit.attackerId);
  const defender = vm.units.find(unit => unit.id === hit.defenderId);
  if (!attacker || !defender) return null;
  return <div className={styles.exchange} aria-label="교전 장수">
    {[attacker, defender].map((unit, index) => <div key={`${index}-${unit.id}`} className={`${styles.portrait} ${index ? styles.defender : ""}`}>
      <img src={assetUrl(`/assets/ui/portraits/${encodeURIComponent(unit.name)}.webp`)} alt={unit.name} onError={event => { event.currentTarget.style.visibility = "hidden"; }} />
      <div className={styles.caption}><small>{index ? "방어" : hit.counter ? "반격" : hit.source === "strategy" ? "책략" : "공격"}</small><strong>{unit.name}</strong><span>Lv.{unit.level} · {unit.className}</span></div>
    </div>)}
  </div>;
}
