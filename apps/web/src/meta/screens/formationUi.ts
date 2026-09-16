/**
 * 편성 화면 공용 토큰/헬퍼 — Formation(카드 그리드)·CommanderDetail(상세)·SortieBar(하단)가 공유.
 * 톤 = 양피지 캔버스 + 먹빛 패널 + 청동 금장(전투 HUD frames.ts 계열과 정합).
 */
import { gameData } from "../../game/data";
import type { RosterUnit } from "../metaStore";

// ── 팔레트 ────────────────────────────────────────────────────────────────
export const PARCHMENT      = "#eee2bd";
export const PARCHMENT_WARM = "#f2f5f7";
export const PARCHMENT_DARK = "#b9c4ce";
export const INK            = "#10161c";
export const INK_PANEL      = "#211b10";
export const WOOD           = "#202b35";
export const GOLD           = "#ac8c48";
export const GOLD_BRIGHT    = "#dfc47a";
export const GOLD_DIM       = "#78613b";
export const GOLD_GLOW      = "rgba(188,163,115,0.12)";
export const DARK_TEXT      = "#1a1008";
export const MUTED_TEXT     = "#c2af83";
export const DIM_TEXT       = "#b7a47c";
export const SEAL_RED       = "#8a2a1e";

/** 수묵/청동 서체 — 전투 HUD·ScenePlayer와 동일 스택(frames.ts HUD_FONT과 동치) */
export const SERIF = '"Pretendard", "Apple SD Gothic Neo", system-ui, sans-serif';

// ── 역할(rosters.role) 표기 ───────────────────────────────────────────────
export const ROLE_LABEL: Record<string, string> = {
  lord: "군주", melee: "전위", caster: "책사", support: "보조", guest: "객장",
};
export const ROLE_COLOR: Record<string, string> = {
  lord: "#b87820", melee: "#8a2020", caster: "#2850a0", support: "#1a7040", guest: "#5a5868",
};
export const ROLE_ICON: Record<string, string> = {
  lord: "王", melee: "兵", caster: "謀", support: "輔", guest: "客",
};

export function commanderName(id: string): string {
  return gameData.commanders[id]?.name ?? id;
}
export function className(classId: string): string {
  return gameData.unitClasses[classId]?.name ?? classId;
}
export function roleOf(u: RosterUnit | undefined): string {
  return u?.role ?? "melee";
}
