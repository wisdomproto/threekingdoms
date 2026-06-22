import type { Viewport } from "next";
import { AdHost } from "../src/meta/AdHost";
import { AudioController } from "../src/audio/AudioController";

export const metadata = { title: "삼국지 SRPG (가칭)" };

/**
 * 모바일 입력 메타 (설계 리스크 §9-4 — 핀치줌 vs 브라우저 줌 충돌 대응).
 * - userScalable:false + maximumScale:1 — 브라우저 페이지 줌 차단, 핀치는 게임 카메라 전용
 *   (canvas touch-action:none과 이중 방어 — iOS Safari가 메타만으로 더블탭 줌을 막지 못하는 케이스 보완)
 * - viewportFit "cover" — 노치 기기에서 env(safe-area-inset-*)가 0이 아닌 실값을 갖게 하는 전제조건.
 *   HUD 하단 버튼들(ActionMenu/TurnBanner)이 이 값으로 홈 인디케이터를 피한다.
 */
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>
        {children}
        {/* 전역 광고 호스트(클라이언트 아일랜드) — adService 큐를 구독해 가짜 광고 모달/전면 렌더. */}
        <AdHost />
        {/* 전역 오디오 컨트롤러 — 제스처 해제·경로별 BGM·전역 클릭음·뮤트 UI(절차적 SFX/BGM). */}
        <AudioController />
      </body>
    </html>
  );
}
