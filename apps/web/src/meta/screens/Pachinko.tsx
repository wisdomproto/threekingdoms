"use client";
import styles from "./Pachinko.module.css";
export function Pachinko({ onSkip, active = false }: { onSkip?: () => void; active?: boolean }) {
  return <div className={`${styles.machine} ${active ? styles.opening : ''}`}>
    <div className={styles.halo}/>
    <div className={styles.art} role="img" aria-label={active ? "금장 보물함이 열리며 빛이 퍼집니다" : "용 문양 금장 보물함"}>
      <div className={styles.closed}/><div className={styles.open}/>
      {active && <div className={styles.sparks}>{Array.from({length:12},(_,i)=><i key={i} style={{left:`${15+i*6}%`,animationDelay:`${1.4+i*.055}s`}}>✦</i>)}</div>}
    </div>
    {active && <button onClick={onSkip}>연출 건너뛰기 →</button>}
  </div>;
}
