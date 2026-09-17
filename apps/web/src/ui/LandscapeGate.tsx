"use client";
import { useEffect, useState, type ReactNode } from "react";
import styles from "./LandscapeGate.module.css";

export function LandscapeGate({ children }: { children: ReactNode }) {
  const [portrait, setPortrait] = useState(false);
  const [busy, setBusy] = useState(false);
  const [manual, setManual] = useState(false);
  const [touch, setTouch] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  useEffect(() => {
    const query = matchMedia("(orientation: portrait) and (pointer: coarse)");
    const sync = () => { setPortrait(query.matches); setTouch(matchMedia("(pointer: coarse)").matches); setFullscreen(!!document.fullscreenElement || matchMedia("(display-mode: standalone)").matches); };
    sync(); query.addEventListener("change", sync);
    document.addEventListener("fullscreenchange", sync);
    return () => { query.removeEventListener("change", sync); document.removeEventListener("fullscreenchange", sync); screen.orientation?.unlock?.(); };
  }, []);
  async function enter() {
    setBusy(true);
    try {
      if (!document.fullscreenElement && document.documentElement.requestFullscreen) {
        await document.documentElement.requestFullscreen();
      }
      const orientation = screen.orientation as ScreenOrientation & { lock?: (value: string) => Promise<void> };
      if (!orientation?.lock) throw new Error("Orientation lock unavailable");
      await orientation.lock("landscape");
    } catch { setManual(true); }
    finally { setBusy(false); }
  }
  return <>
    <div style={{ display: "contents" }} inert={portrait || undefined}>{children}</div>
    {touch && !portrait && !fullscreen && <button className={styles.fullscreen} onClick={enter} disabled={busy}>⛶ 전체화면</button>}
    {manual && !portrait && !fullscreen && <p className={styles.hint} role="status">전체화면을 지원하지 않으면 홈 화면에 설치해 실행해 주세요.<button onClick={() => setManual(false)} aria-label="안내 닫기">×</button></p>}
    {portrait && <section className={styles.gate} role="dialog" aria-modal="true" aria-labelledby="landscape-title">
      <div className={styles.phone} aria-hidden="true">↻</div>
      <h1 id="landscape-title">가로 화면으로 즐겨 주세요</h1>
      <p>{manual ? "이 브라우저에서는 자동 회전이 지원되지 않습니다. 휴대폰의 자동 회전을 켜고 가로로 돌려 주세요." : "가로보기 버튼을 누르면 전체화면으로 전환합니다."}</p>
      <button onClick={enter} disabled={busy}>{busy ? "전환 중…" : "가로보기로 시작"}</button>
    </section>}
  </>;
}
