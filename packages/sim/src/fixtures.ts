import {
  gameData,
  type BattleMap,
  type Commander,
  type GameData,
  type Stage,
} from "@tk/data";
import type { BattleContext } from "@tk/engine";

/** Stage.units 원소 타입 — @tk/data가 StageUnit 타입을 export하지 않아 Stage에서 파생(데이터 무변경). */
export type StageUnit = Stage["units"][number];

/**
 * 일기토 없는 순수 교전 밸런스 측정용 합성 픽스처.
 *
 * 왜 합성인가:
 *  - shipped 스테이지(05-sishuiguan)는 스크립트 일기토(관우→화웅 즉승)가 victory를 가로채
 *    computeDamage가 한 번도 안 돈다 → 데미지/성장 밸런스가 측정 불능.
 *  - 그래서 events:[] (일기토 0개)인 평지 픽스처를 sim 내부에서 합성한다.
 *    shipped stage JSON·commanders.json·다른 패키지를 일절 건드리지 않는다.
 *
 * 결정론: 엔진 공식은 분산이 없어(난수=시드 보존만) 같은 배치 = 같은 결과.
 * 대표 장수 스탯은 아래에 합성 주입해 commanders.json 변동에 흔들리지 않게 디커플한다
 * (engine/test/fixtures.ts와 동일한 의도).
 */

/** 측정 기준 장수 — 무력/통솔/지력만 의미 있음(공/방/정신 파생). 표시명은 역할. */
export const REF_COMMANDERS: Record<string, Commander> = {
  // 에이스 무관 (관우급) — 높은 무력/통솔/지력
  ace: { id: "ace", name: "에이스무관", war: 96, leadership: 98, intelligence: 90, faceId: 1 },
  // 군주 (유비급)
  lord: { id: "lord", name: "군주", war: 78, leadership: 72, intelligence: 76, faceId: 0 },
  // 적 맹장 (화웅급) — 무력 높고 지력 낮음
  brute: { id: "brute", name: "적맹장", war: 90, leadership: 82, intelligence: 38, faceId: 138 },
  // 잡병/쫄병 — 평균 이하 (길중의 "쫄병 처치 체감" 기준)
  mook: { id: "mook", name: "쫄병", war: 60, leadership: 60, intelligence: 40, faceId: 200 },
  // 문관/책사 (지력 높음)
  caster: { id: "caster", name: "책사", war: 40, leadership: 50, intelligence: 88, faceId: 201 },
};

/** 측정 대표 병종 id (unitClasses.json) — 상성 3계열 + 책사. */
export const REF_CLASSES = {
  cavalry: "lightCavalry", // 기병계 (보병에 유리)
  infantry: "footman", //    보병계 (궁병에 유리)
  archer: "archer", //       궁병계 (기병에 유리), 사거리 2 = 무반격
  caster: "strategist", //   책사 (책략)
} as const;

/** refData = shipped gameData + 합성 대표 장수. (다른 데이터는 전부 shipped 그대로) */
export const refData: GameData = {
  ...gameData,
  commanders: { ...gameData.commanders, ...REF_COMMANDERS },
};

/**
 * N×N 전(全) 평지 맵. 지형 guard=0, 점유 보정 없음 → 데미지 공식 순수 측정.
 * 가장자리도 평지(벽 없음) — 교전이 확실히 일어나게.
 */
export function flatMap(width: number, height: number): BattleMap {
  const row = ".".repeat(width);
  return {
    id: "balance-flat",
    name: "밸런스 평지",
    width,
    height,
    tileLegend: { ".": "plain" },
    tiles: Array.from({ length: height }, () => row),
  };
}

/**
 * 일기토 없는 합성 스테이지를 만든다.
 *  - victory = defeatAll(적 전멸), defeat = lordRetreat(아군 첫 유닛)
 *  - events: [] — 스크립트 일기토 없음 → 모든 격파가 computeDamage 경유
 */
export function skirmishStage(units: StageUnit[], turnLimit = 30): Stage {
  const lord = units.find((u) => u.side === "player");
  if (!lord) throw new Error("skirmishStage needs at least one player unit");
  return {
    id: "balance-skirmish",
    name: "밸런스 교전",
    mapId: "balance-flat",
    turnLimit,
    units,
    victory: { kind: "defeatAll" },
    defeat: { kind: "lordRetreat", unitId: lord.commanderId },
    events: [],
  };
}

/**
 * commanderId의 베이스(접미사 앞부분 또는 전체)로 REF_COMMANDERS/shipped를 찾아
 * 그 스탯을 가진 동명 커맨더를 합성한다. 같은 병종/장수를 여러 칸에 깔 때
 * (engine은 commander.id로 유닛을 구분하므로) id 충돌을 피하기 위함.
 *  - "ace#P0" → 베이스 "ace" 스탯, id "ace#P0"
 *  - 베이스가 commanders에 없으면 그대로(에러는 createBattle에서).
 */
function commanderFor(data: GameData, commanderId: string): Commander | undefined {
  const base = commanderId.split("#")[0]!;
  const src = data.commanders[base];
  if (!src) return undefined;
  return { ...src, id: commanderId, name: commanderId };
}

/** 합성 BattleContext (refData + 평지 맵 + 일기토 없는 스테이지). */
export function skirmishContext(
  units: StageUnit[],
  opts: { width?: number; height?: number; turnLimit?: number } = {},
): BattleContext {
  const width = opts.width ?? 12;
  const height = opts.height ?? 8;
  const map = flatMap(width, height);
  const stage = { ...skirmishStage(units, opts.turnLimit), mapId: map.id };
  // 유닛이 쓰는 (접미사 포함) commanderId 전부를 베이스 스탯으로 등록 — id 충돌 방지
  const commanders = { ...refData.commanders };
  for (const u of units) {
    if (!commanders[u.commanderId]) {
      const c = commanderFor(refData, u.commanderId);
      if (c) commanders[u.commanderId] = c;
    }
  }
  const data: GameData = { ...refData, commanders };
  return { data, stage, map };
}

/** StageUnit 빌더 — 측정 코드 가독용. */
export function unit(
  commanderId: string,
  classId: string,
  level: number,
  troops: number,
  side: "player" | "enemy",
  x: number,
  y: number,
  items: string[] = [],
): StageUnit {
  return { commanderId, classId, level, troops, items, side, x, y };
}
