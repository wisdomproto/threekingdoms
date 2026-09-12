export type Json = Record<string, unknown>;
export interface StageDiff { key: string; kind: "added" | "removed" | "changed" | "count" | "lines"; before?: unknown; after?: unknown }
export function diffStage(before: Json | null | undefined, after: Json | null | undefined): StageDiff[];
export interface ChecklistItem { id: "required" | "victory" | "assets" | "full"; label: string; status: "ok" | "warn" | "error"; detail: string }
export function checklist(p: { localErrors: string[]; hasVictory: boolean; hasFail: boolean; missingAssets: string[] }): { items: ChecklistItem[]; canPublish: boolean };
export function probeAssets(stage: Json, base: string): Promise<string[]>;
export function describeDiff(d: StageDiff): string;
export interface PublishResult { ok: boolean; wrote?: string[]; backup?: { stage?: boolean; map?: boolean }; at?: string; rolledBack?: boolean; output?: string; error?: string; restored?: string[] }
export function openPublishModal(p: {
  stage: Json; stageText: string; mapText?: string | null; repoStage: Json | null; localErrors: string[];
  probe: () => Promise<string[]>; onPublished?: (r: PublishResult) => void; onRolledBack?: (r: PublishResult) => void;
}): HTMLElement;
