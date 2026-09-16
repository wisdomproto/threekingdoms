import { listLibrary, importLibrary } from "./asset-library";
import { parseAssetBindings } from "./asset-bindings";
import { objectPreview } from "./object-preview";
import { spriteCandidates } from "../pixi/spriteMap";
import { assetUrl } from "../assetUrl";
import { existsSync } from "node:fs";
import { readFile, readdir, mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { randomUUID } from "node:crypto";
import { AuthoringProjectSchema, importLegacyChapter, createLegacyPlaytestSnapshot, loadAuthoringProject, serializeAuthoringProject } from "@tk/data/authoring-project";
import { createProjectStore, MAX_PROJECT_BYTES, StoreError } from "./project-store";
import { applyLegacyEditorEdit, legacyEditorDocument, projectSceneMaps, type LegacyTarget } from "./legacy-project";
import { parsePlaytestSnapshot } from "../lab/playtest";
import { createChapterTest } from "./chapter-playtest";
import { importCampaign } from "./import-campaign";
import { characterProfiles } from "./character-profiles";
import { compileGame } from "./game-compiler";
import { createGameStore } from "./game-store";

function legacyTarget(value: unknown): LegacyTarget {
  const target = value as Partial<LegacyTarget> | null;
  if (!target || !["battle", "scene"].includes(target.kind ?? "") || typeof target.id !== "string" || !target.id) throw new StoreError(400, "편집 대상을 확인해 주세요.");
  return target as LegacyTarget;
}
async function projectCatalogs(project: Record<string, unknown>, directory: string) {
  if (Object.hasOwn(project, "catalogs") && (!project.catalogs || typeof project.catalogs !== "object" || Array.isArray(project.catalogs))) throw new StoreError(400, "프로젝트 catalogs 형식을 확인해 주세요. 원본은 보존됩니다.");
  const stored = project.catalogs && typeof project.catalogs === "object" && !Array.isArray(project.catalogs) ? project.catalogs as Record<string, unknown> : {};
  return Object.fromEntries(await Promise.all(["commanders", "rosters", "items"].map(async key => [key, Object.hasOwn(stored, key) ? stored[key] : JSON.parse(await readFile(join(directory, `${key}.json`), "utf8"))])));
}

function workspaceRoot() {
  let path = process.cwd();
  while (!existsSync(join(path, "pnpm-workspace.yaml"))) {
    const parent = dirname(path);
    if (parent === path) throw new Error("Workspace not found");
    path = parent;
  }
  return path;
}
export function checkStudioRequest(request: Request, environment: string | undefined) {
  if (environment !== "development") throw new StoreError(404, "개발 서버에서만 사용할 수 있습니다.");
  const origin = request.headers.get("origin");
  if (origin && new URL(origin).host !== request.headers.get("host")) throw new StoreError(403, "다른 출처의 요청은 허용하지 않습니다.");
}
async function body(request: Request): Promise<Record<string, unknown>> {
  const reader = request.body?.getReader();
  if (!reader) throw new StoreError(400, "요청 내용이 없습니다.");
  const chunks: Uint8Array[] = []; let size = 0;
  for (;;) {
    const chunk = await reader.read(); if (chunk.done) break;
    size += chunk.value.byteLength;
    if (size > MAX_PROJECT_BYTES) { await reader.cancel(); throw new StoreError(413, "프로젝트는 10MB 이하로 열어 주세요."); }
    chunks.push(chunk.value);
  }
  try {
    const value = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error();
    return value;
  } catch { throw new StoreError(400, "JSON 객체가 필요합니다."); }
}
export async function studioRequest(request: Request): Promise<Response> {
  try {
    checkStudioRequest(request, process.env.NODE_ENV);
    const root = workspaceRoot();
    const store = createProjectStore(join(root, ".studio", "projects"));
    const dataDir = join(root, "packages", "data", "json");
    const route = new URL(request.url).pathname.replace(/^\/api\/studio\//, "");
    const json = (value: unknown, status = 200) => Response.json(value, { status, headers: { "Cache-Control": "no-store" } });
    const assetRoot = join(root, 'apps', 'web', 'public', 'assets');
    if (route === 'asset-library') {
      if(request.method === 'GET') return json(await listLibrary(assetRoot));
      if(request.method === 'POST') {
        if(Number(request.headers.get('content-length')) > 85_000_000) throw new StoreError(413,'80MB 이하로 추가해 주세요.');
        try { return json(await importLibrary(assetRoot, await request.formData()),201); }
        catch(e) { throw new StoreError(400, e instanceof Error ? e.message : String(e)); }
      }
    }
    if (route === "game") {
      const games = createGameStore(join(root, ".studio", "game"));
      if (request.method === "POST") {
        const input = await body(request);
        const record = await store.read(String(input.projectId));
        const snapshot = compileGame(record, await projectCatalogs(record.project, dataDir));
        await games.activate(snapshot);
        return json({ snapshot });
      }
      if (request.method === "GET") {
        const version = new URL(request.url).searchParams.get("version");
        if (version) {
          const snapshot = await games.read(version);
          if (!snapshot) throw new StoreError(404, "중단한 게임 버전을 찾을 수 없습니다.");
          return json({ snapshot });
        }
        const active = await games.read();
        if (!active) return json({ snapshot: null });
        try {
          const record = await store.read(active.projectId);
          if (record.revision === active.revision) return json({ snapshot: active });
          const snapshot = compileGame(record, await projectCatalogs(record.project, dataDir));
          await games.activate(snapshot);
          return json({ snapshot });
        } catch (error) {
          return json({ snapshot: active, warning: `최신 편집본 동기화 실패: ${error instanceof Error ? error.message : String(error)} 이전 게임 버전을 사용합니다.` });
        }
      }
    }
    if (route === "asset-image" && request.method === "POST") {
      const q=new URL(request.url).searchParams, kind=q.get('kind'), id=q.get('id')??'';
      if(!['maps','items','fx','sprites','objects'].includes(kind??'') || !id || id.length>150 || (kind==='objects' ? id.split('/').some(p=>!p||p==='.'||p==='..'||/[\\\x00-\x1f]/.test(p)) : kind==='sprites' ? !/^[^/\\]+(?:\/t[23])?\/(front|back)_(idle|move|attack)$/.test(id) || id.split('/').some(p=>p==='.'||p==='..') : /[\\/\x00-\x1f]/.test(id)) || id==='.' || id==='..') throw new StoreError(400,'이미지 대상을 확인하세요.');
      const bytes=new Uint8Array(await request.arrayBuffer());
      if(bytes.length>20_000_000)throw new StoreError(413,'이미지는 20MB 이하로 넣어주세요.');
      const ext=kind==='fx'?'png':'webp';
      const valid=ext==='png'?Buffer.from(bytes.slice(0,8)).equals(Buffer.from([137,80,78,71,13,10,26,10])):Buffer.from(bytes.slice(0,4)).toString()==='RIFF'&&Buffer.from(bytes.slice(8,12)).toString()==='WEBP';
      if(!valid)throw new StoreError(400,'이미지 형식이 맞지 않습니다.');
      const directory=join(root,'apps','web','public','assets',kind==='items'?'ui/items':kind!);
      const file=join(directory,`${id}.${ext}`);
      if(existsSync(file)){const backup=join(root,'.studio','asset-backups');await mkdir(backup,{recursive:true});await writeFile(join(backup,`${randomUUID()}-${id.replaceAll("/", "_")}.${ext}`),await readFile(file));}
      await mkdir(dirname(file),{recursive:true});await writeFile(file,bytes);
      return json({url:assetUrl(`/assets/${kind==='items'?'ui/items':kind}/${id.split('/').map(encodeURIComponent).join('/')}.${ext}`)});
    }
    if(route==='object-images'&&request.method==='GET') {
      const directory=join(root,'apps','web','public','assets','objects');
      const files=await readdir(directory,{recursive:true});
      return json(files.filter(f=>f.endsWith('.webp')).sort().map(f=>({id:f.replaceAll('\\','/').slice(0,-5)})));
    }
    if(route==='effect-images'&&request.method==='GET')return json((await readdir(join(root,'apps','web','public','assets','fx'))).filter(f=>f.endsWith('.png')).map(f=>({id:f.slice(0,-4),url:assetUrl('/assets/fx/'+f)})));
    if (route === "legacy/object-preview" && request.method === "POST") return json(objectPreview(await body(request)));
    const catalogRoute = /^projects\/([^/]+)\/catalogs\/(characters|items)$/.exec(route);
    if (catalogRoute) {
      const record = await store.read(catalogRoute[1]!);
      const catalogs = await projectCatalogs(record.project, dataDir);
      const keys = catalogRoute[2] === "characters" ? ["commanders", "rosters"] : ["items"];
      if (request.method === "GET") return json({ revision: record.revision, data: { ...Object.fromEntries(keys.map(key => [key, catalogs[key]])), characterProfiles: characterProfiles(catalogs.commanders, catalogs.rosters, record.project.battles as Record<string, unknown>[] ?? []), unitClasses: JSON.parse(await readFile(join(dataDir, "unitClasses.json"), "utf8")) } });
      if (request.method === "PUT") {
        const input = await body(request);
        if (input.baseRevision !== record.revision) throw new StoreError(409, "다른 창에서 프로젝트가 수정됐습니다. 편집본을 보관한 뒤 다시 열어 주세요.");
        const data = loadAuthoringProject(input.data);
        for (const key of keys) catalogs[key] = loadAuthoringProject(data[key]);
        const project = loadAuthoringProject(record.project);
        project.catalogs = loadAuthoringProject({ ...(project.catalogs as object ?? {}), ...catalogs });
        return json(await store.save(record.id, project, record.revision));
      }
      throw new StoreError(405, "지원하지 않는 요청입니다.");
    }
    const legacyRoute = /^projects\/([^/]+)\/legacy$/.exec(route);
    if (legacyRoute) {
      const record = await store.read(legacyRoute[1]!);
      if (request.method === "GET") {
        const params = new URL(request.url).searchParams;
        const target = legacyTarget({ kind: params.get("kind"), id: params.get("id") });
        return json({ ...legacyEditorDocument(record.project, target), assetBase: assetUrl("/assets/").replace(/\/assets\/$/, ""), revision: record.revision, updatedAt: record.updatedAt });
      }
      if (request.method === "PUT" || request.method === "POST") {
        const input = await body(request), target = legacyTarget(input.target);
        if (input.baseRevision !== record.revision) throw new StoreError(409, "다른 창에서 프로젝트가 수정됐습니다. 편집 내용을 파일로 보관한 뒤 다시 열어 주세요.");
        const project = applyLegacyEditorEdit(record.project, target, input.stage, input.map, randomUUID);
        if (request.method === "PUT") return json(await store.save(record.id, project, record.revision));
        const doc = legacyEditorDocument(project, target), draftId = randomUUID();
        const snapshot = { kind: "tk-playtest-snapshot", version: 1, draftId, revision: record.revision, seed: 1, savedAt: new Date().toISOString(), returnUrl: `/studio?project=${record.id}`, ...doc, assetBindings: parseAssetBindings(project.assetBindings), catalogs: await projectCatalogs(project, dataDir) };
        const parsed = parsePlaytestSnapshot(snapshot);
        if (!parsed.ok) throw new StoreError(400, parsed.message);
        const directory = join(root, "apps", "web", "public", "_draft");
        await mkdir(directory, { recursive: true });
        await writeFile(join(directory, `${draftId}.json`), JSON.stringify(snapshot), { flag: "wx" });
        const scene = target.kind === "scene" ? "intro" : ["intro", "outro", "outroDefeat"].includes(String(input.scene)) ? String(input.scene) : "";
        return json({ url: `/playtest?draft=${draftId}${scene ? `&scene=${scene}` : ""}` });
      }
      throw new StoreError(405, "지원하지 않는 요청입니다.");
    }
    if (request.method === "GET") {
      if (route.startsWith("legacy/")) {
        const file = route.slice(7);
        if (file === "scene-maps") {
          const projectId = new URL(request.url).searchParams.get("project");
          const maps: Record<string, unknown> = {};
          for (const name of (await readdir(join(dataDir, "maps"))).filter(n => n.endsWith(".json"))) {
            const map = JSON.parse(await readFile(join(dataDir, "maps", name), "utf8"));
            maps[map.id] = map;
          }
          if (projectId) {
            const record = await store.read(projectId);
            for (const resource of AuthoringProjectSchema.parse(record.project).maps) {
              if (typeof resource.data.id === 'string') maps[resource.data.id] = resource.data;
            }
          }
          return json(maps);
        }
        if (file === "sprite-preview") {
          const query = new URL(request.url).searchParams;
          const side = query.get("side");
          if (side !== "player" && side !== "ally" && side !== "enemy") throw new StoreError(400, "진영을 확인해 주세요.");
          return json(spriteCandidates(query.get("commander") ?? "", query.get("class") ?? "", side).map(id => assetUrl(`/assets/sprites/${id.split("/").map(encodeURIComponent).join("/")}/front_idle.webp`)));
        }
        if (file === "comic-files") {
          const directory = join(root, "apps", "web", "public", "assets", "comics");
          return json({ files: existsSync(directory) ? (await readdir(directory)).filter(name => name.endsWith(".webp")) : [] });
        }
        const modules = ["asset-library", "map-scene-editor", "map-scene-model", "asset-image-editor", "battle-events", "stage-io", "history", "chapters", "story-model", "validate-story", "story-editor", "publish", "rail", "draft-store", "quick-edit", "studio-bridge", "comic-editor", "editor-mode", "catalog-bridge", "catalog-io"];
        const module = /^editor\/([a-z-]+)\.js$/.exec(file);
        const data = /^data\/(commanders|unitClasses|items|rosters)\.json$/.exec(file);
        const projectId = new URL(request.url).searchParams.get("project");
        if (data && projectId && data[1] !== "unitClasses") {
          const record = await store.read(projectId);
          const catalogs = await projectCatalogs(record.project, dataDir);
          if(data[1] === 'commanders') {
            const profiles=characterProfiles(catalogs.commanders,catalogs.rosters,record.project.battles as Record<string, unknown>[] ?? []);
            return json(Object.fromEntries(Object.entries(catalogs.commanders).map(([id,c])=>[id,{...(c as object),defaultClassId:profiles[id]?.classId || undefined,battleRole:profiles[id]?.role || undefined}])));
          }
          return json(catalogs[data[1]!]);
        }
        const path = ["stage-editor.html", "character-editor.html", "item-editor.html"].includes(file) ? join(root, "tools", file) : module && modules.includes(module[1]!) ? join(root, "tools", "editor", `${module[1]}.js`) : data ? join(dataDir, `${data[1]}.json`) : null;
        if (!path) throw new StoreError(404, "파일을 찾을 수 없습니다.");
        let source = await readFile(path, "utf8");
        if(file.endsWith('.html') && projectId) {
          const record=await store.read(projectId);
          const bindings=JSON.stringify(parseAssetBindings(record.project.assetBindings)).replaceAll('<','\\u003c');
          source=source.replace('<head>', `<head><script>window.STUDIO_ASSET_BINDINGS=${bindings};</script>`);
        }
        return new Response(source, { headers: { "Content-Type": data ? "application/json" : module ? "text/javascript; charset=utf-8" : "text/html; charset=utf-8", "Cache-Control": "no-store" } });
      }
      if (route.startsWith("exports/")) {
        const id = route.slice(8);
        if (!/^[0-9a-f-]{36}$/.test(id)) throw new StoreError(400, "다운로드 주소가 올바르지 않습니다.");
        const exported = JSON.parse(await readFile(join(root, ".studio", "exports", `${id}.json`), "utf8"));
        return new Response(exported.content, { headers: {
          "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store",
          "Content-Disposition": `attachment; filename="project.json"; filename*=UTF-8''${encodeURIComponent(exported.name)}`,
        } });
      }
      if (route === "projects") return json(await store.list());
      if (route.startsWith("projects/")) return json(await store.read(route.slice(9)));
      if (route === "catalog") {
        const files = (await readdir(join(dataDir, "stages"))).filter((f) => f.endsWith(".json")).sort();
        return json(await Promise.all(files.map(async (file) => {
          const stage = JSON.parse(await readFile(join(dataDir, "stages", file), "utf8"));
          return { id: file.slice(0, -5), name: stage.name };
        })));
      }
    }
    if (request.method === "POST" || request.method === "PUT") {
      const input = await body(request);
      if (request.method === "POST" && route === "exports") {
        const project = loadAuthoringProject(input.project);
        const id = randomUUID();
        const directory = join(root, ".studio", "exports");
        const name = `${typeof project.name === "string" ? project.name.replace(/[<>:"/\\|?*\r\n]/g, "_").slice(0, 100) : "project"}.project.json`;
        await mkdir(directory, { recursive: true });
        await writeFile(join(directory, `${id}.json`), JSON.stringify({ name, content: serializeAuthoringProject(project) }), { flag: "wx" });
        return json({ url: `/api/studio/exports/${id}`, name }, 201);
      }
      if (request.method === "POST" && route === "projects") return json(await store.create(input.project), 201);
      if (request.method === "POST" && route === "import-campaign") {
        const name = typeof input.name === "string" && input.name.trim() ? input.name.trim() : "삼국지 · 전체 캠페인";
        const project = await importCampaign(dataDir, randomUUID(), name);
        return json(await store.create(project), 201);
      }
      if (request.method === "PUT" && route.startsWith("projects/")) return json(await store.save(route.slice(9), input.project, input.baseRevision as number));
      if (request.method === "POST" && route === "import") {
        if (typeof input.name !== "string" || !input.name.trim() || !Array.isArray(input.stageIds) || input.stageIds.length > 100) {
          throw new StoreError(400, "프로젝트 이름과 전투 목록을 확인해 주세요.");
        }
        const files = new Set(await readdir(join(dataDir, "stages")));
        const stages = await Promise.all(input.stageIds.map(async (id) => {
          if (typeof id !== "string" || !/^[a-z0-9-]+$/.test(id) || !files.has(`${id}.json`)) throw new StoreError(400, "알 수 없는 전투입니다.");
          return JSON.parse(await readFile(join(dataDir, "stages", `${id}.json`), "utf8"));
        }));
        const mapIds = [...new Set<string>(stages.map((s) => s.mapId))];
        const maps = await Promise.all(mapIds.map(async (id) => {
          if (!/^[a-z0-9-]+$/.test(id)) throw new StoreError(400, "맵 이름이 올바르지 않습니다.");
          return JSON.parse(await readFile(join(dataDir, "maps", `${id}.json`), "utf8"));
        }));
        return json(await store.create(importLegacyChapter({ id: randomUUID(), name: input.name.trim(), stages, maps })), 201);
      }
      if (request.method === "POST" && route === "chapter-test") {
        if (typeof input.storageId !== "string" || typeof input.chapterId !== "string") throw new StoreError(400, "프로젝트와 챕터를 선택해 주세요.");
        const record = await store.read(input.storageId);
        if (input.revision !== record.revision) throw new StoreError(409, "프로젝트가 변경됐습니다. 최신 저장본을 열어 주세요.");
        const id = randomUUID();
        const snapshot = createChapterTest(record.project, input.chapterId, await projectCatalogs(record.project, dataDir), id, record.id);
        const directory = join(root, "apps", "web", "public", "_draft");
        await mkdir(directory, { recursive: true });
        await writeFile(join(directory, `${id}.json`), JSON.stringify(snapshot), { flag: "wx" });
        return json({ url: `/studio/play?draft=${id}` }, 201);
      }
      if (request.method === "POST" && route === "playtest") {
        if (typeof input.battleId !== "string") throw new StoreError(400, "테스트할 전투를 선택해 주세요.");
        const draftId = randomUUID();
        const returnUrl = typeof input.storageId === "string" ? `/studio?project=${encodeURIComponent(input.storageId)}` : "/studio";
        const legacySnapshot = createLegacyPlaytestSnapshot(input.project, input.battleId, {
          draftId, revision: Number(input.revision), seed: 1, savedAt: new Date().toISOString(), returnUrl,
        });
        const snapshot = { ...legacySnapshot, assetBindings: parseAssetBindings(loadAuthoringProject(input.project).assetBindings), sceneMaps: projectSceneMaps(input.project, loadAuthoringProject(legacySnapshot.stage)), catalogs: await projectCatalogs(loadAuthoringProject(input.project), dataDir) };
        const parsed = parsePlaytestSnapshot(snapshot);
        if (!parsed.ok) throw new StoreError(400, parsed.message);
        const directory = join(root, "apps", "web", "public", "_draft");
        await mkdir(directory, { recursive: true });
        await writeFile(join(directory, `${draftId}.json`), JSON.stringify(snapshot), { flag: "wx" });
        return json({ url: `/playtest?draft=${draftId}` }, 201);
      }
    }
    throw new StoreError(404, "요청한 작업을 찾을 수 없습니다.");
  } catch (error) {
    const status = error instanceof StoreError ? error.status : 400;
    return Response.json({ error: error instanceof Error ? error.message : "작업에 실패했습니다." }, { status });
  }
}
