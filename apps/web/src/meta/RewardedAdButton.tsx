"use client";
/**
 * RewardedAdButton — 리워드 광고 1개 버튼(§13 4곳 공용). 적용처(결산/상점/기연/상인)가 placement만
 * 바꿔 재사용한다. "▶광고" 톤 + 청동/수묵(frames.ts BUTTON_FRAME).
 *
 * 가드레일(§13):
 *  - adFree면 **렌더하지 않는다**(null) — 광고제거 유저에게 버튼조차 안 보인다.
 *  - 클릭 → showRewarded(placement) → true일 때만 onReward(). false(닫음/adFree)면 무손실.
 *  - onReward는 *골드/표현*만 줘야 한다(전투력 랜덤 금지 — 호출부 책임). 이 컴포넌트는 보상을
 *    지급하지 않고 콜백만 호출한다.
 *  - capReached(일일 캡 도달 — 상점 골드용)면 disabled. 진행은 막지 않으므로 캡은 버튼 비활성일 뿐.
 *
 * 적용 예:
 *   <RewardedAdButton placement="shop_gold" label="광고 보고 +100골드"
 *     capReached={!canWatchGoldAd()}
 *     onReward={() => { addGold(100); recordAdGold(); }} />
 */
import { useState } from "react";
import { BUTTON_FRAME } from "../battle/hud/frames";
import { getAdService, type AdPlacement } from "./adService";
import { isAdFree } from "./metaStore";

export interface RewardedAdButtonProps {
  placement: AdPlacement;
  label: string;
  /** 광고 완주(true) 시 호출. 골드/표현 보상만(전투력 랜덤 금지). */
  onReward: () => void;
  /** 외부 사유로 비활성(예: 보상 대상 없음). */
  disabled?: boolean;
  /** 일일 캡 도달(상점 골드 충전 §13). true면 비활성 + "오늘 마감" 표기. */
  capReached?: boolean;
}

const BRONZE_GOLD = "#cdab6e";
const BRONZE_DIM = "#8a7350";

export function RewardedAdButton({
  placement,
  label,
  onReward,
  disabled = false,
  capReached = false,
}: RewardedAdButtonProps): React.ReactElement | null {
  const [busy, setBusy] = useState(false);

  // adFree면 광고 진입점 자체를 숨긴다(렌더 시점 1회 판정 — 토글은 화면 전환으로 갱신).
  if (isAdFree()) return null;

  const blocked = disabled || capReached || busy;

  async function onClick(): Promise<void> {
    if (blocked) return;
    setBusy(true);
    try {
      const ok = await getAdService().showRewarded(placement);
      if (ok) onReward(); // 완주 시에만 보상(거부=무손실)
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      disabled={blocked}
      onClick={onClick}
      aria-label={label}
      style={{
        ...BUTTON_FRAME,
        background: "transparent",
        color: blocked ? "#5a5142" : BRONZE_GOLD,
        fontFamily: '"Noto Serif KR", "Nanum Myeongjo", serif',
        fontSize: 15,
        letterSpacing: "0.08em",
        padding: "8px 14px",
        cursor: blocked ? "default" : "pointer",
        opacity: blocked ? 0.5 : 1,
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        fontWeight: 700,
      }}
    >
      <span aria-hidden style={{ color: blocked ? "#5a5142" : BRONZE_DIM, fontSize: 12 }}>
        ▶ 광고
      </span>
      <span>{busy ? "광고 재생 중…" : capReached ? "오늘 마감" : label}</span>
    </button>
  );
}
