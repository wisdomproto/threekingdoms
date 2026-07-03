"use client";
/**
 * DuelCutin — 일기토 풀스크린 컷인(§9 "게임의 간판", 2026-07-03 Tier 0).
 * 시퀀스: 암전+좌우 초상 슬램인+VS → banter 대사(탭/자동) → 합 교환(섬광·흔들림·SFX) → 승부.
 * 탭 = 대사 진행/단계 스킵(자동전투에서도 타이머로 자동 진행). 완료 시 onDone 1회.
 *
 * 배경 드롭인 사다리(duelMedia): 영상(webm, Seedance) → 키비주얼(webp, Gemini) → 수묵 그라디언트.
 * 파일이 없으면 조용히 다음 티어로 — 에셋이 생기는 만큼 연출이 격상된다(코드 불변).
 *
 * 순수 표현 — 게임 상태(승패·즉사)는 엔진이 이미 커밋했고, 여기선 그 결과를 상연만 한다.
 * EventPlayer가 이 연출의 완료(onDone→Promise resolve)를 기다린다(BattleRenderer.setDuelCinematic).
 */
import { useCallback, useEffect, useRef, useState } from "react";
import type { DialogueLine } from "@tk/data";
import { CommanderPortrait } from "../../ui/CommanderPortrait";
import { assetUrl } from "../../assetUrl";
import { SFX, playSfx } from "../../audio";
import { duelImagePath, duelVideoPath } from "./duelMedia";
import { HUD_FONT, HUD_BRONZE, HUD_PARCHMENT } from "../hud/frames";

export interface DuelCineVM {
  duelId: string;
  attackerId: string;
  defenderId: string;
  winnerId: string;
  /** 표시 이름(commanders.json name) */
  attackerName: string;
  defenderName: string;
  /** 패자 즉시 퇴각(스토리 일기토 결과) 여부 — 결과 배너 문구용 */
  loserRetreats: boolean;
  /** 이 일기토의 banter 대사(duelMedia.duelBanter) — 합 전에 재생 */
  lines: DialogueLine[];
}

type Phase = "enter" | "banter" | "clash" | "result";

const ENTER_MS = 750;
const LINE_MS = 2600;
const EXCHANGE_MS = 560;
const EXCHANGES = 3;
const RESULT_MS = 1600;

const KEYFRAMES = `
@keyframes tkDuelInL { 0% { transform: translateX(-70%) skewX(-6deg); opacity: 0; } 100% { transform: translateX(0) skewX(-6deg); opacity: 1; } }
@keyframes tkDuelInR { 0% { transform: translateX(70%) skewX(-6deg); opacity: 0; } 100% { transform: translateX(0) skewX(-6deg); opacity: 1; } }
@keyframes tkDuelVs { 0% { transform: scale(2.6); opacity: 0; } 55% { transform: scale(0.92); opacity: 1; } 100% { transform: scale(1); opacity: 1; } }
@keyframes tkDuelFlash { 0% { opacity: 0.95; } 100% { opacity: 0; } }
@keyframes tkDuelShake { 0%,100% { transform: translate(0,0); } 20% { transform: translate(-7px,4px); } 40% { transform: translate(6px,-5px); } 60% { transform: translate(-4px,-3px); } 80% { transform: translate(4px,3px); } }
@keyframes tkDuelLungeL { 0%,100% { transform: translateX(0) skewX(-6deg); } 45% { transform: translateX(4.5%) skewX(-6deg); } }
@keyframes tkDuelLungeR { 0%,100% { transform: translateX(0) skewX(-6deg); } 45% { transform: translateX(-4.5%) skewX(-6deg); } }
@keyframes tkDuelBanner { 0% { transform: scale(1.5); opacity: 0; } 60% { transform: scale(0.96); opacity: 1; } 100% { transform: scale(1); opacity: 1; } }
`;

export function DuelCutin({ vm, onDone }: { vm: DuelCineVM; onDone: () => void }): React.ReactElement {
  const [phase, setPhase] = useState<Phase>("enter");
  const [lineIdx, setLineIdx] = useState(0);
  const [exchange, setExchange] = useState(0); // clash 진행 카운트(1..EXCHANGES)
  const [bgTier, setBgTier] = useState<"video" | "image" | "none">("video");
  const doneRef = useRef(false);

  const finish = useCallback(() => {
    if (doneRef.current) return; // onDone 1회 보장(타이머·탭 경합)
    doneRef.current = true;
    onDone();
  }, [onDone]);

  const hasBanter = vm.lines.length > 0;
  const winnerIsAttacker = vm.winnerId === vm.attackerId;
  const loserName = winnerIsAttacker ? vm.defenderName : vm.attackerName;
  const winnerName = winnerIsAttacker ? vm.attackerName : vm.defenderName;

  // 단계 자동 진행 타이머 — 탭이 앞서가면 그 상태 기준으로 재설정된다.
  useEffect(() => {
    if (phase === "enter") {
      playSfx(SFX.duel);
      const t = setTimeout(() => setPhase(hasBanter ? "banter" : "clash"), ENTER_MS);
      return () => clearTimeout(t);
    }
    if (phase === "banter") {
      const t = setTimeout(() => {
        if (lineIdx + 1 < vm.lines.length) setLineIdx((i) => i + 1);
        else setPhase("clash");
      }, LINE_MS);
      return () => clearTimeout(t);
    }
    if (phase === "clash") {
      if (exchange >= EXCHANGES) { setPhase("result"); return; }
      playSfx(exchange === EXCHANGES - 1 ? SFX.crit : SFX.slash);
      const t = setTimeout(() => setExchange((n) => n + 1), EXCHANGE_MS);
      return () => clearTimeout(t);
    }
    // result
    if (vm.loserRetreats) playSfx(SFX.defeat);
    const t = setTimeout(finish, RESULT_MS);
    return () => clearTimeout(t);
  }, [phase, lineIdx, exchange, hasBanter, vm.lines.length, vm.loserRetreats, finish]);

  // 탭: banter=다음 대사, 그 외=단계 스킵(빨리감기).
  const onTap = useCallback(() => {
    if (phase === "enter") setPhase(hasBanter ? "banter" : "clash");
    else if (phase === "banter") {
      if (lineIdx + 1 < vm.lines.length) setLineIdx((i) => i + 1);
      else setPhase("clash");
    } else if (phase === "clash") setExchange(EXCHANGES);
    else finish();
  }, [phase, lineIdx, hasBanter, vm.lines.length, finish]);

  const clashing = phase === "clash" && exchange < EXCHANGES;
  const line = phase === "banter" ? vm.lines[lineIdx] : undefined;

  const panel = (side: "L" | "R"): React.CSSProperties => {
    const isWinner = (side === "L") === winnerIsAttacker;
    const resultFx =
      phase === "result"
        ? isWinner
          ? { filter: "none", boxShadow: `0 0 42px rgba(224,184,74,0.55)`, transform: "skewX(-6deg) scale(1.04)" }
          : { filter: "grayscale(0.9) brightness(0.5)", transform: "skewX(-6deg) translateY(4%)" }
        : {};
    return {
      position: "relative",
      width: "34%",
      maxWidth: 300,
      aspectRatio: "3 / 3.8",
      overflow: "hidden",
      borderRadius: 10,
      border: `2px solid ${isWinner && phase === "result" ? HUD_BRONZE : "#6f5a34"}`,
      background: "#171208",
      boxShadow: "0 10px 40px rgba(0,0,0,0.6)",
      transform: "skewX(-6deg)",
      animation:
        phase === "enter"
          ? `${side === "L" ? "tkDuelInL" : "tkDuelInR"} ${ENTER_MS}ms cubic-bezier(0.16,1,0.3,1) both`
          : clashing
            ? `${side === "L" ? "tkDuelLungeL" : "tkDuelLungeR"} ${EXCHANGE_MS}ms ease-in-out`
            : "none",
      transition: "filter 400ms, transform 400ms, box-shadow 400ms",
      ...resultFx,
    };
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`일기토 — ${vm.attackerName} 대 ${vm.defenderName}`}
      onPointerDown={onTap}
      style={{
        position: "absolute",
        inset: 0,
        zIndex: 70, // HUD 위, PauseMenu(80) 아래
        overflow: "hidden",
        fontFamily: HUD_FONT,
        cursor: "pointer",
        userSelect: "none",
        background: "rgba(8, 6, 3, 0.9)",
      }}
    >
      <style>{KEYFRAMES}</style>

      {/* ── 배경 드롭인 사다리: 영상 → 키비주얼 → 수묵 그라디언트 ── */}
      {bgTier === "video" && (
        <video
          src={assetUrl(duelVideoPath(vm.attackerId, vm.defenderId))}
          autoPlay muted playsInline
          onError={() => setBgTier("image")}
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", opacity: 0.85 }}
        />
      )}
      {bgTier === "image" && (
        <img
          src={assetUrl(duelImagePath(vm.attackerId, vm.defenderId))}
          alt=""
          onError={() => setBgTier("none")}
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", opacity: 0.75 }}
        />
      )}
      <div aria-hidden style={{
        position: "absolute", inset: 0,
        background: bgTier === "none"
          ? "radial-gradient(120% 85% at 50% 30%, rgba(90,52,28,0.75), rgba(16,11,6,0.95) 70%)"
          : "linear-gradient(to bottom, rgba(10,7,4,0.35), rgba(10,7,4,0.72))",
      }} />

      {/* ── 초상 대결 무대(합 때 흔들림) ── */}
      <div style={{
        position: "absolute", inset: 0,
        display: "flex", alignItems: "center", justifyContent: "center", gap: "6%",
        animation: clashing ? `tkDuelShake ${EXCHANGE_MS}ms ease-in-out` : "none",
        padding: "0 4%",
      }}>
        <div style={panel("L")}>
          <CommanderPortrait commanderId={vm.attackerId} name={vm.attackerName} />
          <NamePlate name={vm.attackerName} />
        </div>

        {/* VS 인장 */}
        <div style={{
          flexShrink: 0,
          width: 74, height: 74, borderRadius: 10,
          background: "linear-gradient(135deg, #8a2a1e, #5e1a10)",
          border: "2px solid rgba(0,0,0,0.5)",
          boxShadow: "0 6px 24px rgba(0,0,0,0.6), inset 0 0 14px rgba(0,0,0,0.45)",
          display: "flex", alignItems: "center", justifyContent: "center",
          transform: "rotate(-6deg)",
          animation: phase === "enter" ? `tkDuelVs ${ENTER_MS}ms cubic-bezier(0.2,1.4,0.3,1) both` : "none",
        }}>
          <span style={{ fontSize: 30, fontWeight: 900, color: "#f4e2b8", letterSpacing: "0.05em", textShadow: "0 2px 5px rgba(0,0,0,0.8)" }}>
            對
          </span>
        </div>

        <div style={panel("R")}>
          <CommanderPortrait commanderId={vm.defenderId} name={vm.defenderName} />
          <NamePlate name={vm.defenderName} right />
        </div>
      </div>

      {/* 합 섬광 */}
      {clashing && (
        <div key={exchange} aria-hidden style={{
          position: "absolute", inset: 0, pointerEvents: "none",
          background: "radial-gradient(60% 45% at 50% 46%, rgba(255,240,200,0.9), transparent 70%)",
          animation: `tkDuelFlash ${EXCHANGE_MS}ms ease-out both`,
        }} />
      )}

      {/* 상단 표제 */}
      <div style={{
        position: "absolute", top: "6%", left: 0, right: 0, textAlign: "center",
        fontSize: 15, letterSpacing: "0.5em", textIndent: "0.5em", color: HUD_BRONZE, fontWeight: 700,
        textShadow: "0 2px 6px rgba(0,0,0,0.8)",
      }}>
        一 騎 討
      </div>

      {/* banter 대사 스트립 */}
      {line && (
        <div style={{
          position: "absolute", left: "50%", bottom: "9%", transform: "translateX(-50%)",
          width: "min(560px, 88%)",
          background: "rgba(14, 10, 5, 0.88)",
          border: "1px solid #6f5a34",
          borderRadius: 10,
          padding: "10px 16px 12px",
          boxShadow: "0 8px 30px rgba(0,0,0,0.5)",
        }}>
          <div style={{ fontSize: 12.5, fontWeight: 700, marginBottom: 4, color: line.side === "enemy" ? "#d08a6a" : "#8ab0d8" }}>
            {line.speaker}
          </div>
          <div style={{ fontSize: 15, color: HUD_PARCHMENT, lineHeight: 1.55 }}>{line.text}</div>
          <div style={{ position: "absolute", right: 10, bottom: 6, fontSize: 10, color: "#8a7350" }}>▼</div>
        </div>
      )}

      {/* 승부 배너 */}
      {phase === "result" && (
        <div style={{
          position: "absolute", left: 0, right: 0, bottom: "12%",
          display: "flex", flexDirection: "column", alignItems: "center", gap: 6,
          animation: `tkDuelBanner 500ms cubic-bezier(0.2,1.3,0.3,1) both`,
        }}>
          <div style={{
            padding: "10px 34px",
            background: "linear-gradient(to bottom, rgba(151,48,31,0.95), rgba(94,26,16,0.95))",
            border: "1.5px solid rgba(224,184,74,0.6)",
            borderRadius: 10,
            fontSize: 24, fontWeight: 900, color: "#f6e6bc", letterSpacing: "0.2em", textIndent: "0.2em",
            textShadow: "0 2px 6px rgba(0,0,0,0.85)",
            boxShadow: "0 10px 36px rgba(0,0,0,0.6), 0 0 22px rgba(224,184,74,0.25)",
          }}>
            {winnerName} 승리
          </div>
          {vm.loserRetreats && (
            <div style={{ fontSize: 13, color: "#cdb8a0", textShadow: "0 1px 4px rgba(0,0,0,0.8)" }}>
              {loserName}, 무너지다
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function NamePlate({ name, right }: { name: string; right?: boolean }): React.ReactElement {
  return (
    <div style={{
      position: "absolute", left: 0, right: 0, bottom: 0,
      padding: "18px 10px 8px",
      background: "linear-gradient(to top, rgba(8,6,3,0.92), transparent)",
      textAlign: right ? "right" : "left",
    }}>
      <span style={{ fontSize: 20, fontWeight: 800, color: HUD_PARCHMENT, letterSpacing: "0.1em", textShadow: "0 2px 5px rgba(0,0,0,0.9)" }}>
        {name}
      </span>
    </div>
  );
}
