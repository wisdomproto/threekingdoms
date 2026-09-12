"use client";
/**
 * /playtest?draft={draftId} — 에디터 플레이테스트 착륙 페이지 (spec 2026-09-12-editor-playtest-design §5-4·§7).
 * 같은 origin 의 /_draft/{draftId}.json(serve.py 가 쓴 불변 스냅샷)을 읽어 검증하고, 기존 실험실 경로
 * (writeLab → /battle?stage=__lab)로 넘긴다. 실패하면 메시지 + 「닫기」(에디터 탭 복귀).
 */
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { writeLab, leaveSandbox, LAB_STAGE_ID } from "./lab";
import { parsePlaytestSnapshot } from "./playtest";

export default function PlaytestLanding(): React.ReactElement {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [returnUrl, setReturnUrl] = useState<string | undefined>(undefined);

  useEffect(() => {
    let alive = true;
    const draftId = new URLSearchParams(window.location.search).get("draft");
    if (!draftId) { setMessage("draft 파라미터가 없습니다 — 에디터에서 ▶ 테스트를 누르세요"); return; }
    (async () => {
      try {
        const res = await fetch(`/_draft/${encodeURIComponent(draftId)}.json`, { cache: "no-store" });
        if (!res.ok) { if (alive) setMessage("드래프트가 없습니다 — 에디터에서 ▶ 테스트를 다시 누르세요"); return; }
        const json: unknown = await res.json();
        const ru = json && typeof json === "object" ? (json as { returnUrl?: unknown }).returnUrl : undefined;
        if (alive && typeof ru === "string") setReturnUrl(ru);
        const parsed = parsePlaytestSnapshot(json);
        if (!parsed.ok) { if (alive) setMessage(parsed.message); return; }
        if (!alive) return;
        writeLab(parsed.payload);
        router.replace(`/battle?stage=${LAB_STAGE_ID}`);
      } catch (e) {
        if (alive) setMessage(`드래프트를 읽지 못했습니다: ${String(e)}`);
      }
    })();
    return () => { alive = false; };
  }, [router]);

  const close = (): void => {
    if (returnUrl) { leaveSandbox((to) => router.push(to), { returnUrl }); return; }
    // returnUrl 없는 실패 경로: 착륙 페이지가 직접 닫는다(/lab 으로 보내지 않음)
    window.close();
    window.setTimeout(() => { if (!window.closed) setMessage((m) => (m && m.endsWith("이 탭을 직접 닫아주세요") ? m : `${m ?? ""} — 이 탭을 직접 닫아주세요`)); }, 100);
  };

  return (
    <main style={{ padding: 24, color: "#9aa3ad", fontFamily: "system-ui, sans-serif" }}>
      {message ? (
        <>
          <p style={{ color: "#e7b4ac", whiteSpace: "pre-wrap" }}>{message}</p>
          <button type="button" onClick={close} style={{ padding: "8px 14px" }}>닫기</button>
        </>
      ) : (
        <p>플레이테스트 준비 중…</p>
      )}
    </main>
  );
}
