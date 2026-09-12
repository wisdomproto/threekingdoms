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
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { gameData } from "@tk/data";
import { getMeta, getPlaythroughCount } from "../meta/metaStore";
import type { BattleContext, BattleEvent, BattleState, Coord } from "@tk/engine";
import { BattleStore } from "./store";
import type { Presenter, PresentedSnapshot } from "./eventPlayer";
import type { UiEvent } from "./inputMachine";
import { BattleRenderer } from "../pixi/BattleRenderer";
import { readSortie, applySortieToStage } from "../meta/sortie";
import { readLab, LAB_STAGE_ID } from "../lab/lab";
import { UnitPanel } from "./hud/UnitPanel";
import { InspectPopup } from "./hud/InspectPopup";
import { AttackForecast } from "./hud/AttackForecast";
import { ActionMenu } from "./hud/ActionMenu";
import { TurnBanner } from "./hud/TurnBanner";
import { EndTurnConfirm } from "./hud/EndTurnConfirm";
import { ObjectiveBanner } from "./hud/ObjectiveBanner";
import { ResultSequence } from "./hud/ResultSequence";
import { DialogueOverlay } from "./dialogue/DialogueOverlay";
import { DuelCutin, type DuelCineVM } from "./duel/DuelCutin";
import { duelBanter } from "./duel/duelMedia";
import { BattleControls } from "./hud/BattleControls";
import { PauseMenu } from "./hud/PauseMenu";
import { Minimap } from "./hud/Minimap";
import { adLifecycle } from "../meta/adProviders";
import { HUD_FONT, HUD_BRONZE, HUD_BRONZE_DIM, HUD_PARCHMENT } from "./hud/frames";
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
  troopsHealed(e: Ev<"troopsHealed">): Promise<void> {
    return this.target?.troopsHealed(e) ?? Promise.resolve();
  }
  // ⚠ 옵셔널 Presenter 메서드도 **반드시 여기 위임을 추가**해야 실제 게임에서 연출이 나온다.
  // EventPlayer는 `p.flank?.(e)`로 델리게이트를 보므로, 델리게이트에 메서드가 없으면 렌더러에
  // 구현돼 있어도 조용히 스킵된다 — 협공/필살/콤보/상태이상 연출이 전부 무음 통과되던
  // 잠복 버그의 근본(2026-07-03 발견). 새 연출 이벤트 추가 시 3곳 세트: 렌더러 구현 +
  // eventPlayer 인터페이스/디스패치 + 이 델리게이트.
  flank(e: Ev<"flank">): Promise<void> {
    return this.target?.flank(e) ?? Promise.resolve();
  }
  ultimate(e: Ev<"ultimate">): Promise<void> {
    return this.target?.ultimate(e) ?? Promise.resolve();
  }
  combo(e: Ev<"combo">): Promise<void> {
    return this.target?.combo(e) ?? Promise.resolve();
  }
  statusApplied(e: Ev<"statusApplied">): Promise<void> {
    return this.target?.statusApplied(e) ?? Promise.resolve();
  }
  statusTick(e: Ev<"statusTick">): Promise<void> {
    return this.target?.statusTick(e) ?? Promise.resolve();
  }
  statusExpired(e: Ev<"statusExpired">): Promise<void> {
    return this.target?.statusExpired(e) ?? Promise.resolve();
  }
  levelUp(e: Ev<"levelUp">): Promise<void> {
    return this.target?.levelUp(e) ?? Promise.resolve();
  }
  strategyConditionMet(e: Ev<"strategyConditionMet">): Promise<void> {
    return this.target?.strategyConditionMet(e) ?? Promise.resolve();
  }
  weatherChanged(e: Ev<"weatherChanged">): Promise<void> {
    return this.target?.weatherChanged(e) ?? Promise.resolve();
  }
  unitPromoted(e: Ev<"unitPromoted">): Promise<void> {
    return this.target?.unitPromoted(e) ?? Promise.resolve();
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
 * 실험실(/lab): URL이 stage=__lab이면 sessionStorage tk.lab 페이로드(스테이지·맵·공유풀·시드)로
 * ctx를 직접 구성 — 정규 스테이지 경로·2회차 강화와 완전 분리(메타 불가침은 결산 sandbox가 담당).
 */
function makeCtx(): { ctx: BattleContext; sharedItems: string[]; seed?: number; sandbox: boolean } {
  if (typeof window !== "undefined" &&
      new URLSearchParams(window.location.search).get("stage") === LAB_STAGE_ID) {
    const lab = readLab();
    if (lab) {
      // 실험실·플레이테스트: 결산 sandbox(메타 불가침)·종료 복귀는 이 플래그가 결정 — 스테이지 id 비교 금지(플레이테스트 스냅샷은 실제 id 유지).
      return { ctx: { data: gameData, stage: lab.stage, map: lab.map }, sharedItems: lab.sharedItems, seed: lab.seed, sandbox: true };
    }
  }
  const sortie = readSortie();
  // 부대 창고 소모품(원작 창고 §7) — friendly 공유 풀로 주입할 목록. 편성이 없으면 빈 풀.
  const sharedItems = sortie?.sharedItems ?? [];
  const stageId = sortie?.stageId ?? "05-sishuiguan";
  const baseStage = gameData.stages[stageId] ?? gameData.stages["05-sishuiguan"];
  const map = baseStage ? gameData.maps[baseStage.mapId] : undefined;
  if (!baseStage || !map) throw new Error("스테이지 데이터 누락 — @tk/data 로더 확인");
  // 편성이 있으면 player 슬롯만 교체한 stage 사본을 만든다(없으면 원본 그대로).
  const stage =
    sortie && sortie.members.length > 0
      ? { ...baseStage, units: applySortieToStage(baseStage, sortie.members) }
      : baseStage;

  // 2회차 적 강화(§11): playthroughCount × 25% 스탯 배율을 적 지휘관에게 적용.
  const ng = getPlaythroughCount();
  if (ng > 0) {
    const scale = 1 + ng * 0.25;
    const enemyIds = new Set(
      stage.units.filter((u) => u.side === "enemy").map((u) => u.commanderId),
    );
    const scaledCommanders = Object.fromEntries(
      Object.entries(gameData.commanders).map(([id, cmd]) => {
        if (!enemyIds.has(id)) return [id, cmd];
        return [
          id,
          {
            ...cmd,
            war: Math.round(cmd.war * scale),
            leadership: Math.round(cmd.leadership * scale),
            intelligence: Math.round(cmd.intelligence * scale),
          },
        ];
      }),
    );
    return { ctx: { data: { ...gameData, commanders: scaledCommanders }, stage, map }, sharedItems, sandbox: false };
  }

  return { ctx: { data: gameData, stage, map }, sharedItems, sandbox: false };
}

interface Session {
  ctx: BattleContext;
  store: BattleStore;
  delegate: PresenterDelegate;
  sandbox: boolean;
}

function createSession(): Session {
  const { ctx, sharedItems, seed, sandbox } = makeCtx();
  const delegate = new PresenterDelegate();
  const store = new BattleStore(ctx, seed ?? SEED, {
    presenter: delegate,
    dev: process.env.NODE_ENV !== "production",
    onDevViolation: (m) => console.error(`[battle dev 단언] ${m}`),
    onFocus: (c) => delegate.focus(c),
    // 원작 UX §수정명세: 프리뷰 워크·취소를 현재 렌더러에 위임
    onPreviewWalk: (unitId, from, to) => delegate.previewWalk(unitId, from, to),
    onPreviewCancel: (unitId, to) => delegate.previewCancel(unitId, to),
    // 부대 창고 소모품(§7) → friendly 공유 풀
    sharedItems,
  });
  return { ctx, store, delegate, sandbox };
}

export default function BattleScreen(): React.ReactElement {
  const sessionRef = useRef<Session | null>(null);
  sessionRef.current ??= createSession();
  const { ctx, store, delegate, sandbox } = sessionRef.current;

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

  // 전투 부트 게이트 — 에셋(스프라이트·오브젝트·맵배경) 로드 완료까지 로딩 장막을 덮는다.
  // "캐릭터/오브젝트가 뒤늦게 뜨는" 점진 노출 대신 준비 후 시작(2026-07-03 피드백).
  // 타임아웃(15s) 폴백 = §13 무손실 — 파일 누락/네트워크 행이 게임을 인질 잡지 않는다
  // (장막만 걷히고, 밑에서는 기존 점진 로드가 계속 채운다).
  const [boot, setBoot] = useState({ pct: 0, ready: false });
  // 개전 나레이션(battleStart 대사) 종료 후에 승리조건 배너를 띄운다(2026-07-03 피드백 —
  // "나레이션 끝나고 목표가 딱"). 개전 대사가 없는 스테이지는 장막 걷히는 즉시.
  const hasOpeningDialogue = useMemo(
    () => (ctx.stage.dialogue ?? []).some((d) => d.trigger.kind === "battleStart"),
    [ctx],
  );
  const [introDone, setIntroDone] = useState(!hasOpeningDialogue);
  // 결산 게이트(2026-07-03 "이긴 화면이 대사 중에 계속 떠 있다") — battleEnd 대사가 있는
  // 스테이지는 그 대사가 다 재생된 뒤에 ResultSequence를 띄운다. 순서: 승패 확정 → 마무리
  // 대사(탭 진행) → 결산. 해당 결과의 battleEnd 대사가 없으면(패배 등) 즉시 통과.
  const [endDialogueDone, setEndDialogueDone] = useState(false);
  // 일기토 컷인(§9 Tier 0) — 렌더러 duelTriggered가 여기 등록된 핸들러를 await.
  // resolve가 호출될 때까지 이벤트 스트림이 멈춘다(컷인 = 블로킹 시네마틱).
  const [duelCine, setDuelCine] = useState<{ vm: DuelCineVM; resolve: () => void } | null>(null);

  useEffect(() => {
    const el = mountRef.current;
    if (!el) return;
    const renderer = new BattleRenderer(ctx);
    renderer.connect(store);
    delegate.target = renderer;
    // 부트 게이트 구독 — StrictMode 재마운트 시 새 렌더러 기준으로 리셋.
    let cancelled = false;
    setBoot({ pct: 0, ready: false });
    renderer.onAssetProgress((pct) => {
      if (!cancelled) setBoot((b) => (b.ready ? b : { pct, ready: false }));
    });
    void renderer.assetsReady.then(() => {
      if (!cancelled) setBoot({ pct: 1, ready: true });
    });
    const bootTimeout = window.setTimeout(() => {
      if (!cancelled) setBoot((b) => ({ ...b, ready: true }));
    }, 15_000);
    // 일기토 컷인(§9) — duelTriggered마다 React 오버레이를 띄우고 완주(resolve)까지 대기.
    // vm은 스테이지 데이터에서 조립: 이름·즉사 여부(duel 이벤트 outcome)·banter 대사.
    renderer.setDuelCinematic((e) => new Promise<void>((resolve) => {
      if (cancelled) { resolve(); return; } // 정리 후 잔여 이벤트 — 즉시 통과(교착 방지)
      const name = (id: string): string => ctx.data.commanders[id]?.name ?? id;
      const ev = ctx.stage.events.find((x) => x.id === e.eventId);
      setDuelCine({
        vm: {
          duelId: e.eventId,
          attackerId: e.attackerId,
          defenderId: e.defenderId,
          winnerId: e.winnerId,
          attackerName: name(e.attackerId),
          defenderName: name(e.defenderId),
          loserRetreats: ev?.type === "duel" ? ev.outcome.loserRetreats === true : false,
          winnerIsFriendly:
            store.committedState.units.find((u) => u.id === e.winnerId)?.side !== "enemy",
          lines: duelBanter(ctx.stage.dialogue, e.eventId),
        },
        resolve,
      });
    }));
    renderer.mount(el).catch((err: unknown) => {
      console.error("[battle] 렌더러 mount 실패", err);
    });
    return () => {
      cancelled = true;
      window.clearTimeout(bootTimeout);
      renderer.onAssetProgress(null);
      renderer.setDuelCinematic(null);
      // 컷인 표시 중 정리(라우트 이탈 등) — 대기 중 resolve를 풀어 EventPlayer 교착 방지.
      setDuelCine((d) => { d?.resolve(); return null; });
      if (delegate.target === renderer) delegate.target = null;
      renderer.destroy(); // init 진행 중이면 BattleRenderer 내부 가드가 완료 후 파괴
    };
  }, [ctx, store, delegate]);

  // 시스템 메뉴(PauseMenu) — ESC 키(데스크탑) / 「☰ 메뉴」 버튼(모바일)으로 토글.
  // 전투 종료 후(결산 시퀀스 중)에는 열지 않는다 — committed가 ongoing일 때만.
  const [paused, setPaused] = useState(false);
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key !== "Escape") return;
      setPaused((p) => (p ? false : store.committedState.status === "ongoing"));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [store]);

  const snap = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
  const dispatch = useCallback((e: UiEvent) => store.dispatchUi(e), [store]);

  // 포털 게임플레이 신호(§13 심사 요건 — stub이면 no-op, 라우터가 start/stop 짝 dedupe).
  // 전투 화면 진입 = start, 종료(결산 진입)·이탈 = stop.
  useEffect(() => {
    adLifecycle.gameplayStart();
    return () => adLifecycle.gameplayStop();
  }, []);
  const battleOngoing = snap.vm.status === "ongoing";
  useEffect(() => {
    if (!battleOngoing) adLifecycle.gameplayStop();
  }, [battleOngoing]);
  // 승리 = 기쁜 순간(§13 happytime) — 포털 참여 지표/광고 타이밍 힌트. 패배는 제외. stub=no-op.
  const battleWon = snap.vm.status === "victory";
  useEffect(() => {
    if (battleWon) adLifecycle.happytime();
  }, [battleWon]);
  // 결산 게이트 판정 — 종료된 결과에 맞는 battleEnd 대사가 없으면 대기 없이 결산으로.
  const status = snap.vm.status;
  useEffect(() => {
    if (status === "ongoing") return;
    const has = (ctx.stage.dialogue ?? []).some(
      (d) => d.trigger.kind === "battleEnd" && (!d.trigger.result || d.trigger.result === status),
    );
    if (!has) setEndDialogueDone(true);
  }, [status, ctx]);
  // 자동전투는 클리어한 스테이지에서만 활성화(§15 "배속/자동전투 클리어 스테이지 한정").
  const stageId = ctx.stage.id;
  const isCleared = useMemo(() => getMeta().clearedStages.includes(stageId), [stageId]);
  // 개발 중에는 자동전투를 항상 허용(§15 "클리어 스테이지 한정"은 프로덕션만). dev = NODE_ENV !== production.
  const canAutoFight = isCleared || process.env.NODE_ENV !== "production";
  const toggleAuto = useCallback(() => {
    if (!canAutoFight) return;
    store.setAutoBattle(!store.autoBattle);
  }, [canAutoFight, store]);
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
      {/* 승리조건 배너 = 장막 걷힘 + 개전 나레이션 종료 후 — "나레이션 끝나고 목표가 딱" 시퀀스 */}
      {boot.ready && introDone && (
        <ObjectiveBanner
          vm={snap.vm}
          stage={ctx.stage}
          nameOf={(id) => ctx.data.commanders[id]?.name ?? id}
        />
      )}
      <UnitPanel
        ui={snap.ui}
        vm={snap.vm}
        anchor={snap.ui.kind === "idle" ? snap.inspectAnchor : snap.menuAnchor}
        viewport={viewport}
      />
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
          onOpenMenu={() => setPaused(true)}
          canAutoFight={canAutoFight}
        />
      </div>
      {boot.ready && (
        <DialogueOverlay
          store={store}
          // duelOccurred 대사는 컷인(DuelCutin)이 직접 재생 — 오버레이 중복 재생 방지(duelMedia 계약).
          dialogue={ctx.stage.dialogue?.filter((d) => d.trigger.kind !== "duelOccurred")}
          onLineChange={(speaker) => {
            const unit = store.committedState.units.find((u) => u.id === speaker);
            if (unit) delegate.target?.focusOn({ x: unit.x, y: unit.y }, 500);
          }}
          onQueueDrained={() => {
            // 전투 중 드레인=개전 나레이션 완료 신호, 종료 후 드레인=마무리 대사 완료 → 결산 개방.
            if (store.committedState.status !== "ongoing") setEndDialogueDone(true);
            else setIntroDone(true);
          }}
        />
      )}
      <EndTurnConfirm ui={snap.ui} dispatch={dispatch} />
      {/* 일기토 컷인 — 이벤트 스트림이 resolve까지 대기(블로킹 시네마틱) */}
      {duelCine && (
        <DuelCutin
          vm={duelCine.vm}
          onDone={() => {
            duelCine.resolve();
            setDuelCine(null);
          }}
        />
      )}
      {endDialogueDone && (
        <ResultSequence
          ui={snap.ui}
          vm={snap.vm}
          reward={ctx.stage.reward}
          items={ctx.data.items}
          stageId={sandbox ? undefined : ctx.stage.id}
          sandbox={sandbox}
        />
      )}
      {/* 부트 장막 — 에셋 준비 전 전장을 가린다(입력도 차단). 준비/타임아웃 시 즉시 걷힘. */}
      {!boot.ready && (
        <div
          aria-label="전장 로딩"
          style={{
            position: "absolute",
            inset: 0,
            zIndex: 60, // PauseMenu(80)보다 아래 — ESC 메뉴는 로딩 중에도 사용 가능
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 18,
            background: "radial-gradient(120% 90% at 50% 30%, #1a1714 0%, #0d0b09 80%)",
            color: HUD_PARCHMENT,
            fontFamily: HUD_FONT,
            userSelect: "none",
          }}
        >
          <p style={{ margin: 0, fontSize: 12, letterSpacing: "0.4em", textIndent: "0.4em", color: HUD_BRONZE_DIM }}>
            戰 場
          </p>
          <h2 style={{ margin: 0, fontSize: 24, letterSpacing: "0.12em", color: HUD_BRONZE, fontWeight: 700 }}>
            {ctx.stage.name}
          </h2>
          <div
            style={{
              width: "min(260px, 68vw)",
              height: 6,
              borderRadius: 3,
              background: "rgba(138, 115, 80, 0.18)",
              border: `1px solid ${HUD_BRONZE_DIM}44`,
              overflow: "hidden",
            }}
          >
            <div
              style={{
                width: `${Math.round(boot.pct * 100)}%`,
                height: "100%",
                background: `linear-gradient(90deg, ${HUD_BRONZE_DIM}, ${HUD_BRONZE})`,
                transition: "width 180ms ease-out",
              }}
            />
          </div>
          <p style={{ margin: 0, fontSize: 12, color: HUD_BRONZE_DIM }} aria-live="polite">
            전장을 준비하는 중… {Math.round(boot.pct * 100)}%
          </p>
        </div>
      )}
      <PauseMenu open={paused} onClose={() => setPaused(false)} sandbox={sandbox} />
    </div>
  );
}
