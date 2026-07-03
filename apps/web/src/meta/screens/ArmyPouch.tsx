"use client";
/**
 * ArmyPouch — 「부대 소지품(창고)」 패널. 원작 창고(§7): 소모품은 유닛에 장착하지 않고
 * 부대 전체가 공유하며 전투 중 「도구」로 꺼내 쓴다. 편성에서 이번 출진에 들고 갈 재고를 보여준다.
 * 칩 탭 = 효과 상세(ItemInfoPopup, 정보 전용). 장착 개념 없음.
 */
import { useMemo, useState } from "react";
import { gameData } from "@tk/data";
import { ItemIcon } from "../../ui/ItemIcon";
import { ItemInfoPopup } from "../../ui/ItemInfoPopup";
import { INK_PANEL, GOLD, GOLD_BRIGHT, GOLD_DIM, DIM_TEXT, PARCHMENT, SEAL_RED, SERIF } from "./formationUi";

/** id 목록 → {id, count} 집계(보유 순서 유지). */
function aggregate(ids: readonly string[]): { id: string; count: number }[] {
  const order: string[] = [];
  const count = new Map<string, number>();
  for (const id of ids) {
    if (!count.has(id)) order.push(id);
    count.set(id, (count.get(id) ?? 0) + 1);
  }
  return order.map((id) => ({ id, count: count.get(id)! }));
}

export function ArmyPouch({ consumables }: { consumables: readonly string[] }): React.ReactElement {
  const items = gameData.items;
  const rows = useMemo(() => aggregate(consumables), [consumables]);
  const [infoId, setInfoId] = useState<string | null>(null);

  return (
    <div style={{
      background: INK_PANEL,
      border: `1px solid ${GOLD_DIM}88`,
      borderRadius: 8,
      padding: "9px 12px 11px",
      fontFamily: SERIF,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
        <span style={{
          width: 20, height: 20, borderRadius: 4, flexShrink: 0,
          background: `linear-gradient(135deg, ${SEAL_RED}, #6a1e14)`,
          border: "1px solid rgba(0,0,0,0.5)",
          display: "inline-flex", alignItems: "center", justifyContent: "center",
          fontSize: 12, fontWeight: 900, color: "#f0e2c8",
        }}>庫</span>
        <span style={{ fontSize: 12.5, fontWeight: 700, color: GOLD_BRIGHT, letterSpacing: "0.1em" }}>
          부대 소지품
        </span>
        <span style={{ fontSize: 10.5, color: DIM_TEXT }}>
          전투 중 「도구」로 아무 아군이나 사용 (부대 공유)
        </span>
      </div>

      {rows.length === 0 ? (
        <div style={{ fontSize: 11.5, color: DIM_TEXT, padding: "4px 2px" }}>
          소지한 도구가 없습니다 — 상점에서 회복약·공격도구를 구입하세요.
        </div>
      ) : (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {rows.map(({ id, count }) => (
            <button
              key={id}
              type="button"
              onClick={() => setInfoId(id)}
              title={`${items[id]?.name ?? id} — 상세`}
              style={{
                display: "inline-flex", alignItems: "center", gap: 5,
                fontSize: 11.5, padding: "3px 8px 3px 4px", borderRadius: 10,
                border: `1px solid ${GOLD_DIM}66`, background: "rgba(255,255,255,0.05)",
                color: PARCHMENT, cursor: "pointer", fontFamily: "inherit",
              }}
            >
              <ItemIcon itemId={id} category={items[id]?.category} size={20} />
              {items[id]?.name ?? id}
              <span style={{
                fontSize: 10.5, fontWeight: 800, color: GOLD,
                borderRadius: 8, padding: "0 5px", background: "rgba(200,164,64,0.14)",
              }}>×{count}</span>
            </button>
          ))}
        </div>
      )}

      {infoId && <ItemInfoPopup itemId={infoId} onClose={() => setInfoId(null)} />}
    </div>
  );
}
