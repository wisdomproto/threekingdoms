import type { MapScene, MapSceneLine } from '../../packages/data/src/schemas';
export const ACTIONS: readonly ['exit', 'move', 'enter', 'face', 'pose'];
export function newMapPart(): MapScene;
export function setAction(line: MapSceneLine, kind: typeof ACTIONS[number], id: string, values: object): void;
export function removeActor(part: MapScene, id: string): void;
export function sceneLayout(part: MapScene, index: number): Map<string, MapScene['units'][number] & {pose: string}>;
