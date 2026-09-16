import { describe, expect, it } from "vitest";
import { acknowledgeSave, editProject, editorContent, editorDirty, openEditor, travelHistory } from "../editor-state";
const record = { id: "p", revision: 1, updatedAt: "now", project: { name: "original", extra: { unknown: null } } };

describe("studio edit history and save acknowledgement", () => {
  it("preserves unknown data through edit, undo and redo", () => {
    const initial = openEditor(record);
    const changed = editProject(initial, (p) => { p.name = "changed"; });
    expect(editorDirty(changed)).toBe(true);
    expect(JSON.parse(editorContent(changed)).extra).toEqual({ unknown: null });
    const undone = travelHistory(changed, -1);
    expect(editorDirty(undone)).toBe(false);
    expect(editorContent(travelHistory(undone, 1))).toBe(editorContent(changed));
    expect(record.project.name).toBe("original");
  });
  it("coalesces typing but creates separate undo steps for different fields", () => {
    let state = openEditor(record);
    state = editProject(state, (p) => { p.name = "a"; }, "name", 1000);
    state = editProject(state, (p) => { p.name = "ab"; }, "name", 1100);
    expect(state.history).toHaveLength(2);
    state = editProject(state, (p) => { p.other = "x"; }, "other", 1200);
    expect(state.history).toHaveLength(3);
    expect(JSON.parse(editorContent(travelHistory(state, -1))).name).toBe("ab");
  });
  it("preserves edits made during an in-flight save", () => {
    let state = editProject(openEditor(record), (p) => { p.name = "sent"; });
    const sent = editorContent(state);
    state = editProject(state, (p) => { p.name = "still typing"; });
    const saved = acknowledgeSave(state, { ...record, revision: 2 }, sent);
    expect(saved.revision).toBe(2);
    expect(JSON.parse(editorContent(saved)).name).toBe("still typing");
    expect(editorDirty(saved)).toBe(true);
  });
  it("ignores stale ACKs and resets the redo branch after editing an undone state", () => {
    const state = editProject(openEditor(record), (p) => { p.name = "first"; });
    expect(acknowledgeSave(state, { ...record, id: "other", revision: 9 }, "{}")).toBe(state);
    expect(acknowledgeSave(state, record, "{}")).toBe(state);
    const next = editProject(travelHistory(state, -1), (p) => { p.name = "second"; });
    expect(JSON.parse(editorContent(travelHistory(next, 1))).name).toBe("second");
  });
});
