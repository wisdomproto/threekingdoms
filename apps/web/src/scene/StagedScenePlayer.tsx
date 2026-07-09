"use client";
/**
 * StagedScenePlayer — 디에게틱 스테이지 씬(스펙 v2). scene.actors 있는 마퀴(★) 씬 전용.
 *
 * ScenePlayer(VN)와 같은 진행 훅·표현 조각을 공유하고, 배경 위에 ActorStage(배우 레이어)를
 * 얹는다. 라우트가 scene.actors?.length로 이 플레이어를 고른다(§5 막간 씬 v3).
 *
 * ⚠ 오프닝 페이드: ActorStage는 z-index 격리(컨테이너 zIndex: 0으로 배우 랭크 1..N을 내부에
 * 가둠)라 형제와의 페인팅은 DOM 순서를 따르는데, SceneBackground *내부*의 페이드-투-블랙은
 * ActorStage보다 DOM 앞이라 오프닝 420ms 동안 배우가 페이드 위에 칠해진다 — 배우까지 덮는
 * 동일 오버레이를 ActorStage 뒤에 한 번 더 렌더(전용 keyframe, 입력 비차단). VN ScenePlayer는 불변.
 */
import type { ScenarioScene } from "@tk/data";
import { useSceneProgression } from "./useSceneProgression";
import { visibleActorIds } from "./actorStage";
import { ActorStage } from "./parts/ActorStage";
import { SceneBackground } from "./parts/SceneBackground";
import { SkipBar } from "./parts/SkipBar";
import { NarrationPanel } from "./parts/NarrationPanel";
import { DialoguePanel } from "./parts/DialoguePanel";

export function StagedScenePlayer({
  scene,
  title,
  onComplete,
}: {
  scene: ScenarioScene;
  /** 상단 표시용(스테이지명 등). */
  title?: string;
  onComplete: () => void;
}): React.ReactElement {
  const { idx, line, shown, done, advance, currentBg, isNarration } = useSceneProgression(scene, onComplete);
  const actors = scene.actors ?? [];

  return (
    <div
      onClick={advance}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") advance();
      }}
      role="button"
      tabIndex={0}
      aria-label="대사 진행 (탭)"
      style={{
        position: "fixed",
        inset: 0,
        background: "#000",
        cursor: "pointer",
        userSelect: "none",
        overflow: "hidden",
        fontFamily: '"Noto Serif KR", "Nanum Myeongjo", serif',
      }}
    >
      <SceneBackground bg={currentBg} title={title} />

      {/* 배우 레이어 — 배경 위, 대사 패널 아래 */}
      <ActorStage
        actors={actors}
        visibleIds={visibleActorIds(scene.lines, idx, actors)}
        speakingId={line.actor}
        emote={line.emote}
      />

      {/* 오프닝 페이드(배우 커버용) — SceneBackground 내부 페이드와 동일 연출, 1회, 입력 비차단. */}
      <div
        aria-hidden
        style={{ position: "absolute", inset: 0, background: "#000", pointerEvents: "none", animation: "tkStagedIn 420ms ease-out both" }}
      />
      <style>{`@keyframes tkStagedIn { from { opacity: 1 } to { opacity: 0 } }`}</style>

      {/* 상단 타이틀 + 스킵 */}
      <SkipBar title={title} onSkip={onComplete} />

      {/* 하단 대사/내레이션 박스 */}
      {isNarration ? (
        <NarrationPanel shown={shown} done={done} idx={idx} total={scene.lines.length} />
      ) : (
        <DialoguePanel line={line} shown={shown} done={done} idx={idx} total={scene.lines.length} />
      )}
    </div>
  );
}
