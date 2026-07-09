"use client";
/** 막간 씬 배경 — AssetImage + 어둠 그라디언트 + 오프닝 페이드(tkSceneIn) + 배경 전환 페이드(tkBgIn). */
import { AssetImage } from "../../ui/AssetImage";
import { assetUrl } from "../../assetUrl";

export function SceneBackground({
  bg,
  title,
}: {
  /** 현재 배경 id (useSceneProgression.currentBg) — 없으면 placeholder. */
  bg?: string;
  /** placeholder 라벨용(스테이지명 등). */
  title?: string;
}): React.ReactElement {
  return (
    <>
      {/* 배경 — line.bg 전환 시 key 교체로 짧은 페이드 인(장면 전환감) */}
      <div key={bg ?? "_none"} style={{ position: "absolute", inset: 0, animation: "tkBgIn 360ms ease-out both" }}>
        <AssetImage src={bg ? assetUrl(`/assets/scenes/${bg}.webp`) : undefined} kind="bg" label={title ?? "막간"} />
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg, rgba(0,0,0,0.25) 0%, rgba(0,0,0,0) 35%, rgba(0,0,0,0.55) 80%)" }} />
      </div>

      {/* 오프닝 페이드-인 — 검정에서 장면이 밝아온다(시네마틱 진입). 1회, 입력 비차단. */}
      <div aria-hidden style={{ position: "absolute", inset: 0, background: "#000", pointerEvents: "none", animation: "tkSceneIn 420ms ease-out both" }} />
      <style>{`@keyframes tkSceneIn { from { opacity: 1 } to { opacity: 0 } } @keyframes tkBgIn { from { opacity: 0.25 } to { opacity: 1 } }`}</style>
    </>
  );
}
