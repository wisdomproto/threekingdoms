"use client";
/**
 * UnitPanel (설계 §2.3) — 선택/조회 중인 유닛 정보 패널.
 * 순수 표시 컴포넌트: settled 기반 BattleVM + InputState만 받아 그린다 (스토어 직접 접근 금지).
 * 표시 대상: selected/postMoveMenu/targetSelect의 unitId, idle의 inspectedId.
 */
import { useState } from "react";
import type { Grade } from "@tk/data";
import type { InputState } from "../inputMachine";
import { rangeGrid } from "../rangeGrid";
import type { BattleVM, ItemVM, StrategyVM, UnitVM } from "../viewmodel";
import { PANEL_FRAME, PORTRAIT_FRAME } from "./frames";

/** 초상 보유 장수 (apps/web/public/assets/ui/portraits/{name}.webp). 생기는 대로 추가 */
const PORTRAIT_IDS = new Set(["관우", "화웅"]);

/** 청동 초상 프레임 + 얼굴 (조조전 장수 정보 패널 §1) */
function PortraitBox({ name }: { name: string }): React.ReactElement {
  return (
    <div
      style={{
        ...PORTRAIT_FRAME,
        borderWidth: "15px 11px 15px 11px",
        width: 56,
        height: 70,
        flexShrink: 0,
        background: "#1a1712",
        backgroundClip: "padding-box",
      }}
    >
      <img
        src={`/assets/ui/portraits/${encodeURIComponent(name)}.webp`}
        alt={name}
        style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
      />
    </div>
  );
}

function activeUnitId(ui: InputState): string | null {
  switch (ui.kind) {
    case "idle":
      return ui.inspectedId ?? null;
    case "selected":
    case "postMoveMenu":
    case "targetSelect":
    case "strategyMenu":
    case "strategyTarget":
      return ui.unitId;
    default:
      return null;
  }
}

const PANEL_STYLE: React.CSSProperties = {
  position: "absolute",
  top: 44,
  left: 12,
  minWidth: 200,
  maxWidth: 268,
  padding: "2px 6px 4px",
  // 청동 프레임(border-image) + 가운데만 어둡게(padding-box) — 프레임 안쪽에 내용
  ...PANEL_FRAME,
  background: "rgba(16, 14, 10, 0.86)",
  backgroundClip: "padding-box",
  color: "#e8e6e3",
  fontSize: 14,
  lineHeight: 1.45,
  pointerEvents: "none", // 정보 전용 — 맵 탭을 가리지 않는다
  userSelect: "none",
};

/** 진영색 (Tier 2-1): 아군 파랑 / 우군 주황 / 적 빨강 */
function sideColor(side: UnitVM["side"]): string {
  return side === "enemy" ? "#ff6b6b" : side === "ally" ? "#ffa53d" : "#4da3ff";
}
/** 진영 라벨 */
function sideLabel(side: UnitVM["side"]): string {
  return side === "enemy" ? "적군" : side === "ally" ? "우군" : "아군";
}

function TroopsBar({ unit }: { unit: UnitVM }): React.ReactElement {
  const ratio = unit.maxTroops > 0 ? Math.max(0, unit.troops / unit.maxTroops) : 0;
  const color = sideColor(unit.side);
  return (
    <div style={{ marginTop: 6 }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
        <span>병력</span>
        <span>
          {unit.troops} / {unit.maxTroops}
        </span>
      </div>
      <div style={{ height: 6, borderRadius: 3, background: "#2a2f36", marginTop: 2 }}>
        <div
          style={{
            width: `${Math.round(ratio * 100)}%`,
            height: "100%",
            borderRadius: 3,
            background: color,
          }}
        />
      </div>
    </div>
  );
}

/**
 * 능력치 막대 (조조전 장수 정보 패널 §1: 공격력/방어력/정신력 등) — 1~100 스케일.
 * 순발(민첩)·사기 막대는 엔진 미보유/고정값이라 생략 (sosoden-battle-ux-analysis §1).
 */
function StatBar({
  label,
  value,
  sub,
  color,
}: {
  label: string;
  value: number;
  sub?: number; // 장수 원값(무력/통솔/지력) — 괄호 표시 + 바 기준
  color: string;
}): React.ReactElement {
  // 바는 장수 원값(0~100)을 보여주고(강함 직관), 숫자는 실제 부대 능력치
  const ratio = Math.max(0, Math.min(1, (sub ?? value) / 100));
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, marginTop: 3 }}>
      <span style={{ width: 40, color: "#9aa3ad", flexShrink: 0 }}>{label}</span>
      <div style={{ flex: 1, height: 5, borderRadius: 3, background: "#2a2f36" }}>
        <div style={{ width: `${Math.round(ratio * 100)}%`, height: "100%", borderRadius: 3, background: color }} />
      </div>
      <span style={{ minWidth: 44, textAlign: "right", flexShrink: 0 }}>
        {value}
        {sub !== undefined ? <span style={{ color: "#6b727c", fontSize: 11 }}> ({sub})</span> : null}
      </span>
    </div>
  );
}

/**
 * 기본능력(장수 원값) 3종 — 무력/통솔/지력. 파생 스탯의 출처를 한눈에.
 * 청동 칩 형태로 나란히(모바일 가로폭 절약).
 */
function BaseAbilities({ unit }: { unit: UnitVM }): React.ReactElement {
  const items: { label: string; value: number; color: string }[] = [
    { label: "무력", value: unit.warStat, color: "#ff8a5c" },
    { label: "통솔", value: unit.leadershipStat, color: "#7aa7ff" },
    { label: "지력", value: unit.intelligenceStat, color: "#b890ff" },
  ];
  return (
    <div style={{ display: "flex", gap: 4, marginTop: 2 }}>
      {items.map((it) => (
        <div
          key={it.label}
          style={{
            flex: 1,
            background: "#161310",
            border: "1px solid #3a352b",
            borderRadius: 3,
            padding: "1px 0 2px",
            textAlign: "center",
            minWidth: 0,
          }}
        >
          <div style={{ fontSize: 10, color: "#9aa3ad", lineHeight: 1.2 }}>{it.label}</div>
          <div style={{ fontSize: 15, fontWeight: 700, color: it.color, lineHeight: 1.1 }}>{it.value}</div>
        </div>
      ))}
    </div>
  );
}

/**
 * 공격범위 미니 격자 (§8-7) — 병종 rangeMin~rangeMax를 도넛 모양으로.
 * 중앙=유닛(청동), 도넛=공격 가능 칸(주황 발광), 나머지=빈 칸. 순수 표현(rangeGrid 데이터).
 */
function RangeGridMini({ unit }: { unit: UnitVM }): React.ReactElement {
  const grid = rangeGrid(unit.rangeMin, unit.rangeMax);
  const cell = 9; // px — 모바일에서도 7×7이 ~70px 이내
  const gap = 1;
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: `repeat(${grid.size}, ${cell}px)`,
          gap,
          padding: 3,
          background: "#13110d",
          border: "1px solid #3a352b",
          borderRadius: 3,
        }}
      >
        {grid.cells.map((c) => {
          const bg =
            c.kind === "center" ? "#c89b5a" : c.kind === "donut" ? "#e0742a" : "#23201a";
          return (
            <div
              key={`${c.dx},${c.dy}`}
              style={{
                width: cell,
                height: cell,
                background: bg,
                borderRadius: 1,
                boxShadow: c.kind === "donut" ? "0 0 2px #e0742a88" : undefined,
              }}
            />
          );
        })}
      </div>
      <span style={{ fontSize: 10, color: "#9aa3ad" }}>공격범위</span>
    </div>
  );
}

/** 탭 식별자 (§8 5탭 → v1 4탭 + 비활성 열전). 데이터 없는 lore는 "준비 중" */
type TabId = "ability" | "equip" | "strategy" | "trait";

const TABS: { id: TabId; label: string }[] = [
  { id: "ability", label: "능력" },
  { id: "equip", label: "장비" },
  { id: "strategy", label: "책략" },
  { id: "trait", label: "특성" },
];

/** 등급(S~D) 색 — S=금/A=청록/B=청/C=회/D=적갈 (특성 탭 뱃지) */
function gradeColor(g: Grade): string {
  switch (g) {
    case "S": return "#e7c14b";
    case "A": return "#5fd1b0";
    case "B": return "#7aa7ff";
    case "C": return "#9aa3ad";
    default:  return "#c2795a";
  }
}

function GradeBadge({ label, grade }: { label: string; grade: Grade }): React.ReactElement {
  const c = gradeColor(grade);
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flex: 1, minWidth: 0 }}>
      <span style={{ fontSize: 10, color: "#9aa3ad" }}>{label}</span>
      <span
        style={{
          marginTop: 1,
          minWidth: 20,
          textAlign: "center",
          fontSize: 13,
          fontWeight: 800,
          color: c,
          border: `1px solid ${c}`,
          borderRadius: 3,
          padding: "0 2px",
          background: "#16130f",
        }}
      >
        {grade}
      </span>
    </div>
  );
}

/** 탭 본문 공통 빈 상태 행 */
function EmptyRow({ text }: { text: string }): React.ReactElement {
  return <div style={{ fontSize: 12, color: "#6b727c", padding: "6px 0", textAlign: "center" }}>{text}</div>;
}

/** 능력 탭 — 기존 기본능력/파생/공격범위(설계 §8 능력+열전 통합 표시) */
function AbilityTab({ unit }: { unit: UnitVM }): React.ReactElement {
  return (
    <>
      <TroopsBar unit={unit} />
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginTop: 4 }}>
        <span>MP</span>
        <span>{unit.mp} / {unit.maxMp}</span>
      </div>
      <div style={{ marginTop: 6, borderTop: "1px solid #2a2f36", paddingTop: 5 }}>
        <div style={{ fontSize: 10, color: "#7c8088", letterSpacing: 1 }}>기본능력</div>
        <BaseAbilities unit={unit} />
      </div>
      <div style={{ marginTop: 6, display: "flex", gap: 8, alignItems: "flex-start" }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 10, color: "#7c8088", letterSpacing: 1, marginBottom: 1 }}>파생</div>
          <StatBar label="공격력" value={unit.atk} sub={unit.warStat} color="#ff8a5c" />
          <StatBar label="방어력" value={unit.def} sub={unit.leadershipStat} color="#7aa7ff" />
          <StatBar label="정신력" value={unit.spirit} sub={unit.intelligenceStat} color="#b890ff" />
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginTop: 5, color: "#c7cdd4" }}>
            <span>
              이동 <strong>{unit.move}</strong> · 사거리{" "}
              <strong>{unit.rangeMin === unit.rangeMax ? unit.rangeMax : `${unit.rangeMin}~${unit.rangeMax}`}</strong>
            </span>
          </div>
        </div>
        <RangeGridMini unit={unit} />
      </div>
      <div style={{ fontSize: 12, marginTop: 4, color: "#9aa3ad" }}>
        지형 <span style={{ color: "#c7cdd4" }}>{unit.terrainName}</span>
        {unit.terrainGuard > 0 ? (
          <span style={{ color: "#7ad99a" }}> · 방어 +{Math.round(unit.terrainGuard * 100)}%</span>
        ) : null}
      </div>
    </>
  );
}

/** 장비 탭 — unit.equipment(해석된 소지품) 목록 (§8 장비 3슬롯) */
function EquipTab({ items }: { items: ItemVM[] | undefined }): React.ReactElement {
  if (!items || items.length === 0) return <EmptyRow text="소지품 없음" />;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4, paddingTop: 2 }}>
      {items.map((it, i) => (
        <div
          key={`${it.id}-${i}`}
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 6,
            background: "#161310",
            border: "1px solid #3a352b",
            borderRadius: 3,
            padding: "3px 7px",
          }}
        >
          <span style={{ fontSize: 13, color: "#e8e6e3", minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {it.name}
          </span>
          <span style={{ fontSize: 11, color: "#c89b5a", flexShrink: 0 }}>{it.effect}</span>
        </div>
      ))}
    </div>
  );
}

/** 책략 탭 — 병종 strategies 목록 + MP (§8 책략. 무신처럼 비면 안내) */
function StrategyTab({ strategies, mp }: { strategies: StrategyVM[] | undefined; mp: number }): React.ReactElement {
  if (!strategies || strategies.length === 0) return <EmptyRow text="보유 책략 없음" />;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4, paddingTop: 2 }}>
      {strategies.map((s) => {
        const affordable = mp >= s.mp;
        return (
          <div
            key={s.id}
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 6,
              background: "#161310",
              border: "1px solid #3a352b",
              borderRadius: 3,
              padding: "3px 7px",
              opacity: affordable ? 1 : 0.5,
            }}
          >
            <span style={{ fontSize: 13, color: s.target === "ally" ? "#7ad99a" : "#e8e6e3" }}>{s.name}</span>
            <span style={{ fontSize: 11, color: affordable ? "#7aa7ff" : "#ff6b6b", flexShrink: 0 }}>MP {s.mp}</span>
          </div>
        );
      })}
    </div>
  );
}

/** 특성 탭 — 병종 5스탯 등급 뱃지 + 공격범위 격자 (§8 부대특성) */
function TraitTab({ unit }: { unit: UnitVM }): React.ReactElement {
  const g = unit.grades;
  return (
    <div style={{ paddingTop: 2 }}>
      <div style={{ fontSize: 12, color: "#c7cdd4", marginBottom: 5 }}>
        병종 <strong>{unit.className}</strong>
      </div>
      {/* §8 병종 특성 설명문 (상성/약점) — lineAdvantage 파생 */}
      {unit.traitText ? (
        <div style={{ fontSize: 11, color: "#cdbd92", lineHeight: 1.5, marginBottom: 8 }}>
          {unit.traitText}
        </div>
      ) : null}
      {g ? (
        <div style={{ display: "flex", gap: 4, marginBottom: 8 }}>
          <GradeBadge label="공격" grade={g.atk} />
          <GradeBadge label="방어" grade={g.def} />
          <GradeBadge label="정신" grade={g.spirit} />
          <GradeBadge label="순발" grade={g.agility} />
          <GradeBadge label="사기" grade={g.morale} />
        </div>
      ) : (
        <EmptyRow text="등급 정보 없음" />
      )}
      <div style={{ display: "flex", justifyContent: "center" }}>
        <RangeGridMini unit={unit} />
      </div>
    </div>
  );
}

/** 탭 버튼 — 패널 내부 상태만 토글 (turn 상태기계 불오염). pointerEvents:auto로 탭은 클릭 가능 */
function TabStrip({ active, onSelect }: { active: TabId; onSelect: (t: TabId) => void }): React.ReactElement {
  return (
    <div style={{ display: "flex", gap: 2, marginTop: 6, pointerEvents: "auto" }}>
      {TABS.map((t) => {
        const on = t.id === active;
        return (
          <button
            key={t.id}
            type="button"
            onClick={() => onSelect(t.id)}
            style={{
              flex: 1,
              minHeight: 26,
              fontSize: 12,
              fontWeight: on ? 700 : 500,
              color: on ? "#16130f" : "#c7cdd4",
              background: on ? "#c89b5a" : "#1d1a14",
              border: "1px solid #3a352b",
              borderBottom: on ? "1px solid #c89b5a" : "1px solid #3a352b",
              borderRadius: "4px 4px 0 0",
              cursor: "pointer",
              touchAction: "manipulation",
            }}
          >
            {t.label}
          </button>
        );
      })}
    </div>
  );
}

export function UnitPanel({ ui, vm }: { ui: InputState; vm: BattleVM }): React.ReactElement | null {
  const [tab, setTab] = useState<TabId>("ability");
  const id = activeUnitId(ui);
  const unit = id ? (vm.units.find((u) => u.id === id) ?? null) : null;
  if (!unit) return null;
  return (
    <div style={PANEL_STYLE}>
      <div style={{ display: "flex", gap: 8 }}>
        {PORTRAIT_IDS.has(unit.name) ? <PortraitBox name={unit.name} /> : null}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
            <strong style={{ fontSize: 16 }}>{unit.name}</strong>
            <span style={{ color: sideColor(unit.side) }}>{sideLabel(unit.side)}</span>
          </div>
          <div style={{ color: "#9aa3ad", fontSize: 12 }}>
            {unit.className} · Lv.{unit.level}
            {unit.acted ? " · 행동 완료" : ""}
            {unit.retreated ? " · 퇴각" : ""}
          </div>
        </div>
      </div>
      <TabStrip active={tab} onSelect={setTab} />
      {/* 탭 본문 — 상단 경계는 활성 탭과 이어 보이게 */}
      <div style={{ borderTop: "1px solid #c89b5a", paddingTop: 5 }}>
        {tab === "ability" ? <AbilityTab unit={unit} /> : null}
        {tab === "equip" ? <EquipTab items={unit.equipment} /> : null}
        {tab === "strategy" ? <StrategyTab strategies={unit.strategies} mp={unit.mp} /> : null}
        {tab === "trait" ? <TraitTab unit={unit} /> : null}
      </div>
    </div>
  );
}
