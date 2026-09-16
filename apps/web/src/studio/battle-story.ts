import type { AuthoringProject, ChapterStage } from "@tk/data/authoring-project";

export const storyLabels = { intro: "전투 전 이야기", outro: "승리 후 이야기", outroDefeat: "패배 후 이야기" };
export type StorySlot = keyof typeof storyLabels;

/** Attach a new story without replacing existing branches or author-owned fields. */
export function addBattleStory(project: AuthoringProject, battleId: string, slot: StorySlot, sceneId: string, makeNodeId: () => string) {
  const battle = project.battles.find(b => b.id === battleId);
  if (!battle) throw new Error("전투를 찾을 수 없습니다.");
  if (battle.sceneSlots[slot]) throw new Error("이미 연결된 이야기가 있습니다.");
  battle.sceneSlots[slot] = sceneId;
  if (!battle.data.scenario) battle.data.scenario = {};
  project.scenes.push({ id: sceneId, data: { bg: "", lines: [{ text: "" }] } });
  for (const chapter of project.chapters) {
    const nodes = chapter.stages.filter(n => n.kind === "battle" && n.resourceId === battleId);
    for (const node of nodes) {
      const id = makeNodeId();
      const result = slot === "outro" ? "victory" : "defeat";
      const next = slot === "intro" ? node.id : node.next[result];
      if (slot === "intro") {
        for (const previous of chapter.stages) {
          for (const [key, target] of Object.entries(previous.next)) if (target === node.id) previous.next[key] = id;
        }
        if (chapter.entryStageId === node.id) chapter.entryStageId = id;
      } else node.next[result] = id;
      const story: ChapterStage = { id, name: `${String(battle.data.name ?? node.name)} · ${storyLabels[slot]}`, kind: "scene" as const, resourceId: sceneId, next: next ? { completed: next } : {} };
      const index = chapter.stages.indexOf(node);
      chapter.stages.splice(slot === "intro" ? index : index + 1, 0, story);
    }
  }
}
