import type { AuthoringProject, ProjectIssue } from "@tk/data/authoring-project";
const messages: Record<string, string> = {
  "structure": "프로젝트 구조나 버전을 확인해 주세요.", "json": "파일 내용을 읽을 수 없습니다.",
  "missing-chapter": "챕터를 하나 이상 추가해 주세요.", "duplicate-id": "같은 식별자를 쓰는 리소스가 있습니다.",
  "resource-data": "필수 내용이나 입력값을 확인해 주세요.", "duplicate-map-source": "같은 맵이 중복 등록되어 있습니다.",
  "scene-reference": "연결된 스토리를 찾을 수 없거나 중복되어 있습니다.", "map-reference": "전투에서 사용하는 맵을 연결해 주세요.",
  "duplicate-scene-data": "스토리가 전투 안에도 중복 저장되어 있습니다.", "duplicate-node": "같은 식별자를 쓰는 단계가 있습니다.",
  "entry-reference": "챕터의 시작 단계를 선택해 주세요.", "end-node": "종료 단계에는 다음 단계나 리소스를 연결할 수 없습니다.",
  "unsupported-kind": "이 단계 유형은 아직 지원하지 않습니다.", "resource-reference": "단계 유형에 맞는 스토리 또는 전투를 연결해 주세요.",
  "missing-result": "다음 단계를 연결해 주세요.", "unsupported-result": "지원하지 않는 결과 분기가 있습니다.",
  "next-reference": "다음 단계가 삭제되었거나 다른 챕터에 있습니다.",
};
const fields: Record<string, string> = { victory: "승리하면", defeat: "패배하면", completed: "이야기 뒤", turnLimit: "턴 제한", units: "초기 배치", text: "대사", bg: "배경", entryStageId: "시작 단계", resourceId: "리소스 연결", mapId: "맵", x: "X 좌표", y: "Y 좌표", level: "레벨", sceneSlots: "전후 이야기" };
export function studioDiagnostic(issue: ProjectIssue, project: AuthoringProject | null) {
  const path = issue.fieldPath.split(".");
  let chapterId: string | undefined, nodeId: string | undefined, resource = false;
  let location = "프로젝트";
  if (project && path[0] === "chapters") {
    const chapter = project.chapters[Number(path[1])];
    if (chapter) { chapterId = chapter.id; location = chapter.name; }
    if (chapter && path[2] === "stages") {
      const node = chapter.stages[Number(path[3])];
      if (node) { nodeId = node.id; location += ` / ${node.name}`; }
    }
  } else if (project && (path[0] === "battles" || path[0] === "scenes")) {
    const id = project[path[0]][Number(path[1])]?.id;
    for (const chapter of project.chapters) {
      const node = chapter.stages.find((n) => n.resourceId === id);
      if (node) { chapterId = chapter.id; nodeId = node.id; resource = true; location = `${chapter.name} / ${node.name}`; break; }
    }
  }
  const field = fields[path[path.length - 1] ?? ""];
  return { message: messages[issue.code] ?? "내용을 확인해 주세요.", location: location + (field ? ` / ${field}` : ""), chapterId, nodeId, resource };
}
