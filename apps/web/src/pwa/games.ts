export const installableGames = {
  samgukji: { name: "삼국지 · 유비전", shortName: "삼국지", mark: "三", color: "#251b0f" },
  troia: { name: "TROIA · 낯선 해안", shortName: "TROIA", mark: "T", color: "#12272b" },
} as const;
export type InstallableGame = keyof typeof installableGames;
export function gameManifest(game: InstallableGame) {
  const entry = installableGames[game];
  return {
    id: `/play/${game}`, name: entry.name, short_name: entry.shortName,
    start_url: `/play/${game}`, scope: "/", display: "standalone", lang: "ko",
    background_color: entry.color, theme_color: entry.color,
    icons: [192, 512].map(size => ({ src: `/api/pwa/icon?game=${game}&size=${size}`, sizes: `${size}x${size}`, type: "image/png", purpose: "any maskable" })),
  };
}
