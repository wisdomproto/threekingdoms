/**
 * spriteMap — commanderId / classId+side → spriteId 매핑 테이블
 *
 * 우선순위:
 *   1) commanderId 직접 매핑 (관우→guanyu, 유비→liubei, …)
 *   2) classId + side 조합 매핑 (footman+player → footman_player)
 *   3) 매핑 없음 → null (폴백: 기존 색 사각형 유지)
 *
 * 관리 정책: 새 에셋 도착 시 이 테이블에만 추가하면 렌더러에 자동 반영.
 * commanderId는 packages/data/json/stages/*.json의 "commanderId" 값과 1:1.
 */
import type { Side } from "@tk/data";

/** commanderId(원작 한국어) → spriteId(영문 ASCII) */
export const COMMANDER_SPRITE_MAP: Record<string, string> = {
  관우:   "guanyu",
  유비:   "liubei",
  장비:   "zhangfei",
  여포:   "lvbu",
  화웅:   "huaxiong",
  장료:   "zhangliao",
  // 미생성분: 이숙, 호진, 조잠, 간옹, 조운, 제갈량 등 → 폴백(색 사각형)
};

/**
 * classId + "_" + side → spriteId  (템플릿 유닛).
 * 우군(ally) 전용 스프라이트는 아직 없음 — ally는 매핑이 없어 null 폴백(주황 색 사각형)으로 표시된다.
 */
export const CLASS_SIDE_SPRITE_MAP: Record<string, string> = {
  footman_player:       "footman_player",
  archer_player:        "archer_player",
  lightCavalry_player:  "lightCavalry_player",
  footman_enemy:        "footman_enemy",
  archer_enemy:         "archer_enemy",
  lightCavalry_enemy:   "lightCavalry_enemy",
};

/**
 * 유닛의 spriteId를 결정.
 * @returns spriteId 문자열, 또는 폴백(색 사각형) 시 null.
 */
export function resolveSpriteId(
  commanderId: string,
  classId: string,
  side: Side,
): string | null {
  // 1. 네임드 우선
  const named = COMMANDER_SPRITE_MAP[commanderId];
  if (named) return named;

  // 2. 병종+진영 템플릿
  const key = `${classId}_${side}`;
  const template = CLASS_SIDE_SPRITE_MAP[key];
  if (template) return template;

  // 3. 폴백
  return null;
}
