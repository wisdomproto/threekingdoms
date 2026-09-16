"use client";
import { useEffect, useMemo, useRef, useState } from "react";

import { AuthoringProjectSchema, parseAuthoringProject, serializeAuthoringProject, validateAuthoringProject, type AuthoringProject, type ChapterStage, type ProjectObject } from "@tk/data/authoring-project";
import { editorContent } from "./editor-state";
import { studioApi, useProjectEditor } from "./useProjectEditor";
import type { ProjectSummary, StoredProject } from "./project-store";
import ResourceFields from "./ResourceFields";
import BattleWorkspace from "./BattleWorkspace";
import { studioDiagnostic } from "./diagnostics";
import { latestChapterTest, rememberChapterTest } from "./chapter-checkpoint";

const kindName = { scene: "스토리", battle: "전투", webtoon: "웹툰", end: "종료" };
const resultName: Record<string, string> = { completed: "이야기 뒤", victory: "승리하면", defeat: "패배하면" };
type View = "chapter" | "resource";

export default function Studio({ connectionsOnly = false }: { connectionsOnly?: boolean }) {
  const editor = useProjectEditor();
  const headerRef = useRef<HTMLElement>(null);
  useEffect(() => {
    const header = headerRef.current; if (!header) return;
    const update = () => document.documentElement.style.setProperty("--studio-header-height", `${header.getBoundingClientRect().height}px`);
    const observer = new ResizeObserver(update); observer.observe(header); update();
    return () => observer.disconnect();
  }, []);
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [catalog, setCatalog] = useState<{ id: string; name: string }[]>([]);
  const [chapterId, setChapterId] = useState(""), [nodeId, setNodeId] = useState("");
  const [expandedChapters, setExpandedChapters] = useState<Record<string, boolean>>({});
  const [view, setView] = useState<View>("chapter");
  const [dialog, setDialog] = useState<"new" | "library" | null>(null);
  const [name, setName] = useState("나의 삼국지"), [stageIds, setStageIds] = useState<string[]>(["05-sishuiguan"]);
  const [busy, setBusy] = useState(false), [message, setMessage] = useState("");
  const [previewUrl, setPreviewUrl] = useState("");
  const [lastChapterUrl, setLastChapterUrl] = useState("");
  useEffect(() => {
    const refresh = () => setLastChapterUrl(editor.state ? latestChapterTest(editor.state.id) : "");
    refresh(); window.addEventListener("focus", refresh); window.addEventListener("storage", refresh);
    return () => { window.removeEventListener("focus", refresh); window.removeEventListener("storage", refresh); };
  }, [editor.state?.id]);
  const [exportUrl, setExportUrl] = useState("");
  const [mode, setMode] = useState<"basic" | "advanced">("basic");
  const [legacy, setLegacy] = useState<{ kind: "battle" | "scene" | "characters" | "items"; id: string; name: string; mode: "basic" | "advanced" } | null>(null);
  const [battlePage, setBattlePage] = useState<"battle" | "story">("battle");
  const autoOpenedBattle = useRef("");
  const [listCollapsed, setListCollapsed] = useState(false);
  const nextSelection = useRef<{ chapterId: string; nodeId: string; view: "chapter" | "resource" } | null>(null);
  function selectScenario(chapterId: string, nodeId: string, view: "chapter" | "resource") {
    if (view === "resource") { setBattlePage("battle"); autoOpenedBattle.current = ""; }
    if (legacy) { nextSelection.current = { chapterId, nodeId, view }; navigateArea("scenario"); }
    else { setChapterId(chapterId); setNodeId(nodeId); setView(view); }
  }
  const [detailSection, setDetailSection] = useState("맵·배치");
  const pendingPage = useRef<string | null>(null);
  async function openAssets(target = "") {
    if(editor.recovery) return;
    if(editor.state) { try { sessionStorage.setItem('tk.asset-return.'+editor.state.id,JSON.stringify({chapterId,nodeId,view,battlePage,legacy})); } catch {} }
    const url = `/studio/assets?project=${editor.state?.id ?? ""}&target=${encodeURIComponent(target)}`;
    if(legacy) { pendingPage.current=url; legacyFrame.current?.contentWindow?.postMessage({type:"tk-studio:request-close"},location.origin); return; }
    if(!editor.state || await editor.save()) location.assign(url);
  }
  async function launchGame() {
    if (!editor.state || editor.recovery) return;
    const url = `/game?project=${editor.state.id}`;
    if (legacy) { pendingPage.current = url; legacyFrame.current?.contentWindow?.postMessage({type:"tk-studio:request-close"}, location.origin); return; }
    if (await editor.save()) location.assign(url);
  }
  async function navigatePage(connections: boolean) {
    if (!editor.state || editor.recovery) return;
    const url = `${connections ? "/studio/connections" : "/studio"}?project=${editor.state.id}`;
    if (legacy) { pendingPage.current = url; legacyFrame.current?.contentWindow?.postMessage({type:"tk-studio:request-close"},location.origin); return; }
    if (await editor.save()) location.assign(url);
  }
  const nextArea = useRef<"scenario" | "characters" | "items">("scenario");
  const activeArea = legacy?.kind === "characters" || legacy?.kind === "items" ? legacy.kind : "scenario";
  function navigateArea(area: "scenario" | "characters" | "items") {
    if (area === "scenario" && connectionsOnly) { void navigatePage(false); return; }
    if (area === "scenario" && !nextSelection.current) setBattlePage("story");
    if (legacy) {
      if (area === legacy.kind) return;
      nextArea.current = area;
      legacyFrame.current?.contentWindow?.postMessage({ type: "tk-studio:request-close" }, location.origin);
    } else if (area !== "scenario") void openCatalog(area);
  }
  const legacyFrame = useRef<HTMLIFrameElement>(null);
  function changeMode(value: "basic" | "advanced") { setMode(value); legacyFrame.current?.contentWindow?.postMessage({ type: "tk-studio:set-mode", mode: value }, location.origin); try { localStorage.setItem("tk.editor.mode", value); } catch {} }
  useEffect(() => { try { if (localStorage.getItem("tk.editor.mode") === "advanced") setMode("advanced"); } catch {} }, []);
  const [projectMenuOpen, setProjectMenuOpen] = useState(false);
  const projectMenuRef = useRef<HTMLDivElement>(null);
  const projectMenuButton = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!projectMenuOpen) return;
    const outside = (event: PointerEvent) => {
      if (!projectMenuRef.current?.contains(event.target as Node)) setProjectMenuOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") { setProjectMenuOpen(false); projectMenuButton.current?.focus(); }
    };
    window.addEventListener("pointerdown", outside); window.addEventListener("keydown", escape);
    return () => { window.removeEventListener("pointerdown", outside); window.removeEventListener("keydown", escape); };
  }, [projectMenuOpen]);
  const fileInput = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLElement>(null);
  const content = editor.state ? editorContent(editor.state) : "";
  const raw = useMemo(() => content ? parseAuthoringProject(content) : null, [content]);
  const project = useMemo(() => raw && AuthoringProjectSchema.safeParse(raw).success ? raw as unknown as AuthoringProject : null, [raw]);
  const issues = useMemo(() => raw ? validateAuthoringProject(raw) : [], [raw]);
  const chapter = project?.chapters.find((c) => c.id === chapterId) ?? project?.chapters[0];
  const node = chapter?.stages.find((n) => n.id === nodeId) ?? chapter?.stages.find((n) => n.id === chapter.entryStageId) ?? chapter?.stages[0];
  useEffect(() => {
    if (chapter?.id) setExpandedChapters(current => ({ ...current, [chapter.id]: true }));
  }, [chapter?.id, editor.state?.id]);
  const locked = busy || editor.saving || !!legacy;
  async function openDetail(target = node) {
    if (!target?.resourceId || !["scene", "battle"].includes(target.kind) || editor.recovery) return;
    setBusy(true); setMessage("");
    try {
      if (!await editor.save()) throw new Error("프로젝트 저장을 확인한 뒤 상세 편집기를 열어 주세요.");
      setDetailSection("맵·배치");
      setLegacy({ kind: target.kind as "scene" | "battle", id: target.resourceId, name: target.name, mode });
    } catch (error) { setMessage(String(error)); }
    finally { setBusy(false); }
  }
  useEffect(() => {
    const key = `${editor.state?.id}:${node?.id}`;
    if (!connectionsOnly && project && node?.kind === "battle" && view === "resource" && battlePage === "battle" && !legacy && !busy && !editor.recovery && autoOpenedBattle.current !== key) {
      autoOpenedBattle.current = key;
      void openDetail(node);
    }
  }, [project, node, view, battlePage, legacy, busy, editor.recovery]);
  async function openCatalog(kind: "characters" | "items") {
    if (editor.recovery) return;
    setBusy(true); setMessage("");
    try {
      if (!await editor.save()) throw new Error("프로젝트 저장을 확인해 주세요.");
      setLegacy({ kind, id: kind, name: kind === "characters" ? "장수·로스터" : "아이템", mode });
    } catch(error) { setMessage(String(error)); }
    finally { setBusy(false); }
  }
  useEffect(() => {
    if (!legacy || !editor.state) return;
    const storageId = editor.state.id;
    const handler = (event: MessageEvent) => {
      if (event.origin !== location.origin || event.source !== legacyFrame.current?.contentWindow) return;
      if (event.data?.type === "tk-studio:assets" && typeof event.data.target === "string") void openAssets(event.data.target);
      if (event.data?.type === "tk-studio:section" && typeof event.data.label === "string") setDetailSection(event.data.label);
      if (event.data?.type === "tk-studio:mode" && ["basic", "advanced"].includes(event.data.mode)) changeMode(event.data.mode);
      if (event.data?.type === "tk-studio:close") {
        if (pendingPage.current) { const url=pendingPage.current;pendingPage.current=null;location.assign(url);return; }
        void studioApi<StoredProject>(`projects/${storageId}`).then(record => { editor.open(record);
          const selection = nextSelection.current; nextSelection.current = null;
          if (selection) { setChapterId(selection.chapterId); setNodeId(selection.nodeId); setView(selection.view); }
          const area = nextArea.current; nextArea.current = "scenario";
          setLegacy(area === "scenario" ? null : { kind: area, id: area, name: area === "characters" ? "캐릭터·로스터" : "무기·아이템", mode });
          setMessage(""); }).catch(error => setMessage(String(error)));
      }
    };
    window.addEventListener("message", handler); return () => window.removeEventListener("message", handler);
  }, [legacy, editor.state?.id, editor.open, mode]);

  async function refreshProjects() { setProjects(await studioApi<ProjectSummary[]>("projects")); }
  function activate(record: StoredProject) {
    const opened = AuthoringProjectSchema.safeParse(record.project);
    const firstChapter = opened.success ? opened.data.chapters.find(c => c.stages.some(n => n.kind === "battle")) : undefined;
    const firstBattle = firstChapter?.stages.find(n => n.kind === "battle");
    setExpandedChapters({});
    editor.open(record); setChapterId(firstChapter?.id ?? ""); setNodeId(firstBattle?.id ?? ""); setView(!connectionsOnly && firstBattle ? "resource" : "chapter"); setDialog(null); setMessage(""); setPreviewUrl(""); setExportUrl("");
    if(new URLSearchParams(location.search).get('assetReturn')==='1') {
      try {
        const saved=JSON.parse(sessionStorage.getItem('tk.asset-return.'+record.id)??'null');
        if(saved && opened.success && opened.data.chapters.some(c=>c.id===saved.chapterId && c.stages.some(n=>n.id===saved.nodeId))) {
          setChapterId(saved.chapterId);setNodeId(saved.nodeId);setView(saved.view==='chapter'?'chapter':'resource');setBattlePage(saved.battlePage==='story'?'story':'battle');
          if(saved.legacy && ['characters','items','battle','scene'].includes(saved.legacy.kind)) setLegacy(saved.legacy);
        }
        sessionStorage.removeItem('tk.asset-return.'+record.id);
        history.replaceState(null,'',location.pathname+'?project='+record.id);
      } catch {}
    }
    window.history.replaceState(null, "", `${connectionsOnly ? "/studio/connections" : "/studio"}?project=${record.id}`);
  }
  const maySwitch = () => !editor.dirty || window.confirm("아직 저장하지 않은 수정이 있습니다. 다른 프로젝트로 이동할까요? 복구본은 이 브라우저에 남습니다.");
  async function openProject(id: string) {
    if (!maySwitch()) return;
    setBusy(true);
    try { activate(await studioApi<StoredProject>(`projects/${id}`)); }
    catch (error) { setMessage(String(error)); }
    finally { setBusy(false); }
  }
  useEffect(() => {
    let alive = true;
    void Promise.all([studioApi<ProjectSummary[]>("projects"), studioApi<{ id: string; name: string }[]>("catalog")]).then(async ([list, choices]) => {
      if (!alive) return; setProjects(list); setCatalog(choices);
      const requested = new URLSearchParams(location.search).get("project");
      if (requested) { const record = await studioApi<StoredProject>(`projects/${requested}`); if (alive) activate(record); }
    }).catch((error) => { if (alive) setMessage(String(error)); });
    return () => { alive = false; };
  }, []);
  useEffect(() => { if (editor.state) void refreshProjects().catch(() => {}); }, [editor.state?.revision, editor.state?.id]);
  useEffect(() => {
    if (!dialog) return;
    const previous = document.activeElement as HTMLElement | null;
    const panel = dialogRef.current;
    const focusable = () => Array.from(panel?.querySelectorAll<HTMLElement>("button:not(:disabled), input:not(:disabled), select:not(:disabled), a[href]") ?? []);
    focusable()[0]?.focus();
    const handler = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !busy) { event.preventDefault(); setDialog(null); }
      if (event.key !== "Tab") return;
      const elements = focusable(), first = elements[0], last = elements[elements.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    panel?.addEventListener("keydown", handler);
    return () => { panel?.removeEventListener("keydown", handler); previous?.focus(); };
  }, [dialog, busy]);
  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      if (legacy || busy) return;
      if (!(event.ctrlKey || event.metaKey)) return;
      if (event.key.toLowerCase() === "s") { event.preventDefault(); void editor.save(); }
      if ((event.target as HTMLElement)?.closest("input,textarea,select")) return;
      if (event.key.toLowerCase() === "z") { event.preventDefault(); event.shiftKey ? editor.redo() : editor.undo(); }
      if (event.key.toLowerCase() === "y") { event.preventDefault(); editor.redo(); }
    };
    window.addEventListener("keydown", key); return () => window.removeEventListener("keydown", key);
  }, [editor.save, editor.undo, editor.redo, legacy, busy]);
  function edit(fn: (p: AuthoringProject) => void, group?: string) {
    editor.edit((draft) => fn(draft as unknown as AuthoringProject), group);
  }
  function editNode(fn: (n: ChapterStage) => void, group?: string) {
    if (!chapter || !node) return;
    edit((p) => { const target = p.chapters.find((c) => c.id === chapter.id)?.stages.find((n) => n.id === node.id); if (target) fn(target); }, group);
  }
  function addNode(kind: "scene" | "battle" | "end") {
    if (!chapter) return;
    const id = crypto.randomUUID();
    edit((p) => {
      const target = p.chapters.find((c) => c.id === chapter.id)!;
      const end = target.stages.find((n) => n.kind === "end")?.id;
      let resourceId: string | null = null;
      if (kind === "scene") { resourceId = crypto.randomUUID(); p.scenes.push({ id: resourceId, data: { bg: "", lines: [{ text: "새 이야기를 시작해 보세요." }] } }); }
      if (kind === "battle") resourceId = p.battles[0]?.id ?? null;
      target.stages.push({ id, name: `새 ${kindName[kind]}`, kind, resourceId, next: kind === "end" || !end ? {} : kind === "battle" ? { victory: end, defeat: end } : { completed: end } });
      if (!target.entryStageId) target.entryStageId = id;
    });
    setNodeId(id); setView("chapter");
  }
  function addChapter() {
    const id = crypto.randomUUID(), end = crypto.randomUUID();
    edit((p) => p.chapters.push({ id, name: `새 챕터 ${p.chapters.length + 1}`, entryStageId: end, stages: [{ id: end, name: "종료", kind: "end", resourceId: null, next: {} }] }));
    setChapterId(id); setNodeId(end); setView("chapter");
  }
  async function createProject() {
    if (!maySwitch()) return;
    setBusy(true);
    try { activate(await studioApi<StoredProject>("import", "POST", { name, stageIds: catalog.filter((c) => stageIds.includes(c.id)).map((c) => c.id) })); }
    catch (error) { setMessage(String(error)); }
    finally { setBusy(false); }
  }
  async function importFile(file: File) {
    if (!maySwitch()) return;
    setBusy(true);
    try {
      if (file.size > 10 * 1024 * 1024) throw new Error("10MB 이하 파일을 선택해 주세요.");
      activate(await studioApi<StoredProject>("projects", "POST", { project: parseAuthoringProject(await file.text()) }));
    } catch (error) { setMessage(String(error)); }
    finally { setBusy(false); }
  }
  async function download() {
    if (!raw) return;
    const content = serializeAuthoringProject(raw);
    try {
      const result = await studioApi<{ url: string; name: string }>("exports", "POST", { project: raw });
      setExportUrl(result.url); setMessage("현재 편집 내용의 파일이 준비되었습니다. 다운로드 링크로 저장해 주세요.");
    } catch {
      const url = URL.createObjectURL(new Blob([content], { type: "application/json" }));
      const link = document.createElement("a"); link.href = url; link.download = "project.json";
      link.hidden = true; document.body.appendChild(link); link.click(); link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setMessage("서버에 연결하지 못해 브라우저 파일 저장을 요청했습니다. 다운로드 목록을 확인해 주세요.");
    }
  }
  async function playChapter() {
    if (!chapter || !editor.state) return;
    const tab = window.open("about:blank", "_blank");
    setBusy(true); setMessage(""); setPreviewUrl("");
    try {
      if (!await editor.save()) throw new Error("프로젝트 저장을 확인해 주세요.");
      const record = await studioApi<StoredProject>(`projects/${editor.state.id}`);
      const result = await studioApi<{ url: string }>("chapter-test", "POST", { storageId: record.id, revision: record.revision, chapterId: chapter.id });
      try { rememberChapterTest(record.id, result.url); setLastChapterUrl(result.url); } catch { setMessage("최근 테스트 주소를 저장하지 못했습니다. 열린 테스트 탭의 주소로 다시 접속할 수 있습니다."); }
      if (tab) tab.location.href = result.url; else setPreviewUrl(result.url);
    } catch (error) { tab?.close(); setMessage(`챕터 테스트 준비 실패: ${String(error)}`); }
    finally { setBusy(false); }
  }
  async function playtest() {
    if (!node || node.kind !== "battle") return;
    const tab = window.open("about:blank", "_blank");
    if (tab) tab.document.title = "플레이테스트 준비 중";
    setBusy(true); setMessage(""); setPreviewUrl("");
    try {
      const result = await studioApi<{ url: string }>("playtest", "POST", { project: raw, battleId: node.resourceId, revision: editor.state?.revision, storageId: editor.state?.id });
      if (tab) tab.location.href = result.url; else setPreviewUrl(result.url);
    } catch (error) { tab?.close(); setMessage(`테스트 준비 실패: ${String(error)}`); }
    finally { setBusy(false); }
  }
  const selectionResources = node?.kind === "battle" ? project?.battles : project?.scenes;
  const status = editor.saving ? "저장 중…" : editor.error ? "저장 중단 · 확인 필요" : editor.dirty ? "수정됨 · 자동저장 대기" : "저장됨";
  const detailUrl = legacy && editor.state ? legacy.kind === "characters" || legacy.kind === "items"
    ? `/api/studio/legacy/${legacy.kind === "characters" ? "character" : "item"}-editor.html?project=${editor.state.id}&mode=${legacy.mode}`
    : `/api/studio/legacy/stage-editor.html?project=${editor.state.id}&kind=${legacy.kind}&resource=${encodeURIComponent(legacy.id)}&mode=${legacy.mode}` : "";

  return <><main className={`studio mode-${mode}`} >
    <header ref={headerRef} className="studio-header">
      <div className="studio-brand">
        <div className="studio-project-menu" ref={projectMenuRef} onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setProjectMenuOpen(false); }}>
          <button ref={projectMenuButton} className="studio-menu-toggle" aria-label="프로젝트 메뉴" aria-expanded={projectMenuOpen} aria-controls="studio-project-menu" onClick={() => setProjectMenuOpen(open => !open)}>☰ <span>메뉴</span></button>
          {projectMenuOpen && <div id="studio-project-menu" className="studio-menu-list" aria-label="프로젝트 파일 작업">
            <button disabled={locked} onClick={() => { setProjectMenuOpen(false); setDialog("library"); void refreshProjects().catch(e => setMessage(String(e))); }}>프로젝트 열기</button>
            <button disabled={locked} onClick={() => { setProjectMenuOpen(false); setDialog("new"); }}>새 프로젝트</button>
            <button disabled={locked} onClick={() => { setProjectMenuOpen(false); fileInput.current?.click(); }}>파일 가져오기</button>
            <button disabled={!raw || locked} onClick={() => { setProjectMenuOpen(false); void download(); }}>파일 내보내기</button>
            {legacy && <small>상세 편집을 저장하고 돌아온 뒤 사용할 수 있습니다.</small>}
          </div>}
        </div>
        <span className="studio-mark" aria-hidden="true">三</span><div><small>THREE KINGDOMS / STUDIO</small><h1>{typeof raw?.name === "string" ? raw.name : "프로젝트 스튜디오"}</h1></div></div>
      <nav aria-label="프로젝트 작업">
        <button onClick={() => void openAssets()}>공용 에셋</button>
        {project && <button className="studio-primary" disabled={busy || editor.saving || !!editor.recovery} onClick={() => void launchGame()}>▶ 게임 실행</button>}
        {project && <div className="studio-area-nav" aria-label="작업 영역">
          {([ ["scenario", "시나리오"], ["characters", "캐릭터·로스터"], ["items", "무기·아이템"] ] as const).map(([area, label]) => <button key={area} className="studio-area-button" aria-current={!connectionsOnly && activeArea === area ? "page" : undefined} disabled={busy || editor.saving || !!editor.recovery} onClick={() => navigateArea(area)}>{label}</button>)}
          <button className="studio-area-button" aria-current={connectionsOnly ? "page" : undefined} disabled={busy || editor.saving || !!editor.recovery} onClick={() => void navigatePage(true)}>시나리오 연결</button>
        </div>}
        <label className="studio-mode"><select aria-label="편집 모드" value={mode} onChange={e => changeMode(e.target.value as "basic" | "advanced")} disabled={busy || editor.saving}><option value="basic">기본 편집 모드</option><option value="advanced">고급 편집 모드</option></select></label>

      </nav>
      <input ref={fileInput} type="file" accept=".json,application/json" className="studio-file" aria-label="프로젝트 파일" onChange={(e) => { const file = e.target.files?.[0]; if (file) void importFile(file); e.target.value = ""; }}/>
    </header>
    <div className={`studio-shell ${project && activeArea === "scenario" ? "has-list" : ""} ${listCollapsed ? "list-collapsed" : ""}`}>
    {project && activeArea === "scenario" && (<>
        <aside className={`studio-chapters studio-persistent-list ${listCollapsed ? "is-collapsed" : ""}`} aria-label="시나리오 목록">
          <button className="studio-list-toggle" aria-label={listCollapsed ? "시나리오 목록 펼치기" : "시나리오 목록 접기"} aria-expanded={!listCollapsed} aria-controls="studio-scenario-tree" onClick={() => setListCollapsed(value => !value)}>{listCollapsed ? "☰" : "시나리오 목록 접기 ‹"}</button>
          <div id="studio-scenario-tree" hidden={listCollapsed}>
          <div className="studio-section-title"><h2>{connectionsOnly ? "챕터 목록" : "전투 목록"}</h2><button hidden={!connectionsOnly} disabled={locked} onClick={addChapter} aria-label="챕터 추가" title="챕터 추가">＋</button></div>
          <nav className="studio-battle-list" aria-label="챕터별 전투 목록">
            {project.chapters.map((c, i) => <section className="studio-battle-group" key={c.id}>
              <div className="studio-tree-heading">
                <button className="studio-chapter-heading" aria-expanded={!!expandedChapters[c.id]} aria-controls={`chapter-children-${c.id}`}
                  onClick={() => { if (connectionsOnly) {setChapterId(c.id);setNodeId(c.entryStageId ?? "");setView("chapter");} else setExpandedChapters(current => ({ ...current, [c.id]: !current[c.id] })); }}>
                  <span className="studio-tree-arrow" aria-hidden="true">{expandedChapters[c.id] ? "▾" : "▸"}</span>
                  <span>{i + 1}장 · {c.name}</span>
                </button>
                {connectionsOnly && <button className="studio-tree-flow" aria-label={`${c.name} 챕터 흐름`} title="챕터 흐름 편집" onClick={() => { selectScenario(c.id, c.entryStageId ?? "", "chapter"); }}>흐름</button>}
              </div>
              <div className="studio-tree-children" id={`chapter-children-${c.id}`} hidden={connectionsOnly || !expandedChapters[c.id]}>
              {c.stages.filter(n => n.kind === "battle").map((battleNode, index) => <button
                key={battleNode.id}
                className={`studio-battle-button ${chapter?.id === c.id && node?.id === battleNode.id ? "selected" : ""}`}
                aria-current={chapter?.id === c.id && node?.id === battleNode.id ? "true" : undefined}
                onClick={() => { selectScenario(c.id, battleNode.id, "resource"); }}
              ><small>{String(index + 1).padStart(2, "0")}</small><span>{battleNode.name || "이름 없는 전투"}</span></button>)}
              {!c.stages.some(n => n.kind === "battle") && <p className="studio-note">등록된 전투가 없습니다.</p>}
              </div>
            </section>)}
          </nav>
        </div></aside>
    </>)}
    <div className="studio-shell-content">
    {!connectionsOnly && project && node?.kind === "battle" && view === "resource" && activeArea === "scenario" && <div className="studio-battle-page-nav"><h2>{node.name}</h2><div role="tablist" aria-label="전투 작업"><button role="tab" aria-selected={battlePage !== "story"} disabled={busy} onClick={() => { setBattlePage("battle"); if (!legacy) void openDetail(node); else if (legacy.kind === "scene") { nextSelection.current = {chapterId:chapter!.id,nodeId:node.id,view:"resource"}; autoOpenedBattle.current=""; navigateArea("scenario"); } }}>전투 편집</button><button role="tab" aria-selected={battlePage === "story"} disabled={busy} onClick={() => { setBattlePage("story"); if (legacy) navigateArea("scenario"); }}>시나리오 작성</button></div></div>}

    <div hidden={!!legacy}>
    <div className="studio-feedback" aria-live="polite">{message && <p role="alert">{message}</p>}{editor.error && <p role="alert">{editor.error} <button onClick={() => void editor.save()} disabled={editor.saving}>다시 저장</button></p>}{editor.recoveryError && <p>{editor.recoveryError}</p>}{exportUrl && <a href={exportUrl} download>프로젝트 파일 다운로드 ↓</a>}{previewUrl && <a href={previewUrl} target="_blank">준비된 전투 테스트 열기 ↗</a>}</div>
    {editor.recovery && <div className="studio-recovery" role="alert">저장 전에 남겨진 복구본이 있습니다.<button onClick={editor.restore}>복구본 복원</button><button onClick={editor.dismissRecovery}>저장본 사용</button></div>}
    {!raw ? <section className="studio-welcome"><div><small className="studio-eyebrow">YOUR STORY, YOUR BATTLE</small><h2>이야기를 잇고,<br/>전투를 만드세요.</h2><p>스토리와 전투를 하나의 챕터로 연결합니다.<br/>작업은 자동으로 저장되고, 언제든 되돌릴 수 있습니다.</p><button className="primary" onClick={() => setDialog("new")} disabled={busy}>첫 프로젝트 만들기 <span>→</span></button></div><aside><h3>최근 프로젝트</h3>{projects.length ? projects.slice(0, 5).map((p) => <button key={p.id} disabled={locked} onClick={() => void openProject(p.id)}><strong>{p.name}</strong><small>{new Date(p.updatedAt).toLocaleString("ko-KR")}</small><span>열기 →</span></button>) : <p>아직 저장된 프로젝트가 없습니다.<br/>사수관 전투로 가볍게 시작해 보세요.</p>}</aside></section> : <>
      <div className="studio-toolbar"><div><span className={`studio-dot ${editor.dirty || editor.error ? "pending" : ""}`}/><span role="status">{status}</span><small>내 컴퓨터에 저장</small></div><nav>
        <button onClick={editor.undo} disabled={locked || !editor.state || editor.state.cursor === 0 || !!editor.recovery} aria-label="실행 취소">↶ 실행 취소</button>
        <button onClick={editor.redo} disabled={locked || !editor.state || editor.state.cursor >= editor.state.history.length - 1 || !!editor.recovery} aria-label="다시 실행">↷ 다시 실행</button>
        <button onClick={() => void editor.save()} disabled={!editor.dirty || editor.saving || !!editor.recovery}>저장</button>
        <button className="primary" onClick={() => void playtest()} disabled={locked || node?.kind !== "battle" || !!editor.recovery}>▶ 선택 전투 테스트</button>
        <button hidden={view !== "chapter"} className="primary" onClick={() => void playChapter()} disabled={locked || !chapter || !!editor.recovery}>▶ 챕터 처음부터 테스트</button>
        {lastChapterUrl && <a href={lastChapterUrl} target="_blank" rel="noopener" title="편집 전의 테스트 구성을 엽니다">마지막 챕터 테스트 이어하기 ↗</a>}
      </nav></div>
      {!project ? <section className="studio-empty"><h2>보존된 프로젝트</h2><p>이 파일의 구조나 버전은 현재 편집 화면이 지원하지 않습니다. 원본 내용을 보존했으며 파일로 다시 내보낼 수 있습니다.</p></section> : <fieldset className={`studio-workspace ${!connectionsOnly ? "studio-workspace-basic" : ""}`} disabled={!!editor.recovery || locked}>
        {!connectionsOnly ? <section className="studio-center">
          {battlePage === "story" || node?.kind !== "battle" ? <BattleWorkspace key={`${editor.state?.id}:${chapter?.id}:${node?.id}`} project={project} chapterId={chapter?.id} node={node} edit={edit} openDetail={openDetail} openAdvanced={() => void navigatePage(true)} /> : <div className="studio-empty"><p>전투 편집기를 여는 중입니다.</p>{message && <button onClick={() => void openDetail()}>다시 열기</button>}</div>}
        </section> : <>
        <section className="studio-center"><div className="studio-section-title"><div><small className="studio-eyebrow">시나리오 연결</small><h2>{chapter?.name ?? "챕터를 추가하세요"}</h2></div><span className="studio-badge">{chapter?.stages.length ?? 0} 단계</span></div>
          {connectionsOnly ? <><div className="studio-flow-actions"><p>카드를 선택하고 오른쪽에서 다음 단계와 승리·패배 분기를 연결하세요.</p><div><button disabled={!chapter} onClick={() => addNode("scene")}>＋ 스토리</button><button disabled={!chapter || !project.battles.length} onClick={() => addNode("battle")}>＋ 전투</button><button disabled={!chapter} onClick={() => addNode("end")}>＋ 종료</button></div></div><div className="studio-flow">{chapter?.stages.map((n, i) => <article key={n.id} className={`studio-node ${n.kind} ${node?.id === n.id ? "active" : ""}`}><button className="node-select" aria-pressed={node?.id === n.id} onClick={() => { setNodeId(n.id); setView("chapter"); }}><span className="node-kind">{String(i + 1).padStart(2, "0")} / {kindName[n.kind]}{chapter.entryStageId === n.id && <b>시작</b>}</span><strong>{n.name || "이름 없는 단계"}</strong><small>{n.kind === "end" ? "이 챕터를 마칩니다" : n.kind === "battle" ? "출전 · 전장 · 승패" : "대사 · 배경 · 이야기"}</small></button><div className="node-links">{Object.entries(n.next).map(([result, id]) => <button key={result} onClick={() => setNodeId(id)} disabled={!chapter.stages.some((s) => s.id === id)}><span>{resultName[result] ?? result}</span><span>→ {chapter.stages.find((s) => s.id === id)?.name ?? "연결 없음"}</span></button>)}</div></article>)}</div></> : <><div className="studio-detail-launch"><button className="primary" onClick={() => void openDetail()} disabled={locked || !node?.resourceId}>{node?.kind === "battle" ? "맵·장수 배치 편집 →" : "장면 상세 편집 →"}</button><p>기존 저작도구로 편집하고 이 프로젝트로 돌아옵니다.</p>{mode === "advanced" && <small>리소스 ID: {node?.resourceId}</small>}</div><ResourceFields project={project} node={node} edit={edit} advanced={mode === "advanced"} /></>}
        </section>
        <aside className="studio-inspector"><small className="studio-eyebrow">INSPECTOR</small><h2>{node ? "연결 설정" : "단계 선택"}</h2>{chapter && <><label>챕터 이름<input value={chapter.name} onChange={(e) => edit((p) => { p.chapters.find((c) => c.id === chapter.id)!.name = e.target.value; }, "chapter-name")}/></label><label>시작 단계<select value={chapter.entryStageId ?? ""} onChange={(e) => edit((p) => { p.chapters.find((c) => c.id === chapter.id)!.entryStageId = e.target.value || null; })}><option value="">선택해 주세요</option>{chapter.stages.map((n) => <option key={n.id} value={n.id}>{n.name}</option>)}</select></label></>}{node && <><hr/><label>단계 이름<input value={node.name} onChange={(e) => editNode((n) => { n.name = e.target.value; }, "node-name")}/></label>{node.kind !== "end" && <><label>{node.kind === "battle" ? "연결할 전투" : "연결할 스토리"}<select value={node.resourceId ?? ""} onChange={(e) => editNode((n) => { n.resourceId = e.target.value || null; })}><option value="">선택해 주세요</option>{selectionResources?.map((r) => <option key={r.id} value={r.id}>{project.chapters.flatMap((c) => c.stages).find((n) => n.resourceId === r.id)?.name ?? r.id}</option>)}</select></label><h3>다음 단계</h3>{(node.kind === "battle" ? ["victory", "defeat"] : ["completed"]).map((result) => <label key={result}>{resultName[result]}<select value={node.next[result] ?? ""} onChange={(e) => editNode((n) => { if (e.target.value) n.next[result] = e.target.value; else delete n.next[result]; })}><option value="">아직 연결하지 않음</option>{chapter?.stages.map((n) => <option key={n.id} value={n.id}>{n.name}</option>)}</select></label>)}</>}<button className="danger" onClick={() => { edit((p) => { const c = p.chapters.find((c) => c.id === chapter!.id)!; c.stages = c.stages.filter((n) => n.id !== node.id); }); setNodeId(""); setView("chapter"); }}>단계 삭제</button><p className="studio-note">삭제는 실행 취소로 복구할 수 있습니다. 공유 스토리·전투 원본은 보존됩니다.</p></>}</aside>
        </>}
      </fieldset>}
      <section className="studio-validation"><details open={issues.length > 0}><summary>{issues.length ? `확인이 필요한 항목 ${issues.length}개` : "연결과 데이터 검증 완료"}<span>미완성 상태도 저장할 수 있습니다</span></summary>{issues.slice(0, 40).map((issue, i) => {
        const diagnostic = studioDiagnostic(issue, project);
        return <div key={i}><strong>{diagnostic.message}</strong><small>{diagnostic.location}</small>{diagnostic.chapterId && <button onClick={() => { setChapterId(diagnostic.chapterId!); setNodeId(diagnostic.nodeId ?? ""); setView(diagnostic.resource ? "resource" : "chapter"); }}>수정 위치 열기 ↑</button>}</div>;
      })}{issues.length > 40 && <p>외 {issues.length - 40}개 항목이 있습니다.</p>}</details></section>
    </>}
    {dialog && <div className="studio-overlay"><section ref={dialogRef} className="studio-dialog" role="dialog" aria-modal="true" aria-label={dialog === "new" ? "새 프로젝트 만들기" : "프로젝트 열기"}><div className="studio-section-title"><h2>{dialog === "new" ? "새 프로젝트 만들기" : "프로젝트 열기"}</h2><button onClick={() => setDialog(null)} aria-label="창 닫기" disabled={busy}>×</button></div>{message && <p role="alert">{message}</p>}{dialog === "new" ? <><p>기존 전투를 복사해 시작합니다. 원본 게임에는 영향을 주지 않습니다.</p><label>프로젝트 이름<input autoFocus value={name} onChange={(e) => setName(e.target.value)}/></label><div className="studio-section-title"><h3>시작할 전투 선택</h3><button onClick={() => setStageIds([])}>선택 해제</button></div><div className="studio-catalog">{catalog.map((s) => <label key={s.id}><input type="checkbox" checked={stageIds.includes(s.id)} onChange={(e) => setStageIds((ids) => e.target.checked ? [...ids, s.id] : ids.filter((id) => id !== s.id))}/><span>{s.id.slice(0, 2)}</span>{s.name}</label>)}</div><footer><span>{stageIds.length ? `${stageIds.length}개 전투와 전후 이야기` : "빈 프로젝트로 시작"}</span><button className="primary" onClick={() => void createProject()} disabled={busy || !name.trim()}>프로젝트 만들기 →</button></footer></> : <div className="studio-library">{projects.map((p) => <button key={p.id} disabled={locked} onClick={() => void openProject(p.id)}><strong>{p.name}</strong><small>{new Date(p.updatedAt).toLocaleString("ko-KR")} · 저장 {p.revision}</small><span>열기 →</span></button>)}{!projects.length && <p>아직 저장된 프로젝트가 없습니다.</p>}</div>}</section></div>}
    </div>{legacy && editor.state && (<div className="studio-detail-overlay" role="region" aria-label={`${legacy.name} 상세 편집`}>{message && <p role="alert">{message}</p>}<iframe ref={legacyFrame} title={`${legacy.name} 상세 편집기`} src={detailUrl} /></div>)}
    </div></div></main></>;
}
