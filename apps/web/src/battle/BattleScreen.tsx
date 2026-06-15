"use client";
/**
 * BattleScreen (설계 §2.3) — React 셸. canvas mount/unmount + DOM HUD만 담당하고
 * Pixi 객체는 BattleRenderer 내부에 봉인된다 (설계 §2.2 React↔Pixi 경계).
 *
 * StrictMode 가드 (설계 리스크 §9-1):
 * - React 19 StrictMode는 마운트→정리→재마운트를 시뮬레이션한다. BattleRenderer는
 *   1회용(mount 후 destroy하면 재사용 불가)이므로 effect 실행마다 새로 만든다.
 * - BattleStore(게임 상태)는 ref로 컴포넌트 수명 동안 1회만 생성 — 재마운트에도 전투가
 *   리셋되지 않는다. store 생성자가 presenter를 고정 인자로 받으므로, "현재 렌더러"로
 *   연출을 전달하는 PresenterDelegate를 사이에 둔다 (렌더러 부재 시 즉시 완료 = 헤드리스 동작).
 *
 * HUD는 useSyncExternalStore로 settled 기반 뷰모델 스냅샷만 구독 (설계 §4 스포일러 차단).
 */
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { gameData } from "@tk/data";
import type { BattleContext, BattleEvent, BattleState, Coord } from "@tk/engine";
import { BattleStore } from "./store";
import type { Presenter, PresentedSnapshot } from "./eventPlayer";
import type { UiEvent } from "./inputMachine";
import { BattleRenderer } from "../pixi/BattleRenderer";
import { readSortie, applySortieToStage } from "../meta/sortie";
import { UnitPanel } from "./hud/UnitPanel";
import { InspectPopup } from "./hud/InspectPopup";
import { AttackForecast } from "./hud/AttackForecast";
import { ActionMenu } from "./hud/ActionMenu";
import { TurnBanner } from "./hud/TurnBanner";
import { EndTurnConfirm } from "./hud/EndTurnConfirm";
import { ObjectiveBanner } from "./hud/ObjectiveBanner";
import { ResultSequence } from "./hud/ResultSequence";
import { DialogueOverlay } from "./dialogue/DialogueOverlay";
import { BattleControls } from "./hud/BattleControls";
import { Minimap } from "./hud/Minimap";
import type { InputState } from "./inputMachine";

/** 고정 시드 — dev 재현성 (seed + actionLog가 버그 재현 수단, 설계 §1 리플레이 기반) */
const SEED = 20260612;

type Ev<T extends BattleEvent["type"]> = Extract<BattleEvent, { type: T }>;

/**
 * 현재 마운트된 렌더러로 연출을 위임하는 Presenter.
 * 렌더러가 없으면(마운트 전/StrictMode 정리 후) 모든 연출이 즉시 완료되어
 * EventPlayer 큐가 교착 없이 드레인된다.
 *
 * previewWalk/previewCancel도 여기서 위임 — store 생성 시 onPreviewWalk/onPreviewCancel에 연결.
 */
class PresenterDelegate implements Presenter {
  target: BattleRenderer | null = null;

  unitMoved(e: Ev<"unitMoved">): Promise<void> {
    return this.target?.unitMoved(e) ?? Promise.resolve();
  }
  damageDealt(e: Ev<"damageDealt">): Promise<void> {
    return this.target?.damageDealt(e) ?? Promise.resolve();
  }
  strategyCast(e: Ev<"strategyCast">): Promise<void> {
    return this.target?.strategyCast(e) ?? Promise.resolve();
  }
  itemUsed(e: Ev<"itemUsed">): Promise<void> {
    return this.target?.itemUsed(e) ?? Promise.resolve();
  }
  unitRetreated(e: Ev<"unitRetreated">): Promise<void> {
    return this.target?.unitRetreated(e) ?? Promise.resolve();
  }
  duelTriggered(e: Ev<"duelTriggered">): Promise<void> {
    return this.target?.duelTriggered(e) ?? Promise.resolve();
  }
  phaseChanged(e: Ev<"phaseChanged">): Promise<void> {
    return this.target?.phaseChanged(e) ?? Promise.resolve();
  }
  reinforcementArrived(e: Ev<"reinforcementArrived">): Promise<void> {
    return this.target?.reinforcementArrived(e) ?? Promise.resolve();
  }
  battleEnded(e: Ev<"battleEnded">): Promise<void> {
    return this.target?.battleEnded(e) ?? Promise.resolve();
  }
  sync(state: BattleState): void {
    this.target?.sync(state);
  }
  snapshot(): PresentedSnapshot | null {
    return this.target?.snapshot() ?? null; // null이면 dev 드레인 단언 생략
  }
  focus(coord: Coord): void {
    this.target?.focusOn(coord);
  }
  /** 프리뷰 워크 (원작 UX §수정명세-1): 렌더러가 없으면 즉시 완료 */
  previewWalk(unitId: string, from: Coord, to: Coord): Promise<void> {
    return this.target?.previewWalk(unitId, from, to) ?? Promise.resolve();
  }
  /** 프리뷰 취소 스냅 (원작 UX §수정명세-2) */
  previewCancel(unitId: string, to: Coord): void {
    this.target?.previewCancel(unitId, to);
  }
}

/** 선택/조회 중인 유닛 id (미니맵 강조용) — UnitPanel과 동일 규칙 */
function activeUnitId(ui: InputState): string | null {
  switch (ui.kind) {
    case "idle":
      return ui.inspectedId ?? null;
    case "selected":
    case "postMoveMenu":
    case "targetSelect":
    case "strategyMenu":
    case "strategyTarget":
    case "itemMenu":
    case "itemTarget":
      return ui.unitId;
    default:
      return null;
  }
}

/**
 * BattleContext 생성. 출진 페이로드(sessionStorage tk.sortie)가 있으면 그 stageId의
 * stage를 고르고 player 슬롯을 편성으로 override한다. 없으면 사수관을 기존 그대로 로드
 * (override 진입점이 no-op → 전투 테스트/직접 /battle 진입 회귀 없음).
 */
function makeCtx(): BattleContext {
  const sortie = readSortie();
  const stageId = sortie?.stageId ?? "05-sishuiguan";
  const baseStage = gameData.stages[stageId] ?? gameData.stages["05-sishuiguan"];
  const map = baseStage ? gameData.maps[baseStage.mapId] : undefined;
  if (!baseStage || !map) throw new Error("스테이지 데이터 누락 — @tk/data 로더 확인");
  // 편성이 있으면 player 슬롯만 교체한 stage 사본을 만든다(없으면 원본 그대로).
  const stage =
    sortie && sortie.members.length > 0
      ? { ...baseStage, units: applySortieToStage(baseStage, sortie.members) }
      : baseStage;
  return { data: gameData, stage, map };
}

interface Session {
  ctx: BattleContext;
  store: BattleStore;
  delegate: PresenterDelegate;
}

function createSession(): Session {
  const ctx = makeCtx();
  const delegate = new PresenterDelegate();
  const store = new BattleStore(ctx, SEED, {
    presenter: delegate,
    dev: process.env.NODE_ENV !== "production",
    onDevViolation: (m) => console.error(`[battle dev 단언] ${m}`),
    onFocus: (c) => delegate.focus(c),
    // 원작 UX §수정명세: 프리뷰 워크·취소를 현재 렌더러에 위임
    onPreviewWalk: (unitId, from, to) => delegate.previewWalk(unitId, from, to),
    onPreviewCancel: (unitId, to) => delegate.previewCancel(unitId, to),
  });
  return { ctx, store, delegate };
}

export default function BattleScreen(): React.ReactElement {
  const sessionRef = useRef<Session | null>(null);
  sessionRef.current ??= createSession();
  const { ctx, store, delegate } = sessionRef.current;

  const mountRef = useRef<HTMLDivElement | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);
  // 컨테이너 크기(CSS px) — ActionMenu 좌/우 자동 전환·클램프 기준 (§174).
  // 캔버스 좌표계와 동일 원점(컨테이너 좌상단)이라 menuAnchor와 좌표가 맞물린다.
  const [viewport, setViewport] = useState({ width: 0, height: 0 });
  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const r = entries[0]?.contentRect;
      if (r && r.width > 0 && r.height > 0) setViewport({ width: r.width, height: r.height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const el = mountRef.current;
    if (!el) return;
    const renderer = new BattleRenderer(ctx);
    renderer.connect(store);
    delegate.target = renderer;
    renderer.mount(el).catch((err: unknown) => {
      console.error("[battle] 렌더러 mount 실패", err);
    });
    return () => {
      if (delegate.target === renderer) delegate.target = null;
      renderer.destroy(); // init 진행 중이면 BattleRenderer 내부 가드가 완료 후 파괴
    };
  }, [ctx, store, delegate]);

  const snap = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
  const dispatch = useCallback((e: UiEvent) => store.dispatchUi(e), [store]);
  const toggleAuto = useCallback(() => store.setAutoBattle(!store.autoBattle), [store]);
  const resetCamera = useCallback(() => delegate.target?.resetCamera(), [delegate]);
  // 배속 순환 1→2→3→1 — store(라벨)와 렌더러(연출) 동시 반영
  const cycleSpeed = useCallback(() => {
    const next = store.speed >= 3 ? 1 : store.speed + 1;
    store.setSpeed(next);
    delegate.target?.setSpeed(next);
  }, [store, delegate]);
  const selectedId = activeUnitId(snap.ui);

  return (
    <div
      ref={rootRef}
      style={{ position: "fixed", inset: 0, overflow: "hidden", background: "#1b1f24" }}
    >
      <div ref={mountRef} style={{ position: "absolute", inset: 0 }} />
      <TurnBanner ui={snap.ui} vm={snap.vm} dispatch={dispatch} stageName={ctx.stage.name} />
      <ObjectiveBanner
        vm={snap.vm}
        stage={ctx.stage}
        nameOf={(id) => ctx.data.commanders[id]?.name ?? id}
      />
      <UnitPanel ui={snap.ui} vm={snap.vm} />
      <InspectPopup inspectedId={snap.inspectedId} activeId={selectedId} vm={snap.vm} anchor={snap.inspectAnchor} viewport={viewport} />
      <AttackForecast ui={snap.ui} ctx={ctx} committed={store.committedState} />
      <ActionMenu
        ui={snap.ui}
        dispatch={dispatch}
        anchor={snap.menuAnchor}
        viewport={viewport}
        previewWalking={snap.previewWalking}
      />
      <div
        style={{
          position: "absolute",
          top: "calc(44px + env(safe-area-inset-top))",
          right: 12,
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-end",
          gap: 8,
        }}
      >
        <Minimap map={ctx.map} units={snap.vm.units} selectedId={selectedId} viewport={snap.viewport} />
        <BattleControls
          auto={snap.autoBattle}
          onToggleAuto={toggleAuto}
          onResetCamera={resetCamera}
          speed={snap.speed}
          onCycleSpeed={cycleSpeed}
        />
      </div>
      <DialogueOverlay store={store} dialogue={ctx.stage.dialogue} />
      <EndTurnConfirm ui={snap.ui} dispatch={dispatch} />
      <ResultSequence
        ui={snap.ui}
        vm={snap.vm}
        reward={ctx.stage.reward}
        items={ctx.data.items}
        stageId={ctx.stage.id}
      />
    </div>
  );
}
