import { afterEach, describe, expect, it } from "vitest";
import { mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { createProjectStore, MAX_PROJECT_BYTES } from "../project-store";
import { checkStudioRequest } from "../server";

const directories: string[] = [];
async function store() { const path = await mkdtemp(join(tmpdir(), "tk-studio-test-")); directories.push(path); return { storage: createProjectStore(path), path }; }
afterEach(async () => {
  for (const path of directories.splice(0)) {
    const target = resolve(path);
    if (dirname(target) !== resolve(tmpdir()) || !basename(target).startsWith("tk-studio-test-")) throw new Error("Unexpected test cleanup path");
    await rm(target, { recursive: true, force: true });
  }
});

describe("local studio project store", () => {
  it("persists incomplete drafts and unknown data across a fresh store instance", async () => {
    const { storage, path } = await store();
    const project = { name: "미완성", version: 999, extra: { unknown: [null, false, {}] } };
    const record = await storage.create(project);
    expect(record.revision).toBe(1);
    expect((await createProjectStore(path).read(record.id)).project).toEqual(project);
    expect(await storage.list()).toEqual([{ id: record.id, name: "미완성", revision: 1, updatedAt: record.updatedAt }]);
  });
  it("does not overwrite newer data using a stale revision", async () => {
    const { storage } = await store();
    const record = await storage.create({ name: "initial" });
    const next = await storage.save(record.id, { name: "new" }, 1);
    await expect(storage.save(record.id, { name: "stale" }, 1)).rejects.toMatchObject({ status: 409 });
    expect(await storage.read(record.id)).toEqual(next);
  });
  it("serializes concurrent writers across independent store instances", async () => {
    const { storage, path } = await store();
    const record = await storage.create({ name: "initial" });
    const results = await Promise.allSettled([
      storage.save(record.id, { name: "A" }, 1), createProjectStore(path).save(record.id, { name: "B" }, 1),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect((await storage.read(record.id)).revision).toBe(2);
    expect(await readdir(path)).toEqual([`${record.id}.json`]);
  });
  it("rejects filesystem traversal, missing IDs and oversized documents", async () => {
    const { storage } = await store();
    await expect(storage.read("../outside")).rejects.toMatchObject({ status: 400 });
    await expect(storage.read("00000000-0000-0000-0000-000000000000")).rejects.toMatchObject({ status: 404 });
    await expect(storage.create({ large: "x".repeat(MAX_PROJECT_BYTES) })).rejects.toMatchObject({ status: 413 });
  });
  it("releases the save lock after a conflict so a valid retry can proceed", async () => {
    const { storage } = await store();
    const record = await storage.create({ name: "first" });
    await storage.save(record.id, { name: "second" }, 1);
    await expect(storage.save(record.id, { name: "stale" }, 1)).rejects.toMatchObject({ status: 409 });
    expect((await storage.save(record.id, { name: "third" }, 2)).revision).toBe(3);
  });
  it("rejects invalid revision values without touching the stored draft", async () => {
    const { storage } = await store();
    const record = await storage.create({ name: "first" });
    for (const revision of [0, -1, NaN, 1.5]) expect(() => storage.save(record.id, {}, revision)).toThrow();
    expect(await storage.read(record.id)).toEqual(record);
  });
});

describe("studio API boundary", () => {
  it("disables reads and writes outside development", () => {
    for (const environment of ["production", "test", undefined]) expect(() => checkStudioRequest(new Request("http://localhost:3000/api/studio/projects"), environment)).toThrow("개발 서버");
  });
  it("rejects cross-origin requests but accepts same-origin saves", () => {
    const request = (origin: string) => new Request("http://localhost:3000/api/studio/projects", { headers: { host: "localhost:3000", origin } });
    expect(() => checkStudioRequest(request("https://example.com"), "development")).toThrow("출처");
    expect(() => checkStudioRequest(request("http://localhost:3000"), "development")).not.toThrow();
  });
});
