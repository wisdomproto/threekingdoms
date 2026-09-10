import { Container, Sprite, Texture } from "pixi.js";
import { clipFor, frameAt, loadMotionFrame, type ActorMotions, type Direction } from "../motions";
export const SCENE_ACTOR_HEIGHT = 48;
/** Scene-only actor. No combat stats, hitboxes, or battle animation changes. */
export class ActorView extends Container {
  private art = new Sprite();
  private textures = new Map<object, Texture>();
  private pose = "idle";
  private direction: Direction = "left";
  private elapsed = 0;
  constructor(private actor: ActorMotions, private seatOffset = { x: 0, y: 0 }) { super(); this.art.anchor.set(0.5, 1); this.art.y = 24; this.addChild(this.art); }
  async load(): Promise<void> {
    await Promise.all(Object.values(this.actor.clips).flatMap(c => c.frames).map(async f => {
      const canvas = await loadMotionFrame(f); if (!this.destroyed) this.textures.set(f, Texture.from(canvas));
    })); this.tick(0);
  }
  setState(pose: string, dir: Direction): void {
    if (pose !== this.pose || dir !== this.direction) this.elapsed = 0;
    this.pose = pose; this.direction = dir; this.tick(0);
  }
  tick(ms: number): void {
    this.elapsed += ms;
    const clip = clipFor(this.actor, this.pose, this.direction); if (!clip) return;
    const f = frameAt(clip, this.elapsed), tex = this.textures.get(f); if (!tex) return;
    this.art.texture = tex;
    const seated = this.pose === "sit" || this.pose === "sit-talk";
    this.art.position.set(seated ? this.seatOffset.x : 0, 24 + (seated ? this.seatOffset.y : 0));
    const scale = SCENE_ACTOR_HEIGHT / tex.height;
    this.art.scale.set(this.direction === "right" ? -scale : scale, scale);
  }
}
