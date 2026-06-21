/**
 * UnitLayer (설계 §2.2) — UnitView 컬렉션 관리.
 * sortableChildren + zIndex=depthOf(y)로 깊이 정렬 선확보.
 * sync(state)는 committed로 강제 정합 (EventPlayer 드레인 시 호출),
 * snapshot()은 dev 단언용 화면 투영 상태를 반환한다.
 */
import { Container } from "pixi.js";
import type { BattleContext, BattleState, UnitState, ReinforcedUnit } from "@tk/engine";
import type { PresentedUnit } from "../../battle/eventPlayer";
import type { TextureResolver } from "../textures";
import type { TweenRunner } from "../tweens";
import { UnitView } from "./UnitView";

export class UnitLayer extends Container {
  private readonly views = new Map<string, UnitView>();
  // 중도 스폰(증원) 뷰를 생성하려면 생성 의존물을 보관해야 한다(종전 생성자 지역변수 → 필드).
  private readonly ctx: BattleContext;
  private readonly textures: TextureResolver;
  private readonly tweens: TweenRunner;

  constructor(
    ctx: BattleContext,
    state: BattleState,
    textures: TextureResolver,
    tweens: TweenRunner,
  ) {
    super();
    this.ctx = ctx;
    this.textures = textures;
    this.tweens = tweens;
    this.sortableChildren = true;
    for (const u of state.units) this.createView(u);
    this.orientInitial(state); // 시작 시 적을 바라보게 (기본 facing=우향 보정)
  }

  /** 전투 시작 시 각 유닛이 가장 가까운 적을 바라보게 초기 방향 설정.
   *  UnitView 기본 facing=+1(우향)이라, 안 하면 우측의 적군이 플레이어 반대(우측)를 본다. */
  private orientInitial(state: BattleState): void {
    const living = state.units.filter((u) => !u.retreated);
    for (const u of living) {
      const view = this.views.get(u.id);
      if (!view) continue;
      const foes = living.filter((o) => (o.side === "enemy") !== (u.side === "enemy"));
      if (!foes.length) continue;
      const dist = (o: { x: number; y: number }): number => Math.abs(o.x - u.x) + Math.abs(o.y - u.y);
      const nearest = foes.reduce((a, b) => (dist(b) < dist(a) ? b : a));
      view.faceToward({ x: nearest.x, y: nearest.y });
    }
  }

  /** UnitState(또는 동형 데이터)로 뷰 1개 생성·등록. 초기 배치·증원 스폰·sync 폴백이 공유. */
  private createView(u: {
    id: string; classId: string; side: UnitState["side"]; x: number; y: number; troops: number; maxTroops: number; retreated?: boolean;
  }): UnitView {
    const view = new UnitView(
      {
        id: u.id,
        commanderId: u.id, // 스테이지 JSON의 commanderId = unit.id
        classId: u.classId,
        name: this.ctx.data.commanders[u.id]?.name ?? u.id,
        side: u.side,
        x: u.x,
        y: u.y,
        troops: u.troops,
        maxTroops: u.maxTroops,
        retreated: u.retreated ?? false,
      },
      this.textures,
      this.tweens,
    );
    this.views.set(u.id, view);
    this.addChild(view);
    return view;
  }

  /**
   * 증원 도착 — 새 유닛 뷰 생성(이미 있으면 무시, 멱등). reinforcementArrived 이벤트가 호출하므로
   * 드레인 snapshot 캡처 *전*에 뷰가 생겨 "투영 누락" 단언을 통과한다. 생성 직후 텍스처 적용.
   */
  spawn(units: readonly ReinforcedUnit[], side: UnitState["side"]): void {
    for (const u of units) {
      if (this.views.has(u.id)) continue;
      this.createView({ ...u, side, retreated: false }).refreshSprite();
    }
  }

  view(id: string): UnitView {
    const v = this.views.get(id);
    if (!v) throw new Error(`UnitLayer: 미등록 유닛 ${id}`);
    return v;
  }

  /** 미등록이면 throw 대신 undefined — 커맨드 메뉴 앵커 등 표현 전용 조회에 사용 */
  tryView(id: string): UnitView | undefined {
    return this.views.get(id);
  }

  /** loadSprites() 완료 후 호출 — 폴백으로 생성된 뷰에 스프라이트 텍스처 적용 */
  refreshSprites(): void {
    for (const v of this.views.values()) v.refreshSprite();
  }

  /**
   * 자체 컷아웃 리그 적용 (§4) — 각 유닛 spriteId에 스켈레톤이 있으면 setSkeleton으로 격상.
   * 비동기·방어적: 리그 없으면(null) 베이크 스프라이트 유지(무회귀). 같은 spriteId는 textures가 1회 캐시.
   * BattleRenderer.mount에서 fire-and-forget 호출.
   */
  applySkeletons(): void {
    for (const v of this.views.values()) {
      const sid = v.spriteKey;
      if (!sid) continue;
      this.textures
        .loadSkeleton(sid)
        .then((rig) => {
          if (rig) v.setSkeleton(rig.skeleton, (img) => rig.textures.get(img) ?? null);
        })
        .catch((e) => console.warn(`[UnitLayer] 리그 로드 실패 (${sid}) — 베이크 유지`, e));
    }
  }

  /** ticker에서 매 프레임 — 전 유닛 idle 호흡 갱신 */
  tickIdle(dtMS: number): void {
    for (const v of this.views.values()) v.tickIdle(dtMS);
  }

  /**
   * 선택된 유닛 ID를 설정합니다.
   * 이전 선택을 해제하고 새 유닛만 이름 라벨을 표시합니다.
   * @param selectedId 선택된 유닛 ID, null이면 모두 해제
   */
  setSelected(selectedId: string | null): void {
    for (const [id, v] of this.views) {
      v.setSelected(id === selectedId);
    }
  }

  /** committed로 강제 정합 — 연출 결과가 어긋났어도 진실로 덮는다 */
  sync(state: BattleState): void {
    for (const u of state.units) {
      // 뷰가 없으면 생성(증원 등 중도 스폰 폴백 — reinforcementArrived가 놓친 경우 안전망).
      let v = this.views.get(u.id);
      if (!v) { v = this.createView(u); v.refreshSprite(); }
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
