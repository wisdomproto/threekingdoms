/**
 * 스테이지 보스(적 메인 장수) 판정(순수 — node 테스트 대상).
 * 용도: 보스 BGM 교전 트리거(2026-07-04 "적 메인 장수랑 한번이라도 붙으면 보스 음악") 등 표현 레이어.
 *  ① objectives의 defeatUnit 대상(16개 스테이지 — 설계상 명시 보스)
 *  ② 없으면 적(enemy) 중 최고 레벨 장수(동률=배치 순 첫 번째 — 결정론)
 * 적이 없으면 null. ⚠️ 전면광고의 보스 스테이지(BOSS_STAGE_NUMBERS·장 결전)와는 별개 축 —
 * 이건 "이 전투의 메인 적장"이고, 그건 "챕터 클라이맥스 스테이지"다.
 */
import type { Stage } from "@tk/data";

export function bossUnitId(stage: Stage): string | null {
  for (const o of stage.objectives ?? []) {
    if (o.kind === "defeatUnit") return o.unitId;
  }
  let best: { id: string; level: number } | null = null;
  for (const u of stage.units) {
    if (u.side !== "enemy") continue;
    if (!best || u.level > best.level) best = { id: u.commanderId, level: u.level };
  }
  return best?.id ?? null;
}
