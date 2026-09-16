import { readdir, readFile, mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
export interface LibraryAsset { id: string; name: string; kind: string; url: string; preview: string; files?: string[]; tags?: string; sourceProject?: string; sourceName?: string; }
export const assetKinds: Record<string,string> = { maps:'맵', scenes:'장면 배경', portraits:'초상', sprites:'전투 캐릭터·스킨', motions:'시나리오 캐릭터', items:'아이템', objects:'지형지물', fx:'공격·책략 효과', bgm:'배경음악', sfx:'효과음' };
const roots: Record<string,string> = { maps:'maps', scenes:'scenes', portraits:'ui/portraits', sprites:'sprites', motions:'scene-motions', items:'ui/items', objects:'objects', fx:'fx', bgm:'audio/bgm', sfx:'audio/sfx' };
const media = /\.(webp|png|jpg|jpeg|mp3|wav|ogg|m4a|webm)$/i;
async function filesAt(root: string, prefix = ''): Promise<string[]> {
  const entries = await readdir(join(root,prefix), {withFileTypes:true}).catch(() => []);
  return (await Promise.all(entries.filter(e => !e.name.startsWith('_') && !e.name.startsWith('.')).map(async e => e.isDirectory() ? filesAt(root, prefix+e.name+'/') : media.test(e.name) ? [prefix+e.name] : []))).flat();
}
export async function listLibrary(root: string): Promise<LibraryAsset[]> {
  const assets: LibraryAsset[] = [];
  for (const [kind, folder] of Object.entries(roots)) {
    const files = await filesAt(join(root,folder));
    if (kind === 'sprites' || kind === 'motions') {
      for(const file of files.filter(f=>!f.includes('/'))) assets.push({id:folder+'/'+file,name:file.replace(/\.[^.]+$/,''),kind,url:'/assets/'+folder+'/'+file,preview:'/assets/'+folder+'/'+file});
      const folders = new Set(files.filter(f => f.includes('/')).map(f => f.slice(0,f.lastIndexOf('/')+1)));
      for (const dir of folders) { const frames=files.filter(f => f.startsWith(dir) && !f.slice(dir.length).includes('/')).map(f=>f.slice(dir.length)); const preview=frames.find(f=>f==='front_idle.webp') ?? frames[0]; assets.push({id:folder+'/'+dir,name:dir.replace(/\/$/,''),kind,url:'/assets/'+folder+'/'+dir,preview:'/assets/'+folder+'/'+dir+preview,files:frames}); }
    } else for (const file of files) assets.push({id:folder+'/'+file,name:file.replace(/\.[^.]+$/,''),kind,url:'/assets/'+folder+'/'+file,preview:'/assets/'+folder+'/'+file});
  }
  for (const file of await filesAt(join(root,'troia'))) assets.push({id:'troia/'+file,name:file.replace(/\.[^.]+$/,''),kind:file==='opening.png'?'scenes':'portraits',url:'/assets/troia/'+file,preview:'/assets/troia/'+file,sourceProject:'troia',sourceName:'트로이'});
  for (const entry of await readdir(join(root,'library'), {withFileTypes:true}).catch(()=>[])) {
    if (!entry.isDirectory()) continue;
    try { assets.push(JSON.parse(await readFile(join(root,'library',entry.name,'entry.json'),'utf8')) as LibraryAsset); } catch {}
  }
  return assets;
}
export async function importLibrary(root: string, form: FormData): Promise<LibraryAsset> {
  const kind=String(form.get('kind')), name=String(form.get('name')??'').trim(), tags=String(form.get('tags')??'').slice(0,200);
  const files=form.getAll('files').filter((f): f is File => typeof f !== 'string');
  if (!assetKinds[kind] || !name || name.length>120 || !files.length || files.length>150 || (!['sprites','motions'].includes(kind) && files.length!==1)) throw new Error('이름, 종류와 파일을 확인해 주세요.');
  if(files.reduce((s,f)=>s+f.size,0)>80_000_000) throw new Error('한 번에 80MB까지 추가할 수 있습니다.');
  const buffers: {name:string;data:Buffer}[]=[];
  for(const file of files) {
    const filename=file.name;
    if(!media.test(filename) || /[\\/\x00-\x1f]/.test(filename) || filename.startsWith('.') || buffers.some(f=>f.name===filename)) throw new Error('중복되거나 지원하지 않는 파일 이름입니다.');
    const data=Buffer.from(await file.arrayBuffer());
    const image=filename.match(/\.(webp|png|jpg|jpeg)$/i);
    if ((kind==='bgm'||kind==='sfx') === !!image) throw new Error('선택한 종류와 파일 형식이 다릅니다.');
    if(image && !(data.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])) || (data.toString('ascii',0,4)==='RIFF' && data.toString('ascii',8,12)==='WEBP') || (data[0]===255&&data[1]===216))) throw new Error('올바른 이미지 파일이 아닙니다.');
    buffers.push({name:filename,data});
  }
  const id=randomUUID(), dir=join(root,'library',id), base='/assets/library/'+id+'/';
  const preview=buffers.find(f=>f.name==='front_idle.webp')??buffers[0]!;
  const entry:LibraryAsset={id,name,kind,tags,sourceProject:String(form.get('project')??''),sourceName:String(form.get('projectName')??'공용'),url:['sprites','motions'].includes(kind)?base:base+preview.name,preview:base+preview.name,...(['sprites','motions'].includes(kind)?{files:buffers.map(f=>f.name)}:{})};
  await mkdir(dir,{recursive:true});
  for(const file of buffers) await writeFile(join(dir,file.name),file.data,{flag:'wx'});
  await writeFile(join(dir,'entry.json'),JSON.stringify(entry,null,2),{flag:'wx'});
  return entry;
}
