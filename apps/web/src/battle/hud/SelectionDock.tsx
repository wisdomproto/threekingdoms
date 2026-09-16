"use client";
import { useEffect, useRef, useState } from "react";
import type { GameData } from "../../game/data";
import type { InputState, UiEvent } from "../inputMachine";
import type { BattleVM } from "../viewmodel";
import { activeUnitId, PortraitBox, UnitPanel } from "./UnitPanel";
import { itemsFor } from "./ActionMenu";
import styles from "./SelectionDock.module.css";
import { StrategyIcon } from "./StrategyIcon";

// Small vector marks stay sharp at any camera or display scale.
function CommandMark({ kind }: { kind: string }): React.ReactElement {
  const paths: Record<string, string> = {
    attack: "M6 26 26 6M19 6h7v7M5 19l8 8M4 28l4-4",
    strategy: "M6 25V7l10 3 10-3v18l-10 3-10-3M16 10v18",
    item: "M12 4h8v6l5 6v11H7V16l5-6V4M12 18h8M16 14v8",
    assist: "M4 8l10 16M28 8 18 24M4 24h10V14M28 24H18V14",
    ultimate: "m18 3-12 16h9l-1 10 12-17h-9l1-9",
    wait: "M11 7v19M21 7v19",
    cancel: "M11 8 4 15l7 7M5 15h15a7 7 0 0 1 0 14",
  };
  return <svg viewBox="0 0 32 32" aria-hidden="true"><path d={paths[kind] ?? "M8 8h16v16H8zM12 16h8"} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}

export function SelectionDock({ ui, vm, data, dispatch, previewWalking }: {
  ui: InputState; vm: BattleVM; data: GameData;
  dispatch: (event: UiEvent) => void; previewWalking: boolean;
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
  const commands = itemsFor(ui, dispatch, data).filter(item => !item.placeholder);
  const hint = previewWalking ? "이동 중…" : ui.kind === "selected" ? "이동할 칸을 선택하세요 · 제자리 선택 시 행동" : ui.kind === "confirmAttack" ? "공격 예측을 확인하세요" : ui.kind.endsWith("Target") || ui.kind === "targetSelect" ? "맵에서 대상을 선택하세요" : unit.acted ? "행동 완료" : unit.side === "enemy" ? "적 장수 정보" : "행동을 선택하세요";
  return <section ref={dockRef} className={styles.dock} aria-label="선택 장수와 행동">
    {details && <div className={styles.details}><UnitPanel key={unit.id} ui={ui} vm={vm} /></div>}
    <div className={styles.info}>
      <PortraitBox key={unit.name} name={unit.name} compact />
      <div className={styles.summary}>
        <div className={styles.heading}><strong>{unit.name}</strong><span>Lv.{unit.level} · {unit.className}</span></div>
        <div className={styles.meter}><span>병력</span><meter aria-label="병력" min={0} max={Math.max(1, unit.maxTroops)} value={unit.troops} /><b>{unit.troops}/{unit.maxTroops}</b></div>
        <div className={`${styles.meter} ${styles.mp}`}><span>책략</span><meter aria-label="책략" min={0} max={Math.max(1, unit.maxMp)} value={unit.mp} /><b>{unit.mp}/{unit.maxMp}</b></div>
      </div>
      <button className={styles.detailButton} aria-expanded={details} onClick={() => setDetails(!details)}>{details ? "닫기" : "상세"}</button>
    </div>
    <div className={styles.actions}><div className={styles.hint} role="status">{hint}</div><div className={styles.commands}>
      {commands.map(item => {
        const strategy = ui.kind === "strategyMenu" && item.key !== "cancel" ? data.strategies[item.key] : undefined;
        return <button key={item.key} className={strategy ? styles.strategyButton : undefined} aria-label={item.label} disabled={previewWalking || item.disabled} onClick={item.onPress}>
          {strategy ? <><StrategyIcon name={strategy.name} category={strategy.category} /><span>{strategy.name}</span><small>MP {strategy.mp}</small></> : <><CommandMark kind={item.key} /><span>{item.label}</span></>}
        </button>;
      })}
      {ui.kind === "selected" && <button onClick={() => dispatch({ type: "cancel" })}><CommandMark kind="cancel" /><span>취소</span></button>}
    </div></div>
  </section>;
}
