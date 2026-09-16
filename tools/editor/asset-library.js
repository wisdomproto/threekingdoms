/** Project appearance overrides; the server injects only validated local paths. */
export function editorAssetUrl(value) {
  if (!value) return value;
  let path=value.replace(/^\/api\/local-assets\//,'/assets/');
  try { path=decodeURIComponent(path.split('?')[0]); } catch {}
  const bindings=window.STUDIO_ASSET_BINDINGS||{};
  const prefix=Object.keys(bindings).filter(k=>k.endsWith('/')&&path.startsWith(k)).sort((a,b)=>b.length-a.length)[0];
  const mapped=bindings[path]||(prefix?bindings[prefix]+path.slice(prefix.length):null);
  return mapped?(mapped.startsWith('/assets/library/')?mapped.replace('/assets/','/api/local-assets/'):mapped).split('/').map(encodeURIComponent).join('/'):value;
}
export function chooseLibraryAsset(target='') {
  if(parent!==window) parent.postMessage({type:'tk-studio:assets',target},location.origin);
  else location.assign('/studio/assets?'+new URLSearchParams({project:new URLSearchParams(location.search).get('project')||'',target}));
}
