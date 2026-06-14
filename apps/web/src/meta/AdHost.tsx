"use client";
/**
 * AdHost — adService(adService.ts)의 모듈 레벨 광고 큐를 구독해 가짜 광고 모달/전면을 그린다.
 * app/layout.tsx에 전역 1회 마운트(클라이언트 아일랜드). 실제 SDK 도입 시 이 컴포넌트만 교체.
 *
 * 동작:
 *  - __subscribeAdRequests로 활성 AdRequest를 받아 모달을 띄운다.
 *  - rewarded: durationSec 카운트다운 → 0이 되면 "건너뛰기/보상받기" 활성. 끝까지 보면
 *    resolveActive(true)(→ showRewarded가 true), 도중 닫으면 resolveActive(false)(무손실).
 *    카운트다운 중에는 닫기/건너뛰기 비활성(끝나야 활성).
 *  - interstitial: 짧은 전면. durationSec 후(또는 즉시) "스킵" 활성 → resolveActive(true).
 *
 * 청동/수묵 톤은 frames.ts(BUTTON_FRAME)·TitleScreen 팔레트와 정합.
 */
import { useEffect, useRef, useState } from "react";
import { BUTTON_FRAME } from "../battle/hud/frames";
import {
  __subscribeAdRequests,
  resolveActive,
  type AdRequest,
} from "./adService";

const INK_DEEP = "#0d0b09";
const BRONZE_GOLD = "#cdab6e";
const BRONZE_DIM = "#8a7350";
const PARCHMENT = "#e8dcc0";

/** placement → 모달 헤더 문구(데모 가독성). */
const PLACEMENT_LABEL: Record<string, string> = {
  result_double: "결산 보상 2배",
  shop_gold: "골드 충전",
  qiyuan_extra: "기연 뽑기 +1",
  merchant_restock: "상인 재입고",
  interstitial: "다음 화 예고",
};

export function AdHost(): React.ReactElement | null {
  const [req, setReq] = useState<AdRequest | null>(null);
  const [remaining, setRemaining] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // 광고 큐 구독 — 활성 요청이 생기면 모달을 띄우고 카운트다운을 시작.
  useEffect(() => {
    return __subscribeAdRequests((next) => {
      setReq(next);
      setRemaining(next ? next.durationSec : 0);
    });
  }, []);

  // 카운트다운 타이머 — req가 바뀔 때마다 재설정. 0에 도달하면 멈춤(버튼 활성).
  useEffect(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (!req || req.durationSec <= 0) return;
    timerRef.current = setInterval(() => {
      setRemaining((r) => {
        if (r <= 1) {
          if (timerRef.current) {
            clearInterval(timerRef.current);
            timerRef.current = null;
          }
          return 0;
        }
        return r - 1;
      });
    }, 1000);
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [req]);

  if (!req) return null;

  const canAct = remaining <= 0; // 카운트다운 끝나야 활성(§13 — 끝까지 봐야 보상)
  const isReward = req.kind === "rewarded";
  const header = PLACEMENT_LABEL[req.placement] ?? "광고";

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="광고 재생"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9000,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 22,
        padding: 24,
        boxSizing: "border-box",
        background: "rgba(6,5,4,0.86)",
        color: PARCHMENT,
        fontFamily: '"Noto Serif KR", "Nanum Myeongjo", serif',
        textAlign: "center",
      }}
    >
      <p style={{ margin: 0, fontSize: 13, letterSpacing: "0.3em", color: BRONZE_DIM }}>
        {isReward ? "리워드 광고" : "잠시 후 계속"}
      </p>
      <h2 style={{ margin: 0, fontSize: 22, color: BRONZE_GOLD, letterSpacing: "0.1em" }}>
        {header}
      </h2>

      {/* 가짜 광고 "영상" 박스 */}
      <div
        aria-hidden
        style={{
          width: "min(360px, 80vw)",
          aspectRatio: "16 / 9",
          borderRadius: 6,
          border: `1px solid ${BRONZE_DIM}`,
          background: `repeating-linear-gradient(45deg, ${INK_DEEP}, ${INK_DEEP} 12px, #15110d 12px, #15110d 24px)`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: BRONZE_DIM,
          fontSize: 13,
          letterSpacing: "0.2em",
        }}
      >
        광고 재생 중 (DevMock)
      </div>

      <p style={{ margin: 0, fontSize: 14, color: PARCHMENT, minHeight: 20 }}>
        {canAct
          ? isReward
            ? "광고 시청 완료 — 보상을 받으세요"
            : "건너뛸 수 있습니다"
          : `${remaining}초 후 ${isReward ? "보상받기" : "건너뛰기"}`}
      </p>

      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", justifyContent: "center" }}>
        {/* 완주 = 보상(rewarded) / 스킵 완료(interstitial). 카운트다운 후 활성. */}
        <button
          type="button"
          disabled={!canAct}
          onClick={() => resolveActive(true)}
          style={adButtonStyle(canAct, true)}
        >
          {isReward ? "보상 받기" : "계속하기"}
        </button>
        {/* 취소 = 무손실 종료(rewarded만 의미; interstitial은 결과 무관이라 표시 안 함). */}
        {isReward && (
          <button
            type="button"
            disabled={!canAct}
            onClick={() => resolveActive(false)}
            style={adButtonStyle(canAct, false)}
          >
            건너뛰기 (보상 없음)
          </button>
        )}
      </div>
    </div>
  );
}

function adButtonStyle(enabled: boolean, primary: boolean): React.CSSProperties {
  return {
    ...BUTTON_FRAME,
    background: "transparent",
    color: enabled ? (primary ? "#f3e7c8" : BRONZE_DIM) : "#5a5142",
    fontFamily: "inherit",
    fontSize: 16,
    letterSpacing: "0.15em",
    padding: "8px 14px",
    cursor: enabled ? "pointer" : "default",
    opacity: enabled ? 1 : 0.5,
    fontWeight: primary ? 700 : 400,
  };
}
