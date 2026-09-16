import { describe, it, expect } from 'vitest';
import { mkdtemp, rm, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { importLibrary, listLibrary } from '../asset-library';
import { installAssetBindings, parseAssetBindings, resolveActiveAsset, resolveAssetBinding } from '../asset-bindings';
describe('shared project assets',()=>{
  it('resolves a skin bundle and exact portraits without recursive remapping',()=>{
    const bindings={'/assets/sprites/hero/':'/assets/library/skin/','/assets/ui/portraits/유비.webp':'/assets/library/portrait.webp','/assets/library/portrait.webp':'/assets/other.webp'};
    expect(resolveAssetBinding('/assets/sprites/hero/back_attack_2.webp',bindings)).toBe('/assets/library/skin/back_attack_2.webp');
    expect(resolveAssetBinding('/assets/ui/portraits/%EC%9C%A0%EB%B9%84.webp',bindings)).toBe('/assets/library/portrait.webp');
    expect(resolveAssetBinding('/assets/sprites/heroine/front_idle.webp',bindings)).toBe('/assets/sprites/heroine/front_idle.webp');
  });
  it('clears another project mappings and rejects external/traversal paths',()=>{
    installAssetBindings({'/assets/a.webp':'/assets/b.webp'});expect(resolveActiveAsset('/assets/a.webp')).toBe('/assets/b.webp');
    installAssetBindings();expect(resolveActiveAsset('/assets/a.webp')).toBe('/assets/a.webp');
    expect(()=>parseAssetBindings({'/assets/a.webp':'https://external.test/a'})).toThrow();
    expect(()=>parseAssetBindings({'/assets/a.webp':'/assets/../secret'})).toThrow();
  });
  it('imports append-only entries shared across projects without overwriting originals',async()=>{
    const root=await mkdtemp(join(tmpdir(),'tk-assets-'));
    try {
      await mkdir(join(root,'maps'));await writeFile(join(root,'maps','original.webp'),'existing');
      const form=new FormData();form.set('kind','portraits');form.set('name','New portrait');form.set('project','troia');form.set('projectName','트로이');
      form.append('files',new File([new Uint8Array([137,80,78,71,13,10,26,10,0])],'portrait.png',{type:'image/png'}));
      const first=await importLibrary(root,form),second=await importLibrary(root,form);
      expect(first.url).not.toBe(second.url);expect(first.sourceProject).toBe('troia');
      const list=await listLibrary(root);expect(list).toHaveLength(3);expect(list.some(a=>a.url==='/assets/maps/original.webp')).toBe(true);
      form.set('files',new File(['bad'],'../bad.png'));await expect(importLibrary(root,form)).rejects.toThrow();
    } finally { await rm(root,{recursive:true,force:true}); }
  });
});
