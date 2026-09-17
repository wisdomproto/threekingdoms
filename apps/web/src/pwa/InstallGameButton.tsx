"use client";
import { useEffect, useRef, useState } from "react";
import styles from "./install.module.css";
type InstallPrompt = Event & { prompt(): Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> };
export function InstallGameButton() {
  const prompt = useRef<InstallPrompt | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const [installed, setInstalled] = useState(false);
  const [busy, setBusy] = useState(false);
  const [ios, setIos] = useState(false);
  useEffect(() => {
    const display = matchMedia("(display-mode: standalone)");
    const sync = () => setInstalled(display.matches || !!(navigator as Navigator & { standalone?: boolean }).standalone);
    sync(); display.addEventListener("change", sync);
    setIos(/iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1));
    const capture = (event: Event) => { event.preventDefault(); prompt.current = event as InstallPrompt; };
    const done = () => { setInstalled(true); prompt.current = null; dialog.current?.close(); };
    window.addEventListener("beforeinstallprompt", capture);
    window.addEventListener("appinstalled", done);
    if ("serviceWorker" in navigator) void navigator.serviceWorker.register("/game-sw.js").catch(console.warn);
    return () => { display.removeEventListener("change", sync); window.removeEventListener("beforeinstallprompt", capture); window.removeEventListener("appinstalled", done); };
  }, []);
  async function install() {
    const event = prompt.current;
    if (!event) { dialog.current?.showModal(); return; }
    prompt.current = null; setBusy(true);
    try { await event.prompt(); await event.userChoice; }
    catch { dialog.current?.showModal(); }
    finally { setBusy(false); }
  }
  if (installed) return null;
  return <><button type="button" className={styles.install} disabled={busy} onClick={install}>↓ 홈 화면에 설치</button>
    <dialog ref={dialog} className={styles.dialog} aria-labelledby="install-title">
      <h2 id="install-title">홈 화면에 설치</h2>
      <p>{ios ? "브라우저의 공유 버튼을 누른 뒤 ‘홈 화면에 추가’를 선택하세요. 항목이 없다면 Safari에서 이 게임을 열어 주세요." : "브라우저 메뉴에서 ‘앱 설치’ 또는 ‘홈 화면에 추가’를 선택하세요. 메뉴가 없다면 Chrome이나 Edge에서 이 게임을 열어 주세요."}</p>
      <p>설치하면 이 게임을 홈 화면에서 바로 열 수 있습니다. 플레이에는 인터넷 연결이 필요합니다.</p>
      <form method="dialog"><button autoFocus>확인</button></form>
    </dialog></>;
}
