import type { Metadata } from "next";
export const metadata: Metadata = {
  title: "TROIA · 낯선 해안",
  manifest: "/api/pwa/manifest?game=troia",
  appleWebApp: { capable: true, title: "TROIA", statusBarStyle: "black-translucent" },
  icons: { apple: "/api/pwa/icon?game=troia&size=192" },
};
export default function Layout({ children }: { children: React.ReactNode }) { return children; }
