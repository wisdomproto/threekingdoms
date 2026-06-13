/**
 * 메타 스토어 (W2 막간 셸 기반 배관) — 전투 밖 영속 진행 상태의 단일 출처.
 *
 * 설계 원칙:
 *  - 순수 reducer(`reduce*`)와 영속 헬퍼(localStorage)를 분리한다. reducer는 window 없이도
 *    동작하므로 node 단위테스트가 가능하다(vitest env=node, §battle 테스트와 동일 정책).
 *  - 영속은 단일 키 `tk.meta.v1`(JSON). 단, gold는 기존 `tk.meta.gold`(metaGold.ts /
 *    ResultSequence 결산)와 **호환**되어야 하므로 로드시 legacy gold를 흡수하고, gold 변경시
 *    legacy 키에도 mirror-write 한다(결산 경로가 아직 addMetaGold를 직접 호출함).
 *  - SSR/비브라우저/쿼터초과 전부 try/catch 가드. 저장 실패는 무시(진행은 메모리로 계속).
 *
 * 다음 단계(화면 에이전트)는 이 모듈의 공개 API만 import 한다:
 *   getMeta, addGold, spendGold, addItem, removeItem, markCleared, getRoster,
 *   setEquipped, reset  + 타입 MetaState, RosterUnit.
 */
import { gameData } from "@tk/data";
import type { RosterEntry } from "@tk/data";

/** 장수별 메타 진행(레벨/경험치/장착) — 전투에 주입될 편성 단위의 영속 부분. */
export interface RosterProgress {
  level: number;
  exp: number;
  /** 장착 itemId 목록(무기/방어구/보조). 인벤토리에서 빠지진 않고 "장착 표시"만. */
  equipped: string[];
}

/** 영속되는 메타 상태 전체. localStorage `tk.meta.v1`에 JSON으로 직렬화된다. */
export interface MetaState {
  /** 누적 자금. 기존 tk.meta.gold와 동기화. */
  gold: number;
  /** 보유 아이템 itemId 목록(상점 구매/보상). 장착 여부와 무관한 소유. */
  inventory: string[];
  /** 클리어한 stageId 목록(중복 없음). 장수 해금/스테이지 선택 게이팅에 사용. */
  clearedStages: string[];
  /** commanderId → 진행. 미보유 장수는 키가 없을 수 있음(getRoster가 기본값 채움). */
  rosterProgress: Record<string, RosterProgress>;
}

/** getRoster() 반환 단위 — RosterEntry(정적) + 메타 진행(동적) 합본. 편성 화면이 그대로 소비. */
export interface RosterUnit {
  commanderId: string;
  classId: string;
  joinChapter: number;
  role: RosterEntry["role"];
  uniqueSkillId?: string;
  level: number;
  exp: number;
  equipped: string[];
}

const STORAGE_KEY = "tk.meta.v1";
const LEGACY_GOLD_KEY = "tk.meta.gold"; // metaGold.ts와 공유 — 결산 경로 호환

/** 신규 게임 초기값(§15 — 시작 자금 0, 빈 인벤토리/클리어). */
export function initialMeta(): MetaState {
  return { gold: 0, inventory: [], clearedStages: [], rosterProgress: {} };
}

/** 합류 기본 레벨(§6 후발 합류 평균 보정은 추후 — 지금은 1). */
const DEFAULT_LEVEL = 1;

// ---------------------------------------------------------------------------
// 순수 reducer — window 불필요(node 테스트 대상). 입력 state를 변형하지 않고 새 객체 반환.
// ---------------------------------------------------------------------------

export function reduceAddGold(s: MetaState, n: number): MetaState {
  const delta = Math.max(0, Math.floor(n));
  if (delta === 0) return s;
  return { ...s, gold: s.gold + delta };
}

/** 자금 차감. 부족하면 null(호출부에서 false로 변환). 음수/소수 입력은 floor·clamp. */
export function reduceSpendGold(s: MetaState, n: number): MetaState | null {
  const cost = Math.max(0, Math.floor(n));
  if (cost > s.gold) return null;
  return { ...s, gold: s.gold - cost };
}

export function reduceAddItem(s: MetaState, itemId: string): MetaState {
  return { ...s, inventory: [...s.inventory, itemId] };
}

/** 첫 일치 1개만 제거(중복 아이템 보유 허용). 없으면 그대로. */
export function reduceRemoveItem(s: MetaState, itemId: string): MetaState {
  const i = s.inventory.indexOf(itemId);
  if (i < 0) return s;
  const inventory = s.inventory.slice();
  inventory.splice(i, 1);
  return { ...s, inventory };
}

export function reduceMarkCleared(s: MetaState, stageId: string): MetaState {
  if (s.clearedStages.includes(stageId)) return s;
  return { ...s, clearedStages: [...s.clearedStages, stageId] };
}

export function reduceSetEquipped(s: MetaState, commanderId: string, items: string[]): MetaState {
  const prev = s.rosterProgress[commanderId] ?? { level: DEFAULT_LEVEL, exp: 0, equipped: [] };
  return {
    ...s,
    rosterProgress: {
      ...s.rosterProgress,
      [commanderId]: { ...prev, equipped: [...items] },
    },
  };
}

/**
 * 보유/합류한 장수 목록(순수). joinChapter 게이팅:
 *  - 1장(튜토리얼 시작) 장수는 항상 해금.
 *  - 이후 장은 "직전 장의 마지막 스테이지를 클리어"로 해금하는 게 이상적이나,
 *    M1은 스테이지 1개뿐이라 매핑이 없다. 따라서 현재 규칙은 보수적으로:
 *      해금 챕터 = 1 + (클리어한 스테이지 수). 즉 아무것도 안 깼으면 1장만,
 *      한 스테이지 깰 때마다 다음 장이 열린다(화면이 채워지면 chapter 맵으로 교체 예정 — TODO).
 *  rosterProgress가 없는 장수는 기본값(level 1/exp 0/equipped [])으로 채워 반환.
 */
export function selectRoster(
  s: MetaState,
  rosters: Record<string, RosterEntry>,
): RosterUnit[] {
  const unlockedChapter = 1 + s.clearedStages.length;
  const out: RosterUnit[] = [];
  for (const entry of Object.values(rosters)) {
    if (entry.joinChapter > unlockedChapter) continue;
    const p = s.rosterProgress[entry.commanderId];
    out.push({
      commanderId: entry.commanderId,
      classId: entry.classId,
      joinChapter: entry.joinChapter,
      role: entry.role,
      uniqueSkillId: entry.uniqueSkillId,
      level: p?.level ?? DEFAULT_LEVEL,
      exp: p?.exp ?? 0,
      equipped: p?.equipped ?? [],
    });
  }
  return out;
}

// ---------------------------------------------------------------------------
// 영속 레이어 — localStorage. 비브라우저/실패는 메모리 캐시로 폴백.
// ---------------------------------------------------------------------------

function hasStorage(): boolean {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

/** 메모리 캐시(비브라우저 또는 영속 실패 환경에서 세션 일관성 유지). */
let memory: MetaState | null = null;

function readLegacyGold(): number {
  if (!hasStorage()) return 0;
  try {
    const raw = window.localStorage.getItem(LEGACY_GOLD_KEY);
    const n = raw == null ? 0 : Number.parseInt(raw, 10);
    return Number.isFinite(n) && n >= 0 ? n : 0;
  } catch {
    return 0;
  }
}

function loadFromStorage(): MetaState {
  if (!hasStorage()) return memory ?? initialMeta();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw == null) {
      // v1 키가 없으면 신규 — 단, 결산이 먼저 쌓은 legacy gold가 있으면 흡수.
      const base = initialMeta();
      base.gold = readLegacyGold();
      return base;
    }
    const parsed = JSON.parse(raw) as Partial<MetaState>;
    const state: MetaState = {
      gold: typeof parsed.gold === "number" && parsed.gold >= 0 ? Math.floor(parsed.gold) : 0,
      inventory: Array.isArray(parsed.inventory) ? parsed.inventory.filter((x) => typeof x === "string") : [],
      clearedStages: Array.isArray(parsed.clearedStages) ? parsed.clearedStages.filter((x) => typeof x === "string") : [],
      rosterProgress: isRosterProgressMap(parsed.rosterProgress) ? parsed.rosterProgress : {},
    };
    // legacy gold가 v1보다 크면(결산이 v1 밖에서 누적했을 수 있음) 더 큰 값 채택.
    const legacy = readLegacyGold();
    if (legacy > state.gold) state.gold = legacy;
    return state;
  } catch {
    return memory ?? initialMeta();
  }
}

function isRosterProgressMap(v: unknown): v is Record<string, RosterProgress> {
  if (typeof v !== "object" || v === null) return false;
  return Object.values(v).every(
    (p) =>
      typeof p === "object" &&
      p !== null &&
      typeof (p as RosterProgress).level === "number" &&
      typeof (p as RosterProgress).exp === "number" &&
      Array.isArray((p as RosterProgress).equipped),
  );
}

function saveToStorage(s: MetaState): void {
  memory = s;
  if (!hasStorage()) return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
    // gold는 legacy 키에도 mirror — 결산(addMetaGold/readMetaGold) 경로와 한 값 유지.
    window.localStorage.setItem(LEGACY_GOLD_KEY, String(s.gold));
  } catch {
    // 쿼터/프라이빗 모드 — 메모리 캐시로만 유지.
  }
}

// ---------------------------------------------------------------------------
// 공개 API — 화면 에이전트가 사용. 각 호출은 load → reduce → save.
// ---------------------------------------------------------------------------

/** 현재 메타 상태 스냅샷(읽기 전용 용도). 매 호출 localStorage에서 재로드. */
export function getMeta(): MetaState {
  return loadFromStorage();
}

/** 자금 누적. 새 합계 반환. */
export function addGold(n: number): number {
  const next = reduceAddGold(loadFromStorage(), n);
  saveToStorage(next);
  return next.gold;
}

/** 자금 차감. 부족하면 false(상태 불변), 성공하면 true. */
export function spendGold(n: number): boolean {
  const next = reduceSpendGold(loadFromStorage(), n);
  if (next === null) return false;
  saveToStorage(next);
  return true;
}

/** 아이템 1개 획득(인벤토리에 추가). */
export function addItem(itemId: string): void {
  saveToStorage(reduceAddItem(loadFromStorage(), itemId));
}

/** 아이템 1개 제거(첫 일치). */
export function removeItem(itemId: string): void {
  saveToStorage(reduceRemoveItem(loadFromStorage(), itemId));
}

/** 스테이지 클리어 기록(중복 무시). */
export function markCleared(stageId: string): void {
  saveToStorage(reduceMarkCleared(loadFromStorage(), stageId));
}

/** 장수 장착 갱신(편성 화면). */
export function setEquipped(commanderId: string, items: string[]): void {
  saveToStorage(reduceSetEquipped(loadFromStorage(), commanderId, items));
}

/**
 * 보유/합류 장수 목록 + 메타 진행 합본. 인자 없으면 gameData.rosters 사용.
 * 편성 화면이 출진 후보를 그리는 1차 소스.
 */
export function getRoster(rosters: Record<string, RosterEntry> = gameData.rosters): RosterUnit[] {
  return selectRoster(loadFromStorage(), rosters);
}

/** 신규 게임 초기화 — v1 + legacy gold 키 모두 정리. */
export function reset(): void {
  memory = initialMeta();
  if (!hasStorage()) return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
    window.localStorage.removeItem(LEGACY_GOLD_KEY);
  } catch {
    // 무시 — 메모리 캐시는 초기화됨.
  }
}
