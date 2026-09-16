import { isComicScene, normalizeSceneSlot, type SceneSlot } from "@tk/data";

export type ReadingLine = { text: string; speaker?: string; choices?: { label: string; lines: ReadingLine[] }[] };

/** Read the same authored dialogue as the player, without executing scene actions. */
export function readingLines(slot: SceneSlot | undefined): ReadingLine[] {
  if (!slot) return [];
  return normalizeSceneSlot(slot).flatMap(part => {
    if (isComicScene(part)) return part.pages.flatMap(page => page.panels.flatMap(panel => panel.lines ?? []));
    return part.lines.map(line => ({
      text: line.text ?? "",
      speaker: line.speaker,
      ...("choice" in line && line.choice ? {
        choices: line.choice.options.map(option => ({ label: option.label, lines: option.react ?? [] })),
      } : {}),
    })).filter(line => line.text || line.choices?.length);
  });
}
