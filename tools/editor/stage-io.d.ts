// tools/editor/stage-io.d.ts — stage-io.js 의 TS 선언 (vitest/typecheck 용)
export type Json = Record<string, unknown>;
export interface MapModel { id: string; name: string; width: number; height: number; tileLegend: Record<string, string> | null; tiles: string[][] }
export const TERRAINS: ReadonlyArray<readonly [string, string, readonly [number, number, number]]>;
export function loadStage(obj: Json): Json;
export function serializeStage(model: Json): Json;
export function cloneUnits(units: Json[]): Json[];
export function loadMap(obj: Json): MapModel;
export function serializeMap(model: MapModel): Json;
