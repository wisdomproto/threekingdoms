import type { Metadata } from "next";
export const metadata: Metadata = {
  title: "삼국지 · 유비전",
  manifest: "/api/pwa/manifest?game=samgukji",
  appleWebApp: { capable: true, title: "삼국지", statusBarStyle: "black-translucent" },
  icons: { apple: "/api/pwa/icon?game=samgukji&size=192" },
};
export default function Layout({ children }: { children: React.ReactNode }) { return children; }
