"use client";
/**
 * UnitPanel (설계 §2.3) — 선택/조회 중인 유닛 정보 패널.
 * 순수 표시 컴포넌트: settled 기반 BattleVM + InputState만 받아 그린다 (스토어 직접 접근 금지).
 * 표시 대상: selected/postMoveMenu/targetSelect의 unitId, idle의 inspectedId.
 */
import type { InputState } from "../inputMachine";
import type { BattleVM, UnitVM } from "../viewmodel";
import { PANEL_FRAME, PORTRAIT_FRAME } from "./frames";

/** 초상 보유 장수 (apps/web/public/assets/ui/portraits/{name}.webp). 생기는 대로 추가 */
const PORTRAIT_IDS = new Set(["관우", "화웅"]);

/** 청동 초상 프레임 + 얼굴 (조조전 장수 정보 패널 §1) */
function PortraitBox({ name }: { name: string }): React.ReactElement {
  return (
    <div
      style={{
        ...PORTRAIT_FRAME,
        borderWidth: "15px 11px 15px 11px",
        width: 56,
        height: 70,
        flexShrink: 0,
        background: "#1a1712",
        backgroundClip: "padding-box",
      }}
    >
      <img
        src={`/assets/ui/portraits/${encodeURIComponent(name)}.webp`}
        alt={name}
        style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
      />
    </div>
  );
}

function activeUnitId(ui: InputState): string | null {
  switch (ui.kind) {
    case "idle":
      return ui.inspectedId ?? null;
    case "selected":
    case "postMoveMenu":
    case "targetSelect":
    case "strategyMenu":
    case "strategyTarget":
      return ui.unitId;
    default:
      return null;
  }
}

const PANEL_STYLE: React.CSSProperties = {
  position: "absolute",
  top: 44,
  left: 12,
  minWidth: 188,
  maxWidth: 240,
  padding: "2px 6px 4px",
  // 청동 프레임(border-image) + 가운데만 어둡게(padding-box) — 프레임 안쪽에 내용
  ...PANEL_FRAME,
  background: "rgba(16, 14, 10, 0.86)",
  backgroundClip: "padding-box",
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

/**
 * 능력치 막대 (조조전 장수 정보 패널 §1: 공격력/방어력/정신력 등) — 1~100 스케일.
 * 순발(민첩)·사기 막대는 엔진 미보유/고정값이라 생략 (sosoden-battle-ux-analysis §1).
 */
function StatBar({
  label,
  value,
  sub,
  color,
}: {
  label: string;
  value: number;
  sub?: number; // 장수 원값(무력/통솔/지력) — 괄호 표시 + 바 기준
  color: string;
}): React.ReactElement {
  // 바는 장수 원값(0~100)을 보여주고(강함 직관), 숫자는 실제 부대 능력치
  const ratio = Math.max(0, Math.min(1, (sub ?? value) / 100));
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, marginTop: 3 }}>
      <span style={{ width: 40, color: "#9aa3ad", flexShrink: 0 }}>{label}</span>
      <div style={{ flex: 1, height: 5, borderRadius: 3, background: "#2a2f36" }}>
        <div style={{ width: `${Math.round(ratio * 100)}%`, height: "100%", borderRadius: 3, background: color }} />
      </div>
      <span style={{ minWidth: 44, textAlign: "right", flexShrink: 0 }}>
        {value}
        {sub !== undefined ? <span style={{ color: "#6b727c", fontSize: 11 }}> ({sub})</span> : null}
      </span>
    </div>
  );
}

export function UnitPanel({ ui, vm }: { ui: InputState; vm: BattleVM }): React.ReactElement | null {
  const id = activeUnitId(ui);
  const unit = id ? (vm.units.find((u) => u.id === id) ?? null) : null;
  if (!unit) return null;
  return (
    <div style={PANEL_STYLE}>
      <div style={{ display: "flex", gap: 8 }}>
        {PORTRAIT_IDS.has(unit.name) ? <PortraitBox name={unit.name} /> : null}
        <div style={{ flex: 1, minWidth: 0 }}>
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
        </div>
      </div>
      <TroopsBar unit={unit} />
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginTop: 4 }}>
        <span>MP</span>
        <span>
          {unit.mp} / {unit.maxMp}
        </span>
      </div>
      <div style={{ marginTop: 6, borderTop: "1px solid #2a2f36", paddingTop: 6 }}>
        {/* 부대 능력치(전투 실값) — 괄호는 장수 원값 */}
        <StatBar label="공격력" value={unit.atk} sub={unit.warStat} color="#ff8a5c" />
        <StatBar label="방어력" value={unit.def} sub={unit.leadershipStat} color="#7aa7ff" />
        <StatBar label="정신력" value={unit.spirit} sub={unit.intelligenceStat} color="#b890ff" />
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginTop: 6, color: "#c7cdd4" }}>
        <span>
          이동 <strong>{unit.move}</strong> · 사거리 <strong>{unit.rangeMin === unit.rangeMax ? unit.rangeMax : `${unit.rangeMin}~${unit.rangeMax}`}</strong>
        </span>
      </div>
      <div style={{ fontSize: 12, marginTop: 2, color: "#9aa3ad" }}>
        지형 <span style={{ color: "#c7cdd4" }}>{unit.terrainName}</span>
        {unit.terrainGuard > 0 ? (
          <span style={{ color: "#7ad99a" }}> · 방어 +{Math.round(unit.terrainGuard * 100)}%</span>
        ) : null}
      </div>
    </div>
  );
}
