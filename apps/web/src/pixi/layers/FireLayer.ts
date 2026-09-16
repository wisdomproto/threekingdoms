import { Container, Graphics, Sprite } from 'pixi.js';
import type { BattleState } from '@tk/engine';
import type { TextureResolver } from '../textures';
import { TILE_SIZE } from '../projection';
import { fireFrame } from '../fireAnimation';

/** Persistent fire follows committed cells; animation never changes battle state. */
export class FireLayer extends Container {
  private elapsed = 0;
  private readonly flames = new Map<string, { root: Container; sprite: Sprite; fallback: Graphics; x: number; y: number }>();
  constructor(private readonly textures: TextureResolver) { super(); this.eventMode = 'none'; }

  sync(fires: BattleState['fires']): void {
    const cells = new Map<string, { x: number; y: number }>();
    for (const fire of fires ?? []) for (const cell of fire.cells) cells.set(`${cell.x},${cell.y}`, cell);
    for (const [key, flame] of this.flames) if (!cells.has(key)) {
      flame.root.destroy({ children: true }); this.flames.delete(key);
    }
    for (const [key, cell] of cells) if (!this.flames.has(key)) {
      const root = new Container();
      root.position.set((cell.x + .5) * TILE_SIZE, (cell.y + .85) * TILE_SIZE);
      root.addChild(new Graphics().ellipse(0, 0, TILE_SIZE * .36, TILE_SIZE * .14).fill({ color: 0xff7c1e, alpha: .18 }));
      const fallback = new Graphics().ellipse(0, -12, 9, 15).fill({ color: 0xff791a, alpha: .8 }).ellipse(0, -7, 4, 9).fill(0xffda65);
      const sprite = new Sprite(); sprite.anchor.set(.5, 1); sprite.visible = false;
      root.addChild(fallback, sprite); this.addChild(root);
      this.flames.set(key, { root, sprite, fallback, ...cell });
    }
    this.tick(0);
  }

  tick(deltaMs: number): void {
    this.elapsed += Math.max(0, deltaMs);
    for (const flame of this.flames.values()) {
      const frame = fireFrame(this.elapsed, flame.x, flame.y);
      const texture = this.textures.getFx(`burn-loop-${frame}`);
      flame.sprite.visible = !!texture; flame.fallback.visible = !texture;
      if (texture) {
        if (flame.sprite.texture !== texture) flame.sprite.texture = texture;
        flame.sprite.width = TILE_SIZE * .9;
        flame.sprite.height = TILE_SIZE * 1.15;
      } else {
        flame.fallback.scale.set(1 + .08 * Math.sin(frame), 1 + .12 * Math.cos(frame));
      }
    }
  }
}
