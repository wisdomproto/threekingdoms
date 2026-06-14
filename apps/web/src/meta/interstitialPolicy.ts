/**
 * 전환 전면광고 "절제형" 노출 정책 (CLAUDE.md §13).
 *
 * 가드레일(§13 불가침선 — 코드로 명시):
 *  - **절제형**: 매 출진마다 광고를 띄우지 않는다. 2~3 스테이지마다 1번 + 보스 전만.
 *  - 거부/스킵해도 진행 무손실(showInterstitial은 항상 void) — 이 정책은 *띄울지 말지*만 결정.
 *  - adFree 판정은 정책 밖(adService가 단락) — 여기선 빈도 규칙만 다룬다.
 *
 * 순수 함수로 분리(node 단위테스트). 입력은 "지금까지 클리어한 스테이지 수"와 대상 스테이지 번호.
 * 별도 mutable 카운터를 두지 않고 clearedStages.length를 진행 척도로 재사용한다
 *  — markCleared가 이미 영속하므로 추가 상태 없이 결정론적.
 */

/** 전면광고 1회당 스테이지 간격(절제형 — N 스테이지마다 1번). §13 "2~3스테이지마다". */
export const INTERSTITIAL_EVERY_N = 3;

/**
 * §5 보스/장 피날레 스테이지 번호. 보스 전은 우선 노출(스토리 카드 번들 = "다음 화 예고").
 * 스테이지 데이터에 boss 플래그가 없어(packages/data Stage 스키마 미보유) 시나리오 번호로 고정.
 *  - 4 장각 토벌(보스전 입문) · 9 반하/동탁 추격 · 15 하비 2차(여포 최후)
 *  - 22 장판/한진 · 27 화용도(클라이맥스). 데이터에 플래그가 생기면 그걸 우선.
 */
export const BOSS_STAGE_NUMBERS: ReadonlySet<number> = new Set([4, 9, 15, 22, 27]);

/** id "05-sishuiguan" → 5. 파싱 실패 시 NaN(보스/간격 판정에서 자연히 제외). */
export function stageNumberOf(stageId: string): number {
  const dash = stageId.indexOf("-");
  const head = dash >= 0 ? stageId.slice(0, dash) : stageId;
  return Number.parseInt(head, 10);
}

/** 대상 스테이지가 보스 전인가(번호 기준). */
export function isBossStage(stageId: string): boolean {
  return BOSS_STAGE_NUMBERS.has(stageNumberOf(stageId));
}

/**
 * 이번 출진에 전면광고를 끼울지(절제형). 순수 — 부수효과/adFree 판정 없음(adService가 단락).
 *  - 보스 스테이지면 무조건 노출(스토리 카드 번들 우선).
 *  - 그 외엔 "클리어한 스테이지 수"가 INTERSTITIAL_EVERY_N의 배수일 때만(2~3마다 1번).
 *    cleared=0(첫 출진)은 0 % N === 0 이지만 첫 진입은 광고 없이 매끄럽게 보내려고 제외.
 *
 * @param clearedCount 지금까지 클리어한 스테이지 수(metaStore.clearedStages.length).
 * @param stageId       이번에 출진할 스테이지 id.
 */
export function shouldShowInterstitial(clearedCount: number, stageId: string): boolean {
  if (isBossStage(stageId)) return true;
  if (clearedCount <= 0) return false; // 첫 출진은 인터럽트 없이
  return clearedCount % INTERSTITIAL_EVERY_N === 0;
}
