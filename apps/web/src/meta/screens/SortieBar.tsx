"use client";
/**
 * SortieBar — /prep 하단 고정 바 (2026-07-03 레퍼런스 재구성).
 * 「출진 슬롯」 번호 칩(미니 초상 + ✕ 해제, 탭=상세 포커스) + 총전력/경고 + 붉은 판 「출정」 버튼.
 * 슬롯 칩은 상점 탭에서도 보인다(편성 상태 상시 확인) — 칩 탭 시 셸이 편성 탭으로 전환.
 */
import { gameData } from "@tk/data";
import type { SortieSummary } from "../sortieSummary";
import type { SortieMember } from "../sortie";
import { BUTTON_FRAME } from "../../battle/hud/frames";
import { CommanderPortrait } from "../../ui/CommanderPortrait";
import { GOLD, GOLD_DIM, SERIF } from "./formationUi";

const C = {
  bar: "rgba(12, 11, 8, 0.94)",
  text: "#e8e6e3",
  muted: "#9aa3ad",
  bronze: "#caa86a",
  warn: "#e86a4a",
};

export interface SortieBarProps {
  summary: SortieSummary;
  maxSlots: number;
  members: SortieMember[];
  onSortie: () => void;
  onRemove: (commanderId: string) => void;
  onFocus: (commanderId: string) => void;
}

export function SortieBar({
  summary, maxSlots, members, onSortie, onRemove, onFocus,
}: SortieBarProps): React.ReactElement {
  const { count, totalPower, warnings, emptyDefault } = summary;

  return (
    <div
      style={{
        // 보드 바로 아래 붙는 풋터(레퍼런스) — 종전엔 뷰포트 바닥에 sticky로 떨어져 있었다(2026-07-03).
        background: `linear-gradient(to bottom, ${C.bar}, rgba(8,7,5,0.97))`,
        border: `1px solid ${GOLD_DIM}88`,
        borderRadius: 8,
        boxShadow: "0 4px 16px rgba(0,0,0,0.35)",
        padding: "8px 14px",
        fontFamily: SERIF,
      }}
    >
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        flexWrap: "wrap",
      }}
    >
      {/* ── 출진 슬롯 칩 ── */}
      <span style={{
        fontSize: 10, fontWeight: 700, color: GOLD_DIM, letterSpacing: "0.18em",
        writingMode: "vertical-rl", textOrientation: "upright", flexShrink: 0, lineHeight: 1,
      }}>
        출진슬롯
      </span>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
        {Array.from({ length: maxSlots }, (_, i) => {
          const m = members[i];
          if (!m) {
            return (
              <div key={`empty-${i}`} style={{
                position: "relative", width: 40, height: 52, borderRadius: 5,
                border: `1.5px dashed ${GOLD_DIM}55`,
                background: "rgba(0,0,0,0.35)",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <span style={{ fontSize: 16, color: GOLD_DIM, opacity: 0.45, lineHeight: 1 }}>+</span>
                <span style={{
                  position: "absolute", top: 1, left: 3, fontSize: 8, color: GOLD_DIM, opacity: 0.6,
                }}>{i + 1}</span>
              </div>
            );
          }
          const name = gameData.commanders[m.commanderId]?.name ?? m.commanderId;
          return (
            <button
              key={m.commanderId}
              type="button"
              onClick={() => onFocus(m.commanderId)}
              title={name}
              style={{
                position: "relative", width: 40, height: 52, borderRadius: 5, padding: 0,
                border: `1.5px solid ${GOLD}aa`,
                overflow: "hidden", cursor: "pointer",
                background: "#171208",
                boxShadow: `inset 0 0 6px rgba(200,164,64,0.15)`,
              }}
            >
              <CommanderPortrait commanderId={m.commanderId} name={name} />
              {/* 번호 */}
              <span style={{
                position: "absolute", top: 0, left: 0, padding: "0 3px",
                fontSize: 8, fontWeight: 800, color: "#f0e2c8",
                background: "rgba(10,8,4,0.75)", borderBottomRightRadius: 4, lineHeight: "11px",
              }}>{i + 1}</span>
              {/* 해제 ✕ */}
              <span
                role="button"
                aria-label={`${name} 편성 해제`}
                onClick={(e) => { e.stopPropagation(); onRemove(m.commanderId); }}
                style={{
                  position: "absolute", top: 0, right: 0, padding: "0 3px",
                  fontSize: 9, color: "rgba(255,235,210,0.8)",
                  background: "rgba(10,8,4,0.75)", borderBottomLeftRadius: 4,
                  cursor: "pointer", lineHeight: "11px",
                }}
              >✕</span>
              {/* 이름 */}
              <span style={{
                position: "absolute", left: 0, right: 0, bottom: 0,
                fontSize: 8, fontWeight: 700, color: "#e8d9b0", textAlign: "center",
                background: "rgba(8,6,3,0.8)", lineHeight: "12px",
                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
              }}>{name}</span>
            </button>
          );
        })}
      </div>

      {/* ── 요약/경고 ── */}
      <span style={{ fontSize: 12, color: C.muted, flex: "1 1 auto", minWidth: 120 }}>
        출진{" "}
        <strong style={{ color: C.bronze, fontSize: 14 }}>
          {emptyDefault ? "기본" : `${count}/${maxSlots}`}
        </strong>
        {!emptyDefault && totalPower > 0 && (
          <span style={{ marginLeft: 8 }}>
            총전력 <strong style={{ color: C.text }}>{totalPower}</strong>
          </span>
        )}
        {warnings.length > 0 && (
          <span style={{ display: "block", fontSize: 11, color: C.warn, marginTop: 2 }}>
            ⚠ {warnings.join(" · ")}
          </span>
        )}
      </span>

      {/* ── 출정 — 붉은 판 + 청동 프레임 (항상 활성: sortie.ts 계약, 빈 편성=stage 기본값) ── */}
      <button
        type="button"
        onClick={onSortie}
        style={{
          ...BUTTON_FRAME,
          borderWidth: "12px 18px",
          padding: "8px 26px",
          fontSize: 19,
          fontWeight: 900,
          letterSpacing: "0.35em",
          textIndent: "0.35em",
          fontFamily: SERIF,
          color: "#f4e2b8",
          textShadow: "0 1px 3px rgba(0,0,0,0.8), 0 0 12px rgba(224,184,74,0.35)",
          background: "linear-gradient(to bottom, #8a2a1e, #5e1a10)",
          boxShadow: `inset 0 0 14px rgba(0,0,0,0.5), 0 0 16px rgba(200,164,64,0.18)`,
          cursor: "pointer",
          marginLeft: "auto",
          flexShrink: 0,
        }}
      >
        출정
      </button>
    </div>
    </div>
  );
}
