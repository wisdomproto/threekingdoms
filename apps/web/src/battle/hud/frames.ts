/**
 * 청동+수묵 HUD 프레임 (상태창.png에서 분리 → /assets/ui/frames/*.png).
 * CSS border-image 9-slice — 모서리 청동 부조는 고정, 변은 늘림. 가운데는 비워(투명) 내용이 비친다.
 * border-image-slice 순서 = top right bottom left (측정 인셋 기반).
 * 소스: docs/reference/sosoden-battle-ux-analysis.md §1 (원작 UI 크롬 = 청동기 문양 패널).
 */
import type { CSSProperties } from "react";

const BASE = "/assets/ui/frames";

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
