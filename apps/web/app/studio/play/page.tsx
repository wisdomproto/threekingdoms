import { studioEnabled } from "../../../src/studio/hosting";
import { notFound } from "next/navigation";
import ChapterPlayer from "../../../src/studio/ChapterPlayer";
export default function ChapterPlayPage() {
  if (!studioEnabled()) notFound();
  return <ChapterPlayer />;
}

export const dynamic = "force-dynamic";
