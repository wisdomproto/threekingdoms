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
import type { MenuAnchor } from "../store";
import { PANEL_FRAME } from "./frames";

const POPUP_W = 220; // maxWidth와 동치
const POPUP_H = 180; // 대략 높이(세로 클램프용 — 측정 없이 안전값)
const PAD = 12;
const EDGE = 8;

const PANEL_BASE: React.CSSProperties = {
  position: "absolute",
  minWidth: 168,
  maxWidth: POPUP_W,
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

/** 조회 유닛 옆 좌/우 플립 배치(§7-A "커서 위치에 따라 좌/우 자동 전환"). 화면 안 클램프. */
function placeInspect(anchor: MenuAnchor, viewport: { width: number; height: number }): { left: number; top: number } {
  const offset = anchor.half + PAD;
  let left = anchor.x + offset; // 기본 우측
  if (left + POPUP_W + EDGE > viewport.width) left = anchor.x - offset - POPUP_W; // 우측 초과 → 좌측
  left = Math.max(EDGE, Math.min(left, viewport.width - POPUP_W - EDGE));
  let top = anchor.y - POPUP_H / 2;
  top = Math.max(EDGE, Math.min(top, viewport.height - POPUP_H - EDGE));
  return { left, top };
}

/** 앵커 미수신 시 폴백 — 우하단 고정(종전 동작) */
const FIXED_CORNER: React.CSSProperties = {
  right: 12,
  bottom: "calc(96px + env(safe-area-inset-bottom))",
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
  anchor,
  viewport,
}: {
  inspectedId: string | null;
  /** UnitPanel이 이미 보여주는 유닛(선택/탭). 같으면 중복이라 팝업을 숨긴다. */
  activeId: string | null;
  vm: BattleVM;
  /** 조회 유닛 스크린 앵커 — 있으면 커서 옆 좌/우 플립 배치(§7-A). 없으면 우하단 고정 */
  anchor?: MenuAnchor | null;
  /** BattleScreen 컨테이너 크기 — 플립·클램프 기준 */
  viewport?: { width: number; height: number };
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
  const mpRatio = unit.maxMp > 0 ? Math.max(0, Math.min(1, unit.mp / unit.maxMp)) : 0;
  const spRatio = unit.maxSp > 0 ? Math.max(0, Math.min(1, unit.sp / unit.maxSp)) : 0;
  const spReady = unit.maxSp > 0 && unit.sp >= unit.maxSp;
  const guardPct = Math.round(unit.terrainGuard * 100);

  // 앵커+뷰포트 있으면 커서 옆 좌/우 플립 배치, 없으면 우하단 고정 폴백.
  const pos: React.CSSProperties =
    anchor && viewport ? placeInspect(anchor, viewport) : FIXED_CORNER;

  return (
    <div style={{ ...PANEL_BASE, ...pos }}>
      {/* §7-A "[미니초상] 이름 병종 Lv N" — 초상 미보유 시 진영색+이니셜 폴백 */}
      <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
        <div
          aria-hidden
          style={{
            width: 34,
            height: 34,
            flexShrink: 0,
            borderRadius: 5,
            border: `1.5px solid ${sideColor}`,
            background: "rgba(0, 0, 0, 0.35)",
            color: sideColor,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 18,
            fontWeight: 800,
          }}
        >
          {unit.name.slice(0, 1)}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
            <strong style={{ fontSize: 15 }}>{unit.name}</strong>
            <span style={{ color: sideColor, fontSize: 11 }}>{sideLabel}</span>
          </div>
          <div style={{ color: "#9aa3ad", fontSize: 11 }}>
            {unit.className} · Lv.{unit.level}
            {unit.acted ? " · 행동 완료" : ""}
          </div>
          {/* §7-A "지형명 보정%" 상시 노출 */}
          <div style={{ color: "#cdbd92", fontSize: 11 }}>
            {unit.terrainName}
            {guardPct > 0 ? <span style={{ color: "#7bd88f" }}> +{guardPct}%</span> : null}
          </div>
        </div>
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
      {/* MP (§7-A "⚑ MP 현재/최대 (노랑 바)") — MP 보유 병종만 */}
      {unit.maxMp > 0 && (
        <div style={{ marginTop: 4 }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11 }}>
            <span>책략</span>
            <span style={{ fontVariantNumeric: "tabular-nums" }}>
              {unit.mp} / {unit.maxMp}
            </span>
          </div>
          <div style={{ height: 5, borderRadius: 3, background: "#2a2f36", marginTop: 2 }}>
            <div
              style={{ width: `${Math.round(mpRatio * 100)}%`, height: "100%", borderRadius: 3, background: "#e8c84a" }}
            />
          </div>
        </div>
      )}
      {/* 필살 게이지 SP (§9 — 레퍼런스 ⚔0/255 파랑 바). 가득 차면 「필살 준비」 강조 */}
      {unit.maxSp > 0 && (
        <div style={{ marginTop: 4 }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11 }}>
            <span>필살 {spReady ? <span style={{ color: "#5ad7ff", fontWeight: 700 }}>준비!</span> : null}</span>
            <span style={{ fontVariantNumeric: "tabular-nums" }}>
              {unit.sp} / {unit.maxSp}
            </span>
          </div>
          <div style={{ height: 5, borderRadius: 3, background: "#2a2f36", marginTop: 2 }}>
            <div
              style={{
                width: `${Math.round(spRatio * 100)}%`,
                height: "100%",
                borderRadius: 3,
                background: spReady ? "#5ad7ff" : "#3a7bd5",
                boxShadow: spReady ? "0 0 6px #5ad7ff" : "none",
              }}
            />
          </div>
        </div>
      )}
      {/* 핵심 파생스탯 */}
      <div style={{ marginTop: 5, borderTop: "1px solid #2a2f36", paddingTop: 4 }}>
        <MiniBar label="공격" value={unit.atk} color="#ff8a5c" />
        <MiniBar label="방어" value={unit.def} color="#7aa7ff" />
        <MiniBar label="정신" value={unit.spirit} color="#b890ff" />
      </div>
    </div>
  );
}
