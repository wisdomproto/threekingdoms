/**
 * actorStage — 디에게틱 스테이지 씬 순수 헬퍼(스펙 v2). 렌더 없음(테스트 가능).
 * 배우 에셋 = /assets/scene-actors/ 전용 키(전투 스프라이트 리졸버와 무관 — 마퀴 손저작).
 */
import type { StageActor, ScenarioLine } from "@tk/data";
import { assetUrl } from "../assetUrl";

/**
 * 배우 이미지 후보 URL — ① 씬 도보 포즈 → ② 초상(portrait 저작 시에만, 한국어 키).
 * 다 소진하면 ActorSprite가 CSS 실루엣 렌더(URL 아님 — 이 배열엔 없음).
 */
export function actorSpriteCandidates(actor: StageActor): string[] {
  const urls = [assetUrl(`/assets/scene-actors/${actor.sprite}.png`)];
  if (actor.portrait) urls.push(assetUrl(`/assets/ui/portraits/${actor.portrait}.webp`));
  return urls;
}

/**
 * idx까지의 등장 배우 id 집합. 규칙(스펙 v2 결정 3):
 * - 선행 스캔: lines 어딘가 enter에 나열된 배우는 첫 enter 전까지 숨김.
 * - enter 미나열 배우는 처음부터 상주.
 * - 이후 idx까지 exit 제거 → enter 추가 누적(같은 줄은 exit 후 enter — 재등장 우선).
 */
export function visibleActorIds(
  lines: readonly ScenarioLine[],
  idx: number,
  actors: readonly StageActor[],
): Set<string> {
  const enterListed = new Set<string>();
  for (const l of lines) l.enter?.forEach((id) => enterListed.add(id));
  const set = new Set(actors.map((a) => a.id).filter((id) => !enterListed.has(id)));
  for (let i = 0; i <= Math.min(idx, lines.length - 1); i++) {
    const l = lines[i];
    if (!l) continue;
    l.exit?.forEach((id) => set.delete(id));
    l.enter?.forEach((id) => set.add(id));
  }
  return set;
}
