"use client";
/**
 * 편성 화면 (§10 막간 = 상점→편성→출진). /prep 셸이 <Shop/>과 나란히 합성한다.
 *
 * 책임:
 *  - getRoster()로 받은 후보 장수(props.roster)를 카드로 그린다(초상/병종/핵심 스탯/Lv).
 *  - 카드 토글로 출진 슬롯(maxSlots 상한)에 편성. 선택은 부모 보유 상태(props.selected),
 *    변경은 onChange(SortieMember[])로 위로 올린다(부모가 writeSortie에 사용).
 *  - 선택된 장수마다 장비 슬롯 — 보유 인벤토리(metaStore.getMeta().inventory)에서 장착/해제.
 *    장착은 (a) metaStore.setEquipped로 영속하고 (b) 같은 items를 SortieMember.items에 주입한다.
 *
 * 불가침(CLAUDE.md §10/§13): 확률 강화·랜덤 스탯 없음. 장비는 "지정 장착"만 — 인벤토리의
 * 특정 아이템을 슬롯에 넣고 빼는 결정적 조작뿐이다.
 *
 * 좌표·배치 UI는 M1 범위 밖(sortie.ts 계약: stage player 슬롯을 앞에서부터 재사용). 편성은
 * commander/class/level/exp/items/troops만 결정한다.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { gameData } from "@tk/data";
import type { Item } from "@tk/data";
import type { RosterUnit } from "../metaStore";
import { getMeta, setEquipped } from "../metaStore";
import type { SortieMember } from "../sortie";
import { PANEL_FRAME, PORTRAIT_FRAME, BUTTON_FRAME } from "../../battle/hud/frames";
import { assetUrl } from "../../assetUrl";
import { unitStats } from "../unitStats";
import { sortRoster, type SortKey } from "../rosterSort";

export interface FormationProps {
  /** 출진 후보(보유/합류 장수 + 메타 진행). metaStore.getRoster() 결과. */
  roster: RosterUnit[];
  /** 출진 슬롯 상한(M1: stage의 player 슬롯 수). */
  maxSlots: number;
  /** 현재 선택된 편성. 부모가 보유하는 상태. */
  selected: SortieMember[];
  /** 편성 변경 시 부모로 올림(부모가 writeSortie에 사용). */
  onChange: (members: SortieMember[]) => void;
  /** 현재 스테이지 챕터 — NEW 배지·정렬 기준. */
  chapter: number;
}

// 초상은 파일 유무로 자동 판정 — 있으면 표시, 없으면 onError로 이니셜 폴백(하드코딩 목록 제거,
// 107장 슬라이스 + 보드 자동 슬라이스 흐름과 정합 — 새 초상은 코드 수정 없이 자동 표시).

/** 역할 라벨(편성 분류 — §6 role). */
const ROLE_LABEL: Record<RosterUnit["role"], string> = {
  lord: "군주",
  melee: "전위",
  caster: "책사",
  support: "보조",
  guest: "객장",
};

/** 장비 카테고리 라벨(items.category). */
const CATEGORY_LABEL: Record<Item["category"], string> = {
  weapon: "무기",
  treasure: "보물",
  attackItem: "공격",
  supplyItem: "보조",
  horse: "탈것",
  book: "병법서",
};

// 청동+수묵 팔레트(UnitPanel/HUD와 통일).
const INK_BG = "rgba(16, 14, 10, 0.86)";
const TEXT = "#e8e6e3";
const MUTED = "#9aa3ad";
const DIM = "#6b727c";
const RULE = "#2a2f36";
const ACCENT = "#caa86a"; // 청동 금
const PLAYER_BLUE = "#4da3ff";

function commanderName(commanderId: string): string {
  return gameData.commanders[commanderId]?.name ?? commanderId;
}

function className(classId: string): string {
  return gameData.unitClasses[classId]?.name ?? classId;
}

/** 청동 초상 박스(UnitPanel.PortraitBox 축약판) — 초상 없으면 이름 첫 글자. */
function Portrait({ commanderId, size = 52 }: { commanderId: string; size?: number }): React.ReactElement {
  const name = commanderName(commanderId);
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [commanderId]); // id 바뀌면 초상 재시도
  return (
    <div
      style={{
        ...PORTRAIT_FRAME,
        borderWidth: "13px 9px 13px 9px",
        width: size,
        height: size + 14,
        flexShrink: 0,
        background: "#1a1712",
        backgroundClip: "padding-box",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: ACCENT,
        fontSize: size * 0.4,
        fontWeight: 700,
      }}
    >
      {!failed ? (
        <img
          src={assetUrl(`/assets/ui/portraits/${encodeURIComponent(commanderId)}.webp`)}
          alt={name}
          onError={() => setFailed(true)}
          style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
        />
      ) : (
        name.charAt(0)
      )}
    </div>
  );
}

/** 핵심 스탯 한 줄(공/방/지 = 무력/통솔/지력). 편성 판단용 최소 정보. */
function StatLine({ commanderId }: { commanderId: string }): React.ReactElement {
  const c = gameData.commanders[commanderId];
  if (!c) return <span style={{ color: DIM, fontSize: 11 }}>—</span>;
  return (
    <span style={{ fontSize: 11, color: MUTED, display: "inline-flex", gap: 8 }}>
      <span>무 <strong style={{ color: "#ff8a5c" }}>{c.war}</strong></span>
      <span>통 <strong style={{ color: "#7aa7ff" }}>{c.leadership}</strong></span>
      <span>지 <strong style={{ color: "#b890ff" }}>{c.intelligence}</strong></span>
    </span>
  );
}

/** 한 장수의 SortieMember 변환(편성 시 — 좌표는 stage 슬롯 재사용이라 제외). */
function toMember(u: RosterUnit, items: string[]): SortieMember {
  return {
    commanderId: u.commanderId,
    classId: u.classId,
    level: u.level,
    exp: u.exp,
    items: [...items],
  };
}

export function Formation({ roster, maxSlots, selected, onChange, chapter }: FormationProps): React.ReactElement {
  // 인벤토리 스냅샷(장착 후보). 장착/해제로 inventory 자체는 줄지 않지만(소유 유지),
  // 다른 슬롯과의 중복 장착을 막기 위해 "현재 편성에서 이미 쓴 아이템"을 제외해 보여준다.
  const [inventory, setInventory] = useState<string[]>([]);
  useEffect(() => {
    setInventory(getMeta().inventory);
  }, []);

  const [sortKey, setSortKey] = useState<SortKey>("role");

  // commanderId → 선택 여부 빠른 조회.
  const selectedIds = useMemo(() => new Set(selected.map((m) => m.commanderId)), [selected]);

  const rosterById = useMemo(() => {
    const m = new Map<string, RosterUnit>();
    for (const u of roster) m.set(u.commanderId, u);
    return m;
  }, [roster]);

  const sortedRoster = useMemo(
    () => sortRoster(roster, sortKey, chapter),
    [roster, sortKey, chapter],
  );

  // 편성 전체에서 이미 장착된 아이템(중복 장착 방지용 카운트).
  const equippedCount = useMemo(() => {
    const counts = new Map<string, number>();
    for (const m of selected) for (const it of m.items) counts.set(it, (counts.get(it) ?? 0) + 1);
    return counts;
  }, [selected]);

  /** 후보 카드 토글 — 선택이면 빼고, 아니면(슬롯 여유 시) 추가. */
  const toggle = useCallback(
    (u: RosterUnit) => {
      if (selectedIds.has(u.commanderId)) {
        onChange(selected.filter((m) => m.commanderId !== u.commanderId));
        return;
      }
      if (selected.length >= maxSlots) return; // 슬롯 가득 — 무시(시각적으로 비활성)
      onChange([...selected, toMember(u, u.equipped)]);
    },
    [onChange, selected, selectedIds, maxSlots],
  );

  /** 특정 장수의 장비 갱신 — 편성 페이로드 + metaStore 영속 동시 반영. */
  const updateEquip = useCallback(
    (commanderId: string, items: string[]) => {
      setEquipped(commanderId, items); // 영속(다음 출진에도 유지)
      onChange(selected.map((m) => (m.commanderId === commanderId ? { ...m, items: [...items] } : m)));
    },
    [onChange, selected],
  );

  const slotsLeft = maxSlots - selected.length;

  return (
    <section
      style={{
        ...PANEL_FRAME,
        background: INK_BG,
        backgroundClip: "padding-box",
        color: TEXT,
        padding: "4px 10px 10px",
      }}
    >
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
        <h2 style={{ margin: 0, fontSize: 17, letterSpacing: 1 }}>편성</h2>
        <span style={{ fontSize: 12, color: MUTED }}>
          출전 <strong style={{ color: PLAYER_BLUE }}>{selected.length}</strong>
          <span style={{ color: DIM }}> / {maxSlots}</span>
          {slotsLeft > 0 ? <span style={{ color: DIM }}> · 빈 슬롯 {slotsLeft}</span> : null}
        </span>
      </header>

      {/* 선택된 출전 명단 — 장비 슬롯 포함 */}
      {selected.length > 0 ? (
        <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 6 }}>
          <div style={{ fontSize: 11, color: ACCENT, letterSpacing: 1 }}>출전 명단</div>
          {selected.map((m) => {
            const u = rosterById.get(m.commanderId);
            return (
              <SortieRow
                key={m.commanderId}
                member={m}
                role={u?.role ?? "melee"}
                inventory={inventory}
                equippedCount={equippedCount}
                onEquip={(items) => updateEquip(m.commanderId, items)}
                onRemove={() => u && toggle(u)}
              />
            );
          })}
        </div>
      ) : (
        <p style={{ marginTop: 8, color: MUTED, fontSize: 13 }}>
          아래 후보에서 출전할 장수를 골라 슬롯에 편성하세요.
        </p>
      )}

      {/* 후보 목록 */}
      <div style={{ marginTop: 12, borderTop: `1px solid ${RULE}`, paddingTop: 8 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
          <div style={{ fontSize: 11, color: ACCENT, letterSpacing: 1 }}>
            후보 ({roster.length}명)
          </div>
          {/* 정렬 칩 */}
          <div style={{ display: "flex", gap: 4 }}>
            {(["role", "power", "level", "new"] as SortKey[]).map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => setSortKey(k)}
                style={{
                  fontSize: 10,
                  padding: "2px 7px",
                  borderRadius: 10,
                  border: `1px solid ${sortKey === k ? ACCENT : RULE}`,
                  background: sortKey === k ? "rgba(202,168,106,0.18)" : "transparent",
                  color: sortKey === k ? ACCENT : MUTED,
                  cursor: "pointer",
                }}
              >
                {{ role: "역할", power: "전력", level: "레벨", new: "신규" }[k]}
              </button>
            ))}
          </div>
        </div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))",
            gap: 6,
          }}
        >
          {sortedRoster.map((u) => {
            const on = selectedIds.has(u.commanderId);
            const full = !on && selected.length >= maxSlots;
            const power = unitStats(u.commanderId, u.classId, u.level, u.equipped).power;
            return (
              <button
                key={u.commanderId}
                type="button"
                onClick={() => toggle(u)}
                disabled={full}
                aria-pressed={on}
                style={{
                  display: "flex",
                  gap: 8,
                  alignItems: "center",
                  textAlign: "left",
                  padding: 6,
                  cursor: full ? "not-allowed" : "pointer",
                  borderRadius: 6,
                  border: `1px solid ${on ? ACCENT : RULE}`,
                  background: on ? "rgba(202, 168, 106, 0.14)" : "rgba(255,255,255,0.02)",
                  color: TEXT,
                  opacity: full ? 0.4 : 1,
                }}
              >
                <Portrait commanderId={u.commanderId} size={40} />
                <span style={{ minWidth: 0, flex: 1 }}>
                  <span style={{ display: "flex", justifyContent: "space-between", gap: 6, flexWrap: "wrap" }}>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                      <strong style={{ fontSize: 14 }}>{commanderName(u.commanderId)}</strong>
                      {u.joinChapter === chapter && (
                        <span style={{
                          fontSize: 9, padding: "1px 4px", borderRadius: 8,
                          background: "#c0392b", color: "#fff", fontWeight: 700, lineHeight: 1.4,
                        }}>
                          NEW
                        </span>
                      )}
                    </span>
                    {on ? <span style={{ color: ACCENT, fontSize: 12 }}>출전</span> : null}
                  </span>
                  <span style={{ display: "block", fontSize: 11, color: MUTED }}>
                    {className(u.classId)} · {ROLE_LABEL[u.role]} · Lv.{u.level}
                  </span>
                  <span style={{ display: "block", fontSize: 11, color: MUTED, marginTop: 1 }}>
                    전력 <strong style={{ color: ACCENT }}>{power}</strong>
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}

/** 아이템 1개 추가 시 전력 변화 — 인라인 장착 칩에 표시. */
function PowerDelta({
  commanderId, classId, level, currentItems, candidateItem,
}: {
  commanderId: string; classId: string; level: number;
  currentItems: string[]; candidateItem: string;
}): React.ReactElement {
  const base = unitStats(commanderId, classId, level, currentItems).power;
  const next = unitStats(commanderId, classId, level, [...currentItems, candidateItem]).power;
  const delta = next - base;
  if (delta === 0) return <></>;
  return (
    <span style={{ marginLeft: 4, fontSize: 10, color: delta > 0 ? "#7dcc88" : "#9aa3ad" }}>
      {delta > 0 ? `+${delta}` : `${delta}`}
    </span>
  );
}

/** 출전 명단 한 줄 — 장수 + 장비 슬롯(장착/해제) + 빼기. */
function SortieRow({
  member,
  role,
  inventory,
  equippedCount,
  onEquip,
  onRemove,
}: {
  member: SortieMember;
  role: RosterUnit["role"];
  inventory: string[];
  equippedCount: Map<string, number>;
  onEquip: (items: string[]) => void;
  onRemove: () => void;
}): React.ReactElement {
  const items = gameData.items;
  // 장착 가능 후보 = 인벤토리 보유 수에서 (편성 전체 장착 수)를 뺀 잔여 + 이 장수가 이미 낀 것.
  // 인벤토리 중복 보유 허용 → itemId별 보유 개수와 사용 개수를 비교한다.
  const ownedCount = useMemo(() => {
    const c = new Map<string, number>();
    for (const it of inventory) c.set(it, (c.get(it) ?? 0) + 1);
    return c;
  }, [inventory]);

  /**
   * 이 장수가 추가로 낄 수 있는 미장착 아이템 목록(중복 보유분 고려).
   * 보유 개수 owned 중 편성 전체에서 used개가 이미 장착됨 → 남은 free = owned - used.
   * free > 0 이면 이 장수가 한 개 더 낄 수 있다(이 장수가 이미 낀 양은 used에 포함되므로
   * 여기에 남은 free는 "아무도 안 낀 여분"만 가리킨다 — 그대로 후보로 노출).
   */
  const available = useMemo(() => {
    const out: string[] = [];
    for (const [itemId, owned] of ownedCount) {
      const used = equippedCount.get(itemId) ?? 0;
      if (owned - used > 0) out.push(itemId);
    }
    return out;
  }, [ownedCount, equippedCount]);

  const addItem = useCallback(
    (itemId: string) => {
      onEquip([...member.items, itemId]);
    },
    [member.items, onEquip],
  );

  const removeItemAt = useCallback(
    (idx: number) => {
      const next = member.items.slice();
      next.splice(idx, 1);
      onEquip(next);
    },
    [member.items, onEquip],
  );

  return (
    <div
      style={{
        display: "flex",
        gap: 8,
        alignItems: "flex-start",
        padding: 6,
        borderRadius: 6,
        border: `1px solid ${RULE}`,
        background: "rgba(202, 168, 106, 0.06)",
      }}
    >
      <Portrait commanderId={member.commanderId} size={44} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 6 }}>
          <strong style={{ fontSize: 14 }}>{commanderName(member.commanderId)}</strong>
          <span style={{ fontSize: 11, color: MUTED }}>
            {className(member.classId)} · {ROLE_LABEL[role]} · Lv.{member.level}
          </span>
        </div>
        {/* 현재 전력(장착 반영) */}
        <span style={{ display: "block", fontSize: 11, color: MUTED, marginTop: 1 }}>
          전력 <strong style={{ color: ACCENT }}>
            {unitStats(member.commanderId, member.classId, member.level, member.items).power}
          </strong>
        </span>

        {/* 장착 슬롯 — 칩, 탭하면 해제 */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 4 }}>
          {member.items.length === 0 ? (
            <span style={{ fontSize: 11, color: DIM }}>장비 없음</span>
          ) : (
            member.items.map((itemId, idx) => (
              <button
                key={`${itemId}-${idx}`}
                type="button"
                onClick={() => removeItemAt(idx)}
                title="해제"
                style={{
                  fontSize: 11,
                  padding: "2px 7px",
                  borderRadius: 10,
                  border: `1px solid ${ACCENT}`,
                  background: "rgba(202, 168, 106, 0.16)",
                  color: TEXT,
                  cursor: "pointer",
                }}
              >
                {items[itemId]?.name ?? itemId}
                <span style={{ color: DIM, marginLeft: 4 }}>✕</span>
              </button>
            ))
          )}
        </div>

        {/* 장착 가능 후보 — 항상 인라인 칩(details 없음) */}
        {available.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 4 }}>
            {available.map((itemId) => {
              const it = items[itemId];
              return (
                <button
                  key={itemId}
                  type="button"
                  onClick={() => addItem(itemId)}
                  style={{
                    fontSize: 11,
                    padding: "2px 7px",
                    borderRadius: 10,
                    border: `1px solid ${RULE}`,
                    background: "rgba(255,255,255,0.03)",
                    color: TEXT,
                    cursor: "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                  }}
                >
                  {it?.name ?? itemId}
                  <PowerDelta
                    commanderId={member.commanderId}
                    classId={member.classId}
                    level={member.level}
                    currentItems={member.items}
                    candidateItem={itemId}
                  />
                </button>
              );
            })}
          </div>
        )}
      </div>

      <button
        type="button"
        onClick={onRemove}
        title="편성 해제"
        style={{
          ...BUTTON_FRAME,
          borderWidth: "10px 14px",
          background: "transparent",
          color: MUTED,
          fontSize: 12,
          cursor: "pointer",
          flexShrink: 0,
          alignSelf: "center",
        }}
      >
        빼기
      </button>
    </div>
  );
}
