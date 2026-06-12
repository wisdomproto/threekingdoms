import { gameData, stages } from "@tk/data";

export default function Home() {
  const stage = stages["05-sishuiguan"]!;
  const map = gameData.maps[stage.mapId]!;
  return (
    <main>
      <h1>삼국지 SRPG — 개발 중</h1>
      <p>첫 스테이지: {stage.name} ({map.width}×{map.height})</p>
      <p>등록 장수: {Object.keys(gameData.commanders).length}명</p>
    </main>
  );
}
