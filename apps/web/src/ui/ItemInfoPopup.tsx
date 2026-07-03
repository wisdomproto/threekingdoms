"use client";
/**
 * ItemInfoPopup — 아이템 상세 오버레이(잉크+청동 톤, 구매 없음 · 정보 전용).
 * 결산 획득 보물(2026-07-03 피드백 "호버/클릭하면 자세히"), 도감 등 어두운 화면 공용.
 * (상점의 ItemDetailPopup은 양피지 톤+구매 버튼이라 별도 — 톤/행동이 달라 합치지 않는다.)
 * 효과 풀이는 shopItemView.effectLines(순수)와 공유 — 상점 팝업과 문구가 항상 일치.
 */
import { gameData } from "@tk/data";
import { CATEGORY_LABEL, effectLines } from "../meta/screens/shopItemView";
import { ItemIcon } from "./ItemIcon";

const INK = "#161210";
const INK_DEEP = "#0c0a08";
const BRONZE_GOLD = "#cdab6e";
const BRONZE_DIM = "#8a7350";
const PARCHMENT = "#e8dcc0";

export function ItemInfoPopup({
  itemId,
  onClose,
  actionLabel,
  onAction,
  note,
}: {
  itemId: string;
  onClose: () => void;
  /** 지정 시 닫기 옆에 금테 행동 버튼(장착/해제 등) — 탭하면 onAction 후 닫힌다 */
  actionLabel?: string;
  onAction?: () => void;
  /** 효과 아래 보조 안내 한 줄(전력 변화·교체 대상 등) */
  note?: string;
}): React.ReactElement | null {
  const item = gameData.items[itemId];
  if (!item) return null;
  const lines = effectLines(item);
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`${item.name} 상세`}
      onClick={(e) => {
        e.stopPropagation(); // 부모 오버레이(결산 스킵 등)의 클릭 동작과 분리
        onClose();
      }}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 95,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
        boxSizing: "border-box",
        background: "rgba(6, 5, 4, 0.66)",
        fontFamily: '"Noto Serif KR", "Nanum Myeongjo", "Apple SD Gothic Neo", serif',
        cursor: "default",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "min(320px, 88vw)",
          borderRadius: 12,
          border: `1px solid ${BRONZE_DIM}88`,
          background: `linear-gradient(160deg, ${INK} 0%, ${INK_DEEP} 100%)`,
          boxShadow: "0 14px 44px rgba(0,0,0,0.6), inset 0 0 24px rgba(205,171,110,0.06)",
          color: PARCHMENT,
          padding: "18px 18px 16px",
          display: "flex",
          flexDirection: "column",
          gap: 12,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <ItemIcon
            itemId={itemId}
            category={item.category}
            size={64}
            style={{ borderRadius: 10, border: `1px solid ${BRONZE_DIM}66`, flexShrink: 0 }}
          />
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 17, fontWeight: 700, color: BRONZE_GOLD, letterSpacing: "0.04em" }}>
              {item.name}
            </div>
            <div style={{ fontSize: 11.5, color: BRONZE_DIM, marginTop: 2 }}>
              {CATEGORY_LABEL[item.category] ?? item.category}
            </div>
          </div>
        </div>

        <ul style={{ listStyle: "none", margin: 0, padding: "2px 0 0", display: "flex", flexDirection: "column", gap: 5 }}>
          {(lines.length ? lines : ["고유 효과 — 지니고 있으면 힘이 된다"]).map((line) => (
            <li key={line} style={{ fontSize: 13, display: "flex", gap: 7, alignItems: "baseline" }}>
              <span style={{ color: BRONZE_GOLD, fontSize: 10 }}>◆</span>
              {line}
            </li>
          ))}
        </ul>

        {note && (
          <div style={{
            fontSize: 11.5, color: BRONZE_DIM, textAlign: "center",
            borderTop: `1px solid ${BRONZE_DIM}44`, paddingTop: 8, marginTop: 2,
          }}>
            {note}
          </div>
        )}

        <div style={{ display: "flex", gap: 8, justifyContent: "center", marginTop: 2 }}>
          {actionLabel && onAction && (
            <button
              type="button"
              onClick={() => { onAction(); onClose(); }}
              style={{
                padding: "7px 22px",
                borderRadius: 8,
                border: `1.5px solid ${BRONZE_GOLD}`,
                background: "rgba(205, 171, 110, 0.16)",
                color: BRONZE_GOLD,
                fontSize: 13,
                fontWeight: 700,
                letterSpacing: "0.15em",
                cursor: "pointer",
                fontFamily: "inherit",
              }}
            >
              {actionLabel}
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: "7px 22px",
              borderRadius: 8,
              border: `1px solid ${BRONZE_DIM}`,
              background: "rgba(40, 32, 20, 0.7)",
              color: PARCHMENT,
              fontSize: 13,
              letterSpacing: "0.15em",
              cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  );
}
