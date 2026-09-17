import { NextRequest, NextResponse } from "next/server";
import { createStudioSession, STUDIO_COOKIE, STUDIO_SESSION_SECONDS, studioDestination, validStudioCredentials } from "../../../src/studio/hosting-auth";
import { studioEnabled } from "../../../src/studio/hosting";

const attempts = new Map<string, { count: number; until: number }>();

export async function POST(request: NextRequest) {
  if (!studioEnabled() || !process.env.TK_STUDIO_PASSWORD) return new NextResponse("Studio is not configured", { status: 503 });
  // Reject cross-site login submissions; never accept a client-provided redirect origin.
  const origin = request.headers.get("origin");
  if (!origin || new URL(origin).host !== request.headers.get("host")) return new NextResponse("Forbidden", { status: 403 });
  const now = Date.now();
  for (const [key, value] of attempts) if (value.until <= now) attempts.delete(key);
  const client = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  const attempt = attempts.get(client) ?? { count: 0, until: now + 60_000 };
  if (attempt.count >= 5 || attempts.size >= 10_000) return new NextResponse("입력 횟수가 많습니다. 1분 후 다시 시도해 주세요.", { status: 429, headers: { "Retry-After": "60", "Cache-Control": "no-store" } });
  attempt.count++;
  attempts.set(client, attempt);
  const form = await request.formData();
  const password = String(form.get("password") ?? "");
  const destination = studioDestination(String(form.get("next") ?? ""));
  const encoded = Buffer.from(`admin:${password}`).toString("base64");
  if (!await validStudioCredentials(`Basic ${encoded}`, "admin", process.env.TK_STUDIO_PASSWORD)) {
    const failed = new URL("/studio-login", origin);
    failed.searchParams.set("error", "1");
    failed.searchParams.set("next", destination);
    return NextResponse.redirect(failed, 303);
  }
  const response = NextResponse.redirect(new URL(destination, origin), 303);
  attempts.delete(client);
  response.headers.set("Cache-Control", "no-store");
  response.cookies.set(STUDIO_COOKIE, await createStudioSession(process.env.TK_STUDIO_PASSWORD), {
    httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: STUDIO_SESSION_SECONDS,
  });
  return response;
}
