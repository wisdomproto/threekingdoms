"use client";
/**
 * LabScreen — 전투 실험실 빌더(/lab). 유닛 자유 편성(장수×병종×레벨×병력×장비) + 공유 소모품 +
 * 날씨 + 시드를 지정해 실제 전투(공격·책략·도구·회심·가드·협공·필살·레벨업·지형회복·날씨)를
 * 그대로 돌려본다. 「전투 시작」 = LabPayload를 sessionStorage에 쓰고 /battle?stage=__lab 진입.
 *
 * 승급 테스트: 엔진 승급 메커니즘은 후속(§4)이라, 같은 장수를 티어 다른 병종으로 바꿔 A/B한다
 * (병종 셀렉트에 계열·티어 표기). 결산은 sandbox 모드 — 메타(골드/클리어/레벨 영속) 불가침.
 */
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { gameData } from "@tk/data";
import type { StageUnit, Weather } from "@tk/data";
import { buildLabMap, buildLabStage, labSpawn, writeLab, LAB_STAGE_ID } from "./lab";

const INK = "#14110e";
const PARCHMENT = "#e8dcc0";
const BRONZE = "#cdab6e";
const BRONZE_DIM = "#8a7350";

interface Row {
  uid: number;
  side: "player" | "enemy";
  commanderId: string;
  classId: string;
  level: number;
  troops: number;
  weapon: string; // "" = 없음 (weapon|book 카테고리)
  horse: string;
  treasure: string;
}

let nextUid = 1;
function makeRow(side: Row["side"], commanderId: string, classId: string, level = 10): Row {
  return { uid: nextUid++, side, commanderId, classId, level, troops: 100 + level * 5, weapon: "", horse: "", treasure: "" };
}

const SELECT_STYLE: React.CSSProperties = {
  background: "#1d1915", color: PARCHMENT, border: `1px solid ${BRONZE_DIM}`,
  borderRadius: 4, padding: "4px 6px", fontSize: 13, maxWidth: 130,
};
const NUM_STYLE: React.CSSProperties = { ...SELECT_STYLE, width: 56, maxWidth: 56 };
const BTN: React.CSSProperties = {
  background: "#241f18", color: BRONZE, border: `1px solid ${BRONZE_DIM}`,
  borderRadius: 5, padding: "5px 12px", fontSize: 13, cursor: "pointer",
};

export default function LabScreen(): React.ReactElement {
  const router = useRouter();
  const [rows, setRows] = useState<Row[]>(() => [
    makeRow("player", "관우", "lightCavalry"),
    makeRow("player", "미축", "strategist"),
    makeRow("enemy", "여포", "heavyCavalry"),
    makeRow("enemy", "학맹", "archer"),
  ]);
  const [pool, setPool] = useState<string[]>(["쌀", "쌀", "폭탄"]);
  const [poolPick, setPoolPick] = useState("쌀");
  const [weather, setWeather] = useState<Weather>("clear");
  const [seed, setSeed] = useState(42);

  // ── 데이터 목록(정렬 1회) ─────────────────────────────────────────────
  const rosterIds = useMemo(() => Object.keys(gameData.rosters), []);
  const otherIds = useMemo(
    () => Object.keys(gameData.commanders).filter((id) => !(id in gameData.rosters)).sort((a, b) => a.localeCompare(b, "ko")),
    [],
  );
  const classes = useMemo(
    () => Object.values(gameData.unitClasses).sort((a, b) => a.line.localeCompare(b.line) || a.tier - b.tier),
    [],
  );
  const itemsBy = useMemo(() => {
    const all = Object.values(gameData.items);
    return {
      weapon: all.filter((i) => i.category === "weapon" || i.category === "book"),
      horse: all.filter((i) => i.category === "horse"),
      treasure: all.filter((i) => i.category === "treasure"),
      consumable: all.filter((i) => i.category === "supplyItem" || i.category === "attackItem"),
    };
  }, []);

  const update = (uid: number, patch: Partial<Row>): void =>
    setRows((rs) => rs.map((r) => (r.uid === uid ? { ...r, ...patch } : r)));
  const remove = (uid: number): void => setRows((rs) => rs.filter((r) => r.uid !== uid));
  const add = (side: Row["side"]): void =>
    setRows((rs) => (rs.filter((r) => r.side === side).length >= 8 ? rs : [...rs, makeRow(side, side === "player" ? "유비" : "화웅", "footman")]));

  // ── 프리셋 ────────────────────────────────────────────────────────────
  const presets: Record<string, () => Row[]> = {
    "상성 스파링 3v3": () => [
      makeRow("player", "관우", "lightCavalry"), makeRow("player", "미방", "footman"), makeRow("player", "유봉", "archer"),
      makeRow("enemy", "장요", "lightCavalry"), makeRow("enemy", "고순", "footman"), makeRow("enemy", "학맹", "archer"),
    ],
    "책략·날씨(주술사)": () => [
      makeRow("player", "미축", "sorcerer", 15), makeRow("player", "간옹", "strategist", 15), makeRow("player", "관우", "lightCavalry", 15),
      makeRow("enemy", "장각", "sorcerer", 15), makeRow("enemy", "고순", "footman", 12), makeRow("enemy", "위속", "footman", 12),
    ],
    "레벨업 파밍": () => [
      makeRow("player", "관우", "lightCavalry", 3),
      makeRow("enemy", "학맹", "bandit", 1), makeRow("enemy", "위속", "bandit", 1), makeRow("enemy", "후성", "bandit", 1),
      makeRow("enemy", "조성", "bandit", 1), makeRow("enemy", "송겸", "bandit", 1), makeRow("enemy", "곽사", "bandit", 1),
    ],
    "승급 A/B(기병 3티어)": () => [
      makeRow("player", "조운", "lightCavalry", 20), makeRow("player", "관우", "heavyCavalry", 20), makeRow("player", "장비", "guardCavalry", 20),
      makeRow("enemy", "허저", "footman", 20), makeRow("enemy", "서황", "footman", 20), makeRow("enemy", "악진", "footman", 20),
    ],
  };

  // ── 출진 ──────────────────────────────────────────────────────────────
  const start = (): void => {
    const bySide = { player: 0, enemy: 0 };
    const units: StageUnit[] = rows.map((r) => {
      const at = labSpawn(r.side, bySide[r.side]++);
      const items = [r.weapon, r.horse, r.treasure].filter((x) => x !== "");
      return {
        commanderId: r.commanderId, classId: r.classId, level: r.level,
        troops: r.troops, items, side: r.side, x: at.x, y: at.y,
      };
    });
    writeLab({ stage: buildLabStage(units, weather), map: buildLabMap(), sharedItems: pool, seed });
    router.push(`/battle?stage=${LAB_STAGE_ID}`);
  };

  const canStart = rows.some((r) => r.side === "player") && rows.some((r) => r.side === "enemy");

  const sideTable = (side: Row["side"], title: string): React.ReactElement => (
    <section style={{ flex: 1, minWidth: 480 }}>
      <h2 style={{ color: side === "player" ? "#7fc98f" : "#e08a7a", fontSize: 16, margin: "0 0 8px" }}>
        {title} <span style={{ color: BRONZE_DIM, fontSize: 12 }}>({rows.filter((r) => r.side === side).length}/8)</span>
        <button type="button" style={{ ...BTN, marginLeft: 10, padding: "2px 10px" }} onClick={() => add(side)}>＋ 유닛</button>
      </h2>
      <table style={{ borderCollapse: "collapse", width: "100%" }}>
        <thead>
          <tr style={{ color: BRONZE_DIM, fontSize: 12, textAlign: "left" }}>
            <th style={{ padding: 3 }}>장수</th><th>병종(계열·티어)</th><th>Lv</th><th>병력</th><th>무기/병법서</th><th>말</th><th>보물</th><th />
          </tr>
        </thead>
        <tbody>
          {rows.filter((r) => r.side === side).map((r) => (
            <tr key={r.uid} style={{ borderTop: `1px solid #2a241c` }}>
              <td style={{ padding: 3 }}>
                <select style={SELECT_STYLE} value={r.commanderId} onChange={(e) => update(r.uid, { commanderId: e.target.value })}>
                  <optgroup label="로스터">
                    {rosterIds.map((id) => <option key={id} value={id}>{gameData.commanders[id]?.name ?? id}</option>)}
                  </optgroup>
                  <optgroup label="전체 장수">
                    {otherIds.map((id) => <option key={id} value={id}>{gameData.commanders[id]?.name ?? id}</option>)}
                  </optgroup>
                </select>
              </td>
              <td>
                <select style={SELECT_STYLE} value={r.classId} onChange={(e) => update(r.uid, { classId: e.target.value })}>
                  {classes.map((c) => <option key={c.id} value={c.id}>{c.name} ({c.line} T{c.tier})</option>)}
                </select>
              </td>
              <td><input type="number" min={1} max={99} style={NUM_STYLE} value={r.level}
                onChange={(e) => { const lv = Math.max(1, Math.min(99, Number(e.target.value) || 1)); update(r.uid, { level: lv, troops: 100 + lv * 5 }); }} /></td>
              <td><input type="number" min={1} max={999} style={NUM_STYLE} value={r.troops}
                onChange={(e) => update(r.uid, { troops: Math.max(1, Math.min(999, Number(e.target.value) || 1)) })} /></td>
              {(["weapon", "horse", "treasure"] as const).map((slot) => (
                <td key={slot}>
                  <select style={{ ...SELECT_STYLE, maxWidth: 110 }} value={r[slot]} onChange={(e) => update(r.uid, { [slot]: e.target.value })}>
                    <option value="">—</option>
                    {itemsBy[slot].map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
                  </select>
                </td>
              ))}
              <td><button type="button" style={{ ...BTN, color: "#e08a7a", padding: "2px 8px" }} onClick={() => remove(r.uid)}>✕</button></td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );

  return (
    <main style={{ minHeight: "100vh", background: INK, color: PARCHMENT, padding: "20px 22px 40px", fontFamily: '"Noto Serif KR", serif' }}>
      <h1 style={{ color: BRONZE, fontSize: 20, margin: "0 0 2px" }}>⚗ 전투 실험실</h1>
      <p style={{ color: BRONZE_DIM, fontSize: 12.5, margin: "0 0 14px" }}>
        자유 편성으로 전투 시스템 전체(공격·책략·도구·회심·가드·협공·필살·레벨업·승급·지형회복·날씨)를 시험한다.
        결과는 메타(골드·클리어·레벨)에 <b>저장되지 않는다</b>. 실험장 지형: 강+다리 2·숲·산·촌락(회복)·병영(회복)·창고.
        여기선 자동 승급 OFF(고른 티어 보존) — <b>자동 승급을 보려면 T1 병종 + Lv14/29</b>로 편성해 전투 중 레벨업으로 관찰(T2=Lv15·T3=Lv30).
      </p>

      {/* 프리셋 */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
        {Object.entries(presets).map(([name, fn]) => (
          <button key={name} type="button" style={BTN} onClick={() => setRows(fn())}>{name}</button>
        ))}
      </div>

      <div style={{ display: "flex", gap: 28, flexWrap: "wrap" }}>
        {sideTable("player", "아군")}
        {sideTable("enemy", "적군")}
      </div>

      {/* 전역 설정 */}
      <div style={{ display: "flex", gap: 22, alignItems: "center", flexWrap: "wrap", marginTop: 18, padding: "12px 14px", border: `1px solid ${BRONZE_DIM}`, borderRadius: 8, background: "#1a1611" }}>
        <label style={{ fontSize: 13 }}>날씨{" "}
          <select style={SELECT_STYLE} value={weather} onChange={(e) => setWeather(e.target.value as Weather)}>
            <option value="clear">맑음</option><option value="rain">비 (화계 30%·수계 120%)</option><option value="cloudy">흐림 (화계 70%)</option>
          </select>
        </label>
        <label style={{ fontSize: 13 }}>시드{" "}
          <input type="number" style={{ ...NUM_STYLE, width: 90, maxWidth: 90 }} value={seed} onChange={(e) => setSeed(Number(e.target.value) || 0)} />
        </label>
        <div style={{ fontSize: 13, display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
          부대 소모품(도구):
          <select style={SELECT_STYLE} value={poolPick} onChange={(e) => setPoolPick(e.target.value)}>
            {itemsBy.consumable.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
          </select>
          <button type="button" style={BTN} onClick={() => setPool((p) => [...p, poolPick])}>＋</button>
          {pool.map((id, i) => (
            <span key={`${id}-${i}`} style={{ border: `1px solid ${BRONZE_DIM}`, borderRadius: 10, padding: "1px 8px", fontSize: 12 }}>
              {gameData.items[id]?.name ?? id}{" "}
              <button type="button" style={{ background: "none", border: "none", color: "#e08a7a", cursor: "pointer", padding: 0 }}
                onClick={() => setPool((p) => p.filter((_, j) => j !== i))}>✕</button>
            </span>
          ))}
        </div>
      </div>

      <button
        type="button"
        disabled={!canStart}
        onClick={start}
        style={{
          marginTop: 18, padding: "12px 44px", fontSize: 17, fontWeight: 700, borderRadius: 8, cursor: canStart ? "pointer" : "not-allowed",
          background: canStart ? "#7a2f24" : "#3a332a", color: PARCHMENT, border: `1.5px solid ${BRONZE}`, letterSpacing: "0.15em",
        }}
      >
        전투 시작
      </button>
    </main>
  );
}
