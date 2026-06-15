export { chooseAction, greedyPolicy, naivePolicy, type Policy } from "./policy";
export { runBattle, runStage, withLevelOffset, type RunResult, type RunOpts } from "./runner";
export {
  buildReportCard,
  buildRows,
  classify,
  runMatrix,
  runMatrixOnStage,
  signals,
  type ReportCard,
  type ReportRow,
  type MatrixResult,
  type Cell,
  type Label,
} from "./reportCard";
// §11-B 페이싱 생성기 — 신규 스테이지 적 배치 + 자동 조정.
export { generate, autoTune, type GenSpec, type EnemyTemplate, type TuneResult } from "./gen/generator";
export { DEFAULT_CURVE, bandBudgets, type PacingCurve, type Band } from "./gen/pacingCurve";
export { unitForce, totalForce } from "./gen/force";
export { pathPercentField, tilesNearPercent, type PercentField } from "./gen/placement";
// §11-C 지형 문법 — 아키타입 → BattleMap 격자 + 연결성 검증.
export { generateMap, renderAscii, STANDARD_LEGEND, type Archetype, type GeneratedMap } from "./gen/terrain/mapGen";
export { gateBreakthrough, pincerDefense, escapeCorridor, type ArchParams, type ArchOutput } from "./gen/terrain/archetypes";
export {
  createGrid, fillRect, vWall, hRiver, scatter, carvePath, mulberry32, toBattleMap, type TileGrid,
} from "./gen/terrain/grid";
