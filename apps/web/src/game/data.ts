import { installAssetBindings } from "../studio/asset-bindings";
import { gameData as baseData, type GameData } from "@tk/data";
import { GameSnapshotSchema, type GameSnapshot } from "./snapshot";
export * from "@tk/data";

// Live module bindings. Install once before mounting any game screen.
export let gameData: GameData = baseData;
export let stages = baseData.stages;
export let activeGame: GameSnapshot | null = null;
export function installGame(snapshot: unknown | null): void {
  activeGame = snapshot === null ? null : GameSnapshotSchema.parse(snapshot);
  gameData = activeGame ? { ...baseData, stages: activeGame.stages, maps: activeGame.maps,
    commanders: activeGame.commanders, rosters: activeGame.rosters, items: activeGame.items } : baseData;
  installAssetBindings(activeGame?.assetBindings);
  stages = gameData.stages;
}
