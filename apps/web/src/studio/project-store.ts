import { mkdir, open, readFile, readdir, rename, unlink } from "node:fs/promises";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { loadAuthoringProject, type ProjectObject } from "@tk/data/authoring-project";

export interface StoredProject {
  id: string; revision: number; updatedAt: string; project: ProjectObject;
}
export type ProjectSummary = Omit<StoredProject, "project"> & { name: string };
export class StoreError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
export const MAX_PROJECT_BYTES = 10 * 1024 * 1024;
const validId = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const errno = (error: unknown, code: string) => (error as NodeJS.ErrnoException).code === code;
export const projectSummary = (record: StoredProject): ProjectSummary => ({
  id: record.id, revision: record.revision, updatedAt: record.updatedAt,
  name: typeof record.project.name === "string" ? record.project.name : "이름 없는 프로젝트",
});

/** Local drafts only. Opaque storage IDs never become caller-controlled filesystem paths. */
export function createProjectStore(directory: string) {
  const pathFor = (id: string) => {
    if (!validId.test(id)) throw new StoreError(400, "프로젝트 주소가 올바르지 않습니다.");
    return join(directory, `${id}.json`);
  };
  const read = async (id: string): Promise<StoredProject> => {
    const path = pathFor(id);
    try { return JSON.parse(await readFile(path, "utf8")) as StoredProject; }
    catch (error) {
      if (errno(error, "ENOENT")) throw new StoreError(404, "저장된 프로젝트를 찾을 수 없습니다.");
      throw error;
    }
  };
  const write = async (id: string, project: unknown, baseRevision: number | null): Promise<StoredProject> => {
    const path = pathFor(id);
    const draft = loadAuthoringProject(project);
    if (Buffer.byteLength(JSON.stringify(draft)) > MAX_PROJECT_BYTES) throw new StoreError(413, "프로젝트는 10MB 이하로 저장해 주세요.");
    await mkdir(directory, { recursive: true });
    const lockPath = `${path}.lock`;
    let lock;
    try { lock = await open(lockPath, "wx"); }
    catch (error) {
      if (errno(error, "EEXIST")) throw new StoreError(423, "다른 저장이 진행 중입니다. 잠시 후 다시 저장해 주세요.");
      throw error;
    }
    const temporary = `${path}.${randomUUID()}.tmp`;
    try {
      let current: StoredProject | null = null;
      try { current = await read(id); } catch (error) { if (!(error instanceof StoreError && error.status === 404)) throw error; }
      if ((current?.revision ?? null) !== baseRevision) throw new StoreError(409, "다른 탭에서 수정되었습니다. 파일로 내보내거나 최신 저장본을 다시 열어 주세요.");
      const record: StoredProject = { id, revision: (baseRevision ?? 0) + 1, updatedAt: new Date().toISOString(), project: draft };
      const handle = await open(temporary, "wx");
      try { await handle.writeFile(JSON.stringify(record, null, 2), "utf8"); await handle.sync(); }
      finally { await handle.close(); }
      await rename(temporary, path);
      return record;
    } finally {
      try { await unlink(temporary).catch((error) => { if (!errno(error, "ENOENT")) throw error; }); }
      finally { await lock.close(); await unlink(lockPath); }
    }
  };
  return {
    read,
    create: (project: unknown) => write(randomUUID(), project, null),
    save: (id: string, project: unknown, revision: number) => {
      if (!Number.isSafeInteger(revision) || revision < 1) throw new StoreError(400, "저장 버전이 올바르지 않습니다.");
      return write(id, project, revision);
    },
    async list(): Promise<ProjectSummary[]> {
      await mkdir(directory, { recursive: true });
      const files = (await readdir(directory)).filter((name) => name.endsWith(".json") && validId.test(name.slice(0, -5)));
      const records = await Promise.all(files.map((name) => read(name.slice(0, -5))));
      return records.map(projectSummary).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    },
  };
}
