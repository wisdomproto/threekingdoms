const fs=require('fs'), path=require('path');
const stageDir='packages/data/json/stages';
const mapDir='packages/data/json/maps';
const files=fs.readdirSync(stageDir).filter(f=>f.endsWith('.json')).sort();
const problems=[];

for(const f of files){
  const s=JSON.parse(fs.readFileSync(path.join(stageDir,f),'utf8'));
  const mapFile=path.join(mapDir,s.mapId+'.json');
  let rows=99,cols=99;
  if(fs.existsSync(mapFile)){
    const m=JSON.parse(fs.readFileSync(mapFile,'utf8'));
    rows=m.rows||m.height||99;
    cols=m.cols||m.width||99;
  }
  const commanderIds=new Set((s.units||[]).map(u=>u.commanderId));
  const unitPositions=new Set();
  const stageProbs=[];

  for(const u of (s.units||[])){
    if(u.x<0||u.x>=cols||u.y<0||u.y>=rows)
      stageProbs.push('['+u.commanderId+'] 좌표('+u.x+','+u.y+') 맵 범위 초과 ['+cols+'x'+rows+']');
    const pos=u.x+','+u.y;
    if(unitPositions.has(pos)) stageProbs.push('좌표('+u.x+','+u.y+') 겹침 ['+u.commanderId+']');
    unitPositions.add(pos);
  }

  for(const obj of (s.objectives||[])){
    if(obj.unitId && !commanderIds.has(obj.unitId))
      stageProbs.push('objective unitId['+obj.unitId+'] 없음 — 맵 유닛IDs: '+[...commanderIds].join(','));
  }
  for(const fc of (s.failConditions||[])){
    if(fc.unitId && !commanderIds.has(fc.unitId))
      stageProbs.push('failCond unitId['+fc.unitId+'] 없음');
  }
  for(const ev of (s.events||[])){
    if(ev.unitId && !commanderIds.has(ev.unitId))
      stageProbs.push('event unitId['+ev.unitId+'] 없음');
    if(ev.trigger&&ev.trigger.unitId && !commanderIds.has(ev.trigger.unitId))
      stageProbs.push('event trigger.unitId['+ev.trigger.unitId+'] 없음');
  }

  if(!fs.existsSync(mapFile)) stageProbs.push('맵파일 없음: maps/'+s.mapId+'.json');

  const hasIntro=!!(s.scenario&&s.scenario.intro&&s.scenario.intro.length);
  const hasOutro=!!(s.scenario&&s.scenario.outro&&s.scenario.outro.length);
  const pl=(s.units||[]).filter(u=>u.side==='player').length;
  const en=(s.units||[]).filter(u=>u.side==='enemy').length;
  const al=(s.units||[]).filter(u=>u.side==='ally').length;

  if(stageProbs.length){
    problems.push({id:s.id, name:s.name, probs:stageProbs});
    console.log('⚠  ['+s.id+'] '+s.name+'  pl:'+pl+' en:'+en+' al:'+al+' intro:'+( hasIntro?'O':'X')+' outro:'+(hasOutro?'O':'X'));
    stageProbs.forEach(x=>console.log('     • '+x));
  } else {
    console.log('✅ ['+s.id+'] '+s.name+'  pl:'+pl+' en:'+en+' al:'+al+' intro:'+(hasIntro?'O':'X')+' outro:'+(hasOutro?'O':'X'));
  }
}
console.log('\n'+(problems.length ? problems.length+'개 스테이지 이슈' : '전체 이슈 없음')+' / 총 '+files.length+'개');
