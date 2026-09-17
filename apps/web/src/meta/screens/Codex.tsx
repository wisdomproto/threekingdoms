"use client";
/** Treasure catalog: names and effects stay visible before acquisition. */
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { gameData } from "../../game/data";
import { getMeta } from "../metaStore";
import { isSerendipityTreasure } from "../serendipity";
import styles from "./Collection.module.css";
import catalog from "./Codex.module.css";
import { ItemIcon } from "../../ui/ItemIcon";
import { treasureGrade } from "../treasureGrade";

import { itemEffectText } from "../itemEffectText";

export function Codex(): React.ReactElement {
  const [owned, setOwned] = useState<Set<string>>(new Set());
  useEffect(() => {
    setOwned(new Set(getMeta().inventory));
  }, []);

  // Both battle and draw treasures are discoverable; source filters keep them distinct.
  const treasures = useMemo(
    () =>
      Object.values(gameData.items).filter(
        (i) => i.category === "treasure" || !!i.effects,
      ),
    [],
  );
  const [filter, setFilter] = useState<"all" | "owned" | "missing">("all");
  const [source, setSource] = useState("all");
  const collected = treasures.filter((t) => owned.has(t.id)).length;

  const visible = treasures.filter(t => source === "all" || (source === "draw" ? isSerendipityTreasure(t.id) : !isSerendipityTreasure(t.id))).filter(t => filter === "all" || (filter === "owned" ? owned.has(t.id) : !owned.has(t.id)));
  return <main className={`${styles.shell} ${catalog.shell}`}><div className={`${styles.frame} ${catalog.frame}`}>
    <header className={styles.header}><Link href="/stages">← 전장 선택</Link><h1>보물 도감</h1><small>보물과 특수 장비 컬렉션</small></header>
    <div className={styles.body}>
      <div className={styles.intro}><strong className={styles.count}>{collected} / {treasures.length}</strong><p>수집한 보물 · 미획득 장비도 이름과 효과를 확인할 수 있습니다.</p><progress aria-label="보물 수집률" value={collected} max={treasures.length || 1}/></div>
      <div className={styles.filters} aria-label="보물 필터">{([['all','전체'],['owned','획득'],['missing','미획득']] as const).map(([value,label])=><button key={value} aria-pressed={filter===value} onClick={()=>setFilter(value)}>{label}</button>)}</div>
      <div className={styles.filters} aria-label="보물 종류">{[["all","모든 보물"],["battle","특수 장비"],["draw","뽑기 보물"]].map(([id,label])=><button key={id} aria-pressed={source===id} onClick={()=>setSource(id!)}>{label}</button>)}</div><div className={styles.grid}>{visible.map(t=>{ const has=owned.has(t.id); return <article key={t.id} className={`${styles.card} ${catalog.card}`} data-grade={treasureGrade(t.effects).grade} data-owned={has}>
        <span className={styles.badge}>{has ? '✓ 획득' : '미획득'}</span>
        <div className={catalog.art}><ItemIcon itemId={t.id} category={t.category} size={96} style={{opacity:has ? 1 : .3,filter:has ? "none" : "grayscale(1)",border:"none",background:"transparent"}}/></div>
        <h2>{t.name}</h2>
        <b className={catalog.grade}>{treasureGrade(t.effects).label}</b>
        <p className={catalog.effect}>{itemEffectText(t.effects)}</p>
      </article>;})}</div>
      {!visible.length && <p className={styles.empty}>{filter==='owned' ? '아직 획득한 보물이 없습니다. 미획득 탭에서 장비의 효과를 확인해 보세요.' : '이 조건에 해당하는 보물이 없습니다.'}</p>}
    </div>
  </div></main>;
}
