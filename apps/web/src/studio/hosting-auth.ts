export function isEditorPath(path: string): boolean {
  return /^\/(studio|motion-editor|battle-motion-preview|lab|playtest|_draft)(\/|$)/.test(path)
    || path.startsWith("/api/drafts/") || path.startsWith("/api/studio/") || path === "/api/scene-motions";
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
