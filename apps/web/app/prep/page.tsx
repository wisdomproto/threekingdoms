/**
 * /prep — 출진 준비 라우트. useSearchParams를 쓰는 클라이언트 셸(PrepShell)을 Suspense로
 * 감싼다(Next 15 정적 프리렌더 요구사항 — CSR bailout). 셸 본체는 ./PrepShell.
 */
import { Suspense } from "react";
import { PrepShell } from "./PrepShell";

export default function PrepPage(): React.ReactElement {
  return (
    <Suspense fallback={<main style={{ padding: 24, color: "#9aa3ad" }}>출진 준비 로딩…</main>}>
      <PrepShell />
    </Suspense>
  );
}
