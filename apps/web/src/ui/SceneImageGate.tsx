"use client";
import { useEffect, useState, type ReactNode } from "react";
import { preloadImage, sceneImageUrls } from "./preloadImages";

export function ImageLoadingScreen({ failed = false, onRetry }: { failed?: boolean; onRetry?: () => void }) {
  return <div role="status" aria-live="polite" style={{position:"absolute",inset:0,zIndex:70,background:"#17140e",color:"#e6d1a4",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:16,fontSize:15}}>
    <span>{failed ? "이미지를 불러오지 못했습니다." : "배경과 캐릭터를 준비하고 있습니다…"}</span>
    {failed && <button onClick={onRetry} style={{padding:"12px 24px",background:"#765b2c",color:"#fff0c5",border:"1px solid #be9c57",borderRadius:6,fontSize:15}}>다시 불러오기</button>}
  </div>;
}

/** Mount the player only after image decoding, so timers and opening effects start together. */
export function SceneImageGate({ scene, children }: { scene: unknown; children: ReactNode }) {
  const key = JSON.stringify(sceneImageUrls(scene));
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState({key:"",ready:false,failed:false});
  useEffect(() => {
    let cancelled = false;
    setState({key,ready:false,failed:false});
    Promise.all((JSON.parse(key) as string[]).map(preloadImage)).then(() => {
      if (!cancelled) setState({key,ready:true,failed:false});
    }, error => { console.warn("[SceneImageGate]", error); if (!cancelled) setState({key,ready:false,failed:true}); });
    return () => { cancelled = true; };
  }, [key,attempt]);
  return state.key === key && state.ready ? <>{children}</> : <ImageLoadingScreen failed={state.key === key && state.failed} onRetry={() => setAttempt(n=>n+1)} />;
}
