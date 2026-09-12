"use client";
/**
 * 모션코믹 진행(spec 2026-09-12-story-editor-v2-comic-design §3). 위치 = {pi, ci, li}(페이지·칸·줄).
 * 탭: 타자기 중 → 완성 / 줄 남음 → 다음 줄 / 칸 끝 → 다음 칸 / 페이지 끝 → 다음 페이지(350ms 검정 페이드) / 끝 → onComplete.
 * 무대사 칸·hold 칸은 타이머 자동 진행(탭 = 즉시). AUTO = hold 없는 줄도 text.length*45+900ms.
 * 순수 부분(comicStep/autoAdvanceMs)은 node 테스트, 훅은 그 위 얇은 껍데기.
 */
import type { ComicPanel, ComicScene } from "@tk/data";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTypewriter } from "./useTypewriter";

export interface ComicPos { pi: number; ci: number; li: number }
export type ComicStep =
  | { kind: "line" | "panel" | "page"; pos: ComicPos }
  | { kind: "complete" };

export const PAGE_FADE_MS = 350;
/** 무대사 칸 기본 hold(ms). */
const SILENT_HOLD_MS = 1200;

/** 다음 위치(순수). 범위를 벗어난 pos 는 마지막으로 클램프해 다룬다. */
export function comicStep(scene: ComicScene, pos: ComicPos): ComicStep {
  const pi = Math.min(pos.pi, scene.pages.length - 1);
  const page = scene.pages[pi]!;
  const ci = Math.min(pos.ci, page.panels.length - 1);
  const lines = page.panels[ci]!.lines ?? [];
  if (pos.li < lines.length - 1) return { kind: "line", pos: { pi, ci, li: pos.li + 1 } };
  if (ci < page.panels.length - 1) return { kind: "panel", pos: { pi, ci: ci + 1, li: 0 } };
  if (pi < scene.pages.length - 1) return { kind: "page", pos: { pi: pi + 1, ci: 0, li: 0 } };
  return { kind: "complete" };
}

/** 현재 칸/줄의 자동 진행 대기(ms). null = 탭 대기. 대사 줄은 타자기 완료 후부터 잰다. */
export function autoAdvanceMs(panel: ComicPanel, li: number, auto: boolean): number | null {
  const line = panel.lines?.[li];
  if (!line) return panel.hold ?? SILENT_HOLD_MS;
  if (panel.hold != null) return panel.hold;
  return auto ? line.text.length * 45 + 900 : null;
}

export function useComicProgression(scene: ComicScene, onComplete: () => void) {
  const [pos, setPos] = useState<ComicPos>({ pi: 0, ci: 0, li: 0 });
  const [fading, setFading] = useState(false);
  const [auto, setAuto] = useState(false);
  const fadeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (fadeTimer.current) clearTimeout(fadeTimer.current); }, []);

  const page = scene.pages[Math.min(pos.pi, scene.pages.length - 1)]!;
  const panel = page.panels[Math.min(pos.ci, page.panels.length - 1)]!;
  const line = panel.lines?.[pos.li];
  const { shown, done, reveal } = useTypewriter(line?.text ?? "");

  const completed = useRef(false);
  const advance = useCallback(() => {
    if (fading || fadeTimer.current || completed.current) return;   // 페이드 중·완료 후 재진입 방지(AUTO 타이머 + 탭 동시)
    if (line && !done) { reveal(); return; }
    const step = comicStep(scene, pos);
    if (step.kind === "complete") { completed.current = true; onComplete(); return; }
    if (step.kind === "page") {
      setFading(true);
      fadeTimer.current = setTimeout(() => { fadeTimer.current = null; setPos(step.pos); setFading(false); }, PAGE_FADE_MS);
      return;
    }
    setPos(step.pos);
  }, [fading, line, done, reveal, scene, pos, onComplete]);

  // 자동 진행 타이머 — 무대사/hold/AUTO. 탭하면 pos 가 바뀌어 타이머가 재설정된다.
  useEffect(() => {
    if (!done || fading) return;
    const ms = autoAdvanceMs(panel, pos.li, auto);
    if (ms == null) return;
    const t = setTimeout(advance, ms);
    return () => clearTimeout(t);
  }, [done, fading, panel, pos.li, auto, advance]);

  return { pos, page, panel, line, shown, done, advance, fading, auto, setAuto };
}
