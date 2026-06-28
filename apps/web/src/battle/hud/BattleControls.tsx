"use client";
/**
 * BattleControls (feel-spec §A 카메라 + 자동전투) — 우상단 보조 컨트롤.
 * - 기본 줌 복귀: 수동 줌/팬 후 스테이지 기본 카메라(줌·포커스)로 되돌린다.
 * - 자동전투: 아군 페이즈를 그리디 AI가 대신 진행 (토글). ON이면 강조 표시.
 * TurnBanner(상단 바)·ActionMenu/턴종료(하단)와 겹치지 않게 우상단 세로 스택에 둔다.
 * - 음악 토글: 전역 음량 패널(좌하단 AudioControl)이 전투 대사창에 가려 안 보일 때를 위한 빠른 BGM on/off.
 */
import { useEffect, useState } from "react";
import { audio, DEFAULT_SETTINGS } from "../../audio";

// 우측 컬럼(미니맵 아래)에 흐르도록 — 위치는 BattleScreen의 래퍼가 잡는다
const STACK_STYLE: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  alignItems: "flex-end",
  gap: 8,
  pointerEvents: "none",
  userSelect: "none",
};

const BTN_STYLE: React.CSSProperties = {
  minHeight: 40,
  minWidth: 96,
  padding: "0 14px",
  borderRadius: 12,
  borderWidth: 1,
  borderStyle: "solid",
  borderColor: "#3a414a",
  background: "rgba(24, 28, 33, 0.92)",
  color: "#e8e6e3",
  fontSize: 14,
  fontWeight: 600,
  cursor: "pointer",
  pointerEvents: "auto",
  touchAction: "manipulation",
};

export function BattleControls({
  auto,
  onToggleAuto,
  onResetCamera,
  speed,
  onCycleSpeed,
  canAutoFight = false,
}: {
  auto: boolean;
  onToggleAuto: () => void;
  onResetCamera: () => void;
  speed: number;
  onCycleSpeed: () => void;
  /** 자동전투 허용 여부 — 이 스테이지를 이미 클리어한 경우만 true(§15). */
  canAutoFight?: boolean;
}): React.ReactElement {
  const accent = (active: boolean): React.CSSProperties =>
    active
      ? { ...BTN_STYLE, borderColor: "#ffc24b", color: "#ffc24b", background: "rgba(50, 40, 14, 0.92)" }
      : BTN_STYLE;
  const dimmed: React.CSSProperties = {
    ...BTN_STYLE,
    opacity: 0.4,
    cursor: "not-allowed",
  };
  return (
    <div style={STACK_STYLE}>
      <button type="button" style={BTN_STYLE} onClick={onResetCamera}>
        ⟲ 기본 줌
      </button>
      <button type="button" style={accent(speed > 1)} onClick={onCycleSpeed}>
        ⏩ 배속 ×{speed}
      </button>
      <button
        type="button"
        style={canAutoFight ? accent(auto) : dimmed}
        onClick={canAutoFight ? onToggleAuto : undefined}
        title={canAutoFight ? undefined : "클리어한 스테이지에서만 사용 가능"}
      >
        {auto ? "⏸ 자동전투" : "▶ 자동전투"}
      </button>
      <MusicToggle />
    </div>
  );
}

/**
 * 음악(BGM) 켜기/끄기 토글 — audio 엔진 설정(settings.bgm)을 구독해 즉시 반영 + localStorage 저장.
 * 끄면 bgm=0, 켜면 기본값(0.45) 복귀. 전체 음량/효과음/마스터 음소거는 좌하단 AudioControl 패널 담당.
 * (data-no-sfx: 음소거 조작에 위임 클릭음이 울리지 않게 — AudioControl과 동일 규약.)
 */
function MusicToggle(): React.ReactElement {
  const [, force] = useState(0);
  useEffect(() => audio.subscribe(() => force((n) => n + 1)), []);
  const bgmOff = audio.getSettings().bgm === 0;
  return (
    <button
      type="button"
      data-no-sfx
      aria-label={bgmOff ? "음악 켜기" : "음악 끄기"}
      onClick={() => audio.setSettings({ bgm: bgmOff ? DEFAULT_SETTINGS.bgm : 0 })}
      style={{
        ...BTN_STYLE,
        ...(bgmOff
          ? { borderColor: "#b5564e", color: "#e0a39c", background: "rgba(60, 30, 28, 0.92)" }
          : {}),
      }}
    >
      {bgmOff ? "🔇 음악 꺼짐" : "🎵 음악 켜짐"}
    </button>
  );
}
