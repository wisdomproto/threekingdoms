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
