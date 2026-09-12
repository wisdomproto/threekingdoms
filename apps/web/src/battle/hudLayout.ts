/** HUD 컬럼 중재 — 순수 함수. */
import type { InputState } from "./inputMachine";
import type { MenuAnchor } from "./store";

/** 모바일 HUD 상한(px, design-guide §3 Mobile <768px) */
export const MOBILE_MAX = 767;

/** 뷰포트 폭 → HUD 모드. 미측정(0)은 desktop(SSR/마운트 전 무회귀). */
export function hudMode(viewportWidth: number): "mobile" | "desktop" {
  return viewportWidth > 0 && viewportWidth <= MOBILE_MAX ? "mobile" : "desktop";
}

/**
 * 모바일 하단 패널 상태 — 상태기계가 곧 상태(사용자 토글 없음).
 * 유닛을 다루는 중(선택~조준~확인)이면 expanded, 그 외(대기·연출·타 진영·종료)는 collapsed.
 */
export function bottomPanelState(ui: InputState): "collapsed" | "expanded" {
  switch (ui.kind) {
    case "selected":
    case "postMoveMenu":
    case "targetSelect":
    case "confirmAttack":
    case "strategyMenu":
    case "strategyTarget":
    case "itemMenu":
    case "itemTarget":
      return "expanded";
    default:
      return "collapsed";
  }
}

/**
 * UnitPanel 슬롯: 유닛이 화면 좌측 절반이면 우측 컬럼(가림 회피, 원작 §7-A).
 * 앵커 없음/뷰포트 0(미측정) = 좌측.
 */
export function unitPanelSide(anchor: Pick<MenuAnchor, "x"> | null, viewportWidth: number): "left" | "right" {
  return anchor != null && viewportWidth > 0 && anchor.x < viewportWidth / 2 ? "right" : "left";
}
