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

  // 출진 클릭 후 로딩/전면광고 전환 셸을 띄울지.
  const [transition, setTransition] = useState<{ showAd: boolean } | null>(null);

  const onPurchase = useCallback(() => setRefreshKey((k) => k + 1), []);

  const onSortie = useCallback(() => {
    writeSortie({ stageId, members: selected });
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
        paddingBottom: 64,
      }}
    >
      {/* 헤더 */}
      <header
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          gap: 12,
          padding: "16px 16px 0",
        }}
      >
        <h1 style={{ margin: 0, fontSize: 18 }}>출진 준비 — {stage.name}</h1>
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          {isCleared && (
            <Link
              href={`/merchant?stage=${encodeURIComponent(stageId)}`}
              style={{ color: "#cdab6e", fontSize: 13, textDecoration: "none" }}
            >
              🏕️ 상인
            </Link>
          )}
          <Link href="/stages" style={{ color: "#8a7350", fontSize: 14, textDecoration: "none" }}>
            ◀ 전장 선택
          </Link>
        </div>
      </header>

      {/* 탭 바 */}
      <div
        style={{
          display: "flex",
          borderBottom: "1px solid #2a2f36",
          margin: "12px 16px 0",
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
                color: active ? "#caa86a" : "#9aa3ad",
                background: "transparent",
                border: "none",
                borderBottom: active ? "2px solid #caa86a" : "2px solid transparent",
                cursor: "pointer",
                marginBottom: -1,
              }}
            >
              {label}
            </button>
          );
        })}
      </div>

      {/* 탭 콘텐츠 (비활성 탭 언마운트) */}
      <div style={{ flex: 1, padding: 16 }}>
        {activeTab === "formation" ? (
          <Formation
            key={refreshKey}
            roster={roster}
            maxSlots={maxSlots}
            selected={selected}
            onChange={setSelected}
            chapter={chapter}
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
      </div>

      {/* 고정 출진 바 */}
      <SortieBar summary={summary} maxSlots={maxSlots} onSortie={onSortie} />
    </main>
  );
}
