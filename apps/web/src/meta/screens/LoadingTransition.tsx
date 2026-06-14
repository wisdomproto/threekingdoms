"use client";
/**
 * 출진 → 전투 로딩 전환 셸 (CLAUDE.md §13 "절제형 전환 전면광고 + 로딩 셸").
 *
 * 역할:
 *  - 출진 클릭 후 /battle 로 넘어가기 전, 풀스크린 로딩 + **막간 스토리 카드 자리**를 보여준다.
 *    카드 = 스테이지명 + 한 줄 "다음 화 예고"(intro placeholder). 실제 스토리 데이터는 후속.
 *  - **절제형 전면광고 번들**: isAdFree가 아니고 빈도 규칙(interstitialPolicy)이 노출이면,
 *    카드 표시 동안 1회 showInterstitial()을 await — "순수 인터럽트" 대신 카드와 묶는다(§13).
 *    그 외엔 로딩 카드만(광고 없음). adFree는 광고 생략, 카드는 유지.
 *  - 광고 종료(또는 생략) 후 "전장으로" 버튼이 활성 → onEnter()로 실제 /battle 진입.
 *    광고가 진행 중인 동안은 버튼을 비활성("준비 중")으로 둔다.
 *
 * 이 컴포넌트는 **연출/배선만** — router.push는 부모(PrepShell)가 onEnter에서 수행한다.
 * 청동/수묵 팔레트는 TitleScreen/HUD frames와 톤 일치.
 */
import { useEffect, useRef, useState } from "react";
import { BUTTON_FRAME } from "../../battle/hud/frames";
import { getAdService } from "../adService";
import { isBossStage } from "../interstitialPolicy";

const INK = "#1a1714";
const INK_DEEP = "#0d0b09";
const BRONZE_GOLD = "#cdab6e";
const BRONZE_DIM = "#8a7350";
const PARCHMENT = "#e8dcc0";

export interface LoadingTransitionProps {
  /** 출진 대상 스테이지 id(예 "05-sishuiguan"). 보스 카드 톤 분기에 사용. */
  stageId: string;
  /** 스테이지명(카드 헤드라인). */
  stageName: string;
  /** 이번 전환에 전면광고를 끼울지(PrepShell이 interstitialPolicy로 사전 결정). adFree는 adService가 단락. */
  showAd: boolean;
  /** 광고/로딩 완료 후 실제 전투 진입(부모가 router.push 수행). */
  onEnter: () => void;
}

export function LoadingTransition({
  stageId,
  stageName,
  showAd,
  onEnter,
}: LoadingTransitionProps): React.ReactElement {
  // 광고가 진행/대기 중인 동안 "전장으로"를 잠근다. showAd=false면 즉시 준비 완료.
  const [adPending, setAdPending] = useState(showAd);
  // StrictMode 이중 마운트/리렌더에도 광고를 한 번만 띄우도록 가드.
  const adStarted = useRef(false);
  const boss = isBossStage(stageId);

  useEffect(() => {
    if (!showAd) {
      setAdPending(false);
      return;
    }
    if (adStarted.current) return;
    adStarted.current = true;

    let cancelled = false;
    // showInterstitial은 adFree면 즉시 resolve, 아니면 전면 노출 후 resolve(스킵/완주 무관 void).
    void getAdService()
      .showInterstitial()
      .finally(() => {
        if (!cancelled) setAdPending(false);
      });
    return () => {
      cancelled = true;
    };
  }, [showAd]);

  return (
    <section
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 40,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 28,
        padding: "48px 20px",
        boxSizing: "border-box",
        background: `radial-gradient(120% 90% at 50% 22%, ${INK} 0%, ${INK_DEEP} 80%)`,
        color: PARCHMENT,
        textAlign: "center",
        fontFamily:
          '"Noto Serif KR", "Nanum Myeongjo", "Apple SD Gothic Neo", serif',
      }}
      aria-label="전투 진입 로딩"
    >
      {/* 막간 스토리 카드 자리 — 실제 intro/outro 스토리 데이터는 후속(placeholder). */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 14,
          width: "min(440px, 88vw)",
        }}
      >
        <p
          style={{
            margin: 0,
            letterSpacing: "0.5em",
            fontSize: 12,
            color: BRONZE_DIM,
            textIndent: "0.5em",
          }}
        >
          {boss ? "결전 — 다음 화 예고" : "다음 화 예고"}
        </p>
        <h1
          style={{
            margin: 0,
            fontSize: "clamp(28px, 7vw, 44px)",
            lineHeight: 1.1,
            color: BRONZE_GOLD,
            textShadow: `0 2px 16px ${INK_DEEP}`,
            fontWeight: 700,
          }}
        >
          {stageName}
        </h1>
        <div
          aria-hidden
          style={{
            width: 80,
            height: 2,
            margin: "2px auto",
            background: `linear-gradient(90deg, transparent, ${BRONZE_DIM}, transparent)`,
          }}
        />
        {/* 스토리 한 줄 placeholder — 실제 대사/내레이션은 스토리 데이터 연결 시 교체. */}
        <p style={{ margin: 0, fontSize: 14, lineHeight: 1.6, color: PARCHMENT, opacity: 0.85 }}>
          {boss
            ? "운명을 가를 일전이 눈앞에 있다. 전군, 진군 준비."
            : "전장이 부른다. 군세를 정비하고 길을 나선다."}
        </p>
      </div>

      {/* 진행 상태 — 광고 대기 중이면 안내, 아니면 "전장으로". */}
      <div style={{ display: "flex", flexDirection: "column", gap: 10, alignItems: "center" }}>
        {adPending ? (
          <p style={{ margin: 0, fontSize: 13, color: BRONZE_DIM }} aria-live="polite">
            전장을 준비하는 중…
          </p>
        ) : null}
        <button
          type="button"
          onClick={onEnter}
          disabled={adPending}
          style={{
            ...BUTTON_FRAME,
            background: "transparent",
            color: adPending ? "#5a5142" : "#f3e7c8",
            fontSize: 18,
            letterSpacing: "0.25em",
            textIndent: "0.25em",
            padding: "10px 28px",
            cursor: adPending ? "default" : "pointer",
            opacity: adPending ? 0.5 : 1,
            fontFamily: "inherit",
            fontWeight: 700,
            transition: "color 120ms, opacity 120ms",
          }}
        >
          전장으로 ▶
        </button>
      </div>
    </section>
  );
}
