import { readFile } from 'node:fs/promises';
import path from 'node:path';
const files:Record<string,string>={achilles:'achilles-chibi.png',patroclus:'patroclus-chibi.png',diores:'diores-chibi.png',troops:'troops-chibi.png',map:'battle-map.png',opening:'opening.png'};
export async function GET(_request:Request,{params}:{params:Promise<{asset:string}>}){
  const {asset}=await params;
  const file=files[asset.replace(/\.png$/, '')];
  if(!file)return new Response('Not found',{status:404});
  const root=path.basename(process.cwd())==='web'?path.resolve(process.cwd(),'../..'):process.cwd();
  try{
    const bytes=await readFile(path.join(root,'docs/troia/first-battle/assets',file));
    return new Response(new Uint8Array(bytes),{headers:{'Content-Type':'image/png','Cache-Control':'public, max-age=3600'}});
  }catch{return new Response('Troy artwork is missing from the local workspace.',{status:404});}
}
