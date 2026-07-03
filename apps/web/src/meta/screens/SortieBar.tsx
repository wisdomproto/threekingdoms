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
  /** 「철회」 — 출진 편성 전체 해제(레퍼런스 툴바). */
  onClearAll: () => void;
}

// 출진 슬롯 칩 크기 — 40×52는 초상·글자가 안 보일 만큼 작았다(2026-07-03). 레퍼런스 카드 비례로 격상.
const SLOT_W = 60;
const SLOT_H = 82;

export function SortieBar({
  summary, maxSlots, members, onSortie, onRemove, onFocus, onClearAll,
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
        fontSize: 12, fontWeight: 700, color: GOLD, letterSpacing: "0.22em",
        writingMode: "vertical-rl", textOrientation: "upright", flexShrink: 0, lineHeight: 1.1,
      }}>
        출진슬롯
      </span>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        {Array.from({ length: maxSlots }, (_, i) => {
          const m = members[i];
          if (!m) {
            return (
              <div key={`empty-${i}`} style={{
                position: "relative", width: SLOT_W, height: SLOT_H, borderRadius: 6,
                border: `1.5px dashed ${GOLD_DIM}66`,
                background: "rgba(0,0,0,0.35)",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <span style={{ fontSize: 26, color: GOLD_DIM, opacity: 0.5, lineHeight: 1 }}>+</span>
                <span style={{
                  position: "absolute", top: 2, left: 5, fontSize: 11, fontWeight: 800,
                  color: GOLD_DIM, opacity: 0.7,
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
                position: "relative", width: SLOT_W, height: SLOT_H, borderRadius: 6, padding: 0,
                border: `2px solid ${GOLD}`,
                overflow: "hidden", cursor: "pointer",
                background: "#171208",
                boxShadow: `inset 0 0 8px rgba(200,164,64,0.18), 0 2px 8px rgba(0,0,0,0.4)`,
              }}
            >
              <CommanderPortrait commanderId={m.commanderId} name={name} />
              {/* 번호 */}
              <span style={{
                position: "absolute", top: 0, left: 0, padding: "1px 5px 2px",
                fontSize: 11, fontWeight: 800, color: "#f0e2c8",
                background: "rgba(10,8,4,0.8)", borderBottomRightRadius: 5, lineHeight: 1,
              }}>{i + 1}</span>
              {/* 해제 ✕ */}
              <span
                role="button"
                aria-label={`${name} 편성 해제`}
                onClick={(e) => { e.stopPropagation(); onRemove(m.commanderId); }}
                style={{
                  position: "absolute", top: 0, right: 0, padding: "1px 5px 3px",
                  fontSize: 13, color: "rgba(255,235,210,0.85)",
                  background: "rgba(10,8,4,0.8)", borderBottomLeftRadius: 5,
                  cursor: "pointer", lineHeight: 1,
                }}
              >✕</span>
              {/* 이름 */}
              <span style={{
                position: "absolute", left: 0, right: 0, bottom: 0,
                fontSize: 11, fontWeight: 700, color: "#f0e2c8", textAlign: "center",
                background: "rgba(8,6,3,0.85)", lineHeight: "17px",
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

      {/* ── 툴바: 철회 + 출정(레퍼런스 우측 클러스터) ── */}
      <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
        {!emptyDefault && count > 0 && (
          <button
            type="button"
            onClick={onClearAll}
            title="출진 편성 전체 해제"
            style={{
              padding: "9px 16px", borderRadius: 7, fontFamily: SERIF,
              border: `1px solid ${GOLD_DIM}`, background: "rgba(30,24,16,0.85)",
              color: "#c8b48a", fontSize: 14, fontWeight: 700, letterSpacing: "0.14em",
              cursor: "pointer", flexShrink: 0,
            }}
          >
            철회
          </button>
        )}
        {/* 출정 — 붉은 판 + 청동 프레임 (항상 활성: sortie.ts 계약, 빈 편성=stage 기본값) */}
        <button
          type="button"
          onClick={onSortie}
          style={{
            ...BUTTON_FRAME,
            borderWidth: "13px 20px",
            padding: "10px 40px",
            fontSize: 23,
            fontWeight: 900,
            letterSpacing: "0.4em",
            textIndent: "0.4em",
            fontFamily: SERIF,
            color: "#f6e6bc",
            textShadow: "0 1px 3px rgba(0,0,0,0.85), 0 0 14px rgba(224,184,74,0.45)",
            background: "linear-gradient(to bottom, #97301f, #5e1a10)",
            boxShadow: `inset 0 0 16px rgba(0,0,0,0.5), 0 0 20px rgba(200,164,64,0.25)`,
            cursor: "pointer",
            flexShrink: 0,
          }}
        >
          출정
        </button>
      </div>
    </div>
    </div>
  );
}
