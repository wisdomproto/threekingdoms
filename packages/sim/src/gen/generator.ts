/**
 * 페이싱 커브 적 배치 생성기 + 자동 조정 (§11-B).
 * docs/superpowers/specs/2026-06-15-pacing-generator-design.md.
 *
 * generate(spec, knob): 레시피 → 적 유닛을 경로% 밴드별 전력 예산으로 배치한 Stage(결정론).
 * autoTune(spec): 난이도 노브를 스캔해 A의 classify가 목표(HEALTHY)에 닿는 후보로 수렴.
 *
 * 적 commanderId는 generic 풀(적병-NN/적장-NN, commanders.json)에서 유일하게 뽑는다 — 엔진이
 * id로 유닛을 구분하므로 중복 불가. 생성물은 신규 콘텐츠(챌린지/2회차/what-if)용이며 사람 검수 후 채택.
 */
import { gameData } from "@tk/data";
import type { Stage, StageUnit } from "@tk/data";
import type { Coord } from "@tk/engine";
import { DEFAULT_CURVE, bandBudgets, type PacingCurve } from "./pacingCurve";
import { unitForce, totalForce } from "./force";
import { pathPercentField, tilesNearPercent } from "./placement";
import { classify, runMatrixOnStage, type Label } from "../reportCard";

/** 적 아키타입 — 병종·병력·레벨. commanderId는 생성기가 generic 풀에서 유일하게 부여. */
export interface EnemyTemplate {
  classId: string;
  troops: number;
  level: number;
}

export interface GenSpec {
  mapId: string;
  spawn: Coord; // 플레이어 시작(경로% 정규화 기준)
  goal: Coord; // 목표/보스 위치
  playerUnits: StageUnit[]; // 참조 편성(밸런스 측정 + 기본). 실제 플레이는 sortie가 덮음
  mookPool: EnemyTemplate[]; // 일반 적 아키타입(순환 사용)
  boss: EnemyTemplate; // 보스(goal 타일)
  curve?: PacingCurve; // 기본 DEFAULT_CURVE
  turnLimit?: number;
  id?: string;
  name?: string;
  moveClass?: string; // 경로 정의 moveClass(기본 "foot")
}

/** generic 적 commanderId 풀 — commanders.json에 존재해야 함(16 mook + 4 officer). */
const MOOK_IDS = Array.from({ length: 16 }, (_, i) => `적병-${String(i + 1).padStart(2, "0")}`);
const BOSS_IDS = Array.from({ length: 4 }, (_, i) => `적장-${String(i + 1).padStart(2, "0")}`);

function enemyUnit(tpl: EnemyTemplate, commanderId: string, at: Coord): StageUnit {
  return {
    commanderId,
    classId: tpl.classId,
    level: tpl.level,
    troops: tpl.troops,
    items: [],
    side: "enemy",
    x: at.x,
    y: at.y,
  };
}

/**
 * 레시피 + 난이도 노브 → Stage(결정론). 총 적 전력 = 참조 플레이어 전력 × knob.
 * 보스는 goal에, mook은 밴드별 전력 예산을 채울 때까지 밴드 중심 근처 빈 타일에 배치.
 */
export function generate(spec: GenSpec, knob: number): Stage {
  const map = gameData.maps[spec.mapId];
  if (!map) throw new Error(`unknown map: ${spec.mapId}`);
  const ctx = { data: gameData, stage: { units: [] } as unknown as Stage, map };
  const field = pathPercentField(ctx, spec.goal, spec.spawn, spec.moveClass ?? "foot");

  const playerForce = totalForce(gameData, spec.playerUnits);
  const curve = spec.curve ?? DEFAULT_CURVE;
  const bands = bandBudgets(curve, playerForce * knob);

  // 점유 타일: 플레이어 + goal(보스 자리). 키 "x,y".
  const occupied = new Set<string>(spec.playerUnits.map((u) => `${u.x},${u.y}`));
  const enemies: StageUnit[] = [];

  // 보스 = goal, 마지막(최고 atPercent) 밴드.
  const boss = enemyUnit(spec.boss, BOSS_IDS[0]!, spec.goal);
  enemies.push(boss);
  occupied.add(`${spec.goal.x},${spec.goal.y}`);
  const bossForce = unitForce(gameData, boss);

  let mookIdx = 0;
  bands.forEach((band, bi) => {
    const isLast = bi === bands.length - 1;
    // 마지막 밴드는 보스가 이미 일부 채움.
    let need = band.force - (isLast ? bossForce : 0);
    if (need <= 0) return;
    const candidates = tilesNearPercent(field, band.atPercent, occupied);
    for (const tile of candidates) {
      if (need <= 0 || mookIdx >= MOOK_IDS.length) break;
      const tpl = spec.mookPool[mookIdx % spec.mookPool.length]!;
      const u = enemyUnit(tpl, MOOK_IDS[mookIdx]!, tile);
      enemies.push(u);
      occupied.add(`${tile.x},${tile.y}`);
      need -= unitForce(gameData, u);
      mookIdx++;
    }
  });

  const lordId = spec.playerUnits[0]?.commanderId;
  const stage: Stage = {
    id: spec.id ?? "gen-stage",
    name: spec.name ?? "생성 스테이지",
    mapId: spec.mapId,
    turnLimit: spec.turnLimit ?? 30,
    camera: { zoom: 1.5, focus: [spec.goal.x, spec.goal.y] },
    reward: { gold: 0, exp: 0, treasures: [] },
    units: [...spec.playerUnits, ...enemies],
    objectives: [{ kind: "defeatUnit", unitId: boss.commanderId, optional: false }],
    failConditions: lordId ? [{ kind: "unitRetreated", unitId: lordId }] : [],
    // 엔진이 무가드로 순회하는 배열들 — zod 기본값을 우회 생성하므로 직접 제공([] 필수).
    events: [],
    dialogue: [],
    strategyConditions: [],
    reinforcements: [],
  } as Stage;
  return stage;
}

export interface TuneResult {
  stage: Stage;
  knob: number;
  label: Label;
  converged: boolean;
  trace: Array<{ knob: number; label: Label }>;
}

/** 난이도 스캔 노브 그리드(쉬움→어려움). 결정론. */
const KNOBS = [0.5, 0.7, 0.9, 1.1, 1.3, 1.6, 2.0];

/** 라벨 선호 순위 — HEALTHY 최선, IMPASSABLE 최악. 미수렴 시 best 선택용. */
const RANK: Record<Label, number> = { HEALTHY: 4, EASY: 3, BRITTLE: 2, HARD: 1, IMPASSABLE: 0 };

/**
 * 노브 그리드를 스캔해 target(기본 HEALTHY)에 처음 닿으면 즉시 반환. 못 닿으면 선호 순위상
 * 최선 후보를 converged:false로 반환(로그용 trace 동봉). 결정론(각 generate·classify 결정적).
 */
export function autoTune(spec: GenSpec, target: Label = "HEALTHY", knobs: number[] = KNOBS): TuneResult {
  const trace: Array<{ knob: number; label: Label }> = [];
  let best: { stage: Stage; knob: number; label: Label } | null = null;
  for (const knob of knobs) {
    const stage = generate(spec, knob);
    const label = classify(runMatrixOnStage(stage));
    trace.push({ knob, label });
    if (label === target) return { stage, knob, label, converged: true, trace };
    if (!best || RANK[label] > RANK[best.label]) best = { stage, knob, label };
  }
  return { ...best!, converged: false, trace };
}
