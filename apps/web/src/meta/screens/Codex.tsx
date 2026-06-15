"use client";
/**
 * 보물 도감 (§10 "도감 시스템: 미획득은 조건 힌트만 표시 — 2회차 동력 + 커뮤니티 공략 떡밥").
 *
 * 전 보물(items category=treasure)을 그리드로 나열. 수집(metaStore.inventory)한 보물은
 * 이름·고유 효과(§7 effects)를 보여주고, 미수집은 "???" + **획득처 힌트**(어느 스테이지 보상인지)만.
 * 수집은 클리어 결산에서 inventory 적립(ResultSequence). 힌트는 stages.reward.treasures에서 파생.
 *
 * 클라이언트 전용(localStorage 의존) — SSR에선 전부 미수집으로 그려 하이드레이션 일치 후 로드.
 */
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { gameData, stages } from "@tk/data";
import { getMeta } from "../metaStore";
import { isSerendipityTreasure } from "../serendipity";
import { PANEL_FRAME } from "../../battle/hud/frames";

const INK = "#1a1714";
const INK_DEEP = "#0d0b09";
const BRONZE_GOLD = "#cdab6e";
const BRONZE_DIM = "#8a7350";
const PARCHMENT = "#e8dcc0";

interface Eff {
  move?: number; atkPercent?: number; spiritPercent?: number; defensePercent?: number; doubleStrike?: boolean;
}
function effectSummary(e?: Eff): string {
  if (!e) return "고유 효과 없음";
  const p: string[] = [];
  if (e.move) p.push(`기동 +${e.move}`);
  if (e.atkPercent) p.push(`공격 +${e.atkPercent}%`);
  if (e.spiritPercent) p.push(`정신 +${e.spiritPercent}%`);
  if (e.defensePercent) p.push(`받는 피해 −${e.defensePercent}%`);
  if (e.doubleStrike) p.push("연속공격");
  return p.length ? p.join(" · ") : "고유 효과 없음";
}

export function Codex(): React.ReactElement {
  const [owned, setOwned] = useState<Set<string>>(new Set());
  useEffect(() => {
    setOwned(new Set(getMeta().inventory));
  }, []);

  // 도감 = 스테이지 고유 보물만. 기연 전용 보물(qiyuan-*)은 §10 도감 동력 보존 위해 제외.
  const treasures = useMemo(
    () =>
      Object.values(gameData.items).filter(
        (i) => i.category === "treasure" && !isSerendipityTreasure(i.id),
      ),
    [],
  );
  // 보물 id → 획득처(스테이지명) 힌트. reward.treasures + strategyConditions 노획분.
  const sourceOf = useMemo(() => {
    const m = new Map<string, string>();
    for (const st of Object.values(stages)) {
      for (const tid of st.reward?.treasures ?? []) if (!m.has(tid)) m.set(tid, st.name);
      for (const sc of st.strategyConditions ?? [])
        for (const tid of sc.reward?.treasures ?? []) if (!m.has(tid)) m.set(tid, `${st.name} (숨겨진 조건)`);
    }
    return m;
  }, []);

  const collected = treasures.filter((t) => owned.has(t.id)).length;

  return (
    <main style={{ minHeight: "100vh", background: INK_DEEP, color: PARCHMENT, padding: "20px 16px 48px" }}>
      <div style={{ maxWidth: 760, margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 4 }}>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: BRONZE_GOLD, letterSpacing: "0.05em" }}>보물 도감</h1>
          <Link href="/stages" style={{ color: BRONZE_DIM, fontSize: 13, textDecoration: "none" }}>← 스테이지</Link>
        </div>
        <div style={{ fontSize: 13, color: BRONZE_DIM, marginBottom: 16 }}>
          수집 <strong style={{ color: BRONZE_GOLD }}>{collected}</strong> / {treasures.length} — 미획득은 조건 힌트만 표시
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(170px, 1fr))", gap: 10 }}>
          {treasures.map((t) => {
            const has = owned.has(t.id);
            return (
              <div
                key={t.id}
                style={{
                  ...PANEL_FRAME,
                  background: has ? INK : "rgba(20,17,14,0.6)",
                  backgroundClip: "padding-box",
                  padding: "10px 12px",
                  opacity: has ? 1 : 0.7,
                  minHeight: 78,
                }}
              >
                <div style={{ fontSize: 14, fontWeight: 700, color: has ? PARCHMENT : BRONZE_DIM }}>
                  {has ? t.name : "？？？"}
                </div>
                {has ? (
                  <div style={{ fontSize: 12, color: BRONZE_GOLD, marginTop: 5, lineHeight: 1.4 }}>
                    {effectSummary(t.effects as Eff | undefined)}
                  </div>
                ) : (
                  <div style={{ fontSize: 11, color: BRONZE_DIM, marginTop: 5, lineHeight: 1.4 }}>
                    획득: {sourceOf.get(t.id) ?? "??? (미상)"}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </main>
  );
}
