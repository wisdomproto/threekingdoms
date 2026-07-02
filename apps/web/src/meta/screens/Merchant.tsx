"use client";
/**
 * 떠돌이 상인 화면 (§12 "떠돌이 상인 랜덤 등장 + 랜덤 재고 상점").
 *
 * 클리어한 스테이지의 /prep 화면에서 접근. 재고는 stageId + restockCount 시드로 고정
 * (같은 재고를 계속 보지만 광고 재입고로 갱신 가능). 가격은 일반 상점의 약 1.5배.
 */
import { useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { gameData } from "@tk/data";
import { getMeta, spendGold, addItem } from "../metaStore";
import { RewardedAdButton } from "../RewardedAdButton";
import { PANEL_FRAME } from "../../battle/hud/frames";
import { ItemIcon } from "../../ui/ItemIcon";
import { CATEGORY_LABEL, effectText } from "./shopItemView";

const INK_DEEP = "#0d0b09";
const BRONZE_GOLD = "#cdab6e";
const BRONZE_DIM = "#8a7350";
const PARCHMENT = "#e8dcc0";

/** 상인 재고 후보 — 비보물, 비시작장비. 구매 가능한 일반 소비/장비류. */
const MERCHANT_POOL: { itemId: string; price: number }[] = [
  { itemId: "칠성검", price: 450 },
  { itemId: "삼첨도", price: 375 },
  { itemId: "의천검", price: 600 },
  { itemId: "청강검", price: 480 },
  { itemId: "손자의병법서", price: 540 },
  { itemId: "맹덕신서", price: 480 },
  { itemId: "육도", price: 510 },
  { itemId: "삼략", price: 420 },
  { itemId: "오자의병법서", price: 390 },
  { itemId: "조황비전", price: 720 },
  { itemId: "적로", price: 900 },
  { itemId: "상약", price: 90 },
  { itemId: "한방약", price: 150 },
  { itemId: "술", price: 60 },
  { itemId: "특급주", price: 120 },
  { itemId: "폭탄", price: 180 },
  { itemId: "낙석서", price: 210 },
  { itemId: "화룡서", price: 240 },
  { itemId: "원대서", price: 195 },
  { itemId: "활기서", price: 225 },
];

const STOCK_COUNT = 5;

/** mulberry32 시드 RNG. */
function mulberry32(seed: number): () => number {
  let s = seed;
  return () => {
    s += 0x6d2b79f5;
    let t = Math.imul(s ^ (s >>> 15), s | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 문자열 → 정수 해시. */
function hashStr(s: string): number {
  let h = 0x9e3779b9;
  for (let i = 0; i < s.length; i++) {
    h = Math.imul(h ^ s.charCodeAt(i), 0x85ebca6b);
    h ^= h >>> 13;
  }
  return h >>> 0;
}

function pickStock(stageId: string, restockCount: number): typeof MERCHANT_POOL {
  const seed = hashStr(stageId) ^ (restockCount * 0x9e3779b9);
  const rng = mulberry32(seed);
  const pool = [...MERCHANT_POOL];
  const chosen: typeof MERCHANT_POOL = [];
  for (let i = pool.length - 1; i > 0 && chosen.length < STOCK_COUNT; i--) {
    const j = Math.floor(rng() * (i + 1));
    [pool[i], pool[j]] = [pool[j]!, pool[i]!];
    chosen.push(pool[i]!);
  }
  if (chosen.length < STOCK_COUNT && pool[0]) chosen.push(pool[0]);
  return chosen.slice(0, STOCK_COUNT);
}

export function Merchant(): React.ReactElement {
  const params = useSearchParams();
  const stageId = params.get("stage") ?? "";
  const backHref = stageId ? `/prep?stage=${stageId}` : "/stages";

  const [gold, setGold] = useState(() => getMeta().gold);
  const [restockCount, setRestockCount] = useState(0);
  const [purchased, setPurchased] = useState<Set<number>>(new Set()); // stock index 기준

  const stock = useMemo(() => pickStock(stageId, restockCount), [stageId, restockCount]);

  function handleBuy(idx: number, itemId: string, price: number) {
    if (purchased.has(idx)) return;
    if (!spendGold(price)) return;
    addItem(itemId);
    setPurchased((prev) => new Set(prev).add(idx));
    setGold(getMeta().gold);
  }

  function handleRestock() {
    setRestockCount((n) => n + 1);
    setPurchased(new Set());
  }

  return (
    <main style={{ minHeight: "100vh", background: INK_DEEP, color: PARCHMENT, padding: "20px 16px 48px" }}>
      <div style={{ maxWidth: 520, margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 4 }}>
          <h1 style={{ fontSize: 20, fontWeight: 800, color: BRONZE_GOLD, letterSpacing: "0.05em" }}>
            🏕️ 떠돌이 상인
          </h1>
          <Link href={backHref} style={{ color: BRONZE_DIM, fontSize: 13, textDecoration: "none" }}>
            ← 돌아가기
          </Link>
        </div>
        <div style={{ fontSize: 13, color: BRONZE_DIM, marginBottom: 4 }}>
          노변의 상인이 좌판을 벌였다. 가격이 좀 비싸지만 구색은 나쁘지 않다.
        </div>
        <div style={{ fontSize: 13, color: BRONZE_GOLD, marginBottom: 16 }}>
          보유 자금: <strong>{gold.toLocaleString()}</strong> 金
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 20 }}>
          {stock.map((entry, idx) => {
            const item = gameData.items[entry.itemId];
            if (!item) return null;
            const bought = purchased.has(idx);
            return (
              <div
                key={`${idx}-${entry.itemId}`}
                style={{
                  ...PANEL_FRAME,
                  padding: "10px 14px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 12,
                  opacity: bought ? 0.45 : 1,
                }}
              >
                <ItemIcon itemId={entry.itemId} category={item.category} size={36} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: bought ? BRONZE_DIM : PARCHMENT }}>
                    {item.name}
                    <span
                      style={{
                        marginLeft: 8,
                        fontSize: 11,
                        fontWeight: 400,
                        color: BRONZE_DIM,
                      }}
                    >
                      {CATEGORY_LABEL[item.category] ?? item.category}
                    </span>
                  </div>
                  {/* 효과 한 줄 — 일반 상점과 동일 정보(900金짜리를 효과 표기 없이 팔지 않는다) */}
                  <div style={{ fontSize: 11, color: BRONZE_DIM, marginTop: 2 }}>
                    {effectText(item)}
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
                  <span style={{ color: BRONZE_GOLD, fontSize: 13, fontWeight: 600 }}>{entry.price.toLocaleString()} 金</span>
                  <button
                    type="button"
                    disabled={bought || gold < entry.price}
                    onClick={() => handleBuy(idx, entry.itemId, entry.price)}
                    style={{
                      padding: "6px 14px",
                      borderRadius: 8,
                      border: "1px solid",
                      borderColor: bought ? "#3a414a" : gold < entry.price ? "#3a414a" : "#cdab6e88",
                      background: bought ? "rgba(20,18,14,0.3)" : gold < entry.price ? "rgba(20,18,14,0.3)" : "rgba(40,34,24,0.7)",
                      color: bought ? BRONZE_DIM : gold < entry.price ? "#555" : PARCHMENT,
                      fontSize: 13,
                      fontWeight: 600,
                      cursor: bought || gold < entry.price ? "not-allowed" : "pointer",
                    }}
                  >
                    {bought ? "구매완료" : "구매"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        <RewardedAdButton
          placement="merchant_restock"
          label="📦 광고 보고 재입고"
          onReward={handleRestock}
        />
      </div>
    </main>
  );
}
