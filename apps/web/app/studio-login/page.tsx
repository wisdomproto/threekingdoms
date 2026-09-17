import Link from "next/link";
import { studioDestination } from "../../src/studio/hosting-auth";

export default async function StudioLogin({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const params = await searchParams;
  return <main style={{ minHeight: "100svh", display: "grid", placeItems: "center", padding: 20, boxSizing: "border-box", background: "#14120e", color: "#ead8b2", fontFamily: "sans-serif" }}>
    <form action="/api/studio-login" method="post" style={{ width: "100%", maxWidth: 360, display: "grid", gap: 18 }}>
      <h1 style={{ margin: 0, fontSize: 26 }}>스튜디오 입장</h1>
      <p style={{ margin: 0, color: "#bcad92", lineHeight: 1.6 }}>저작도구 비밀번호를 입력해 주세요.</p>
      <input type="hidden" name="next" value={studioDestination(params.next ?? null)} />
      <label htmlFor="studio-password">비밀번호</label>
      <input id="studio-password" name="password" type="password" inputMode="numeric" autoComplete="current-password" required autoFocus
        style={{ boxSizing: "border-box", width: "100%", minHeight: 52, padding: "12px 16px", fontSize: 20, background: "#242018", color: "#fff", border: "1px solid #92764a", borderRadius: 8 }} />
      {params.error && <p role="alert" style={{ margin: 0, color: "#ffb4a5" }}>비밀번호가 맞지 않습니다. 다시 입력해 주세요.</p>}
      <button type="submit" style={{ minHeight: 52, fontSize: 17, fontWeight: 700, background: "#d8b978", color: "#251b0f", border: 0, borderRadius: 8, cursor: "pointer" }}>스튜디오 들어가기</button>
      <Link href="/" style={{ color: "#bcad92", textAlign: "center", padding: 12 }}>메인으로 돌아가기</Link>
    </form>
  </main>;
}
