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
import { PANEL_FRAME } from "../../battle/hud/frames";
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

// --- 청동+수묵 팔레트(frames.ts 톤과 일치, 막간 화면 공용) ---
const C = {
  ink: "#e8e0cf", // 본문 글자(낡은 종이톤)
  inkDim: "#9aa3ad", // 보조 글자
  bronze: "#c9a24b", // 강조(가격/제목)
  bg: "rgba(20,18,14,0.55)", // 패널 안쪽 어둠
  rowBg: "rgba(40,34,24,0.5)",
  rowOwned: "rgba(70,58,30,0.55)",
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
      <header style={headerStyle}>
        <h2 style={titleStyle}>{shop.name}</h2>
        <div style={headerRightStyle}>
          {/* 광고 보고 +골드(§13 shop_gold) — adFree면 RewardedAdButton이 null 반환(미표시).
              완주 시 *확정* 소액 골드 충전, 일일 캡 도달 시 "오늘 마감"으로 비활성. */}
          <RewardedAdButton
            placement="shop_gold"
            label={`광고 보고 +${AD_GOLD_REWARD}골드`}
            capReached={!canWatchGoldAd()}
            onReward={handleAdGold}
          />
          <span style={goldStyle} aria-label="보유 자금">
            <span style={{ color: C.inkDim, fontSize: 12, marginRight: 4 }}>자금</span>
            {gold.toLocaleString()}
          </span>
        </div>
      </header>

      {rows.length === 0 ? (
        <p style={{ color: C.inkDim, margin: "8px 4px" }}>진열 중인 물품이 없습니다.</p>
      ) : (
        buildShopGroups(rows).map((group) => (
          <div key={group.category} style={{ marginBottom: 10 }}>
            <div style={groupHeaderStyle}>{group.label}</div>
            <ul style={listStyle}>
              {group.rows.map((row) => (
                <ShopRowView key={row.itemId} row={row} onBuy={() => handleBuy(row)} />
              ))}
            </ul>
          </div>
        ))
      )}
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
    padding: "8px 10px",
    borderRadius: 6,
    background: row.owned > 0 ? C.rowOwned : C.rowBg,
  };
  return (
    <li style={rowStyle}>
      <ItemIcon itemId={row.itemId} category={row.category} size={36} />
      <span style={badgeStyle}>{row.categoryLabel}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ color: C.ink, fontWeight: 600, fontSize: 15 }}>
          {row.name}
          {row.owned > 0 && (
            <span style={ownedTagStyle}>보유 {row.owned > 1 ? `×${row.owned}` : ""}</span>
          )}
        </div>
        <div style={{ color: C.inkDim, fontSize: 12 }}>
          {row.effect}
          {row.consumable && <span style={{ marginLeft: 6, opacity: 0.7 }}>· 소모품</span>}
        </div>
      </div>
      <span style={priceStyle} aria-label="가격">
        {row.price.toLocaleString()}
      </span>
      <button
        type="button"
        onClick={onBuy}
        disabled={!row.affordable}
        style={buyBtnStyle(row.affordable)}
        aria-label={`${row.name} 구매`}
      >
        {row.affordable ? "구매" : "자금 부족"}
      </button>
    </li>
  );
}

// --- 스타일 ---
const panelStyle: CSSProperties = {
  ...PANEL_FRAME,
  background: C.bg,
  backgroundClip: "padding-box",
  padding: 14,
  color: C.ink,
};

const headerStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  marginBottom: 10,
  gap: 8,
  flexWrap: "wrap",
};

// 제목 우측: [광고 보고 +골드] 버튼 + 보유 자금. 좁은 폭에서 줄바꿈 허용.
const headerRightStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 12,
};

const titleStyle: CSSProperties = {
  margin: 0,
  fontSize: 18,
  color: C.bronze,
  letterSpacing: "0.04em",
};

const goldStyle: CSSProperties = {
  color: C.bronze,
  fontVariantNumeric: "tabular-nums",
  fontWeight: 700,
  fontSize: 16,
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
  fontSize: 11,
  color: C.bronze,
  letterSpacing: "0.08em",
  padding: "4px 2px",
  marginBottom: 2,
  borderBottom: "1px solid rgba(202,168,106,0.2)",
};

const badgeStyle: CSSProperties = {
  flex: "0 0 auto",
  fontSize: 11,
  color: C.ink,
  background: "rgba(0,0,0,0.35)",
  border: `1px solid ${C.bronze}`,
  borderRadius: 4,
  padding: "2px 6px",
  whiteSpace: "nowrap",
};

const ownedTagStyle: CSSProperties = {
  marginLeft: 8,
  fontSize: 11,
  fontWeight: 400,
  color: C.bronze,
};

const priceStyle: CSSProperties = {
  flex: "0 0 auto",
  color: C.bronze,
  fontVariantNumeric: "tabular-nums",
  fontWeight: 600,
  fontSize: 14,
  minWidth: 48,
  textAlign: "right",
};

function buyBtnStyle(enabled: boolean): CSSProperties {
  return {
    flex: "0 0 auto",
    fontSize: 13,
    fontWeight: 600,
    padding: "6px 12px",
    borderRadius: 6,
    border: `1px solid ${enabled ? C.bronze : "#555"}`,
    background: enabled ? "rgba(201,162,75,0.18)" : "rgba(60,60,60,0.3)",
    color: enabled ? C.bronze : "#777",
    cursor: enabled ? "pointer" : "not-allowed",
    whiteSpace: "nowrap",
  };
}
