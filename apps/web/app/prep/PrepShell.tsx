"use client";
/**
 * 출진 준비 셸(클라이언트) — §10 막간 = 상점→편성→출진. <Formation/>과 <Shop/>을 합성하고
 * 하단 고정 출진 바를 둔다. 출진 = writeSortie(편성) 후 /battle?stage=ID 로 이동.
 *
 * 셸이 보유하는 상태:
 *  - stageId: ?stage= 쿼리(없으면 M1 기본 사수관).
 *  - activeTab: "formation" | "shop" (기본 편성).
 *  - selected: SortieMember[] (Formation onChange로 갱신).
 *  - gold/roster: metaStore에서 로드(구매/장착 후 재조회 트리거).
 * maxSlots = 그 stage의 player 슬롯 수(좌표 재사용 상한, sortie.ts 계약).
 *
 * useSearchParams를 쓰므로 부모 page.tsx가 Suspense로 감싼다.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { gameData, stages } from "@tk/data";
import { Formation } from "../../src/meta/screens/Formation";
import { Shop } from "../../src/meta/screens/Shop";
import { SortieBar } from "../../src/meta/screens/SortieBar";
import { LoadingTransition } from "../../src/meta/screens/LoadingTransition";
import { getMeta, getRoster, type RosterUnit } from "../../src/meta/metaStore";
import { writeSortie, type SortieMember } from "../../src/meta/sortie";
import { sortieSummary } from "../../src/meta/sortieSummary";
import { shouldShowInterstitial } from "../../src/meta/interstitialPolicy";

/** 데스크톱에서 콘텐츠가 화면 전폭으로 퍼지지 않게 잡는 상한(레퍼런스 구도 유지, 2026-07-03). */
const CONTENT_MAX = 1240;

/** id "05-sishuiguan" → 5. 챕터 매핑(상점 unlockChapter 필터)에 사용. 파싱 실패 시 1. */
function stageNumber(id: string): number {
  const n = Number.parseInt(id.slice(0, id.indexOf("-")), 10);
  return Number.isFinite(n) ? n : 1;
}

/** §5 스테이지 번호 → 챕터(1~5). StageSelect의 CHAPTERS 구간과 동일. */
function chapterOf(num: number): number {
  if (num <= 4) return 1;
  if (num <= 9) return 2;
  if (num <= 15) return 3;
  if (num <= 22) return 4;
  return 5;
}

export function PrepShell(): React.ReactElement {
  const router = useRouter();
  const params = useSearchParams();
  const stageId = params.get("stage") ?? "05-sishuiguan";
  const stage = stages[stageId] ?? stages["05-sishuiguan"]!;
  const chapter = useMemo(() => chapterOf(stageNumber(stage.id)), [stage]);

  const maxSlots = useMemo(
    () => stage.units.filter((u) => u.side === "player").length,
    [stage],
  );

  // meta는 SSR에서 비어있고 클라 마운트 후 채워진다(하이드레이션 일치). 구매/장착 후엔
  // refreshKey를 올려 gold/roster를 재로드 — Shop이 onPurchase로 알려준다.
  const [refreshKey, setRefreshKey] = useState(0);
  const [roster, setRoster] = useState<RosterUnit[]>([]);
  const [gold, setGold] = useState(0);
  const [isCleared, setIsCleared] = useState(false);

  useEffect(() => {
    const meta = getMeta();
    setRoster(getRoster(chapter));
    setGold(meta.gold);
    setIsCleared(meta.clearedStages.includes(stageId));
  }, [refreshKey, chapter, stageId]);

  const [selected, setSelected] = useState<SortieMember[]>([]);
  const [activeTab, setActiveTab] = useState<"formation" | "shop">("formation");
  // 상세 패널 대상 — Formation 카드/하단 슬롯 칩이 공유(리마운트(key=refreshKey)에도 생존).
  const [focusId, setFocusId] = useState<string | null>(null);

  // 출진 클릭 후 로딩/전면광고 전환 셸을 띄울지.
  const [transition, setTransition] = useState<{ showAd: boolean } | null>(null);

  const onPurchase = useCallback(() => setRefreshKey((k) => k + 1), []);

  const onSortie = useCallback(() => {
    // 부대 공유 소지품(원작 창고 §7) — 인벤토리의 소모품 전량을 friendly 풀로 들고 나간다.
    const inv = getMeta().inventory;
    const sharedItems = inv.filter((id) => {
      const c = gameData.items[id]?.category;
      return c === "supplyItem" || c === "attackItem";
    });
    writeSortie({ stageId, members: selected, sharedItems });
    const showAd = shouldShowInterstitial(getMeta().clearedStages.length, stageId);
    setTransition({ showAd });
  }, [stageId, selected]);

  const onEnterBattle = useCallback(() => {
    router.push(`/battle?stage=${encodeURIComponent(stageId)}`);
  }, [router, stageId]);

  const summary = useMemo(
    () => sortieSummary(selected, roster, maxSlots),
    [selected, roster, maxSlots],
  );

  if (transition) {
    return (
      <LoadingTransition
        stageId={stageId}
        stageName={stage.name}
        showAd={transition.showAd}
        onEnter={onEnterBattle}
      />
    );
  }

  return (
    <main
      style={{
        display: "flex",
        flexDirection: "column",
        minHeight: "100dvh",
        // 페이지 캔버스도 먹빛 — 패널 밖 여백이 흰 벌판으로 뜨지 않게(2026-07-03).
        background: "linear-gradient(to bottom, #14100a, #0d0a06)",
      }}
    >
      {/* 헤더 — 먹빛 바 + 청동 타이틀 + 출진 카운터(레퍼런스 우상단 플라크) */}
      <header
        style={{
          background: "linear-gradient(to bottom, #1a140c, #100c07)",
          borderBottom: "1px solid #6f5a3488",
          fontFamily: '"Noto Serif KR", "Nanum Myeongjo", "Apple SD Gothic Neo", serif',
        }}
      >
        <div style={{
          display: "flex", alignItems: "center", gap: 12,
          padding: "12px 16px", maxWidth: CONTENT_MAX, margin: "0 auto",
        }}>
          <h1 style={{ margin: 0, fontSize: 18, color: "#e0b84a", letterSpacing: "0.1em", fontWeight: 800 }}>
            출진 준비
            <span style={{ fontSize: 13.5, color: "#b8a070", fontWeight: 600, marginLeft: 10 }}>
              — {stage.name}
            </span>
          </h1>
          <div style={{ display: "flex", gap: 12, alignItems: "center", marginLeft: "auto" }}>
            {isCleared && (
              <Link
                href={`/merchant?stage=${encodeURIComponent(stageId)}`}
                style={{ color: "#cdab6e", fontSize: 13, textDecoration: "none" }}
              >
                상인
              </Link>
            )}
            <Link href="/stages" style={{ color: "#8a7350", fontSize: 13, textDecoration: "none" }}>
              ◀ 전장 선택
            </Link>
            <span style={{
              padding: "4px 12px", borderRadius: 6,
              border: "1.5px solid #8a6a28", background: "rgba(200,164,64,0.1)",
              fontSize: 13, color: "#e8d9b0", fontWeight: 700, letterSpacing: "0.06em",
              boxShadow: "inset 0 0 8px rgba(200,164,64,0.12)",
            }}>
              출진 <strong style={{ color: "#e0b84a", fontSize: 15 }}>{selected.length}</strong>
              <span style={{ color: "#8a7350" }}> / {maxSlots}</span>
            </span>
          </div>
        </div>
      </header>

      {/* 탭 바 */}
      <div
        style={{
          display: "flex",
          borderBottom: "1px solid #2a2f36",
          margin: "12px auto 0",
          width: "calc(100% - 32px)",
          maxWidth: CONTENT_MAX - 32,
        }}
      >
        {(["formation", "shop"] as const).map((tab) => {
          const label = tab === "formation" ? "편성" : "상점";
          const active = activeTab === tab;
          return (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              style={{
                padding: "8px 20px",
                fontSize: 15,
                fontWeight: active ? 700 : 400,
                fontFamily: '"Noto Serif KR", "Nanum Myeongjo", "Apple SD Gothic Neo", serif',
                letterSpacing: "0.14em",
                color: active ? "#e0b84a" : "#9aa3ad",
                background: "transparent",
                border: "none",
                borderBottom: active ? "2px solid #e0b84a" : "2px solid transparent",
                cursor: "pointer",
                marginBottom: -1,
              }}
            >
              {label}
            </button>
          );
        })}
      </div>

      {/* 탭 콘텐츠 + 출진 바 = 한 클러스터. 남은 높이에서 세로 중앙(auto 마진 — 내용이 넘치면
          마진이 0으로 접혀 스크롤 안전). 더는 보드를 늘여 양피지 벌판을 만들지 않는다(2026-07-03). */}
      <div style={{
        flex: 1, minHeight: 0, overflowY: "auto",
        width: "100%", maxWidth: CONTENT_MAX, margin: "0 auto",
        padding: 16, boxSizing: "border-box",
        display: "flex", flexDirection: "column",
      }}>
        <div style={{ margin: "auto 0", display: "flex", flexDirection: "column", gap: 8 }}>
          {activeTab === "formation" ? (
            <Formation
              key={refreshKey}
              roster={roster}
              maxSlots={maxSlots}
              selected={selected}
              onChange={setSelected}
              chapter={chapter}
              focusId={focusId}
              onFocus={setFocusId}
            />
          ) : (
            <Shop
              shop={gameData.shops.ch1!}
              items={gameData.items}
              gold={gold}
              chapter={chapter}
              onPurchase={onPurchase}
            />
          )}

          {/* 출진 바 — 보드 바로 아래(레퍼런스 풋터). 슬롯 칩 탭 = 편성 탭 전환 + 상세 포커스 */}
          <SortieBar
            summary={summary}
            maxSlots={maxSlots}
            members={selected}
            onSortie={onSortie}
            onRemove={(id) => setSelected(selected.filter((m) => m.commanderId !== id))}
            onFocus={(id) => { setActiveTab("formation"); setFocusId(id); }}
          />
        </div>
      </div>
    </main>
  );
}
