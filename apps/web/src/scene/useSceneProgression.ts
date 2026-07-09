"use client";
/** 막간 씬 진행 상태(VN·스테이지 공유). idx·타자기·advance·현재 배경·내레이션 판정. */
import type { ScenarioScene } from "@tk/data";
import { useState } from "react";
import { useTypewriter } from "./useTypewriter";

export function useSceneProgression(scene: ScenarioScene, onComplete: () => void) {
  const [idx, setIdx] = useState(0);
  // 연속 탭 가드: 같은 렌더에 바인딩된 클릭 2발이 setIdx(i=>i+1)를 겹쳐 쌓으면 범위를 넘는다
  // (VN 씬은 연타가 기본 조작) — 인덱스를 항상 마지막 줄로 클램프.
  const line = scene.lines[Math.min(idx, scene.lines.length - 1)]!;
  const { shown, done, reveal } = useTypewriter(line.text);

  const advance = () => {
    if (!done) {
      reveal();
      return;
    }
    if (idx >= scene.lines.length - 1) {
      onComplete();
      return;
    }
    setIdx((i) => Math.min(i + 1, scene.lines.length - 1));
  };

  // 현재 배경 = 지금까지 지나온 줄 중 마지막 bg 지정(없으면 씬 기본). 전환 시 key 교체로 페이드 인.
  let currentBg = scene.bg;
  for (let i = 0; i <= idx; i++) {
    const b = scene.lines[i]?.bg;
    if (b) currentBg = b;
  }

  return { idx, line, shown, done, advance, currentBg, isNarration: !line.speaker };
}
