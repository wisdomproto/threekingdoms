/**
 * UnitLayer (설계 §2.2) — UnitView 컬렉션 관리.
 * sortableChildren + zIndex=depthOf(y)로 깊이 정렬 선확보.
 * sync(state)는 committed로 강제 정합 (EventPlayer 드레인 시 호출),
 * snapshot()은 dev 단언용 화면 투영 상태를 반환한다.
 */
import { Container } from "pixi.js";
import type { BattleContext, BattleState } from "@tk/engine";
import type { PresentedUnit } from "../../battle/eventPlayer";
import type { TextureResolver } from "../textures";
import type { TweenRunner } from "../tweens";
import { UnitView } from "./UnitView";

export class UnitLayer extends Container {
  private readonly views = new Map<string, UnitView>();

  constructor(
    ctx: BattleContext,
    state: BattleState,
    textures: TextureResolver,
    tweens: TweenRunner,
  ) {
    super();
    this.sortableChildren = true;
    for (const u of state.units) {
      const view = new UnitView(
        {
          id: u.id,
          name: ctx.data.commanders[u.id]?.name ?? u.id,
          side: u.side,
          x: u.x,
          y: u.y,
          troops: u.troops,
          maxTroops: u.maxTroops,
          retreated: u.retreated,
        },
        textures,
        tweens,
      );
      this.views.set(u.id, view);
      this.addChild(view);
    }
  }

  view(id: string): UnitView {
    const v = this.views.get(id);
    if (!v) throw new Error(`UnitLayer: 미등록 유닛 ${id}`);
    return v;
  }

  /** committed로 강제 정합 — 연출 결과가 어긋났어도 진실로 덮는다 */
  sync(state: BattleState): void {
    for (const u of state.units) {
      const v = this.views.get(u.id);
      if (!v) continue; // v0에선 중도 스폰 없음
      v.snapTo(u.x, u.y);
      v.setTroops(u.troops);
      v.setRetreated(u.retreated);
    }
  }

  /** dev 단언용 — sync 이전의 화면 투영 상태 */
  snapshot(): PresentedUnit[] {
    return [...this.views.values()].map((v) => ({
      id: v.unitId,
      x: v.gridX,
      y: v.gridY,
      troops: v.troops,
      retreated: v.retreatedFlag,
    }));
  }
}
