/** Shared editor/runtime contract. Four directions; side artwork is mirrored for right. */
export const DIRECTIONS = ["left", "right", "up", "down"] as const;
export type Direction = typeof DIRECTIONS[number];
export interface MotionFrame { image: string; col: number; row: number; columns: number; rows: number; ms: number }
export interface MotionClip { loop: boolean; frames: MotionFrame[] }
export interface ActorMotions { name: string; clips: Record<string, MotionClip> }
export interface MotionLibrary { version: 1; actors: Record<string, ActorMotions> }
export const MOTION_URL = "/assets/scene-motions/library.json";
export function clipFor(actor: ActorMotions, pose: string, dir: Direction): MotionClip | undefined {
  return actor.clips[`${dir === "right" ? "left" : dir}.${pose}`]
    ?? actor.clips[`${dir === "right" ? "left" : dir}.idle`];
}
export function frameAt(clip: MotionClip, elapsed: number): MotionFrame {
  const total = clip.frames.reduce((n, f) => n + f.ms, 0);
  let t = clip.loop ? Math.max(0, elapsed) % total : Math.min(Math.max(0, elapsed), total - 1);
  for (const f of clip.frames) { if (t < f.ms) return f; t -= f.ms; }
  return clip.frames[clip.frames.length - 1]!;
}
export function validateLibrary(value: unknown): value is MotionLibrary {
  const v = value as MotionLibrary;
  if (!v || v.version !== 1 || !v.actors || typeof v.actors !== "object") return false;
  return Object.entries(v.actors).length > 0 && Object.entries(v.actors).every(([id, a]) =>
    /^[a-z0-9-]+$/.test(id) && a && typeof a.name === "string" && a.clips &&
    Object.keys(a.clips).length > 0 && Object.entries(a.clips).every(([key, c]) =>
      /^(left|up|down)\.[a-z][a-z0-9_-]*$/.test(key) && c && typeof c.loop === "boolean" &&
      Array.isArray(c.frames) && c.frames.length > 0 && c.frames.length <= 60 && c.frames.every(f =>
        f && typeof f.image === "string" && (/^\/assets\/[a-zA-Z0-9_./-]+\.(png|webp)$/.test(f.image) && !f.image.includes("..") || /^data:image\/(png|webp);base64,[A-Za-z0-9+/=]+$/.test(f.image)) &&
        [f.col, f.row, f.columns, f.rows, f.ms].every(Number.isInteger) && f.columns > 0 && f.columns <= 32 && f.rows > 0 && f.rows <= 32 &&
        f.col >= 0 && f.col < f.columns && f.row >= 0 && f.row < f.rows && f.ms >= 40 && f.ms <= 10000)));
}

/** Atlas slicing and edge-connected matte removal, shared by preview and game.
 * Only the outside background is removed; enclosed pale clothing stays opaque. */
const sources = new Map<string, Promise<HTMLImageElement>>();
const frames = new Map<string, Promise<HTMLCanvasElement>>();
export function loadMotionFrame(f: MotionFrame): Promise<HTMLCanvasElement> {
  const key = JSON.stringify([f.image, f.col, f.row, f.columns, f.rows]);
  const found = frames.get(key); if (found) return found;
  const task = (async () => {
    let source = sources.get(f.image);
    if (!source) {
      source = new Promise<HTMLImageElement>((resolve, reject) => {
        const img = new Image(); img.crossOrigin = "anonymous";
        img.onload = () => resolve(img); img.onerror = () => reject(new Error("이미지를 읽지 못했습니다")); img.src = f.image;
      }); sources.set(f.image, source);
    }
    const img = await source;
    const x = Math.round(f.col * img.width / f.columns), y = Math.round(f.row * img.height / f.rows);
    const w = Math.round((f.col + 1) * img.width / f.columns) - x;
    const h = Math.round((f.row + 1) * img.height / f.rows) - y;
    const canvas = document.createElement("canvas"); canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext("2d")!; ctx.drawImage(img, x, y, w, h, 0, 0, w, h);
    const data = ctx.getImageData(0, 0, w, h), p = data.data;
    const seen = new Uint8Array(w * h), queue: number[] = [];
    const push = (i: number) => {
      if (seen[i]) return; seen[i] = 1;
      const k = i * 4, r = p[k]!, g = p[k + 1]!, b = p[k + 2]!;
      if (p[k + 3]! < 12 || (Math.min(r, g, b) > 175 && Math.max(r,g,b) - Math.min(r,g,b) < 24) || (r > 180 && b > 180 && g < 100)) queue.push(i);
    };
    for (let xx=0; xx<w; xx++) { push(xx); push((h-1)*w+xx); }
    for (let yy=0; yy<h; yy++) { push(yy*w); push(yy*w+w-1); }
    for(let q=0;q<queue.length;q++) {
      const i=queue[q]!; p[i*4+3]=0;
      if(i%w)push(i-1); if(i%w<w-1)push(i+1); if(i>=w)push(i-w); if(i<w*(h-1))push(i+w);
    }
    ctx.putImageData(data, 0, 0); return canvas;
  })();
  frames.set(key, task); task.catch(() => frames.delete(key)); return task;
}
