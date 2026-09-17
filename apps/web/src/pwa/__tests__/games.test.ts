import { describe, expect, it } from "vitest";
import { gameManifest } from "../games";
describe("game installation identity", () => {
  it("keeps separate identities and launches the selected game", () => {
    const a=gameManifest("samgukji"), b=gameManifest("troia");
    expect(a.id).not.toBe(b.id);
    expect(a.start_url).toBe("/play/samgukji");
    expect(b.start_url).toBe("/play/troia");
    for (const m of [a,b]) {
      expect(m.scope).toBe("/");
      expect(m.display).toBe("standalone");
      expect(m.icons.map(i=>i.sizes)).toEqual(["192x192","512x512"]);
    }
  });
});
