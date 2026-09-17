import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";

describe("early install prompt capture", () => {
  it("retains an install request before the button mounts and clears it after installation", () => {
    const target = new EventTarget() as EventTarget & { __gameInstallPrompt?: Event | null };
    runInNewContext(readFileSync(new URL("../../../public/install-prompt.js", import.meta.url), "utf8"), { window: target, Event });
    const prompt = new Event("beforeinstallprompt", { cancelable: true });
    target.dispatchEvent(prompt);
    expect(prompt.defaultPrevented).toBe(true);
    expect(target.__gameInstallPrompt).toBe(prompt);
    target.dispatchEvent(new Event("appinstalled"));
    expect(target.__gameInstallPrompt).toBeNull();
  });
});
