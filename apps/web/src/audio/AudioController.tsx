"use client";
/**
 * AudioController — layout에 1회 마운트되는 오디오 클라이언트 아일랜드.
 *
 *  1) 첫 사용자 제스처(pointerdown/keydown)에서 AudioContext 해제 + 매니페스트/파일 preload + BGM 재개.
 *     (자동재생 정책: 제스처 없이는 소리가 안 나므로 전역 1회 훅이 필요.)
 *  2) 전역 위임 클릭음 — <button>/[role=button]/<a> pointerdown 시 SFX.click(게임 전체 1곳 배선).
 *  3) 경로(usePathname) → BGM 트랙 크로스페이드.
 *  4) 떠 있는 뮤트/음량 컨트롤(AudioControl).
 */
import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { audio } from "./engine";
import { SFX, playSfx } from "./sfx";
import { preloadSfxFiles } from "./sfx";
import { playBgm, resumeBgm, preloadBgmFiles, type BgmTrackId } from "./bgm";
import { loadAudioManifest } from "./manifest";

/** 경로 → BGM 트랙. /battle=전투, /scene=씬 드론, /=타이틀, 그 외 막간=메뉴. */
function bgmForPath(path: string): BgmTrackId {
  if (path.startsWith("/battle")) return "battle";
  if (path.startsWith("/scene")) return "scene";
  if (path === "/") return "title";
  return "menu";
}

export function AudioController(): React.ReactElement {
  const pathname = usePathname();
  const filesLoaded = useRef(false);

  // (1)+(2) 전역 제스처: 해제 + preload + 위임 클릭음.
  useEffect(() => {
    const initFiles = async (): Promise<void> => {
      if (filesLoaded.current) return;
      filesLoaded.current = true;
      const manifest = await loadAudioManifest();
      await Promise.all([preloadSfxFiles(manifest), preloadBgmFiles(manifest)]);
    };

    const onPointerDown = (e: PointerEvent): void => {
      const first = audio.ensureUnlocked();
      if (first) {
        resumeBgm();
        void initFiles();
      }
      // 위임 클릭음 — 버튼/링크에만, data-no-sfx 제외.
      const el = e.target as HTMLElement | null;
      const btn = el?.closest?.("button, [role='button'], a");
      if (btn && !btn.hasAttribute("data-no-sfx")) playSfx(SFX.click);
    };
    const onKeyDown = (): void => {
      const first = audio.ensureUnlocked();
      if (first) {
        resumeBgm();
        void initFiles();
      }
    };

    window.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, []);

  // (3) 경로 → BGM. 미해제 시 desired만 저장되고 첫 제스처가 resumeBgm으로 켠다.
  useEffect(() => {
    playBgm(bgmForPath(pathname));
  }, [pathname]);

  return <AudioControl />;
}

// ── 떠 있는 뮤트/음량 컨트롤 ──────────────────────────────────────────────────
const WRAP_STYLE: React.CSSProperties = {
  position: "fixed",
  left: "max(10px, env(safe-area-inset-left))",
  bottom: "max(10px, env(safe-area-inset-bottom))",
  zIndex: 60,
  display: "flex",
  flexDirection: "column",
  alignItems: "flex-start",
  gap: 8,
  userSelect: "none",
};

const TOGGLE_STYLE: React.CSSProperties = {
  width: 40,
  height: 40,
  borderRadius: 20,
  border: "1px solid rgba(180, 170, 150, 0.35)",
  background: "rgba(18, 21, 25, 0.6)",
  color: "#e8e6e3",
  fontSize: 18,
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  backdropFilter: "blur(2px)",
};

const PANEL_STYLE: React.CSSProperties = {
  background: "rgba(18, 21, 25, 0.92)",
  border: "1px solid rgba(180, 170, 150, 0.3)",
  borderRadius: 10,
  padding: "12px 14px",
  display: "flex",
  flexDirection: "column",
  gap: 10,
  minWidth: 168,
  boxShadow: "0 6px 20px rgba(0,0,0,0.4)",
};

function Slider({
  label, value, onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}): React.ReactElement {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 3, fontSize: 11, color: "#b8bcc2" }}>
      <span style={{ display: "flex", justifyContent: "space-between" }}>
        <span>{label}</span>
        <span style={{ color: "#7a828c" }}>{Math.round(value * 100)}</span>
      </span>
      <input
        type="range"
        min={0}
        max={100}
        value={Math.round(value * 100)}
        onChange={(e) => onChange(Number(e.target.value) / 100)}
        style={{ accentColor: "#c8a24a", width: "100%" }}
        aria-label={label}
      />
    </label>
  );
}

/** 음량/뮤트 팝오버 토글. 엔진 설정을 구독해 외부 변경도 반영. */
function AudioControl(): React.ReactElement {
  const [, force] = useState(0);
  const [open, setOpen] = useState(false);
  useEffect(() => audio.subscribe(() => force((n) => n + 1)), []);
  const s = audio.getSettings();
  const muted = s.muted;

  return (
    <div style={WRAP_STYLE}>
      {open && (
        <div style={PANEL_STYLE} onClick={(e) => e.stopPropagation()}>
          <Slider label="전체" value={s.master} onChange={(v) => audio.setSettings({ master: v })} />
          <Slider label="음악" value={s.bgm} onChange={(v) => audio.setSettings({ bgm: v })} />
          <Slider label="효과음" value={s.sfx} onChange={(v) => audio.setSettings({ sfx: v })} />
          <button
            type="button"
            data-no-sfx
            onClick={() => audio.toggleMute()}
            style={{
              ...TOGGLE_STYLE,
              width: "100%",
              height: 32,
              borderRadius: 8,
              fontSize: 13,
              gap: 6,
              background: muted ? "rgba(120, 50, 50, 0.5)" : "rgba(40, 46, 54, 0.7)",
            }}
          >
            {muted ? "🔇 음소거 해제" : "🔊 음소거"}
          </button>
        </div>
      )}
      <button
        type="button"
        data-no-sfx
        aria-label={muted ? "소리 켜기" : "소리 설정"}
        onClick={() => setOpen((o) => !o)}
        style={{ ...TOGGLE_STYLE, opacity: muted ? 0.6 : 0.85 }}
      >
        {muted ? "🔇" : "🔊"}
      </button>
    </div>
  );
}
