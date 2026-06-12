"use client";
/**
 * /battle 라우트 (설계 §2.3) — BattleScreen을 dynamic(ssr:false)로 로드.
 * Pixi(WebGL/canvas)는 서버 환경이 없으므로 클라이언트 전용. Next 15에서
 * ssr:false dynamic은 클라이언트 컴포넌트에서만 허용되어 페이지 자체를 "use client"로 둔다.
 */
import dynamic from "next/dynamic";

const BattleScreen = dynamic(() => import("../../src/battle/BattleScreen"), {
  ssr: false,
  loading: () => (
    <main style={{ padding: 24, color: "#9aa3ad" }}>
      <p>전장 준비 중…</p>
    </main>
  ),
});

export default function BattlePage(): React.ReactElement {
  return <BattleScreen />;
}
