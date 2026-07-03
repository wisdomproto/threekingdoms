/**
 * 경로 → BGM 트랙 선택(순수 — node 테스트 대상). AudioController가 라우트 전환마다 호출.
 *  - /battle: 보스 스테이지(각 장 결전 4·9·15·22·27, isBossStage — 전면광고 정책과 SSOT 공유)면
 *    battleBoss, 아니면 battle. 종전엔 battleBoss 트랙이 어디서도 선택되지 않는 고아였다(2026-07-03).
 *  - /scene=씬 드론, /=타이틀, 그 외 막간=메뉴.
 * search = "?stage=ID" 형식의 쿼리 문자열(비어 있으면 일반 전투 취급).
 */
import { isBossStage } from "../meta/interstitialPolicy";
import type { BgmTrackId } from "./bgm";

export function bgmForPath(path: string, search = ""): BgmTrackId {
  if (path.startsWith("/battle")) {
    const stage = new URLSearchParams(search).get("stage");
    return stage && isBossStage(stage) ? "battleBoss" : "battle";
  }
  if (path.startsWith("/scene")) return "scene";
  if (path === "/") return "title";
  return "menu";
}
