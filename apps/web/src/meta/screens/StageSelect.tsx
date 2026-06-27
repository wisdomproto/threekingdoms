"use client";
/**
 * 스테이지 선택 화면 — §5 시나리오 챕터/스테이지 목록.
 *
 * 해금 규칙: 첫 스테이지는 항상 해금, 그 외는 "직전 스테이지 클리어"로 해금.
 * 잠긴 스테이지 → 콤팩트 한 줄(번호+자물쇠). 해금 스테이지 → 풀 카드.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { stages } from "@tk/data";
import type { Stage } from "@tk/data";
import { getMeta, startNewGame } from "../metaStore";

const INK = "#17130f";
const INK_DEEP = "#0c0a07";
const GOLD = "#cdab6e";
const GOLD_DIM = "#8a7350";
const GOLD_GLOW = "rgba(205,171,110,0.18)";
const PARCHMENT = "#e8dcc0";
const MUTED = "#5a5142";

const MISSION_TAGS: [RegExp, string][] = [
  [/탈출|철수/, "탈출전"],
  [/방어/, "방어전"],
  [/관문|사수관|호로관/, "공성전"],
  [/하비|공방/, "공방전"],
  [/사냥|이벤트/, "이벤트"],
  [/도하|수상|삼강|적벽/, "수상전"],
];

function missionTag(name: string): string {
  for (const [re, label] of MISSION_TAGS) {
    if (re.test(name)) return label;
  }
  return "섬멸전";
}

const CHAPTERS: { chapter: number; title: string; from: number; to: number }[] = [
  { chapter: 1, title: "황건적의 난", from: 1, to: 4 },
  { chapter: 2, title: "반동탁연합", from: 5, to: 9 },
  { chapter: 3, title: "서주, 여포", from: 10, to: 15 },
  { chapter: 4, title: "관도 ~ 장판파", from: 16, to: 22 },
  { chapter: 5, title: "적벽", from: 23, to: 27 },
];

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
  const [playthroughCount, setPlaythroughCount] = useState(0);
  const [confirmNg, setConfirmNg] = useState(false);

  const reload = useCallback(() => {
    const m = getMeta();
    setCleared(m.clearedStages);
    setGold(m.gold);
    setPlaythroughCount(m.playthroughCount);
    setConfirmNg(false);
  }, []);

  useEffect(() => { reload(); }, [reload]);

  const ordered = useMemo(
    () => Object.values(stages).slice().sort((a, b) => stageNumber(a.id) - stageNumber(b.id)),
    [],
  );

  const clearedSet = useMemo(() => new Set(cleared), [cleared]);

  const unlocked = useMemo(() => {
    const map = new Map<string, boolean>();
    ordered.forEach((s, i) => {
      map.set(s.id, i === 0 ? true : clearedSet.has(ordered[i - 1]!.id));
    });
    return map;
  }, [ordered, clearedSet]);

  const grouped = useMemo(() =>
    CHAPTERS.map((ch) => ({
      ...ch,
      list: ordered.filter((s) => chapterOf(stageNumber(s.id)) === ch.chapter),
    })),
    [ordered],
  );

  const allCleared = ordered.length > 0 && ordered.every((s) => clearedSet.has(s.id));

  return (
    <section
      style={{
        minHeight: "100svh",
        background: `radial-gradient(ellipse 160% 80% at 50% -10%, #2a1f0e 0%, ${INK_DEEP} 60%)`,
        color: PARCHMENT,
        padding: "0 0 60px",
        boxSizing: "border-box",
        fontFamily: '"Noto Serif KR", "Nanum Myeongjo", serif',
      }}
    >
      {/* ── 상단 바 ── */}
      <header
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          maxWidth: 720,
          margin: "0 auto",
          padding: "14px 16px 12px",
          borderBottom: "1px solid rgba(205,171,110,0.12)",
        }}
      >
        <Link href="/" style={{ color: GOLD_DIM, fontSize: 13, textDecoration: "none" }}>
          ◀ 타이틀
        </Link>
        <h1 style={{ margin: 0, fontSize: 17, letterSpacing: "0.25em", color: GOLD }}>
          출진할 전장
        </h1>
        <span style={{ display: "flex", alignItems: "center", gap: 14, whiteSpace: "nowrap" }}>
          {(["기연", "도감", "세이브"] as const).map((label, i) => (
            <Link
              key={label}
              href={["/serendipity", "/codex", "/save"][i]!}
              style={{ color: GOLD_DIM, fontSize: 13, textDecoration: "none" }}
            >
              {label}
            </Link>
          ))}
          <span style={{ fontSize: 13, color: GOLD }}>
            {gold.toLocaleString()}<span style={{ color: GOLD_DIM }}> 金</span>
          </span>
        </span>
      </header>

      {/* ── 챕터 목록 ── */}
      <div style={{ maxWidth: 720, margin: "0 auto", padding: "6px 12px 0" }}>
        {grouped.map((ch) => {
          const hasAny = ch.list.length > 0;
          const hasUnlocked = ch.list.some((s) => unlocked.get(s.id));
          return (
            <div key={ch.chapter} style={{ marginTop: 20 }}>
              <ChapterHeading
                chapter={ch.chapter}
                title={ch.title}
                active={hasUnlocked}
                clearedCount={ch.list.filter((s) => clearedSet.has(s.id)).length}
                totalCount={ch.list.length}
              />
              {!hasAny ? (
                <p style={{ margin: "6px 0 0 4px", fontSize: 11, color: MUTED }}>준비 중</p>
              ) : (
                <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 5 }}>
                  {ch.list.map((s) => {
                    const isUnlocked = unlocked.get(s.id) ?? false;
                    const isCleared = clearedSet.has(s.id);
                    return isUnlocked ? (
                      <FullCard key={s.id} stage={s} cleared={isCleared} />
                    ) : (
                      <LockedRow key={s.id} stage={s} />
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}

        {/* 2회차 */}
        {allCleared && (
          <div
            style={{
              marginTop: 28,
              padding: "18px 16px",
              borderRadius: 8,
              border: `1px solid ${GOLD}55`,
              background: "rgba(40,30,12,0.7)",
              display: "flex",
              flexDirection: "column",
              gap: 10,
            }}
          >
            <div style={{ fontSize: 15, fontWeight: 800, color: GOLD }}>
              {playthroughCount > 0 ? `${playthroughCount + 1}회차 시작` : "2회차 시작"}
            </div>
            <div style={{ fontSize: 12, color: GOLD_DIM, lineHeight: 1.6 }}>
              보물·자금 일부를 계승하고 적이 강해집니다. 레벨·편성·장비는 초기화됩니다.
            </div>
            {confirmNg ? (
              <div style={{ display: "flex", gap: 10 }}>
                <button
                  type="button"
                  onClick={() => { startNewGame(); reload(); }}
                  style={{
                    flex: 1, padding: "10px 0", borderRadius: 6,
                    border: "1px solid #e06c3a", background: "rgba(80,30,10,0.7)",
                    color: "#f0b080", fontSize: 14, fontWeight: 700, cursor: "pointer",
                  }}
                >확인 — 시작</button>
                <button
                  type="button"
                  onClick={() => setConfirmNg(false)}
                  style={{
                    flex: 1, padding: "10px 0", borderRadius: 6,
                    border: "1px solid #2c2620", background: "rgba(20,18,14,0.5)",
                    color: GOLD_DIM, fontSize: 14, cursor: "pointer",
                  }}
                >취소</button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmNg(true)}
                style={{
                  padding: "10px 0", borderRadius: 6,
                  border: `1px solid ${GOLD}77`,
                  background: "rgba(50,38,12,0.7)",
                  color: GOLD, fontSize: 14, fontWeight: 700, cursor: "pointer",
                }}
              >
                {playthroughCount > 0 ? `${playthroughCount + 1}회차 도전` : "2회차 도전"}
              </button>
            )}
          </div>
        )}
      </div>
    </section>
  );
}

/** 챕터 구분 헤더 — active(해금 스테이지 있는 챕터)는 더 밝게. */
function ChapterHeading({ chapter, title, active, clearedCount, totalCount }: {
  chapter: number; title: string; active: boolean;
  clearedCount: number; totalCount: number;
}): React.ReactElement {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "8px 0 6px" }}>
      {/* 좌측 수직 accent 선 */}
      <div style={{
        width: 4, height: 44, borderRadius: 2, flexShrink: 0,
        background: active ? GOLD : "#2c2620",
        boxShadow: active ? `0 0 10px ${GOLD}88` : "none",
      }} />
      {/* 챕터 번호 */}
      <span style={{
        fontSize: 10, fontWeight: 700, letterSpacing: "0.15em",
        color: active ? GOLD : MUTED,
        border: `1px solid ${active ? GOLD + "55" : "#2c2620"}`,
        borderRadius: 3, padding: "2px 7px", whiteSpace: "nowrap",
        background: active ? GOLD_GLOW : "transparent",
        flexShrink: 0,
      }}>
        제 {chapter} 장
      </span>
      {/* 챕터 제목 */}
      <span style={{
        fontSize: active ? 19 : 14,
        fontWeight: active ? 700 : 400,
        color: active ? PARCHMENT : MUTED,
        letterSpacing: "0.06em",
        flex: 1,
      }}>
        {title}
      </span>
      {/* 진행도 */}
      <span style={{
        fontSize: 11, color: clearedCount === totalCount ? "#6aaa50" : GOLD_DIM,
        fontWeight: 600, whiteSpace: "nowrap",
      }}>
        {clearedCount}/{totalCount}
      </span>
    </div>
  );
}

/** 해금된 스테이지 — 풀 히어로 카드. */
function FullCard({ stage, cleared }: { stage: Stage; cleared: boolean }): React.ReactElement {
  const num = stageNumber(stage.id);
  const reward = stage.reward;
  const tag = missionTag(stage.name);

  const card = (
    <div style={{
      position: "relative",
      display: "flex",
      alignItems: "center",
      gap: 16,
      padding: "18px 18px 18px 0",
      borderRadius: 8,
      border: cleared ? `1px solid ${GOLD}30` : `1px solid ${GOLD}80`,
      background: cleared
        ? "linear-gradient(135deg, rgba(20,28,14,0.95), rgba(13,18,9,0.95))"
        : `linear-gradient(100deg, rgba(55,40,10,0.98) 0%, rgba(30,22,6,0.95) 100%)`,
      boxShadow: cleared
        ? "none"
        : `0 2px 24px rgba(205,171,110,0.15), inset 0 1px 0 rgba(205,171,110,0.12)`,
      cursor: "pointer",
      overflow: "hidden",
    }}>
      {/* 좌측 강조 스트라이프 */}
      <div style={{
        width: 5, alignSelf: "stretch", flexShrink: 0,
        background: cleared
          ? "linear-gradient(to bottom, #5a9a45, #3a6a28)"
          : `linear-gradient(to bottom, ${GOLD}, #9a7a3a)`,
        borderRadius: "8px 0 0 8px",
        marginLeft: 0,
      }} />

      {/* 번호 블록 */}
      <div style={{
        display: "flex", flexDirection: "column", alignItems: "center",
        justifyContent: "center", gap: 4, flexShrink: 0, width: 52,
      }}>
        <span style={{
          fontSize: 28, fontWeight: 900, lineHeight: 1, letterSpacing: "-0.03em",
          color: cleared ? "#6aaa50" : GOLD,
          textShadow: cleared ? "none" : `0 0 18px ${GOLD}88`,
        }}>
          {String(num).padStart(2, "0")}
        </span>
        <span style={{
          fontSize: 9, fontWeight: 700, letterSpacing: "0.08em",
          color: cleared ? "#4a8a38" : "#8a6a30",
          border: `1px solid ${cleared ? "#3a6028" : "#6a5020"}`,
          borderRadius: 3, padding: "1px 5px",
          background: cleared ? "rgba(40,70,25,0.5)" : "rgba(60,45,10,0.6)",
        }}>
          {tag}
        </span>
      </div>

      {/* 구분선 */}
      <span aria-hidden style={{
        width: 1, alignSelf: "stretch",
        background: cleared
          ? "linear-gradient(to bottom, transparent, #2a3820, transparent)"
          : `linear-gradient(to bottom, transparent, #4a3810, transparent)`,
        flexShrink: 0,
      }} />

      {/* 스테이지 정보 */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <span style={{
            fontSize: 18, fontWeight: 700,
            color: cleared ? "#a8c898" : PARCHMENT,
            letterSpacing: "0.04em",
          }}>
            {stage.name}
          </span>
          {cleared && (
            <span style={{
              fontSize: 10, color: "#6aaa50",
              border: "1px solid #3a5e28", borderRadius: 3,
              padding: "1px 6px", letterSpacing: "0.1em",
              background: "rgba(40,70,25,0.4)",
            }}>✓ 클리어</span>
          )}
        </div>
        {reward && (
          <div style={{ fontSize: 11, color: cleared ? "#4a6a38" : GOLD_DIM, marginTop: 5 }}>
            클리어 보상 <strong style={{ color: cleared ? "#5a8045" : GOLD }}>{reward.gold}</strong> 金
            {reward.treasures.length > 0 && (
              <span style={{ color: cleared ? "#4a6a38" : "#b09040" }}>
                {" "}· 보물 {reward.treasures.length}종
              </span>
            )}
          </div>
        )}
      </div>

      {/* CTA 버튼 */}
      <div style={{
        flexShrink: 0,
        padding: "8px 16px",
        borderRadius: 6,
        border: `1px solid ${cleared ? GOLD_DIM + "66" : GOLD + "99"}`,
        background: cleared ? "rgba(30,25,10,0.6)" : `rgba(80,58,10,0.7)`,
        fontSize: 13, fontWeight: 700, letterSpacing: "0.08em",
        color: cleared ? GOLD_DIM : GOLD,
        textShadow: cleared ? "none" : `0 0 12px ${GOLD}88`,
      }}>
        {cleared ? "재도전 ▶" : "출진 ▶"}
      </div>
    </div>
  );

  return (
    <Link href={{ pathname: "/scene", query: { stage: stage.id, type: "intro" } }}
      style={{ textDecoration: "none", display: "block" }}>
      {card}
    </Link>
  );
}

/** 잠긴 스테이지 — 초소형 한 줄. */
function LockedRow({ stage }: { stage: Stage }): React.ReactElement {
  const num = stageNumber(stage.id);
  return (
    <div aria-disabled style={{
      display: "flex", alignItems: "center", gap: 10,
      padding: "5px 14px 5px 10px", borderRadius: 4,
      border: "1px solid #1a1712",
      background: "rgba(10,8,6,0.5)",
      cursor: "not-allowed",
    }}>
      <span style={{ fontSize: 11, fontWeight: 700, color: "#2a2218", minWidth: 22, textAlign: "center" }}>
        {String(num).padStart(2, "0")}
      </span>
      <span style={{ fontSize: 10, color: "#2a2218" }}>🔒</span>
      <span style={{
        fontSize: 11, color: "#3a3028",
        filter: "blur(3px)", userSelect: "none",
        flex: 1, letterSpacing: "0.04em",
      }}>
        {stage.name}
      </span>
    </div>
  );
}
