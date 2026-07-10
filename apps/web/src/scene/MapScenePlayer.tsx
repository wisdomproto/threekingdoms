"use client";
/**
 * MapScenePlayer (막간 v4 — 어드벤처 맵 씬 셸). SceneStage(Pixi) 풀스크린 캔버스 위에
 * 기존 VN 조각(DialoguePanel/NarrationPanel/SkipBar)을 재사용해 대사·선택지를 얹는다.
 *
 * 줄 진행 계약(스펙):
 *  줄 시작 → SceneStage.runLineActions(탭 = skipToState 즉시 완료) →
 *  text 있으면 타자기(탭1=전체, 탭2=다음 줄) / 없으면 자동 다음 줄 →
 *  choice 있으면 타자기 완료 후 두루마리 오버레이(옵션 → react 대사 재생 → 다음 줄 합류) →
 *  마지막 줄 다음 = onComplete. 스킵 = 인터프리터 최종 상태 적용 후 onComplete.
 *
 * 상태의 진실 = 순수 인터프리터(sceneUnitStates) — 탭 스킵·잔여 걷기는 항상 그 상태로 수렴.
 * 맵 미등록(scene.map 오타 등) = 빈 씬 가드처럼 즉시 onComplete(무붕괴 no-op 계약).
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { gameData, type BattleMap, type MapScene, type MapSceneLine } from "@tk/data";
import { moveCostFor } from "@tk/engine";
import { SceneStage } from "./map/SceneStage";
import { sceneUnitStates, type Cell, type Walkable } from "./map/interpreter";
import { useTypewriter } from "./useTypewriter";
import { DialoguePanel } from "./parts/DialoguePanel";
import { NarrationPanel } from "./parts/NarrationPanel";
import { SkipBar } from "./parts/SkipBar";
import { PARCHMENT, BRONZE_GOLD, BRONZE_DIM } from "./parts/tokens";

/** 엔진 IMPASSABLE(=99)은 비공개 상수 — 값 비교 계약(플랜 §Task 6). */
const IMPASSABLE_COST = 99;
/** 도보 moveClass — 보병 계열의 것(씬 유닛은 전원 도보). */
const SCENE_MOVE_CLASS = "foot";

type ReactLine = NonNullable<
  NonNullable<MapSceneLine["choice"]>["options"][number]["react"]
>[number];

type Phase =
  | { kind: "actions" }
  | { kind: "line" }
  | { kind: "choice" }
  | { kind: "react"; lines: readonly ReactLine[]; ri: number };

export function MapScenePlayer({
  scene,
  title,
  onComplete,
}: {
  scene: MapScene;
  /** 상단 표시용(스테이지명 등). */
  title?: string;
  onComplete: () => void;
}): React.ReactElement | null {
  const map = gameData.maps[scene.map];
  // 미등록 맵 = 빈 씬 가드와 동일 — 즉시 다음 단계(크래시 금지, 점진적 콘텐츠).
  useEffect(() => {
    if (!map) onComplete();
  }, [map, onComplete]);
  if (!map) return null;
  return <MapSceneInner scene={scene} map={map} title={title} onComplete={onComplete} />;
}

function MapSceneInner({
  scene,
  map,
  title,
  onComplete,
}: {
  scene: MapScene;
  map: BattleMap;
  title?: string;
  onComplete: () => void;
}): React.ReactElement {
  // 통행 판정 — 경계 + 지형 이동비용(도보) < IMPASSABLE. 인터프리터/SceneStage 공용.
  const walkable = useMemo<Walkable>(() => {
    return (c: Cell) => {
      const [x, y] = c;
      if (x < 0 || y < 0 || x >= map.width || y >= map.height) return false;
      const ch = map.tiles[y]?.[x];
      if (!ch) return false;
      const tid = map.tileLegend[ch];
      const terrain = tid ? gameData.terrains[tid] : undefined;
      if (!terrain) return false;
      return moveCostFor(terrain, SCENE_MOVE_CLASS) < IMPASSABLE_COST;
    };
  }, [map]);

  const statesAt = useCallback(
    (i: number) => sceneUnitStates(scene, i, walkable),
    [scene, walkable],
  );

  // ── SceneStage 마운트 (BattleScreen 캔버스 수명주기 미러 — effect마다 새 인스턴스) ──
  const mountRef = useRef<HTMLDivElement | null>(null);
  const stageRef = useRef<SceneStage | null>(null);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const el = mountRef.current;
    if (!el) return;
    const stage = new SceneStage();
    stageRef.current = stage;
    void stage
      .init(el, scene, map, walkable)
      .catch((err: unknown) => console.error("[MapScenePlayer] SceneStage init 실패", err))
      .then(() => {
        // 실패해도 진행은 계속(유닛 없는 대사 재생 — 무붕괴). StrictMode 재마운트는 ref 비교로 무시.
        if (stageRef.current === stage) setReady(true);
      });
    return () => {
      if (stageRef.current === stage) stageRef.current = null;
      setReady(false);
      stage.destroy(); // init 진행 중이면 SceneStage 내부 가드가 완료 후 파괴
    };
  }, [scene, map, walkable]);

  // ── 줄 진행 상태 ──
  const [idx, setIdx] = useState(0);
  const [phase, setPhase] = useState<Phase>({ kind: "actions" });
  const line = scene.lines[Math.min(idx, scene.lines.length - 1)]!;
  // 액션 완료 1회 가드 — 탭 스킵과 runLineActions 완료가 겹쳐도 전이는 한 번만.
  const actionsDoneRef = useRef(false);

  const goNext = useCallback(() => {
    stageRef.current?.setBubble(line.bubble?.id ?? "", null);
    if (idx >= scene.lines.length - 1) {
      onComplete();
      return;
    }
    setPhase({ kind: "actions" });
    setIdx((i) => Math.min(i + 1, scene.lines.length - 1)); // 연타 클램프(ScenePlayer 미러)
  }, [idx, line, scene.lines.length, onComplete]);

  const finishActions = useCallback(() => {
    if (actionsDoneRef.current) return;
    actionsDoneRef.current = true;
    if (line.text) setPhase({ kind: "line" });
    else if (line.choice) setPhase({ kind: "choice" });
    else goNext(); // 순수 액션 비트 — 자동 진행
  }, [line, goNext]);

  // 줄 시작: 말풍선 + 액션 실행. 언마운트/줄 전환 시 말풍선 해제.
  useEffect(() => {
    if (!ready) return;
    const stage = stageRef.current;
    if (!stage) return;
    let alive = true;
    actionsDoneRef.current = false;
    if (line.bubble) stage.setBubble(line.bubble.id, line.bubble.mark);
    void stage.runLineActions(line, statesAt(idx)).then(() => {
      if (alive) finishActions();
    });
    return () => {
      alive = false;
      if (line.bubble) stage.setBubble(line.bubble.id, null);
    };
    // finishActions/statesAt는 line·idx에 종속 — idx가 유일한 진행 축이라 idx/ready로 충분.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, idx]);

  // ── 타자기 (대사/react — 액션·선택 단계엔 빈 문자열 = 즉시 done) ──
  const reactLine = phase.kind === "react" ? phase.lines[phase.ri] : undefined;
  const text =
    phase.kind === "react"
      ? reactLine?.text ?? ""
      : phase.kind === "line" || phase.kind === "choice"
        ? line.text ?? ""
        : "";
  const { shown, done, reveal } = useTypewriter(text);

  // 타자기 완료 + choice 보유 → 두루마리 자동 표시(스펙 — 탭 불필요).
  useEffect(() => {
    if (phase.kind === "line" && done && line.choice) setPhase({ kind: "choice" });
  }, [phase.kind, done, line]);

  // react 줄 말풍선 — 표시 중에만.
  useEffect(() => {
    if (phase.kind !== "react") return;
    const r = phase.lines[phase.ri];
    const stage = stageRef.current;
    if (!r?.bubble || !stage) return;
    stage.setBubble(r.bubble.id, r.bubble.mark);
    const id = r.bubble.id;
    return () => stage.setBubble(id, null);
  }, [phase]);

  // ── 탭 진행 ──
  const advance = (): void => {
    const stage = stageRef.current;
    if (!ready) return;
    switch (phase.kind) {
      case "actions":
        stage?.skipToState(statesAt(idx)); // 걷기 즉시 완료(인터프리터 상태로 스냅)
        finishActions();
        return;
      case "line":
        if (!done) {
          reveal();
          return;
        }
        if (line.choice) {
          setPhase({ kind: "choice" });
          return;
        }
        goNext();
        return;
      case "react":
        if (!done) {
          reveal();
          return;
        }
        if (phase.ri < phase.lines.length - 1) setPhase({ ...phase, ri: phase.ri + 1 });
        else goNext();
        return;
      case "choice":
        return; // 옵션 버튼만 입력 — 오탭 무시
    }
  };

  const pickOption = (react: readonly ReactLine[] | undefined): void => {
    if (react && react.length > 0) setPhase({ kind: "react", lines: react, ri: 0 });
    else goNext();
  };

  const skipAll = (): void => {
    stageRef.current?.skipToState(statesAt(scene.lines.length - 1)); // 최종 상태(언마운트 전 일관성)
    onComplete();
  };

  // ── 표시 조각 ──
  const displaySpeaker = phase.kind === "react" ? reactLine?.speaker : line.speaker;
  const displaySide = phase.kind === "react" ? reactLine?.side : line.side;
  const displayPortrait = phase.kind === "react" ? reactLine?.portraitId : line.portraitId;
  const showPanel =
    (phase.kind === "react" && !!reactLine?.text) ||
    ((phase.kind === "line" || phase.kind === "choice") && !!line.text);
  const showChoice = phase.kind === "choice" && !!line.choice;

  return (
    <div
      onClick={advance}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") advance();
      }}
      role="button"
      tabIndex={0}
      aria-label="대사 진행 (탭)"
      style={{
        position: "fixed",
        inset: 0,
        background: "#000",
        cursor: "pointer",
        userSelect: "none",
        overflow: "hidden",
        fontFamily: '"Noto Serif KR", "Nanum Myeongjo", serif',
      }}
    >
      {/* Pixi 무대 (SceneStage 캔버스) */}
      <div ref={mountRef} style={{ position: "absolute", inset: 0 }} />

      {/* 오프닝 페이드-인 — VN SceneBackground의 tkSceneIn 미러(파트 전환 리마운트 = 장면 전환감) */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          background: "#000",
          pointerEvents: "none",
          animation: "tkMapSceneIn 420ms ease-out both",
        }}
      />
      <style>{"@keyframes tkMapSceneIn { from { opacity: 1 } to { opacity: 0 } }"}</style>

      {/* 상단 타이틀 + 스킵 */}
      <SkipBar title={title} onSkip={skipAll} />

      {/* 좌상단 장소 라벨 */}
      {scene.label && (
        <div
          style={{
            position: "absolute",
            top: "calc(46px + env(safe-area-inset-top))",
            left: 16,
            background: "rgba(20,17,13,0.78)",
            border: `1px solid ${BRONZE_DIM}`,
            borderRadius: 4,
            color: PARCHMENT,
            fontSize: 13,
            letterSpacing: "0.12em",
            padding: "4px 12px",
          }}
        >
          {scene.label}
        </div>
      )}

      {/* 하단 대사/내레이션 (액션 중엔 비표시 — 무대가 말한다) */}
      {showPanel &&
        (displaySpeaker ? (
          <DialoguePanel
            line={{
              speaker: displaySpeaker,
              side: displaySide,
              portraitId: displayPortrait,
              text: text,
            }}
            shown={shown}
            done={done}
            idx={idx}
            total={scene.lines.length}
          />
        ) : (
          <NarrationPanel shown={shown} done={done} idx={idx} total={scene.lines.length} />
        ))}

      {/* 두루마리 선택지 오버레이 (분기 없음 — react 재생 후 다음 줄 합류) */}
      {showChoice && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            pointerEvents: "none",
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              pointerEvents: "auto",
              minWidth: 280,
              maxWidth: 440,
              background: "rgba(22,18,13,0.94)",
              border: `1px solid ${BRONZE_DIM}`,
              borderRadius: 10,
              padding: "18px 22px",
              boxShadow: "0 8px 28px rgba(0,0,0,0.55)",
            }}
          >
            {line.choice?.prompt && (
              <div
                style={{
                  color: BRONZE_GOLD,
                  fontSize: 15,
                  fontWeight: 700,
                  letterSpacing: "0.06em",
                  marginBottom: 12,
                  textAlign: "center",
                }}
              >
                {line.choice.prompt}
              </div>
            )}
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {line.choice?.options.map((o, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    pickOption(o.react);
                  }}
                  style={{
                    background: "rgba(42,35,24,0.85)",
                    color: PARCHMENT,
                    border: `1px solid ${BRONZE_DIM}`,
                    borderRadius: 6,
                    padding: "10px 14px",
                    fontSize: 15,
                    fontFamily: "inherit",
                    cursor: "pointer",
                    textAlign: "left",
                  }}
                >
                  {o.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
