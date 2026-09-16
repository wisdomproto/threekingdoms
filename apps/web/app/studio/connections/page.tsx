import { notFound } from "next/navigation";
import Studio from "../../../src/studio/Studio";
import "../studio.css";
export const metadata = { title: "시나리오 연결 · 삼국지 Studio" };
export default function ConnectionsPage() {
  if (process.env.NODE_ENV !== "development") notFound();
  return <Studio connectionsOnly />;
}
