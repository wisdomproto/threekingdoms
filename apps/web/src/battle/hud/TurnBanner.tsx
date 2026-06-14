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

/** 스테이지명 배지 (§5 "스테이지명 배지(좌)") — 상태 띠 좌측 청동 알약 */
const STAGE_BADGE_STYLE: React.CSSProperties = {
  padding: "2px 10px",
  borderRadius: 4,
  border: "1px solid #6f5a34",
  background: "rgba(20, 17, 12, 0.7)",
  color: "#e8d9b0",
  fontSize: 13,
  fontWeight: 700,
  letterSpacing: "0.04em",
  whiteSpace: "nowrap",
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

/**
 * 풀스크린 페이즈 배너의 진영 색조 — 레퍼런스 §11 충실 복제:
 *   "진영별 화면 색조 다름(적=청색조, 아군=흙/세피아조)".
 * 이건 *피아식별 색*(아군 파랑/적 빨강 — 미니맵·패널·하단 텍스트 라벨에서 유지)이 아니라
 * 페이즈 전체에 까는 **무드/온도 워시**다: 아군 차례=따뜻한 세피아(안전), 적 차례=차가운 청색조(위협).
 * → 온도 단서라 적 유닛(빨강 점)과 충돌하지 않는다. (ux-fidelity-checklist §11 #5)
 */
function phaseTint(phase: Side): string {
  return phase === "enemy"
    ? "#5f93c4" // 적 = 청색조(차가운 강철빛)
    : phase === "ally"
      ? "#d8b24a" // 우군 = 따뜻한 금빛
      : "#c2884c"; // 아군 = 흙/세피아조
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
  stageName,
}: {
  ui: InputState;
  vm: BattleVM;
  dispatch: (e: UiEvent) => void;
  /** 스테이지명 (§5 좌측 배지) — BattleScreen이 ctx.stage.name 전달 */
  stageName?: string;
}): React.ReactElement {
  const canEndTurn =
    ui.kind === "idle" && vm.turn.phase === "player" && vm.status === "ongoing";
  return (
    <>
      <PhaseFlash phase={vm.turn.phase} turn={vm.turn.turn} status={vm.status} />
      <div style={BAR_STYLE}>
        {/* 좌: 스테이지명 배지 + 턴 수 (§5 "스테이지명 배지(좌) / 턴 수(우)") */}
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {stageName ? <span style={STAGE_BADGE_STYLE}>{stageName}</span> : null}
          <strong>
            {vm.turn.turn}턴 <span style={{ color: "#9aa3ad" }}>/ {vm.turn.turnLimit}</span>
          </strong>
        </div>
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
