// tools/editor/stage-io.d.ts — stage-io.js 의 TS 선언 (vitest/typecheck 용)
export type Json = Record<string, unknown>;
export interface MapModel { id: string; name: string; width: number; height: number; tileLegend: Record<string, string> | null; tiles: string[][] }
export const TERRAINS: ReadonlyArray<readonly [string, string, readonly [number, number, number]]>;
/** 소유 키(scenario·dialogue 포함)는 모델에 복사(scenario/dialogue 는 깊은 복제), 미지 키는 ORIG 에만. */
export function loadStage(obj: Json): Json;
export function serializeStage(model: Json): Json;
export function cloneUnits(units: Json[]): Json[];
export function loadMap(obj: Json): MapModel;
export function serializeMap(model: MapModel): Json;
