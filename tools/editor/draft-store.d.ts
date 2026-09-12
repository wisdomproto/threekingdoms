export interface SaveStateInput {
  dirty?: boolean; saving?: boolean; lastError?: string | null; conflict?: boolean;
  draftAt?: string | null; publishedAt?: string | null;
}
export function saveState(s?: SaveStateInput): { text: string; cls: "ok" | "warn" | "bad" };

export interface DraftSaveResponse { ok: boolean; revision?: number; savedAt?: string; conflict?: boolean; error?: string }
export interface DraftSaverState {
  dirty: boolean; saving: boolean; lastError: string | null; conflict: boolean;
  revision: number | null; draftAt: string | null;
}
export interface DraftSaver {
  touch(): void;
  flush(): void;
  reset(opts?: { revision?: number | null; draftAt?: string | null }): void;
  state(): DraftSaverState;
}
export function createDraftSaver(opts: {
  /** 호출측이 stageId/stage/map 을 붙여 /draft-save 로 보낸다. 거부(reject)는 오프라인으로 취급. */
  post: (base: { baseRevision: number | null }) => Promise<DraftSaveResponse>;
  debounceMs?: number; retryMs?: number; now?: () => number;
  setTimeout?: (fn: () => void, ms: number) => any; clearTimeout?: (id: any) => void;
  onSaved?: (res: DraftSaveResponse) => void; onState?: (s: DraftSaverState) => void;
}): DraftSaver;
