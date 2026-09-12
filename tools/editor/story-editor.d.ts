import type { Json, SceneLine } from "./story-model.js";
export interface LinesOpts { narration: boolean; withBg: boolean; commit: () => void }
export function h(tag: string, cls?: string | null, text?: string | null): HTMLElement;
export function btn(text: string, title?: string | null, onclick?: (ev: MouseEvent) => void): HTMLButtonElement;
export function setOrDel(obj: Record<string, unknown>, key: string, v: unknown): void;
export function datalist(el: HTMLElement, id: string, values: string[]): HTMLDataListElement;
export function moveBtns(arr: unknown[], i: number, after: () => void): HTMLElement;
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
