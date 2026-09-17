"use client";
import { installAssetBindings } from "../studio/asset-bindings";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { installGame } from "./data";

/** Keep a running game's data fixed. A full game visit synchronizes saved authoring changes. */
export function GameGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const editing = pathname === "/studio-login" || /^\/(studio|motion-editor|battle-motion-preview|game|lab|playtest|troia)(\/|$)/.test(pathname);
  const [ready, setReady] = useState((process.env.NODE_ENV !== "development" && process.env.NEXT_PUBLIC_HOSTED_STUDIO !== "1"));
  const [error, setError] = useState("");
  const [warning, setWarning] = useState("");
  useEffect(() => {
    if ((process.env.NODE_ENV !== "development" && process.env.NEXT_PUBLIC_HOSTED_STUDIO !== "1") || editing || ready) return;
    let cancelled = false;
    async function load() {
      const query = new URLSearchParams(location.search);
      let version = "";
      if (pathname === "/battle" && query.get("resume") === "1") {
        try { version = JSON.parse(localStorage.getItem("tk.battle.suspend.v1") ?? "null")?.gameVersion ?? ""; } catch {}
      }
      const response = await fetch(`/api/game${version ? `?version=${encodeURIComponent(version)}` : ""}`, { cache:"no-store" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "게임 데이터를 불러오지 못했습니다.");
      if (cancelled) return;
      installGame(result.snapshot);
      if(query.get("stage")==="__lab") { try { installAssetBindings(JSON.parse(sessionStorage.getItem("tk.lab") ?? "null")?.assetBindings); } catch { installAssetBindings(); } }
      setWarning(result.warning ?? ""); setReady(true);
    }
    void load().catch(e => { if (!cancelled) setError(String(e)); });
    return () => { cancelled = true; };
  }, [editing, pathname, ready]);
  if (editing) return <>{children}</>;
  if (!ready) return <main style={{padding:40,background:"#171912",color:"#eadcb6",minHeight:"100vh"}}><p role="status">{error || "게임 데이터를 동기화하고 있습니다…"}</p>{error && <button onClick={() => location.reload()}>다시 시도</button>}</main>;
  return <>{warning && <div role="alert" style={{padding:12,background:"#513c19",color:"#fff0ca"}}>{warning}</div>}{children}</>;
}
