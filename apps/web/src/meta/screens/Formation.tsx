"use client";
/**
 * 편성 화면 (§10 막간 = 상점→편성→출진). /prep 셸이 <Shop/>과 나란히 합성한다.
 *
 * 책임:
 *  - getRoster()로 받은 후보 장수(props.roster)를 리스트로 그린다.
 *  - 리스트 행 토글로 출진 슬롯(maxSlots 상한)에 편성. 선택은 부모 보유 상태(props.selected),
 *    변경은 onChange(SortieMember[])로 위로 올린다.
 *  - 선택된 장수 칩을 탭하면 장비 패널이 펼쳐져 장착/해제 가능.
 *
 * 불가침(CLAUDE.md §10/§13): 확률 강화·랜덤 스탯 없음. 장비는 "지정 장착"만.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { gameData } from "@tk/data";
import type { RosterUnit } from "../metaStore";
import { getMeta, setEquipped } from "../metaStore";
import type { SortieMember } from "../sortie";
import { assetUrl } from "../../assetUrl";
import { unitStats } from "../unitStats";
import { sortRoster, type SortKey } from "../rosterSort";
import { ItemIcon } from "../../ui/ItemIcon";

export interface FormationProps {
  roster: RosterUnit[];
  maxSlots: number;
  selected: SortieMember[];
  onChange: (members: SortieMember[]) => void;
  chapter: number;
}

// 양피지(parchment) + 수묵 목재 팔레트
const PARCHMENT      = "#ede4cc";
const PARCHMENT_WARM = "#f5edd8";
const PARCHMENT_DARK = "#d4c4a0";
const WOOD           = "#1e1408";
const WOOD_MID       = "#3a2410";
const GOLD           = "#c8a440";
const GOLD_BRIGHT    = "#e0b840";
const GOLD_DIM       = "#8a6a28";
const GOLD_GLOW      = "rgba(200,164,64,0.22)";
const DARK_TEXT      = "#1a1008";
const MUTED_TEXT     = "#5a4a30";
const DIM_TEXT       = "#8a7850";

const ROLE_LABEL: Record<string, string> = {
  lord: "군주", melee: "전위", caster: "책사", support: "보조", guest: "객장",
};
const ROLE_COLOR: Record<string, string> = {
  lord: "#b87820", melee: "#8a2020", caster: "#2850a0", support: "#1a7040", guest: "#5a5868",
};
const ROLE_ICON: Record<string, string> = {
  lord: "王", melee: "兵", caster: "謀", support: "輔", guest: "客",
};

function commanderName(id: string): string {
  return gameData.commanders[id]?.name ?? id;
}
function className(classId: string): string {
  return gameData.unitClasses[classId]?.name ?? classId;
}

function Stars({ level }: { level: number }): React.ReactElement {
  const n = Math.min(5, Math.max(1, Math.round(level / 10)));
  // 빈 별은 아주 희미하게(0.15) — 종전 0.4는 채운 별과 구분이 안 돼 전원 만점처럼 읽혔다(P0 리뷰).
  return (
    <span style={{ lineHeight: 1 }}>
      <span style={{ color: GOLD, fontSize: 11, letterSpacing: -0.5 }}>{"★".repeat(n)}</span>
      <span style={{ color: GOLD_DIM, fontSize: 11, letterSpacing: -0.5, opacity: 0.15 }}>{"★".repeat(5 - n)}</span>
    </span>
  );
}

/** 초상 박스 — fallback 이니셜 포함. */
function Portrait({ commanderId, size }: { commanderId: string; size: number }): React.ReactElement {
  const name = commanderName(commanderId);
  const [failed, setFailed] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);
  useEffect(() => {
    setFailed(false);
    const img = imgRef.current;
    if (img && img.complete && img.naturalWidth === 0) setFailed(true);
  }, [commanderId]);
  return (
    <div style={{
      width: size, height: Math.round(size * 1.2),
      background: "linear-gradient(to bottom, #2a1e10, #1a1208)",
      display: "flex", alignItems: "center", justifyContent: "center",
      color: GOLD_DIM, overflow: "hidden", flexShrink: 0,
    }}>
      {!failed ? (
        <img
          ref={imgRef}
          src={assetUrl(`/assets/ui/portraits/${encodeURIComponent(commanderId)}.webp`)}
          alt={name}
          onError={() => setFailed(true)}
          style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "top", display: "block" }}
        />
      ) : (
        <span style={{ fontSize: Math.round(size * 0.35), fontWeight: 900, color: GOLD_DIM }}>
          {name.charAt(0)}
        </span>
      )}
    </div>
  );
}

/** 역할 뱃지 — /assets/ui/roles/{role}.webp 시도, 없으면 유니코드 폴백. */
function RoleBadge({ role, size = 28, style: extraStyle }: {
  role: string; size?: number; style?: React.CSSProperties;
}): React.ReactElement {
  const color = ROLE_COLOR[role] ?? "#5a5868";
  const icon = ROLE_ICON[role] ?? "兵";
  const label = ROLE_LABEL[role] ?? "장수";
  const [imgFailed, setImgFailed] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);
  useEffect(() => {
    setImgFailed(false);
    const img = imgRef.current;
    if (img && img.complete && img.naturalWidth === 0) setImgFailed(true);
  }, [role]);
  return (
    <div style={{
      width: size, height: size,
      background: `linear-gradient(135deg, ${color}, ${color}bb)`,
      borderRadius: 4,
      border: "1px solid rgba(0,0,0,0.35)",
      display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center",
      boxShadow: "0 1px 4px rgba(0,0,0,0.45)",
      overflow: "hidden",
      ...extraStyle,
    }}>
      {!imgFailed ? (
        <img
          ref={imgRef}
          src={assetUrl(`/assets/ui/roles/${role}.webp`)}
          alt={label}
          onError={() => setImgFailed(true)}
          style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
        />
      ) : (
        <>
          <span style={{ fontSize: Math.round(size * 0.46), color: "#fff", fontWeight: 900, lineHeight: 1 }}>{icon}</span>
          <span style={{ fontSize: Math.round(size * 0.21), color: "rgba(255,255,255,0.88)", fontWeight: 700, lineHeight: 1.2 }}>{label}</span>
        </>
      )}
    </div>
  );
}

/** 패널 위에 얹는 목재+금장 프레임 오버레이 — /assets/ui/formation-frame.webp 없으면 아무것도 안 렌더. */
function FrameOverlay(): React.ReactElement {
  const [failed, setFailed] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);
  useEffect(() => {
    const img = imgRef.current;
    if (img && img.complete && img.naturalWidth === 0) setFailed(true);
  }, []);
  if (failed) return <></>;
  return (
    <img
      ref={imgRef}
      src={assetUrl("/assets/ui/formation-frame.webp")}
      alt=""
      onError={() => setFailed(true)}
      style={{
        position: "absolute", inset: 0, width: "100%", height: "100%",
        pointerEvents: "none", zIndex: 50, objectFit: "fill",
      }}
    />
  );
}

function toMember(u: RosterUnit, items: string[]): SortieMember {
  return { commanderId: u.commanderId, classId: u.classId, level: u.level, exp: u.exp, items: [...items] };
}

function PowerDelta({ commanderId, classId, level, currentItems, candidateItem }: {
  commanderId: string; classId: string; level: number;
  currentItems: string[]; candidateItem: string;
}): React.ReactElement {
  const base = unitStats(commanderId, classId, level, currentItems).power;
  const next = unitStats(commanderId, classId, level, [...currentItems, candidateItem]).power;
  const delta = next - base;
  if (delta === 0) return <></>;
  return (
    <span style={{ marginLeft: 3, fontSize: 10, color: delta > 0 ? "#2a8040" : "#8a4030" }}>
      {delta > 0 ? `+${delta}` : `${delta}`}
    </span>
  );
}

/** 장비 패널 — 선택된 슬롯 탭 시 펼침. */
function EquipPanel({ member, inventory, equippedCount, onEquip }: {
  member: SortieMember; inventory: string[]; equippedCount: Map<string, number>;
  onEquip: (items: string[]) => void;
}): React.ReactElement {
  const items = gameData.items;
  const ownedCount = useMemo(() => {
    const c = new Map<string, number>();
    for (const it of inventory) c.set(it, (c.get(it) ?? 0) + 1);
    return c;
  }, [inventory]);
  const available = useMemo(() => {
    const out: string[] = [];
    for (const [itemId, owned] of ownedCount) {
      if (owned - (equippedCount.get(itemId) ?? 0) > 0) out.push(itemId);
    }
    return out;
  }, [ownedCount, equippedCount]);
  const power = unitStats(member.commanderId, member.classId, member.level, member.items).power;
  return (
    <div style={{
      background: "rgba(26,18,8,0.92)",
      border: `1px solid ${GOLD}55`,
      borderRadius: 8,
      padding: "10px 12px",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: PARCHMENT }}>{commanderName(member.commanderId)}</span>
        <span style={{ fontSize: 11, color: MUTED_TEXT }}>
          전력 <strong style={{ color: GOLD }}>{power}</strong>
        </span>
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: available.length > 0 ? 6 : 0 }}>
        {member.items.length === 0 ? (
          <span style={{ fontSize: 11, color: DIM_TEXT }}>장비 없음</span>
        ) : (
          member.items.map((itemId, idx) => (
            <button
              key={`${itemId}-${idx}`} type="button"
              onClick={() => { const n = member.items.slice(); n.splice(idx, 1); onEquip(n); }}
              style={{ fontSize: 11, padding: "2px 6px", borderRadius: 10,
                border: `1px solid ${GOLD}77`, background: GOLD_GLOW,
                color: PARCHMENT, cursor: "pointer",
                display: "inline-flex", alignItems: "center", gap: 4 }}
            >
              <ItemIcon itemId={itemId} category={items[itemId]?.category} size={18} />
              {items[itemId]?.name ?? itemId}
              <span style={{ color: GOLD_DIM, marginLeft: 2 }}>✕</span>
            </button>
          ))
        )}
      </div>
      {available.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
          <span style={{ fontSize: 10, color: DIM_TEXT, alignSelf: "center", marginRight: 2 }}>장착:</span>
          {available.map((itemId) => (
            <button key={itemId} type="button"
              onClick={() => onEquip([...member.items, itemId])}
              style={{ fontSize: 11, padding: "2px 6px", borderRadius: 10,
                border: `1px solid rgba(200,164,64,0.2)`, background: "rgba(255,255,255,0.04)",
                color: PARCHMENT, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 4 }}
            >
              <ItemIcon itemId={itemId} category={items[itemId]?.category} size={18} />
              {items[itemId]?.name ?? itemId}
              <PowerDelta commanderId={member.commanderId} classId={member.classId}
                level={member.level} currentItems={member.items} candidateItem={itemId} />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function Formation({ roster, maxSlots, selected, onChange, chapter }: FormationProps): React.ReactElement {
  const [inventory, setInventory] = useState<string[]>([]);
  useEffect(() => { setInventory(getMeta().inventory); }, []);

  const [sortKey, setSortKey] = useState<SortKey>("role");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const selectedIds = useMemo(() => new Set(selected.map((m) => m.commanderId)), [selected]);
  const rosterById = useMemo(() => {
    const m = new Map<string, RosterUnit>();
    for (const u of roster) m.set(u.commanderId, u);
    return m;
  }, [roster]);
  const sortedRoster = useMemo(() => sortRoster(roster, sortKey, chapter), [roster, sortKey, chapter]);
  const equippedCount = useMemo(() => {
    const counts = new Map<string, number>();
    for (const m of selected) for (const it of m.items) counts.set(it, (counts.get(it) ?? 0) + 1);
    return counts;
  }, [selected]);

  const toggle = useCallback((u: RosterUnit) => {
    if (selectedIds.has(u.commanderId)) {
      onChange(selected.filter((m) => m.commanderId !== u.commanderId));
      if (expandedId === u.commanderId) setExpandedId(null);
      return;
    }
    if (selected.length >= maxSlots) return;
    onChange([...selected, toMember(u, u.equipped)]);
  }, [onChange, selected, selectedIds, maxSlots, expandedId]);

  const updateEquip = useCallback((commanderId: string, items: string[]) => {
    setEquipped(commanderId, items);
    onChange(selected.map((m) => (m.commanderId === commanderId ? { ...m, items: [...items] } : m)));
  }, [onChange, selected]);

  const slotsLeft = maxSlots - selected.length;

  return (
    <section style={{
      position: "relative",
      background: `url(${assetUrl("/assets/ui/formation-bg.webp")}) center/cover no-repeat, linear-gradient(150deg, ${PARCHMENT_WARM} 0%, ${PARCHMENT} 100%)`,
      border: `3px solid ${WOOD}`,
      boxShadow: `inset 0 0 0 2px ${GOLD}, inset 0 0 0 5px ${WOOD_MID}`,
      borderRadius: 8,
      color: DARK_TEXT,
      display: "flex",
      flexDirection: "column",
      overflow: "hidden",
    }}>

      {/* ━━ 후보 카드 — 가로 스크롤 ━━ */}
      <div style={{
        overflowX: "auto",
        display: "flex",
        gap: 10,
        padding: "14px 16px 12px",
        borderBottom: `2px solid ${PARCHMENT_DARK}`,
        scrollbarWidth: "none",
      }}>
        {sortedRoster.map((u) => {
          const on = selectedIds.has(u.commanderId);
          const full = !on && selected.length >= maxSlots;
          const isNew = u.joinChapter === chapter;

          return (
            <button
              key={u.commanderId}
              type="button"
              onClick={() => toggle(u)}
              disabled={full}
              aria-pressed={on}
              style={{
                position: "relative",
                flexShrink: 0,
                width: 100,
                display: "flex",
                flexDirection: "column",
                alignItems: "stretch",
                padding: 0,
                borderRadius: 6,
                border: on ? `2px solid ${GOLD_BRIGHT}` : `2px solid ${GOLD_DIM}55`,
                background: on
                  ? `linear-gradient(to bottom, #f0e8d0, #e4d8b8)`
                  : `linear-gradient(to bottom, ${PARCHMENT_WARM}, ${PARCHMENT})`,
                boxShadow: on
                  ? `0 0 20px ${GOLD_GLOW}, inset 0 0 0 1px ${GOLD_BRIGHT}44`
                  : `0 2px 10px rgba(0,0,0,0.2), inset 0 0 0 1px rgba(200,164,64,0.15)`,
                cursor: full ? "not-allowed" : "pointer",
                opacity: full ? 0.32 : 1,
                overflow: "hidden",
                transition: "box-shadow 0.12s, border-color 0.12s",
              }}
            >
              {/* 역할 뱃지 — 좌상단 */}
              <RoleBadge role={u.role} size={28} style={{ position: "absolute", top: 6, left: 6, zIndex: 2 }} />

              {/* NEW 배지 — 우상단 (선택 안 됐을 때만) */}
              {isNew && !on && (
                <div style={{
                  position: "absolute", top: 6, right: 6, zIndex: 2,
                  background: "#c0392b", borderRadius: 3,
                  padding: "2px 5px",
                  fontSize: 8, color: "#fff", fontWeight: 800, letterSpacing: 0.5,
                }}>NEW</div>
              )}

              {/* 선택 체크 — 우상단 */}
              {on && (
                <div style={{
                  position: "absolute", top: 6, right: 6, zIndex: 3,
                  width: 22, height: 22,
                  background: `radial-gradient(circle, ${GOLD_BRIGHT}, ${GOLD})`,
                  borderRadius: "50%",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  boxShadow: `0 0 10px ${GOLD_GLOW}`,
                }}>
                  <span style={{ fontSize: 12, color: "#fff", fontWeight: 900, lineHeight: 1 }}>✓</span>
                </div>
              )}

              {/* 초상 */}
              <Portrait commanderId={u.commanderId} size={100} />

              {/* 정보 영역 */}
              <div style={{
                padding: "6px 6px 8px",
                background: on ? "rgba(200,164,64,0.1)" : "rgba(0,0,0,0.03)",
                borderTop: `1px solid ${on ? GOLD + "55" : PARCHMENT_DARK}`,
                display: "flex", flexDirection: "column",
                alignItems: "center", gap: 3,
              }}>
                <span style={{
                  fontSize: 14, fontWeight: on ? 700 : 600,
                  color: on ? WOOD : DARK_TEXT,
                  letterSpacing: "0.04em", lineHeight: 1,
                }}>
                  {commanderName(u.commanderId)}
                </span>
                <span style={{ fontSize: 10, color: MUTED_TEXT }}>
                  {className(u.classId)}
                </span>
                <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                  <span style={{ fontSize: 9, color: DIM_TEXT }}>Lv.{u.level}</span>
                  <Stars level={u.level} />
                </div>
                {u.equipped.length > 0 && (
                  <span style={{ fontSize: 9, color: GOLD_DIM }}>장비 {u.equipped.length}</span>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {/* ━━ 출진 슬롯 + 정보 패널 ━━ */}
      <div style={{
        display: "flex",
        gap: 12,
        padding: "12px 16px",
        alignItems: "flex-start",
        background: `linear-gradient(to bottom, ${PARCHMENT} 0%, #e0d4b4 100%)`,
        borderBottom: `2px solid ${PARCHMENT_DARK}`,
      }}>
        {/* 좌: 슬롯 그룹 */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
          <span style={{
            fontSize: 10, fontWeight: 700, color: MUTED_TEXT,
            writingMode: "vertical-rl", textOrientation: "mixed",
            letterSpacing: "0.2em",
          }}>출진 슬롯</span>

          <div style={{ display: "flex", gap: 6 }}>
            {Array.from({ length: maxSlots }, (_, i) => {
              const m = selected[i];
              if (m) {
                const u = rosterById.get(m.commanderId);
                const roleColor = ROLE_COLOR[u?.role ?? "melee"] ?? "#8a2020";
                const roleIcon = ROLE_ICON[u?.role ?? "melee"] ?? "兵";
                const isExpanded = expandedId === m.commanderId;
                return (
                  <button
                    key={m.commanderId} type="button"
                    onClick={() => setExpandedId(isExpanded ? null : m.commanderId)}
                    style={{
                      position: "relative",
                      width: 64, height: 90,
                      borderRadius: 6,
                      border: `2px solid ${isExpanded ? GOLD_BRIGHT : GOLD}`,
                      background: "linear-gradient(to bottom, #2a1e0e, #1a1208)",
                      boxShadow: isExpanded ? `0 0 16px ${GOLD_GLOW}` : "none",
                      cursor: "pointer", overflow: "hidden", padding: 0,
                      display: "flex", flexDirection: "column", alignItems: "stretch",
                      transition: "box-shadow 0.12s",
                    }}
                  >
                    {/* 역할 색 바 */}
                    <div style={{ height: 4, background: roleColor, flexShrink: 0 }} />
                    {/* 초상 */}
                    <div style={{ flex: 1, overflow: "hidden" }}>
                      <Portrait commanderId={m.commanderId} size={60} />
                    </div>
                    {/* 이름 */}
                    <div style={{
                      padding: "3px 2px", textAlign: "center",
                      fontSize: 9, fontWeight: 700, color: PARCHMENT,
                      background: "rgba(0,0,0,0.5)", flexShrink: 0,
                    }}>
                      {commanderName(m.commanderId)}
                    </div>
                    {/* 역할 아이콘 */}
                    <div style={{
                      position: "absolute", top: 7, left: 3,
                      width: 16, height: 16,
                      background: roleColor,
                      borderRadius: 3,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 9, color: "#fff", fontWeight: 900,
                    }}>{roleIcon}</div>
                    {/* 해제 × */}
                    <span
                      role="button" aria-label="편성 해제"
                      onClick={(e) => { e.stopPropagation(); if (u) toggle(u); }}
                      style={{
                        position: "absolute", top: 4, right: 4,
                        fontSize: 13, color: "rgba(255,255,255,0.45)",
                        cursor: "pointer", lineHeight: 1,
                      }}
                    >×</span>
                    {m.items.length > 0 && (
                      <span style={{
                        position: "absolute", bottom: 18, right: 3,
                        fontSize: 8, color: GOLD, lineHeight: 1,
                      }}>장비{m.items.length}</span>
                    )}
                  </button>
                );
              }
              return (
                <div key={`slot-${i}`} style={{
                  width: 64, height: 90,
                  borderRadius: 6,
                  border: `2px dashed ${GOLD}44`,
                  background: "linear-gradient(135deg, #1a1208, #120e04)",
                  display: "flex", flexDirection: "column",
                  alignItems: "center", justifyContent: "center", gap: 4,
                }}>
                  <span style={{ fontSize: 26, color: GOLD_DIM, opacity: 0.45, lineHeight: 1 }}>+</span>
                  <span style={{ fontSize: 8, color: GOLD_DIM, opacity: 0.4 }}>빈 슬롯</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* 우: 정보 패널 */}
        <div style={{
          flex: 1,
          border: `1px solid ${GOLD}55`,
          borderRadius: 8,
          background: "linear-gradient(135deg, rgba(255,248,235,0.95), rgba(240,228,200,0.98))",
          padding: "12px 16px",
          minHeight: 90,
          display: "flex", flexDirection: "column", justifyContent: "center", gap: 5,
          boxShadow: "inset 0 1px 0 rgba(255,255,255,0.6), 0 2px 8px rgba(0,0,0,0.08)",
        }}>
          <div style={{ fontSize: 20, fontWeight: 800, color: DARK_TEXT, lineHeight: 1.1 }}>
            출진{" "}
            <span style={{ color: slotsLeft === 0 ? "#2a7030" : WOOD }}>
              {selected.length}
            </span>
            <span style={{ color: MUTED_TEXT, fontSize: 16 }}>/{maxSlots}</span>
            {slotsLeft > 0 && (
              <span style={{ fontSize: 16, color: "#a04020", fontWeight: 600 }}>
                {" "}· 빈 슬롯{" "}
                <strong style={{ fontSize: 20 }}>{slotsLeft}</strong>
              </span>
            )}
          </div>
          <div style={{ fontSize: 11, color: MUTED_TEXT, lineHeight: 1.5 }}>
            {slotsLeft > 0
              ? "무장을 선택하여 출진 부대를 편성하세요."
              : "출진 편성이 완료되었습니다. ▶"}
          </div>
        </div>
      </div>

      {/* ━━ 장비 패널 — 슬롯 탭 시 ━━ */}
      {expandedId && (() => {
        const m = selected.find((s) => s.commanderId === expandedId);
        if (!m) return null;
        return (
          <div style={{ padding: "10px 16px 4px", background: "#e0d4b4" }}>
            <EquipPanel
              member={m} inventory={inventory} equippedCount={equippedCount}
              onEquip={(items) => updateEquip(expandedId, items)}
            />
          </div>
        );
      })()}

      {/* ━━ 필터 바 ━━ */}
      <div style={{
        display: "flex",
        alignItems: "center",
        gap: 6,
        padding: "10px 16px",
        background: "#d8caa8",
        borderTop: `1px solid ${PARCHMENT_DARK}`,
      }}>
        <span style={{ fontSize: 17, color: MUTED_TEXT, flexShrink: 0 }}>≡</span>
        {(["role", "power", "level", "new"] as SortKey[]).map((k) => {
          const label = ({ role: "역할", power: "전투", level: "레벨", new: "신규" } as Record<SortKey, string>)[k];
          const active = sortKey === k;
          return (
            <button
              key={k} type="button" onClick={() => setSortKey(k)}
              style={{
                fontSize: 12, padding: "5px 12px", borderRadius: 4,
                border: `1px solid ${active ? GOLD : GOLD_DIM + "60"}`,
                background: active ? GOLD_GLOW : "rgba(0,0,0,0.07)",
                color: active ? WOOD : MUTED_TEXT,
                fontWeight: active ? 700 : 400,
                cursor: "pointer",
              }}
            >
              {label} {active ? "▲" : "▼"}
            </button>
          );
        })}
      </div>
      <FrameOverlay />
    </section>
  );
}
