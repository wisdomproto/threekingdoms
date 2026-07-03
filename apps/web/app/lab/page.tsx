"use client";
/**
 * /lab 라우트 — 전투 실험실(자유 편성 샌드박스). 순수 DOM 빌더라 dynamic 불필요하지만
 * gameData 로드가 클라이언트 전용 흐름과 정합하도록 /battle과 동일하게 ssr:false로 둔다.
 */
import dynamic from "next/dynamic";

const LabScreen = dynamic(() => import("../../src/lab/LabScreen"), {
  ssr: false,
  loading: () => (
    <main style={{ padding: 24, color: "#9aa3ad" }}>
      <p>실험실 준비 중…</p>
    </main>
  ),
});

export default function LabPage(): React.ReactElement {
  return <LabScreen />;
}
