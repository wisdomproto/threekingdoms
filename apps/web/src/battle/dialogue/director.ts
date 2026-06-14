/**
 * 대사 디렉터 (C — 레퍼런스 §344/§347 인게임 이벤트 대화).
 *
 * **순수 표현 채널.** engine·store를 일절 수정하지 않는다. BattleStore 스냅샷을
 * read-only로 구독하고, 결정론 상태(settledState: turn/phase/status/units/duelHistory)의
 * 전이를 디렉터 자체 React 상태로 추적해 트리거를 판정한다.
 *
 * 트리거 판정 (스테이지 dialogue[].trigger):
 *  - battleStart   : 최초 구독 시 1회 (전투 개시 인트로 컷).
 *  - turn(n)       : settled.turn 이 n 에 처음 도달(아군 페이즈)하면.
 *  - duelOccurred  : settled.duelHistory 에 그 duelId 가 처음 나타나면.
 *  - unitRetreated : 그 유닛의 retreated 가 false→true 로 바뀌면.
 *  - battleEnd     : status 가 ongoing→(victory|defeat) 로 바뀌면. result 지정 시 그 결과에만.
 *
 * 각 dialogue.id 는 한 번만 큐잉된다(playedIds). 동시에 여러 트리거가 맞으면
 * 스테이지 정의 순서대로 큐에 쌓이고, 오버레이가 큐를 직렬로 비운다.
 *
 * ⚠️ engine·store 미수정 — 이 모듈은 store의 read-only getter(settledState)와
 * subscribe만 쓴다. 게임 진행/결정론에 어떤 영향도 주지 않는다.
 */
import type { BattleState } from "@tk/engine";
import type { StageDialogue, DialogueTrigger } from "@tk/data";

/** 디렉터가 트리거 판정에 쓰는 결정론 상태의 read-only 슬라이스 */
export interface DialogueSnapshot {
  turn: number;
  status: BattleState["status"];
  duelHistory: readonly string[];
  /** 퇴각한 유닛 id 집합 (retreated=true) */
  retreatedIds: ReadonlySet<string>;
}

/** BattleState → 디렉터 스냅샷 (read-only 추출, 상태 비변경) */
export function toDialogueSnapshot(s: BattleState): DialogueSnapshot {
  const retreatedIds = new Set<string>();
  for (const u of s.units) if (u.retreated) retreatedIds.add(u.id);
  return { turn: s.turn, status: s.status, duelHistory: s.duelHistory, retreatedIds };
}

/**
 * prev→next 전이에서 trigger가 "막 충족됐는지" 판정.
 * prev 가 null 이면 최초 구독 — battleStart 및 이미 성립된 상태(엣지가 아닌 레벨)도 발동시켜
 * 첫 마운트 시점의 인트로를 놓치지 않는다(전투 개시 직후 마운트가 정상 경로).
 */
export function triggerFired(
  trigger: DialogueTrigger,
  prev: DialogueSnapshot | null,
  next: DialogueSnapshot,
): boolean {
  switch (trigger.kind) {
    case "battleStart":
      // 최초 스냅샷에서만 (prev 없음 = 첫 구독)
      return prev === null;
    case "turn":
      // n 턴에 도달 — 첫 구독에 이미 n이면(prev 없음) 발동, 아니면 prev<n && next>=n 엣지
      return next.turn >= trigger.n && (prev === null || prev.turn < trigger.n);
    case "duelOccurred": {
      const inNext = next.duelHistory.includes(trigger.duelId);
      const inPrev = prev?.duelHistory.includes(trigger.duelId) ?? false;
      return inNext && !inPrev;
    }
    case "unitRetreated": {
      const inNext = next.retreatedIds.has(trigger.unitId);
      const inPrev = prev?.retreatedIds.has(trigger.unitId) ?? false;
      return inNext && !inPrev;
    }
    case "battleEnd": {
      const ended = next.status === "victory" || next.status === "defeat";
      if (!ended) return false;
      // result 지정 시 그 결과에만
      if (trigger.result && next.status !== trigger.result) return false;
      // ongoing→ended 엣지 (prev 없으면 첫 구독이 이미 종료 상태인 비정상 케이스 — 발동 허용)
      return prev === null || prev.status === "ongoing";
    }
    default: {
      // 미래 트리거 종류 — 안전 기본(미발동)
      const _exhaustive: never = trigger;
      return _exhaustive;
    }
  }
}

/**
 * 전이에서 새로 발동된 dialogue id 목록을 스테이지 정의 순서대로 반환.
 * playedIds 에 이미 있는 건 제외(각 대사 1회). 호출자가 결과를 playedIds 에 합쳐야 한다.
 */
export function firedDialogues(
  dialogue: readonly StageDialogue[],
  prev: DialogueSnapshot | null,
  next: DialogueSnapshot,
  playedIds: ReadonlySet<string>,
): StageDialogue[] {
  const out: StageDialogue[] = [];
  for (const d of dialogue) {
    if (playedIds.has(d.id)) continue;
    if (triggerFired(d.trigger, prev, next)) out.push(d);
  }
  return out;
}
