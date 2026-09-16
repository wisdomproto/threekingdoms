"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { parseAuthoringProject, type ProjectObject } from "@tk/data/authoring-project";
import type { StoredProject } from "./project-store";
import { acknowledgeSave, editProject, editorContent, editorDirty, openEditor, travelHistory, type EditorState } from "./editor-state";

export class ApiError extends Error { constructor(public status: number, message: string) { super(message); } }
export async function studioApi<T>(path: string, method = "GET", body?: unknown): Promise<T> {
  const response = await fetch(`/api/studio/${path}`, { method, cache: "no-store", headers: { "Content-Type": "application/json" }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  const value = await response.json();
  if (!response.ok) throw new ApiError(response.status, value.error ?? "요청에 실패했습니다.");
  return value as T;
}
interface Recovery { content: string; revision: number; }
const recoveryKey = (id: string) => `tk.studio.recovery.${id}`;

export function useProjectEditor() {
  const [state, setState] = useState<EditorState | null>(null);
  const [saving, setSaving] = useState(false), [error, setError] = useState("");
  const [recovery, setRecovery] = useState<Recovery | null>(null);
  const [recoveryError, setRecoveryError] = useState("");
  const stateRef = useRef(state); stateRef.current = state;
  const busy = useRef(false);
  const generation = useRef(0);
  const open = useCallback((record: StoredProject) => {
    generation.current++;
    const next = openEditor(record);
    setState(next); stateRef.current = next; setError(""); setRecovery(null); setRecoveryError("");
    try {
      const cached = localStorage.getItem(recoveryKey(record.id));
      if (cached) {
        const candidate = JSON.parse(cached) as Recovery;
        parseAuthoringProject(candidate.content);
        if (candidate.content !== next.baseline && Number.isSafeInteger(candidate.revision)) setRecovery(candidate);
      }
    } catch { setRecoveryError("이 브라우저의 복구본을 읽지 못했습니다."); }
  }, []);
  const save = useCallback(async () => {
    const current = stateRef.current;
    if (!current || busy.current) return false;
    if (!editorDirty(current)) return true;
    busy.current = true; setSaving(true); setError("");
    const token = generation.current, sent = editorContent(current);
    try {
      const record = await studioApi<StoredProject>(`projects/${current.id}`, "PUT", { baseRevision: current.revision, project: parseAuthoringProject(sent) });
      if (token === generation.current) setState((latest) => latest ? acknowledgeSave(latest, record, sent) : latest);
      return token === generation.current;
    } catch (e) {
      if (token === generation.current) setError(e instanceof Error ? e.message : "저장에 실패했습니다.");
      return false;
    } finally { busy.current = false; setSaving(false); }
  }, []);
  const dirty = !!state && editorDirty(state);
  useEffect(() => {
    if (!state || recovery) return;
    try {
      if (dirty) localStorage.setItem(recoveryKey(state.id), JSON.stringify({ content: editorContent(state), revision: state.revision }));
      else localStorage.removeItem(recoveryKey(state.id));
      setRecoveryError("");
    } catch { setRecoveryError("브라우저 복구 공간이 부족합니다. 서버 저장 또는 파일 내보내기를 사용해 주세요."); }
  }, [state, dirty, recovery]);
  useEffect(() => {
    if (!dirty || saving || error || recovery) return;
    const timer = setTimeout(() => void save(), 1200);
    return () => clearTimeout(timer);
  }, [state, dirty, saving, error, recovery, save]);
  useEffect(() => {
    const handler = (event: BeforeUnloadEvent) => { if (stateRef.current && editorDirty(stateRef.current)) { event.preventDefault(); event.returnValue = ""; } };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, []);
  const edit = (fn: (project: ProjectObject) => void, group?: string) => setState((s) => s ? editProject(s, fn, group) : s);
  const undo = () => setState((s) => s ? travelHistory(s, -1) : s);
  const redo = () => setState((s) => s ? travelHistory(s, 1) : s);
  const restore = () => {
    if (!recovery) return;
    setState((s) => s ? { ...s, history: [s.baseline, recovery.content], cursor: 1, revision: recovery.revision } : s);
    if (state && state.revision !== recovery.revision) setError("복구본 이후 다른 저장이 있습니다. 파일로 내보내거나 최신 저장본을 다시 열어 주세요.");
    setRecovery(null);
  };
  return { state, dirty, saving, error, recovery, recoveryError, open, save, edit, undo, redo, restore, dismissRecovery: () => setRecovery(null) };
}
