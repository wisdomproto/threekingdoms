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
  조운:   "zhaoyun",
  제갈량: "zhugeliang",
  여포:   "lvbu",
  화웅:   "huaxiong",
  장료:   "zhangliao",
  동탁:   "dongzhuo",
  조조:   "caocao",
  하후돈: "xiahoudun",
  // 그 외 무명·조연 장수(간옹·미축·손건·미방·진등·관평·유봉·주창 등)는 개별 SD 없이
  // classId+side 병종 제네릭으로 폴백(§4 양산형). 비중 생기면 여기 매핑 + 포즈시트 추가.
  // 유비는 군주(lord) 병종이지만 전용 SD 스프라이트가 있으므로 commanderId 직매핑으로 처리.
};

/**
 * lord(군주/전차) 병종 — 전용 SD 에셋 아직 없음.
 * 네임드 군주(유비)는 COMMANDER_SPRITE_MAP에서 잡히고, 그 외 익명 군주 유닛은
 * 아래 CLASS_SIDE_SPRITE_MAP에 lord 키가 없으므로 resolveSpriteId가 null을 반환 →
 * TextureResolver의 진영색 베이스(player=파랑/ally=주황/enemy=빨강 라운드 사각)로 폴백.
 * "깨지지 않게"의 요구는 색 사각형 폴백으로 충족된다(존재하지 않는 spriteId 매핑 금지 —
 * 그럴 경우 getSprite가 매번 빈 텍스처를 찾다 null로 떨어져 동일 결과지만 의도가 불명확해짐).
 * → 전용 lord 스프라이트가 생기면 여기 'lord_player'/'lord_enemy'를 추가한다.
 */

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
