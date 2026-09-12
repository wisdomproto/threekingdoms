export type Json = Record<string, unknown>;
export interface StageDiff { key: string; kind: "added" | "removed" | "changed" | "count" | "lines"; before?: unknown; after?: unknown }
export function diffStage(before: Json | null | undefined, after: Json | null | undefined): StageDiff[];
export interface ChecklistItem { id: "required" | "victory" | "assets" | "full"; label: string; status: "ok" | "warn" | "error"; detail: string }
export function checklist(p: { localErrors: string[]; hasVictory: boolean; hasFail: boolean; missingAssets: string[] }): { items: ChecklistItem[]; canPublish: boolean };
