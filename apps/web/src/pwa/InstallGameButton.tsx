"use client";
import { useEffect, useRef, useState } from "react";
import styles from "./install.module.css";
type InstallPrompt = Event & { prompt(): Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> };
declare global { interface Window { __gameInstallPrompt?: InstallPrompt | null } }
export function InstallGameButton() {
  const [ready, setReady] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const [installed, setInstalled] = useState(false);
  const [busy, setBusy] = useState(false);
  const [ios, setIos] = useState(false);
  useEffect(() => {
    const display = matchMedia("(display-mode: standalone)");
    const sync = () => setInstalled(display.matches || !!(navigator as Navigator & { standalone?: boolean }).standalone);
    sync(); display.addEventListener("change", sync);
    setIos(/iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1));
    const capture = () => setReady(!!window.__gameInstallPrompt);
    capture();
    const done = () => { setInstalled(true); dialog.current?.close(); };
    window.addEventListener("game-install-ready", capture);
    window.addEventListener("appinstalled", done);
    if ("serviceWorker" in navigator) void navigator.serviceWorker.register("/game-sw.js").catch(console.warn);
    return () => { display.removeEventListener("change", sync); window.removeEventListener("game-install-ready", capture); window.removeEventListener("appinstalled", done); };
  }, []);
  async function install() {
    const event = window.__gameInstallPrompt;
    if (!event) { dialog.current?.showModal(); return; }
    window.__gameInstallPrompt = null; setReady(false); setBusy(true);
    try { await event.prompt(); await event.userChoice; }
    catch { dialog.current?.showModal(); }
    finally { setBusy(false); }
  }
  if (installed) return null;
  return <><button type="button" className={styles.install} disabled={busy} onClick={install}>↓ 홈 화면에 설치</button>
    <dialog ref={dialog} className={styles.dialog} aria-labelledby="install-title">
      <h2 id="install-title">홈 화면에 설치</h2>
      {ready ? <button type="button" disabled={busy} onClick={install}>설치창 열기</button> : <p>브라우저가 아직 설치창을 제공하지 않았습니다. 잠시 기다리면 설치 버튼이 나타날 수 있습니다.</p>}
      <p>{ios ? "브라우저의 공유 버튼을 누른 뒤 ‘홈 화면에 추가’를 선택하세요. 항목이 없다면 Safari에서 이 게임을 열어 주세요." : "브라우저 메뉴에서 ‘앱 설치’ 또는 ‘홈 화면에 추가’를 선택하세요. 메뉴가 없다면 Chrome이나 Edge에서 이 게임을 열어 주세요."}</p>
      <p>설치하면 이 게임을 홈 화면에서 바로 열 수 있습니다. 플레이에는 인터넷 연결이 필요합니다.</p>
      <form method="dialog"><button autoFocus>확인</button></form>
    </dialog></>;
}
