"use client";
/**
 * ResultSequence (설계 §10 평가 · §12 클리어 결산 시퀀스) — battleOver 종료 화면.
 *
 * 승리: 카지노식 도파민 시퀀스. 별 평가가 "탁탁" 펀치-인(등급별 차등, S=금빛 잭팟
 *   플래시) → 보물 상자 개봉(흔들→열림→아이템 튀어나옴) → 자금 숫자 카운트업 +
 *   코인 팝 → exp 바 차오름(+레벨업 팝). **연출만 카지노식이고 보상 내용물은 설계대로**
 *   — 등급/점수/gold/exp/보물은 전부 resultSummary.buildResultSummary(순수)에서 오며
 *   여기선 표현 강도(summary.fanfare)만 차등한다. 수치 조작 없음.
 *
 *   접근성/배속: 화면 어디든 탭/클릭하면 즉시 최종 상태로 스킵(skip). 시퀀스는 짧게.
 *   메타 반영(승리 1회): markCleared(stageId) + addGold(자금) + clearSortie(출진 소비).
 *   metaStore는 legacy 'tk.meta.gold'에 mirror-write 하므로 결산 경로가 일원화된다.
 * 패배: 기존 패배 화면 유지(ResultOverlay와 동일 톤).
 *
 * 연출 타이밍은 setTimeout 기반(시드 무관 표현 — 결정론 영향 없음). 코인 팝 위치는
 * 인덱스 기반 결정적 분포(난수 미사용)로, 같은 입력이면 같은 화면.
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
import { RewardedAdButton } from "../../meta/RewardedAdButton";

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
  overflow: "hidden",
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

/** 잭팟 골드 — S등급 플래시/글로우 액센트. */
const JACKPOT_GOLD = "#ffe08a";

// ── 시퀀스 스텝(누적 공개) ────────────────────────────────────────────────
// 0 숨김 → 1 별 펀치 시작 → 2 보물 → 3 자금(카운트업/코인) → 4 exp바/레벨업
const STEP = { HIDDEN: 0, STARS: 1, TREASURE: 2, GOLD: 3, EXP: 4 } as const;
const FINAL_STEP = STEP.EXP;

// 스텝별 진입 시각(ms). 스킵하면 전부 즉시 최종.
const AT_STARS = 260;
const AT_TREASURE = 1050;
const AT_GOLD = 1750;
const AT_EXP = 2450;
// 별 한 칸씩 "탁" 꽂히는 간격(ms).
const STAR_STAGGER = 240;
// 자금 카운트업 지속(ms).
const GOLD_ROLLUP_MS = 700;

/** 시퀀스 keyframes/유틸 클래스 — 컴포넌트 1회 마운트당 1개만 주입. */
const KEYFRAME_CSS = `
@keyframes tkStarPunch {
  0%   { transform: scale(2.4) rotate(-18deg); opacity: 0; }
  55%  { transform: scale(0.82) rotate(4deg); opacity: 1; }
  78%  { transform: scale(1.12) rotate(-2deg); }
  100% { transform: scale(1) rotate(0deg); opacity: 1; }
}
@keyframes tkJackpotFlash {
  0%   { opacity: 0; }
  12%  { opacity: 0.85; }
  100% { opacity: 0; }
}
@keyframes tkGradeStamp {
  0%   { transform: scale(2.2); opacity: 0; letter-spacing: 18px; }
  60%  { transform: scale(0.9); opacity: 1; letter-spacing: 2px; }
  100% { transform: scale(1); opacity: 1; letter-spacing: 1px; }
}
@keyframes tkChestShake {
  0%, 100% { transform: translateX(0) rotate(0deg); }
  20% { transform: translateX(-3px) rotate(-3deg); }
  40% { transform: translateX(3px) rotate(3deg); }
  60% { transform: translateX(-2px) rotate(-2deg); }
  80% { transform: translateX(2px) rotate(2deg); }
}
@keyframes tkChestOpen {
  0% { transform: scale(0.8); opacity: 0.4; }
  60% { transform: scale(1.18); opacity: 1; }
  100% { transform: scale(1); opacity: 1; }
}
@keyframes tkItemPop {
  0%   { transform: translateY(10px) scale(0.4); opacity: 0; }
  55%  { transform: translateY(-6px) scale(1.15); opacity: 1; }
  100% { transform: translateY(0) scale(1); opacity: 1; }
}
@keyframes tkCoinPop {
  0%   { transform: translate(0, 0) scale(0.5); opacity: 0; }
  20%  { opacity: 1; }
  100% { transform: translate(var(--dx), var(--dy)) scale(1); opacity: 0; }
}
@keyframes tkLevelUp {
  0%   { transform: translateY(8px) scale(0.6); opacity: 0; }
  45%  { transform: translateY(-4px) scale(1.2); opacity: 1; }
  70%  { transform: translateY(0) scale(0.96); }
  100% { transform: translateY(0) scale(1); opacity: 1; }
}
@keyframes tkPulseGlow {
  0%, 100% { filter: drop-shadow(0 0 6px var(--glow)); }
  50% { filter: drop-shadow(0 0 16px var(--glow)); }
}
`;

/** 순차 등장 단계 — 한 칸씩 위로 올라오며 페이드 인(스킵 시 즉시). */
function Reveal({
  show,
  children,
}: {
  show: boolean;
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <div
      style={{
        opacity: show ? 1 : 0,
        transform: show ? "translateY(0)" : "translateY(12px)",
        transition: "opacity 300ms ease, transform 300ms ease",
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

/** 코인 팝 — 자금 공개 시 결정적 분포로 흩뿌린다(난수 없음). */
function CoinBurst({ count, gold }: { count: number; gold: string }): React.ReactElement {
  // 인덱스로 각도/거리/지연을 결정 — 시드 무관 동일 화면.
  const coins = Array.from({ length: count }, (_, i) => {
    const angle = (i / Math.max(1, count)) * Math.PI * 2 + (i % 2 ? 0.4 : 0);
    const dist = 34 + (i % 4) * 12;
    const dx = Math.cos(angle) * dist;
    const dy = Math.sin(angle) * dist - 10; // 살짝 위로 튀게
    const delay = (i % 6) * 45;
    return { dx, dy, delay, key: i };
  });
  return (
    <div
      aria-hidden
      style={{
        position: "absolute",
        left: "50%",
        top: "50%",
        width: 0,
        height: 0,
        pointerEvents: "none",
      }}
    >
      {coins.map((c) => (
        <span
          key={c.key}
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            width: 12,
            height: 12,
            marginLeft: -6,
            marginTop: -6,
            borderRadius: "50%",
            background: `radial-gradient(circle at 35% 30%, ${gold}, #b8860b)`,
            boxShadow: `0 0 6px ${gold}aa`,
            ["--dx" as string]: `${c.dx}px`,
            ["--dy" as string]: `${c.dy}px`,
            animation: `tkCoinPop 720ms ease-out ${c.delay}ms both`,
          }}
        />
      ))}
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

  // 순차 연출 단계.
  const [step, setStep] = useState<number>(STEP.HIDDEN);
  // 별 펀치-인 진행 칸수(0..stars). STEP.STARS 진입 후 STAR_STAGGER 간격.
  const [starsShown, setStarsShown] = useState(0);
  // 자금 카운트업 표시값(0→gold).
  const [goldShown, setGoldShown] = useState(0);
  // exp 바 채움(0→1).
  const [expFilled, setExpFilled] = useState(false);
  // 잭팟 플래시 1회 트리거.
  const [flash, setFlash] = useState(false);
  // 스킵되면 즉시 최종 상태로 고정.
  const [skipped, setSkipped] = useState(false);
  // 결산 보상 2배(§12/§13 result_double) — 광고 완주 시 1회만. 표시 자금을 2배로 재연출.
  const [doubled, setDoubled] = useState(false);
  // 2배 재연출용 자금 카운트업 rAF 핸들(언마운트/스킵 시 취소).
  const doubleRafRef = useRef<number | null>(null);
  // 메타 반영(클리어 기록 + 자금 + 출진 소비)은 승리당 1회만.
  const metaCommitted = useRef(false);
  // 자금 카운트업 rAF 핸들(언마운트/스킵 시 취소).
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (!victory || !summary) {
      setStep(STEP.HIDDEN);
      setStarsShown(0);
      setGoldShown(0);
      setExpFilled(false);
      setFlash(false);
      setSkipped(false);
      setDoubled(false);
      return;
    }
    if (!metaCommitted.current) {
      metaCommitted.current = true;
      addGold(summary.gold); // metaStore가 legacy tk.meta.gold에도 mirror — 결산 경로 일원화
      if (stageId) markCleared(stageId); // 다음 전장 해금
      clearSortie(); // 1회성 출진 페이로드 소비(새로고침 시 stale 편성 방지)
    }

    const timers: ReturnType<typeof setTimeout>[] = [];
    const at = (ms: number, fn: () => void) => timers.push(setTimeout(fn, ms));

    // 스텝 공개
    at(AT_STARS, () => setStep(STEP.STARS));
    at(AT_TREASURE, () => setStep(STEP.TREASURE));
    at(AT_GOLD, () => setStep(STEP.GOLD));
    at(AT_EXP, () => setStep(STEP.EXP));

    // 별 한 칸씩 "탁탁" — 마지막 별에서 잭팟 플래시(S만).
    for (let i = 1; i <= summary.stars; i++) {
      at(AT_STARS + i * STAR_STAGGER, () => setStarsShown(i));
    }
    if (summary.fanfare.jackpot) {
      at(AT_STARS + summary.stars * STAR_STAGGER + 80, () => setFlash(true));
    }

    // 자금 카운트업(rAF roll-up) — GOLD 스텝 진입 직후 시작.
    if (summary.gold > 0) {
      at(AT_GOLD + 120, () => {
        const start = performance.now();
        const tick = (now: number) => {
          const t = Math.min(1, (now - start) / GOLD_ROLLUP_MS);
          // easeOutCubic — 막판 천천히 멈춰 "딸깍" 느낌.
          const eased = 1 - Math.pow(1 - t, 3);
          setGoldShown(Math.round(summary.gold * eased));
          if (t < 1) rafRef.current = requestAnimationFrame(tick);
        };
        rafRef.current = requestAnimationFrame(tick);
      });
    }

    // exp 바 채움.
    at(AT_EXP + 250, () => setExpFilled(true));

    return () => {
      for (const t of timers) clearTimeout(t);
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
      if (doubleRafRef.current != null) cancelAnimationFrame(doubleRafRef.current);
    };
  }, [victory, summary, stageId]);

  /**
   * 결산 보상 2배(result_double) — 광고 완주 콜백. **1회만**(doubled 가드).
   * 차액(baseGold)을 metaStore에 추가하고, 화면 자금 카운트업을 2배로 재연출 + 잭팟 플래시 1회.
   * 내용물 차등이 아니라 *설계된 보상의 2배 표현*(§12/§13) — 골드/표현만(전투력 랜덤 없음).
   */
  const onDoubleReward = () => {
    if (!summary || doubled) return;
    setDoubled(true);
    const baseGold = summary.gold;
    if (baseGold > 0) {
      addGold(baseGold); // 차액(=원래 획득액)을 메타에 누적 — 총 2배. legacy 키도 mirror.
      // 화면 자금: baseGold → 2*baseGold 카운트업 재연출(스킵돼 있어도 부드럽게 차오름).
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
      if (doubleRafRef.current != null) cancelAnimationFrame(doubleRafRef.current);
      const from = baseGold;
      const to = baseGold * 2;
      const start = performance.now();
      const tick = (now: number) => {
        const t = Math.min(1, (now - start) / GOLD_ROLLUP_MS);
        const eased = 1 - Math.pow(1 - t, 3);
        setGoldShown(Math.round(from + (to - from) * eased));
        if (t < 1) doubleRafRef.current = requestAnimationFrame(tick);
      };
      doubleRafRef.current = requestAnimationFrame(tick);
    }
    // 잭팟 플래시 1회(2배 잭팟 강조).
    setFlash(true);
  };

  // 스킵: 모든 연출을 즉시 최종 상태로. (탭/클릭/Enter/Space)
  const finish = () => {
    if (!summary) return;
    if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    setSkipped(true);
    setStep(FINAL_STEP);
    setStarsShown(summary.stars);
    setGoldShown(summary.gold);
    setExpFilled(true);
    setFlash(false);
  };

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
  const jackpot = summary.fanfare.jackpot;
  // 시퀀스가 아직 끝나지 않았으면 스킵 힌트 노출.
  const sequenceDone = skipped || (step >= FINAL_STEP && starsShown >= summary.stars);

  return (
    // 오버레이 전체가 스킵 영역(버튼 클릭은 stopPropagation으로 분리).
    <div
      style={{ ...OVERLAY_STYLE, cursor: sequenceDone ? "default" : "pointer" }}
      onClick={() => {
        if (!sequenceDone) finish();
      }}
      onKeyDown={(e) => {
        if ((e.key === "Enter" || e.key === " ") && !sequenceDone) finish();
      }}
      role="button"
      tabIndex={0}
      aria-label={sequenceDone ? "결산" : "탭하여 결산 건너뛰기"}
    >
      {/* keyframes 주입(1회) */}
      <style>{KEYFRAME_CSS}</style>

      {/* 잭팟 플래시(S) — 화면 전체 1회 번쩍 */}
      {flash && (
        <div
          aria-hidden
          style={{
            position: "absolute",
            inset: 0,
            background: `radial-gradient(circle at 50% 42%, ${JACKPOT_GOLD}, transparent 60%)`,
            animation: "tkJackpotFlash 600ms ease-out both",
            pointerEvents: "none",
          }}
        />
      )}

      <h1
        style={{
          fontSize: 40,
          margin: 0,
          color: jackpot ? JACKPOT_GOLD : "#ffd76a",
          letterSpacing: 2,
          textShadow: jackpot ? `0 0 18px ${JACKPOT_GOLD}88` : "none",
          animation: jackpot ? "tkPulseGlow 1.8s ease-in-out infinite" : "none",
          ["--glow" as string]: `${JACKPOT_GOLD}99`,
        }}
      >
        {jackpot ? "대승" : "승리"}
      </h1>

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
          position: "relative",
        }}
      >
        {/* 1. 등급 + 별 (한 칸씩 펀치-인) */}
        <Reveal show={step >= STEP.STARS}>
          <div style={{ display: "flex", gap: 6, fontSize: 34, lineHeight: 1 }}>
            {[0, 1, 2, 3].map((i) => {
              const filled = i < summary.stars;
              const punched = i < starsShown; // 이 별이 "꽂혔는지"
              const litColor = jackpot ? JACKPOT_GOLD : gradeColor;
              return (
                <span
                  key={i}
                  style={{
                    color: filled && punched ? litColor : "#3a414a",
                    display: "inline-block",
                    // 펀치-인: 꽂히는 순간 keyframe, 스킵 시 애니메이션 없이 즉시.
                    animation:
                      filled && punched && !skipped ? "tkStarPunch 360ms ease-out both" : "none",
                    textShadow:
                      filled && punched
                        ? `0 0 ${jackpot ? 14 : 8}px ${litColor}${jackpot ? "aa" : "66"}`
                        : "none",
                  }}
                >
                  ★
                </span>
              );
            })}
          </div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
            <span
              key={`grade-${starsShown >= summary.stars}`}
              style={{
                fontSize: 44,
                fontWeight: 800,
                color: jackpot ? JACKPOT_GOLD : gradeColor,
                // 마지막 별이 꽂힌 뒤 등급 스탬프.
                animation:
                  starsShown >= summary.stars && !skipped
                    ? "tkGradeStamp 420ms cubic-bezier(0.2,1.2,0.3,1) both"
                    : "none",
                textShadow: jackpot ? `0 0 16px ${JACKPOT_GOLD}aa` : "none",
              }}
            >
              {summary.grade}
            </span>
            <span style={{ fontSize: 15, color: "#9aa3ad" }}>{summary.score}점</span>
          </div>
          <div style={{ fontSize: 12, color: "#9aa3ad" }}>
            {summary.turnsUsed}턴 / 제한 {summary.turnLimit}턴
            {summary.playerRetreats > 0 ? ` · 퇴각 ${summary.playerRetreats}` : ""}
          </div>
        </Reveal>

        {/* 2. 보물 카드 — 상자 개봉(흔들→열림→팝) */}
        {summary.treasures.length > 0 && (
          <Reveal show={step >= STEP.TREASURE}>
            <div style={{ fontSize: 12, color: "#9aa3ad" }}>획득 보물</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 10, justifyContent: "center" }}>
              {summary.treasures.map((t, idx) => {
                const open = step >= STEP.TREASURE;
                return (
                  <div
                    key={t.id}
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      gap: 4,
                    }}
                  >
                    {/* 상자: 공개 직후 흔들→열림 */}
                    <div
                      aria-hidden
                      style={{
                        fontSize: 26,
                        lineHeight: 1,
                        animation:
                          open && !skipped
                            ? `tkChestShake 360ms ease-in-out ${idx * 140}ms both, tkChestOpen 320ms ease-out ${idx * 140 + 360}ms both`
                            : "none",
                      }}
                    >
                      🎁
                    </div>
                    {/* 아이템 칩: 상자 열린 뒤 튀어나옴 */}
                    <div
                      style={{
                        padding: "8px 14px",
                        borderRadius: 10,
                        border: `1px solid ${jackpot ? "#8a6a2a" : "#6a5a32"}`,
                        background: "rgba(58, 48, 24, 0.6)",
                        color: jackpot ? JACKPOT_GOLD : "#ffd76a",
                        fontSize: 14,
                        fontWeight: 600,
                        boxShadow: jackpot ? `0 0 10px ${JACKPOT_GOLD}44` : "none",
                        animation:
                          open && !skipped
                            ? `tkItemPop 360ms cubic-bezier(0.2,1.3,0.3,1) ${idx * 140 + 560}ms both`
                            : "none",
                      }}
                    >
                      {t.name}
                    </div>
                  </div>
                );
              })}
            </div>
          </Reveal>
        )}

        {/* 3. 자금 — 카운트업 + 코인 팝 */}
        <Reveal show={step >= STEP.GOLD}>
          <div
            style={{
              position: "relative",
              display: "flex",
              alignItems: "center",
              gap: 8,
              fontSize: 18,
            }}
          >
            {/* 코인 버스트(자금>0 & 스킵 안 됐을 때 1회) */}
            {step >= STEP.GOLD && !skipped && summary.fanfare.coinPops > 0 && (
              <CoinBurst count={summary.fanfare.coinPops} gold={jackpot ? JACKPOT_GOLD : "#ffd76a"} />
            )}
            <span style={{ color: "#9aa3ad", fontSize: 13 }}>자금</span>
            <span
              style={{
                color: jackpot ? JACKPOT_GOLD : "#ffd76a",
                fontWeight: 700,
                fontVariantNumeric: "tabular-nums",
                textShadow: jackpot ? `0 0 10px ${JACKPOT_GOLD}66` : "none",
              }}
            >
              +{(doubled ? goldShown : skipped ? summary.gold : goldShown).toLocaleString()}
            </span>
          </div>
        </Reveal>

        {/* 4. 경험치 바 (+레벨업 팝) */}
        <Reveal show={step >= STEP.EXP}>
          <div style={{ width: 220, position: "relative" }}>
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
                  transition: skipped ? "none" : "width 700ms ease",
                }}
              />
            </div>
          </div>
        </Reveal>
      </div>

      {/* 스킵 힌트 / 버튼: 시퀀스 끝나면 버튼, 아니면 힌트 */}
      {sequenceDone ? (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 12,
            marginTop: 4,
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* 결산 보상 2배(§12/§13) — 광고 완주 1회만. 누르면 사라짐. adFree면 버튼 자체 미표시. */}
          {!doubled && (
            <RewardedAdButton
              placement="result_double"
              label="광고 보고 보상 2배"
              onReward={onDoubleReward}
            />
          )}
          <div style={{ display: "flex", gap: 12 }}>
            <button type="button" style={BUTTON_STYLE} onClick={() => window.location.reload()}>
              다시 도전
            </button>
            <a href="/stages" style={BUTTON_STYLE}>
              전장 선택
            </a>
          </div>
        </div>
      ) : (
        <div style={{ fontSize: 12, color: "#7a828c", marginTop: 4 }}>탭하여 건너뛰기</div>
      )}
    </div>
  );
}
