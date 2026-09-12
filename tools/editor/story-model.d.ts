export interface DialogueTrigger { kind: string; n?: number; unitId?: string; duelId?: string; result?: string }
export interface SceneLine { speaker?: string; side?: string; portraitId?: string; text: string; bg?: string }
export interface VnPart { bg?: string; lines: SceneLine[] }
export type Json = Record<string, unknown>;
export function describeTrigger(trigger: DialogueTrigger, nameOf?: (id: string) => string, duelLabel?: (id: string) => string): string;
export function newDialogueId(existing: Iterable<string>): string;
export function newSceneLine(speaker?: string): SceneLine;
export function newVnPart(): VnPart;
export function slotParts<T = Json>(slot: T | T[] | undefined | null): T[];
export function isMapScene(part: unknown): boolean;
export function sceneCount(stage: Json): number;
export function collectSceneBgs(stages: Json[]): string[];
