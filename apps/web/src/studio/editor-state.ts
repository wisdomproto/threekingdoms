import { parseAuthoringProject, serializeAuthoringProject, type ProjectObject } from "@tk/data/authoring-project";
import type { StoredProject } from "./project-store";

export interface EditorState {
  id: string; revision: number; updatedAt: string; baseline: string;
  history: string[]; cursor: number; group?: string; editedAt?: number;
}
export function openEditor(record: StoredProject): EditorState {
  const content = serializeAuthoringProject(record.project);
  return { id: record.id, revision: record.revision, updatedAt: record.updatedAt, baseline: content, history: [content], cursor: 0 };
}
export const editorContent = (state: EditorState) => state.history[state.cursor]!;
export const editorDirty = (state: EditorState) => editorContent(state) !== state.baseline;
export function editProject(state: EditorState, edit: (project: ProjectObject) => void, group?: string, now = Date.now()): EditorState {
  const project = parseAuthoringProject(editorContent(state)); edit(project);
  const content = serializeAuthoringProject(project);
  if (content === editorContent(state)) return state;
  const merge = group && state.group === group && state.editedAt !== undefined && now - state.editedAt < 750 && state.cursor > 0;
  const history = state.history.slice(0, state.cursor + (merge ? 0 : 1));
  history.push(content);
  if (history.length > 80) history.shift();
  return { ...state, history, cursor: history.length - 1, group, editedAt: now };
}
export function travelHistory(state: EditorState, step: number): EditorState {
  return { ...state, cursor: Math.max(0, Math.min(state.history.length - 1, state.cursor + step)), group: undefined };
}
/** An older save ACK advances the baseline without replacing edits made while it was in flight. */
export function acknowledgeSave(state: EditorState, record: StoredProject, sent: string): EditorState {
  if (record.id !== state.id || record.revision <= state.revision) return state;
  return { ...state, revision: record.revision, updatedAt: record.updatedAt, baseline: sent, group: undefined };
}
