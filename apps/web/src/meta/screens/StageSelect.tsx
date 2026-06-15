"use client";
/**
 * 스테이지 선택 화면 — §5 시나리오 챕터/스테이지 목록.
 *
 * gameData.stages를 §5 챕터(1~5)로 그룹핑해 리스트로 표시한다. 27스테이지 슬롯을 의식해
 * 챕터 구획 + 카드 리스트 형태로 짠다(현재 데이터는 "05-사수관" 1개뿐).
 *
 * 해금 규칙: 첫 스테이지(전체 정렬상 첫 칸)는 항상 해금, 그 외는 "직전 스테이지 클리어"로 해금.
 * 클리어한 스테이지는 배지 + 재도전 허용. 잠긴 스테이지는 회색 처리(클릭 불가).
 * 선택 → /prep?stage=ID(출진 준비).
 *
 * 챕터/클리어는 localStorage(metaStore)에 의존 → 마운트 후 1회 로드(SSR에서는 미해금/0G로
 * 그려 하이드레이션 일치). 자금(gold)은 상단 바에 표시.
 */
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { stages } from "@tk/data";
import type { Stage } from "@tk/data";
import { getMeta } from "../metaStore";
import { PANEL_FRAME } from "../../battle/hud/frames";

const INK = "#1a1714";
const INK_DEEP = "#0d0b09";
const BRONZE_GOLD = "#cdab6e";
const BRONZE_DIM = "#8a7350";
const PARCHMENT = "#e8dcc0";

/** §5 챕터 정의 — 스테이지 번호 구간으로 매핑. (id "NN-slug"의 NN = §5 스테이지 번호) */
const CHAPTERS: { chapter: number; title: string; from: number; to: number }[] = [
  { chapter: 1, title: "황건적의 난", from: 1, to: 4 },
  { chapter: 2, title: "반동탁연합", from: 5, to: 9 },
  { chapter: 3, title: "서주, 여포", from: 10, to: 15 },
  { chapter: 4, title: "관도 ~ 장판파", from: 16, to: 22 },
  { chapter: 5, title: "적벽", from: 23, to: 27 },
];

/** id "05-sishuiguan" → 5. 파싱 실패 시 999(맨 뒤). */
function stageNumber(id: string): number {
  const n = Number.parseInt(id.slice(0, id.indexOf("-")), 10);
  return Number.isFinite(n) ? n : 999;
}

function chapterOf(num: number): number {
  const c = CHAPTERS.find((ch) => num >= ch.from && num <= ch.to);
  return c ? c.chapter : 0;
}

export function StageSelect(): React.ReactElement {
  const [cleared, setCleared] = useState<string[]>([]);
  const [gold, setGold] = useState(0);

  useEffect(() => {
    const m = getMeta();
    setCleared(m.clearedStages);
    setGold(m.gold);
  }, []);

  // 전역 진행 순서(번호 오름차순) — 해금 게이팅의 기준.
  const ordered = useMemo(
    () => Object.values(stages).slice().sort((a, b) => stageNumber(a.id) - stageNumber(b.id)),
    [],
  );

  const clearedSet = useMemo(() => new Set(cleared), [cleared]);

  // stageId → 해금 여부. 첫 칸은 항상 해금, 그 외는 직전 칸 클리어 시 해금.
  const unlocked = useMemo(() => {
    const map = new Map<string, boolean>();
    ordered.forEach((s, i) => {
      if (i === 0) map.set(s.id, true);
      else map.set(s.id, clearedSet.has(ordered[i - 1]!.id));
    });
    return map;
  }, [ordered, clearedSet]);

  // 챕터별 그룹.
  const grouped = useMemo(() => {
    return CHAPTERS.map((ch) => ({
      ...ch,
      list: ordered.filter((s) => chapterOf(stageNumber(s.id)) === ch.chapter),
    }));
  }, [ordered]);

  return (
    <section
      style={{
        minHeight: "100svh",
        background: `radial-gradient(120% 80% at 50% 0%, ${INK} 0%, ${INK_DEEP} 80%)`,
        color: PARCHMENT,
        padding: "16px 14px 48px",
        boxSizing: "border-box",
        fontFamily: '"Noto Serif KR", "Nanum Myeongjo", "Apple SD Gothic Neo", serif',
      }}
    >
      {/* 상단 바: 타이틀 복귀 + 자금 */}
      <header
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          maxWidth: 720,
          margin: "0 auto 18px",
        }}
      >
        <Link
          href="/"
          style={{ color: BRONZE_DIM, fontSize: 14, textDecoration: "none" }}
        >
          ◀ 타이틀
        </Link>
        <h1 style={{ margin: 0, fontSize: 18, letterSpacing: "0.2em", color: BRONZE_GOLD }}>
          출진할 전장
        </h1>
        <span style={{ display: "flex", alignItems: "center", gap: 14, whiteSpace: "nowrap" }}>
          <Link href="/serendipity" style={{ color: BRONZE_DIM, fontSize: 14, textDecoration: "none" }}>
            기연
          </Link>
          <Link href="/codex" style={{ color: BRONZE_DIM, fontSize: 14, textDecoration: "none" }}>
            보물 도감
          </Link>
          <span style={{ fontSize: 14, color: BRONZE_GOLD }}>
            자금 {gold.toLocaleString()}<span style={{ color: BRONZE_DIM }}> 金</span>
          </span>
        </span>
      </header>

      <div style={{ maxWidth: 720, margin: "0 auto", display: "flex", flexDirection: "column", gap: 22 }}>
        {grouped.map((ch) => (
          <div key={ch.chapter}>
            <ChapterHeading chapter={ch.chapter} title={ch.title} />
            {ch.list.length === 0 ? (
              <p style={{ margin: "4px 0 0 4px", fontSize: 12, color: "#5a5142" }}>
                준비 중인 장입니다.
              </p>
            ) : (
              <ul style={{ listStyle: "none", margin: "10px 0 0", padding: 0, display: "flex", flexDirection: "column", gap: 8 }}>
                {ch.list.map((s) => (
                  <StageCard
                    key={s.id}
                    stage={s}
                    cleared={clearedSet.has(s.id)}
                    unlocked={unlocked.get(s.id) ?? false}
                  />
                ))}
              </ul>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

function ChapterHeading({ chapter, title }: { chapter: number; title: string }): React.ReactElement {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <span
        style={{
          fontSize: 12,
          letterSpacing: "0.2em",
          color: BRONZE_DIM,
          border: `1px solid ${BRONZE_DIM}`,
          borderRadius: 2,
          padding: "2px 8px",
          whiteSpace: "nowrap",
        }}
      >
        제 {chapter} 장
      </span>
      <span style={{ fontSize: 16, color: PARCHMENT }}>{title}</span>
      <span aria-hidden style={{ flex: 1, height: 1, background: "#2c2620" }} />
    </div>
  );
}

function StageCard({
  stage,
  cleared,
  unlocked,
}: {
  stage: Stage;
  cleared: boolean;
  unlocked: boolean;
}): React.ReactElement {
  const num = stageNumber(stage.id);
  const reward = stage.reward;

  const body = (
    <div
      style={{
        ...PANEL_FRAME,
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "12px 16px",
        background: unlocked
          ? "linear-gradient(180deg, rgba(40,34,28,0.65), rgba(20,17,14,0.65))"
          : "rgba(18,16,13,0.55)",
        color: unlocked ? PARCHMENT : "#5a5142",
        opacity: unlocked ? 1 : 0.7,
      }}
    >
      <span
        style={{
          fontSize: 20,
          fontWeight: 700,
          color: unlocked ? BRONZE_GOLD : "#4a4338",
          minWidth: 30,
          textAlign: "center",
        }}
      >
        {String(num).padStart(2, "0")}
      </span>
      <span aria-hidden style={{ width: 1, alignSelf: "stretch", background: "#2c2620" }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 16 }}>{unlocked ? stage.name : "???"}</span>
          {cleared && (
            <span
              style={{
                fontSize: 11,
                color: "#7bbf6a",
                border: "1px solid #4a6e42",
                borderRadius: 2,
                padding: "1px 6px",
              }}
            >
              클리어
            </span>
          )}
        </div>
        {unlocked && reward && (
          <div style={{ fontSize: 12, color: BRONZE_DIM, marginTop: 3 }}>
            보상 {reward.gold} 金
            {reward.treasures.length > 0 && ` · 보물 ${reward.treasures.join(", ")}`}
          </div>
        )}
        {!unlocked && (
          <div style={{ fontSize: 12, color: "#4a4338", marginTop: 3 }}>
            🔒 이전 전장 클리어 후 해금
          </div>
        )}
      </div>
      {unlocked && (
        <span style={{ fontSize: 14, color: BRONZE_GOLD }}>{cleared ? "재도전 ▶" : "출진 ▶"}</span>
      )}
    </div>
  );

  return (
    <li>
      {unlocked ? (
        <Link
          href={{ pathname: "/scene", query: { stage: stage.id, type: "intro" } }}
          style={{ textDecoration: "none", display: "block" }}
        >
          {body}
        </Link>
      ) : (
        <div aria-disabled style={{ cursor: "not-allowed" }}>
          {body}
        </div>
      )}
    </li>
  );
}
