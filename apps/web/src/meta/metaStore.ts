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
import { registerAdFreeProvider } from "./adService";
import { PULL_COST, rollSerendipity } from "./serendipity";
import type { PullOutcome, SerendipityReward } from "./serendipity";

/** 장수별 메타 진행(레벨/경험치/장착) — 전투에 주입될 편성 단위의 영속 부분. */
export interface RosterProgress {
  level: number;
  exp: number;
  /** 장착 itemId 목록(무기/방어구/보조). 인벤토리에서 빠지진 않고 "장착 표시"만. */
  equipped: string[];
}

/** 일일 광고 캡 카운터(§13 — 상점 골드 충전 일일 캡). 날짜가 바뀌면 롤오버. */
export interface AdGoldCap {
  /** YYYY-MM-DD(로컬). 이 날짜의 시청 횟수만 집계. */
  date: string;
  /** 오늘 시청 횟수. */
  count: number;
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
  /** 광고제거(통구매/IAP §13). true면 AdService가 광고 UI를 띄우지 않음. 기본 false. */
  adFree: boolean;
  /** 상점 골드 충전 일일 캡 카운터(§13). 미설정/날짜 경과는 0으로 간주. */
  adGoldCap?: AdGoldCap;
  /** 기연 포인트(§12) — 클리어로 적립, 뽑기로 소모. 신규 필드(구버전 로드 시 0). */
  serendipity: number;
  /** 기연 천장 카운터(§12) — 보물 없이 뽑은 연속 횟수. 보물 획득 시 0. */
  serendipityPity: number;
  /**
   * 이탈한 장수 commanderId 목록(§6 — 서서·진등). departsAfterStage 클리어 시 자동 기록.
   * selectRoster에서 이 목록을 걸러 편성 화면에 보이지 않도록 한다.
   */
  departedCharacters: string[];
  /** 2회차 카운터(§11). 0=1회차(첫 플레이), 1=2회차, …. startNewGame()이 증가시킨다. */
  playthroughCount: number;
}

/** 상점 골드 충전 광고 일일 캡(§13 "소액·일일 캡"). 하루 최대 시청 횟수. */
export const AD_GOLD_DAILY_CAP = 5;

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

/** 신규 게임 초기값(§15 — 시작 자금 0, 빈 인벤토리/클리어, 광고 ON). */
export function initialMeta(): MetaState {
  return {
    gold: 0,
    inventory: [],
    clearedStages: [],
    rosterProgress: {},
    adFree: false,
    serendipity: 0,
    serendipityPity: 0,
    departedCharacters: [],
    playthroughCount: 0,
  };
}

/** 이탈 장수 1명의 장착 아이템을 인벤토리로 돌려보내고 위로금 골드를 지급(§6). */
const DEPARTURE_GOLD_REFUND = 300;
export function reduceDeparture(s: MetaState, commanderId: string): MetaState {
  if (s.departedCharacters.includes(commanderId)) return s;
  const progress = s.rosterProgress[commanderId];
  const equippedItems = progress?.equipped ?? [];
  let next: MetaState = {
    ...s,
    departedCharacters: [...s.departedCharacters, commanderId],
    // 장착 아이템 인벤토리 반환
    inventory: [...s.inventory, ...equippedItems],
    // 장착 기록 초기화(이탈 후 스테이지에서 참조되지 않도록)
    rosterProgress: progress
      ? { ...s.rosterProgress, [commanderId]: { ...progress, equipped: [] } }
      : s.rosterProgress,
  };
  next = reduceAddGold(next, DEPARTURE_GOLD_REFUND);
  return next;
}

/**
 * stageId를 클리어했을 때 departsAfterStage가 일치하는 장수들을 이탈 처리.
 * rosters는 gameData.rosters(기본값) — 테스트에서 주입 가능하도록 파라미터화.
 */
export function reduceTriggerDepartures(
  s: MetaState,
  stageId: string,
  rosters: Record<string, RosterEntry> = gameData.rosters,
): MetaState {
  let next = s;
  for (const entry of Object.values(rosters)) {
    if (entry.departsAfterStage === stageId) {
      next = reduceDeparture(next, entry.commanderId);
    }
  }
  return next;
}

/** 로컬 날짜 키(YYYY-MM-DD). 캡 롤오버 기준. 테스트는 now 주입 가능. */
export function localDateKey(now: Date = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
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

/** 광고제거 플래그 설정(통구매/IAP §13). 동일값이면 불변 참조. */
export function reduceSetAdFree(s: MetaState, on: boolean): MetaState {
  if (s.adFree === on) return s;
  return { ...s, adFree: on };
}

/** 오늘 날짜 기준 시청 횟수(날짜가 바뀌었으면 0). */
export function adGoldCountToday(s: MetaState, dateKey: string): number {
  const cap = s.adGoldCap;
  if (!cap || cap.date !== dateKey) return 0;
  return cap.count;
}

/**
 * 상점 골드 충전 광고를 더 볼 수 있는가(§13 일일 캡). 날짜 롤오버는 0으로 리셋되어 자동 처리.
 * 가드레일: 이 캡은 *골드 충전*에만 — 진행/전투를 막지 않는다(거부해도 무손실).
 */
export function canWatchAdForGold(s: MetaState, dateKey: string = localDateKey()): boolean {
  return adGoldCountToday(s, dateKey) < AD_GOLD_DAILY_CAP;
}

/**
 * 광고 골드 충전 1회 기록(시청 완주 후 호출). 날짜가 바뀌었으면 카운터를 새 날짜 1로 리셋.
 * 캡 도달 상태에서 호출돼도 그대로 증가(상한 enforcement는 canWatchAdForGold가 사전 차단).
 * **골드 지급은 하지 않는다** — addGold를 별도로 호출(보상=골드만, §13 가드레일).
 */
export function reduceRecordAdGold(s: MetaState, dateKey: string = localDateKey()): MetaState {
  const prev = adGoldCountToday(s, dateKey);
  return { ...s, adGoldCap: { date: dateKey, count: prev + 1 } };
}

/** 기연 포인트 가산(§12). floor·clamp, 0/음수는 불변 참조. */
export function reduceAddSerendipity(s: MetaState, n: number): MetaState {
  const delta = Math.max(0, Math.floor(n));
  if (delta === 0) return s;
  return { ...s, serendipity: s.serendipity + delta };
}

/**
 * 뽑기 1회 적용(§12, 원자적). 포인트 부족(< PULL_COST)이면 null.
 * 비용 차감 + pity 갱신(outcome.nextPity) + 보상 적용(gold→reduceAddGold / item→reduceAddItem).
 * 무작위 추첨은 rollSerendipity(순수)에서 이미 끝났고, 여기선 그 결과만 영속 상태에 반영한다.
 */
export function reduceApplyPull(s: MetaState, outcome: PullOutcome): MetaState | null {
  if (s.serendipity < PULL_COST) return null;
  let next: MetaState = { ...s, serendipity: s.serendipity - PULL_COST, serendipityPity: outcome.nextPity };
  const reward: SerendipityReward = outcome.reward;
  if (reward.kind === "gold") next = reduceAddGold(next, reward.amount);
  else next = reduceAddItem(next, reward.itemId);
  return next;
}

export function reduceMarkCleared(
  s: MetaState,
  stageId: string,
  rosters: Record<string, RosterEntry> = gameData.rosters,
): MetaState {
  if (s.clearedStages.includes(stageId)) return s;
  let next: MetaState = { ...s, clearedStages: [...s.clearedStages, stageId] };
  // 이탈 조건 체크 — 해당 스테이지 클리어 시 departsAfterStage 장수 이탈 처리.
  next = reduceTriggerDepartures(next, stageId, rosters);
  return next;
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
  maxChapter?: number,
): RosterUnit[] {
  // maxChapter 지정(편성 화면이 *그 스테이지의 챕터*를 넘김) 시 그 챕터로 게이팅 —
  // 후반 장수(제갈량 등)가 클리어 누적만으로 1장 스테이지에 등장하던 버그 방지.
  // 미지정 시 종전 휴리스틱(1 + 클리어 수) — 전역 로스터 조회 등 챕터 맥락이 없는 호출용.
  const unlockedChapter = maxChapter ?? 1 + s.clearedStages.length;
  const departed = new Set(s.departedCharacters ?? []);
  const out: RosterUnit[] = [];
  for (const entry of Object.values(rosters)) {
    if (entry.joinChapter > unlockedChapter) continue;
    if (departed.has(entry.commanderId)) continue; // 이탈 장수 제외(§6)
    const p = s.rosterProgress[entry.commanderId];
    out.push({
      commanderId: entry.commanderId,
      classId: entry.classId,
      joinChapter: entry.joinChapter,
      role: entry.role,
      uniqueSkillId: entry.uniqueSkillId,
      level: p?.level ?? DEFAULT_LEVEL,
      exp: p?.exp ?? 0,
      equipped: p?.equipped ?? entry.startItems ?? [], // ★ 시작 장비(Phase F) — 진행 저장 없으면 startItems(없으면 [])
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
      adFree: parsed.adFree === true, // 누락/구버전은 false(광고 ON)
      adGoldCap: isAdGoldCap(parsed.adGoldCap) ? parsed.adGoldCap : undefined,
      // 기연(§12) — 신규 필드. 구버전 로드 시 누락 → 0(파괴적 마이그레이션 없음).
      serendipity:
        typeof parsed.serendipity === "number" && parsed.serendipity >= 0
          ? Math.floor(parsed.serendipity)
          : 0,
      serendipityPity:
        typeof parsed.serendipityPity === "number" && parsed.serendipityPity >= 0
          ? Math.floor(parsed.serendipityPity)
          : 0,
      // 이탈 장수(§6) — 신규 필드. 구버전 로드 시 빈 배열.
      departedCharacters: Array.isArray(parsed.departedCharacters)
        ? parsed.departedCharacters.filter((x) => typeof x === "string")
        : [],
      // 2회차(§11) — 신규 필드. 구버전은 첫 플레이(0).
      playthroughCount:
        typeof parsed.playthroughCount === "number" && parsed.playthroughCount >= 0
          ? Math.floor(parsed.playthroughCount)
          : 0,
    };
    // legacy gold가 v1보다 크면(결산이 v1 밖에서 누적했을 수 있음) 더 큰 값 채택.
    const legacy = readLegacyGold();
    if (legacy > state.gold) state.gold = legacy;
    return state;
  } catch {
    return memory ?? initialMeta();
  }
}

function isAdGoldCap(v: unknown): v is AdGoldCap {
  return (
    typeof v === "object" &&
    v !== null &&
    typeof (v as AdGoldCap).date === "string" &&
    typeof (v as AdGoldCap).count === "number"
  );
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

/** 기연 포인트 누적(§12 — 결산 적립). 새 합계 반환. */
export function addSerendipity(n: number): number {
  const next = reduceAddSerendipity(loadFromStorage(), n);
  saveToStorage(next);
  return next.serendipity;
}

/** 현재 기연 포인트(표시용). */
export function getSerendipity(): number {
  return loadFromStorage().serendipity;
}

/** 현재 기연 천장 카운터(표시용 — "천장까지 N회"). */
export function getSerendipityPity(): number {
  return loadFromStorage().serendipityPity;
}

/**
 * 기연 뽑기 1회(§12). rng(() => number)을 주입받아 rollSerendipity(순수)로 추첨하고,
 * 비용 차감·pity 갱신·보상 적립을 원자적으로 영속한다. 포인트 부족이면 null(상태 불변).
 * 화면은 Math.random을 rng로 넘기고, 반환된 {reward, wasRare}로 연출만 입힌다.
 */
export function pullSerendipity(rng: () => number): { reward: SerendipityReward; wasRare: boolean } | null {
  const s = loadFromStorage();
  if (s.serendipity < PULL_COST) return null;
  const outcome = rollSerendipity(s.serendipityPity, rng);
  const next = reduceApplyPull(s, outcome);
  if (next === null) return null;
  saveToStorage(next);
  return { reward: outcome.reward, wasRare: outcome.wasRare };
}

/** 장수 장착 갱신(편성 화면). */
export function setEquipped(commanderId: string, items: string[]): void {
  saveToStorage(reduceSetEquipped(loadFromStorage(), commanderId, items));
}

/**
 * 보유/합류 장수 목록 + 메타 진행 합본. 인자 없으면 gameData.rosters 사용.
 * 편성 화면이 출진 후보를 그리는 1차 소스.
 */
export function getRoster(
  maxChapter?: number,
  rosters: Record<string, RosterEntry> = gameData.rosters,
): RosterUnit[] {
  return selectRoster(loadFromStorage(), rosters, maxChapter);
}

/**
 * 현재 세이브를 JSON 문자열로 직렬화(내보내기).
 * 버전·타임스탬프를 wrapper에 포함해 미래 마이그레이션을 대비한다.
 */
export function exportSave(): string {
  const state = loadFromStorage();
  return JSON.stringify({ version: 1, exportedAt: new Date().toISOString(), state }, null, 2);
}

/**
 * JSON 문자열을 파싱해 세이브를 덮어쓴다(불러오기).
 * - "ok": 정상 반영
 * - "invalid": JSON 파싱 실패 또는 브라우저 환경이 아님
 * - "error": 예상치 못한 오류
 */
export function importSave(json: string): "ok" | "invalid" | "error" {
  if (!hasStorage()) return "invalid"; // 브라우저 전용
  try {
    const wrapper = JSON.parse(json) as Record<string, unknown>;
    // {version, state, ...} wrapper와 MetaState 직접 넣기 둘 다 지원
    const raw = wrapper.state !== undefined ? wrapper.state : wrapper;
    // raw를 STORAGE_KEY에 쓴 뒤 loadFromStorage가 정규화·검증
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(raw));
    const normalized = loadFromStorage();
    saveToStorage(normalized); // 정규화된 상태로 재저장
    return "ok";
  } catch {
    return "error";
  }
}

/** 신규 게임 초기화 — v1 + legacy gold 키 모두 정리. adFree는 보존하지 않음(초기값 false). */
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

/**
 * 2회차 시작(§11 "레벨/보물 일부 계승 + 적 강화"). 다음을 이행한다:
 *  - 계승: 보물(category=treasure) 인벤토리 전량 + gold 50%(상한 5000) + serendipity 50%
 *  - 리셋: clearedStages / rosterProgress / departedCharacters / adGoldCap
 *  - playthroughCount +1 (적 강화 배율 기반 — BattleScreen이 읽어 scaleEnemies)
 *  - adFree는 유지(구매는 영구 효력)
 */
export function startNewGame(
  items: Record<string, { category: string }> = gameData.items,
): void {
  const s = loadFromStorage();
  const treasureInventory = s.inventory.filter((id) => items[id]?.category === "treasure");
  const carryGold = Math.min(5000, Math.floor(s.gold * 0.5));
  const carrySerendipity = Math.floor(s.serendipity * 0.5);
  const next: MetaState = {
    ...initialMeta(),
    gold: carryGold,
    inventory: [...treasureInventory],
    adFree: s.adFree,
    serendipity: carrySerendipity,
    playthroughCount: s.playthroughCount + 1,
  };
  saveToStorage(next);
}

/** 현재 플레이 회차(0=1회차, 1=2회차, …). BattleScreen 적 강화 배율에 사용. */
export function getPlaythroughCount(): number {
  return loadFromStorage().playthroughCount;
}

/** 이탈 장수 commanderId 목록(편성 화면 등에서 참고용). */
export function getDepartedCharacters(): string[] {
  return loadFromStorage().departedCharacters;
}

// ---------------------------------------------------------------------------
// 광고 배관 공개 API (§13) — adService가 isAdFree를 읽고, 적용처가 캡/기록을 쓴다.
// ---------------------------------------------------------------------------

/** 광고제거(adFree) 여부. adService.getAdService()가 이 판정을 읽는다(registerAdFreeProvider). */
export function isAdFree(): boolean {
  return loadFromStorage().adFree;
}

/** 광고제거 설정(통구매/IAP §13). 이후 모든 광고 호출이 즉시 단락된다. */
export function setAdFree(on: boolean): void {
  saveToStorage(reduceSetAdFree(loadFromStorage(), on));
}

/** 오늘 상점 골드 광고를 더 볼 수 있는가(§13 일일 캡). 적용처 버튼의 capReached 판정 소스. */
export function canWatchGoldAd(dateKey: string = localDateKey()): boolean {
  return canWatchAdForGold(loadFromStorage(), dateKey);
}

/** 오늘 상점 골드 광고 시청 횟수(표시용). */
export function getAdGoldCount(dateKey: string = localDateKey()): number {
  return adGoldCountToday(loadFromStorage(), dateKey);
}

/**
 * 광고 골드 충전 1회 기록(시청 완주 직후 호출). **골드는 별도 addGold로 지급**한다 —
 * 이 함수는 캡 카운터만 증가(보상=골드만, 진행 차단 없음 — §13 가드레일).
 * 새 합계 카운트 반환.
 */
export function recordAdGold(dateKey: string = localDateKey()): number {
  const next = reduceRecordAdGold(loadFromStorage(), dateKey);
  saveToStorage(next);
  return next.adGoldCap!.count;
}

// adService 싱글톤이 런타임에 adFree를 읽도록 판정 함수를 등록(느슨 결합, 순환 import 없음).
registerAdFreeProvider(isAdFree);
