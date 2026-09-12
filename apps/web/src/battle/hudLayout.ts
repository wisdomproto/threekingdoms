/** HUD 컬럼 중재 — 순수 함수. */
import type { MenuAnchor } from "./store";

/**
 * UnitPanel 슬롯: 유닛이 화면 좌측 절반이면 우측 컬럼(가림 회피, 원작 §7-A).
 * 앵커 없음/뷰포트 0(미측정) = 좌측.
 */
export function unitPanelSide(anchor: Pick<MenuAnchor, "x"> | null, viewportWidth: number): "left" | "right" {
  return anchor != null && viewportWidth > 0 && anchor.x < viewportWidth / 2 ? "right" : "left";
}
