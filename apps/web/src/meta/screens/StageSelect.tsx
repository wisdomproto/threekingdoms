"use client";
/**
 * 스테이지 선택 화면 — §5 시나리오 챕터/스테이지 목록.
 *
 * 해금 규칙: 첫 스테이지는 항상 해금, 그 외는 "직전 스테이지 클리어"로 해금.
 * 장별 목록과 모바일 카드. 잠긴 전투도 이름과 해금 조건을 읽을 수 있다.
 * 「이어하기」 배너(스펙 §7): 중단 저장본(tk.battle.suspend.v1)이 이 회차·스테이지와 맞으면 헤더 아래 표시.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { stages, activeGame } from "../../game/data";
import { campaignChapters, chapterOf, stageNumber, orderedStageIds } from "../campaign";
import { assetUrl } from "../../assetUrl";
import styles from "./StageSelect.module.css";
import { getMeta, startNewGame } from "../metaStore";
import { writeSortie } from "../sortie";
import { clearSuspend, isResumable, readSuspend, type SuspendedBattle } from "../../battle/suspend";

const MISSION_TAGS: [RegExp, string][] = [
  [/탈출|철수/, "탈출전"],
  [/방어/, "방어전"],
  [/관문|사수관|호로관/, "공성전"],
  [/하비|공방/, "공방전"],
  [/사냥|이벤트/, "이벤트"],
  [/도하|수상|삼강|적벽/, "수상전"],
];

function missionTag(name: string): string {
  for (const [re, label] of MISSION_TAGS) {
    if (re.test(name)) return label;
  }
  return "섬멸전";
}

export function StageSelect(): React.ReactElement {
  const router = useRouter();
  const [selectedStage, setSelectedStage] = useState<string | null>(null);
  const [chapter, setChapter] = useState<number | null>(null);
  const [cleared, setCleared] = useState<string[]>([]);
  const [gold, setGold] = useState(0);
  const [playthroughCount, setPlaythroughCount] = useState(0);
  const [confirmNg, setConfirmNg] = useState(false);
  const [suspended, setSuspended] = useState<SuspendedBattle | null>(null);

  const reload = useCallback(() => {
    const m = getMeta();
    setCleared(m.clearedStages);
    setGold(m.gold);
    setPlaythroughCount(m.playthroughCount);
    setConfirmNg(false);
    const s = readSuspend();
    setSuspended(
      isResumable(s, { playthroughCount: m.playthroughCount, hasStage: (id) => Object.hasOwn(stages, id) }) ? s : null,
    );
  }, []);

  // 이어하기 — 저장 당시 편성을 되살려(없으면 원본 배치) ?resume=1 로 진입 → BattleScreen이 로그를 fold.
  const resume = useCallback(
    (s: SuspendedBattle) => {
      writeSortie(s.sortie ?? { stageId: s.stageId, members: [], sharedItems: [] });
      window.location.assign(`/battle?stage=${s.stageId}&resume=1`);
    },
    [router],
  );

  useEffect(() => { reload(); }, [reload]);

  const ordered = useMemo(
    () => orderedStageIds().map(id => stages[id]!),
    [],
  );

  const clearedSet = useMemo(() => new Set(cleared), [cleared]);

  const unlocked = useMemo(() => {
    const map = new Map<string, boolean>();
    ordered.forEach((s, i) => {
      map.set(s.id, i === 0 ? true : clearedSet.has(ordered[i - 1]!.id));
    });
    return map;
  }, [ordered, clearedSet]);

  const grouped = useMemo(() =>
    campaignChapters().map((ch) => ({
      ...ch,
      list: ordered.filter((s) => activeGame ? activeGame.chapters.find(c => c.chapter === ch.chapter)?.stageIds.includes(s.id) : chapterOf(stageNumber(s.id)) === ch.chapter),
    })),
    [ordered],
  );

  const allCleared = ordered.length > 0 && ordered.every((s) => clearedSet.has(s.id));

  const next = ordered.find(s => unlocked.get(s.id) && !clearedSet.has(s.id)) ?? ordered.at(-1);
  const current = grouped.find(ch => ch.chapter === chapter)
    ?? grouped.find(ch => ch.list.some(s => s.id === next?.id)) ?? grouped[0];
  const selected = current?.list.find(s=>s.id===selectedStage) ?? current?.list.find(s=>s.id===next?.id) ?? current?.list[0];
  const selectedOpen = selected ? unlocked.get(selected.id) ?? false : false;
  const completed = ordered.filter(s => clearedSet.has(s.id)).length;

  return <section className={styles.shell}>
    <div className={styles.frame}>
      <img key={current?.chapter} className={styles.backdrop} src={assetUrl(`/assets/scenes/${current?.list[0]?.id ?? "01-zhuojun"}-intro.webp`)} alt="" onError={e=>{e.currentTarget.style.display="none";}} />
      <header className={styles.header}>
        <Link className={styles.back} href="/play/samgukji" aria-label="타이틀로 돌아가기">← <span>타이틀</span></Link>
        <h1>전장 선택</h1>
        <span className={styles.gold}>자금 <strong>{gold.toLocaleString()}</strong> 금</span>
        <nav className={styles.utilities} aria-label="게임 메뉴">
          <Link href="/serendipity">보물 뽑기</Link><Link href="/codex">도감</Link><Link href="/save">세이브</Link>
        </nav>
      </header>
      <div className={styles.body}>
        <aside className={styles.chapters}>
          <div className={styles.journey}><span>삼국지 여정</span><strong>{completed}<small> / {ordered.length} 전투</small></strong>
            <progress aria-label="전체 전투 진행도" value={completed} max={Math.max(1, ordered.length)} />
          </div>
          <nav className={styles.chapterList} aria-label="장 선택">
            {grouped.map(ch => <button type="button" key={ch.chapter} aria-current={current?.chapter === ch.chapter ? "true" : undefined}
              onClick={() => setChapter(ch.chapter)} className={styles.chapter}>
              <span className={styles.chapterNumber}>{String(ch.chapter).padStart(2,"0")}</span>
              <span><strong>{ch.title}</strong><small>{ch.list.filter(s => clearedSet.has(s.id)).length} / {ch.list.length} 완료</small></span>
              <span className={styles.chevron} aria-hidden>›</span>
            </button>)}
          </nav>
        </aside>
        <div className={styles.content}>
          {suspended && <div className={styles.resume}>
            <button type="button" data-testid="resume-battle" onClick={() => resume(suspended)}>
              <strong>중단한 전투 이어하기 →</strong><span>{stages[suspended.stageId]?.name ?? suspended.stageId} · {suspended.turn}턴 · {savedAtLabel(suspended.savedAt)}</span>
            </button>
            <button type="button" aria-label="저장본 지우기" onClick={() => {clearSuspend(); reload();}}>지우기</button>
          </div>}
          {current && <>
            <div className={styles.chapterTitle}><div><span className={styles.chapterSeal}>제 {current.chapter} 장 · 연의</span><h2>{current.title}</h2><p>이야기를 따라, 다음 전장으로.</p></div>
              <span className={styles.chapterProgress}>{current.list.filter(s=>clearedSet.has(s.id)).length} / {current.list.length}<small>전투 완료</small></span></div>
            <div className={styles.missions}><div className={styles.stageList}>
              {current.list.map((stage, i) => {
                const open = unlocked.get(stage.id) ?? false;
                const done = clearedSet.has(stage.id);
                const featured = stage.id === next?.id;
                const inside = <>
                  <img className={styles.art} src={assetUrl(`/assets/maps/${stage.mapId}.webp`)} alt="" loading="lazy" onError={e=>{e.currentTarget.style.display="none";}} />
                  <span className={styles.stageNumber}>{String(i+1).padStart(2,"0")}</span>
                  <span className={styles.stageInfo}><small>{done ? "완료" : open ? "출전 가능" : "미해금"} · {missionTag(stage.name)}</small>
                    <strong>{stage.name}</strong>
                    <span>{open ? `승리 보상 ${stage.reward?.gold ?? 0} 금${stage.reward?.treasures.length ? ` · 보물 ${stage.reward.treasures.length}종` : ""}` : "이전 전투를 완료하면 열립니다"}</span>
                  </span>
                  <span className={styles.action}>{done ? "완료 ✓" : open ? "선택 ›" : "잠김"}</span>
                </>;
                return <button type="button" key={stage.id} aria-pressed={selected?.id===stage.id} onClick={()=>setSelectedStage(stage.id)}
                  className={`${styles.stage} ${featured ? styles.featured : ""} ${done ? styles.completed : open ? styles.available : styles.locked}`}>{inside}</button>;
              })}
            </div>
            {selected && <section className={styles.missionDetail} aria-label="선택한 전투 정보">
              <div className={styles.detailArt}><img key={selected.id} src={assetUrl(`/assets/maps/${selected.mapId}.webp`)} alt={`${selected.name} 전장`} onError={e=>{e.currentTarget.style.visibility="hidden";}} /><span>{missionTag(selected.name)}</span></div>
              <div className={styles.detailBody}><small>{clearedSet.has(selected.id) ? "완료한 전투" : selectedOpen ? "다음 여정" : "아직 열리지 않은 전투"}</small>
                <h3>{selected.name}</h3><p>{selectedOpen ? "이야기와 함께 전장으로 향합니다. 출전 전 장수와 장비를 준비하세요." : "이전 전투를 완료하면 이 이야기가 열립니다."}</p>
                <div className={styles.reward}><span>승리 보상</span><strong>{selected.reward?.gold ?? 0}<small> 금</small></strong>{!!selected.reward?.treasures.length && <span>보물 {selected.reward.treasures.length}종</span>}</div>
                {selectedOpen ? <Link className={styles.enter} href={{pathname:"/scene",query:{stage:selected.id,type:"intro"}}}>{clearedSet.has(selected.id) ? "다시 출전" : "이야기 시작"}<span aria-hidden>→</span></Link> : <button className={styles.enter} disabled>이전 전투 완료 후 입장</button>}
              </div>
            </section>}
            </div>
            {current.list.length === 0 && <p>이 장의 전투는 준비 중입니다.</p>}
          </>}
          {allCleared && <section className={styles.newGame}><h2>{playthroughCount > 0 ? playthroughCount+1 : 2}회차 도전</h2>
            <p>보물·자금 일부를 계승하고 적이 강해집니다. 레벨·편성·장비는 초기화됩니다.</p>
            {confirmNg ? <><button onClick={()=>{startNewGame();reload();setChapter(null);}}>확인 — 시작</button><button onClick={()=>setConfirmNg(false)}>취소</button></> : <button onClick={()=>setConfirmNg(true)}>새 회차 시작</button>}
          </section>}
          <p className={styles.hint}>전투를 선택하면 이야기를 보고 출전을 준비합니다.</p>
        </div>
      </div>
    </div>
  </section>;
}

function savedAtLabel(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : `${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`;
}
