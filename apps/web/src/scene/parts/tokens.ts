/** 막간 씬 공용 색 토큰 + 캐럿 점멸 keyframe (ScenePlayer 표현 조각 공유). */

export const PARCHMENT = "#e8dcc0";
export const BRONZE_GOLD = "#cdab6e";
export const BRONZE_DIM = "#8a7350";

export const SIDE_COLOR: Record<string, string> = {
  player: "#9ec6ff",
  ally: "#ffc27a",
  enemy: "#ff9a9a",
};

/** 대사/내레이션 캐럿 ▼ 점멸 — 패널이 렌더하는 곳에 함께 주입(루트에만 두면 스테이지 플레이어에서 죽는다). */
export const TK_BLINK_KEYFRAMES = "@keyframes tkBlink { 0%,100% { opacity: 0.3 } 50% { opacity: 1 } }";
