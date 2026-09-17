import { join } from "node:path";
import { createGameStore } from "../../../src/studio/game-store";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  const version = new URL(request.url).searchParams.get("version") || "active";
  if (version !== "active" && !/^[0-9a-f-]{36}\.[1-9][0-9]*$/.test(version)) return Response.json({ error: "Invalid version" }, { status: 400 });
  try {
    const games = createGameStore(join(process.env.TK_STUDIO_DATA_DIR || join(process.cwd(), "../../.studio"), "game"));
    const snapshot = await games.read(version);
    if (version !== "active" && !snapshot) return Response.json({ error: "저장한 게임 버전을 찾을 수 없습니다." }, { status: 404 });
    return Response.json({ snapshot }, { headers: { "Cache-Control": "no-store" } });
  } catch { return Response.json({ error: "게임 데이터를 불러오지 못했습니다." }, { status: 500 }); }
}
