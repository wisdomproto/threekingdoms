"use client";
/**
 * ActionMenu (설계 §2.3, §5 / 레퍼런스 §9·§10·§174·§263) —
 * **유닛 옆에 뜨는 세로 리스트** 커맨드 메뉴. 레퍼런스 충실 복제:
 *   "유닛 이동 후 옆에 뜨는 세로 리스트(돌/회색 버튼), 8항목 고정
 *    (공격/책략/도구/교환/협공/필살/대기/취소), 조건 미충족 회색 dim".
 *
 * 하단 풀폭 바(구버전)를 폐기하고, 활성 유닛의 스크린 좌표(store.menuAnchor — 렌더러가
 * 매 틱 push)에 absolute로 따라붙는다. 카메라 팬/줌·프리뷰 워크에 추종(§263).
 *
 * 좌/우 자동 전환(§174 "맵 가림 회피 위해 좌/우 위치 자동 전환"):
 *   기본은 유닛 오른쪽. 메뉴가 화면 우측을 벗어나면 왼쪽으로 뒤집고,
 *   세로로 화면 위/아래를 벗어나면 클램프한다 — 유닛/화면 밖으로 나가지 않게.
 *
 * 차별화 백로그(CLAUDE.md §7): 교환·협공·필살은 우리 v1 미구현 →
 *   레이아웃 충실성을 위해 **자리만 두되 항상 dim(비활성)**으로 표시한다.
 *
 * 표적 조준(targetSelect/strategyTarget/itemTarget)·하위 메뉴(strategyMenu/itemMenu)도
 * 같은 앵커에 세로로 뜬다. menuAnchor 미수신(헤드리스/마운트 전)이면 렌더 생략.
 */
import { gameData } from "@tk/data";
import type { CSSProperties } from "react";
import type { InputState, UiEvent } from "../inputMachine";
import type { MenuAnchor } from "../store";

/**
 * 메뉴 패널 폭(px, box-sizing:border-box — 패딩 포함). 한글 2~3자 + 내부 패딩.
 * 레퍼런스 §9 "돌/회색 버튼" = 불투명 패널 → 맵/유닛이 비치지 않게 한 장으로 묶는다.
 */
export const MENU_WIDTH = 96;
/** 버튼 높이(px) — 촘촘한 세로 리스트(border-image 프레임 제거로 비대화 해소) */
const BUTTON_H = 34;
/** 버튼 간 간격(px) — 패널 배경이 채우므로 맵이 비치지 않음 */
const GAP = 3;
/** 패널 내부 패딩(px) — 버튼과 청동 테두리 사이 */
const PANEL_PAD = 6;
/** 유닛 셀과 메뉴 사이 여백(px) — 셀 반폭에 더해 메뉴를 셀 밖으로 민다 */
const SIDE_PAD = 10;
/** 화면 가장자리 안전 여백(px) */
const EDGE = 8;

/** 항목 수 → 패널 전체 높이(px). placeMenu 세로 클램프·테스트가 공유 */
export function menuPanelHeight(itemCount: number): number {
  return itemCount * BUTTON_H + (itemCount - 1) * GAP + 2 * PANEL_PAD;
}

/** 불투명 돌 버튼(플랫) — 청동 얇은 테두리. accent는 텍스트 색으로만 반영 */
const BUTTON_STYLE: CSSProperties = {
  height: BUTTON_H,
  width: "100%",
  padding: "0 6px",
  border: "1px solid rgba(120, 98, 60, 0.5)",
  borderRadius: 4,
  background: "linear-gradient(180deg, rgba(56, 48, 35, 0.98), rgba(34, 29, 20, 0.98))",
  color: "#ece8e0",
  fontSize: 15,
  fontWeight: 700,
  letterSpacing: "0.04em",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  cursor: "pointer",
  touchAction: "manipulation",
  whiteSpace: "nowrap",
};

interface Item {
  key: string;
  label: string;
  accent?: string;
  /** 비활성(회색 dim) — 조건 미충족 또는 미구현(교환/협공/필살) */
  disabled?: boolean;
  /** 미구현 자리표시(교환/협공/필살) — 클릭 시 noop */
  placeholder?: boolean;
  onPress?: () => void;
}

function Btn({ item }: { item: Item }): React.ReactElement {
  const dim = item.disabled || item.placeholder;
  return (
    <button
      type="button"
      onClick={dim ? undefined : item.onPress}
      disabled={dim}
      style={{
        ...BUTTON_STYLE,
        ...(item.accent && !dim ? { color: item.accent } : {}),
        ...(dim ? { opacity: 0.4, cursor: "default" } : {}),
      }}
    >
      {item.label}
    </button>
  );
}

/**
 * 앵커(유닛 셀 중심 스크린좌표) + 항목 수 → 메뉴 컨테이너의 absolute 위치.
 * 좌/우 자동 전환(§174): 기본 우측, 우측 초과 시 좌측. 세로는 화면 안에 클램프.
 * viewport는 BattleScreen 컨테이너 크기(= 캔버스 CSS px). SSR/측정 전엔 합리적 기본값.
 */
export function placeMenu(
  anchor: MenuAnchor,
  itemCount: number,
  viewport: { width: number; height: number },
): { left: number; top: number } {
  const menuH = menuPanelHeight(itemCount);
  const offset = anchor.half + SIDE_PAD; // 셀 중심에서 메뉴 안쪽 변까지

  // 가로: 기본 우측(메뉴 좌변 = center + offset). 우측 초과 시 좌측으로 뒤집기.
  let left = anchor.x + offset;
  if (left + MENU_WIDTH + EDGE > viewport.width) {
    left = anchor.x - offset - MENU_WIDTH; // 좌측: 메뉴 우변 = center - offset
  }
  // 좌측도 화면 밖이면(양쪽 다 좁음) 화면 안으로 클램프
  left = Math.max(EDGE, Math.min(left, viewport.width - MENU_WIDTH - EDGE));

  // 세로: 셀 중심 기준 수직 중앙 정렬 후 화면 안 클램프
  let top = anchor.y - menuH / 2;
  top = Math.max(EDGE, Math.min(top, viewport.height - menuH - EDGE));

  return { left, top };
}

/** 현재 ui 상태에서 보여줄 세로 메뉴 항목 목록 (8항목 고정 레이아웃 or 하위/표적 메뉴) */
function itemsFor(ui: InputState, dispatch: (e: UiEvent) => void): Item[] {
  if (ui.kind === "postMoveMenu") {
    // 레퍼런스 §9: 공격/책략/도구/교환/협공/필살/대기/취소 — 8항목 고정.
    // 교환/협공/필살은 우리 차별화 백로그(CLAUDE.md §7) → 자리만 두고 항상 dim.
    return [
      {
        key: "attack",
        label: "공격",
        accent: "#ff6b6b",
        disabled: ui.attackable.length === 0,
        onPress: () => dispatch({ type: "menuAttack" }),
      },
      {
        key: "strategy",
        label: "책략",
        accent: "#b890ff",
        disabled: ui.strategies.length === 0,
        onPress: () => dispatch({ type: "menuStrategy" }),
      },
      {
        key: "item",
        label: "도구",
        accent: "#7bd88f",
        disabled: ui.items.length === 0,
        onPress: () => dispatch({ type: "menuItem" }),
      },
      // ── 미구현(차별화 백로그) — 자리표시 dim ──
      { key: "trade", label: "교환", placeholder: true }, // 아이템 주고받기
      { key: "assist", label: "협공", placeholder: true }, // 포위 협공
      { key: "ultimate", label: "필살", placeholder: true }, // 네임드 특수기
      // ──────────────────────────────────────
      {
        key: "wait",
        label: "대기",
        accent: "#4da3ff",
        onPress: () => dispatch({ type: "menuWait" }),
      },
      { key: "cancel", label: "취소", onPress: () => dispatch({ type: "menuCancel" }) },
    ];
  }

  if (ui.kind === "strategyMenu") {
    return [
      ...ui.strategies.map((id): Item => {
        const s = gameData.strategies[id];
        return {
          key: id,
          label: `${s?.name ?? id}(MP${s?.mp ?? "?"})`,
          accent: "#b890ff",
          onPress: () => dispatch({ type: "selectStrategy", strategyId: id }),
        };
      }),
      { key: "cancel", label: "취소", onPress: () => dispatch({ type: "menuCancel" }) },
    ];
  }

  if (ui.kind === "itemMenu") {
    return [
      ...ui.items.map((id): Item => {
        const it = gameData.items[id];
        const isHeal = it?.category === "supplyItem";
        return {
          key: id,
          label: `${it?.name ?? id}(${isHeal ? "+" : ""}${it?.power ?? "?"})`,
          accent: isHeal ? "#7bd88f" : "#ff8a5b",
          onPress: () => dispatch({ type: "selectItem", itemId: id }),
        };
      }),
      { key: "cancel", label: "취소", onPress: () => dispatch({ type: "menuCancel" }) },
    ];
  }

  // 표적 조준 — 취소만 (맵 칸 탭으로 대상 지정, 무효 칸 탭은 noop이므로 취소 버튼 필수)
  if (ui.kind === "targetSelect" || ui.kind === "strategyTarget" || ui.kind === "itemTarget") {
    return [{ key: "cancel", label: "취소", onPress: () => dispatch({ type: "cancel" }) }];
  }

  return [];
}

export function ActionMenu({
  ui,
  dispatch,
  anchor,
  viewport,
  previewWalking = false,
}: {
  ui: InputState;
  dispatch: (e: UiEvent) => void;
  /** 활성 유닛 스크린 좌표 (store.menuAnchor) — 렌더러가 매 틱 push. 없으면 미표시 */
  anchor: MenuAnchor | null;
  /** BattleScreen 컨테이너 크기(CSS px) — 좌/우 자동 전환·클램프 기준 */
  viewport: { width: number; height: number };
  /** 프리뷰 워크 진행 중 — true면 메뉴 숨김 (워크 완료 후 표시, 원작 UX §수정명세-1) */
  previewWalking?: boolean;
}): React.ReactElement | null {
  // 프리뷰 워크 중에는 메뉴를 숨긴다 — 유닛이 목적지에 도착한 뒤 표시
  if (previewWalking) return null;
  if (!anchor) return null;

  const items = itemsFor(ui, dispatch);
  if (items.length === 0) return null;

  const { left, top } = placeMenu(anchor, items.length, viewport);

  return (
    <div
      style={{
        position: "absolute",
        left,
        top,
        width: MENU_WIDTH,
        boxSizing: "border-box",
        padding: PANEL_PAD,
        display: "flex",
        flexDirection: "column",
        gap: GAP,
        // 불투명 돌 패널 — 맵/유닛 스프라이트가 버튼 사이로 비치지 않게 한 장으로 묶는다(레퍼런스 §9)
        background: "rgba(16, 13, 9, 0.97)",
        border: "1.5px solid #6f5a34",
        borderRadius: 7,
        boxShadow: "0 4px 14px rgba(0, 0, 0, 0.55)",
        pointerEvents: "auto",
        // 선택을 흐트러뜨리지 않게 — 메뉴 위 텍스트 드래그 선택 방지
        userSelect: "none",
      }}
    >
      {items.map((item) => (
        <Btn key={item.key} item={item} />
      ))}
    </div>
  );
}
