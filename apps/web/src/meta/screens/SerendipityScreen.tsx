"use client";
/**
 * 기연(奇緣) 화면 (§12 — "클리어 후 기연 포인트로 뽑기 ... 짧은 텍스트 연출로 이야기처럼 포장. 천장 포함").
 *
 * 클리어로 쌓은 기연 포인트를 소모해 보상(자금/소모품/기연 전용 경미 보물)을 뽑는다.
 * 무작위는 metaStore.pullSerendipity(rng)에 Math.random을 주입 — 전투 밖 메타라 리플레이/
 * 리더보드/밸런스 sim 무관(§14, "랜덤은 재미로" §2-5). 추첨 로직은 serendipity.ts(순수)에 있고
 * 여기선 연출(플레이버 1줄 → 보상 카드 reveal)만 입힌다.
 *
 * 톤/프레임은 StageSelect·Codex(수묵/청동)와 동일. 보물(rare)은 보랏빛 잭팟 톤으로 강조.
 */
import { useEffect, useState } from "react";
import Link from "next/link";
import { gameData } from "@tk/data";
import type { ItemEffects } from "@tk/data";
import { getSerendipity, getSerendipityPity, pullSerendipity } from "../metaStore";
import { PULL_COST, PITY_CAP, pickFlavor, isSerendipityTreasure } from "../serendipity";
import type { SerendipityReward } from "../serendipity";
import { PANEL_FRAME } from "../../battle/hud/frames";

const INK = "#1a1714";
const INK_DEEP = "#0d0b09";
const BRONZE_GOLD = "#cdab6e";
const BRONZE_DIM = "#8a7350";
const PARCHMENT = "#e8dcc0";
const RARE_PURPLE = "#b890ff";

const KEYFRAMES = `
@keyframes tkQiFlavor { 0% { opacity: 0; transform: translateY(6px); } 100% { opacity: 1; transform: translateY(0); } }
@keyframes tkQiReveal { 0% { opacity: 0; transform: scale(0.6) translateY(8px); } 55% { opacity: 1; transform: scale(1.12); } 100% { transform: scale(1) translateY(0); } }
@keyframes tkQiGlow { 0%,100% { box-shadow: 0 0 8px ${RARE_PURPLE}55; } 50% { box-shadow: 0 0 18px ${RARE_PURPLE}aa; } }
`;

/** 보상 → 표시 텍스트. gold=금액, item=아이템명(없으면 id). */
function rewardLabel(reward: SerendipityReward): string {
  if (reward.kind === "gold") return `자금 +${reward.amount} 金`;
  return gameData.items[reward.itemId]?.name ?? reward.itemId;
}

/** 기연 보물 효과 한 줄(reveal 보조 설명). 소모품/자금은 빈 문자열. */
function rewardSub(reward: SerendipityReward): string {
  if (reward.kind !== "item") return "";
  const it = gameData.items[reward.itemId];
  if (!it) return "";
  if (it.category === "treasure") return effectSummary(it.effects);
  if (it.category === "supplyItem") return "보급품";
  if (it.category === "attackItem") return "공격 소모품";
  return "";
}

function effectSummary(e?: ItemEffects): string {
  if (!e) return "";
  const p: string[] = [];
  if (e.move) p.push(`기동 +${e.move}`);
  if (e.atkPercent) p.push(`공격 +${e.atkPercent}%`);
  if (e.spiritPercent) p.push(`정신 +${e.spiritPercent}%`);
  if (e.defensePercent) p.push(`받는 피해 −${e.defensePercent}%`);
  if (e.doubleStrike) p.push("연속공격");
  return p.join(" · ");
}

interface PullView {
  flavor: string;
  reward: SerendipityReward;
  rare: boolean;
  /** false면 플레이버만(보상 카드 아직 가림), true면 보상 공개. */
  revealed: boolean;
}

export function SerendipityScreen(): React.ReactElement {
  const [points, setPoints] = useState(0);
  const [pity, setPity] = useState(0);
  const [view, setView] = useState<PullView | null>(null);
  // SSR/하이드레이션 일치 — 마운트 후 1회 로드.
  useEffect(() => {
    setPoints(getSerendipity());
    setPity(getSerendipityPity());
  }, []);

  const canPull = points >= PULL_COST;
  const toPity = Math.max(0, PITY_CAP - pity); // 천장까지 남은 횟수

  const onPull = () => {
    const result = pullSerendipity(() => Math.random());
    if (!result) return; // 포인트 부족(버튼 비활성과 이중 가드)
    // 차감/적립은 이미 영속됨 — 표시값 즉시 갱신.
    setPoints(getSerendipity());
    setPity(getSerendipityPity());
    // 플레이버 먼저(가림) → 짧게 후 보상 공개.
    setView({ flavor: pickFlavor(Math.random()), reward: result.reward, rare: result.wasRare, revealed: false });
    window.setTimeout(() => {
      setView((v) => (v ? { ...v, revealed: true } : v));
    }, 650);
  };

  return (
    <main
      style={{
        minHeight: "100svh",
        background: `radial-gradient(120% 80% at 50% 0%, ${INK} 0%, ${INK_DEEP} 80%)`,
        color: PARCHMENT,
        padding: "20px 16px 48px",
        fontFamily: '"Noto Serif KR", "Nanum Myeongjo", "Apple SD Gothic Neo", serif',
      }}
    >
      <style>{KEYFRAMES}</style>
      <div style={{ maxWidth: 520, margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 4 }}>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: BRONZE_GOLD, letterSpacing: "0.08em" }}>
            기연 <span style={{ fontSize: 14, color: BRONZE_DIM }}>奇緣</span>
          </h1>
          <Link href="/stages" style={{ color: BRONZE_DIM, fontSize: 13, textDecoration: "none" }}>
            ← 스테이지
          </Link>
        </div>
        <p style={{ fontSize: 13, color: BRONZE_DIM, margin: "0 0 18px", lineHeight: 1.5 }}>
          전장에서 쌓은 인연이 뜻밖의 만남으로 이어진다.
        </p>

        {/* 자원/천장 */}
        <div
          style={{
            ...PANEL_FRAME,
            background: INK,
            padding: "14px 18px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 18,
          }}
        >
          <span style={{ fontSize: 15 }}>
            보유 기연 <strong style={{ color: RARE_PURPLE, fontSize: 18 }}>{points}</strong>
          </span>
          <span style={{ fontSize: 12, color: BRONZE_DIM }}>천장까지 {toPity}회</span>
        </div>

        {/* 연출 무대 */}
        <div
          style={{
            minHeight: 168,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 14,
            marginBottom: 20,
            textAlign: "center",
          }}
        >
          {view ? (
            <>
              <div
                key={view.flavor}
                style={{ fontSize: 14, color: PARCHMENT, lineHeight: 1.6, maxWidth: 360, animation: "tkQiFlavor 320ms ease-out both" }}
              >
                {view.flavor}
              </div>
              {view.revealed && (
                <div
                  key={rewardLabel(view.reward) + (view.revealed ? "-r" : "")}
                  style={{
                    ...PANEL_FRAME,
                    padding: "14px 22px",
                    minWidth: 180,
                    background: view.rare ? "rgba(48, 36, 64, 0.7)" : INK,
                    color: view.rare ? RARE_PURPLE : BRONZE_GOLD,
                    animation: view.rare
                      ? "tkQiReveal 420ms cubic-bezier(0.2,1.3,0.3,1) both, tkQiGlow 1.8s ease-in-out 0.4s infinite"
                      : "tkQiReveal 380ms cubic-bezier(0.2,1.3,0.3,1) both",
                  }}
                >
                  {view.rare && (
                    <div style={{ fontSize: 11, color: RARE_PURPLE, letterSpacing: "0.2em", marginBottom: 4 }}>기연 보물</div>
                  )}
                  <div style={{ fontSize: 18, fontWeight: 800 }}>{rewardLabel(view.reward)}</div>
                  {rewardSub(view.reward) && (
                    <div style={{ fontSize: 12, color: view.rare ? "#cdbdf0" : BRONZE_DIM, marginTop: 4 }}>
                      {rewardSub(view.reward)}
                    </div>
                  )}
                </div>
              )}
            </>
          ) : (
            <div style={{ fontSize: 13, color: "#5a5142" }}>
              {canPull ? "기연을 청해 보자." : "전장에서 기연을 쌓으세요."}
            </div>
          )}
        </div>

        {/* 뽑기 버튼 */}
        <button
          type="button"
          onClick={onPull}
          disabled={!canPull}
          style={{
            width: "100%",
            minHeight: 56,
            ...PANEL_FRAME,
            background: canPull ? "linear-gradient(180deg, rgba(72,56,96,0.9), rgba(40,30,56,0.9))" : "rgba(24,21,17,0.6)",
            color: canPull ? PARCHMENT : "#5a5142",
            fontSize: 16,
            fontWeight: 700,
            cursor: canPull ? "pointer" : "not-allowed",
            letterSpacing: "0.05em",
          }}
        >
          기연 청하기 <span style={{ fontSize: 13, color: canPull ? RARE_PURPLE : "#4a4338" }}>({PULL_COST} 기연)</span>
        </button>
        {!canPull && (
          <p style={{ fontSize: 12, color: BRONZE_DIM, textAlign: "center", marginTop: 10 }}>
            스테이지를 클리어하면 등급에 따라 기연이 쌓입니다.
          </p>
        )}
      </div>
    </main>
  );
}
