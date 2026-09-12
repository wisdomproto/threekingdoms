export type Json = Record<string, any>;
export interface Named { id: string; name: string }
export interface SideInfo { label: string; raw: string }
export function primaryObjectiveText(stage: Json, commanders: Named[]): string;
export function renderQuick(el: HTMLElement, p: {
  stage: Json; commanders: Named[]; classes: Named[]; sides: Record<string, SideInfo>;
  onChange: () => void; onPick: (u: Json) => void; onPlaytest: () => void;
}): void;
