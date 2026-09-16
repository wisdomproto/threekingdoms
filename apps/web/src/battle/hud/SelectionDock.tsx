"use client";
import { useEffect, useRef, useState } from "react";
import type { InputState } from "../inputMachine";
import type { BattleVM } from "../viewmodel";
import { activeUnitId, PortraitBox, UnitPanel } from "./UnitPanel";
import styles from "./selectionDockStyles";

export function SelectionDock({ ui, vm, previewWalking }: {
  ui: InputState; vm: BattleVM; previewWalking: boolean;
}): React.ReactElement | null {
  const [details, setDetails] = useState(false);
  const dockRef = useRef<HTMLElement>(null);
  const unit = vm.units.find(u => u.id === activeUnitId(ui));
  useEffect(() => {
    const element = dockRef.current;
    if (!element) return;
    const update = () => document.documentElement.style.setProperty("--tk-bottom-inset", `${element.offsetHeight + 24}px`);
    const observer = new ResizeObserver(update);
    observer.observe(element);
    update();
    return () => { observer.disconnect(); document.documentElement.style.removeProperty("--tk-bottom-inset"); };
  }, [unit?.id]);
  useEffect(() => setDetails(false), [unit?.id]);
  if (!unit) return null;
  const hint = previewWalking ? "이동 중…" : ui.kind === "selected" ? "이동할 칸을 선택하세요 · 제자리 선택 시 행동" : ui.kind === "confirmAttack" ? "공격 예측을 확인하세요" : ui.kind.endsWith("Target") || ui.kind === "targetSelect" ? "맵에서 대상을 선택하세요" : unit.acted ? "행동 완료" : unit.side === "enemy" ? "적 장수 정보" : "행동을 선택하세요";
  return <section ref={dockRef} style={styles.dock} aria-label="선택 장수 정보">
    {details && <div style={styles.details}><UnitPanel key={unit.id} ui={ui} vm={vm} /></div>}
    <div style={styles.info}>
      <PortraitBox key={unit.name} name={unit.name} compact />
      <div style={styles.summary}>
        <div style={styles.heading}><strong>{unit.name}</strong><span>Lv.{unit.level} · {unit.className}</span></div>
        <div style={styles.meter}><span>병력</span><meter aria-label="병력" min={0} max={Math.max(1, unit.maxTroops)} value={unit.troops} /><b>{unit.troops}/{unit.maxTroops}</b></div>
        <div style={styles.meter}><span>책략</span><meter aria-label="책략" min={0} max={Math.max(1, unit.maxMp)} value={unit.mp} /><b>{unit.mp}/{unit.maxMp}</b></div>
      </div>
      <button style={styles.detailButton} aria-expanded={details} onClick={() => setDetails(!details)}>{details ? "닫기" : "상세"}</button>
    </div>
    <div style={styles.hint} role="status">{hint}</div>
  </section>;
}
