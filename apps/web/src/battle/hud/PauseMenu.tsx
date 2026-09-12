"use client";
/**
 * PauseMenu (시스템 메뉴) — 전투 중 ESC 키 또는 우상단 「☰ 메뉴」 버튼으로 여는 모달 오버레이.
 *
 * 전투는 턴제라 멈출 "시계"가 없다 — 모달 백드롭이 맵 입력을 가려 사실상 멈춘다.
 * 담는 것: ① 계속하기(닫기) ② 소리(전체/음악/효과음 + 음소거 — audio 엔진 설정 공유,
 * 좌하단 AudioControl과 같은 SSOT) ③ 조작(입문 공격 확인/클래식 — tk.controls.v1)
 * ④ 저장하고 나가기(아군 idle에만, 스펙 §7 — sandbox 미표시) ⑤ 전투 그만두기(스테이지 선택으로).
 *  - 모바일 우선(§3): ESC 없는 기기를 위해 여는 버튼은 BattleControls에 둔다(이 파일은 패널만 그린다).
 *  - 나가기는 결산 전이라 진행이 저장되지 않으므로 한 번 확인을 받는다(오조작 방지).
 *  - 청동/수묵 톤 = LoadingTransition·HUD 프레임과 일치.
 */
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { audio } from "../../audio";
import { BUTTON_FRAME } from "./frames";
import { leaveSandbox } from "../../lab/lab";

const INK = "#15120f";
const INK_DEEP = "#0b0907";
const BRONZE_GOLD = "#cdab6e";
const BRONZE_DIM = "#8a7350";
const PARCHMENT = "#e8dcc0";

const MENU_BTN: React.CSSProperties = {
  ...BUTTON_FRAME,
  background: "transparent",
  color: "#f3e7c8",
  fontSize: 16,
  letterSpacing: "0.18em",
  textIndent: "0.18em",
  padding: "8px 22px",
  cursor: "pointer",
  fontFamily: "inherit",
  fontWeight: 700,
  width: "100%",
};

/** 소리 한 줄 슬라이더 — 좌하단 AudioControl과 같은 audio 엔진 값에 연결(표시만 컴팩트). */
function SoundRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}): React.ReactElement {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12, color: PARCHMENT }}>
      <span style={{ display: "flex", justifyContent: "space-between" }}>
        <span>{label}</span>
        <span style={{ color: BRONZE_DIM }}>{Math.round(value * 100)}</span>
      </span>
      <input
        type="range"
        min={0}
        max={100}
        value={Math.round(value * 100)}
        onChange={(e) => onChange(Number(e.target.value) / 100)}
        style={{ accentColor: BRONZE_GOLD, width: "100%" }}
        aria-label={label}
      />
    </label>
  );
}

export function PauseMenu({
  open,
  onClose,
  exitTo = "/stages",
  sandbox = false,
  canSuspend = false,
  onSuspend,
  confirmAttacks = true,
  onToggleConfirmAttacks,
}: {
  open: boolean;
  /** 패널을 닫는다(계속하기/백드롭/ESC). 실제 paused 상태는 BattleScreen이 소유. */
  onClose: () => void;
  /** 「나가기」 목적지 — 기본 전장 선택. */
  exitTo?: string;
  /** 실험실/플레이테스트 전투: 「나가기」가 leaveSandbox(에디터 탭 복귀 또는 /lab) 로 간다. */
  sandbox?: boolean;
  /** 「저장하고 나가기」 활성 조건(아군 idle·ongoing) — 아니면 비활성 + 사유 표시 */
  canSuspend?: boolean;
  /** 중단 저장(저장만) — 이동(exitTo)은 여기서. 없거나 sandbox면 버튼 미표시 */
  onSuspend?: () => void;
  /** 조작: true=입문(공격 확인 카드) / false=클래식(즉시 공격) */
  confirmAttacks?: boolean;
  onToggleConfirmAttacks?: (on: boolean) => void;
}): React.ReactElement | null {
  const router = useRouter();
  const [confirmExit, setConfirmExit] = useState(false);
  const [, force] = useState(0);
  // 외부(좌하단 패널 등)에서 음량이 바뀌어도 슬라이더가 따라오도록 엔진 설정을 구독.
  useEffect(() => audio.subscribe(() => force((n) => n + 1)), []);
  // 메뉴가 닫히면 확인 단계도 리셋 — 다음에 열 때 깨끗한 상태.
  useEffect(() => {
    if (!open) setConfirmExit(false);
  }, [open]);

  if (!open) return null;
  const s = audio.getSettings();

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="시스템 메뉴"
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 80,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
        boxSizing: "border-box",
        background: "rgba(8, 7, 6, 0.72)",
        backdropFilter: "blur(2px)",
        fontFamily: '"Noto Serif KR", "Nanum Myeongjo", "Apple SD Gothic Neo", serif',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "min(340px, 90vw)",
          display: "flex",
          flexDirection: "column",
          gap: 16,
          padding: "26px 24px",
          borderRadius: 14,
          background: `linear-gradient(160deg, ${INK} 0%, ${INK_DEEP} 100%)`,
          border: `1px solid ${BRONZE_DIM}66`,
          boxShadow: "0 14px 48px rgba(0,0,0,0.6)",
          color: PARCHMENT,
        }}
      >
        <h2
          style={{
            margin: 0,
            textAlign: "center",
            fontSize: 13,
            letterSpacing: "0.5em",
            textIndent: "0.5em",
            color: BRONZE_DIM,
            fontWeight: 600,
          }}
        >
          메 뉴
        </h2>

        {confirmExit ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <p style={{ margin: 0, fontSize: 14, lineHeight: 1.6, textAlign: "center" }}>
              전투를 그만두시겠어요?
              <br />
              <span style={{ color: BRONZE_DIM, fontSize: 12.5 }}>
                진행 중인 전투는 저장되지 않습니다.
              </span>
            </p>
            <button type="button" onClick={() => (sandbox ? leaveSandbox((to) => router.push(to)) : router.push(exitTo))} style={{ ...MENU_BTN, color: "#e7b4ac" }}>
              나가기
            </button>
            <button type="button" onClick={() => setConfirmExit(false)} style={MENU_BTN}>
              취소
            </button>
          </div>
        ) : (
          <>
            <button type="button" onClick={onClose} style={MENU_BTN}>
              계속하기
            </button>

            {/* 소리 — 좌하단 AudioControl과 같은 audio 엔진 설정(SSOT)을 컴팩트하게 노출 */}
            <div style={{ display: "flex", flexDirection: "column", gap: 10, padding: "2px 2px 6px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 11, letterSpacing: "0.3em", color: BRONZE_DIM }}>소리</span>
                <span style={{ flex: 1, height: 1, background: `${BRONZE_DIM}44` }} />
                <button
                  type="button"
                  data-no-sfx
                  onClick={() => audio.toggleMute()}
                  style={{
                    background: "none",
                    border: "none",
                    color: s.muted ? "#e7b4ac" : BRONZE_GOLD,
                    cursor: "pointer",
                    fontSize: 16,
                    lineHeight: 1,
                  }}
                  aria-label={s.muted ? "음소거 해제" : "음소거"}
                >
                  {s.muted ? "🔇" : "🔊"}
                </button>
              </div>
              <SoundRow label="전체" value={s.master} onChange={(v) => audio.setSettings({ master: v })} />
              <SoundRow label="음악" value={s.bgm} onChange={(v) => audio.setSettings({ bgm: v })} />
              <SoundRow label="효과음" value={s.sfx} onChange={(v) => audio.setSettings({ sfx: v })} />
            </div>

            {/* 조작 — 입문(공격 확인) / 클래식(원작 즉시 공격). 활성 쪽만 금빛(액자는 border-image라 색으로 구분) */}
            <div style={{ display: "flex", flexDirection: "column", gap: 8, padding: "2px 2px 6px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 11, letterSpacing: "0.3em", color: BRONZE_DIM }}>조작</span>
                <span style={{ flex: 1, height: 1, background: `${BRONZE_DIM}44` }} />
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                {(
                  [
                    ["controls-beginner", true, "입문(공격 확인)"],
                    ["controls-classic", false, "클래식(즉시 공격)"],
                  ] as const
                ).map(([tid, on, label]) => (
                  <button
                    key={tid}
                    type="button"
                    data-testid={tid}
                    aria-pressed={confirmAttacks === on}
                    onClick={() => onToggleConfirmAttacks?.(on)}
                    style={{
                      ...MENU_BTN,
                      fontSize: 12.5,
                      letterSpacing: "0.02em",
                      textIndent: 0,
                      padding: "6px 4px",
                      color: confirmAttacks === on ? BRONZE_GOLD : BRONZE_DIM,
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {!sandbox && onSuspend && (
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <button
                  type="button"
                  data-testid="pause-suspend"
                  disabled={!canSuspend}
                  onClick={() => {
                    onSuspend();
                    router.push(exitTo);
                  }}
                  style={{ ...MENU_BTN, opacity: canSuspend ? 1 : 0.45, cursor: canSuspend ? "pointer" : "not-allowed" }}
                >
                  저장하고 나가기
                </button>
                {!canSuspend && (
                  <p style={{ margin: 0, fontSize: 12, color: BRONZE_DIM, textAlign: "center", lineHeight: 1.5 }}>
                    아군 차례에 행동을 고르기 전에만 저장할 수 있습니다
                  </p>
                )}
              </div>
            )}

            <button type="button" onClick={() => setConfirmExit(true)} style={{ ...MENU_BTN, color: "#cfa9a3" }}>
              전투 그만두기
            </button>
          </>
        )}
      </div>
    </div>
  );
}
