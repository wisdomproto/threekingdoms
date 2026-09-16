import { gameData, stages } from '@tk/data';
import { isDeepStrictEqual } from 'node:util';
import { readFileSync } from 'node:fs';
const snapshot = JSON.parse(readFileSync('../../.studio/game/791e33c0-eb83-4b40-8b91-f58843ad3a64.9.json','utf8'));
for (const [key, local] of Object.entries({stages,maps:gameData.maps,commanders:gameData.commanders,items:gameData.items})) {
 const changed = Object.keys(snapshot[key]).filter(id=>!isDeepStrictEqual(snapshot[key][id],local[id]));
 console.log(key, changed);
 if(key==='stages')for(const id of changed) console.log(id,Object.keys(snapshot.stages[id]).filter(k=>!isDeepStrictEqual(snapshot.stages[id][k],(stages[id] as any)?.[k])));
}
console.log('Snapshot revision', snapshot.revision);
for(const id of ['01-zhuojun','02-yingchuan','26-chibi']){
 const local=stages[id]!;
 console.log(id,'scripts',JSON.stringify(local.scriptEvents),JSON.stringify(snapshot.stages[id].scriptEvents));
 if(id==='02-yingchuan')console.log('units',JSON.stringify(local.units),JSON.stringify(snapshot.stages[id].units));
}
