"use client";
/** /playtest 라우트 — 에디터 플레이테스트 착륙. gameData 로드가 클라이언트 전용이라 /lab 과 같이 ssr:false. */
import dynamic from "next/dynamic";

const PlaytestLanding = dynamic(() => import("../../src/lab/PlaytestLanding"), {
  ssr: false,
  loading: () => (
    <main style={{ padding: 24, color: "#9aa3ad" }}>
      <p>플레이테스트 준비 중…</p>
    </main>
  ),
});

export default function PlaytestPage(): React.ReactElement {
  return <PlaytestLanding />;
}
