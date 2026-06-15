/**
 * 기연(奇緣) 순수 로직 (설계 §12 기연 시스템 / docs/superpowers/specs/2026-06-15-serendipity-system-design.md).
 *
 * 클리어로 쌓인 도파민(콤보·필살·보물)의 "출구": 클리어 시 기연 포인트를 적립하고(결산),
 * 막간 전용 화면에서 텍스트 연출과 함께 뽑아 보상(자금/소모품/기연 전용 경미 보물)을 얻는다.
 *
 * **결정론 ethos**: 기연 무작위는 전투 밖 메타라 리플레이/리더보드/밸런스 sim과 무관(§14).
 * "랜덤은 재미로"(§2-5)에 부합. 무작위원은 외부에서 주입(rng: () => number)해 이 모듈은
 * 순수·테스트 가능(resultSummary 패턴 동일). 천장 카운터는 metaStore에 영속.
 *
 * **풀 가드레일**(§10/§15): 풀의 보물은 **기연 전용 경미 보물(qiyuan-*)만** — 스테이지 고유·
 * 도감 보물은 제외해 도감 2회차 동력·스테이지 설계·밸런스 sim을 침범하지 않는다.
 */

/** 한 번의 기연 보상 — 자금 또는 아이템(소모품/기연 전용 보물). */
export type SerendipityReward =
  | { kind: "gold"; amount: number }
  | { kind: "item"; itemId: string };

/** 뽑기 1회 비용(기연 포인트). */
export const PULL_COST = 3;
/** 천장: 이 횟수만큼 보물 없이 뽑으면 다음 뽑기는 보물 확정. */
export const PITY_CAP = 10;
/** 자연 보물 확률(천장 전). */
export const RARE_CHANCE = 0.08;

/** 가중 보상 엔트리. */
interface WeightedReward {
  weight: number;
  reward: SerendipityReward;
}

/**
 * common 풀 — 자금 버킷(소·중·대) + 소모품(items.json `supplyItem`/`attackItem`).
 * 소모품 id는 실제 데이터의 범용 회복/공격 아이템에서 선별(IP 무관 범용명).
 */
export const SERENDIPITY_COMMON: WeightedReward[] = [
  { weight: 28, reward: { kind: "gold", amount: 30 } },
  { weight: 16, reward: { kind: "gold", amount: 80 } },
  { weight: 6, reward: { kind: "gold", amount: 150 } },
  { weight: 14, reward: { kind: "item", itemId: "상약" } }, // 회복
  { weight: 8, reward: { kind: "item", itemId: "한방약" } }, // 상위 회복
  { weight: 10, reward: { kind: "item", itemId: "술" } }, // 사기/버프
  { weight: 8, reward: { kind: "item", itemId: "폭탄" } }, // 공격 소모품
  { weight: 6, reward: { kind: "item", itemId: "화룡서" } }, // 공격 소모품(화공)
];

/** rare 풀 — 기연 전용 경미 보물(약한 고정효과). items.json `qiyuan-*`와 1:1. */
export const SERENDIPITY_RARE: { itemId: string }[] = [
  { itemId: "qiyuan-charm" }, // 기연의 부적 — 방어 +5%
  { itemId: "qiyuan-token" }, // 여정의 호패 — 기동 +1
  { itemId: "qiyuan-relic" }, // 노승의 염주 — 정신 +5%
];

/**
 * 기연 전용 보물 여부(§10 도감 분리). 도감(Codex)은 *스테이지 보물*만 나열해야 하므로
 * 이 술어로 기연 전용 보물(qiyuan-*)을 도감 목록에서 배제한다 — 도감 2회차 동력 보존.
 */
export function isSerendipityTreasure(itemId: string): boolean {
  return itemId.startsWith("qiyuan-");
}

/**
 * "이야기처럼" 포장(§12)용 창작 한국어 플레이버 — 코에이 텍스트 무관.
 * 뽑기 연출에서 보상 공개 직전 1줄 페이드인.
 */
export const FLAVOR_LINES: string[] = [
  "행군 길목에서 한 노인이 봇짐을 건네고 사라졌다.",
  "버려진 사당 한켠, 먼지 쌓인 함이 눈에 들었다.",
  "패잔병이 목숨을 구걸하며 품의 물건을 내밀었다.",
  "촌로가 은혜를 갚겠다며 손에 무언가를 쥐여 주었다.",
  "강기슭에 떠내려온 궤짝을 군사가 건져 올렸다.",
  "장터의 떠돌이 상인이 헐값에 좌판을 정리하고 있었다.",
  "밤하늘 유성이 떨어진 자리에 낯선 물건이 남았다.",
  "오래된 우물 바닥에서 미끄러운 무언가가 만져졌다.",
];

/** 등급별 첫 클리어 적립 포인트. */
const FIRST_CLEAR_POINTS: Record<string, number> = { S: 5, A: 4, B: 3, C: 2, D: 1 };
/** 재도전 적립(파밍 방지 §11 — 등급 무관 소액). */
const REPLAY_POINTS = 1;

/**
 * 가중 추첨(순수). roll∈[0,1)을 총 weight로 스케일해 누적 구간에서 선택. 상한 클램프.
 * 빈 배열이면 throw(호출부가 비지 않음을 보장 — 상수 풀은 항상 채워짐).
 */
export function weightedPick<T>(entries: { weight: number; value: T }[], roll: number): T {
  if (entries.length === 0) throw new Error("weightedPick: empty entries");
  const total = entries.reduce((sum, e) => sum + e.weight, 0);
  let acc = Math.max(0, Math.min(roll, 0.999999)) * total;
  for (const e of entries) {
    acc -= e.weight;
    if (acc < 0) return e.value;
  }
  return entries[entries.length - 1]!.value; // 부동소수 안전망
}

/** 뽑기 1회 결과(순수). 보상 적용/포인트 차감은 호출부(metaStore). */
export interface PullOutcome {
  reward: SerendipityReward;
  nextPity: number;
  wasRare: boolean;
}

/**
 * 뽑기 추첨(순수). rng()을 두 번 소비:
 *  1) rare 여부(천장 도달이면 rng 무관 확정), 2) 풀 내 선택.
 * rare면 nextPity=0, common이면 nextPity=pity+1.
 */
export function rollSerendipity(pity: number, rng: () => number): PullOutcome {
  const forced = pity + 1 >= PITY_CAP;
  const isRare = forced || rng() < RARE_CHANCE;
  if (isRare) {
    const rare = weightedPick(
      SERENDIPITY_RARE.map((r) => ({ weight: 1, value: r })),
      rng(),
    );
    return { reward: { kind: "item", itemId: rare.itemId }, nextPity: 0, wasRare: true };
  }
  const reward = weightedPick(
    SERENDIPITY_COMMON.map((e) => ({ weight: e.weight, value: e.reward })),
    rng(),
  );
  return { reward, nextPity: pity + 1, wasRare: false };
}

/** 플레이버 1줄 선택(순수). */
export function pickFlavor(roll: number): string {
  return weightedPick(
    FLAVOR_LINES.map((line) => ({ weight: 1, value: line })),
    roll,
  );
}

/** 클리어 적립 포인트(순수). 첫 클리어=등급 기반, 재도전=소액(파밍 방지). */
export function clearReward(grade: "S" | "A" | "B" | "C" | "D", firstClear: boolean): number {
  if (!firstClear) return REPLAY_POINTS;
  return FIRST_CLEAR_POINTS[grade] ?? REPLAY_POINTS;
}
