const fs=require('fs'), path=require('path');
const stageDir='packages/data/json/stages';
const mapDir='packages/data/json/maps';
const terrains=JSON.parse(fs.readFileSync('packages/data/json/terrains.json','utf8'));

// 이동 불가 지형 id 목록
const IMPASSABLE=new Set(Object.entries(terrains)
  .filter(([,d])=>Object.values(d.moveCost||{}).some(v=>v>=99))
  .map(([id])=>id));
console.log('이동불가 지형:', [...IMPASSABLE].join(', '));
console.log('');

const files=fs.readdirSync(stageDir).filter(f=>f.endsWith('.json')).sort();
let total=0, bad=0;

for(const f of files){
  const s=JSON.parse(fs.readFileSync(path.join(stageDir,f),'utf8'));
  const mapFile=path.join(mapDir,s.mapId+'.json');
  if(!fs.existsSync(mapFile)){
    console.log('⚠  ['+s.id+'] 맵 없음: '+s.mapId);
    continue;
  }
  const m=JSON.parse(fs.readFileSync(mapFile,'utf8'));
  const legend=m.tileLegend||{};
  const tiles=m.tiles; // tiles[y] = string of chars
  const W=m.width, H=m.height;

  const stageBad=[];
  for(const u of (s.units||[])){
    total++;
    const x=u.x, y=u.y;
    if(y<0||y>=H||x<0||x>=W){
      stageBad.push('['+u.commanderId+'('+u.side+')] 좌표('+x+','+y+') 맵 범위 벗어남 (맵 '+W+'x'+H+')');
      bad++;
      continue;
    }
    const row=tiles[y];
    if(!row){
      stageBad.push('['+u.commanderId+'('+u.side+')] y='+y+' 행 없음');
      bad++;
      continue;
    }
    const ch=row[x];
    const terrainId=legend[ch]||ch;
    if(IMPASSABLE.has(terrainId)){
      stageBad.push('['+u.commanderId+'('+u.side+')] ('+x+','+y+')='+terrainId+' ⛔ 이동불가 지형');
      bad++;
    }
  }

  if(stageBad.length){
    console.log('⚠  ['+s.id+'] '+s.name);
    stageBad.forEach(x=>console.log('     • '+x));
  } else {
    console.log('✅ ['+s.id+'] '+s.name);
  }
}
console.log('\n유닛 '+total+'개 중 이동불가 지형 스폰: '+bad+'개');
