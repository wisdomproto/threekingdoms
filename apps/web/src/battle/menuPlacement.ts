/**
 * 커맨드 메뉴 좌/우 배치 결정 (순수 — node 테스트 대상). 레퍼런스 §174 "맵 가림 회피 좌/우 자동 전환".
 *
 * 원칙: 메뉴는 **공격 대상(적)·이동범위를 가리지 않는 쪽**에 둔다. 선택 유닛 기준 좌/우의 유닛을
 * 세되 *적에 가중치를 둬*(공격하려는 대상을 더 강하게 회피) 적은 쪽을 고른다. 좌우가 같으면
 * (빈 전장 등) 화면 안쪽으로 둔다(유닛이 화면 우측 절반이면 좌측) — 화면 밖/항상-한쪽 쏠림 방지.
 *
 * 종전 구현은 ±3칸 좁은 밴드의 *전체* 유닛 수 비교라 대부분 0=0 동률 → "무조건 우측" + 우측 적을
 * 가리던 버그(길중 지적, 2026-06-22)였다. 이 함수가 그 휴리스틱을 대체한다.
 * 화면-가장자리 클램프/반대편 플립은 ActionMenu.placeMenu가 별도로 처리(이 함수는 *선호* 쪽만).
 */

/** 좌/우 판정에 필요한 유닛의 구조적 부분집합(엔진 Unit가 이 형태를 만족). */
export interface SideUnit {
  id: string;
  x: number;
  y: number;
  side: string;
  retreated?: boolean;
}

export interface MenuSideArgs {
  /** 선택(메뉴 표시) 유닛 id — 자기 자신은 카운트 제외. */
  unitId: string;
  /** 선택 유닛 그리드 좌표. */
  gx: number;
  gy: number;
  /** 선택 유닛 진영(적 판정용). 알 수 없으면 null(모두 동일 가중치). */
  selfSide: string | null;
  /** 전체 유닛(committed). */
  units: readonly SideUnit[];
  /** 선택 유닛의 화면 x(CSS px) — 동률 시 화면-안쪽 판정. */
  screenX: number;
  /** 뷰포트 폭(CSS px). */
  screenWidth: number;
}

/** 세로 관련 범위(행 차이 이내만 좌/우 혼잡도에 반영) — 너무 멀면 가림과 무관. */
const ROW_SPAN = 4;
/** 적(공격 대상) 가중치 — 아군보다 강하게 회피. */
const ENEMY_WEIGHT = 2;
const ALLY_WEIGHT = 1;

/**
 * 메뉴를 유닛 오른쪽에 둘지(true) 왼쪽에 둘지(false) 결정.
 * 적은 쪽 우선 → 동률이면 화면 안쪽.
 */
export function chooseMenuPreferRight(args: MenuSideArgs): boolean {
  const { unitId, gx, gy, selfSide, units, screenX, screenWidth } = args;
  let left = 0;
  let right = 0;
  for (const u of units) {
    if (u.retreated || u.id === unitId) continue;
    if (Math.abs(u.y - gy) > ROW_SPAN) continue;
    const dx = u.x - gx;
    if (dx === 0) continue; // 같은 열은 좌/우 어느 쪽도 아님
    const w = selfSide && u.side !== selfSide ? ENEMY_WEIGHT : ALLY_WEIGHT;
    if (dx > 0) right += w;
    else left += w;
  }
  if (right !== left) return right < left; // 덜 붐비는 쪽
  // 동률 → 화면 안쪽(유닛이 우측 절반이면 좌측 선호). screenWidth 0이면 우측 기본.
  return screenWidth > 0 ? screenX < screenWidth / 2 : true;
}
