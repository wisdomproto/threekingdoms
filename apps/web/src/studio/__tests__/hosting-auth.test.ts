import { afterEach, describe, expect, it, vi } from "vitest";
import { isEditorPath, validStudioCredentials } from "../hosting-auth";
import { studioEnabled } from "../hosting";

afterEach(() => vi.unstubAllEnvs());
describe("hosted Studio access", () => {
  it("keeps game and assets public but protects editors and draft APIs", () => {
    for (const path of ["/studio", "/studio/assets", "/api/studio/projects", "/api/drafts/a.json", "/_draft/a.json", "/motion-editor", "/playtest"]) expect(isEditorPath(path)).toBe(true);
    for (const path of ["/", "/battle", "/api/game", "/api/health", "/api/local-assets/maps/a.webp"]) expect(isEditorPath(path)).toBe(false);
  });
  it("fails closed in production without explicit enablement and a password", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("TK_STUDIO_ENABLED", "1");
    vi.stubEnv("TK_STUDIO_PASSWORD", "");
    expect(studioEnabled()).toBe(false);
    vi.stubEnv("TK_STUDIO_PASSWORD", "test-secret");
    expect(studioEnabled()).toBe(true);
    vi.stubEnv("TK_STUDIO_ENABLED", "0");
    expect(studioEnabled()).toBe(false);
  });
  it("accepts only matching credentials and rejects malformed headers", async () => {
    const header = "Basic " + btoa("admin:test-secret");
    expect(await validStudioCredentials(header, "admin", "test-secret")).toBe(true);
    for (const bad of [null, "Bearer abc", "Basic %%%", "Basic " + btoa("admin:wrong")]) expect(await validStudioCredentials(bad, "admin", "test-secret")).toBe(false);
    expect(await validStudioCredentials(header, "admin", "")).toBe(false);
  });
});
