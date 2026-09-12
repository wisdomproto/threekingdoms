import type { Json, SceneLine } from "./story-model.js";
export interface LinesOpts { narration: boolean; withBg: boolean; commit: () => void }
export function renderLines(el: HTMLElement, lines: SceneLine[], opts: LinesOpts): void;
export interface SceneSlotCtx {
  stage: Json; key: "intro" | "outro" | "outroDefeat"; label?: string;
  bgOptions?: string[]; assetBase?: string; speakers?: string[]; commit: () => void;
}
export function renderSceneSlot(el: HTMLElement, ctx: SceneSlotCtx): void;
export interface DialogueCtx {
  stage: Json; placed?: { id: string; name: string }[]; duels?: { id: string; label: string }[];
  speakers?: string[]; commit: () => void;
}
export function renderDialogueList(el: HTMLElement, ctx: DialogueCtx): void;
