"use client";
import { useState } from "react";
import Link from "next/link";
import { stages } from "../../src/game/data";
import { orderedStageIds, campaignChapters, chapterOf, stageNumber } from "../../src/meta/campaign";
import { readingLines, type ReadingLine } from "../../src/scene/chronicle";
import styles from "./reader.module.css";

function Passage({ lines }: { lines: ReadingLine[] }) {
  return <>{lines.map((line, i) => <div key={i}>
    {line.text && <p className={line.speaker ? styles.dialogue : undefined}>
      {line.speaker && <strong>{line.speaker}</strong>}{line.text}
    </p>}
    {line.choices?.map((choice, j) => <details key={j} className={styles.choice}>
      <summary>선택 대사 · {choice.label}</summary><Passage lines={choice.lines} />
    </details>)}
  </div>)}</>;
}

export default function ChroniclePage() {
  const ids = orderedStageIds().filter(id => stages[id]?.scenario);
  const [selected, setSelected] = useState("");
  const [large, setLarge] = useState(false);
  const id = ids.includes(selected) ? selected : ids[0];
  const stage = id ? stages[id] : undefined;
  const index = id ? ids.indexOf(id) : -1;
  function go(next: string) { setSelected(next); window.scrollTo({ top: 0, behavior: "instant" }); }
  return <main className={styles.reader} style={{ fontSize: large ? 21 : 18 }}>
    <header className={styles.toolbar}>
      <Link href="/">← 메인으로</Link><span>유비전 · 이야기 읽기</span>
      <button aria-pressed={large} onClick={() => setLarge(!large)}>글자 {large ? "작게" : "크게"}</button>
    </header>
    <div className={styles.book}>
      <label className={styles.contents}>목차
        <select value={id ?? ""} onChange={e => go(e.target.value)}>
          {campaignChapters().map(ch => <optgroup key={ch.chapter} label={`${ch.chapter}장 · ${ch.title}`}>
            {ids.filter(key => chapterOf(stageNumber(key)) === ch.chapter).map(key => <option value={key} key={key}>{stages[key]!.name}</option>)}
          </optgroup>)}
        </select>
      </label>
      <p className={styles.note}>전투 전후의 이야기를 차례로 읽습니다. 이후 내용이 포함되어 있습니다.</p>
      {stage ? <article>
        <h1>{stage.name}</h1>
        <section aria-label="전투 전 이야기"><h2>전투 전</h2><Passage lines={readingLines(stage.scenario?.intro)} /></section>
        <div className={styles.battle}>— {stage.name} 전투 —</div>
        <section aria-label="전투 후 이야기"><h2>전투 후</h2><Passage lines={readingLines(stage.scenario?.outro)} /></section>
      </article> : <p>아직 등록된 이야기가 없습니다.</p>}
      <nav aria-label="이야기 이동" className={styles.navigation}>
        <button disabled={index <= 0} onClick={() => go(ids[index - 1]!)}>← 이전 이야기</button>
        <span>{ids.length ? index + 1 : 0} / {ids.length}</span>
        <button disabled={index < 0 || index >= ids.length - 1} onClick={() => go(ids[index + 1]!)}>다음 이야기 →</button>
      </nav>
    </div>
  </main>;
}
