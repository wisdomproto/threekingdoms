/**
 * 경로 → BGM 트랙 선택(순수 — node 테스트 대상). AudioController가 라우트 전환마다 호출.
 *  - /battle: 항상 battle로 시작. battleBoss는 **교전 트리거**(전투 중 적 메인 장수와 첫 접전 시
 *    BattleRenderer가 playBgm("battleBoss") — 2026-07-04 "붙으면 나오게" 전환. bossOf.bossUnitId 판정).
 *    종전 라우트 기반(장 결전 스테이지 진입 시 즉시 보스곡)은 폐기 — 개전부터 보스곡이면 긴장 낭비.
 *  - /scene=씬 드론, /=타이틀, 그 외 막간=메뉴.
 */
import type { BgmTrackId } from "./bgm";

export function bgmForPath(path: string): BgmTrackId {
  if (path.startsWith("/battle")) return "battle";
  if (path.startsWith("/scene")) return "scene";
  if (path === "/") return "title";
  return "menu";
}
