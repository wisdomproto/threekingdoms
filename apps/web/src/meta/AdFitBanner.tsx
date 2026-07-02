"use client";
/**
 * 카카오 애드핏 배너 (§13 — 2026-07-02 "바로 되는" 웹 배너 경로).
 *
 * 왜 애드핏: 애드센스는 게임 단독 페이지를 반복 탈락("콘텐츠 부족" 국룰)시키는 반면
 * 애드핏은 심사 1~2영업일·관대. 단 **배너/네이티브 전용**이라 게임 안 리워드·전면(§13 리워드
 * 4곳)은 못 대체 — 그건 포털 SDK 어댑터(출시 게이트) 경로 그대로다. 이 컴포넌트는
 * **막간(메타) 화면 하단 배너**만 담당한다. 전투 화면엔 붙이지 않는다(§13 절제).
 *
 * 동작:
 *  - unitId(애드핏 콘솔에서 발급하는 "DAN-…" 광고단위 코드)가 없으면 **아무것도 안 그림**
 *    — 심사/발급 전 배포에 무해(자리도 안 차지함).
 *  - adFree(광고제거 구매)면 숨김 — §13 "adFree 유저에게 광고 UI를 절대 띄우지 않는다".
 *  - 마운트 시 <ins class="kakao_ad_area"> + ba.min.js를 컨테이너에 주입. 애드핏 스크립트는
 *    로드 시점에 미처리 <ins>를 스캔하므로 SPA 라우트 전환마다 재주입해야 한다(카카오 공식
 *    SPA API 부재 — 통용 패턴). cleanup이 컨테이너를 비워 중복 스캔을 막는다.
 *
 * 사용: <AdFitBanner unitId={process.env.NEXT_PUBLIC_ADFIT_UNIT_STAGES} />
 *  - 광고단위는 지면당 1개 생성(애드핏 정책). 크기는 발급한 단위와 일치시킬 것(기본 320×100).
 */
import { useEffect, useRef, useState } from "react";
import { getAdService } from "./adService";

const ADFIT_SRC = "//t1.daumcdn.net/kas/static/ba.min.js";

/** 배너를 그릴지 — 순수 게이트(§13: 단위 미발급/adFree면 그리지 않는다). 테스트 대상. */
export function adfitVisible(unitId: string | undefined, adFree: boolean): boolean {
  return !!unitId && unitId.trim().length > 0 && !adFree;
}

export function AdFitBanner({
  unitId,
  width = 320,
  height = 100,
  style,
}: {
  /** 애드핏 광고단위 코드("DAN-…"). 미지정/빈 값 = 렌더 안 함(발급 전 무해). */
  unitId?: string;
  width?: number;
  height?: number;
  style?: React.CSSProperties;
}): React.ReactElement | null {
  // adFree는 클라 저장(metaStore) — SSR 불일치 방지를 위해 마운트 후 판정.
  const [adFree, setAdFree] = useState(false);
  const [mounted, setMounted] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setAdFree(getAdService().isAdFree());
    setMounted(true);
  }, []);

  const visible = mounted && adfitVisible(unitId, adFree);

  useEffect(() => {
    const box = boxRef.current;
    if (!visible || !box || !unitId) return;
    const ins = document.createElement("ins");
    ins.className = "kakao_ad_area";
    ins.style.display = "none"; // 애드핏 스크립트가 채우면 자체적으로 표시 전환
    ins.setAttribute("data-ad-unit", unitId);
    ins.setAttribute("data-ad-width", String(width));
    ins.setAttribute("data-ad-height", String(height));
    const script = document.createElement("script");
    script.async = true;
    script.src = ADFIT_SRC;
    box.appendChild(ins);
    box.appendChild(script);
    return () => {
      box.replaceChildren(); // 라우트 전환 시 재주입 대비 초기화
    };
  }, [visible, unitId, width, height]);

  if (!visible) return null;
  return (
    <div
      ref={boxRef}
      aria-label="광고"
      style={{
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        minHeight: height,
        marginTop: 24,
        opacity: 0.96,
        ...style,
      }}
    />
  );
}
