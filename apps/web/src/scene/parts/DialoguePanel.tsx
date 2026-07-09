"use client";
/** 대사 패널 — 화자 초상 + 진영색 화자명 + 타자기 텍스트 박스. */
import type { ScenarioLine } from "@tk/data";
import { AssetImage } from "../../ui/AssetImage";
import { assetUrl } from "../../assetUrl";
import { PARCHMENT, BRONZE_GOLD, BRONZE_DIM, SIDE_COLOR, TK_BLINK_KEYFRAMES } from "./tokens";

export function DialoguePanel({
  line,
  shown,
  done,
  idx,
  total,
}: {
  /** 현재 줄(speaker/side/portraitId 참조). */
  line: ScenarioLine;
  /** 타자기 표시 중 텍스트. */
  shown: string;
  /** 타자기 완료 여부(캐럿 ▼ 표시). */
  done: boolean;
  /** 현재 줄 인덱스(0-base). */
  idx: number;
  /** 씬 전체 줄 수. */
  total: number;
}): React.ReactElement {
  const side = line.side ?? "player";
  const nameColor = SIDE_COLOR[side] ?? PARCHMENT;
  const portraitSrc = line.portraitId ? assetUrl(`/assets/ui/portraits/${line.portraitId}.webp`) : undefined;

  return (
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
            <span style={{ color: "#5a5142", fontSize: 11 }}>{idx + 1} / {total}</span>
            {done && <span style={{ color: BRONZE_GOLD, fontSize: 14, animation: "tkBlink 1.1s ease-in-out infinite" }}>▼</span>}
          </div>
        </div>
      </div>
      <style>{TK_BLINK_KEYFRAMES}</style>
    </div>
  );
}
