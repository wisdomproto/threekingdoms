"use client";
/**
 * 세이브 관리 화면 — 내보내기(JSON 다운로드) · 불러오기(파일 선택) · 초기화.
 * 현재 localStorage 기반 자동 세이브 위에 얹히는 수동 백업/복원 UI.
 * /save 라우트에서 접근, 전장 선택 화면 헤더에서 링크.
 */
import { useRef, useState } from "react";
import Link from "next/link";
import { gameData } from "@tk/data";
import { getMeta, exportSave, importSave, reset } from "../metaStore";
import { PANEL_FRAME } from "../../battle/hud/frames";

const INK_DEEP = "#0d0b09";
const BRONZE_GOLD = "#cdab6e";
const BRONZE_DIM = "#8a7350";
const PARCHMENT = "#e8dcc0";
const DANGER = "#e06c3a";

const TOTAL_STAGES = 27;

function SaveSummary(): React.ReactElement {
  const meta = getMeta();
  const treasureCount = meta.inventory.filter(
    (id) => gameData.items[id]?.category === "treasure",
  ).length;
  const rows: { label: string; value: string }[] = [
    { label: "클리어 스테이지", value: `${meta.clearedStages.length} / ${TOTAL_STAGES}` },
    { label: "보유 자금", value: `${meta.gold.toLocaleString()} 金` },
    { label: "보물 수집", value: `${treasureCount}개` },
    { label: "기연 포인트", value: `${meta.serendipity}` },
    { label: "플레이 회차", value: `${meta.playthroughCount + 1}회차` },
  ];
  if (meta.departedCharacters.length > 0) {
    rows.push({ label: "이탈 장수", value: meta.departedCharacters.join(", ") });
  }

  return (
    <div
      style={{
        ...PANEL_FRAME,
        background: "rgba(20, 17, 12, 0.85)",
        padding: "16px 20px",
        display: "flex",
        flexDirection: "column",
        gap: 10,
      }}
    >
      <div style={{ fontSize: 12, color: BRONZE_DIM, marginBottom: 2, letterSpacing: "0.1em" }}>
        현재 세이브
      </div>
      {rows.map((r) => (
        <div
          key={r.label}
          style={{ display: "flex", justifyContent: "space-between", fontSize: 14 }}
        >
          <span style={{ color: BRONZE_DIM }}>{r.label}</span>
          <span style={{ color: PARCHMENT, fontWeight: 600 }}>{r.value}</span>
        </div>
      ))}
    </div>
  );
}

export function SaveManager(): React.ReactElement {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importStatus, setImportStatus] = useState<"idle" | "ok" | "fail">("idle");
  const [confirmReset, setConfirmReset] = useState(false);
  const [resetDone, setResetDone] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  function handleExport() {
    const json = exportSave();
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `sangukji-save-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function handleImportClick() {
    fileInputRef.current?.click();
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result;
      if (typeof text !== "string") { setImportStatus("fail"); return; }
      const result = importSave(text);
      setImportStatus(result === "ok" ? "ok" : "fail");
      if (result === "ok") setRefreshKey((k) => k + 1); // summary 재렌더
    };
    reader.readAsText(file);
    // 같은 파일을 다시 고를 수 있도록 value 초기화
    e.target.value = "";
  }

  function handleReset() {
    reset();
    setConfirmReset(false);
    setResetDone(true);
    setRefreshKey((k) => k + 1);
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        background: INK_DEEP,
        color: PARCHMENT,
        padding: "20px 16px 48px",
        fontFamily: '"Noto Serif KR", "Nanum Myeongjo", "Apple SD Gothic Neo", serif',
      }}
    >
      <div style={{ maxWidth: 480, margin: "0 auto", display: "flex", flexDirection: "column", gap: 20 }}>

        {/* 헤더 */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <h1 style={{ margin: 0, fontSize: 18, color: BRONZE_GOLD, letterSpacing: "0.1em" }}>
            세이브 관리
          </h1>
          <Link href="/stages" style={{ color: BRONZE_DIM, fontSize: 13, textDecoration: "none" }}>
            ← 전장 목록
          </Link>
        </div>

        {/* 현재 세이브 요약 — refreshKey로 재렌더 */}
        <SaveSummary key={refreshKey} />

        {/* 내보내기 */}
        <div
          style={{
            ...PANEL_FRAME,
            background: "rgba(20, 17, 12, 0.85)",
            padding: "16px 20px",
            display: "flex",
            flexDirection: "column",
            gap: 10,
          }}
        >
          <div style={{ fontSize: 14, fontWeight: 700, color: PARCHMENT }}>세이브 내보내기</div>
          <div style={{ fontSize: 12, color: BRONZE_DIM, lineHeight: 1.6 }}>
            현재 진행 데이터를 JSON 파일로 다운로드합니다. 브라우저/기기가 바뀌어도 이 파일로 복원할 수 있습니다.
          </div>
          <button
            type="button"
            onClick={handleExport}
            style={{
              padding: "10px 0",
              borderRadius: 8,
              border: `1px solid ${BRONZE_GOLD}88`,
              background: "rgba(50, 40, 14, 0.7)",
              color: BRONZE_GOLD,
              fontSize: 14,
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            📥 JSON 파일로 내보내기
          </button>
        </div>

        {/* 불러오기 */}
        <div
          style={{
            ...PANEL_FRAME,
            background: "rgba(20, 17, 12, 0.85)",
            padding: "16px 20px",
            display: "flex",
            flexDirection: "column",
            gap: 10,
          }}
        >
          <div style={{ fontSize: 14, fontWeight: 700, color: PARCHMENT }}>세이브 불러오기</div>
          <div style={{ fontSize: 12, color: BRONZE_DIM, lineHeight: 1.6 }}>
            이전에 내보낸 JSON 파일을 선택하면 <strong>현재 진행이 덮어쓰여집니다.</strong>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json,application/json"
            style={{ display: "none" }}
            onChange={handleFileChange}
          />
          <button
            type="button"
            onClick={handleImportClick}
            style={{
              padding: "10px 0",
              borderRadius: 8,
              border: `1px solid ${BRONZE_GOLD}88`,
              background: "rgba(50, 40, 14, 0.7)",
              color: BRONZE_GOLD,
              fontSize: 14,
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            📤 파일 선택해서 불러오기
          </button>
          {importStatus === "ok" && (
            <div style={{ fontSize: 12, color: "#7bbf6a" }}>✓ 세이브를 성공적으로 불러왔습니다.</div>
          )}
          {importStatus === "fail" && (
            <div style={{ fontSize: 12, color: "#d97070" }}>✗ 파일을 읽을 수 없습니다. 올바른 세이브 파일인지 확인하세요.</div>
          )}
        </div>

        {/* 초기화 */}
        <div
          style={{
            ...PANEL_FRAME,
            background: "rgba(30, 14, 12, 0.85)",
            padding: "16px 20px",
            borderColor: "#5a2a2a",
            display: "flex",
            flexDirection: "column",
            gap: 10,
          }}
        >
          <div style={{ fontSize: 14, fontWeight: 700, color: "#e8a0a0" }}>데이터 초기화</div>
          <div style={{ fontSize: 12, color: "#9a7070", lineHeight: 1.6 }}>
            모든 진행 데이터(자금·스테이지·장비·보물)를 삭제합니다. <strong>되돌릴 수 없습니다.</strong>
          </div>
          {resetDone ? (
            <div style={{ fontSize: 12, color: "#7bbf6a" }}>✓ 초기화 완료. 처음부터 다시 시작합니다.</div>
          ) : confirmReset ? (
            <div style={{ display: "flex", gap: 10 }}>
              <button
                type="button"
                onClick={handleReset}
                style={{
                  flex: 1,
                  padding: "10px 0",
                  borderRadius: 8,
                  border: `1px solid ${DANGER}`,
                  background: "rgba(80, 30, 10, 0.7)",
                  color: "#f0b080",
                  fontSize: 14,
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                확인 — 전부 삭제
              </button>
              <button
                type="button"
                onClick={() => setConfirmReset(false)}
                style={{
                  flex: 1,
                  padding: "10px 0",
                  borderRadius: 8,
                  border: "1px solid #3a414a",
                  background: "rgba(20, 18, 14, 0.5)",
                  color: BRONZE_DIM,
                  fontSize: 14,
                  cursor: "pointer",
                }}
              >
                취소
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmReset(true)}
              style={{
                padding: "10px 0",
                borderRadius: 8,
                border: `1px solid #5a2a2a`,
                background: "rgba(40, 14, 10, 0.6)",
                color: "#c08080",
                fontSize: 14,
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              🗑 데이터 초기화
            </button>
          )}
        </div>

      </div>
    </main>
  );
}
