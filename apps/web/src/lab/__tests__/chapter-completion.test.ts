import { afterEach, describe, expect, it, vi } from "vitest";
import { completeSandbox, leaveSandbox, writeLab, type LabPayload } from "../lab";
afterEach(() => vi.unstubAllGlobals());
describe("chapter completion boundary", () => {
  it("reports victory and cancellation separately without navigating or closing the parent", () => {
    const postMessage = vi.fn(), navigate = vi.fn(), close = vi.fn();
    vi.stubGlobal("window", { parent: { postMessage }, location: { origin: "http://localhost:3000" }, close });
    const payload = { chapterRun: { runId: "run", nodeId: "battle", visit: 2 }, returnUrl: "/studio?project=p" } as LabPayload;
    completeSandbox(navigate, "victory", payload);
    expect(postMessage).toHaveBeenLastCalledWith({ type: "tk-chapter:result", runId: "run", nodeId: "battle", visit: 2, result: "victory" }, "http://localhost:3000");
    leaveSandbox(navigate, payload);
    expect(postMessage.mock.calls[1]![0].result).toBe("cancelled");
    expect(navigate).not.toHaveBeenCalled(); expect(close).not.toHaveBeenCalled();
  });
  it("reports a storage failure so playtest landing can stop before loading stale battle data", () => {
    vi.stubGlobal("window", { sessionStorage: { setItem: () => { throw new Error("quota"); } } });
    expect(writeLab({} as LabPayload)).toBe(false);
  });
});
