/**
 * 청동+수묵 HUD 프레임 (상태창.png에서 분리 → /assets/ui/frames/*.png).
 * CSS border-image 9-slice — 모서리 청동 부조는 고정, 변은 늘림. 가운데는 비워(투명) 내용이 비친다.
 * border-image-slice 순서 = top right bottom left (측정 인셋 기반).
 * 소스: docs/reference/sosoden-battle-ux-analysis.md §1 (원작 UI 크롬 = 청동기 문양 패널).
 */
import type { CSSProperties } from "react";
import { assetUrl } from "../../assetUrl";

const BASE = assetUrl("/assets/ui/frames");

/** 정보 패널 등 큰 창 — 측정 인셋 T/R/B/L = 60/71/46/70 */
export const PANEL_FRAME: CSSProperties = {
  borderStyle: "solid",
  borderWidth: "32px 34px 24px 34px",
  borderImageSource: `url(${BASE}/panel.png)`,
  borderImageSlice: "60 71 46 70",
  borderImageRepeat: "stretch",
};

/** 알약형 버튼 — 인셋 T/R/B/L = 16/34/16/35 */
export const BUTTON_FRAME: CSSProperties = {
  borderStyle: "solid",
  borderWidth: "14px 22px 14px 22px",
  borderImageSource: `url(${BASE}/button.png)`,
  borderImageSlice: "16 34 16 35",
  borderImageRepeat: "stretch",
};

/** 미니맵 코너 브래킷 — 4모서리만(변 사이는 투명), 슬라이스≈코너 크기 */
export const MINIMAP_FRAME: CSSProperties = {
  borderStyle: "solid",
  borderWidth: "16px",
  borderImageSource: `url(${BASE}/minimap.png)`,
  borderImageSlice: "158",
  borderImageRepeat: "stretch",
};

/** 세로 초상 프레임 — 인셋 T/R/B/L = 53/36/50/38 (초상 결선 시 사용) */
export const PORTRAIT_FRAME: CSSProperties = {
  borderStyle: "solid",
  borderWidth: "26px 18px 25px 19px",
  borderImageSource: `url(${BASE}/portrait.png)`,
  borderImageSlice: "53 36 50 38",
  borderImageRepeat: "stretch",
};

// ── 전투 HUD 공통 청동/수묵 크롬 토큰 ─────────────────────────────────────────
// 상시 컨트롤(BattleControls·턴 종료)·모달이 공유 — 팝업(청동 프레임)과 톤을 맞춘다.
// (종전엔 상시 크롬만 회색 사각+이모지라 씬/팝업과 톤이 널뛰었다 — 2026-06-30 리뷰 P0.)
/** 수묵/청동 HUD 서체 — ScenePlayer·LoadingTransition·PauseMenu와 동일 스택 */
export const HUD_FONT = '"Noto Serif KR", "Nanum Myeongjo", "Apple SD Gothic Neo", serif';
/** 먹빛 패널 바탕 (상시 버튼) */
export const HUD_INK = "rgba(24, 20, 13, 0.92)";
/** 청동 테두리(기본) */
export const HUD_BRONZE_DIM = "#6f5a34";
/** 청동 하이라이트(활성/강조) */
export const HUD_BRONZE = "#e0b84a";
/** 양피지 글자색 */
export const HUD_PARCHMENT = "#e8d9b0";
