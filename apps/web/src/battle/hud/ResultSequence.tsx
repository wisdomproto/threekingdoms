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
import { gameData } from "@tk/data";
import type { InputState } from "../inputMachine";
import type { BattleVM } from "../viewmodel";
import { PANEL_FRAME, BUTTON_FRAME } from "./frames";
import { buildResultSummary } from "./resultSummary";
import { addGold, markCleared, addItem, getMeta, addSerendipity, applyRosterProgress } from "../../meta/metaStore";
import { clearReward } from "../../meta/serendipity";
import { clearSortie } from "../../meta/sortie";
import { RewardedAdButton } from "../../meta/RewardedAdButton";
import { useFadeNav } from "../../ui/useFadeNav";
import { playSfx, SFX } from "../../audio";
import { ItemIcon } from "../../ui/ItemIcon";
import { ItemInfoPopup } from "../../ui/ItemInfoPopup";

const OVERLAY_STYLE: React.CSSProperties = {
  position: "absolute",
  inset: 0,
  display: "flex",
  flexDirection: "column",
  justifyContent: "center",
  alignItems: "center",
  gap: 18,
  // 웜 잉크 — 종전 한색 남빛(8,10,13)이 승리 화면을 "우울"하게 만들던 주범(2026-07-03 피드백)
  background: "rgba(12, 9, 6, 0.84)",
  color: "#ece5d4",
  userSelect: "none",
  padding: 24,
  overflow: "hidden",
  fontFamily: '"Noto Serif KR", "Nanum Myeongjo", "Apple SD Gothic Neo", serif',
};

const BUTTON_STYLE: React.CSSProperties = {
  minHeight: 56,
  minWidth: 150,
  padding: "0 24px",
  background: "rgba(30, 25, 16, 0.95)", // 웜 잉크(오버레이·카드와 통일)
  color: "#f0e7d0",
  fontSize: 17,
  fontWeight: 700,
  letterSpacing: "0.08em",
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  textDecoration: "none",
  fontFamily: "inherit",
  ...BUTTON_FRAME,
};

const GRADE_COLOR: Record<string, string> = {
  S: "#ffd76a",
  A: "#ffce5a",
  B: "#cdd3da",
  C: "#b3a78c",
};

/** 잭팟 골드 — S등급 플래시/글로우 액센트. */
const JACKPOT_GOLD = "#ffe08a";

/** 이탈 장수별 짧은 사연 — hardcode (§6: 서서·진등 2명) */
const DEPARTURE_FLAVOR: Record<string, string> = {
  서서: "조조의 위협에 어머니를 구하러 떠납니다.",
  진등: "서주의 뒤처리를 위해 이탈합니다.",
};

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
@keyframes tkRevealBurst {
  0%   { transform: scale(0.3); opacity: 0; }
  30%  { opacity: 1; }
  100% { transform: scale(1.6); opacity: 0; }
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
@keyframes tkRaysSpin {
  0%   { transform: translate(-50%, -50%) rotate(0deg); }
  100% { transform: translate(-50%, -50%) rotate(360deg); }
}
@keyframes tkTitleShine {
  0%   { transform: translateX(-130%) skewX(-18deg); }
  100% { transform: translateX(230%) skewX(-18deg); }
}
@keyframes tkPetalFall {
  0%   { transform: translateY(-6vh) translateX(0) rotate(0deg); opacity: 0; }
  8%   { opacity: var(--po); }
  50%  { transform: translateY(48vh) translateX(3vw) rotate(200deg); }
  92%  { opacity: var(--po); }
  100% { transform: translateY(104vh) translateX(-2vw) rotate(390deg); opacity: 0; }
}
`;

/** 승리 꽃가루(금빛 잔광) — 결정론 고정 배열(난수 없음). 순수 표현. */
const PETALS: { l: number; d: number; dur: number; s: number; o: number; c: string }[] = [
  { l: 6,  d: 0.0, dur: 7.2, s: 13, o: 0.8, c: "#ffd76a" },
  { l: 14, d: 2.1, dur: 8.4, s: 10, o: 0.55, c: "#e8b34a" },
  { l: 22, d: 0.9, dur: 6.6, s: 15, o: 0.75, c: "#ffe08a" },
  { l: 30, d: 3.4, dur: 9.0, s: 9,  o: 0.5, c: "#d98a3a" },
  { l: 38, d: 1.5, dur: 7.8, s: 12, o: 0.7, c: "#ffd76a" },
  { l: 46, d: 4.2, dur: 6.9, s: 11, o: 0.6, c: "#ffe9b0" },
  { l: 54, d: 0.4, dur: 8.8, s: 14, o: 0.8, c: "#f4c65a" },
  { l: 62, d: 2.8, dur: 7.4, s: 10, o: 0.55, c: "#e8b34a" },
  { l: 70, d: 1.1, dur: 6.4, s: 13, o: 0.75, c: "#ffd76a" },
  { l: 78, d: 3.9, dur: 8.1, s: 9,  o: 0.5, c: "#ffe08a" },
  { l: 86, d: 0.7, dur: 7.0, s: 12, o: 0.7, c: "#f4c65a" },
  { l: 94, d: 2.4, dur: 9.3, s: 11, o: 0.6, c: "#d98a3a" },
];

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
  sandbox = false,
}: {
  ui: InputState;
  vm: BattleVM;
  reward: StageReward | undefined;
  items: Record<string, Item>;
  /** 클리어 기록 대상 stageId(다음 전장 해금). 미지정이면 markCleared 생략. */
  stageId?: string;
  /**
   * 실험실(/lab) 샌드박스 — 결산 연출은 그대로 재생하되 **메타를 일절 쓰지 않는다**
   * (골드/레벨 영속/기연/클리어/보물 적립/광고 2배 전부 생략). 종료 내비게이션은 /lab 복귀.
   */
  sandbox?: boolean;
}): React.ReactElement | null {
  const isOver = ui.kind === "battleOver";
  const victory = isOver && ui.result === "victory";

  // 결산 요약(승리 시에만 의미) — 순수 산출
  const summary = useMemo(
    () => (victory ? buildResultSummary(vm, reward, items) : null),
    [victory, vm, reward, items],
  );

  // 캠페인 전환 — 결산→outro / 패배→outroDefeat 를 페이드-투-블랙 + SPA 라우팅으로(흰 깜빡 제거).
  const { fadeTo, overlay: fadeOverlay } = useFadeNav(stageId);

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
  // 기연 포인트 적립(§12) — 클리어 1회 산정값(표시용). 2배 시 갱신.
  const [serendipityPts, setSerendipityPts] = useState(0);
  // 2배 재연출에 쓸 기연 적립 베이스(원래 적립량). doubled 시 같은 양을 1회 더 적립.
  const serendipityBaseRef = useRef(0);
  // 결산 보상 2배(§12/§13 result_double) — 광고 완주 시 1회만. 표시 자금을 2배로 재연출.
  const [doubled, setDoubled] = useState(false);
  // 2배 재연출용 자금 카운트업 rAF 핸들(언마운트/스킵 시 취소).
  const doubleRafRef = useRef<number | null>(null);
  // 메타 반영(클리어 기록 + 자금 + 출진 소비)은 승리당 1회만.
  const metaCommitted = useRef(false);
  // markCleared 직전에 캡처한 이탈 장수 목록(결산 완료 후 알림 표시).
  const [departures, setDepartures] = useState<{ commanderId: string; items: string[] }[]>([]);
  // 자금 카운트업 rAF 핸들(언마운트/스킵 시 취소).
  const rafRef = useRef<number | null>(null);
  // 획득 보물 상세 팝업(2026-07-03 — 칩 탭 → 효과 풀이). 시퀀스 스킵 클릭과는 stopPropagation으로 분리.
  const [detailItemId, setDetailItemId] = useState<string | null>(null);

  useEffect(() => {
    if (!victory || !summary) {
      setStep(STEP.HIDDEN);
      setStarsShown(0);
      setGoldShown(0);
      setExpFilled(false);
      setFlash(false);
      setSkipped(false);
      setDoubled(false);
      setSerendipityPts(0);
      serendipityBaseRef.current = 0;
      return;
    }
    if (!sandbox && !metaCommitted.current) {
      metaCommitted.current = true;
      addGold(summary.gold); // metaStore가 legacy tk.meta.gold에도 mirror — 결산 경로 일원화
      // 아군 레벨/경험치 영속(§10) — 전투 후 final level/exp를 rosterProgress에 저장. 종전엔 누락돼
      //   레벨업이 다음 출진 화면에 반영 안 됐다(2026-06-28). 퇴각 아군도 진행 유지(다음 전투 복귀).
      applyRosterProgress(
        vm.units
          .filter((u) => u.side === "player")
          .map((u) => ({ commanderId: u.id, level: u.level, exp: u.exp })),
      );
      // 기연 포인트 적립(§12). 첫 클리어=등급 기반, 재도전=소액(파밍 방지) — markCleared 전에 판정.
      const firstClear = stageId ? !getMeta().clearedStages.includes(stageId) : true;
      const pts = clearReward(summary.grade, firstClear);
      serendipityBaseRef.current = pts;
      setSerendipityPts(pts);
      addSerendipity(pts);
      // markCleared 직전: 이탈 장수 캡처(reduceTriggerDepartures가 내부에서 실행됨).
      if (stageId) {
        const meta = getMeta();
        const pending: { commanderId: string; items: string[] }[] = [];
        for (const entry of Object.values(gameData.rosters)) {
          if (
            entry.departsAfterStage === stageId &&
            !meta.departedCharacters.includes(entry.commanderId)
          ) {
            const equipped = meta.rosterProgress[entry.commanderId]?.equipped ?? [];
            const itemNames = equipped.map((id) => gameData.items[id]?.name ?? id);
            pending.push({ commanderId: entry.commanderId, items: itemNames });
          }
        }
        if (pending.length > 0) setDepartures(pending);
        markCleared(stageId); // 다음 전장 해금 (+ 내부 이탈 처리)
      }
      // 획득 보물을 인벤토리에 적립 (편성 장착 + §10 보물 도감 수집 반영). 종전 누락 보완.
      for (const t of summary.treasures) addItem(t.id);
      clearSortie(); // 1회성 출진 페이로드 소비(새로고침 시 stale 편성 방지)
    }

    const timers: ReturnType<typeof setTimeout>[] = [];
    const at = (ms: number, fn: () => void) => timers.push(setTimeout(fn, ms));

    // 스텝 공개
    at(AT_STARS, () => setStep(STEP.STARS));
    at(AT_TREASURE, () => setStep(STEP.TREASURE));
    at(AT_GOLD, () => setStep(STEP.GOLD));
    at(AT_EXP, () => setStep(STEP.EXP));

    // 별 한 칸씩 "탁탁"(별 꽂힘음) — 마지막 별에서 잭팟 플래시(S만).
    for (let i = 1; i <= summary.stars; i++) {
      at(AT_STARS + i * STAR_STAGGER, () => {
        setStarsShown(i);
        playSfx(SFX.star);
      });
    }
    if (summary.fanfare.jackpot) {
      at(AT_STARS + summary.stars * STAR_STAGGER + 80, () => setFlash(true));
    }
    // 보물 상자 개봉음(보물 있을 때만).
    if (summary.treasures.length > 0) {
      at(AT_TREASURE + 120, () => playSfx(SFX.chest));
    }

    // 자금 카운트업(rAF roll-up) — GOLD 스텝 진입 직후 시작.
    if (summary.gold > 0) {
      at(AT_GOLD + 120, () => {
        playSfx(SFX.coin); // 자금 카운트업 시작음
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

    // exp 바 채움(+레벨업한 아군 있으면 레벨업 팡파레).
    at(AT_EXP + 250, () => {
      setExpFilled(true);
      if (summary.levelUps.length > 0) playSfx(SFX.levelup);
    });

    return () => {
      for (const t of timers) clearTimeout(t);
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
      if (doubleRafRef.current != null) cancelAnimationFrame(doubleRafRef.current);
    };
  }, [victory, summary, stageId, sandbox, vm.units]);

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
    // 기연 포인트도 2배(§12/§13 "골드·기연P 2배") — 베이스만큼 1회 더 적립.
    if (serendipityBaseRef.current > 0) {
      addSerendipity(serendipityBaseRef.current);
      setSerendipityPts(serendipityBaseRef.current * 2);
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

  // ── 패배: 캠페인 톤(수묵) + outroDefeat 씬으로 페이드 ──────────────────────
  if (!victory || !summary) {
    return (
      <div style={{ ...OVERLAY_STYLE, background: "radial-gradient(120% 90% at 50% 30%, #2a1416 0%, #0d0b09 85%)" }}>
        <h1 style={{ fontSize: 40, margin: 0, color: "#d9707a", letterSpacing: 4, fontFamily: '"Noto Serif KR", serif' }}>패 배</h1>
        <p style={{ margin: 0, color: "#8a7350", fontFamily: '"Noto Serif KR", serif' }}>
          {vm.turn.turn}턴 · {vm.turn.turnLimit}턴 제한
        </p>
        <div style={{ display: "flex", gap: 12, marginTop: 8 }}>
          <button type="button" style={BUTTON_STYLE} onClick={() => window.location.reload()}>
            다시 도전
          </button>
          {/* outroDefeat 씬으로(없으면 씬 가드가 전장 선택으로). 샌드박스=실험실 복귀. */}
          <button
            type="button"
            style={BUTTON_STYLE}
            onClick={() => fadeTo(sandbox ? "/lab" : stageId ? `/scene?stage=${stageId}&type=outroDefeat` : "/stages")}
          >
            {sandbox ? "실험실로 ▶" : "이야기 계속 ▶"}
          </button>
        </div>
        {fadeOverlay}
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

      {/* 승리 원광 — 카드 뒤 따뜻한 금빛 스포트라이트(상시). 축하 무드의 기둥. */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          background: `radial-gradient(85% 62% at 50% 36%, ${jackpot ? "rgba(255,224,138,0.30)" : "rgba(255,205,110,0.22)"} 0%, transparent 65%)`,
          pointerEvents: "none",
        }}
      />

      {/* 회전 서광(god-rays) — 패널 뒤 느린 금빛 광선. "우울" 정적의 해독제(2026-07-04). */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          left: "50%",
          top: "40%",
          width: "160vmax",
          height: "160vmax",
          pointerEvents: "none",
          opacity: jackpot ? 0.16 : 0.11,
          background:
            "repeating-conic-gradient(from 0deg, rgba(255,215,106,0.9) 0deg 7deg, transparent 7deg 24deg)",
          WebkitMaskImage: "radial-gradient(closest-side, #000 0%, transparent 68%)",
          maskImage: "radial-gradient(closest-side, #000 0%, transparent 68%)",
          animation: "tkRaysSpin 36s linear infinite",
        }}
      />

      {/* 금빛 꽃가루 — 승리 상시 잔광(결정론 배열, 순수 표현) */}
      <div aria-hidden style={{ position: "absolute", inset: 0, pointerEvents: "none", overflow: "hidden" }}>
        {PETALS.map((p, i) => (
          <span
            key={i}
            style={{
              position: "absolute",
              left: `${p.l}%`,
              top: 0,
              fontSize: p.s,
              color: p.c,
              textShadow: `0 0 6px ${p.c}88`,
              animation: `tkPetalFall ${p.dur}s linear ${p.d}s infinite`,
              ["--po" as string]: p.o,
            }}
          >
            ✦
          </span>
        ))}
      </div>

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

      {/* 표제 — 크게 + 샤인 스윕(금박이 훑고 지나가는 광). overflow 래퍼로 스윕을 가둔다. */}
      <div style={{ position: "relative", overflow: "hidden", padding: "4px 18px" }}>
        <h1
          style={{
            fontSize: 58,
            margin: 0,
            fontWeight: 900,
            color: jackpot ? JACKPOT_GOLD : "#ffd76a",
            letterSpacing: "0.22em",
            textIndent: "0.22em",
            lineHeight: 1.1,
            // 승리도 항상 금빛 발광 — 종전엔 잭팟(S)만 빛나 일반 승리가 밋밋했다
            textShadow: jackpot
              ? `0 0 24px ${JACKPOT_GOLD}aa, 0 3px 14px rgba(0,0,0,0.7)`
              : "0 0 18px rgba(255,215,106,0.6), 0 3px 12px rgba(0,0,0,0.65)",
            animation: jackpot ? "tkPulseGlow 1.8s ease-in-out infinite" : "none",
            ["--glow" as string]: `${JACKPOT_GOLD}99`,
          }}
        >
          {jackpot ? "대승" : "승리"}
        </h1>
        {!skipped && (
          <div
            aria-hidden
            style={{
              position: "absolute",
              top: 0,
              bottom: 0,
              left: 0,
              width: "45%",
              background:
                "linear-gradient(90deg, transparent, rgba(255,240,200,0.55), transparent)",
              mixBlendMode: "screen",
              animation: "tkTitleShine 2.6s ease-in-out 400ms infinite",
              pointerEvents: "none",
            }}
          />
        )}
      </div>

      <div
        style={{
          ...PANEL_FRAME,
          // 승리판 = 진홍→금 그라디언트(출정 버튼 붉은 판 계열) — 종전 암갈 단색 내부가
          // "거대한 어두운 상자"로 읽히던 우울의 본체(2026-07-04 재지적).
          background: jackpot
            ? "linear-gradient(168deg, rgba(96,32,18,0.94) 0%, rgba(64,40,14,0.94) 55%, rgba(46,28,12,0.95) 100%)"
            : "linear-gradient(168deg, rgba(78,28,16,0.93) 0%, rgba(52,34,14,0.94) 60%, rgba(40,26,12,0.95) 100%)",
          boxShadow: "inset 0 0 40px rgba(255,205,110,0.10)",
          padding: "18px 28px",
          minWidth: 300,
          maxWidth: 380,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 14,
          position: "relative",
        }}
      >
        {/* 1. 등급 + 별 (한 칸씩 펀치-인) */}
        <Reveal show={step >= STEP.STARS}>
          <div style={{ display: "flex", gap: 10, fontSize: 46, lineHeight: 1 }}>
            {[0, 1, 2, 3].map((i) => {
              const filled = i < summary.stars;
              const punched = i < starsShown; // 이 별이 "꽂혔는지"
              const litColor = jackpot ? JACKPOT_GOLD : gradeColor;
              return (
                <span
                  key={i}
                  style={{
                    color: filled && punched ? litColor : "#6a5638",
                    display: "inline-block",
                    // 펀치-인: 꽂히는 순간 keyframe, 스킵 시 애니메이션 없이 즉시.
                    animation:
                      filled && punched && !skipped ? "tkStarPunch 360ms ease-out both" : "none",
                    textShadow:
                      filled && punched
                        ? `0 0 ${jackpot ? 18 : 12}px ${litColor}${jackpot ? "aa" : "77"}`
                        : "none",
                    opacity: filled ? 1 : 0.45,
                  }}
                >
                  ★
                </span>
              );
            })}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 2 }}>
            {/* 등급 = 붉은 인장(도장 쾅) — 편성/씬의 인장 문법과 통일 */}
            <span
              key={`grade-${starsShown >= summary.stars}`}
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                width: 64,
                height: 64,
                borderRadius: 10,
                transform: "rotate(-4deg)",
                background: "linear-gradient(135deg, #9a2f1e, #641c10)",
                border: "2px solid rgba(0,0,0,0.45)",
                boxShadow: `0 4px 14px rgba(0,0,0,0.5), 0 0 ${jackpot ? 26 : 14}px ${jackpot ? JACKPOT_GOLD + "66" : "rgba(255,205,110,0.25)"}, inset 0 0 12px rgba(0,0,0,0.4)`,
                fontSize: 40,
                fontWeight: 900,
                color: jackpot ? JACKPOT_GOLD : "#ffe2a8",
                textShadow: "0 2px 6px rgba(0,0,0,0.7)",
                // 마지막 별이 꽂힌 뒤 등급 스탬프.
                animation:
                  starsShown >= summary.stars && !skipped
                    ? "tkGradeStamp 420ms cubic-bezier(0.2,1.2,0.3,1) both"
                    : "none",
              }}
            >
              {summary.grade}
            </span>
            <span style={{ fontSize: 17, color: "#e6d3ac", fontWeight: 700 }}>{summary.score}점</span>
          </div>
          <div
            style={{
              fontSize: 12,
              color: "#d8c49a",
              padding: "3px 14px",
              borderRadius: 12,
              border: "1px solid rgba(255,215,106,0.28)",
              background: "rgba(0,0,0,0.25)",
              marginTop: 2,
            }}
          >
            {summary.turnsUsed}턴 / 제한 {summary.turnLimit}턴
            {summary.playerRetreats > 0 ? ` · 퇴각 ${summary.playerRetreats}` : ""}
          </div>
        </Reveal>

        {/* 2. 보물 리빌 — 금빛 버스트 + 칩 팝(컬러 이모지 🎁 폐기 — HUD 글리프 규칙).
            칩 탭 = 상세 팝업(효과 풀이). 시퀀스 스킵 클릭과는 stopPropagation으로 분리. */}
        {summary.treasures.length > 0 && (
          <Reveal show={step >= STEP.TREASURE}>
            <div style={{ fontSize: 12, color: "#b3a78c" }}>획득 보물</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 10, justifyContent: "center" }}>
              {summary.treasures.map((t, idx) => {
                const open = step >= STEP.TREASURE;
                return (
                  <div key={t.id} style={{ position: "relative", display: "flex", justifyContent: "center" }}>
                    {/* 리빌 버스트 — 칩 등장 순간 뒤에서 금빛 원광이 퍼진다 */}
                    <div
                      aria-hidden
                      style={{
                        position: "absolute",
                        inset: -18,
                        borderRadius: "50%",
                        background: `radial-gradient(circle, ${jackpot ? JACKPOT_GOLD : "#ffd76a"}55, transparent 70%)`,
                        animation:
                          open && !skipped
                            ? `tkRevealBurst 700ms ease-out ${idx * 140 + 380}ms both`
                            : "none",
                        opacity: skipped ? 0 : undefined,
                        pointerEvents: "none",
                      }}
                    />
                    {/* 아이템 칩 — 탭하면 상세(효과 풀이) */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation(); // 오버레이 탭=스킵과 분리
                        setDetailItemId(t.id);
                      }}
                      title={`${t.name} — 자세히 보기`}
                      style={{
                        padding: "9px 16px",
                        borderRadius: 10,
                        border: `1px solid ${jackpot ? "#a8842a" : "#8a7342"}`,
                        background: "linear-gradient(180deg, rgba(74, 60, 28, 0.85), rgba(52, 42, 20, 0.85))",
                        color: jackpot ? JACKPOT_GOLD : "#ffdf8a",
                        fontSize: 14,
                        fontWeight: 700,
                        boxShadow: jackpot ? `0 0 12px ${JACKPOT_GOLD}55` : "0 0 8px rgba(255,215,106,0.25)",
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        cursor: "pointer",
                        fontFamily: "inherit",
                        animation:
                          open && !skipped
                            ? `tkItemPop 360ms cubic-bezier(0.2,1.3,0.3,1) ${idx * 140 + 560}ms both`
                            : "none",
                      }}
                    >
                      <ItemIcon itemId={t.id} category={gameData.items[t.id]?.category} size={34} />
                      {t.name}
                      <span aria-hidden style={{ fontSize: 11, color: jackpot ? "#c8a24a" : "#a8905a" }}>▸</span>
                    </button>
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
            <span style={{ color: "#b3a78c", fontSize: 13 }}>자금</span>
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
            <span style={{ color: "#8a7350", fontSize: 12 }}>金</span>
          </div>
          {/* 기연 포인트 적립(§12) — 막간 기연 뽑기 자원. 자금 줄 아래 한 줄. */}
          {serendipityPts > 0 && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, marginTop: 2 }}>
              <span style={{ color: "#b3a78c", fontSize: 13 }}>기연</span>
              <span style={{ color: "#b890ff", fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>
                +{serendipityPts}
              </span>
              <span style={{ color: "#6f6688", fontSize: 11 }}>奇緣</span>
            </div>
          )}
        </Reveal>

        {/* 4. 경험치 바 (+레벨업 팝) — exp는 스테이지 클리어 *보너스*(reward.exp)라 0이 기본.
            실제 성장 경험치는 전투 중 행동으로 이미 적립돼 레벨업 뱃지가 보여준다.
            0인데 "+0" 게이지를 그리면 버그처럼 읽혀(2026-07-03) 보너스가 있을 때만 표시. */}
        <Reveal show={step >= STEP.EXP}>
          {summary.exp > 0 && (
            <div style={{ width: 220, position: "relative" }}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  fontSize: 12,
                  color: "#b3a78c",
                  marginBottom: 4,
                }}
              >
                <span>보너스 경험치</span>
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
          )}
          {/* 레벨업 팝 뱃지 — 레벨업한 아군마다 한 칸씩 순차 등장 */}
          {summary.levelUps.length > 0 && (
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: 6,
                justifyContent: "center",
                marginTop: 8,
              }}
            >
              {summary.levelUps.map((lu, idx) => (
                <div
                  key={lu.unitId}
                  style={{
                    padding: "5px 10px",
                    borderRadius: 8,
                    background: "rgba(106, 191, 105, 0.18)",
                    border: "1px solid #6abf69aa",
                    color: "#9ee37d",
                    fontSize: 12,
                    fontWeight: 700,
                    display: "flex",
                    alignItems: "center",
                    gap: 5,
                    animation:
                      expFilled && !skipped
                        ? `tkLevelUp 420ms cubic-bezier(0.2,1.2,0.3,1) ${idx * 120}ms both`
                        : "none",
                  }}
                >
                  <span style={{ color: "#b3a78c", fontWeight: 400 }}>{lu.name}</span>
                  <span>Lv.{lu.newLevel}</span>
                  <span style={{ color: "#ffd76a", fontSize: 10 }}>▲</span>
                </div>
              ))}
            </div>
          )}
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
          {/* 이탈 장수 알림 카드 — markCleared 시 이탈 처리된 장수만 표시 */}
          {departures.map((dep) => (
            <div
              key={dep.commanderId}
              style={{
                ...PANEL_FRAME,
                background: "rgba(40, 24, 18, 0.92)",
                padding: "12px 18px",
                minWidth: 260,
                maxWidth: 340,
                display: "flex",
                flexDirection: "column",
                gap: 6,
                borderColor: "#8a503a",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 16 }}>⬡</span>
                <span style={{ fontSize: 15, fontWeight: 700, color: "#e8c9a0" }}>
                  {dep.commanderId} 이탈
                </span>
              </div>
              <div style={{ fontSize: 12, color: "#9a8070", lineHeight: 1.5 }}>
                {DEPARTURE_FLAVOR[dep.commanderId] ?? "부득이한 사정으로 떠납니다."}
              </div>
              <div style={{ fontSize: 12, color: "#cdab6e", marginTop: 2 }}>
                위로금 +300 金
                {dep.items.length > 0 && (
                  <span style={{ color: "#9a8070" }}> · 반환: {dep.items.join(", ")}</span>
                )}
              </div>
            </div>
          ))}

          {/* 결산 보상 2배(§12/§13) — 광고 완주 1회만. 누르면 사라짐. adFree면 버튼 자체 미표시. 샌드박스=메타 불가침이라 미표시. */}
          {!doubled && !sandbox && (
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
            {/* 캠페인 진행: outro 씬 → 다음 스테이지 intro(없으면 전장 선택). 샌드박스=실험실 복귀. */}
            <button
              type="button"
              style={BUTTON_STYLE}
              onClick={() => fadeTo(sandbox ? "/lab" : stageId ? `/scene?stage=${stageId}&type=outro` : "/stages")}
            >
              {sandbox ? "실험실로 ▶" : "다음으로 ▶"}
            </button>
          </div>
        </div>
      ) : (
        <div style={{ fontSize: 12, color: "#8a7f68", marginTop: 4 }}>탭하여 건너뛰기</div>
      )}
      {/* 획득 보물 상세(칩 탭) — 시퀀스 스킵 클릭과 분리(팝업 내부 stopPropagation) */}
      {detailItemId && <ItemInfoPopup itemId={detailItemId} onClose={() => setDetailItemId(null)} />}
      {fadeOverlay}
    </div>
  );
}
