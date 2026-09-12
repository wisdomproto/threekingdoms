/**
 * 중단 저장 — 「저장하고 나가기」/「이어하기」 (스펙 §7).
 * 페이로드 = seed + actionLog(엔진 fold로 복원, store `replayLog` 옵션) + 편성. 키 `tk.battle.suspend.v1`.
 * 저장 가능 시점은 *아군 idle*뿐 — 복원 후 ui가 idle이라는 전제가 여기서 보장된다.
 * 순수 판정(canSuspend/isResumable)과 영속(localStorage)을 분리 — 순수부는 node 단위테스트 대상.
 */
import type { Action, BattleState } from "@tk/engine";
import type { SortiePayload } from "../meta/sortie";
import type { InputState } from "./inputMachine";

export interface SuspendedBattle {
  version: 1;
  stageId: string;
  seed: number;
  /** 편성(없으면 null — 이어하기 시 원본 배치) */
  sortie: SortiePayload | null;
  log: Action[];
  /** 회차 — 불일치면 복원 불가(적 강화 배율이 달라 로그가 안 맞는다) */
  playthroughCount: number;
  /** 표시용(이어하기 배너) */
  turn: number;
  savedAt: string;
}

const STORAGE_KEY = "tk.battle.suspend.v1";

/** 아군 차례에 행동을 고르기 전(idle)에만 저장 가능. */
export function canSuspend(ui: Pick<InputState, "kind">, battle: Pick<BattleState, "phase" | "status">): boolean {
  return ui.kind === "idle" && battle.phase === "player" && battle.status === "ongoing";
}

export function isResumable(
  s: SuspendedBattle | null,
  env: { playthroughCount: number; hasStage: (id: string) => boolean },
): s is SuspendedBattle {
  return s?.version === 1 && env.hasStage(s.stageId) && s.playthroughCount === env.playthroughCount;
}

function hasStorage(): boolean {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

/** 저장본 로드 — 없거나 비브라우저/손상/형식 불일치면 null. */
export function readSuspend(): SuspendedBattle | null {
  if (!hasStorage()) return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw == null) return null;
    const s = JSON.parse(raw) as Partial<SuspendedBattle> | null;
    if (
      s?.version === 1 &&
      typeof s.stageId === "string" &&
      Array.isArray(s.log) &&
      typeof s.seed === "number"
    ) {
      return s as SuspendedBattle;
    }
    return null;
  } catch {
    return null;
  }
}

/** 저장(비브라우저/쿼터초과는 무시). */
export function writeSuspend(s: SuspendedBattle): void {
  if (!hasStorage()) return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
  } catch {
    // 무시
  }
}

export function clearSuspend(): void {
  if (!hasStorage()) return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // 무시
  }
}
