export type AssetBindings = Record<string, string>;
export function parseAssetBindings(value: unknown): AssetBindings {
  if (value === undefined) return {};
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('에셋 연결 형식이 잘못됐습니다.');
  const result: AssetBindings = {};
  for (const [key, target] of Object.entries(value)) {
    if (typeof target !== 'string' || ![key, target].every(p => p.startsWith('/assets/') && !/[\\?#\x00-\x1f]/.test(p) && !p.split('/').some(s => s === '..' || s === '.'))) throw new Error('공용 라이브러리 에셋만 연결할 수 있습니다.');
    result[key] = target;
  }
  return result;
}
export function resolveAssetBinding(path: string, bindings: AssetBindings): string {
  let decoded = path; try { decoded = decodeURIComponent(path); } catch {}
  if (bindings[decoded]) return bindings[decoded]!;
  const prefix = Object.keys(bindings).filter(k => k.endsWith('/') && decoded.startsWith(k)).sort((a,b) => b.length-a.length)[0];
  return prefix ? bindings[prefix] + decoded.slice(prefix.length) : path;
}
let active: AssetBindings = {};
export function installAssetBindings(value?: unknown) { active = parseAssetBindings(value); }
export function resolveActiveAsset(path: string) { return resolveAssetBinding(path, active); }
