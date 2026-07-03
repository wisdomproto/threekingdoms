/**
 * 편성 화면 공용 토큰/헬퍼 — Formation(카드 그리드)·CommanderDetail(상세)·SortieBar(하단)가 공유.
 * 톤 = 양피지 캔버스 + 먹빛 패널 + 청동 금장(전투 HUD frames.ts 계열과 정합).
 */
import { gameData } from "@tk/data";
import type { RosterUnit } from "../metaStore";

// ── 팔레트 ────────────────────────────────────────────────────────────────
export const PARCHMENT      = "#ede4cc";
export const PARCHMENT_WARM = "#f5edd8";
export const PARCHMENT_DARK = "#d4c4a0";
export const INK            = "#171208";
export const INK_PANEL      = "rgba(20, 15, 8, 0.94)";
export const WOOD           = "#1e1408";
export const GOLD           = "#c8a440";
export const GOLD_BRIGHT    = "#e0b840";
export const GOLD_DIM       = "#8a6a28";
export const GOLD_GLOW      = "rgba(200,164,64,0.22)";
export const DARK_TEXT      = "#1a1008";
export const MUTED_TEXT     = "#5a4a30";
export const DIM_TEXT       = "#8a7850";
export const SEAL_RED       = "#8a2a1e";

/** 수묵/청동 서체 — 전투 HUD·ScenePlayer와 동일 스택(frames.ts HUD_FONT과 동치) */
export const SERIF = '"Noto Serif KR", "Nanum Myeongjo", "Apple SD Gothic Neo", serif';

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
