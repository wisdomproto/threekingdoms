"use client";
/**
 * 타이틀 화면 — §16 막간 셸 진입점.
 *
 * 수묵 톤 배경 + 로고 + "이어하기 / 새 게임" 메뉴.
 *  - 이어하기: clearedStages 또는 진행(roster/gold)이 있으면 활성 → /stages.
 *  - 새 게임: 진행이 있으면 1회 확인 후 metaStore.reset() → /stages.
 * 진행 유무 판단은 마운트 후(클라) 1회. SSR에서는 "새 게임"만 노출(이어하기 비활성)되어
 * 하이드레이션 불일치를 피한다.
 *
 * 청동/수묵 팔레트는 전투 HUD(frames.ts §1 — 청동기 문양 패널)와 톤을 맞춘다.
 * props 없음(라우트 셸이 직접 렌더). devLinks는 app/page.tsx 하단이 보존.
 */
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { BUTTON_FRAME } from "../../battle/hud/frames";
import { getMeta, reset } from "../metaStore";

/** 수묵·청동 공유 팔레트 (frames.ts 청동기 톤 + 먹빛 배경). */
const INK = "#1a1714";
const INK_DEEP = "#0d0b09";
const BRONZE_GOLD = "#cdab6e";
const BRONZE_DIM = "#8a7350";
const PARCHMENT = "#e8dcc0";

export function TitleScreen(): React.ReactElement {
  const router = useRouter();
  // 진행 유무는 클라에서만 확정(localStorage). 초기 false로 SSR/하이드레이션 일치.
  const [hasProgress, setHasProgress] = useState(false);
  const [confirmingNew, setConfirmingNew] = useState(false);

  useEffect(() => {
    const m = getMeta();
    const progressed =
      m.clearedStages.length > 0 ||
      m.gold > 0 ||
      Object.keys(m.rosterProgress).length > 0 ||
      m.inventory.length > 0;
    setHasProgress(progressed);
  }, []);

  function onContinue(): void {
    router.push("/stages");
  }

  function onNewGame(): void {
    if (hasProgress && !confirmingNew) {
      setConfirmingNew(true);
      return;
    }
    reset();
    setHasProgress(false);
    setConfirmingNew(false);
    router.push("/stages");
  }

  return (
    <section
      style={{
        minHeight: "100svh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 32,
        padding: "48px 20px",
        boxSizing: "border-box",
        background: `radial-gradient(120% 90% at 50% 18%, ${INK} 0%, ${INK_DEEP} 78%)`,
        color: PARCHMENT,
        textAlign: "center",
        fontFamily:
          '"Noto Serif KR", "Nanum Myeongjo", "Apple SD Gothic Neo", serif',
      }}
    >
      {/* 로고 블록 */}
      <header style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <p
          style={{
            margin: 0,
            letterSpacing: "0.5em",
            fontSize: 13,
            color: BRONZE_DIM,
            textIndent: "0.5em",
          }}
        >
          1998년의 게임성 · 2026년의 연출
        </p>
        <h1
          style={{
            margin: 0,
            fontSize: "clamp(40px, 11vw, 76px)",
            lineHeight: 1.05,
            color: BRONZE_GOLD,
            textShadow: `0 2px 18px ${INK_DEEP}, 0 0 1px ${BRONZE_DIM}`,
            fontWeight: 700,
          }}
        >
          삼국지
        </h1>
        <h2
          style={{
            margin: 0,
            fontSize: "clamp(16px, 4.5vw, 24px)",
            letterSpacing: "0.35em",
            color: PARCHMENT,
            textIndent: "0.35em",
            fontWeight: 400,
          }}
        >
          유 비 전
        </h2>
        <div
          aria-hidden
          style={{
            width: 96,
            height: 2,
            margin: "8px auto 0",
            background: `linear-gradient(90deg, transparent, ${BRONZE_DIM}, transparent)`,
          }}
        />
      </header>

      {/* 메뉴 */}
      <nav
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 16,
          width: "min(320px, 86vw)",
        }}
      >
        <MenuButton
          label="이어하기"
          onClick={onContinue}
          disabled={!hasProgress}
          primary={hasProgress}
        />
        <MenuButton
          label={confirmingNew ? "정말 새로 시작?" : "새 게임"}
          onClick={onNewGame}
          primary={!hasProgress}
          tone={confirmingNew ? "warn" : "default"}
        />
        {confirmingNew ? (
          <button
            type="button"
            onClick={() => setConfirmingNew(false)}
            style={{
              background: "none",
              border: "none",
              color: BRONZE_DIM,
              fontSize: 13,
              cursor: "pointer",
              padding: 4,
            }}
          >
            취소 — 기존 진행 유지
          </button>
        ) : (
          hasProgress && (
            <p style={{ margin: 0, fontSize: 12, color: BRONZE_DIM }}>
              새 게임은 현재 진행을 모두 초기화합니다.
            </p>
          )
        )}
      </nav>
    </section>
  );
}

function MenuButton({
  label,
  onClick,
  disabled = false,
  primary = false,
  tone = "default",
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  primary?: boolean;
  tone?: "default" | "warn";
}): React.ReactElement {
  const color =
    tone === "warn" ? "#e7c34a" : primary ? "#f3e7c8" : "#cdab6e";
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{
        ...BUTTON_FRAME,
        background: "transparent",
        color: disabled ? "#5a5142" : color,
        fontSize: 18,
        letterSpacing: "0.25em",
        textIndent: "0.25em",
        padding: "10px 8px",
        cursor: disabled ? "default" : "pointer",
        opacity: disabled ? 0.45 : 1,
        fontFamily: "inherit",
        fontWeight: primary ? 700 : 400,
        transition: "color 120ms, opacity 120ms",
      }}
    >
      {label}
    </button>
  );
}
