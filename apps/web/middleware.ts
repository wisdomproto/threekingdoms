import { NextResponse, type NextRequest } from "next/server";
import { isEditorPath, validStudioCredentials } from "./src/studio/hosting-auth";
import { hostedStudioEnabled } from "./src/studio/hosting";

export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;
  if (process.env.NODE_ENV !== "development" && isEditorPath(path)) {
    if (!hostedStudioEnabled()) return new NextResponse("Not found", { status: 404 });
    if (!await validStudioCredentials(request.headers.get("authorization"), process.env.TK_STUDIO_USER || "admin", process.env.TK_STUDIO_PASSWORD || "")) {
      return new NextResponse("Studio login required", { status: 401, headers: {
        "WWW-Authenticate": 'Basic realm="Project Studio", charset="UTF-8"', "Cache-Control": "no-store",
      } });
    }
  }
  // Separate services can have readable project domains without exposing IDs.
  if (path === "/" && process.env.TK_GAME_ENTRY === "troia") return NextResponse.rewrite(new URL("/troia", request.url));
  return NextResponse.next();
}
export const config = { matcher: ["/", "/studio/:path*", "/motion-editor/:path*", "/battle-motion-preview/:path*", "/lab/:path*", "/playtest/:path*", "/_draft/:path*", "/api/studio/:path*", "/api/drafts/:path*", "/api/scene-motions"] };
