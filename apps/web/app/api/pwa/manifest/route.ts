import { gameManifest, installableGames, type InstallableGame } from "../../../../src/pwa/games";
export function GET(request: Request) {
  const game = new URL(request.url).searchParams.get("game") ?? "";
  if (!Object.hasOwn(installableGames, game)) return new Response("Unknown game", { status: 404 });
  return Response.json(gameManifest(game as InstallableGame), { headers: { "Content-Type": "application/manifest+json", "Cache-Control": "public, max-age=3600" } });
}
