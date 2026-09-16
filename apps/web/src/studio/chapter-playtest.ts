import { AuthoringProjectSchema, loadAuthoringProject, type AuthoringProject } from "@tk/data/authoring-project";
import { legacyEditorDocument } from "./legacy-project";
import { parsePlaytestSnapshot, type PlaytestSnapshot } from "../lab/playtest";

export type ChapterResult = "completed" | "victory" | "defeat";
export interface ChapterTestNode {
  id: string; name: string; kind: "scene" | "battle" | "end";
  next: Record<string, string>; snapshot?: PlaytestSnapshot;
}
export interface ChapterTest {
  chapterNumber?: number;
  kind: "tk-chapter-test"; version: 1; id: string; name: string;
  entry: string; returnUrl: string; nodes: ChapterTestNode[];
}
export function parseChapterTest(value: unknown): ChapterTest {
  const data = loadAuthoringProject(value) as unknown as ChapterTest;
  if (data.kind !== "tk-chapter-test" || data.version !== 1 || typeof data.id !== "string" || typeof data.name !== "string" || !Array.isArray(data.nodes) || !data.returnUrl?.startsWith("/studio?project=")) throw new Error("챕터 테스트 형식을 확인해 주세요.");
  const ids = new Set<string>();
  if (data.chapterNumber !== undefined && (!Number.isSafeInteger(data.chapterNumber) || data.chapterNumber < 1)) throw new Error("챕터 순서가 올바르지 않습니다.");
  for (const node of data.nodes) {
    if (!node || typeof node.id !== "string" || typeof node.name !== "string" || ids.has(node.id) || !["scene", "battle", "end"].includes(node.kind)) throw new Error("챕터 단계가 잘못됐거나 ID가 중복됐습니다.");
    ids.add(node.id);
    if (node.kind !== "end") {
      const parsed = parsePlaytestSnapshot(node.snapshot);
      if (!parsed.ok) throw new Error(`${node.name}: ${parsed.message}`);
    }
  }
  if (!ids.has(data.entry)) throw new Error("챕터 시작 단계를 선택해 주세요.");
  for (const node of data.nodes) {
    const results = node.kind === "end" ? [] : node.kind === "battle" ? ["victory", "defeat"] : ["completed"];
    for (const result of results) if (!node.next || typeof node.next[result] !== "string" || !ids.has(node.next[result]!)) throw new Error(`${node.name}: ${result} 다음 단계를 연결해 주세요.`);
  }
  return data;
}
export function createChapterTest(value: unknown, chapterId: string, catalogs: unknown, id: string, storageId: string): ChapterTest {
  const raw = loadAuthoringProject(value); AuthoringProjectSchema.parse(raw);
  const project = raw as unknown as AuthoringProject;
  const chapter = project.chapters.find(c => c.id === chapterId);
  if (!chapter) throw new Error("테스트할 챕터를 찾을 수 없습니다.");
  const returnUrl = `/studio?project=${encodeURIComponent(storageId)}`;
  const nodes: ChapterTestNode[] = chapter.stages.map(node => {
    if (node.kind === "webtoon") throw new Error(`${node.name}: 웹툰 단계는 스토리 리소스의 만화 파트로 연결해 주세요.`);
    if (node.kind === "end") return { ...node, kind: "end" as const };
    if (!node.resourceId) throw new Error(`${node.name}: 리소스를 연결해 주세요.`);
    const doc = legacyEditorDocument(project, { kind: node.kind, id: node.resourceId });
    doc.stage.name = node.name;
    return { ...node, kind: node.kind, snapshot: { ...doc, catalogs, kind: "tk-playtest-snapshot", version: 1, draftId: id, revision: 1, seed: 1, savedAt: new Date().toISOString(), returnUrl } };
  });
  return parseChapterTest({ kind: "tk-chapter-test", version: 1, id, name: chapter.name, chapterNumber: project.chapters.indexOf(chapter) + 1, entry: chapter.entryStageId, returnUrl, nodes });
}
export function nextChapterNode(test: ChapterTest, current: string, result: ChapterResult): string {
  const node = test.nodes.find(n => n.id === current);
  if (!node || node.kind === "end" || (node.kind === "scene" ? result !== "completed" : !["victory", "defeat"].includes(result))) throw new Error("현재 단계와 실행 결과가 맞지 않습니다.");
  const next = node.next[result];
  if (!next || !test.nodes.some(n => n.id === next)) throw new Error("다음 단계 연결이 없습니다.");
  return next;
}
