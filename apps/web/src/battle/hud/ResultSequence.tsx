"use client";
/**
 * ResultSequence (설계 §10 평가 · §12 클리어 결산 시퀀스) — battleOver 종료 화면.
 *
 * 승리: 별 평가(S~C) → 보물 카드 → 자금 +gold → exp 바 채우기를 순차 등장 연출.
 *   등급/점수/보상은 resultSummary.buildResultSummary(순수)로 산출, 여기선 연출만.
 *   메타 반영(승리 1회): markCleared(stageId)로 클리어 기록(다음 전장 해금) + addGold로 자금
 *   누적을 metaStore에 일원화한다. metaStore는 legacy 'tk.meta.gold'에 mirror-write 하므로
 *   기존 addMetaGold/readMetaGold 경로와도 한 값을 공유한다. 또 clearSortie로 1회성 출진
 *   페이로드를 소비해 새로고침 시 stale 편성이 재적용되지 않게 한다.
 * 패배: 기존 패배 화면 유지(ResultOverlay와 동일 톤).
 *
 * battleOver 진입은 드레인 이후이므로 vm 수치는 최종 결과와 일치(스포일러 없음).
 * 청동 프레임/팔레트는 frames.ts·기존 ResultOverlay 재사용.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import type { Item, StageReward } from "@tk/data";
import type { InputState } from "../inputMachine";
import type { BattleVM } from "../viewmodel";
import { PANEL_FRAME, BUTTON_FRAME } from "./frames";
import { buildResultSummary } from "./resultSummary";
import { addGold, markCleared } from "../../meta/metaStore";
import { clearSortie } from "../../meta/sortie";

const OVERLAY_STYLE: React.CSSProperties = {
  position: "absolute",
  inset: 0,
  display: "flex",
  flexDirection: "column",
  justifyContent: "center",
  alignItems: "center",
  gap: 18,
  background: "rgba(8, 10, 13, 0.82)",
  color: "#e8e6e3",
  userSelect: "none",
  padding: 24,
};

const BUTTON_STYLE: React.CSSProperties = {
  minHeight: 56,
  minWidth: 150,
  padding: "0 24px",
  background: "rgba(24, 28, 33, 0.95)",
  color: "#e8e6e3",
  fontSize: 17,
  fontWeight: 600,
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  textDecoration: "none",
  ...BUTTON_FRAME,
};

const GRADE_COLOR: Record<string, string> = {
  S: "#ffd76a",
  A: "#ffce5a",
  B: "#cdd3da",
  C: "#9aa3ad",
};

/** 순차 등장 단계 — 한 칸씩 위로 올라오며 페이드 인 */
function Reveal({
  show,
  delay,
  children,
}: {
  show: boolean;
  delay: number;
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <div
      style={{
        opacity: show ? 1 : 0,
        transform: show ? "translateY(0)" : "translateY(12px)",
        transition: `opacity 320ms ease ${delay}ms, transform 320ms ease ${delay}ms`,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 12,
      }}
    >
      {children}
    </div>
  );
}

export function ResultSequence({
  ui,
  vm,
  reward,
  items,
  stageId,
}: {
  ui: InputState;
  vm: BattleVM;
  reward: StageReward | undefined;
  items: Record<string, Item>;
  /** 클리어 기록 대상 stageId(다음 전장 해금). 미지정이면 markCleared 생략. */
  stageId?: string;
}): React.ReactElement | null {
  const isOver = ui.kind === "battleOver";
  const victory = isOver && ui.result === "victory";

  // 결산 요약(승리 시에만 의미) — 순수 산출
  const summary = useMemo(
    () => (victory ? buildResultSummary(vm, reward, items) : null),
    [victory, vm, reward, items],
  );

  // 순차 연출 단계: 0=숨김 → 1=등급 → 2=보물 → 3=자금 → 4=exp바
  const [step, setStep] = useState(0);
  // exp 바 채움(0→1) — 트랜지션 트리거
  const [expFilled, setExpFilled] = useState(false);
  // 메타 반영(클리어 기록 + 자금 + 출진 소비)은 승리당 1회만.
  const metaCommitted = useRef(false);

  useEffect(() => {
    if (!victory || !summary) {
      setStep(0);
      setExpFilled(false);
      return;
    }
    if (!metaCommitted.current) {
      metaCommitted.current = true;
      addGold(summary.gold); // metaStore가 legacy tk.meta.gold에도 mirror — 결산 경로 일원화
      if (stageId) markCleared(stageId); // 다음 전장 해금
      clearSortie(); // 1회성 출진 페이로드 소비(새로고침 시 stale 편성 방지)
    }
    const timers: ReturnType<typeof setTimeout>[] = [];
    timers.push(setTimeout(() => setStep(1), 250));
    timers.push(setTimeout(() => setStep(2), 900));
    timers.push(setTimeout(() => setStep(3), 1500));
    timers.push(setTimeout(() => setStep(4), 2100));
    timers.push(setTimeout(() => setExpFilled(true), 2400));
    return () => {
      for (const t of timers) clearTimeout(t);
    };
  }, [victory, summary, stageId]);

  if (!isOver) return null;

  // ── 패배: 기존 패배 화면 유지 ──────────────────────────────────────────
  if (!victory || !summary) {
    return (
      <div style={OVERLAY_STYLE}>
        <h1 style={{ fontSize: 44, margin: 0, color: "#ff6b6b" }}>패배</h1>
        <p style={{ margin: 0, color: "#9aa3ad" }}>
          {vm.turn.turn}턴 · {vm.turn.turnLimit}턴 제한
        </p>
        <div style={{ display: "flex", gap: 12, marginTop: 8 }}>
          <button type="button" style={BUTTON_STYLE} onClick={() => window.location.reload()}>
            다시 도전
          </button>
          <a href="/stages" style={BUTTON_STYLE}>
            전장 선택
          </a>
        </div>
      </div>
    );
  }

  // ── 승리: 결산 시퀀스 ─────────────────────────────────────────────────
  const gradeColor = GRADE_COLOR[summary.grade] ?? "#e8e6e3";
  const expPct = summary.exp > 0 ? 100 : 0; // MVP: 획득 exp를 한 칸 게이지로 표현

  return (
    <div style={OVERLAY_STYLE}>
      <h1 style={{ fontSize: 40, margin: 0, color: "#ffd76a", letterSpacing: 2 }}>승리</h1>

      <div
        style={{
          ...PANEL_FRAME,
          background: "rgba(18, 21, 25, 0.92)",
          padding: "20px 28px",
          minWidth: 280,
          maxWidth: 360,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 16,
        }}
      >
        {/* 1. 등급 + 별 */}
        <Reveal show={step >= 1} delay={0}>
          <div style={{ display: "flex", gap: 6, fontSize: 34, lineHeight: 1 }}>
            {[0, 1, 2, 3].map((i) => (
              <span
                key={i}
                style={{
                  color: i < summary.stars ? gradeColor : "#3a414a",
                  transition: "color 220ms ease",
                  textShadow: i < summary.stars ? `0 0 8px ${gradeColor}66` : "none",
                }}
              >
                ★
              </span>
            ))}
          </div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
            <span style={{ fontSize: 40, fontWeight: 800, color: gradeColor }}>
              {summary.grade}
            </span>
            <span style={{ fontSize: 15, color: "#9aa3ad" }}>{summary.score}점</span>
          </div>
          <div style={{ fontSize: 12, color: "#9aa3ad" }}>
            {summary.turnsUsed}턴 / 제한 {summary.turnLimit}턴
            {summary.playerRetreats > 0 ? ` · 퇴각 ${summary.playerRetreats}` : ""}
          </div>
        </Reveal>

        {/* 2. 보물 카드 */}
        {summary.treasures.length > 0 && (
          <Reveal show={step >= 2} delay={0}>
            <div style={{ fontSize: 12, color: "#9aa3ad" }}>획득 보물</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "center" }}>
              {summary.treasures.map((t) => (
                <div
                  key={t.id}
                  style={{
                    padding: "8px 14px",
                    borderRadius: 10,
                    border: "1px solid #6a5a32",
                    background: "rgba(58, 48, 24, 0.6)",
                    color: "#ffd76a",
                    fontSize: 14,
                    fontWeight: 600,
                  }}
                >
                  {t.name}
                </div>
              ))}
            </div>
          </Reveal>
        )}

        {/* 3. 자금 */}
        <Reveal show={step >= 3} delay={0}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 18 }}>
            <span style={{ color: "#9aa3ad", fontSize: 13 }}>자금</span>
            <span style={{ color: "#ffd76a", fontWeight: 700 }}>+{summary.gold}</span>
          </div>
        </Reveal>

        {/* 4. 경험치 바 */}
        <Reveal show={step >= 4} delay={0}>
          <div style={{ width: 220 }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                fontSize: 12,
                color: "#9aa3ad",
                marginBottom: 4,
              }}
            >
              <span>경험치</span>
              <span>+{summary.exp}</span>
            </div>
            <div
              style={{
                height: 12,
                borderRadius: 6,
                background: "rgba(58, 65, 74, 0.7)",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  height: "100%",
                  width: `${expFilled ? expPct : 0}%`,
                  background: "linear-gradient(90deg, #6abf69, #9ee37d)",
                  transition: "width 700ms ease",
                }}
              />
            </div>
          </div>
        </Reveal>
      </div>

      <div style={{ display: "flex", gap: 12, marginTop: 4 }}>
        <button type="button" style={BUTTON_STYLE} onClick={() => window.location.reload()}>
          다시 도전
        </button>
        <a href="/stages" style={BUTTON_STYLE}>
          전장 선택
        </a>
      </div>
    </div>
  );
}
