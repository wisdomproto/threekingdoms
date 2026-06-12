"use client";
/**
 * UnitPanel (설계 §2.3) — 선택/조회 중인 유닛 정보 패널.
 * 순수 표시 컴포넌트: settled 기반 BattleVM + InputState만 받아 그린다 (스토어 직접 접근 금지).
 * 표시 대상: selected/postMoveMenu/targetSelect의 unitId, idle의 inspectedId.
 */
import type { InputState } from "../inputMachine";
import type { BattleVM, UnitVM } from "../viewmodel";

function activeUnitId(ui: InputState): string | null {
  switch (ui.kind) {
    case "idle":
      return ui.inspectedId ?? null;
    case "selected":
    case "postMoveMenu":
    case "targetSelect":
      return ui.unitId;
    default:
      return null;
  }
}

const PANEL_STYLE: React.CSSProperties = {
  position: "absolute",
  top: 56,
  left: 12,
  minWidth: 180,
  padding: "10px 12px",
  borderRadius: 10,
  background: "rgba(15, 18, 22, 0.85)",
  color: "#e8e6e3",
  fontSize: 14,
  lineHeight: 1.45,
  pointerEvents: "none", // 정보 전용 — 맵 탭을 가리지 않는다
  userSelect: "none",
};

function TroopsBar({ unit }: { unit: UnitVM }): React.ReactElement {
  const ratio = unit.maxTroops > 0 ? Math.max(0, unit.troops / unit.maxTroops) : 0;
  const color = unit.side === "player" ? "#4da3ff" : "#ff6b6b";
  return (
    <div style={{ marginTop: 6 }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
        <span>병력</span>
        <span>
          {unit.troops} / {unit.maxTroops}
        </span>
      </div>
      <div style={{ height: 6, borderRadius: 3, background: "#2a2f36", marginTop: 2 }}>
        <div
          style={{
            width: `${Math.round(ratio * 100)}%`,
            height: "100%",
            borderRadius: 3,
            background: color,
          }}
        />
      </div>
    </div>
  );
}

export function UnitPanel({ ui, vm }: { ui: InputState; vm: BattleVM }): React.ReactElement | null {
  const id = activeUnitId(ui);
  const unit = id ? (vm.units.find((u) => u.id === id) ?? null) : null;
  if (!unit) return null;
  return (
    <div style={PANEL_STYLE}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
        <strong style={{ fontSize: 16 }}>{unit.name}</strong>
        <span style={{ color: unit.side === "player" ? "#4da3ff" : "#ff6b6b" }}>
          {unit.side === "player" ? "아군" : "적군"}
        </span>
      </div>
      <div style={{ color: "#9aa3ad", fontSize: 12 }}>
        {unit.className} · Lv.{unit.level}
        {unit.acted ? " · 행동 완료" : ""}
        {unit.retreated ? " · 퇴각" : ""}
      </div>
      <TroopsBar unit={unit} />
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginTop: 4 }}>
        <span>MP</span>
        <span>
          {unit.mp} / {unit.maxMp}
        </span>
      </div>
    </div>
  );
}
