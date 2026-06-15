"use client";
/**
 * /scene?stage=ID&type=intro|outro — 막간 시나리오 씬 라우트(캠페인 루프 W1).
 *
 * 캠페인 흐름: stages → (intro 씬) → /prep(상점·편성) → /battle → 결산 → (outro 씬) → 다음 스테이지 intro.
 * 시나리오가 없는 스테이지/타입은 **빈 씬 가드**로 즉시 다음 단계로 건너뛴다(점진적 콘텐츠 — 미작성 스테이지도 흐름 유지).
 */
import { Suspense, useCallback, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { stages } from "@tk/data";
import { ScenePlayer } from "../../src/scene/ScenePlayer";
import { nextStageId } from "../../src/meta/campaign";

function SceneRoute(): React.ReactElement | null {
  const router = useRouter();
  const params = useSearchParams();
  const stageId = params.get("stage") ?? "";
  const type = (params.get("type") === "outro" ? "outro" : "intro") as "intro" | "outro";

  const stage = stages[stageId];
  const scene = stage?.scenario?.[type];

  // 씬 종료/부재 시 다음 단계로. intro→상점, outro→다음 스테이지 intro(없으면 전장 선택).
  const goNext = useCallback(() => {
    if (type === "intro") {
      router.push(`/prep?stage=${stageId}`);
    } else {
      const next = stageId ? nextStageId(stageId) : null;
      router.push(next ? `/scene?stage=${next}&type=intro` : "/stages");
    }
  }, [router, stageId, type]);

  // 빈 씬(미작성 스테이지/타입) 가드 — 즉시 건너뜀.
  useEffect(() => {
    if (!scene) goNext();
  }, [scene, goNext]);

  if (!scene) return null;
  return <ScenePlayer scene={scene} title={stage?.name} onComplete={goNext} />;
}

export default function ScenePage(): React.ReactElement {
  return (
    <Suspense fallback={null}>
      <SceneRoute />
    </Suspense>
  );
}
