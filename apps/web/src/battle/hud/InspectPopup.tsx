"use client";
/**
 * InspectPopup (Tier 1-2, core-loop-gap-analysis.md §7-1 2계층 정보) —
 * 호버/탭 **조회** 중인 임의 유닛(적/행동완료 아군)의 작은 정보 팝업.
 * 이름·병종·HP(troops/maxTroops)·핵심 파생스탯(공격/방어/정신)을 압축 표시한다.
 *
 * 선택(내 활성 유닛 행동) 채널과 **독립**: store.inspectedId(순수 표현)만 읽고 inputMachine을
 * 건드리지 않는다. UnitPanel(좌상단, 선택/행동 중심)과 위치를 분리(우하단)해 동시 표시 충돌을 피한다.
 *
 * 위협범위(Tier 1-3)는 같은 inspectedId로 맵에 빨강 외곽으로 그려지므로, 이 팝업은 "이 적이 누구고
 * 얼마나 센가"의 텍스트 짝이다. pointerEvents:none — 맵 입력을 가리지 않는다.
 */
import type { BattleVM, UnitVM } from "../viewmodel";
import { PANEL_FRAME } from "./frames";

const PANEL_STYLE: React.CSSProperties = {
  position: "absolute",
  // 우하단 — 좌상단 UnitPanel·우상단 미니맵·좌중단 AttackForecast·하단중앙 ActionMenu를 모두 피한다
  right: 12,
  bottom: "calc(96px + env(safe-area-inset-bottom))",
  minWidth: 168,
  maxWidth: 220,
  padding: "2px 8px 6px",
  ...PANEL_FRAME,
  background: "rgba(16, 14, 10, 0.9)",
  backgroundClip: "padding-box",
  color: "#e8e6e3",
  fontSize: 13,
  lineHeight: 1.4,
  pointerEvents: "none", // 정보 전용 — 맵 탭/호버를 가리지 않는다
  userSelect: "none",
  zIndex: 5,
};

function MiniBar({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: string;
}): React.ReactElement {
  const ratio = Math.max(0, Math.min(1, value / 100));
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, marginTop: 2 }}>
      <span style={{ width: 34, color: "#9aa3ad", flexShrink: 0 }}>{label}</span>
      <div style={{ flex: 1, height: 4, borderRadius: 2, background: "#2a2f36" }}>
        <div style={{ width: `${Math.round(ratio * 100)}%`, height: "100%", borderRadius: 2, background: color }} />
      </div>
      <span style={{ minWidth: 24, textAlign: "right", flexShrink: 0, fontVariantNumeric: "tabular-nums" }}>
        {value}
      </span>
    </div>
  );
}

export function InspectPopup({
  inspectedId,
  activeId,
  vm,
}: {
  inspectedId: string | null;
  /** UnitPanel이 이미 보여주는 유닛(선택/탭). 같으면 중복이라 팝업을 숨긴다. */
  activeId: string | null;
  vm: BattleVM;
}): React.ReactElement | null {
  // UnitPanel과 같은 대상이면 중복 표시 회피 — 그 정보는 좌상단에 이미 있다.
  if (inspectedId && inspectedId === activeId) return null;
  const unit: UnitVM | null = inspectedId
    ? (vm.units.find((u) => u.id === inspectedId) ?? null)
    : null;
  if (!unit || unit.retreated) return null;

  const hpRatio = unit.maxTroops > 0 ? Math.max(0, unit.troops / unit.maxTroops) : 0;
  // 진영 라벨/색 (Tier 2-1): 아군 파랑 / 우군 주황 / 적 빨강.
  const sideLabel = unit.side === "enemy" ? "적군" : unit.side === "ally" ? "우군" : "아군";
  const sideColor = unit.side === "enemy" ? "#ff6b6b" : unit.side === "ally" ? "#ffa53d" : "#4da3ff";

  return (
    <div style={PANEL_STYLE}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
        <strong style={{ fontSize: 15 }}>{unit.name}</strong>
        <span style={{ color: sideColor, fontSize: 11 }}>
          {sideLabel}
        </span>
      </div>
      <div style={{ color: "#9aa3ad", fontSize: 11 }}>
        {unit.className} · Lv.{unit.level}
        {unit.acted ? " · 행동 완료" : ""}
      </div>
      {/* HP */}
      <div style={{ marginTop: 5 }}>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11 }}>
          <span>병력</span>
          <span style={{ fontVariantNumeric: "tabular-nums" }}>
            {unit.troops} / {unit.maxTroops}
          </span>
        </div>
        <div style={{ height: 5, borderRadius: 3, background: "#2a2f36", marginTop: 2 }}>
          <div
            style={{
              width: `${Math.round(hpRatio * 100)}%`,
              height: "100%",
              borderRadius: 3,
              background: sideColor,
            }}
          />
        </div>
      </div>
      {/* 핵심 파생스탯 */}
      <div style={{ marginTop: 5, borderTop: "1px solid #2a2f36", paddingTop: 4 }}>
        <MiniBar label="공격" value={unit.atk} color="#ff8a5c" />
        <MiniBar label="방어" value={unit.def} color="#7aa7ff" />
        <MiniBar label="정신" value={unit.spirit} color="#b890ff" />
      </div>
    </div>
  );
}
