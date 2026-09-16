"use client";
/**
 * 편성 화면 (§10 막간 = 상점→편성→출진). /prep 셸이 <Shop/>과 나란히 합성한다.
 *
 * Commander cards are the single selection list. Summary and sortie actions sit below them.
 * The right panel shows stats and equipment; narrow screens use a detail sheet.
 * Tapping the focused deployed card again removes it from the formation.
 *
 * 불가침(CLAUDE.md §10/§13): 확률 강화·랜덤 스탯 없음. 장비는 "지정 장착"만.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { gameData } from "../../game/data";
import { isConsumable } from "@tk/engine";
import type { RosterUnit } from "../metaStore";
import { getMeta } from "../metaStore";
import type { SortieMember } from "../sortie";
import { unitStats } from "../unitStats";
import { sortRoster, type SortKey } from "../rosterSort";
import { CommanderPortrait } from "../../ui/CommanderPortrait";
import { CommanderFigure } from "../../ui/CommanderFigure";
import { CommanderDetail, type StatMax } from "./CommanderDetail";
import { ArmyPouch } from "./ArmyPouch";
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
  actions?: React.ReactNode;
  /** Detail target owned by the preparation shell. */
  focusId: string | null;
  onFocus: (commanderId: string | null) => void;
  /** 장비 변경 — 셸이 스토어·roster·출진 멤버 3곳을 한 번에 동기(스냅샷 갈라짐 방지) */
  onEquip: (commanderId: string, items: string[]) => void;
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
      display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap",
      background: "#342912",
      border: `1px solid ${GOLD_DIM}88`,
      borderRadius: 6,
      padding: "6px 10px",
      marginBottom: 10,
    }}>
      <span style={{
        display: "none", width: 20, height: 20, borderRadius: 4, flexShrink: 0,
        background: `linear-gradient(135deg, ${SEAL_RED}, #6a1e14)`,
        border: "1px solid rgba(0,0,0,0.5)",
        alignItems: "center", justifyContent: "center",
        fontSize: 12, fontWeight: 900, color: "#f0e2c8",
      }}>{seal}</span>
      <span style={{ fontSize: 13.5, fontWeight: 700, color: GOLD_BRIGHT, letterSpacing: "0.14em" }}>
        {title}
      </span>
      {children && <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginLeft: "auto" }}>{children}</div>}
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
  roster, maxSlots, selected, onChange, chapter, focusId, onFocus, onEquip, actions,
}: FormationProps): React.ReactElement {
  const narrow = useNarrow();

  const [inventory, setInventory] = useState<string[]>([]);
  useEffect(() => { setInventory(getMeta().inventory); }, []);

  // 부대 공유 소모품(원작 창고 §7) — 장착하지 않고 전투 중 「도구」로 쓴다. 재고 표시용.
  const armyConsumables = useMemo(
    () => inventory.filter((id) => isConsumable(gameData.items[id]?.category ?? "")),
    [inventory],
  );

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

  // 카드 탭(2026-07-03 유저 요청 "한번 더 클릭하면 출진에서 빠지게"):
  //  - 미배치 + 여유 → 배치 + 포커스
  //  - 배치됨 & 이미 포커스된 카드 재탭 → 해제 (오탭 방지: 다른 배치 카드는 포커스만)
  //  - 슬롯 가득/그 외 → 상세 포커스만
  const tapCard = useCallback((u: RosterUnit) => {
    const id = u.commanderId;
    if (selectedIds.has(id)) {
      if (focusId === id) { undeploy(id); return; }
      onFocus(id);
    } else if (selected.length < maxSlots) {
      deploy(u); onFocus(id);
    } else {
      onFocus(id);
    }
  }, [selectedIds, focusId, selected.length, maxSlots, deploy, undeploy, onFocus]);

  // 넓은 화면은 항상 무언가 보여준다(빈 패널 방지); 바텀시트는 명시 탭에만 열린다.
  const wideFocusId = focusId ?? selected[0]?.commanderId ?? sortedRoster[0]?.commanderId ?? null;
  const detailId = narrow ? focusId : wideFocusId;
  const detailUnit = detailId ? roster.find((u) => u.commanderId === detailId) ?? null : null;
  const detailMember = detailId ? selected.find((m) => m.commanderId === detailId) ?? null : null;

  const detailPanel = detailUnit && (
    <CommanderDetail
      unit={detailUnit}
      member={detailMember}
      statMax={statMax}
      inventory={inventory}
      equippedCount={equippedCount}
      onEquip={(items) => onEquip(detailUnit.commanderId, items)}
      onClose={narrow ? () => onFocus(null) : undefined}
    />
  );

  return (
    <section style={{
      background: "#241e10",
      border: "1px solid #806738",
      boxShadow: "none",
      borderRadius: 8,
      padding: 12,
      fontFamily: SERIF,
      display: "grid",
      gridTemplateColumns: narrow ? "minmax(0,1fr)" : "minmax(0,1fr) 336px",
      gap: 14,
    }}>
      {/* ━━ 좌: 장수 선택 그리드 ━━ */}
      <div style={{ minWidth: 0, position: "relative", display: "flex", flexDirection: "column" }}>
        <Ribbon seal="將" title={`장수 선택 — ${chapter}장 편성`}>
          {(["role", "power", "level", "new"] as SortKey[]).map((k) => {
            const label = ({ role: "역할", power: "전투", level: "레벨", new: "신규" } as Record<SortKey, string>)[k];
            const active = sortKey === k;
            return (
              <button
                key={k} type="button" onClick={() => setSortKey(k)}
                style={{
                  minWidth: 44, minHeight: 44, fontSize: 13, padding: "6px 9px", borderRadius: 4, fontFamily: "inherit",
                  border: `1px solid ${active ? GOLD : GOLD_DIM + "66"}`,
                  background: active ? GOLD_GLOW : "transparent",
                  color: active ? GOLD_BRIGHT : "#c4b27e",
                  fontWeight: active ? 700 : 400,
                  cursor: "pointer",
                }}
              >
                {label}
              </button>
            );
          })}
        </Ribbon>

        <p style={{ fontFamily: "system-ui", fontSize: 13, color: "#baaa85", lineHeight: 1.5 }}>장수를 누르면 배치와 상세를 확인합니다. 선택한 장수를 다시 누르면 편성에서 해제합니다.</p>
        <div style={{ display: "grid", gridTemplateColumns: narrow ? "repeat(3, minmax(0, 1fr))" : "repeat(auto-fill, minmax(92px, 1fr))", gap: 8, alignContent: "start" }}>
          {sortedRoster.map(u => {
            const index = selected.findIndex(m => m.commanderId === u.commanderId);
            const on = index >= 0;
            return <article key={u.commanderId} style={{ border: `2px solid ${on ? "#b85336" : "transparent"}`, borderRadius: 8, background: on ? "linear-gradient(#65291c, #302411)" : "transparent", overflow: "hidden" }}>
              <button type="button" aria-label={`${commanderName(u.commanderId)} ${on ? `출진 ${index + 1}번` : "배치"}`} aria-pressed={on} onClick={() => tapCard(u)} style={{ width: "100%", border: 0, padding: 6, background: "transparent", color: PARCHMENT, cursor: "pointer", fontFamily: "system-ui", textAlign: "center" }}>
                <div style={{ textAlign: "right", fontSize: 12, minHeight: 18, color: on ? "#f2d16b" : "#bba875" }}>{on ? `${index + 1} · 출진` : ""}</div>
                <div style={{ height: 84, width: "100%", margin: "0 auto" }}><CommanderFigure commanderId={u.commanderId} classId={u.classId} tier={gameData.unitClasses[u.classId]?.tier ?? 1} name={commanderName(u.commanderId)} /></div>
                <span style={{ display: "block", fontSize: 13, color: "#8ecd67", marginTop: 3 }}>Lv.{u.level}</span>
                <strong style={{ display: "block", fontSize: 15, marginTop: 2 }}>{commanderName(u.commanderId)}</strong>
              </button>
            </article>;
          })}
        </div>
        <div style={{ marginTop: "auto", paddingTop: 20 }}>{actions}</div>
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

      {/* ━━ 부대 소지품(창고) — 전폭 스트립. 소모품은 부대 공유(원작 창고 §7) ━━ */}
      <div style={{ gridColumn: "1 / -1" }}>
        <ArmyPouch consumables={armyConsumables} />
      </div>

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
