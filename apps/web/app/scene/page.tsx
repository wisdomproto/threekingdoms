"use client";
/**
 * /scene?stage=ID&type=intro|outro|outroDefeat — 막간 시나리오 씬 라우트(캠페인 루프).
 *
 * 흐름: stages → (intro 씬) → /prep(상점·편성) → /battle → 결산 → (outro/outroDefeat 씬) → 다음.
 * 막간 v4: 씬 슬롯 = 단일 VN(하위호환) 또는 파트 배열(VN | MapScene) — normalizeSceneSlot로
 * 정규화해 파트를 순차 재생(VN=ScenePlayer, 맵=MapScenePlayer). key={pi} 리마운트 = 각 플레이어의
 * 오프닝 페이드가 파트 전환 연출을 겸한다. 시나리오 없는 스테이지/타입은 **빈 씬 가드**로 즉시
 * 다음 단계로(점진적 콘텐츠). 마지막 파트 완료 시 **페이드-투-블랙** 전환으로 다음 화면을 잇는다.
 */
import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { normalizeSceneSlot, stages } from "@tk/data";
import { ScenePlayer } from "../../src/scene/ScenePlayer";
import { MapScenePlayer } from "../../src/scene/MapScenePlayer";
import { nextStageId } from "../../src/meta/campaign";
import { useFadeNav } from "../../src/ui/useFadeNav";

type SceneType = "intro" | "outro" | "outroDefeat";

function SceneRoute(): React.ReactElement | null {
  const router = useRouter();
  const params = useSearchParams();
  const stageId = params.get("stage") ?? "";
  const raw = params.get("type");
  const type: SceneType = raw === "outro" ? "outro" : raw === "outroDefeat" ? "outroDefeat" : "intro";

  const stage = stages[stageId];
  const slot = stage?.scenario?.[type];
  const parts = useMemo(() => (slot ? normalizeSceneSlot(slot) : []), [slot]);
  // 파트 인덱스 — 씬 식별(outro→다음 intro 등)이 바뀌면 처음부터.
  // Authoring preview may start at a chosen part; normal campaign URLs have no part parameter.
  const requestedPart = Number(params.get("part") ?? 0);
  const startPart = process.env.NODE_ENV === "development" && Number.isInteger(requestedPart)
    ? Math.max(0, Math.min(requestedPart, parts.length - 1)) : 0;
  const [pi, setPi] = useState(startPart);
  const [replay, setReplay] = useState(0);
  useEffect(() => {
    setPi(startPart);
  }, [stageId, type, startPart]);
  // resetKey = 현재 씬 식별 → outro→다음 intro(/scene→/scene)로 바뀌면 페이드 자동 해제.
  const { fadeTo, overlay } = useFadeNav(`${stageId}:${type}:${replay}`);

  // 다음 단계 목적지. intro→상점, outro→다음 스테이지 intro(없으면 전장 선택),
  // outroDefeat(패배 후)→전장 선택(같은 스테이지 재도전).
  const target = useCallback((): string => {
    if (type === "intro") return `/prep?stage=${stageId}`;
    if (type === "outro") {
      const next = stageId ? nextStageId(stageId) : null;
      return next ? `/scene?stage=${next}&type=intro` : "/stages";
    }
    return "/stages";
  }, [type, stageId]);

  // 빈 씬(미작성)은 즉시 건너뜀(페이드 없이 — 보여줄 씬이 없으므로).
  useEffect(() => {
    if (parts.length === 0) router.push(target());
  }, [parts.length, router, target]);

  if (parts.length === 0) return null;
  const part = parts[Math.min(pi, parts.length - 1)]!;
  const playerKey = `${stageId}:${type}:${replay}:${pi}`;
  const next = (): void => {
    if (pi >= parts.length - 1) fadeTo(target());
    else setPi((i) => i + 1);
  };
  return (
    <>
      {"map" in part ? (
        <MapScenePlayer key={playerKey} scene={part} title={stage?.name} onComplete={next} />
      ) : (
        <ScenePlayer key={playerKey} scene={part} title={stage?.name} onComplete={next} />
      )}
      <button type="button" onClick={() => { setPi(0); setReplay(n => n + 1); }}
        style={{ position: "fixed", top: "calc(12px + env(safe-area-inset-top))", right: 132, zIndex: 20,
          background: "rgba(20,17,14,0.8)", color: "#d8ba7b", border: "1px solid #6f5a34",
          borderRadius: 4, padding: "4px 12px", fontSize: 12, cursor: "pointer" }}>
        처음부터 ↺
      </button>
      {overlay}
    </>
  );
}

export default function ScenePage(): React.ReactElement {
  return (
    <Suspense fallback={null}>
      <SceneRoute />
    </Suspense>
  );
}
