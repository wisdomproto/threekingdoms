/** Server-only hosting settings. Studio remains closed unless explicitly configured. */
export function hostedStudioEnabled(): boolean {
  return process.env.TK_STUDIO_ENABLED === "1" && Boolean(process.env.TK_STUDIO_PASSWORD);
}
export function studioEnabled(): boolean {
  return process.env.NODE_ENV === "development" || hostedStudioEnabled();
}
