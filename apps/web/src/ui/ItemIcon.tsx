"use client";
/**
 * ItemIcon — 아이템/무기 아이콘(드롭-인 + 폴백). 초상(AssetImage)과 동형 규약.
 *
 * `/assets/ui/items/{itemId}.webp` 가 있으면 표시, 없으면 카테고리색·심볼 박스로 폴백
 * (`<img onError>`). 보드에서 아이콘 시트를 생성·슬라이스하면 새로고침 시 자동 반영 —
 * 표시측 코드 수정 0. 상점·편성 장착·상인·도감·결산 보물에서 공용.
 */
import { useEffect, useRef, useState } from "react";
import { assetUrl } from "../assetUrl";

/** 카테고리 → 폴백 심볼·색(단색 — 청동/수묵 톤과 충돌하는 컬러 이모지 회피). */
const CATEGORY_FALLBACK: Record<string, { sym: string; color: string }> = {
  weapon: { sym: "⚔", color: "#ff8a5b" },
  treasure: { sym: "◆", color: "#ffd76a" },
  supplyItem: { sym: "✚", color: "#7bd88f" },
  attackItem: { sym: "✷", color: "#ff6b6b" },
  book: { sym: "✦", color: "#b890ff" },
  horse: { sym: "♞", color: "#cdab6e" },
};
const DEFAULT_FALLBACK = { sym: "▪", color: "#cdab6e" };

export function ItemIcon({
  itemId,
  category,
  size = 34,
  style,
}: {
  /** items.json 키(=파일명). 한글/kebab 혼재 — encodeURIComponent로 처리. */
  itemId: string;
  /** 폴백 심볼·색 선택용(weapon/treasure/supplyItem/attackItem/book/horse). */
  category?: string;
  size?: number;
  style?: React.CSSProperties;
}): React.ReactElement {
  const [failed, setFailed] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);
  useEffect(() => {
    setFailed(false); // id 바뀌면 재시도
    // onError 레이스 방어: React가 핸들러를 붙이기 전에 빠른 404가 끝나면 onError를 놓친다.
    // 마운트 후 이미 에러난 img(로드 완료 && 폭 0)를 직접 감지해 폴백으로 전환.
    const img = imgRef.current;
    if (img && img.complete && img.naturalWidth === 0) setFailed(true);
  }, [itemId]);

  const fb = (category && CATEGORY_FALLBACK[category]) || DEFAULT_FALLBACK;
  const box: React.CSSProperties = {
    width: size,
    height: size,
    flexShrink: 0,
    borderRadius: 6,
    border: `1px solid ${fb.color}55`,
    background: "rgba(0,0,0,0.30)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    ...style,
  };

  if (failed || !itemId) {
    return (
      <div style={{ ...box, color: fb.color, fontSize: size * 0.5 }} aria-hidden>
        {fb.sym}
      </div>
    );
  }
  return (
    <div style={box}>
      <img
        ref={imgRef}
        src={assetUrl(`/assets/ui/items/${encodeURIComponent(itemId)}.webp`)}
        alt=""
        onError={() => setFailed(true)}
        style={{ width: "100%", height: "100%", objectFit: "contain", display: "block" }}
      />
    </div>
  );
}
