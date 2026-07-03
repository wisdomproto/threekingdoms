"use client";
/**
 * ScenePlayer (캠페인 루프 W1) — 막간 시나리오 씬(VN 톤). 풀스크린 배경 + 화자 초상 + 타자기 대사.
 *
 * 데이터 = stage.scenario.intro/outro(ScenarioScene). 전투 밖 컷신이라 엔진/결정론 무관(§2-1).
 * 진행: 탭/클릭 → 타자기 중이면 즉시 전체, 아니면 다음 줄. 마지막 줄 다음 → onComplete.
 * 스킵 버튼 → 즉시 onComplete. 배경/초상은 AssetImage(placeholder + 드롭-인).
 *
 * 씬 문법 v2 (서사 리듬 — "갑자기 전투" 해소):
 *  - speaker 없는 줄 = **내레이션** — 초상·화자명 없는 중앙 서술 박스(정세·이동·시간 경과).
 *  - line.bg = 그 줄부터 배경 전환(회의→행군→전장). 미지정 줄은 직전 배경 유지.
 */
import type { ScenarioScene } from "@tk/data";
import { AssetImage } from "../ui/AssetImage";
import { assetUrl } from "../assetUrl";
import { useTypewriter } from "./useTypewriter";
import { useState } from "react";

const PARCHMENT = "#e8dcc0";
const BRONZE_GOLD = "#cdab6e";
const BRONZE_DIM = "#8a7350";

const SIDE_COLOR: Record<string, string> = {
  player: "#9ec6ff",
  ally: "#ffc27a",
  enemy: "#ff9a9a",
};

export function ScenePlayer({
  scene,
  title,
  onComplete,
}: {
  scene: ScenarioScene;
  /** 상단 표시용(스테이지명 등). */
  title?: string;
  onComplete: () => void;
}): React.ReactElement {
  const [idx, setIdx] = useState(0);
  // 연속 탭 가드: 같은 렌더에 바인딩된 클릭 2발이 setIdx(i=>i+1)를 겹쳐 쌓으면 범위를 넘는다
  // (VN 씬은 연타가 기본 조작) — 인덱스를 항상 마지막 줄로 클램프.
  const line = scene.lines[Math.min(idx, scene.lines.length - 1)]!;
  const { shown, done, reveal } = useTypewriter(line.text);

  const advance = () => {
    if (!done) {
      reveal();
      return;
    }
    if (idx >= scene.lines.length - 1) {
      onComplete();
      return;
    }
    setIdx((i) => Math.min(i + 1, scene.lines.length - 1));
  };

  const isNarration = !line.speaker;
  const side = line.side ?? "player";
  const nameColor = SIDE_COLOR[side] ?? PARCHMENT;
  const portraitSrc = line.portraitId ? assetUrl(`/assets/ui/portraits/${line.portraitId}.webp`) : undefined;

  // 현재 배경 = 지금까지 지나온 줄 중 마지막 bg 지정(없으면 씬 기본). 전환 시 key 교체로 페이드 인.
  let currentBg = scene.bg;
  for (let i = 0; i <= idx; i++) {
    const b = scene.lines[i]?.bg;
    if (b) currentBg = b;
  }

  return (
    <div
      onClick={advance}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") advance();
      }}
      role="button"
      tabIndex={0}
      aria-label="대사 진행 (탭)"
      style={{
        position: "fixed",
        inset: 0,
        background: "#000",
        cursor: "pointer",
        userSelect: "none",
        overflow: "hidden",
        fontFamily: '"Noto Serif KR", "Nanum Myeongjo", serif',
      }}
    >
      {/* 배경 — line.bg 전환 시 key 교체로 짧은 페이드 인(장면 전환감) */}
      <div key={currentBg ?? "_none"} style={{ position: "absolute", inset: 0, animation: "tkBgIn 360ms ease-out both" }}>
        <AssetImage src={currentBg ? assetUrl(`/assets/scenes/${currentBg}.webp`) : undefined} kind="bg" label={title ?? "막간"} />
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg, rgba(0,0,0,0.25) 0%, rgba(0,0,0,0) 35%, rgba(0,0,0,0.55) 80%)" }} />
      </div>

      {/* 오프닝 페이드-인 — 검정에서 장면이 밝아온다(시네마틱 진입). 1회, 입력 비차단. */}
      <div aria-hidden style={{ position: "absolute", inset: 0, background: "#000", pointerEvents: "none", animation: "tkSceneIn 420ms ease-out both" }} />

      {/* 상단 타이틀 + 스킵 */}
      <div style={{ position: "absolute", top: "calc(12px + env(safe-area-inset-top))", left: 0, right: 0, display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0 16px" }}>
        <span style={{ color: BRONZE_DIM, fontSize: 13, letterSpacing: "0.15em" }}>{title}</span>
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onComplete(); }}
          style={{ background: "rgba(20,17,14,0.7)", color: BRONZE_GOLD, border: `1px solid ${BRONZE_DIM}`, borderRadius: 4, padding: "4px 12px", fontSize: 12, cursor: "pointer" }}
        >
          건너뛰기 ▶▶
        </button>
      </div>

      {/* 하단 대사/내레이션 박스 */}
      {isNarration ? (
        /* 내레이션 — 초상·화자명 없는 중앙 서술 박스 (먹빛, 상하 헤어라인) */
        <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, padding: "0 12px calc(40px + env(safe-area-inset-bottom))" }}>
          <div
            style={{
              maxWidth: 620,
              margin: "0 auto",
              background: "rgba(10,9,7,0.78)",
              borderTop: `1px solid ${BRONZE_DIM}`,
              borderBottom: `1px solid ${BRONZE_DIM}`,
              padding: "18px 22px",
              backdropFilter: "blur(2px)",
            }}
          >
            <div style={{ color: PARCHMENT, fontSize: 15.5, lineHeight: 1.85, textAlign: "center", letterSpacing: "0.02em" }}>
              {shown}
              {!done && <span style={{ color: BRONZE_GOLD, opacity: 0.7 }}>▍</span>}
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 8 }}>
              <span style={{ color: "#5a5142", fontSize: 11 }}>{idx + 1} / {scene.lines.length}</span>
              {done && <span style={{ color: BRONZE_GOLD, fontSize: 14, animation: "tkBlink 1.1s ease-in-out infinite" }}>▼</span>}
            </div>
          </div>
        </div>
      ) : (
        <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, padding: "0 12px calc(20px + env(safe-area-inset-bottom))" }}>
          <div style={{ maxWidth: 760, margin: "0 auto", display: "flex", alignItems: "flex-end", gap: 12 }}>
            {/* 화자 초상 */}
            <div style={{ width: 96, height: 116, flexShrink: 0 }}>
              <AssetImage src={portraitSrc} kind="portrait" label={line.speaker ?? ""} side={side} />
            </div>
            {/* 텍스트 패널 */}
            <div
              style={{
                flex: 1,
                minHeight: 116,
                background: "rgba(16,14,10,0.86)",
                border: `1px solid ${BRONZE_DIM}`,
                borderRadius: 8,
                padding: "12px 16px 14px",
                backdropFilter: "blur(2px)",
              }}
            >
              <div style={{ color: nameColor, fontWeight: 700, fontSize: 16, marginBottom: 6, letterSpacing: "0.04em" }}>
                {line.speaker}
              </div>
              <div style={{ color: PARCHMENT, fontSize: 16, lineHeight: 1.65, minHeight: 52 }}>
                {shown}
                {!done && <span style={{ color: BRONZE_GOLD, opacity: 0.7 }}>▍</span>}
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 6 }}>
                <span style={{ color: "#5a5142", fontSize: 11 }}>{idx + 1} / {scene.lines.length}</span>
                {done && <span style={{ color: BRONZE_GOLD, fontSize: 14, animation: "tkBlink 1.1s ease-in-out infinite" }}>▼</span>}
              </div>
            </div>
          </div>
        </div>
      )}
      <style>{`@keyframes tkBlink { 0%,100% { opacity: 0.3 } 50% { opacity: 1 } } @keyframes tkSceneIn { from { opacity: 1 } to { opacity: 0 } } @keyframes tkBgIn { from { opacity: 0.25 } to { opacity: 1 } }`}</style>
    </div>
  );
}
