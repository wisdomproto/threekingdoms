/** 게임 → 에디터 빠른 편집 진입 URL (spec 2026-09-12-creator-ux-p2-design §8). 순수. origin = tools/serve.py. */
export function editorUrlFor(stageId: string, origin: string): string {
  return `${origin.replace(/\/+$/, "")}/tools/stage-editor.html?stage=${encodeURIComponent(stageId)}&quick=1`;
}
