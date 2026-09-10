import { promises as fs } from "node:fs";
import path from "node:path";
import { validateLibrary } from "../../../src/scene/motions";
export async function POST(request: Request): Promise<Response> {
  if (process.env.NODE_ENV !== "development") return new Response("Not found", { status: 404 });
  const origin = request.headers.get("origin");
  if (!origin || new URL(origin).host !== request.headers.get("host")) return new Response("Forbidden", { status: 403 });
  try {
    const body = await request.text();
    if (body.length > 12_000_000) return new Response("파일이 너무 큽니다", { status: 413 });
    const value: unknown = JSON.parse(body);
    if (!validateLibrary(value)) return new Response("동작 데이터 형식이 잘못되었습니다", { status: 400 });
    const dest = path.join(process.cwd(), "public/assets/scene-motions/library.json");
    await fs.mkdir(path.dirname(dest), { recursive: true });
    await fs.writeFile(`${dest}.tmp`, JSON.stringify(value, null, 2) + "\n");
    await fs.rename(`${dest}.tmp`, dest);
    return Response.json({ ok: true });
  } catch { return new Response("동작 저장 실패", { status: 400 }); }
}
