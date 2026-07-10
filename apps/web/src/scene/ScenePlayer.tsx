"use client";
/**
 * ScenePlayer (캠페인 루프 W1) — 막간 시나리오 씬(VN 톤). 풀스크린 배경 + 화자 초상 + 타자기 대사.
 *
 * 데이터 = stage.scenario.intro/outro(ScenarioScene). 전투 밖 컷신이라 엔진/결정론 무관(§2-1).
 * 진행: 탭/클릭 → 타자기 중이면 즉시 전체, 아니면 다음 줄. 마지막 줄 다음 → onComplete.
 * 스킵 버튼 → 즉시 onComplete. 배경/초상은 AssetImage(placeholder + 드롭-인).
 *
 * 씬 문법 v2 (서사 리듬 — "갑자기 전투" 해소):
 *  - speaker 없는 줄 = **내레이션** — 초상·화자명 없는 중앙 서술 박스(정세·이동·시간 경과).
 *  - line.bg = 그 줄부터 배경 전환(회의→행군→전장). 미지정 줄은 직전 배경 유지.
 *
 * 진행 로직 = useSceneProgression / 표현 조각 = parts/.
 */
import type { ScenarioScene } from "@tk/data";
import { useSceneProgression } from "./useSceneProgression";
import { SceneBackground } from "./parts/SceneBackground";
import { SkipBar } from "./parts/SkipBar";
import { NarrationPanel } from "./parts/NarrationPanel";
import { DialoguePanel } from "./parts/DialoguePanel";

export function ScenePlayer({
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
