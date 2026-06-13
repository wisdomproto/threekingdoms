/**
 * 루트 = 타이틀 화면(§16 막간 셸). 기존 개발용 링크(사수관 직행 등)는 제거하지 않고
 * 하단 "개발 링크" 영역에 보존한다 — 화면이 채워지는 동안 직접 진입 경로 유지.
 */
import Link from "next/link";
import { gameData, stages } from "@tk/data";
import { TitleScreen } from "../src/meta/screens/TitleScreen";

export default function Home() {
  const stage = stages["05-sishuiguan"]!;
  const map = gameData.maps[stage.mapId]!;
  return (
    <main style={{ background: "#0d0b09" }}>
      <TitleScreen />
      <details style={{ padding: "16px 24px 32px", color: "#9aa3ad", fontSize: 13, background: "#0d0b09", borderTop: "1px solid #2c2620" }}>
        <summary style={{ cursor: "pointer", color: "#8a7350" }}>개발 링크 (임시)</summary>
        <p>첫 스테이지: {stage.name} ({map.width}×{map.height})</p>
        <p>등록 장수: {Object.keys(gameData.commanders).length}명</p>
        <ul>
          <li><Link href="/battle">▶ {stage.name} 직접 출진 (렌더러 v0, 편성 없음)</Link></li>
          <li><Link href="/stages">스테이지 선택</Link></li>
          <li><Link href={{ pathname: "/prep", query: { stage: stage.id } }}>출진 준비</Link></li>
        </ul>
      </details>
    </main>
  );
}
