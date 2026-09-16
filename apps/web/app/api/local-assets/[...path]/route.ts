import { readFile } from "node:fs/promises";
import { resolve, sep } from "node:path";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: { params: Promise<{ path: string[] }> }): Promise<Response> {
  if (process.env.NODE_ENV !== "development") return new Response(null, { status: 404 });
  const { path } = await context.params;
  if (!(["library", "maps", "objects", "sprites", "fx"].includes(path[0] ?? "") || (path[0] === "audio" && path[1] === "voices") || (path[0] === "ui" && ["portraits", "items"].includes(path[1]??""))) || path.some(part => !part || part === "." || part === ".." || /[\\/]/.test(part))) return new Response(null, { status: 400 });
  const root = resolve(process.cwd(), "public", "assets");
  const file = resolve(root, ...path);
  if (!file.startsWith(root + sep)) return new Response(null, { status: 400 });
  try {
    const data = await readFile(file);
    const ext = file.split(".").at(-1);
    const type = ext === "webm" ? "audio/webm" : ext === "wav" ? "audio/wav" : ext === "ogg" ? "audio/ogg" : ext === "m4a" ? "audio/mp4" : ext === "jpg" || ext === "jpeg" ? "image/jpeg" : ext === "mp3" ? "audio/mpeg" : ext === "webp" ? "image/webp" : ext === "png" ? "image/png" : ext === "json" ? "application/json" : "application/octet-stream";
    return new Response(new Uint8Array(data), { headers: { "Content-Type": type, "Cache-Control": "no-store" } });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") return new Response(null, { status: 500 });
    const cdn = (process.env.NEXT_PUBLIC_ASSET_BASE ?? "").replace(/\/+$/, "");
    return cdn ? Response.redirect(`${cdn}/assets/${path.map(encodeURIComponent).join("/")}`, 307) : new Response(null, { status: 404 });
  }
}
