// Local Voicebox presets; no reference voice or external service is used.
import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
const root = path.resolve(import.meta.dirname, '..');
const voicebox = await import(pathToFileURL(process.env.VOICEBOX_MODULE ?? 'C:/projects/comfy_test/lib/voicebox.mjs').href);
if (!await voicebox.isAlive()) throw new Error('Start the local Voicebox backend on port 17493.');
await voicebox.ensureModel({modelName:'qwen-custom-voice-1.7B'});
const sources=path.join(root,'.studio/battle-voices/sources');
const output=path.join(root,'apps/web/public/assets/audio/voices');
await fs.mkdir(sources,{recursive:true}); await fs.mkdir(output,{recursive:true});
const roles=[
  {id:'liubei',speaker:'Aiden',instruct:'A firm heroic male warrior. Short, forceful battle shout in Korean, with a clean explosive attack. No narration, no introduction.',lines:{attack:'이얍!',ultimate:'간다!'}},
  {id:'guanyu',speaker:'Uncle_Fu',instruct:'A powerful mature male warrior with a deep resonant voice. Very short forceful battle shout in Korean. Commanding and grounded, no narration.',lines:{attack:'하앗!',ultimate:'받아라!'}},
  {id:'zhangfei',speaker:'Ryan',instruct:'A muscular male warrior with a rough booming voice. Explosive short battle roar in Korean. Aggressive projection, no narration.',lines:{attack:'으랴!',ultimate:'비켜라!'}},
];
const profiles=await (await fetch(`${voicebox.BASE}/profiles`)).json();
for(const role of roles){
  const name=`TK battle ${role.id} v1`;
  let profile=profiles.find(p=>p.name===name);
  if(!profile){
    const response=await fetch(`${voicebox.BASE}/profiles`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name,language:'ko',voice_type:'preset',preset_engine:'qwen_custom_voice',preset_voice_id:role.speaker,default_engine:'qwen_custom_voice'})});
    if(!response.ok)throw new Error(await response.text());
    profile=await response.json();
  }
  for(const [action,text] of Object.entries(role.lines)){
    const stem=`${role.id}-${action}`, wav=path.join(sources,`${stem}.wav`);
    const request={profile_id:profile.id,text,language:'ko',engine:'qwen_custom_voice',model_size:'1.7B',instruct:role.instruct,seed:1042};
    await fs.writeFile(path.join(sources,`${stem}.json`),JSON.stringify(request,null,2));
    try{await fs.access(wav);}catch{
      console.log(`Generating ${stem}`);
      const response=await fetch(`${voicebox.BASE}/generate/stream`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(request)});
      if(!response.ok)throw new Error(await response.text());
      await fs.writeFile(wav,Buffer.from(await response.arrayBuffer()));
    }
    const result=spawnSync('ffmpeg',['-hide_banner','-loglevel','error','-y','-i',wav,'-af','silenceremove=start_periods=1:start_duration=0.02:start_threshold=-40dB:stop_periods=-1:stop_duration=0.12:stop_threshold=-40dB,loudnorm=I=-18:TP=-2:LRA=7','-ac','1','-ar','24000','-b:a','64k',path.join(output,`${stem}.mp3`)],{encoding:'utf8'});
    if(result.status!==0)throw new Error(result.stderr||'ffmpeg failed');
    console.log(`Ready ${stem}`);
  }
}
