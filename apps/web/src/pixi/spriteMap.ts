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

/**
 * commanderId(한국어) → spriteId **override**. 기본 규칙은 "commanderId가 곧 spriteId"라
 * 여기엔 *영문 폴더로 이미 만들어둔 스프라이트*만 매핑한다. 나머지 모든 장수는 commanderId(한국어)를
 * 그대로 spriteId로 써서 `/assets/sprites/{한국어}/`를 찾고, 없으면 병종 제네릭으로 폴백(spriteCandidates).
 * 즉 포즈시트를 만들어 `sprites/{이름}/`에 넣으면 매핑 없이 자동 사용, 없으면 제네릭.
 */
export const COMMANDER_SPRITE_MAP: Record<string, string> = {
  관우: "guanyu",
  유비: "liubei",
  장비: "zhangfei",
  여포: "lvbu",
  화웅: "huaxiong",
  장료: "zhangliao",
  장요: "zhangliao", // 데이터 표기 변형(장요/장료) 동일 스프라이트
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
 * 유닛의 spriteId 후보를 우선순위대로 반환.
 *  ① 캐릭터 전용: COMMANDER_SPRITE_MAP override || commanderId(한국어) — `sprites/{이름}/`이 있으면 사용
 *  ② 병종 제네릭: classId+side — ①이 미로드(이미지 없음)면 폴백
 * UnitView가 순서대로 getSprite를 시도해 첫 로드된 텍스처를 쓴다(있으면 전용, 없으면 제네릭).
 */
export function spriteCandidates(commanderId: string, classId: string, side: Side): string[] {
  const out: string[] = [];
  if (commanderId) out.push(COMMANDER_SPRITE_MAP[commanderId] || commanderId);
  const template = CLASS_SIDE_SPRITE_MAP[`${classId}_${side}`];
  if (template) out.push(template);
  return [...new Set(out)];
}

/**
 * 유닛의 대표 spriteId(첫 후보) — 리그 키 등 단일 값이 필요한 곳용. 후보가 없으면 null.
 * (텍스처 폴백은 spriteCandidates로 UnitView가 처리한다.)
 */
export function resolveSpriteId(
  commanderId: string,
  classId: string,
  side: Side,
): string | null {
  return spriteCandidates(commanderId, classId, side)[0] ?? null;
}
