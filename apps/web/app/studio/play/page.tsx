import { notFound } from "next/navigation";
import ChapterPlayer from "../../../src/studio/ChapterPlayer";
export default function ChapterPlayPage() {
  if (process.env.NODE_ENV !== "development") notFound();
  return <ChapterPlayer />;
}
