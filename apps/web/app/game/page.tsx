"use client";
import { useEffect, useState } from "react";

export default function GameLaunch() {
  const [error, setError] = useState("");
  useEffect(() => {
    let cancelled = false;
    async function launch() {
      const projectId = new URLSearchParams(location.search).get("project");
      if (!projectId) throw new Error("스튜디오에서 실행할 프로젝트를 선택해 주세요.");
      const response = await fetch("/api/studio/game", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({projectId}) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "게임 동기화에 실패했습니다.");
      if (!cancelled) location.replace("/");
    }
    void launch().catch(e => { if (!cancelled) setError(e.message); });
    return () => { cancelled = true; };
  }, []);
  return <main style={{padding:40,minHeight:"100vh",background:"#171912",color:"#eadcb6"}}>
    <h1>게임 실행</h1><p role="status">{error || "프로젝트를 동기화하고 게임을 준비합니다…"}</p>
    {error && <button onClick={() => history.back()}>스튜디오로 돌아가기</button>}
  </main>;
}
