import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { GameSnapshotSchema, snapshotKey, type GameSnapshot } from "../game/snapshot";

export function createGameStore(directory: string) {
  async function read(key = "active"): Promise<GameSnapshot | null> {
    if (key !== "active" && !/^[0-9a-f-]{36}\.[1-9][0-9]*$/.test(key)) throw new Error("게임 버전 주소가 올바르지 않습니다.");
    try { return GameSnapshotSchema.parse(JSON.parse(await readFile(join(directory, `${key}.json`), "utf8"))); }
    catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return null; throw error; }
  }
  async function activate(value: GameSnapshot) {
    const snapshot = GameSnapshotSchema.parse(value);
    await mkdir(directory, { recursive: true });
    // Historical snapshots remain available for suspended battles.
    await writeFile(join(directory, `${snapshotKey(snapshot)}.json`), JSON.stringify(snapshot));
    const temporary = join(directory, `${randomUUID()}.tmp`);
    await writeFile(temporary, JSON.stringify(snapshot));
    await rename(temporary, join(directory, "active.json"));
    return snapshot;
  }
  return { read, activate };
}
