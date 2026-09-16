"use client";
import { useEffect, useRef, useState } from "react";
import { nextChapterNode, parseChapterTest, type ChapterTest, type ChapterResult } from "./chapter-playtest";
import { finishChapterBattle, initialChapterProgress, writeChapterProgress, type ChapterProgress } from "./chapter-progress";
import { parsePlaytestSnapshot } from "../lab/playtest";
import { loadCheckpoint, saveCheckpoint, type ChapterCheckpoint } from "./chapter-checkpoint";

export default function ChapterPlayer() {
  const [test, setTest] = useState<ChapterTest | null>(null);
  const [cursor, setCursor] = useState({ id: "", visit: 0 });
  const [error, setError] = useState("");
  const [stopped, setStopped] = useState(false);
  const [progress, setProgress] = useState<ChapterProgress | null>(null);
  const [resume, setResume] = useState<ChapterCheckpoint | null>(null);
  const frame = useRef<HTMLIFrameElement>(null);
  useEffect(() => {
    let alive = true;
    const id = new URLSearchParams(location.search).get("draft");
    if (!id || !/^[a-f0-9-]{36}$/.test(id)) { setError("챕터 테스트 주소를 확인해 주세요."); return; }
    void fetch(`/_draft/${id}.json`, { cache: "no-store" }).then(async r => {
      if (!r.ok) throw new Error("챕터 테스트 파일이 없습니다. Studio에서 다시 시작해 주세요.");
      const value = parseChapterTest(await r.json());
      if (value.id !== id) throw new Error("챕터 테스트 ID가 다릅니다.");
      if (alive) {
        setTest(value);
        const saved = loadCheckpoint(value);
        if (saved) { setResume(saved); setCursor({ id: saved.nodeId, visit: saved.visit }); return; }
        const initial = initialChapterProgress(value);
        writeChapterProgress(value.id, value.entry, 0, initial);
        saveCheckpoint(value, value.entry, 0, initial);
        setProgress(initial); setTest(value); setCursor({ id: value.entry, visit: 0 });
      }
    }).catch(e => { if (alive) setError(String(e)); });
    return () => { alive = false; };
  }, []);
  useEffect(() => {
    if (!test || !progress || stopped || error) return;
    const receive = (event: MessageEvent) => {
      const message = event.data;
      if (event.origin !== location.origin || event.source !== frame.current?.contentWindow || message?.type !== "tk-chapter:result" || message.runId !== test.id || message.nodeId !== cursor.id || message.visit !== cursor.visit) return;
      if (message.result === "cancelled") { setStopped(true); return; }
      try {
        const id = nextChapterNode(test, cursor.id, message.result as ChapterResult);
        if (cursor.visit >= 99) throw new Error("100단계를 실행했습니다. 반복 연결을 확인한 뒤 처음부터 다시 테스트하세요.");
        let nextProgress = progress;
        const current = test.nodes.find(n => n.id === cursor.id)!;
        if (current.kind === "battle") {
          const parsed = parsePlaytestSnapshot(current.snapshot);
          if (!parsed.ok) throw new Error(parsed.message);
          nextProgress = finishChapterBattle(progress, parsed.payload, message.result, message.progress);
        }
        writeChapterProgress(test.id, id, cursor.visit + 1, nextProgress);
        saveCheckpoint(test, id, cursor.visit + 1, nextProgress);
        setProgress(nextProgress);
        setCursor(previous => previous.visit === cursor.visit ? { id, visit: previous.visit + 1 } : previous);
      } catch (e) { setError(String(e)); }
    };
    window.addEventListener("message", receive); return () => window.removeEventListener("message", receive);
  }, [test, progress, cursor, stopped, error]);
  const node = test?.nodes.find(n => n.id === cursor.id);
  return <main style={{ position: "fixed", inset: 0, display: "flex", flexDirection: "column", background: "#15191b", color: "#e8e4d9", fontFamily: "system-ui" }}>
    <header style={{ display: "flex", flexWrap: "wrap", gap: 12, padding: 12, alignItems: "center", borderBottom: "1px solid #485047" }}>
      <strong>{test?.name ?? "챕터 테스트"}</strong><span>{node?.name} · {cursor.visit + 1}번째 단계</span>
      <a style={{ color: "#e6c680", marginLeft: "auto" }} href={test?.returnUrl ?? "/studio"}>Studio로 돌아가기</a>
      <button onClick={() => setStopped(true)} disabled={!node || node.kind === "end" || stopped}>테스트 중단</button>
    </header>
    <p style={{ margin: 0, padding: "6px 12px", fontSize: 13, color: "#b7beb7" }}>승리 후 성장·장비·남은 소모품을 이어받습니다. 병력·MP는 다음 전투에서 회복하며, 패배한 전투의 변화는 반영하지 않습니다.</p>
    {progress && <details style={{ padding: "6px 12px", fontSize: 13, borderBottom: "1px solid #485047" }}>
      <summary>테스트 로스터 {progress.joined.length}명 · 부대 창고 {progress.sharedItems.length}개</summary>
      <p>프로젝트의 {test?.chapterNumber ?? 1}번째 챕터까지 합류합니다. 출전 장수와 위치는 저작한 전투 배치를 사용합니다. 실제 게임 저장에는 반영되지 않습니다.</p>
      <div style={{ maxHeight: 130, overflow: "auto", display: "flex", flexWrap: "wrap", gap: 12 }}>{progress.joined.map(id => <span key={id}>{id} · {progress.units[id] ? `Lv.${progress.units[id]!.level} / 경험치 ${progress.units[id]!.exp} / 장비 ${progress.units[id]!.items.length}` : "합류 · 미출전"}</span>)}</div>
      {!!progress.departed.length && <p>이탈: {progress.departed.join(", ")}</p>}
    </details>}
    <p style={{ margin: 0, padding: "6px 12px", fontSize: 13, color: "#b7beb7" }}>단계 시작 시점에 자동저장합니다. 이어하기는 해당 전투·이야기 처음부터 시작합니다. 편집 전의 테스트 구성을 유지합니다.</p>
    {error || stopped || resume || node?.kind === "end" ? <section style={{ padding: 28 }}>
      <h1>{error ? "테스트를 계속할 수 없습니다" : resume ? "저장된 테스트가 있습니다" : stopped ? "테스트를 중단했습니다" : "챕터 테스트 완료"}</h1>
      {error && <p role="alert">{error}</p>}
      {!error && (resume || stopped) && test && <button onClick={() => {
        try {
          const saved = resume ?? { nodeId: cursor.id, visit: cursor.visit, progress: progress! };
          writeChapterProgress(test.id, saved.nodeId, saved.visit, saved.progress);
          setProgress(saved.progress); setCursor({ id: saved.nodeId, visit: saved.visit }); setResume(null); setStopped(false);
        } catch (e) { setError(String(e)); }
      }}>저장한 단계 이어하기</button>}
      {test && <button onClick={() => {
        try {
          const initial = initialChapterProgress(test);
          writeChapterProgress(test.id, test.entry, 0, initial);
          saveCheckpoint(test, test.entry, 0, initial);
          setProgress(initial); setResume(null); setError(""); setStopped(false); setCursor({ id: test.entry, visit: 0 });
        } catch (e) { setError(String(e)); }
      }}>처음부터 다시 테스트</button>}
    </section> : node && test ? <iframe ref={frame} key={`${cursor.id}:${cursor.visit}`} title={`${node.name} 플레이테스트`} style={{ width: "100%", flex: 1, border: 0, minHeight: 0 }} src={`/playtest?draft=${test.id}&chapterNode=${encodeURIComponent(node.id)}&visit=${cursor.visit}`} /> : <p style={{ padding: 24 }}>챕터 준비 중…</p>}
  </main>;
}
