import { notFound } from "next/navigation";
import Studio from "../../src/studio/Studio";
import "./studio.css";
export const metadata = { title: "삼국지 · 프로젝트 스튜디오" };
export const viewport = { width: "device-width", initialScale: 1, maximumScale: 5, userScalable: true };
export default function StudioPage() {
  if (process.env.NODE_ENV !== "development") notFound();
  return <Studio />;
}
