import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { studioEnabled } from "../../../../src/studio/hosting";
export const dynamic = "force-dynamic";
export async function GET(_request: Request, context: { params: Promise<{ file: string }> }) {
  if (!studioEnabled()) return new Response(null, { status: 404 });
  const { file } = await context.params;
  if (!/^[0-9a-f-]{36}\.json$/.test(file)) return new Response(null, { status: 400 });
  const directory = process.env.TK_STUDIO_DATA_DIR ? join(process.env.TK_STUDIO_DATA_DIR, "drafts") : join(process.cwd(), "public/_draft");
  try { return new Response(await readFile(join(directory, file), "utf8"), { headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } }); }
  catch { return new Response(null, { status: 404 }); }
}
