"use client";
/** 내레이션 — 초상·화자명 없는 중앙 서술 박스 (먹빛, 상하 헤어라인). */
import { PARCHMENT, BRONZE_GOLD, BRONZE_DIM, TK_BLINK_KEYFRAMES } from "./tokens";

export function NarrationPanel({
  shown,
  done,
  idx,
  total,
}: {
  /** 타자기 표시 중 텍스트. */
  shown: string;
  /** 타자기 완료 여부(캐럿 ▼ 표시). */
  done: boolean;
  /** 현재 줄 인덱스(0-base). */
  idx: number;
  /** 씬 전체 줄 수. */
  total: number;
}): React.ReactElement {
  return (
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
          <span style={{ color: "#5a5142", fontSize: 11 }}>{idx + 1} / {total}</span>
          {done && <span style={{ color: BRONZE_GOLD, fontSize: 14, animation: "tkBlink 1.1s ease-in-out infinite" }}>▼</span>}
        </div>
      </div>
      <style>{TK_BLINK_KEYFRAMES}</style>
    </div>
  );
}
