export function isEditorPath(path: string): boolean {
  return /^\/(studio|motion-editor|battle-motion-preview|lab|playtest|_draft)(\/|$)/.test(path)
    || path.startsWith("/api/drafts/") || path.startsWith("/api/studio/") || path === "/api/scene-motions";
}

export const STUDIO_COOKIE = "tk-studio-session";
export const STUDIO_SESSION_SECONDS = 8 * 60 * 60;

export function studioDestination(value: string | null): string {
  return value && /^\/studio(?:[/?]|$)/.test(value) && !value.includes("\\") ? value : "/studio";
}

async function sessionKey(password: string) {
  return crypto.subtle.importKey("raw", new TextEncoder().encode(password), { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
}

export async function createStudioSession(password: string, now = Date.now()): Promise<string> {
  if (!password) throw new Error("Studio password is not configured");
  const expiry = String(now + STUDIO_SESSION_SECONDS * 1000);
  const signature = await crypto.subtle.sign("HMAC", await sessionKey(password), new TextEncoder().encode(`studio:${expiry}`));
  return `${expiry}.${Array.from(new Uint8Array(signature), b => b.toString(16).padStart(2, "0")).join("")}`;
}

export async function validStudioSession(token: string | undefined, password: string, now = Date.now()): Promise<boolean> {
  if (!password || !token) return false;
  const match = /^(\d+)\.([a-f0-9]{64})$/.exec(token);
  if (!match || Number(match[1]) <= now || Number(match[1]) > now + STUDIO_SESSION_SECONDS * 1000) return false;
  const signature = Uint8Array.from(match[2]!.match(/../g)!, b => parseInt(b, 16));
  return crypto.subtle.verify("HMAC", await sessionKey(password), signature, new TextEncoder().encode(`studio:${match[1]}`));
}

export async function validStudioCredentials(header: string | null, username: string, password: string): Promise<boolean> {
  if (!password || !header?.startsWith("Basic ")) return false;
  try {
    const supplied = Uint8Array.from(atob(header.slice(6)), c => c.charCodeAt(0));
    const expected = new TextEncoder().encode(`${username}:${password}`);
    const [a, b] = await Promise.all([
      crypto.subtle.digest("SHA-256", supplied), crypto.subtle.digest("SHA-256", expected),
    ]);
    const left = new Uint8Array(a), right = new Uint8Array(b);
    let difference = 0;
    for (let i = 0; i < left.length; i++) difference |= left[i]! ^ right[i]!;
    return difference === 0;
  } catch { return false; }
}
