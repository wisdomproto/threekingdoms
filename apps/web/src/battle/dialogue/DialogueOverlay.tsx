"use client";
/**
 * DialogueOverlay (C — 레퍼런스 §344 말풍선 대화창 충실 복제).
 *
 * 레퍼런스 동작 그대로:
 *  - 둥근 회색 말풍선 + 화자명=파랑 글씨(적/중립도 파랑) + 본문 검정.
 *  - 초상 좌/우 코너 가변(side: player/ally=좌, enemy=우) — 말풍선 꼬리가 초상을 가리킴(§344).
 *  - 타이핑 출력(한 글자씩 점진, §345). 좌하단 파란 "다음" 화살표 인디케이터(§346).
 *  - 탭 → 다음 줄(타이핑 중 탭이면 즉시 완성, 완성 상태 탭이면 진행).
 * 아트 스킨만 청동 액자(독자) — 동작/레이아웃/정보위계는 레퍼런스 동일.
 *
 * ⚠️ **순수 표현 — engine·store 미수정.** BattleStore.settledState/subscribe만 read-only로
 * 쓴다(useSyncExternalStore). 디렉터(director.ts)가 결정론 상태 전이로 대사를 큐잉하고,
 * 이 컴포넌트가 자체 React 상태로 한 줄씩 재생한다. 게임 진행/결정론에 영향 없음.
 *
 * 통합단계 마운트 예: <DialogueOverlay store={store} dialogue={ctx.stage.dialogue} />
 */
import { useCallback, useEffect, useReducer, useRef, useState, useSyncExternalStore } from "react";
import type { StageDialogue, DialogueLine } from "@tk/data";
import type { BattleStore } from "../store";
import { PORTRAIT_FRAME } from "../hud/frames";
import {
  type DialogueSnapshot,
  toDialogueSnapshot,
  firedDialogues,
} from "./director";

/** 타이핑 속도 (글자당 ms). 레퍼런스 점진 출력(§345) 재현 — 짧게 둬 캐주얼 페이싱. */
const TYPE_MS = 28;

/** 디렉터 큐 상태 — 재생 대기 라인 평탄화 + 이미 재생한 dialogue id */
interface QueueState {
  /** 평탄화된 재생 대기 라인 (dialogueId 동봉) */
  lines: Array<{ dialogueId: string; line: DialogueLine }>;
  /** 한 번이라도 큐잉한 dialogue id (각 대사 1회 보장) */
  playedIds: Set<string>;
}

type QueueAction =
  | { type: "enqueue"; dialogues: StageDialogue[] }
  | { type: "advance" };

function queueReducer(state: QueueState, action: QueueAction): QueueState {
  switch (action.type) {
    case "enqueue": {
      if (action.dialogues.length === 0) return state;
      const playedIds = new Set(state.playedIds);
      const add: QueueState["lines"] = [];
      for (const d of action.dialogues) {
        playedIds.add(d.id);
        for (const line of d.lines) add.push({ dialogueId: d.id, line });
      }
      return { lines: [...state.lines, ...add], playedIds };
    }
    case "advance":
      return state.lines.length === 0
        ? state
        : { ...state, lines: state.lines.slice(1) };
    default:
      return state;
  }
}

/**
 * 한 줄 타이핑 재생 + 탭 진행 훅.
 * @returns shown=화면에 노출된 글자, done=타이핑 완료 여부, onTap=탭 핸들러.
 */
function useTypewriter(text: string, onComplete: () => void) {
  const [count, setCount] = useState(0);
  const doneRef = useRef(false);

  // 새 줄 진입 시 리셋
  useEffect(() => {
    setCount(0);
    doneRef.current = false;
  }, [text]);

  useEffect(() => {
    if (count >= text.length) {
      doneRef.current = true;
      return;
    }
    const id = window.setTimeout(() => setCount((c) => c + 1), TYPE_MS);
    return () => window.clearTimeout(id);
  }, [count, text]);

  const done = count >= text.length;
  const onTap = useCallback(() => {
    if (!done) {
      // 타이핑 중 탭 → 즉시 완성
      setCount(text.length);
    } else {
      onComplete();
    }
  }, [done, text.length, onComplete]);

  return { shown: text.slice(0, count), done, onTap };
}

const OVERLAY_STYLE: React.CSSProperties = {
  position: "absolute",
  inset: 0,
  zIndex: 8, // 결과 시퀀스(ResultSequence)보다 아래, 일반 HUD보다 위
  display: "flex",
  flexDirection: "column",
  justifyContent: "flex-end",
  // 맵 탭을 가로채 "탭=다음"으로 소비 (대사 중엔 맵 조작 차단 — 레퍼런스 모달 대화)
  pointerEvents: "auto",
  cursor: "pointer",
  userSelect: "none",
  // 하단 가독성 그라데이션
  background: "linear-gradient(to top, rgba(8,9,11,0.55) 0%, rgba(8,9,11,0.12) 40%, transparent 70%)",
};

const ARROW_KEYFRAMES = `@keyframes tk-dlg-arrow { 0%,100% { transform: translateY(0); opacity: 0.55; } 50% { transform: translateY(3px); opacity: 1; } }`;

function PortraitFrame({ name }: { name: string }): React.ReactElement {
  // portraitId 에셋 파이프라인 연결 전까지는 화자명 머리글자 플레이스홀더(청동 액자).
  return (
    <div
      style={{
        width: 84,
        height: 100,
        flexShrink: 0,
        ...PORTRAIT_FRAME,
        background: "rgba(20, 17, 12, 0.92)",
        backgroundClip: "padding-box",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "#d8c9a0",
        fontSize: 30,
        fontWeight: 700,
      }}
    >
      {name.slice(0, 1)}
    </div>
  );
}

function DialogueBubble({
  line,
  isLast,
  onTap,
}: {
  line: DialogueLine;
  isLast: boolean;
  onTap: () => void;
}): React.ReactElement {
  const { shown, done, onTap: tap } = useTypewriter(line.text, onTap);
  // 초상 좌/우 코너 가변(§344): player/ally=좌, enemy=우. side 미지정 시 좌(기본).
  const portraitRight = line.side === "enemy";

  const handleTap = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      tap();
    },
    [tap],
  );

  return (
    <div
      onClick={handleTap}
      style={{
        display: "flex",
        flexDirection: portraitRight ? "row-reverse" : "row",
        alignItems: "flex-end",
        gap: 10,
        padding: "0 14px calc(20px + env(safe-area-inset-bottom))",
        pointerEvents: "auto",
      }}
    >
      <PortraitFrame name={line.speaker} />
      {/* 둥근 회색 말풍선 — 화자명 파랑 + 본문 검정(레퍼런스 §344) */}
      <div
        style={{
          position: "relative",
          flex: 1,
          maxWidth: 560,
          marginBottom: 8,
          padding: "10px 16px 12px",
          borderRadius: 16,
          background: "rgba(228, 226, 220, 0.97)", // 둥근 회색 말풍선
          border: "2px solid #8a6a3a", // 청동 테두리(독자 스킨)
          boxShadow: "0 4px 16px rgba(0,0,0,0.45)",
          color: "#1a1a1a", // 본문 검정
          fontSize: 16,
          lineHeight: 1.5,
          minHeight: 56,
        }}
      >
        <div style={{ color: "#1e5fb0", fontWeight: 700, fontSize: 14, marginBottom: 3 }}>
          {/* 화자명 = 파랑 (적/중립도 파랑, §344) */}
          {line.speaker}
        </div>
        <div>
          {shown}
          {/* 타이핑 커서 */}
          {!done && <span style={{ opacity: 0.4 }}>▍</span>}
        </div>
        {/* 좌하단 파란 "다음" 화살표 — 타이핑 완료 시(§346) */}
        {done && (
          <div
            style={{
              position: "absolute",
              right: 12,
              bottom: 6,
              color: "#1e5fb0",
              fontSize: 16,
              fontWeight: 800,
              animation: "tk-dlg-arrow 0.9s ease-in-out infinite",
            }}
            aria-hidden
          >
            {isLast ? "✕" : "▼"}
          </div>
        )}
      </div>
    </div>
  );
}

export function DialogueOverlay({
  store,
  dialogue,
}: {
  store: BattleStore;
  /** stage.dialogue (없으면 오버레이 자체가 no-op) */
  dialogue?: readonly StageDialogue[];
}): React.ReactElement | null {
  const [queue, dispatch] = useReducer(queueReducer, { lines: [], playedIds: new Set<string>() });
  // 디렉터 전이 추적 — 직전 디렉터 스냅샷(결정론 상태의 read-only 슬라이스)
  const prevSnapRef = useRef<DialogueSnapshot | null>(null);

  // settledState 구독 — store는 read-only로만 본다(engine·store 미수정)
  const settled = useSyncExternalStore(
    store.subscribe,
    () => store.settledState,
    () => store.settledState,
  );

  // 전이마다 새로 발동된 대사를 큐잉
  useEffect(() => {
    if (!dialogue || dialogue.length === 0) return;
    const next = toDialogueSnapshot(settled);
    const prev = prevSnapRef.current;
    const fired = firedDialogues(dialogue, prev, next, queue.playedIds);
    prevSnapRef.current = next;
    if (fired.length > 0) dispatch({ type: "enqueue", dialogues: fired });
    // queue.playedIds 변경은 enqueue로만 일어나며 동일 fired를 재큐잉하지 않는다 —
    // 의존성에서 제외해 enqueue 루프를 막는다(playedIds는 reducer가 단조 증가시킴).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settled, dialogue]);

  const advance = useCallback(() => dispatch({ type: "advance" }), []);

  if (!dialogue || queue.lines.length === 0) return null;

  const current = queue.lines[0];
  if (!current) return null;
  const isLast = queue.lines.length === 1;

  return (
    <div
      style={OVERLAY_STYLE}
      onClick={advance} // 말풍선 바깥(맵 영역) 탭도 진행으로 소비
    >
      <style>{ARROW_KEYFRAMES}</style>
      <DialogueBubble
        key={`${current.dialogueId}:${queue.lines.length}`}
        line={current.line}
        isLast={isLast}
        onTap={advance}
      />
    </div>
  );
}
