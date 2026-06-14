"use client";
/**
 * TurnBanner (설계 §2.3) — 상단 턴/페이즈 표시 + 턴 종료 버튼.
 * 턴 종료 버튼은 idle(아군 페이즈, 진행 중)에만 노출하며 하단 우측 엄지 존에 둔다 —
 * ActionMenu(하단 중앙)와 동시에 보이는 상태가 없으므로 충돌 없음.
 */
import { useEffect, useRef, useState } from "react";
import type { Side } from "@tk/data";
import type { InputState, UiEvent } from "../inputMachine";
import type { BattleVM } from "../viewmodel";

const BAR_STYLE: React.CSSProperties = {
  position: "absolute",
  top: 0,
  left: 0,
  right: 0,
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  padding: "calc(10px + env(safe-area-inset-top)) 14px 10px", // 노치 기기 상단 안전 영역
  color: "#e8e6e3",
  fontSize: 15,
  background: "linear-gradient(rgba(10, 12, 15, 0.75), rgba(10, 12, 15, 0))",
  pointerEvents: "none",
  userSelect: "none",
};

const END_TURN_STYLE: React.CSSProperties = {
  position: "absolute",
  right: 12,
  bottom: "calc(12px + env(safe-area-inset-bottom))",
  minHeight: 56,
  minWidth: 104,
  padding: "0 18px",
  borderRadius: 14,
  border: "1px solid #3a414a",
  background: "rgba(24, 28, 33, 0.92)",
  color: "#e8e6e3",
  fontSize: 17,
  fontWeight: 600,
  cursor: "pointer",
  touchAction: "manipulation",
};

function phaseLabel(ui: InputState, vm: BattleVM): string {
  // enemyTurn ui 상태는 우군(ally)·적(enemy) 페이즈를 모두 덮으므로 settled phase로 구분 표시
  if (ui.kind === "enemyTurn") return vm.turn.phase === "ally" ? "우군 페이즈 진행 중…" : "적군 페이즈 진행 중…";
  if (ui.kind === "autoTurn") return "자동전투 진행 중…";
  if (ui.kind === "animating") return "…";
  return vm.turn.phase === "player" ? "아군 페이즈" : vm.turn.phase === "ally" ? "우군 페이즈" : "적군 페이즈";
}

/** 진영 색조 (§11 진영별 화면 색조): 아군 파랑 / 우군 주황 / 적 빨강 */
function phaseTint(phase: Side): string {
  return phase === "enemy" ? "#ff5a4d" : phase === "ally" ? "#ffa53d" : "#4da3ff";
}
function phaseBannerLabel(phase: Side, turn: number): string {
  return phase === "player" ? `아군 차례 — ${turn}턴`
    : phase === "ally" ? "우군 차례"
    : "적군 차례";
}

/** 풀스크린 페이즈 배너 키프레임 (1회 주입). 짧은 색조 스윕 — pointerEvents 없음(맵 가림 X) */
const BANNER_KEYFRAMES = `
@keyframes tk-phase-sweep {
  0%   { opacity: 0; transform: translateX(-12%); }
  18%  { opacity: 1; }
  78%  { opacity: 1; transform: translateX(0); }
  100% { opacity: 0; transform: translateX(12%); }
}
@keyframes tk-phase-fade { 0%,100% { opacity: 0; } 22%,72% { opacity: 1; } }`;

const PHASE_BANNER_MS = 900; // 짧은 코스메틱 — Pixi 페이즈 진행 게이팅과 독립(순수 표현)

/**
 * 페이즈 전환 시 짧은 풀스크린 와이드 배너 + 진영 색조 스윕 (§11).
 * vm.turn.phase 변화를 ref로 감지해 1회 재생 후 사라진다. 게임 상태 불변·pointerEvents 없음.
 * 배속(timeScale)은 React로 전달되지 않으므로 고정 길이의 짧은 연출로 둔다 —
 * 실제 페이즈 진행 게이팅은 Pixi/EventPlayer가 timeScale로 처리(여긴 그 위 덧칠).
 */
function PhaseFlash({ phase, turn, status }: { phase: Side; turn: number; status: BattleVM["status"] }): React.ReactElement | null {
  const prev = useRef<{ phase: Side; turn: number } | null>(null);
  const [shown, setShown] = useState<{ phase: Side; turn: number; key: number } | null>(null);
  const keyRef = useRef(0);

  useEffect(() => {
    const last = prev.current;
    prev.current = { phase, turn };
    if (status !== "ongoing") return; // 종료 시퀀스는 ResultSequence가 전담
    if (last && (last.phase !== phase || last.turn !== turn)) {
      keyRef.current += 1;
      setShown({ phase, turn, key: keyRef.current });
    }
  }, [phase, turn, status]);

  useEffect(() => {
    if (!shown) return;
    const id = window.setTimeout(() => setShown(null), PHASE_BANNER_MS);
    return () => window.clearTimeout(id);
  }, [shown]);

  if (!shown) return null;
  const tint = phaseTint(shown.phase);
  return (
    <div
      key={shown.key}
      aria-hidden
      style={{
        position: "absolute",
        inset: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        pointerEvents: "none",
        userSelect: "none",
        zIndex: 5,
        overflow: "hidden",
      }}
    >
      <style>{BANNER_KEYFRAMES}</style>
      {/* 진영 색조 풀스크린 틴트 (어두운 베이스 + 진영색 글로우) */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: `radial-gradient(120% 80% at 50% 50%, ${tint}33 0%, rgba(8,9,11,0.55) 70%)`,
          animation: `tk-phase-fade ${PHASE_BANNER_MS}ms ease-in-out both`,
        }}
      />
      {/* 와이드 배너 띠 */}
      <div
        style={{
          position: "relative",
          width: "100%",
          padding: "14px 0",
          textAlign: "center",
          background: `linear-gradient(90deg, transparent, ${tint}26 20%, ${tint}40 50%, ${tint}26 80%, transparent)`,
          borderTop: `2px solid ${tint}`,
          borderBottom: `2px solid ${tint}`,
          animation: `tk-phase-sweep ${PHASE_BANNER_MS}ms cubic-bezier(0.22,0.61,0.36,1) both`,
        }}
      >
        <span
          style={{
            fontSize: 30,
            fontWeight: 800,
            letterSpacing: 4,
            color: "#f5f3ef",
            textShadow: `0 0 10px ${tint}, 0 2px 4px rgba(0,0,0,0.8)`,
          }}
        >
          {phaseBannerLabel(shown.phase, shown.turn)}
        </span>
      </div>
    </div>
  );
}

export function TurnBanner({
  ui,
  vm,
  dispatch,
}: {
  ui: InputState;
  vm: BattleVM;
  dispatch: (e: UiEvent) => void;
}): React.ReactElement {
  const canEndTurn =
    ui.kind === "idle" && vm.turn.phase === "player" && vm.status === "ongoing";
  return (
    <>
      <PhaseFlash phase={vm.turn.phase} turn={vm.turn.turn} status={vm.status} />
      <div style={BAR_STYLE}>
        <strong>
          {vm.turn.turn}턴 <span style={{ color: "#9aa3ad" }}>/ {vm.turn.turnLimit}</span>
        </strong>
        <span style={{ color: vm.turn.phase === "player" ? "#4da3ff" : vm.turn.phase === "ally" ? "#ffa53d" : "#ff6b6b" }}>
          {phaseLabel(ui, vm)}
        </span>
      </div>
      {canEndTurn && (
        <button
          type="button"
          style={END_TURN_STYLE}
          onClick={() => dispatch({ type: "endTurnPressed" })}
        >
          턴 종료
        </button>
      )}
    </>
  );
}
