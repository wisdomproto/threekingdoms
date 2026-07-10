"use client";
/**
 * /scene?stage=ID&type=intro|outro|outroDefeat — 막간 시나리오 씬 라우트(캠페인 루프).
 *
 * 흐름: stages → (intro 씬) → /prep(상점·편성) → /battle → 결산 → (outro/outroDefeat 씬) → 다음.
 * 시나리오 없는 스테이지/타입은 **빈 씬 가드**로 즉시 다음 단계로(점진적 콘텐츠). 씬이 있으면
 * 완료 시 **페이드-투-블랙** 전환으로 다음 화면을 잇는다(시네마틱).
 */
import { Suspense, useCallback, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { stages } from "@tk/data";
import { ScenePlayer } from "../../src/scene/ScenePlayer";
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
  const scene = stage?.scenario?.[type];
  // resetKey = 현재 씬 식별 → outro→다음 intro(/scene→/scene)로 바뀌면 페이드 자동 해제.
  const { fadeTo, overlay } = useFadeNav(`${stageId}:${type}`);

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
    if (!scene) router.push(target());
  }, [scene, router, target]);

  if (!scene) return null;
  return (
    <>
      <ScenePlayer scene={scene} title={stage?.name} onComplete={() => fadeTo(target())} />
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
