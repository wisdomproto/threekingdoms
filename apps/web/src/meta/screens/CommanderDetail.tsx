"use client";
/**
 * CommanderDetail — 편성 우측 「선택된 장수 상세」 (2026-07-03 v2.1 레퍼런스 정리).
 * 레퍼런스처럼 **초상(전장 비네트) → 이름/인장/Lv/병종 → 스탯 3줄 → 장비 슬롯**만. 잡다 제거:
 * 소지품 리스트·별·해제경고·배치버튼을 패널 밖으로 빼 정보 위계를 단순화.
 *
 * 장비 편집: 빈 슬롯 탭 = 아이템 선택 팝업(SlotPicker), 찬 슬롯 탭 = 효과+해제 팝업(ItemInfoPopup).
 * 배치 여부와 무관하게 편집 가능(setEquipped로 영속 — 배치 중이면 셸이 member도 갱신).
 */
import { useMemo, useState } from "react";
import { gameData } from "@tk/data";
import type { RosterUnit } from "../metaStore";
import type { SortieMember } from "../sortie";
import { unitStats } from "../unitStats";
import { effectText } from "./shopItemView";
import { ItemIcon } from "../../ui/ItemIcon";
import { ItemInfoPopup } from "../../ui/ItemInfoPopup";
import { CommanderPortrait } from "../../ui/CommanderPortrait";
import { applyEquip, buildSlotView, slotOf, SLOT_LABEL, type EquipSlot } from "../equipSlots";
import {
  PARCHMENT, INK_PANEL, GOLD, GOLD_BRIGHT, GOLD_DIM, GOLD_GLOW, DIM_TEXT, SEAL_RED, SERIF,
  ROLE_ICON, commanderName, className,
} from "./formationUi";

export interface StatMax { atk: number; def: number; spirit: number }

export interface CommanderDetailProps {
  unit: RosterUnit;
  /** 배치된 경우 그 SortieMember(장비 편집 실시간 반영). 미배치면 null. */
  member: SortieMember | null;
  /** 스탯 바 정규화 기준(로스터 전체 최대치) */
  statMax: StatMax;
  inventory: string[];
  equippedCount: Map<string, number>;
  onEquip: (items: string[]) => void;
  /** 모바일 바텀시트에서만 — 지정 시 우상단 ✕ */
  onClose?: () => void;
}

function StatBar({ label, value, max, color }: {
  label: string; value: number; max: number; color: string;
}): React.ReactElement {
  const pct = max > 0 ? Math.max(5, Math.round((value / max) * 100)) : 0;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
      <span style={{ fontSize: 12, color: "#c8b48a", width: 30, flexShrink: 0, letterSpacing: "0.1em" }}>
        {label}
      </span>
      <div style={{
        flex: 1, height: 10, borderRadius: 5, overflow: "hidden",
        background: "rgba(0,0,0,0.5)", border: "1px solid rgba(0,0,0,0.55)",
        boxShadow: "inset 0 1px 2px rgba(0,0,0,0.55)",
      }}>
        <div style={{
          width: `${pct}%`, height: "100%",
          background: `linear-gradient(to bottom, ${color}, ${color}bb)`,
          boxShadow: "inset 0 1px 0 rgba(255,255,255,0.28)",
        }} />
      </div>
      <span style={{ fontSize: 13.5, fontWeight: 700, color: PARCHMENT, width: 34, textAlign: "right", flexShrink: 0 }}>
        {value}
      </span>
    </div>
  );
}

/** 장비 슬롯 1칸 — 정사각(레퍼런스). 채움=아이콘(탭 상세/해제), 빈칸=+ 점선(탭 선택 팝업).
 *  editable=false(미배치)면 빈칸은 비활성(탭 무반응), 찬칸은 읽기전용 상세만. */
function SlotBox({ slot, id, editable, onTapFilled, onTapEmpty }: {
  slot: EquipSlot; id: string | null; editable: boolean;
  onTapFilled: (itemId: string) => void; onTapEmpty: (slot: EquipSlot) => void;
}): React.ReactElement {
  const item = id ? gameData.items[id] : undefined;
  const clickable = id != null || editable; // 찬칸은 항상(상세), 빈칸은 editable일 때만
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 5, alignItems: "center", flex: 1, minWidth: 0 }}>
      <span style={{ fontSize: 11, letterSpacing: "0.14em", color: "#b8a070" }}>{SLOT_LABEL[slot]}</span>
      <button
        type="button"
        disabled={!clickable}
        onClick={() => (id ? onTapFilled(id) : onTapEmpty(slot))}
        title={item ? `${item.name} — 상세` : editable ? `${SLOT_LABEL[slot]} 장착` : ""}
        style={{
          position: "relative", width: "100%", aspectRatio: "1", borderRadius: 9, padding: 0,
          border: id ? `1.5px solid ${GOLD}99` : `1.5px dashed ${GOLD_DIM}66`,
          background: id
            ? "linear-gradient(160deg, rgba(64,48,22,0.9), rgba(26,18,9,0.96))"
            : "rgba(0,0,0,0.32)",
          boxShadow: id ? `inset 0 0 12px ${GOLD_GLOW}` : "none",
          display: "flex", alignItems: "center", justifyContent: "center",
          cursor: clickable ? "pointer" : "default",
        }}
      >
        {id ? (
          <ItemIcon itemId={id} category={item?.category} size={38} />
        ) : (
          <span style={{ fontSize: 24, color: GOLD_DIM, opacity: editable ? 0.55 : 0.28, lineHeight: 1 }}>+</span>
        )}
      </button>
      <span style={{
        fontSize: 9.5, color: item ? PARCHMENT : "transparent", textAlign: "center", maxWidth: "100%",
        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minHeight: 12,
      }}>
        {item?.name ?? "—"}
      </span>
    </div>
  );
}

/** 빈 슬롯 탭 시 — 그 슬롯에 낄 수 있는 소지 장비 목록 팝업(효과·전력 델타, 탭=장착). */
function SlotPicker({ slot, candidates, unit, currentItems, onPick, onClose }: {
  slot: EquipSlot; candidates: string[]; unit: RosterUnit;
  currentItems: readonly string[]; onPick: (itemId: string) => void; onClose: () => void;
}): React.ReactElement {
  const items = gameData.items;
  const base = unitStats(unit.commanderId, unit.classId, unit.level, [...currentItems]).power;
  return (
    <div
      role="dialog" aria-modal="true" aria-label={`${SLOT_LABEL[slot]} 장착`}
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 95, display: "flex", alignItems: "center", justifyContent: "center",
        padding: 20, boxSizing: "border-box", background: "rgba(6,5,4,0.66)", fontFamily: SERIF,
      }}
    >
      <div onClick={(e) => e.stopPropagation()} style={{
        width: "min(340px, 90vw)", maxHeight: "70vh", overflowY: "auto",
        borderRadius: 12, border: `1px solid ${GOLD_DIM}88`,
        background: `linear-gradient(160deg, #161210, #0c0a08)`,
        boxShadow: "0 14px 44px rgba(0,0,0,0.6)", color: PARCHMENT, padding: "16px 16px 14px",
      }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: GOLD_BRIGHT, letterSpacing: "0.08em", marginBottom: 10 }}>
          {SLOT_LABEL[slot]} 장착
        </div>
        {candidates.length === 0 ? (
          <div style={{ fontSize: 12.5, color: DIM_TEXT, padding: "8px 2px 4px", lineHeight: 1.5 }}>
            장착할 수 있는 {SLOT_LABEL[slot]}이(가) 없습니다. 상점에서 구입하세요.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {candidates.map((id) => {
              const it = items[id];
              const next = unitStats(unit.commanderId, unit.classId, unit.level, [...applyEquip(currentItems, id, items)]).power;
              const delta = next - base;
              const fx = it ? effectText(it) : "";
              return (
                <button key={id} type="button" onClick={() => { onPick(id); onClose(); }}
                  style={{
                    display: "flex", alignItems: "center", gap: 10, textAlign: "left",
                    padding: "7px 9px", borderRadius: 9, fontFamily: "inherit",
                    border: `1px solid ${GOLD_DIM}55`, background: "rgba(255,255,255,0.04)",
                    color: PARCHMENT, cursor: "pointer",
                  }}
                >
                  <ItemIcon itemId={id} category={it?.category} size={34} style={{ flexShrink: 0 }} />
                  <span style={{ minWidth: 0, flex: 1 }}>
                    <span style={{ fontSize: 13, fontWeight: 700, display: "block" }}>{it?.name ?? id}</span>
                    {fx && <span style={{ fontSize: 11, color: "#b8a070" }}>{fx}</span>}
                  </span>
                  {delta !== 0 && (
                    <span style={{ fontSize: 12, fontWeight: 800, flexShrink: 0, color: delta > 0 ? "#7fc26a" : "#d07a5a" }}>
                      {delta > 0 ? `+${delta}` : delta}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}
        <button type="button" onClick={onClose} style={{
          marginTop: 12, width: "100%", padding: "8px 0", borderRadius: 8, fontFamily: "inherit",
          border: `1px solid ${GOLD_DIM}`, background: "rgba(40,32,20,0.7)", color: PARCHMENT,
          fontSize: 13, letterSpacing: "0.15em", cursor: "pointer",
        }}>닫기</button>
      </div>
    </div>
  );
}

export function CommanderDetail({
  unit, member, statMax, inventory, equippedCount, onEquip, onClose,
}: CommanderDetailProps): React.ReactElement {
  const items = gameData.items;
  const deployed = member != null;
  const equippedIds = deployed ? member.items : unit.equipped;
  const view = buildSlotView(equippedIds, items);
  const stats = unitStats(unit.commanderId, unit.classId, unit.level, [...equippedIds]);
  const [infoId, setInfoId] = useState<string | null>(null); // 찬 슬롯 상세(해제)
  const [pickSlot, setPickSlot] = useState<EquipSlot | null>(null); // 빈 슬롯 선택 팝업

  // 슬롯별 장착 후보 = 그 슬롯에 맞는 미장착 소지 장비.
  const bySlot = useMemo(() => {
    const owned = new Map<string, number>();
    for (const it of inventory) owned.set(it, (owned.get(it) ?? 0) + 1);
    const out: Record<EquipSlot, string[]> = { arms: [], mount: [], relic: [] };
    for (const [id, n] of owned) {
      const s = slotOf(items[id]?.category);
      if (!s) continue; // 소모품 등 제외
      if (n - (equippedCount.get(id) ?? 0) <= 0) continue; // 재고 없음
      out[s].push(id);
    }
    return out;
  }, [inventory, equippedCount, items]);

  const unequip = (itemId: string): void => {
    const n = [...equippedIds];
    const i = n.indexOf(itemId);
    if (i >= 0) { n.splice(i, 1); onEquip(n); }
  };
  const equip = (itemId: string): void => {
    const next = applyEquip(equippedIds, itemId, items);
    if (next !== equippedIds) onEquip([...next]);
  };

  const name = commanderName(unit.commanderId);
  const sealChar = ROLE_ICON[unit.role] ?? "兵";

  return (
    <div style={{
      background: INK_PANEL,
      border: `1.5px solid ${GOLD_DIM}aa`,
      borderRadius: 10,
      overflow: "hidden",
      boxShadow: "0 8px 28px rgba(0,0,0,0.35), inset 0 0 0 1px rgba(200,164,64,0.12)",
      fontFamily: SERIF,
      display: "flex", flexDirection: "column",
    }}>
      {/* ── 히어로: 전장 비네트 배경 위 초상 + 하단 명판(레퍼런스 그랜드 톤) ── */}
      <div style={{ position: "relative", height: 208, flexShrink: 0, overflow: "hidden" }}>
        {/* 따뜻한 전장 비네트 */}
        <div aria-hidden style={{
          position: "absolute", inset: 0,
          background: "radial-gradient(115% 90% at 50% 22%, rgba(122,68,36,0.55), rgba(24,16,9,0.5) 62%, rgba(12,8,4,0.96) 100%)",
        }} />
        {/* 초상 — 세로비 유지 중앙 배치(흉상 정상 표시, 와이드 크롭 금지) */}
        <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
          <div style={{ height: "100%", aspectRatio: "3 / 3.5", maxWidth: "78%" }}>
            <CommanderPortrait commanderId={unit.commanderId} name={name} />
          </div>
        </div>
        {/* 하단 스크림 + 명판 */}
        <div style={{
          position: "absolute", left: 0, right: 0, bottom: 0, padding: "24px 14px 10px",
          background: "linear-gradient(to top, rgba(10,7,4,0.94) 20%, rgba(10,7,4,0.55) 60%, transparent)",
          display: "flex", flexDirection: "column", gap: 7,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{
              fontSize: 26, fontWeight: 800, color: PARCHMENT, lineHeight: 1,
              textShadow: "0 2px 8px rgba(0,0,0,0.85)", letterSpacing: "0.08em",
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
            }}>{name}</span>
            <span style={{
              width: 23, height: 23, borderRadius: 4, flexShrink: 0,
              background: `linear-gradient(135deg, ${SEAL_RED}, #6a1e14)`,
              border: "1px solid rgba(0,0,0,0.5)", boxShadow: "0 1px 4px rgba(0,0,0,0.5)",
              display: "inline-flex", alignItems: "center", justifyContent: "center",
              fontSize: 13, fontWeight: 900, color: "#f0e2c8",
            }}>{sealChar}</span>
            <span style={{ flex: 1 }} />
            {deployed && (
              <span style={{
                fontSize: 10.5, fontWeight: 800, letterSpacing: "0.06em", color: "#241a0e",
                background: "linear-gradient(to bottom, #ddd3ba, #b8ab8c)", borderRadius: 3, padding: "2px 7px",
                border: "1px solid rgba(0,0,0,0.4)",
              }}>배치됨</span>
            )}
          </div>
          <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
            <span style={{
              fontSize: 12, fontWeight: 700, color: PARCHMENT, padding: "2px 9px",
              borderRadius: 10, border: `1px solid ${GOLD_DIM}`, background: "rgba(14,10,5,0.75)",
            }}>Lv.{unit.level}</span>
            <span style={{
              fontSize: 12, fontWeight: 700, color: "#f0e2c8", padding: "2px 9px",
              borderRadius: 10, border: "1px solid rgba(0,0,0,0.4)",
              background: `linear-gradient(135deg, ${SEAL_RED}, #6a1e14)`,
            }}>{className(unit.classId)}</span>
            <span style={{ flex: 1 }} />
            <span style={{ fontSize: 11.5, color: "#c8b48a" }}>
              전력 <strong style={{ color: GOLD_BRIGHT, fontSize: 14 }}>{stats.power}</strong>
            </span>
          </div>
        </div>
        {onClose && (
          <button type="button" onClick={onClose} aria-label="닫기" style={{
            position: "absolute", top: 8, right: 8, width: 28, height: 28,
            borderRadius: "50%", border: `1px solid ${GOLD_DIM}`,
            background: "rgba(14,10,5,0.75)", color: PARCHMENT, fontSize: 14, cursor: "pointer", lineHeight: 1,
          }}>✕</button>
        )}
      </div>

      <div style={{ padding: "13px 15px 15px", display: "flex", flexDirection: "column", gap: 13 }}>
        {/* ── 스탯 3줄 ── */}
        <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
          <StatBar label="무력" value={stats.atk} max={statMax.atk} color="#c23b2a" />
          <StatBar label="통솔" value={stats.def} max={statMax.def} color="#2e8050" />
          <StatBar label="지력" value={stats.spirit} max={statMax.spirit} color="#3565b0" />
        </div>

        <div style={{ height: 1, background: `linear-gradient(to right, transparent, ${GOLD_DIM}88, transparent)` }} />

        {/* ── 장비 슬롯: 무기/말/보물 (빈칸 탭=선택, 찬칸 탭=상세/해제). 미배치=읽기전용 ── */}
        <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
          {(["arms", "mount", "relic"] as EquipSlot[]).map((s) => (
            <SlotBox key={s} slot={s} id={view[s][0] ?? null} editable={deployed}
              onTapFilled={setInfoId} onTapEmpty={setPickSlot} />
          ))}
        </div>
        {!deployed && (
          <div style={{ fontSize: 11, color: DIM_TEXT, textAlign: "center", marginTop: -4 }}>
            출진 편성 후 장비를 변경할 수 있습니다.
          </div>
        )}

        {/* 구버전 세이브의 슬롯 초과분(소모품·중복) — 있을 때만 조용히 해제 유도 */}
        {view.overflow.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 4, alignItems: "center" }}>
            <span style={{ fontSize: 10, color: "#d07a5a" }}>정리 필요 — 탭해서 해제:</span>
            {view.overflow.map((id, i) => (
              <button key={`${id}-${i}`} type="button" onClick={() => unequip(id)}
                style={{ fontSize: 11, padding: "2px 6px", borderRadius: 8, fontFamily: "inherit",
                  border: "1px solid #a0402088", background: "rgba(160,64,32,0.16)",
                  color: PARCHMENT, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 4 }}
              >
                <ItemIcon itemId={id} category={items[id]?.category} size={16} />
                {items[id]?.name ?? id} ✕
              </button>
            ))}
          </div>
        )}
      </div>

      {/* 찬 슬롯 상세 — 배치 중이면 해제 액션, 미배치는 읽기전용 */}
      {infoId && (
        <ItemInfoPopup
          itemId={infoId} onClose={() => setInfoId(null)}
          actionLabel={deployed ? "해제" : undefined}
          onAction={deployed ? () => unequip(infoId) : undefined}
          note={deployed ? "해제한 장비는 소지품으로 돌아갑니다" : undefined}
        />
      )}
      {/* 빈 슬롯 선택 팝업 */}
      {pickSlot && (
        <SlotPicker
          slot={pickSlot} candidates={bySlot[pickSlot]} unit={unit} currentItems={equippedIds}
          onPick={equip} onClose={() => setPickSlot(null)}
        />
      )}
    </div>
  );
}
