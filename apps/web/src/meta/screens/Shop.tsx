"use client";
/**
 * 상점 화면 — §10/§13 막간 출진 준비. /prep 셸이 편성과 나란히 합성한다.
 *
 * 동작:
 *  - shop.items 중 unlockChapter <= chapter 인 항목만 진열(이름/효과/가격/보유 표시).
 *  - 구매: metaStore.spendGold(price) 성공 시 addItem(itemId) → onPurchase(itemId)로 부모에
 *    알려 잔액/인벤토리 재조회. 잔액 부족이면 버튼 비활성.
 *  - 소모품(상약/한방약)은 중복 구매 허용, 장비/보물도 중복 허용(정책: 확률강화·랜덤 없음).
 *  - 판매는 MVP 범위 밖(생략).
 *
 * 진열 변환(필터/효과 문구/구매 가능)은 shopItemView.ts(순수)로 분리 — node 테스트 대상.
 * 청동 프레임/팔레트는 battle/hud/frames.ts 재사용(원작 UI 크롬 일관).
 */
import { useMemo, useState } from "react";
import type { CSSProperties } from "react";
import type { Shop as ShopData, Item } from "@tk/data";
import { getMeta, spendGold, addItem, addGold, canWatchGoldAd, recordAdGold } from "../metaStore";
import { RewardedAdButton } from "../RewardedAdButton";
import { buildShopRows, buildShopGroups, type ShopRow } from "./shopItemView";
import { ItemIcon } from "../../ui/ItemIcon";

/**
 * 광고 1회 시청당 충전되는 *확정* 골드(§13 가드레일 — 소액·랜덤 없음, 전투력 영향 없음).
 * "확정 장비 구매용" 자금만 늘려주므로 밸런스 시뮬레이션을 깨지 않는다.
 */
const AD_GOLD_REWARD = 100;

export interface ShopProps {
  /** 진열 상점(gameData.shops.ch1 등). */
  shop: ShopData;
  /** itemId → Item(이름/효과 표시용). gameData.items. */
  items: Record<string, Item>;
  /** 현재 보유 자금(metaStore.getMeta().gold). */
  gold: number;
  /** 해금 기준 챕터(unlockChapter 필터). */
  chapter: number;
  /** 구매 완료 콜백 — 부모가 잔액/인벤토리 재조회. */
  onPurchase?: (itemId: string) => void;
}

// --- 양피지+목재 팔레트 (Formation.tsx 일치) ---
const C = {
  parchment: "#ede4cc",
  parchmentWarm: "#f5edd8",
  parchmentDark: "#d4c4a0",
  parchmentShadow: "#c8b890",
  wood: "#1e1408",
  woodMid: "#3a2410",
  gold: "#c8a440",
  goldBright: "#e0b840",
  goldDim: "#8a6a28",
  goldGlow: "rgba(200,164,64,0.18)",
  darkText: "#1a1008",
  mutedText: "#5a4a30",
  dimText: "#8a7850",
  rowBg: "rgba(255,248,224,0.55)",
  rowOwned: "rgba(220,200,120,0.35)",
  rowBorder: "rgba(200,164,64,0.25)",
};

export function Shop({
  shop,
  items,
  gold,
  chapter,
  onPurchase,
}: ShopProps): React.ReactElement {
  // 구매 시 보유 수량(owned)이 바뀌므로 로컬 리프레시 토큰으로 재계산을 강제.
  // gold는 props(부모가 onPurchase 후 재조회)로 내려오므로 affordable은 자동 갱신.
  const [tick, setTick] = useState(0);

  const rows = useMemo<ShopRow[]>(() => {
    const inventory = getMeta().inventory;
    return buildShopRows(shop, items, gold, chapter, inventory);
    // tick: 구매 후 inventory(owned) 재반영용 의존성.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shop, items, gold, chapter, tick]);

  function handleBuy(row: ShopRow): void {
    if (!row.affordable) return;
    if (!spendGold(row.price)) return; // 동시성/경합 방어 — 실패면 무변경
    addItem(row.itemId);
    setTick((t) => t + 1); // 보유 수량 갱신
    onPurchase?.(row.itemId); // 부모가 gold/inventory 재조회
  }

  // 광고 골드 충전(§13 shop_gold) — 완주 시에만 호출. *확정* 소액 골드 + 일일 캡 기록.
  // 골드 지급(addGold)과 캡 기록(recordAdGold)은 분리돼 있어 둘 다 호출해야 한다.
  function handleAdGold(): void {
    addGold(AD_GOLD_REWARD);
    recordAdGold();
    setTick((t) => t + 1); // 캡/affordable 재평가
    onPurchase?.(""); // 부모가 보유 자금(gold prop) 재조회 — itemId 없는 잔액 갱신 신호
  }

  return (
    <section style={panelStyle} aria-label="상점">
      {/* 목재 제목 바 */}
      <div style={titleBarStyle}>
        <span style={shopIconStyle}>⚖</span>
        <h2 style={titleStyle}>{shop.name}</h2>
        <div style={headerRightStyle}>
          <RewardedAdButton
            placement="shop_gold"
            label={`+${AD_GOLD_REWARD}냥`}
            capReached={!canWatchGoldAd()}
            onReward={handleAdGold}
          />
          <span style={goldStyle} aria-label="보유 자금">
            <span style={goldLabelStyle}>자금</span>
            {gold.toLocaleString()}
            <span style={goldUnitStyle}>냥</span>
          </span>
        </div>
      </div>

      <div style={bodyStyle}>
        {rows.length === 0 ? (
          <p style={{ color: C.mutedText, margin: "8px 4px", fontStyle: "italic" }}>
            진열 중인 물품이 없습니다.
          </p>
        ) : (
          buildShopGroups(rows).map((group) => (
            <div key={group.category} style={{ marginBottom: 12 }}>
              <div style={groupHeaderStyle}>{group.label}</div>
              <ul style={listStyle}>
                {group.rows.map((row) => (
                  <ShopRowView key={row.itemId} row={row} onBuy={() => handleBuy(row)} />
                ))}
              </ul>
            </div>
          ))
        )}
      </div>
    </section>
  );
}

function ShopRowView({
  row,
  onBuy,
}: {
  row: ShopRow;
  onBuy: () => void;
}): React.ReactElement {
  const rowStyle: CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "9px 10px",
    borderRadius: 6,
    background: row.owned > 0 ? C.rowOwned : C.rowBg,
    border: `1px solid ${row.owned > 0 ? C.gold + "55" : C.rowBorder}`,
  };
  return (
    <li style={rowStyle}>
      <ItemIcon
        itemId={row.itemId}
        category={row.category}
        size={44}
        style={{ borderRadius: 6, border: `1px solid ${C.goldDim}55` }}
      />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 6, flexWrap: "wrap" }}>
          <span style={{ color: C.darkText, fontWeight: 700, fontSize: 14 }}>{row.name}</span>
          <span style={badgeStyle}>{row.categoryLabel}</span>
          {row.owned > 0 && (
            <span style={ownedTagStyle}>보유{row.owned > 1 ? ` ×${row.owned}` : ""}</span>
          )}
        </div>
        <div style={{ color: C.mutedText, fontSize: 11, marginTop: 2 }}>
          {row.effect}
          {row.consumable && <span style={{ marginLeft: 5, opacity: 0.7 }}>· 소모품</span>}
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
        <span style={priceStyle} aria-label="가격">
          {row.price.toLocaleString()}
          <span style={{ fontSize: 11, marginLeft: 2 }}>냥</span>
        </span>
        <button
          type="button"
          onClick={onBuy}
          disabled={!row.affordable}
          style={buyBtnStyle(row.affordable)}
          aria-label={`${row.name} 구매`}
        >
          {row.affordable ? "구매" : "부족"}
        </button>
      </div>
    </li>
  );
}

// --- 스타일 ---
const panelStyle: CSSProperties = {
  background: `linear-gradient(150deg, ${C.parchmentWarm} 0%, ${C.parchment} 100%)`,
  borderRadius: 8,
  overflow: "hidden",
  border: `2px solid ${C.woodMid}`,
  boxShadow: `0 4px 16px rgba(0,0,0,0.45), inset 0 1px 0 ${C.goldBright}33`,
  color: C.darkText,
};

const titleBarStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  padding: "10px 14px",
  background: `linear-gradient(90deg, ${C.wood} 0%, ${C.woodMid} 100%)`,
  borderBottom: `2px solid ${C.gold}`,
  flexWrap: "wrap",
};

const shopIconStyle: CSSProperties = {
  fontSize: 18,
  color: C.gold,
  lineHeight: 1,
};

const titleStyle: CSSProperties = {
  margin: 0,
  flex: 1,
  fontSize: 16,
  fontWeight: 700,
  color: C.gold,
  letterSpacing: "0.06em",
};

const headerRightStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 10,
};

const goldLabelStyle: CSSProperties = {
  color: C.goldDim,
  fontSize: 11,
  marginRight: 3,
};

const goldUnitStyle: CSSProperties = {
  fontSize: 11,
  marginLeft: 2,
  color: C.goldDim,
};

const goldStyle: CSSProperties = {
  color: C.goldBright,
  fontVariantNumeric: "tabular-nums",
  fontWeight: 700,
  fontSize: 15,
};

const bodyStyle: CSSProperties = {
  padding: "12px 14px 14px",
};

const listStyle: CSSProperties = {
  listStyle: "none",
  margin: 0,
  padding: 0,
  display: "flex",
  flexDirection: "column",
  gap: 6,
};

const groupHeaderStyle: CSSProperties = {
  fontSize: 10,
  fontWeight: 700,
  color: C.woodMid,
  letterSpacing: "0.12em",
  padding: "3px 2px",
  marginBottom: 4,
  borderBottom: `1px solid ${C.gold}55`,
  textTransform: "uppercase" as const,
};

const badgeStyle: CSSProperties = {
  fontSize: 10,
  color: C.mutedText,
  background: `${C.parchmentDark}cc`,
  border: `1px solid ${C.goldDim}55`,
  borderRadius: 3,
  padding: "1px 5px",
  whiteSpace: "nowrap" as const,
};

const ownedTagStyle: CSSProperties = {
  fontSize: 11,
  fontWeight: 600,
  color: C.gold,
};

const priceStyle: CSSProperties = {
  color: C.darkText,
  fontVariantNumeric: "tabular-nums",
  fontWeight: 700,
  fontSize: 14,
  textAlign: "right" as const,
  lineHeight: 1,
};

function buyBtnStyle(enabled: boolean): CSSProperties {
  return {
    fontSize: 12,
    fontWeight: 700,
    padding: "5px 10px",
    borderRadius: 5,
    border: `1px solid ${enabled ? C.gold : C.parchmentShadow}`,
    background: enabled
      ? `linear-gradient(180deg, ${C.goldBright}cc 0%, ${C.gold}cc 100%)`
      : `${C.parchmentDark}88`,
    color: enabled ? C.wood : C.dimText,
    cursor: enabled ? "pointer" : "not-allowed",
    whiteSpace: "nowrap" as const,
  };
}
