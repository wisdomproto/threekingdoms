export interface Chapter { chapter: number; title: string; from: number; to: number }
export const CHAPTERS: Chapter[];
export function stageNumber(id: string): number;
export function chapterOf(id: string): number;
export function chapterTitle(id: string): string;
