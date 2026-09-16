// Same-origin integration only; the legacy standalone editor does not enter this mode.
export function studioContext(search, pathname) {
  if (pathname !== '/api/studio/legacy/stage-editor.html') return null;
  const q = new URLSearchParams(search);
  const project = q.get('project'), kind = q.get('kind'), id = q.get('resource');
  if (!project || !id || !['battle', 'scene'].includes(kind)) throw new Error('Studio 편집 주소가 올바르지 않습니다.');
  return { project, target: { kind, id }, api: `/api/studio/projects/${encodeURIComponent(project)}/legacy` };
}
export async function studioLoad(context) {
  const q = new URLSearchParams(context.target);
  const r = await fetch(`${context.api}?${q}`, { cache: 'no-store' });
  const result = await r.json();
  if (!r.ok) throw new Error(result.error || '프로젝트를 열 수 없습니다.');
  return result;
}
export async function studioSave(context, revision, snapshot) {
  const r = await fetch(context.api, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ target: context.target, baseRevision: revision, ...snapshot }) });
  const result = await r.json();
  if (!r.ok) return { ok: false, conflict: r.status === 409, error: result.error || '저장 실패' };
  return { ok: true, revision: result.revision, savedAt: result.updatedAt };
}
export function studioNotify(type) {
  if (type === 'close' && parent === window) { location.href = `/studio?project=${encodeURIComponent(new URLSearchParams(location.search).get('project') || '')}`; return; }
  parent.postMessage({ type: `tk-studio:${type}` }, location.origin);
}
