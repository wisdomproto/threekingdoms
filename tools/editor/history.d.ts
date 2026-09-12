export interface History {
  push(snapshot: string, opts?: { coalesce?: boolean }): boolean;
  undo(): string | null; redo(): string | null;
  canUndo(): boolean; canRedo(): boolean;
  current(): string | null;
  reset(snapshot: string): void; markSaved(): void; isDirty(): boolean;
}
export function createHistory(opts?: { limit?: number; coalesceMs?: number; now?: () => number }): History;
