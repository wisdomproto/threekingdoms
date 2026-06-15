"use client";
/**
 * useFadeNav (캠페인 루프 폴리시) — 페이드-투-블랙 후 client 라우팅.
 *
 * `<a href>` 풀 리로드(흰 화면 깜빡 + 재초기화) 대신, 검정 오버레이를 깔고 SPA 라우팅한다 —
 * 결산→outro, outro→다음 intro, 패배→outroDefeat 전환을 시네마틱하게 잇는다.
 * 타이머 구동(onTransitionEnd 비의존)이라 reduced-motion·다중 transition에도 견고.
 */
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const FADE_MS = 300;

/**
 * @param resetKey 현재 화면을 식별하는 키(예: `${stage}:${type}`). 이 값이 바뀌면 = 새 화면 도착 →
 *   페이드를 자동 해제(검정 오버레이 페이드 아웃). 같은 라우트 재사용 전환(/scene→/scene =
 *   outro→다음 intro)에서 오버레이가 잔류해 화면을 덮는 버그를 막는다(remount 여부 무관).
 */
export function useFadeNav(resetKey?: string): { fadeTo: (href: string) => void; overlay: React.ReactElement; fading: boolean } {
  const router = useRouter();
  const [fading, setFading] = useState(false);

  // 도착(resetKey 변경) 시 페이드 해제 → 오버레이가 새 화면 위에서 검정→투명으로 사라진다.
  useEffect(() => {
    setFading(false);
  }, [resetKey]);

  const fadeTo = useCallback(
    (href: string) => {
      setFading(true);
      // 화면이 완전히 검어진 뒤(>FADE_MS) 라우팅 — 깜빡임 없이 다음 화면으로. 도착하면 resetKey가
      // 바뀌어 위 useEffect가 페이드를 해제한다.
      window.setTimeout(() => router.push(href), FADE_MS + 20);
    },
    [router],
  );

  const overlay = (
    <div
      aria-hidden
      style={{
        position: "fixed",
        inset: 0,
        background: "#000",
        zIndex: 9999,
        opacity: fading ? 1 : 0,
        pointerEvents: fading ? "auto" : "none",
        transition: `opacity ${FADE_MS}ms ease`,
      }}
    />
  );

  return { fadeTo, overlay, fading };
}
