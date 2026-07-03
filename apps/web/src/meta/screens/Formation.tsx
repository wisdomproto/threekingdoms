"use client";
/**
 * 편성 화면 (§10 막간 = 상점→편성→출진). /prep 셸이 <Shop/>과 나란히 합성한다.
 *
 * 2026-07-03 레퍼런스 재구성 — 3존 문법:
 *  - 좌: 「장수 선택」 카드 그리드(초상 카드 + 배치됨 플라크 + 역할 뱃지, 정렬 칩).
 *  - 우: 「선택된 장수 상세」(CommanderDetail — 스탯 바·장비 슬롯·편성/해제). 좁은 화면은 바텀시트.
 *  - 하단 출진 슬롯/출정 버튼은 SortieBar(셸 소유)가 담당 — 종전 화면 내 슬롯 행은 그리로 이관.
 *
 * 인터랙션(오탭 해제 방지): 카드 탭 = 미배치·여유면 배치+상세, 그 외(배치됨/가득)는 상세만.
 * 배치 해제는 상세 패널 「편성 해제」 또는 하단 슬롯 ✕ 로만.
 *
 * 불가침(CLAUDE.md §10/§13): 확률 강화·랜덤 스탯 없음. 장비는 "지정 장착"만.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import type { RosterUnit } from "../metaStore";
import { getMeta, setEquipped } from "../metaStore";
import type { SortieMember } from "../sortie";
import { unitStats } from "../unitStats";
import { sortRoster, type SortKey } from "../rosterSort";
import { CommanderPortrait } from "../../ui/CommanderPortrait";
import { CommanderDetail, type StatMax } from "./CommanderDetail";
import {
  PARCHMENT, PARCHMENT_WARM, INK_PANEL, WOOD, GOLD, GOLD_BRIGHT, GOLD_DIM,
  GOLD_GLOW, MUTED_TEXT, SEAL_RED, SERIF, ROLE_LABEL, ROLE_COLOR, ROLE_ICON, commanderName, className,
} from "./formationUi";

export interface FormationProps {
  roster: RosterUnit[];
  maxSlots: number;
  selected: SortieMember[];
  onChange: (members: SortieMember[]) => void;
  chapter: number;
  /** 상세 패널 대상(셸 소유 — 하단 슬롯 칩 탭과 공유) */
  focusId: string | null;
  onFocus: (commanderId: string | null) => void;
}

/** 상세 패널을 우측 컬럼(넓음) ↔ 바텀시트(좁음)로 가르는 기준 */
function useNarrow(breakpoint = 880): boolean {
  const [narrow, setNarrow] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia(`(max-width:${breakpoint}px)`);
    const sync = (): void => setNarrow(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, [breakpoint]);
  return narrow;
}

/** 패널 머리 리본 — 먹빛 바 + 붉은 인장 + 청동 제목 */
function Ribbon({ seal, title, children }: {
  seal: string; title: string; children?: React.ReactNode;
}): React.ReactElement {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 8,
      background: "linear-gradient(to bottom, rgba(26,20,11,0.96), rgba(16,12,7,0.96))",
      border: `1px solid ${GOLD_DIM}88`,
      borderRadius: 6,
      padding: "6px 10px",
      marginBottom: 10,
    }}>
      <span style={{
        width: 20, height: 20, borderRadius: 4, flexShrink: 0,
        background: `linear-gradient(135deg, ${SEAL_RED}, #6a1e14)`,
        border: "1px solid rgba(0,0,0,0.5)",
        display: "inline-flex", alignItems: "center", justifyContent: "center",
        fontSize: 12, fontWeight: 900, color: "#f0e2c8",
      }}>{seal}</span>
      <span style={{ fontSize: 13.5, fontWeight: 700, color: GOLD_BRIGHT, letterSpacing: "0.14em" }}>
        {title}
      </span>
      <span style={{ flex: 1 }} />
      {children}
    </div>
  );
}

/** 역할 뱃지 — 카드 좌상단. */
function RoleBadge({ role, size = 24 }: { role: string; size?: number }): React.ReactElement {
  const color = ROLE_COLOR[role] ?? "#5a5868";
  return (
    <div style={{
      position: "absolute", top: 6, left: 6, zIndex: 2,
      width: size, height: size,
      background: `linear-gradient(135deg, ${color}, ${color}bb)`,
      borderRadius: 4,
      border: "1px solid rgba(0,0,0,0.4)",
      display: "flex", alignItems: "center", justifyContent: "center",
      boxShadow: "0 1px 4px rgba(0,0,0,0.5)",
      fontSize: Math.round(size * 0.52), color: "#fff", fontWeight: 900,
    }} title={ROLE_LABEL[role] ?? "장수"}>
      {ROLE_ICON[role] ?? "兵"}
    </div>
  );
}

function toMember(u: RosterUnit, items: string[]): SortieMember {
  return { commanderId: u.commanderId, classId: u.classId, level: u.level, exp: u.exp, items: [...items] };
}

export function Formation({
  roster, maxSlots, selected, onChange, chapter, focusId, onFocus,
}: FormationProps): React.ReactElement {
  const narrow = useNarrow();

  const [inventory, setInventory] = useState<string[]>([]);
  useEffect(() => { setInventory(getMeta().inventory); }, []);

  const [sortKey, setSortKey] = useState<SortKey>("role");

  const selectedIds = useMemo(() => new Set(selected.map((m) => m.commanderId)), [selected]);
  const sortedRoster = useMemo(() => sortRoster(roster, sortKey, chapter), [roster, sortKey, chapter]);
  // 장착 수량 = 배치 멤버(items 실시간) + 미배치 로스터(equipped 저장분). 종전엔 배치 멤버만 세서
  // 미배치 장수의 시작 장비(유비 쌍고검 등)가 남에게 "장착 가능"으로 떠 복제될 수 있었다(2026-07-03).
  const equippedCount = useMemo(() => {
    const counts = new Map<string, number>();
    for (const m of selected) for (const it of m.items) counts.set(it, (counts.get(it) ?? 0) + 1);
    for (const u of roster) {
      if (selectedIds.has(u.commanderId)) continue;
      for (const it of u.equipped) counts.set(it, (counts.get(it) ?? 0) + 1);
    }
    return counts;
  }, [selected, roster, selectedIds]);

  // 스탯 바 정규화 기준 — 로스터 전체 최대치(상대 비교가 정보값)
  const statMax = useMemo<StatMax>(() => {
    const max: StatMax = { atk: 1, def: 1, spirit: 1 };
    for (const u of roster) {
      const s = unitStats(u.commanderId, u.classId, u.level, u.equipped);
      if (s.atk > max.atk) max.atk = s.atk;
      if (s.def > max.def) max.def = s.def;
      if (s.spirit > max.spirit) max.spirit = s.spirit;
    }
    return max;
  }, [roster]);

  const deploy = useCallback((u: RosterUnit) => {
    if (selectedIds.has(u.commanderId) || selected.length >= maxSlots) return;
    onChange([...selected, toMember(u, u.equipped)]);
  }, [onChange, selected, selectedIds, maxSlots]);

  const undeploy = useCallback((commanderId: string) => {
    onChange(selected.filter((m) => m.commanderId !== commanderId));
  }, [onChange, selected]);

  // 카드 탭: 미배치+여유 → 배치까지, 그 외 → 상세만(배치됨 카드 탭이 해제가 되지 않게)
  const tapCard = useCallback((u: RosterUnit) => {
    if (!selectedIds.has(u.commanderId) && selected.length < maxSlots) deploy(u);
    onFocus(u.commanderId);
  }, [selectedIds, selected.length, maxSlots, deploy, onFocus]);

  const updateEquip = useCallback((commanderId: string, items: string[]) => {
    setEquipped(commanderId, items);
    onChange(selected.map((m) => (m.commanderId === commanderId ? { ...m, items: [...items] } : m)));
  }, [onChange, selected]);

  // 넓은 화면은 항상 무언가 보여준다(빈 패널 방지); 바텀시트는 명시 탭에만 열린다.
  const wideFocusId = focusId ?? selected[0]?.commanderId ?? sortedRoster[0]?.commanderId ?? null;
  const detailId = narrow ? focusId : wideFocusId;
  const detailUnit = detailId ? roster.find((u) => u.commanderId === detailId) ?? null : null;
  const detailMember = detailId ? selected.find((m) => m.commanderId === detailId) ?? null : null;

  const detailPanel = detailUnit && (
    <CommanderDetail
      unit={detailUnit}
      member={detailMember}
      canDeploy={selected.length < maxSlots}
      statMax={statMax}
      inventory={inventory}
      equippedCount={equippedCount}
      onEquip={(items) => updateEquip(detailUnit.commanderId, items)}
      onDeploy={() => deploy(detailUnit)}
      onUndeploy={() => undeploy(detailUnit.commanderId)}
      onClose={narrow ? () => onFocus(null) : undefined}
    />
  );

  return (
    <section style={{
      background: `linear-gradient(150deg, ${PARCHMENT_WARM} 0%, ${PARCHMENT} 55%, #e2d6b6 100%)`,
      border: `3px solid ${WOOD}`,
      boxShadow: `inset 0 0 0 2px ${GOLD}, inset 0 0 0 5px #3a2410, inset 0 0 60px rgba(90,70,40,0.18)`,
      borderRadius: 8,
      padding: 12,
      fontFamily: SERIF,
      display: "grid",
      gridTemplateColumns: narrow ? "minmax(0,1fr)" : "minmax(0,1fr) 336px",
      gap: 14,
    }}>
      {/* ━━ 좌: 장수 선택 그리드 ━━ */}
      <div style={{ minWidth: 0, position: "relative" }}>
        {/* 빈 양피지 채우는 수묵 워터마크 — 초반 챕터(로스터 5명)에 벌판처럼 비지 않게 */}
        <span aria-hidden style={{
          position: "absolute", inset: "40px 0 0 0",
          display: "flex", alignItems: "center", justifyContent: "center",
          pointerEvents: "none", userSelect: "none",
          fontSize: "min(240px, 40vw)", fontWeight: 900, lineHeight: 1,
          color: "rgba(90, 70, 40, 0.08)", letterSpacing: "0.1em",
        }}>出陣</span>
        <Ribbon seal="將" title={`장수 선택 — ${chapter}장 편성`}>
          {(["role", "power", "level", "new"] as SortKey[]).map((k) => {
            const label = ({ role: "역할", power: "전투", level: "레벨", new: "신규" } as Record<SortKey, string>)[k];
            const active = sortKey === k;
            return (
              <button
                key={k} type="button" onClick={() => setSortKey(k)}
                style={{
                  fontSize: 10.5, padding: "3px 9px", borderRadius: 4, fontFamily: "inherit",
                  border: `1px solid ${active ? GOLD : GOLD_DIM + "66"}`,
                  background: active ? GOLD_GLOW : "transparent",
                  color: active ? GOLD_BRIGHT : "#b8a070",
                  fontWeight: active ? 700 : 400,
                  cursor: "pointer",
                }}
              >
                {label}
              </button>
            );
          })}
        </Ribbon>

        <div style={{
          display: "grid",
          // 레퍼런스 밀도(≈4열) — 5명뿐인 1장도 2줄로 앉아 좌측 컬럼이 빈 벌판이 안 된다(2026-07-03).
          gridTemplateColumns: "repeat(auto-fill, minmax(190px, 1fr))",
          gap: 10,
          alignContent: "start",
        }}>
          {sortedRoster.map((u) => {
            const on = selectedIds.has(u.commanderId);
            const isFocus = detailId === u.commanderId;
            const isNew = u.joinChapter === chapter;
            return (
              <button
                key={u.commanderId}
                type="button"
                onClick={() => tapCard(u)}
                aria-pressed={on}
                style={{
                  position: "relative",
                  display: "flex", flexDirection: "column", alignItems: "stretch",
                  padding: 0, minWidth: 0,
                  borderRadius: 8,
                  border: isFocus ? `2px solid ${GOLD_BRIGHT}` : `2px solid ${on ? GOLD + "aa" : "#3a2c1866"}`,
                  background: "linear-gradient(to bottom, #241a0e, #171208)",
                  boxShadow: isFocus
                    ? `0 0 18px ${GOLD_GLOW}, 0 3px 12px rgba(0,0,0,0.35)`
                    : "0 3px 10px rgba(0,0,0,0.3)",
                  cursor: "pointer",
                  overflow: "hidden",
                  transition: "box-shadow 0.12s, border-color 0.12s",
                  fontFamily: "inherit",
                }}
              >
                <RoleBadge role={u.role} />

                {/* 배치됨 플라크 / NEW */}
                {on ? (
                  <span style={{
                    position: "absolute", top: 6, right: 6, zIndex: 2,
                    background: "linear-gradient(to bottom, #ddd3ba, #b8ab8c)",
                    color: "#241a0e", borderRadius: 3, padding: "2px 6px",
                    fontSize: 9, fontWeight: 800, letterSpacing: "0.08em",
                    border: "1px solid rgba(0,0,0,0.45)", boxShadow: "0 1px 3px rgba(0,0,0,0.4)",
                  }}>배치됨</span>
                ) : isNew ? (
                  <span style={{
                    position: "absolute", top: 6, right: 6, zIndex: 2,
                    background: "#c0392b", borderRadius: 3, padding: "2px 5px",
                    fontSize: 8, color: "#fff", fontWeight: 800, letterSpacing: 0.5,
                  }}>NEW</span>
                ) : null}

                {/* 초상 */}
                <div style={{ aspectRatio: "3 / 3.6", minWidth: 0 }}>
                  <CommanderPortrait commanderId={u.commanderId} name={commanderName(u.commanderId)} />
                </div>

                {/* 명판 */}
                <div style={{
                  padding: "5px 6px 6px",
                  background: "linear-gradient(to bottom, rgba(14,10,5,0.9), rgba(10,7,3,0.96))",
                  borderTop: `1px solid ${on || isFocus ? GOLD + "77" : "rgba(200,164,64,0.18)"}`,
                  display: "flex", flexDirection: "column", gap: 3,
                }}>
                  <span style={{
                    fontSize: 14.5, fontWeight: 700, color: PARCHMENT,
                    letterSpacing: "0.05em", lineHeight: 1.1,
                    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                  }}>
                    {commanderName(u.commanderId)}
                  </span>
                  <span style={{
                    display: "flex", alignItems: "center", justifyContent: "space-between", gap: 4,
                  }}>
                    <span style={{ fontSize: 10, color: GOLD_DIM, fontWeight: 700 }}>Lv.{u.level}</span>
                    <span style={{
                      fontSize: 9.5, color: "#cbb88e",
                      overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                    }}>{className(u.classId)}</span>
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* ━━ 우: 선택된 장수 상세 (넓은 화면 — 컬럼은 늘고, 내용만 sticky) ━━ */}
      {!narrow && (
        <div>
        <div style={{ position: "sticky", top: 8 }}>
          <Ribbon seal="詳" title="선택된 장수 상세" />
          {detailPanel ?? (
            <div style={{
              background: INK_PANEL, border: `1px dashed ${GOLD_DIM}66`, borderRadius: 10,
              padding: "40px 16px", textAlign: "center", color: MUTED_TEXT, fontSize: 12,
            }}>
              장수를 선택하세요
            </div>
          )}
        </div>
        </div>
      )}

      {/* ━━ 좁은 화면: 상세 바텀시트 ━━ */}
      {narrow && focusId && detailPanel && (
        <>
          <div
            onClick={() => onFocus(null)}
            style={{ position: "fixed", inset: 0, zIndex: 30, background: "rgba(6,5,3,0.5)" }}
          />
          <div style={{
            position: "fixed", left: 8, right: 8, bottom: 8, zIndex: 31,
            maxHeight: "76dvh", overflowY: "auto",
            borderRadius: 12,
            boxShadow: "0 -8px 40px rgba(0,0,0,0.6)",
          }}>
            {detailPanel}
          </div>
        </>
      )}
    </section>
  );
}
