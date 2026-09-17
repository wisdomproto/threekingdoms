import { assetUrl } from "../assetUrl";

const decoded = new Map<string, Promise<void>>();
/** Cache decoded images, but let a failed request be retried. */
export function preloadImage(src: string): Promise<void> {
  const existing = decoded.get(src);
  if (existing) return existing;
  const task = new Promise<void>((resolve, reject) => {
    const image = new Image();
    const timer = setTimeout(() => finish(new Error(`Image timed out: ${src}`)), 30000);
    function finish(error?: unknown) {
      clearTimeout(timer);
      image.onload = null;
      image.onerror = null;
      error ? reject(error) : resolve();
    }
    image.onload = () => { image.decode().then(() => finish(), finish); };
    image.onerror = () => finish(new Error(`Image unavailable: ${src}`));
    image.src = src;
  }).catch(error => { decoded.delete(src); throw error; });
  decoded.set(src, task);
  return task;
}

/** Collect scene backgrounds, comic pages and every speaker, including choice reactions. */
export function sceneImageUrls(scene: unknown): string[] {
  const paths = new Set<string>();
  function visit(value: unknown) {
    if (!value || typeof value !== "object") return;
    for (const [key, child] of Object.entries(value)) {
      if (typeof child === "string" && child) {
        if (key === "bg") paths.add(assetUrl(`/assets/scenes/${child}.webp`));
        if (key === "portraitId") paths.add(assetUrl(`/assets/ui/portraits/${child}.webp`));
        if (key === "image") paths.add(assetUrl(`/assets/comics/${child}.webp`));
      } else visit(child);
    }
  }
  visit(scene);
  return [...paths];
}
