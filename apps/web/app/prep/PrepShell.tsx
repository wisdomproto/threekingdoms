"use client";
/**
 * 출진 준비 셸(클라이언트) — §10 막간 = 상점→편성→출진. <Formation/>과 <Shop/>을 합성하고
 * 하단에 "출진" 버튼을 둔다. 출진 = writeSortie(편성) 후 /battle?stage=ID 로 이동.
 *
 * 이 파일은 **셸(배관)**만 담당 — 슬롯/구매/장비 UI는 Formation/Shop 스텁이 채운다.
 * 셸이 보유하는 상태:
 *  - stageId: ?stage= 쿼리(없으면 M1 기본 사수관).
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
import { getMeta, getRoster } from "../../src/meta/metaStore";
import { writeSortie, type SortieMember } from "../../src/meta/sortie";

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
  const [roster, setRoster] = useState(() => getRoster());
  const [gold, setGold] = useState(0);

  useEffect(() => {
    setRoster(getRoster());
    setGold(getMeta().gold);
  }, [refreshKey]);

  const [selected, setSelected] = useState<SortieMember[]>([]);

  // 상점 구매 후 — 잔액/인벤토리(장비 후보)를 재조회하도록 셸 상태를 무효화.
  const onPurchase = useCallback(() => setRefreshKey((k) => k + 1), []);

  const onSortie = useCallback(() => {
    // 편성이 비면 기존 동작(stage JSON 그대로)으로 출진 — sortie.ts 계약상 override 안 함.
    writeSortie({ stageId, members: selected });
    router.push(`/battle?stage=${encodeURIComponent(stageId)}`);
  }, [router, stageId, selected]);

  return (
    <main style={{ padding: 24, display: "flex", flexDirection: "column", gap: 16 }}>
      <header style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12 }}>
        <h1 style={{ margin: 0 }}>출진 준비 — {stage.name}</h1>
        <Link href="/stages" style={{ color: "#8a7350", fontSize: 14, textDecoration: "none" }}>
          ◀ 전장 선택
        </Link>
      </header>
      <Shop
        shop={gameData.shops.ch1!}
        items={gameData.items}
        gold={gold}
        chapter={chapter}
        onPurchase={onPurchase}
      />
      <Formation
        key={refreshKey}
        roster={roster}
        maxSlots={maxSlots}
        selected={selected}
        onChange={setSelected}
      />
      <button type="button" onClick={onSortie} style={{ alignSelf: "flex-start", padding: "8px 24px" }}>
        출진 ▶
      </button>
    </main>
  );
}
