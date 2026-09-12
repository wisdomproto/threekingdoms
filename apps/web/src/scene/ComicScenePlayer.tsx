"use client";
/**
 * ComicScenePlayer (story editor v2 — 모션코믹, spec 2026-09-12-story-editor-v2-comic-design §3).
 * 페이지 지면 1장(/assets/comics/{image}.webp)을 카메라 요소(transform-origin 0 0, 자연 px 폭 레이아웃)에
 * 놓고 칸 rect 마다 `cameraFor` 로 translate/scale — 칸 순서 = 타임라인. 대사는 VN 조각 재사용.
 *  - 첫 칸은 즉시(transition none), 크기 확정(ready) 뒤부터 600ms 이징. resize 재계산.
 *  - 이미지 부재/실패 = 가상 1500×2000 + 칸 테두리 placeholder(아트 없이도 카메라·E2E 동작).
 *  - fx: shake(래퍼 keyframes — 카메라 요소에 걸면 transform 애니가 카메라를 덮는다)/flash(흰 오버레이).
 *  - sfx/bgm 은 데이터가 문자열이라 isSfxKey/isBgmTrackId 가드 뒤에서만 재생.
 */
import { useEffect, useRef, useState } from "react";
import type { ComicScene } from "@tk/data";
import { assetUrl } from "../assetUrl";
import { AssetImage } from "../ui/AssetImage";
import { isBgmTrackId, isSfxKey, playBgm, playSfx } from "../audio";
import { cameraFor, type Size } from "./comicCamera";
import { PAGE_FADE_MS, useComicProgression } from "./useComicProgression";
import { DialoguePanel } from "./parts/DialoguePanel";
import { NarrationPanel } from "./parts/NarrationPanel";
import { SkipBar } from "./parts/SkipBar";
import { BRONZE_GOLD, BRONZE_DIM } from "./parts/tokens";

/** 이미지 없을 때 가상 지면 크기(3:4). */
const VIRTUAL: Size = { w: 1500, h: 2000 };
const pageSrc = (image: string): string => assetUrl(`/assets/comics/${image}.webp`);

const STYLE = `@keyframes tkSceneIn { from { opacity: 1 } to { opacity: 0 } }
@keyframes tkComicShake { 0%,100% { transform: translate(0,0) } 20% { transform: translate(-8px,4px) } 40% { transform: translate(7px,-5px) } 60% { transform: translate(-5px,3px) } 80% { transform: translate(4px,-2px) } }
@keyframes tkComicFlash { from { opacity: 0.9 } to { opacity: 0 } }
.tkComicShake { animation: tkComicShake 400ms ease-out }
.tkComicFlash { animation: tkComicFlash 200ms ease-out both }
@media (prefers-reduced-motion: reduce) { .tkComicShake,.tkComicFlash { animation: none } .tkComicCam { transition: none !important } }`;

export function ComicScenePlayer({
  scene,
  title,
  onComplete,
}: {
  scene: ComicScene;
  /** 상단 표시용(스테이지명 등). */
  title?: string;
  onComplete: () => void;
}): React.ReactElement {
  const { pos, page, panel, line, shown, done, advance, fading, auto, setAuto } = useComicProgression(scene, onComplete);
  const src = pageSrc(page.image);

  // 뷰포트 크기 = 루트(fixed inset 0) 실측 — ResizeObserver 가 회전/리사이즈와 "0×0 으로 마운트(백그라운드 탭)→실크기" 를
  // 모두 잡는다(window resize 이벤트는 후자를 놓침). 0 크기는 미확정으로 두어 카메라 숨김(scale 0 방지).
  const rootRef = useRef<HTMLDivElement>(null);
  const [view, setView] = useState<Size | null>(null);
  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const set = (w: number, h: number): void => { if (w > 0 && h > 0) setView({ w, h }); };
    set(window.innerWidth, window.innerHeight); // 첫 프레임 즉시(백그라운드 문서는 RO 콜백이 렌더링 재개까지 미뤄진다)
    const ro = new ResizeObserver(([entry]) => set(entry!.contentRect.width, entry!.contentRect.height));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // 자연 크기 — src 로 키를 잡아 페이지 전환 시 자동 무효(리셋 effect 와 onLoad 의 경합 없음).
  const [img, setImg] = useState<{ src: string; size: Size; failed: boolean } | null>(null);
  const loaded = img?.src === src ? img : null;
  const size = loaded?.size ?? VIRTUAL;
  const ready = !!loaded && !!view;
  // ready 다음 커밋부터 transition — 첫 칸(그리고 새 페이지 첫 칸)은 즉시.
  const [transit, setTransit] = useState(false);
  useEffect(() => setTransit(ready), [ready]);

  // 칸 진입 fx/sfx.
  const [shake, setShake] = useState(false);
  const [flash, setFlash] = useState(false);
  useEffect(() => {
    // ponytail: 400ms 안에 shake 칸이 연달아 오면 클래스가 이미 있어 재시작 안 됨 — 필요하면 key 카운터로.
    if (panel.fx?.includes("shake")) setShake(true);
    if (panel.fx?.includes("flash")) setFlash(true);
    if (panel.sfx && isSfxKey(panel.sfx)) playSfx(panel.sfx);
  }, [panel]);
  useEffect(() => {
    if (page.bgm && isBgmTrackId(page.bgm)) playBgm(page.bgm);
  }, [page]);
  // 다음 페이지 선로드(페이지 전환 끊김 방지).
  useEffect(() => {
    const next = scene.pages[pos.pi + 1];
    if (next) new Image().src = pageSrc(next.image);
  }, [scene, pos.pi]);

  const cam = view ? cameraFor(panel.rect, size, view) : { scale: 1, tx: 0, ty: 0 };
  const total = panel.lines?.length ?? 0;

  return (
    <div
      ref={rootRef}
      data-testid="comic-scene"
      onClick={advance}
      onKeyDown={(e) => { if (e.target !== e.currentTarget) return; if (e.key === "Enter" || e.key === " ") advance(); }}   // AUTO/스킵 버튼의 Enter 는 진행 아님
      role="button"
      tabIndex={0}
      aria-label="만화 진행 (탭)"
      style={{ position: "fixed", inset: 0, background: "#000", cursor: "pointer", userSelect: "none", overflow: "hidden", fontFamily: '"Noto Serif KR", "Nanum Myeongjo", serif' }}
    >
      <div
        data-testid="comic-viewport"
        className={shake ? "tkComicShake" : undefined}
        onAnimationEnd={(e) => { if (e.target === e.currentTarget) setShake(false); }}
        style={{ position: "absolute", inset: 0, background: "#000", overflow: "hidden" }}
      >
        <div
          data-testid="comic-camera"
          className="tkComicCam"
          style={{
            position: "absolute", left: 0, top: 0, width: size.w, height: size.h,
            transformOrigin: "0 0",
            transform: `translate(${cam.tx}px, ${cam.ty}px) scale(${cam.scale})`,
            transition: transit && ready ? "transform 600ms cubic-bezier(.22,.61,.36,1)" : "none",   // 새 페이지 첫 칸은 즉시(ready 전)
            visibility: view ? "visible" : "hidden",
          }}
        >
          <AssetImage
            src={src} kind="bg" label={title ?? "만화"}
            onLoad={(w, h) => setImg({ src, size: { w, h }, failed: false })}
            onError={() => setImg({ src, size: VIRTUAL, failed: true })}
          />
          {loaded?.failed && page.panels.map((p, i) => (
            <div key={i} style={{
              position: "absolute", left: p.rect[0] * size.w, top: p.rect[1] * size.h, width: p.rect[2] * size.w, height: p.rect[3] * size.h,
              boxSizing: "border-box", border: `3px dashed ${BRONZE_DIM}`, color: BRONZE_DIM, fontSize: 64, padding: 12,
            }}>{i + 1}</div>
          ))}
        </div>
        {flash && <div aria-hidden className="tkComicFlash" onAnimationEnd={() => setFlash(false)} style={{ position: "absolute", inset: 0, background: "#fff", opacity: 0, pointerEvents: "none" }} />}
      </div>

      {/* 페이지 전환 — 검정 경유 350ms */}
      <div aria-hidden style={{ position: "absolute", inset: 0, background: "#000", pointerEvents: "none", opacity: fading ? 1 : 0, transition: `opacity ${PAGE_FADE_MS}ms ease-in-out` }} />
      {/* 오프닝 페이드-인(SceneBackground 와 동일 — page.tsx 파트 전환이 이 페이드에 의존). */}
      <div aria-hidden style={{ position: "absolute", inset: 0, background: "#000", pointerEvents: "none", animation: "tkSceneIn 420ms ease-out both" }} />
      <style>{STYLE}</style>

      <SkipBar title={title} onSkip={onComplete} />
      <button
        type="button" data-testid="comic-auto" aria-pressed={auto}
        onClick={(e) => { e.stopPropagation(); setAuto((a) => !a); }}
        style={{ position: "absolute", top: "calc(12px + env(safe-area-inset-top))", right: 232, zIndex: 20,
          background: auto ? "rgba(90,70,30,0.85)" : "rgba(20,17,14,0.7)", color: BRONZE_GOLD, border: `1px solid ${BRONZE_DIM}`,
          borderRadius: 4, padding: "4px 12px", fontSize: 12, cursor: "pointer" }}
      >
        AUTO {auto ? "■" : "▶"}
      </button>

      {line && (line.speaker
        ? <DialoguePanel line={line} shown={shown} done={done} idx={pos.li} total={total} />
        : <NarrationPanel shown={shown} done={done} idx={pos.li} total={total} />)}
    </div>
  );
}
