import { studioEnabled } from "../../../src/studio/hosting";
import { notFound } from "next/navigation";
import Studio from "../../../src/studio/Studio";
import "../studio.css";
export const metadata = { title: "시나리오 연결 · 삼국지 Studio" };
export default function ConnectionsPage() {
  if (!studioEnabled()) notFound();
  return <Studio connectionsOnly />;
}

export const dynamic = "force-dynamic";
