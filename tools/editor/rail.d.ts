export interface RailStage { id: string; name: string; scenes: number; draft?: boolean }
export interface RailGroup { chapter: number; title: string; stages: RailStage[] }
export function renderRail(el: HTMLElement, model: {
  groups: RailGroup[]; currentId: string | null; collapsed: boolean;
  onPick: (id: string) => void; onToggle: () => void;
}): void;
