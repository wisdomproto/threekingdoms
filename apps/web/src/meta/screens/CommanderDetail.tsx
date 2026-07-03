"use client";
/**
 * CommanderDetail — 편성 화면 우측 「선택된 장수 상세」 패널 (2026-07-03 레퍼런스 재구성).
 * 대형 초상 히어로 + 이름/인장/Lv/병종 + 스탯 바(무력·통솔·지력) + 장비 슬롯(§10 슬롯제) + 소지품.
 *
 * 장비 편집은 **배치된 장수만**(member 존재 시) — 편집이 selected(SortieMember)와 metaStore를
 * 함께 갱신해야 하는 기존 데이터 흐름(updateEquip)을 유지하기 위함. 미배치 장수는
 * 장착 현황을 읽기전용으로 보여주고 「출진 편성」을 권한다.
 */
import { useMemo, useState } from "react";
import { gameData } from "@tk/data";
import type { RosterUnit } from "../metaStore";
import type { SortieMember } from "../sortie";
import { unitStats } from "../unitStats";
import { ItemIcon } from "../../ui/ItemIcon";
import { ItemInfoPopup } from "../../ui/ItemInfoPopup";
import { CommanderPortrait } from "../../ui/CommanderPortrait";
import { applyEquip, buildSlotView, slotOf, SLOT_LABEL, SLOT_CAP, type EquipSlot } from "../equipSlots";
import {
  PARCHMENT, INK_PANEL, GOLD, GOLD_BRIGHT, GOLD_DIM, GOLD_GLOW, DIM_TEXT, SEAL_RED, SERIF,
  ROLE_ICON, commanderName, className,
} from "./formationUi";

export interface StatMax { atk: number; def: number; spirit: number }

export interface CommanderDetailProps {
  unit: RosterUnit;
  /** 배치된 경우 그 SortieMember(장비 편집 대상). 미배치면 null. */
  member: SortieMember | null;
  /** 출진 슬롯 여유 여부(미배치 시 「출진 편성」 활성 조건) */
  canDeploy: boolean;
  /** 스탯 바 정규화 기준(로스터 전체 최대치) */
  statMax: StatMax;
  inventory: string[];
  equippedCount: Map<string, number>;
  onEquip: (items: string[]) => void;
  onDeploy: () => void;
  onUndeploy: () => void;
  /** 모바일 바텀시트에서만 — 지정 시 우상단 ✕ 표시 */
  onClose?: () => void;
}

function Stars({ level }: { level: number }): React.ReactElement {
  const n = Math.min(5, Math.max(1, Math.round(level / 10)));
  return (
    <span style={{ lineHeight: 1 }}>
      <span style={{ color: GOLD_BRIGHT, fontSize: 11, letterSpacing: -0.5 }}>{"★".repeat(n)}</span>
      <span style={{ color: GOLD_DIM, fontSize: 11, letterSpacing: -0.5, opacity: 0.15 }}>{"★".repeat(5 - n)}</span>
    </span>
  );
}

function StatBar({ label, value, max, color }: {
  label: string; value: number; max: number; color: string;
}): React.ReactElement {
  const pct = max > 0 ? Math.max(6, Math.round((value / max) * 100)) : 0;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <span style={{ fontSize: 11.5, color: GOLD_DIM, width: 30, flexShrink: 0, letterSpacing: "0.08em" }}>
        {label}
      </span>
      <div style={{
        flex: 1, height: 9, borderRadius: 4, overflow: "hidden",
        background: "rgba(0,0,0,0.55)", border: "1px solid rgba(0,0,0,0.6)",
        boxShadow: "inset 0 1px 2px rgba(0,0,0,0.6)",
      }}>
        <div style={{
          width: `${pct}%`, height: "100%",
          background: `linear-gradient(to bottom, ${color}, ${color}bb)`,
          boxShadow: "inset 0 1px 0 rgba(255,255,255,0.25)",
        }} />
      </div>
      <span style={{ fontSize: 12.5, fontWeight: 700, color: PARCHMENT, width: 32, textAlign: "right", flexShrink: 0 }}>
        {value}
      </span>
    </div>
  );
}

function PowerDelta({ unit, currentItems, nextItems }: {
  unit: RosterUnit; currentItems: readonly string[]; nextItems: readonly string[];
}): React.ReactElement {
  // 슬롯 교체 결과(applyEquip)를 그대로 비교 — "그냥 추가" 가정은 교체 시 델타가 틀렸다.
  const base = unitStats(unit.commanderId, unit.classId, unit.level, [...currentItems]).power;
  const next = unitStats(unit.commanderId, unit.classId, unit.level, [...nextItems]).power;
  const delta = next - base;
  if (delta === 0) return <></>;
  return (
    <span style={{ marginLeft: 3, fontSize: 10, fontWeight: 700, color: delta > 0 ? "#7fc26a" : "#d07a5a" }}>
      {delta > 0 ? `+${delta}` : `${delta}`}
    </span>
  );
}

/** 장비 슬롯 1칸 — 정사각 박스(레퍼런스 문법). 채움=탭하면 상세 팝업(즉시 해제 금지 — 2026-07-03
 *  "클릭하면 그냥 없어진다" 지적), 모서리 ✕만 바로 해제. 빈칸=+ 점선. */
function SlotCell({ id, interactive, onInfo, onUnequip }: {
  id: string | null; interactive: boolean;
  onInfo: (itemId: string) => void; onUnequip: (itemId: string) => void;
}): React.ReactElement {
  const item = id ? gameData.items[id] : undefined;
  if (!id) {
    return (
      <div style={{
        aspectRatio: "1", borderRadius: 8, minWidth: 0,
        border: `1.5px dashed ${GOLD_DIM}55`,
        background: "rgba(0,0,0,0.35)",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        <span style={{ fontSize: 20, color: GOLD_DIM, opacity: 0.5, lineHeight: 1 }}>+</span>
      </div>
    );
  }
  return (
    <button
      type="button"
      onClick={() => onInfo(id)}
      title={`${item?.name ?? id} — 상세`}
      style={{
        position: "relative", aspectRatio: "1", borderRadius: 8, minWidth: 0, padding: 0,
        border: `1.5px solid ${GOLD}88`,
        background: `linear-gradient(160deg, rgba(60,46,22,0.85), rgba(28,20,10,0.95))`,
        boxShadow: `inset 0 0 10px ${GOLD_GLOW}`,
        display: "flex", alignItems: "center", justifyContent: "center",
        cursor: "pointer",
      }}
    >
      <ItemIcon itemId={id} category={item?.category} size={34} />
      {interactive && (
        <span
          role="button"
          aria-label={`${item?.name ?? id} 해제`}
          onClick={(e) => { e.stopPropagation(); onUnequip(id); }}
          style={{
            position: "absolute", top: 0, right: 0, padding: "1px 5px 3px",
            fontSize: 10, color: "rgba(232,217,176,0.6)", lineHeight: 1,
            cursor: "pointer",
          }}
        >✕</span>
      )}
    </button>
  );
}

/** 슬롯 그룹(라벨 + 칸들 + 채워진 아이템명 캡션) */
function SlotGroup({ slot, ids, interactive, onInfo, onUnequip }: {
  slot: EquipSlot; ids: string[]; interactive: boolean;
  onInfo: (itemId: string) => void; onUnequip: (itemId: string) => void;
}): React.ReactElement {
  const cap = SLOT_CAP[slot];
  const cells: (string | null)[] = [...ids];
  while (cells.length < cap) cells.push(null);
  const names = ids.map((id) => gameData.items[id]?.name ?? id).join(" · ");
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 0, flex: cap }}>
      <span style={{ fontSize: 10.5, letterSpacing: "0.18em", color: "#b8a070", textAlign: "center" }}>
        {SLOT_LABEL[slot]}
      </span>
      <div style={{ display: "grid", gridTemplateColumns: `repeat(${cap}, 1fr)`, gap: 5 }}>
        {cells.map((id, i) => (
          <SlotCell key={id ? `${id}-${i}` : `e-${i}`} id={id} interactive={interactive}
            onInfo={onInfo} onUnequip={onUnequip} />
        ))}
      </div>
      <span style={{
        fontSize: 9, color: names ? PARCHMENT : "transparent", textAlign: "center",
        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minHeight: 11,
      }}>
        {names || "—"}
      </span>
    </div>
  );
}

export function CommanderDetail({
  unit, member, canDeploy, statMax, inventory, equippedCount, onEquip, onDeploy, onUndeploy, onClose,
}: CommanderDetailProps): React.ReactElement {
  const items = gameData.items;
  const deployed = member != null;
  // 표시 기준 장착 리스트: 배치 시 member.items(편집 실시간), 미배치 시 로스터 저장분
  const equippedIds = deployed ? member.items : unit.equipped;
  const view = buildSlotView(equippedIds, items);
  const stats = unitStats(unit.commanderId, unit.classId, unit.level, [...equippedIds]);
  // 아이템 상세 팝업 — slot(장착 중, 해제 행동) / bag(소지품, 장착 행동). 2026-07-03 지적:
  // 소지품 효과 수치를 볼 수 없고, 장착 슬롯 탭이 확인 없이 즉시 해제되던 문제의 해법.
  const [info, setInfo] = useState<{ id: string; from: "slot" | "bag" } | null>(null);

  const available = useMemo(() => {
    const owned = new Map<string, number>();
    for (const it of inventory) owned.set(it, (owned.get(it) ?? 0) + 1);
    const out: string[] = [];
    for (const [itemId, n] of owned) {
      if (n - (equippedCount.get(itemId) ?? 0) > 0) out.push(itemId);
    }
    return out;
  }, [inventory, equippedCount]);

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
      {/* ── 히어로: 초상 액자 + 명판 (우리 초상은 정사각 흉상 — 와이드 크롭은 얼굴만 확대돼 금지) ── */}
      <div style={{
        position: "relative", flexShrink: 0,
        display: "flex", gap: 12, alignItems: "center",
        padding: "14px 14px 12px",
        background: "linear-gradient(160deg, rgba(46,36,18,0.55), rgba(20,15,8,0.2))",
        borderBottom: `1px solid ${GOLD_DIM}55`,
      }}>
        <div style={{
          width: 92, height: 112, flexShrink: 0,
          borderRadius: 8, overflow: "hidden",
          border: `1.5px solid ${GOLD_DIM}`,
          boxShadow: `0 4px 12px rgba(0,0,0,0.45), inset 0 0 0 1px rgba(200,164,64,0.2)`,
        }}>
          <CommanderPortrait commanderId={unit.commanderId} name={name} />
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{
              fontSize: 25, fontWeight: 800, color: PARCHMENT, lineHeight: 1,
              textShadow: "0 2px 6px rgba(0,0,0,0.7)", letterSpacing: "0.08em",
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
            }}>
              {name}
            </span>
            {/* 붉은 인장 — 역할 문자 */}
            <span style={{
              width: 22, height: 22, borderRadius: 4, flexShrink: 0,
              background: `linear-gradient(135deg, ${SEAL_RED}, #6a1e14)`,
              border: "1px solid rgba(0,0,0,0.5)", boxShadow: "0 1px 4px rgba(0,0,0,0.5)",
              display: "inline-flex", alignItems: "center", justifyContent: "center",
              fontSize: 13, fontWeight: 900, color: "#f0e2c8",
            }}>{sealChar}</span>
          </div>
          <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
            <span style={{
              fontSize: 12, fontWeight: 700, color: PARCHMENT, padding: "2px 9px",
              borderRadius: 10, border: `1px solid ${GOLD_DIM}`, background: "rgba(14,10,5,0.7)",
            }}>Lv.{unit.level}</span>
            <span style={{
              fontSize: 12, fontWeight: 700, color: "#f0e2c8", padding: "2px 9px",
              borderRadius: 10, border: "1px solid rgba(0,0,0,0.4)",
              background: `linear-gradient(135deg, ${SEAL_RED}, #6a1e14)`,
            }}>{className(unit.classId)}</span>
          </div>
          <Stars level={unit.level} />
        </div>
        {onClose && (
          <button
            type="button" onClick={onClose} aria-label="닫기"
            style={{
              position: "absolute", top: 8, right: 8, width: 28, height: 28,
              borderRadius: "50%", border: `1px solid ${GOLD_DIM}`,
              background: "rgba(14,10,5,0.75)", color: PARCHMENT,
              fontSize: 14, cursor: "pointer", lineHeight: 1,
            }}
          >✕</button>
        )}
      </div>

      <div style={{ padding: "12px 14px 14px", display: "flex", flexDirection: "column", gap: 12 }}>
        {/* ── 스탯 바 ── */}
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <StatBar label="무력" value={stats.atk} max={statMax.atk} color="#c23b2a" />
          <StatBar label="통솔" value={stats.def} max={statMax.def} color="#2e8050" />
          <StatBar label="지력" value={stats.spirit} max={statMax.spirit} color="#3565b0" />
          <div style={{ display: "flex", gap: 14, fontSize: 11, color: "#b8a070", paddingLeft: 38 }}>
            <span>기동 <strong style={{ color: PARCHMENT }}>{stats.move}</strong></span>
            <span>전력 <strong style={{ color: GOLD_BRIGHT }}>{stats.power}</strong></span>
          </div>
        </div>

        <div style={{ height: 1, background: `linear-gradient(to right, transparent, ${GOLD_DIM}88, transparent)` }} />

        {/* ── 장비 슬롯(§10: 무기1·말1·보물1 + 소모품2) ── */}
        <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
          {(["arms", "mount", "relic", "pouch"] as EquipSlot[]).map((s) => (
            <SlotGroup key={s} slot={s} ids={view[s]} interactive={deployed}
              onInfo={(id) => setInfo({ id, from: "slot" })} onUnequip={unequip} />
          ))}
        </div>

        {deployed && view.overflow.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 4, alignItems: "center" }}>
            <span style={{ fontSize: 10, color: "#d07a5a" }}>슬롯 초과(구버전 장착) — 탭해서 해제:</span>
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

        {/* ── 소지품(배치 시 탭=장착) ── */}
        {deployed ? (
          available.length > 0 && (
            <div>
              <div style={{ fontSize: 10.5, color: "#b8a070", marginBottom: 5 }}>
                소지품 — 탭하면 효과를 확인하고 장착합니다
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                {available.map((itemId) => {
                  const s = slotOf(items[itemId]?.category);
                  const next = applyEquip(equippedIds, itemId, items);
                  return (
                    <button key={itemId} type="button" onClick={() => setInfo({ id: itemId, from: "bag" })}
                      style={{ fontSize: 11, padding: "3px 7px", borderRadius: 10, fontFamily: "inherit",
                        border: `1px solid ${GOLD_DIM}66`, background: "rgba(255,255,255,0.05)",
                        color: PARCHMENT, cursor: "pointer",
                        display: "inline-flex", alignItems: "center", gap: 4 }}
                    >
                      <ItemIcon itemId={itemId} category={items[itemId]?.category} size={18} />
                      {items[itemId]?.name ?? itemId}
                      {s && (
                        <span style={{ fontSize: 9, color: GOLD_DIM, border: `1px solid ${GOLD_DIM}55`,
                          borderRadius: 6, padding: "0 4px" }}>
                          {SLOT_LABEL[s]}
                        </span>
                      )}
                      <PowerDelta unit={unit} currentItems={equippedIds} nextItems={next} />
                    </button>
                  );
                })}
              </div>
            </div>
          )
        ) : (
          <div style={{ fontSize: 11, color: DIM_TEXT }}>
            출진 편성 후 장비를 변경할 수 있습니다.
          </div>
        )}

        {/* ── 편성/해제 ── */}
        {deployed ? (
          <button type="button" onClick={onUndeploy}
            style={{
              padding: "8px 0", borderRadius: 8, fontFamily: "inherit",
              border: "1px solid #a04020aa", background: "rgba(160,64,32,0.14)",
              color: "#e8c0a8", fontSize: 13.5, fontWeight: 700, letterSpacing: "0.2em", cursor: "pointer",
            }}
          >편성 해제</button>
        ) : (
          <button type="button" onClick={onDeploy} disabled={!canDeploy}
            style={{
              padding: "9px 0", borderRadius: 8, fontFamily: "inherit",
              border: `1.5px solid ${canDeploy ? GOLD_BRIGHT : GOLD_DIM + "66"}`,
              background: canDeploy ? `linear-gradient(to bottom, rgba(200,164,64,0.3), rgba(140,110,40,0.2))` : "rgba(0,0,0,0.25)",
              color: canDeploy ? "#f4e6c0" : DIM_TEXT,
              boxShadow: canDeploy ? `0 0 14px ${GOLD_GLOW}` : "none",
              fontSize: 14, fontWeight: 800, letterSpacing: "0.25em",
              cursor: canDeploy ? "pointer" : "not-allowed",
            }}
          >{canDeploy ? "출진 편성" : "출진 슬롯 가득"}</button>
        )}
      </div>

      {/* ── 아이템 상세 팝업(효과 수치 + 장착/해제 확정) ── */}
      {info && (() => {
        const close = (): void => setInfo(null);
        if (info.from === "bag") {
          const nextItems = applyEquip(equippedIds, info.id, items);
          const changed = nextItems !== equippedIds;
          if (!changed) {
            return <ItemInfoPopup itemId={info.id} onClose={close} note="이미 장착 중인 장비입니다" />;
          }
          const delta =
            unitStats(unit.commanderId, unit.classId, unit.level, [...nextItems]).power - stats.power;
          const s = slotOf(items[info.id]?.category);
          const evict = s && view[s].length >= SLOT_CAP[s] ? view[s][0] : null;
          const note = [
            s ? `${SLOT_LABEL[s]} 슬롯` : null,
            evict ? `${items[evict]?.name ?? evict} 교체` : null,
            delta === 0 ? "전력 변화 없음" : `전력 ${delta > 0 ? "+" : ""}${delta}`,
          ].filter(Boolean).join(" · ");
          return (
            <ItemInfoPopup
              itemId={info.id} onClose={close} note={note}
              actionLabel={evict ? "교체 장착" : "장착"}
              onAction={() => equip(info.id)}
            />
          );
        }
        // 장착 중(slot) — 배치 시에만 해제 행동
        return (
          <ItemInfoPopup
            itemId={info.id} onClose={close}
            actionLabel={deployed ? "해제" : undefined}
            onAction={deployed ? () => unequip(info.id) : undefined}
            note={deployed ? "해제한 장비는 소지품으로 돌아갑니다" : "출진 편성 후 변경할 수 있습니다"}
          />
        );
      })()}
    </div>
  );
}
