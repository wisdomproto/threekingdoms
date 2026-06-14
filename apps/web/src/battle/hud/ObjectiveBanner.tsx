"use client";
/**
 * ObjectiveBanner (인배틀 목표 오버레이) — 레퍼런스 §14/§107/§11 충실 복제.
 *
 * 레퍼런스(yeonggeoljeon-remake-ux-analysis.md):
 *  - 전투 진입 컷신/오버레이가 "승리조건 / 여포를 퇴각시켜라! / 제한 턴 수 20"을 먼저 깐다(§14, g0227).
 *  - 그 뒤 턴 루프 내내 상태 띠에 스테이지명·턴이 상시 노출(§5) — 목표는 상시 작게 떠 있어야 한다.
 * 우리 복제:
 *  - 전투 시작 + 매 아군 턴 시작에 **잠깐 강조 배너**(중앙, 청동/수묵 띠).
 *  - 그 외엔 좌상단 모서리에 **상시 작은 목표 칩**(승리 명령형 + 제한턴 꼬리표).
 * 데이터는 vm(turn/status) + stage(objectives/failConditions/turnLimit)에서만 — 순수 텍스트는
 * objectiveText.ts가 만든다. ⚠️ store/renderer/engine/schemas 의존 없음(소유 경계).
 *
 * 아트 스킨만 독자(청동/수묵) — 동작·정보위계·레이아웃은 레퍼런스 그대로(충실 복제 원칙).
 */
import { useEffect, useRef, useState } from "react";
import type { BattleVM } from "../viewmodel";
import {
  buildObjectiveDisplay,
  type ObjectiveDisplay,
  type ObjectiveTextOptions,
  type StageObjectiveLike,
} from "../objectiveText";

/** 강조 배너 노출 시간(ms) — TurnBanner 페이즈 배너와 동일한 짧은 코스메틱 길이. */
const FLASH_MS = 2200;

const FLASH_KEYFRAMES = `
@keyframes tk-objective-flash {
  0%   { opacity: 0; transform: translateY(-8px) scale(0.98); }
  12%  { opacity: 1; transform: translateY(0) scale(1); }
  82%  { opacity: 1; transform: translateY(0) scale(1); }
  100% { opacity: 0; transform: translateY(-6px) scale(0.99); }
}`;

/** 청동/수묵 색 토큰 (frames.ts·다른 HUD와 톤 일치). */
const INK = "rgba(14, 16, 20, 0.82)";
const BRONZE = "#c8a25a";
const BRONZE_DIM = "#8a7038";
const PARCHMENT = "#efe7d2";

const FLASH_WRAP: React.CSSProperties = {
  position: "absolute",
  top: "calc(58px + env(safe-area-inset-top))",
  left: 0,
  right: 0,
  display: "flex",
  justifyContent: "center",
  pointerEvents: "none",
  userSelect: "none",
  zIndex: 6,
};

const FLASH_CARD: React.CSSProperties = {
  maxWidth: "min(86vw, 460px)",
  padding: "12px 22px",
  textAlign: "center",
  background: `linear-gradient(180deg, rgba(26,22,16,0.92), ${INK})`,
  border: `2px solid ${BRONZE}`,
  borderRadius: 10,
  boxShadow: `0 0 0 1px rgba(0,0,0,0.5), 0 6px 22px rgba(0,0,0,0.55), inset 0 0 18px rgba(200,162,90,0.12)`,
  animation: `tk-objective-flash ${FLASH_MS}ms cubic-bezier(0.22,0.61,0.36,1) both`,
};

/** 상시 작은 목표 칩 — 좌상단 모서리(상태 띠와 겹치지 않게 살짝 아래). */
const STRIP_WRAP: React.CSSProperties = {
  position: "absolute",
  top: "calc(40px + env(safe-area-inset-top))",
  left: "calc(10px + env(safe-area-inset-left))",
  maxWidth: "min(64vw, 280px)",
  padding: "7px 11px",
  background: INK,
  border: `1px solid ${BRONZE_DIM}`,
  borderRadius: 8,
  pointerEvents: "none",
  userSelect: "none",
  zIndex: 4,
  boxShadow: "0 2px 10px rgba(0,0,0,0.45)",
};

/** 강조 배너 1개 (전투 시작/아군 턴 시작). 필수 목표만 큼직하게, 제한턴은 꼬리표로. */
function ObjectiveFlash({
  display,
  flashKey,
}: {
  display: ObjectiveDisplay;
  flashKey: number;
}): React.ReactElement | null {
  const primary = display.primary;
  if (primary.length === 0) return null;
  return (
    <div style={FLASH_WRAP} aria-hidden>
      <style>{FLASH_KEYFRAMES}</style>
      <div key={flashKey} style={FLASH_CARD}>
        <div
          style={{
            fontSize: 11,
            letterSpacing: 3,
            color: BRONZE,
            marginBottom: 6,
            fontWeight: 700,
          }}
        >
          승리 조건
        </div>
        {primary.map((line) => (
          <div
            key={line}
            style={{
              fontSize: 21,
              fontWeight: 800,
              color: PARCHMENT,
              lineHeight: 1.3,
              textShadow: `0 0 8px rgba(200,162,90,0.35), 0 2px 4px rgba(0,0,0,0.7)`,
            }}
          >
            {line}
          </div>
        ))}
        <div style={{ marginTop: 6, fontSize: 13, color: BRONZE }}>{display.turnLimit}</div>
      </div>
    </div>
  );
}

/** 상시 칩 — 승리 명령형(필수) + 제한턴. 보너스/패배조건은 강조 배너에서 제외, 칩에선 생략(간결 우선). */
function ObjectiveStrip({ display }: { display: ObjectiveDisplay }): React.ReactElement | null {
  if (display.primary.length === 0) return null;
  return (
    <div style={STRIP_WRAP} aria-label="현재 목표">
      {display.primary.map((line, i) => (
        <div
          key={line}
          style={{
            fontSize: 13,
            fontWeight: 700,
            color: PARCHMENT,
            lineHeight: 1.35,
            marginTop: i === 0 ? 0 : 2,
          }}
        >
          {line}
        </div>
      ))}
      <div style={{ fontSize: 11, color: BRONZE, marginTop: 3 }}>{display.turnLimit}</div>
    </div>
  );
}

/**
 * 강조 배너 트리거: 전투 시작(첫 표시) + 아군 페이즈로 턴이 새로 시작될 때마다 1회.
 * vm.turn.turn 증가 또는 phase가 player로 전환되는 순간을 ref로 감지.
 * 종료(status!=ongoing) 시엔 강조 배너를 띄우지 않는다(결산은 ResultSequence 전담).
 */
function useObjectiveFlash(vm: BattleVM): number | null {
  const [flashKey, setFlashKey] = useState<number | null>(null);
  const keyRef = useRef(0);
  const prev = useRef<{ turn: number; phase: BattleVM["turn"]["phase"] } | null>(null);
  const firedFirst = useRef(false);

  useEffect(() => {
    const cur = { turn: vm.turn.turn, phase: vm.turn.phase };
    const last = prev.current;
    prev.current = cur;
    if (vm.status !== "ongoing") return;

    let trigger = false;
    if (!firedFirst.current && vm.turn.phase === "player") {
      firedFirst.current = true; // 전투 시작(첫 아군 페이즈)
      trigger = true;
    } else if (last) {
      // 아군 페이즈로 새 턴이 시작될 때(턴 증가 + player) 다시 강조
      const newAllyTurn =
        vm.turn.phase === "player" && (last.turn !== cur.turn || last.phase !== "player");
      if (newAllyTurn) trigger = true;
    }
    if (trigger) {
      keyRef.current += 1;
      setFlashKey(keyRef.current);
    }
  }, [vm.turn.turn, vm.turn.phase, vm.status]);

  // 자동 소멸
  useEffect(() => {
    if (flashKey == null) return;
    const id = window.setTimeout(() => setFlashKey(null), FLASH_MS);
    return () => window.clearTimeout(id);
  }, [flashKey]);

  return flashKey;
}

export function ObjectiveBanner({
  vm,
  stage,
  nameOf,
  tileNameOf,
}: {
  vm: BattleVM;
  /** ctx.stage (objectives/failConditions/turnLimit/레거시 victory·defeat). */
  stage: StageObjectiveLike;
  /** unitId → 표시 이름(보통 (id)=>commanders[id]?.name ?? id). 미지정 시 id 그대로. */
  nameOf?: ObjectiveTextOptions["nameOf"];
  /** 좌표 → 지명(reachTile/captureTile). 미지정 시 좌표 라벨. */
  tileNameOf?: ObjectiveTextOptions["tileNameOf"];
}): React.ReactElement | null {
  const opts: ObjectiveTextOptions = { nameOf, tileNameOf };
  const display = buildObjectiveDisplay(stage, opts);
  const flashKey = useObjectiveFlash(vm);

  if (display.primary.length === 0) return null;
  return (
    <>
      <ObjectiveStrip display={display} />
      {flashKey != null && <ObjectiveFlash display={display} flashKey={flashKey} />}
    </>
  );
}
