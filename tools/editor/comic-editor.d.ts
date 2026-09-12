export type Rect = [number, number, number, number];
export interface Pt { x: number; y: number }
export interface Box { left: number; top: number; width: number; height: number }
export interface ComicLine { speaker?: string; side?: string; portraitId?: string; text: string }
export interface ComicPanel { rect: Rect; lines?: ComicLine[]; fx?: ("shake" | "flash")[]; hold?: number; sfx?: string }
export interface ComicPage { image: string; panels: ComicPanel[]; bgm?: string }
export interface ComicPart { kind: "comic"; pages: ComicPage[] }
export function clampRect(r: ArrayLike<number> | null | undefined): Rect;
export function rectFromDrag(p0: Pt, p1: Pt, box: Box): Rect;
export function newPage(): ComicPage;
export function newComicPart(): ComicPart;
export interface ComicPartCtx { commit: () => void; assetBase?: string }
/** DOM 편집부 — 페이지 카드·썸네일 칸 드래그·칸 인스펙터. el 은 전용 컨테이너(스스로 재렌더). */
export function renderComicPart(el: HTMLElement, part: ComicPart, ctx: ComicPartCtx): void;
