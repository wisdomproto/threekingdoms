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
import styles from "./Shop.module.css";
import type { Shop as ShopData, Item } from "@tk/data";
import { getMeta, spendGold, addItem, addGold, canWatchGoldAd, recordAdGold } from "../metaStore";
import { RewardedAdButton } from "../RewardedAdButton";
import { buildShopRows, buildShopGroups, effectLines, type ShopRow } from "./shopItemView";
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
  // 아이템 상세 팝업(2026-07-03 피드백 — "이미지 누르면 크게 + 수치 설명").
  // id로 들고 rows에서 파생 — 구매 후에도 보유/잔액이 최신으로 따라온다.
  const [detailId, setDetailId] = useState<string | null>(null);

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
    setNotice(`${row.name} 1개를 구매했습니다.`);
    setTick((t) => t + 1); // 보유 수량 갱신
    onPurchase?.(row.itemId); // 부모가 gold/inventory 재조회
  }

  // 광고 골드 충전(§13 shop_gold) — 완주 시에만 호출. *확정* 소액 골드 + 일일 캡 기록.
  // 골드 지급(addGold)과 캡 기록(recordAdGold)은 분리돼 있어 둘 다 호출해야 한다.
  function handleAdGold(): void {
    addGold(AD_GOLD_REWARD);
    recordAdGold();
    setNotice(`자금 ${AD_GOLD_REWARD} 금을 받았습니다.`);
    setTick((t) => t + 1); // 캡/affordable 재평가
    onPurchase?.(""); // 부모가 보유 자금(gold prop) 재조회 — itemId 없는 잔액 갱신 신호
  }

  const [category, setCategory] = useState<string>("all");
  const [notice, setNotice] = useState("");
  const groups = buildShopGroups(rows);
  const visibleRows = category === "all" ? rows : rows.filter((row) => row.category === category);
  const detail = visibleRows.find((row) => row.itemId === detailId) ?? visibleRows[0];

  return (
    <section className={styles.shop} aria-label="상점">
      <header className={styles.header}>
        <div><h2>{shop.name}</h2><p>출진에 필요한 장비와 도구를 준비하세요.</p></div>
        <div className={styles.wallet} aria-label="보유 자금"><span>보유 자금</span><strong>{gold.toLocaleString()} <small>금</small></strong></div>
      </header>
      <div className={styles.layout}>
        <div className={styles.catalog}>
          <nav className={styles.filters} aria-label="상품 분류">
            {[{ category: "all", label: "전체" }, ...groups].map((group) => (
              <button key={group.category} type="button" aria-pressed={category === group.category}
                onClick={() => setCategory(group.category)}>{group.label}</button>
            ))}
          </nav>
          <div className={styles.grid}>
            {visibleRows.map((row) => (
              <button key={row.itemId} type="button" className={styles.card}
                aria-label={`${row.name} 상세 보기`} aria-pressed={detail?.itemId === row.itemId}
                onClick={() => setDetailId(row.itemId)}>
                <span className={styles.category}>{row.categoryLabel}</span>
                <ItemIcon itemId={row.itemId} category={row.category} size={100}
                  style={{ background: "transparent", border: 0 }} />
                <strong>{row.name}</strong>
                <span className={styles.effect}>{effectLines(items[row.itemId]!)[0] ?? row.effect}</span>
                <span className={styles.cardBottom}><b>{row.price.toLocaleString()} 금</b><span>보유 {row.owned}</span></span>
              </button>
            ))}
          </div>
          {!visibleRows.length && <p>진열 중인 물품이 없습니다.</p>}
        </div>
        {detail && <aside className={styles.detail} aria-label="선택 상품 상세">
          <div className={styles.hero}><ItemIcon key={detail.itemId} itemId={detail.itemId} category={detail.category} size={172}
            style={{ border: 0, background: "transparent" }} /></div>
          <span className={styles.category}>{detail.categoryLabel}</span>
          <h3>{detail.name}</h3>
          <ul>{effectLines(items[detail.itemId]!).map((line) => <li key={line}>{line}</li>)}</ul>
          <p className={styles.usage}>{detail.consumable ? "구매한 도구는 부대 소지품에 보관됩니다. 전투 중 아군 누구나 사용할 수 있습니다." : "구매한 장비는 편성 화면에서 장수를 선택해 장착할 수 있습니다."}</p>
          <dl><div><dt>보유 수량</dt><dd>{detail.owned}개</dd></div><div><dt>구매 가격</dt><dd>{detail.price.toLocaleString()} 금</dd></div></dl>
          <button type="button" className={styles.buy} disabled={!detail.affordable}
            aria-label={`${detail.name} 구매`} onClick={() => handleBuy(detail)}>
            {detail.affordable ? "1개 구매" : `${Math.max(0, detail.price - gold).toLocaleString()} 금 부족`}
          </button>
          <p className={styles.notice} role="status">{notice}</p>
        </aside>}
      </div>
      <footer className={styles.footer}><span>자금이 부족한가요?</span><RewardedAdButton placement="shop_gold" label={`자금 ${AD_GOLD_REWARD} 금 받기`} capReached={!canWatchGoldAd()} onReward={handleAdGold} /></footer>
    </section>
  );
}
