import { NextResponse, type NextRequest } from "next/server";
import { isEditorPath, validStudioCredentials, validStudioSession, STUDIO_COOKIE } from "./src/studio/hosting-auth";
import { hostedStudioEnabled } from "./src/studio/hosting";

export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;
  if (isEditorPath(path) && (process.env.NODE_ENV !== "development" || process.env.TK_STUDIO_PASSWORD)) {
    if (process.env.NODE_ENV !== "development" && !hostedStudioEnabled()) return new NextResponse("Not found", { status: 404 });
    const password = process.env.TK_STUDIO_PASSWORD || "";
    const authenticated = await validStudioSession(request.cookies.get(STUDIO_COOKIE)?.value, password)
      || await validStudioCredentials(request.headers.get("authorization"), process.env.TK_STUDIO_USER || "admin", password);
    if (!authenticated) {
      if (path.startsWith("/api/") || path.startsWith("/_draft/")) return NextResponse.json({ error: "Studio login required" }, { status: 401, headers: { "Cache-Control": "no-store" } });
      const login = new URL("/studio-login", request.url);
      login.searchParams.set("next", path + request.nextUrl.search);
      return NextResponse.redirect(login);
    }
  }
  // Separate services can have readable project domains without exposing IDs.
  if (path === "/" && process.env.TK_GAME_ENTRY === "troia") return NextResponse.rewrite(new URL("/troia", request.url));
  return NextResponse.next();
}
export const config = { matcher: ["/", "/studio/:path*", "/motion-editor/:path*", "/battle-motion-preview/:path*", "/lab/:path*", "/playtest/:path*", "/_draft/:path*", "/api/studio/:path*", "/api/drafts/:path*", "/api/scene-motions"] };
