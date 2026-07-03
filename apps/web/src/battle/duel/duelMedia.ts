/**
 * 일기토 연출 미디어 해석(순수 — node 테스트 대상). §9 드롭인 사다리:
 *   Tier 2 영상  /assets/duels/{pair}.webm  (Seedance — 있으면 최우선)
 *   Tier 1 키비주얼 /assets/duels/{pair}.webp (Gemini 격돌 일러스트 — I2V 시드 키프레임 겸용)
 *   Tier 0 폴백   수묵 그라디언트(컷인 자체 배경)
 * pair 키는 duel 이벤트의 고정 (attackerId, defenderId) 방향 그대로 — 같은 대결이 여러
 * 스테이지에 나와도(조운vs허저 ×2 등) 파일 1장을 공유한다.
 */
import type { DialogueLine, StageDialogue } from "@tk/data";

/** 대결 미디어 파일 키 — `{attackerId}_{defenderId}` (한글 id 그대로, 초상 파일 규약과 동일). */
export function duelPairKey(attackerId: string, defenderId: string): string {
  return `${attackerId}_${defenderId}`;
}

export function duelImagePath(attackerId: string, defenderId: string): string {
  return `/assets/duels/${duelPairKey(attackerId, defenderId)}.webp`;
}

export function duelVideoPath(attackerId: string, defenderId: string): string {
  return `/assets/duels/${duelPairKey(attackerId, defenderId)}.webm`;
}

/**
 * 이 일기토(duelId)의 banter 대사 추출 — 컷인이 직접 재생한다(§9 "대사 먼저 → 합 → 승부").
 * ⚠️ 컷인이 재생하는 대신 DialogueOverlay 쪽에서는 duelOccurred 대사를 걸러야 이중 재생이 없다
 * (BattleScreen이 filter — 이 함수와 짝 계약).
 */
export function duelBanter(
  dialogue: readonly StageDialogue[] | undefined,
  duelId: string,
): DialogueLine[] {
  if (!dialogue) return [];
  const out: DialogueLine[] = [];
  for (const d of dialogue) {
    if (d.trigger.kind === "duelOccurred" && d.trigger.duelId === duelId) out.push(...d.lines);
  }
  return out;
}
