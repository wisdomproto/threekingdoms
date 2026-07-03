/**
 * 전투 실험실(§dev — /lab) 계약 — 자유 편성으로 전투 시스템 전체를 테스트하는 샌드박스.
 *
 * 흐름: LabScreen(빌더 UI)이 LabPayload를 sessionStorage `tk.lab`에 쓰고
 * `/battle?stage=__lab`으로 이동 → BattleScreen.makeCtx가 URL의 stage=__lab을 보고
 * 이 페이로드로 ctx(스테이지·맵·공유풀·시드)를 구성한다. 정규 스테이지 경로는 불변.
 *
 * 메타 불가침: 실험실 전투는 결산에서 **어떤 메타도 쓰지 않는다**(골드/클리어/레벨 영속 전부
 * 생략 — ResultSequence sandbox 모드). 승급 테스트 = 엔진 승급 메커니즘이 아직 없으므로(§4 후속)
 * 같은 장수를 티어 다른 병종(경기병→중기병→친위대)으로 편성해 A/B 하는 방식.
 */
import type { Stage, StageUnit, BattleMap, Weather } from "@tk/data";

export const LAB_STAGE_ID = "__lab";
const LAB_KEY = "tk.lab";

export interface LabPayload {
  stage: Stage;
  map: BattleMap;
  /** friendly 공유 소모품 풀(원작 창고 §7) — 전투 「도구」 테스트용. */
  sharedItems: string[];
  /** 전투 시드(시드확률 재현 테스트 — 같은 시드+행동열=같은 롤). */
  seed: number;
}

/**
 * 실험실 맵 — 20×14 종합 지형 시험장. 세로 강(x=10)+다리(y=6·8), 숲/산(지형 guard·이동비용),
 * 촌락/병영(턴 회복 §10), 창고. 스폰 열(x=2·4 / x=15·17)은 평지 보장.
 */
export function buildLabMap(): BattleMap {
  const tiles = [
    "ggggggggggrggggggggg",
    "g..ff.....r....mm..g",
    "...ff.....r....mm...",
    "..........r.........",
    "...v......r......b..",
    "..........r.........",
    "..........B.........",
    "..........r.........",
    "..........B.........",
    "...b......r......v..",
    "...ff.....r....d....",
    "..gff.....r.........",
    "g.........r........g",
    "ggggggggggrggggggggg",
  ];
  for (const [i, row] of tiles.entries()) {
    if (row.length !== 20) throw new Error(`lab map row ${i} length ${row.length} ≠ 20`);
  }
  return {
    id: "__lab-map",
    name: "실험장",
    width: 20,
    height: 14,
    tileLegend: {
      ".": "plain", g: "grass", f: "forest", m: "mountain",
      v: "village", b: "barracks", d: "depot", r: "river", B: "bridge",
    },
    tiles,
  };
}

/** 진영별 스폰 좌표 — 강 양안 평지 열에 세로 배치(최대 8기). */
export function labSpawn(side: "player" | "enemy", index: number): { x: number; y: number } {
  const col = side === "player" ? [2, 4] : [17, 15];
  return { x: col[index % 2]!, y: 3 + Math.floor(index / 2) * 2 };
}

export function buildLabStage(units: StageUnit[], weather: Weather): Stage {
  return {
    id: LAB_STAGE_ID,
    name: "전투 실험실",
    mapId: "__lab-map",
    turnLimit: 99,
    weather,
    levelCap: 99,
    // 레벨 자동 승급(§7) OFF — 빌더에서 고른 병종 티어를 그대로 보존(승급 A/B 테스트의 전제).
    // 자동 승급 자체를 보고 싶으면 T1 병종 + 임계 직전 레벨(14/29)로 편성해 전투 중 레벨업으로 관찰.
    autoPromote: false,
    units,
    objectives: [{ kind: "defeatAll", optional: false }],
    failConditions: [], // 패배 조건 없음 — 아군 전멸도 관찰 대상(전투는 defeat로 끝난다)
    events: [],
  };
}

function hasSession(): boolean {
  return typeof window !== "undefined" && typeof window.sessionStorage !== "undefined";
}

export function writeLab(payload: LabPayload): void {
  if (!hasSession()) return;
  try {
    window.sessionStorage.setItem(LAB_KEY, JSON.stringify(payload));
  } catch {
    // 저장 실패 — /battle 진입 시 페이로드 없음으로 흘러 기본 스테이지 로드(무해).
  }
}

export function readLab(): LabPayload | null {
  if (!hasSession()) return null;
  try {
    const raw = window.sessionStorage.getItem(LAB_KEY);
    if (raw == null) return null;
    const p = JSON.parse(raw) as Partial<LabPayload>;
    if (!p.stage || !p.map || !Array.isArray(p.sharedItems) || typeof p.seed !== "number") return null;
    return p as LabPayload;
  } catch {
    return null;
  }
}
