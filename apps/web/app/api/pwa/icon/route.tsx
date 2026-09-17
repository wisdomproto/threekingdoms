import { ImageResponse } from "next/og";
import { installableGames, type InstallableGame } from "../../../../src/pwa/games";
export function GET(request: Request) {
  const query = new URL(request.url).searchParams;
  const game = query.get("game") ?? "";
  if (!Object.hasOwn(installableGames, game)) return new Response("Unknown game", { status: 404 });
  const size = query.get("size") === "192" ? 192 : 512;
  const entry = installableGames[game as InstallableGame];
  return new ImageResponse(<div style={{ display:"flex", width:"100%", height:"100%", background:entry.color, alignItems:"center", justifyContent:"center" }}><div style={{ display:"flex", width:"64%", height:"64%", border:`${size/80}px solid #d8b76f`, alignItems:"center", justifyContent:"center", color:"#e9ce92", fontSize:size*.4, fontWeight:700 }}>{game === "samgukji" ? "III" : "T"}</div></div>, { width:size, height:size });
}
