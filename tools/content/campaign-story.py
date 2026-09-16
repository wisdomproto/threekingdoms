"""Stage chapters 2–5 while retaining every authored dialogue line and combat field."""
import copy
import json
from pathlib import Path

ROOT=Path(__file__).resolve().parents[2]
STAGES=ROOT/'packages/data/json/stages'
CAST={'유비':'liubei','관우':'guanyu','장비':'zhangfei','공손찬':'gongsunzan','조조':'caocao','조운':'zhaoyun','간옹':'jianyong','미축':'mizhu','손건':'sunqian','진등':'chendeng','미방':'mifang','도겸':'taoqian','서서':'xushu','제갈량':'zhugeliang','주유':'zhouyu','황개':'huanggai','백성':'civilian','병사':'soldier'}
MAPS={
 5:('camp-day','camp-day'),6:('town-gate','town-gate'),7:('ruined-city','ruined-city'),8:('refugee-road','refugee-road'),9:('river-landing','river-landing'),
 10:('camp-day','council-hall'),11:('council-hall','town-gate'),12:('refugee-road','river-landing'),13:('camp-day','town-gate'),14:('river-landing','town-gate'),15:('refugee-road','council-hall'),
 16:('refugee-road','camp-day'),17:('camp-day','camp-day'),18:('council-hall','camp-day'),19:('town-gate','river-landing'),20:('refugee-road','camp-day'),21:('changban-bridge','changban-bridge'),22:('river-landing','command-deck'),
 23:('river-landing','command-deck'),24:('command-deck','command-deck'),25:('command-deck','river-landing'),26:('command-deck','command-deck'),27:('refugee-road','refugee-road')}
LABELS={5:('연합군 · 식지 않은 술','연합군 · 돌아온 관우'),6:('호로관 · 셋이서 간다','호로관 · 물러난 여포'),7:('낙양 · 사람부터 구한다','낙양 · 살아남은 사람들'),8:('추격로 · 복병의 기척','관문 · 흩어지는 연합'),9:('반하 · 백마의 젊은 장수','반하 · 자룡의 약속'),10:('서주의 사자들','서주 · 백성을 맡기다'),11:('소패 · 지켜야 할 성','소패 · 다음 길'),12:('소패 밖 · 탈출','강가 · 살아남은 형제'),13:('회남 · 토벌 명령','회남 · 민심과 옥새'),14:('하비 · 차오르는 물','백문루 · 신의의 값'),15:('허전 · 참아야 하는 칼','허도 · 밀명'),16:('관도 · 멈추지 마라','북쪽 진영 · 헤어진 형제'),17:('여남 · 천 리의 귀환','여남 · 다시 한자리'),18:('신야 · 군사의 첫 계책','박망파 · 벗의 작별'),19:('신야 · 백성과 함께','강가 · 버리지 않은 사람들'),20:('장판 · 돌아서는 백마','진영 · 돌아온 자룡'),21:('장판교 · 혼자 남다','장판교 · 호통'),22:('한진 · 강 위의 마중','함상 · 강동으로'),23:('강하 · 동맹의 첫 싸움','함상 · 두 천재'),24:('삼강구 · 수군을 시험하다','함상 · 살기와 웃음'),25:('출항 전 · 노장의 각오','오림 · 매값'),26:('적벽 · 바람을 기다리다','적벽 · 갈라지는 천하'),27:('화용도 · 의리의 무게','화용도 · 첫 이야기의 끝')}

# Per-scene dramatic beats: source line indexes (including establishing narration).
# Each event is (line, actor name, action, value). All movement is deliberate horizontal blocking.
BEATS={
 (5,'intro'):[(2,'공손찬','salute',None),(3,'장비','step',None),(4,'관우','salute',None),(5,'유비','talk',None),(6,'관우','leave',None)],
 (5,'outro'):[(1,'관우','arrive',None),(2,'관우','salute',None),(3,'장비','talk','!')],
 (6,'intro'):[(3,'장비','step','!'),(4,'유비','talk','!'),(5,'관우','salute',None),(6,'장비','leave',None)],
 (6,'outro'):[(1,'병사','talk','!'),(2,'장비','rest',None),(4,'유비','talk',None)],
 (7,'intro'):[(2,'간옹','arrive',None),(3,'장비','step','!'),(5,'유비','talk','!')],
 (7,'outro'):[(1,'백성','arrive','...'),(2,'유비','idle','...'),(3,'간옹','salute',None)],
 (8,'intro'):[(3,'간옹','talk','!'),(4,'유비','step',None),(5,'장비','leave',None)],
 (8,'outro'):[(1,'유비','idle','...'),(3,'간옹','salute',None)],
 (9,'intro'):[(1,'공손찬','salute',None),(2,'유비','salute',None),(3,'조운','arrive',None),(4,'조운','talk',None),(5,'장비','talk','!')],
 (9,'outro'):[(1,'조운','step',None),(3,'조운','salute',None)],
 (10,'intro'):[(1,'진등','arrive',None),(1,'미방','arrive',None),(2,'진등','salute',None),(3,'미방','salute',None),(4,'장비','talk','!'),(6,'유비','step',None)],
 (10,'outro'):[(1,'백성','talk','!'),(2,'도겸','salute',None),(3,'유비','salute',None)],
 (11,'intro'):[(2,'장비','step','!'),(3,'유비','idle','...'),(4,'진등','arrive',None)],
 (11,'outro'):[(1,'병사','talk','!'),(2,'유비','idle','...'),(3,'진등','step',None)],
 (12,'intro'):[(2,'관우','step',None),(3,'장비','talk','!'),(4,'유비','idle','...'),(6,'유비','leave',None)],
 (12,'outro'):[(1,'유비','rest','...'),(2,'관우','salute',None),(3,'장비','talk','!')],
 (13,'intro'):[(3,'장비','talk','!'),(4,'간옹','salute',None)],
 (13,'outro'):[(1,'병사','talk','!'),(2,'유비','idle','...'),(3,'관우','salute',None)],
 (14,'intro'):[(1,'진등','arrive',None),(3,'장비','step','!'),(4,'유비','idle','...')],
 (14,'outro'):[(1,'장비','talk','!'),(2,'유비','idle','...')],
 (15,'intro'):[(2,'관우','step',None),(3,'유비','step','...'),(4,'장비','idle','...')],
 (15,'outro'):[(1,'유비','idle','...'),(2,'관우','salute',None),(3,'유비','talk',None)],
 (16,'intro'):[(2,'조운','step',None),(3,'간옹','salute',None),(5,'유비','talk','!')],
 (16,'outro'):[(1,'유비','rest','...'),(2,'조운','salute',None)],
 (17,'intro'):[(2,'손건','arrive','!'),(3,'유비','idle','!'),(4,'장비','talk','!'),(5,'관우','arrive',None),(5,'관우','salute',None),(6,'유비','step',None)],
 (17,'outro'):[(1,'장비','talk','!'),(2,'관우','salute',None),(3,'유비','salute',None)],
 (18,'intro'):[(1,'서서','salute',None),(2,'제갈량','talk',None),(3,'장비','step','?'),(5,'제갈량','salute',None)],
 (18,'outro'):[(1,'장비','salute',None),(3,'서서','salute',None),(4,'서서','leave',None)],
 (19,'intro'):[(1,'제갈량','talk',None),(2,'유비','idle','?'),(5,'유비','step',None),(6,'조운','salute',None),(7,'조운','leave',None)],
 (19,'outro'):[(1,'백성','arrive','...'),(2,'유비','salute',None),(3,'제갈량','salute',None)],
 (20,'intro'):[(2,'조운','step',None),(3,'조운','idle','...'),(5,'조운','leave',None)],
 (20,'outro'):[(1,'조운','arrive',None),(2,'유비','step','!'),(3,'조운','salute',None)],
 (21,'intro'):[(2,'장비','emphasize','!'),(3,'장비','talk',None),(4,'장비','emphasize','!')],
 (21,'outro'):[(1,'장비','emphasize','!'),(2,'장비','talk',None),(3,'장비','leave',None)],
 (22,'intro'):[(1,'장비','talk','!'),(3,'관우','arrive',None),(3,'관우','salute',None),(4,'유비','salute','!')],
 (22,'outro'):[(1,'유비','idle','?'),(2,'제갈량','salute',None),(3,'제갈량','leave',None)],
 (23,'intro'):[(1,'제갈량','salute',None),(3,'관우','talk',None),(4,'유비','step',None)],
 (23,'outro'):[(1,'주유','arrive',None),(2,'제갈량','salute',None)],
 (24,'intro'):[(1,'주유','talk',None),(3,'주유','idle','...'),(4,'유비','salute',None)],
 (24,'outro'):[(1,'병사','talk','!'),(2,'주유','step',None),(3,'제갈량','salute',None)],
 (25,'intro'):[(2,'황개','arrive',None),(2,'황개','salute',None),(4,'유비','salute',None)],
 (25,'outro'):[(1,'황개','talk','!'),(2,'유비','salute',None)],
 (26,'intro'):[(2,'제갈량','salute',None),(3,'주유','talk','!'),(5,'유비','step','!')],
 (26,'outro'):[(1,'주유','talk','!'),(2,'병사','talk','!'),(3,'제갈량','talk',None),(4,'유비','idle','...')],
 (27,'intro'):[(2,'관우','salute',None),(3,'제갈량','talk',None),(4,'관우','idle','...'),(6,'관우','leave',None)],
 (27,'outro'):[(1,'관우','kneel',None),(2,'제갈량','talk',None),(3,'유비','step',None),(4,'관우','idle',None)]}

def appearance(name,n,slot):
 id=CAST[name]
 if name=='백성':return 'civilian-scene'
 if name=='병사':return 'soldier-story'
 if n==20 and name=='조운':return 'zhaoyun-rescue' if slot=='outro' else 'zhaoyun-field'
 if n==21 and name=='장비':return 'zhangfei-bridge'
 if n==27 and slot=='outro' and name=='관우':return 'guanyu-foot'
 if name in ['유비','관우','장비']:return id+('-foot' if n<10 else '-official' if n<18 else '-leader')
 return id+'-robes'

def main():
 library=json.loads((ROOT/'apps/web/public/assets/scene-motions/library.json').read_text(encoding='utf-8'))
 for p in sorted(STAGES.glob('*.json')):
  n=int(p.name[:2])
  if n<5:continue
  d=json.loads(p.read_text(encoding='utf-8'))
  for si,slot in enumerate(['intro','outro']):
   old=d['scenario'][slot]
   if not isinstance(old,dict) or 'map' in old:continue
   source=old['lines'];names=list(dict.fromkeys(l['speaker'] for l in source if l.get('speaker')))
   names.sort(key=lambda name: ['유비','관우','장비'].index(name) if name in ['유비','관우','장비'] else 3)
   cells=([[5,4]] if len(names)==1 else [[4,4],[7,4]] if len(names)==2 else [[4,4],[7,3],[7,5]] if len(names)==3 else [[4,4],[3,5],[7,5],[7,3]] if len(names)==4 else [[4,4],[3,5],[5,5],[7,4],[7,3],[8,5]])
   if n==21:cells=[[5,3]]
   units=[dict(id=CAST[name],sprite=appearance(name,n,slot),cell=list(cells[i]),facing='right' if cells[i][0]<6 else 'left') for i,name in enumerate(names)]
   byid={u['id']:u for u in units};beats=BEATS[n,slot]
   for _,name,action,_ in beats:
    if action=='arrive' and CAST[name] in byid:byid[CAST[name]]['hidden']=True
   # Preserve the original establishing image/narration. All subsequent dialogue plays on the set.
   split=1 if not source[0].get('speaker') else 0
   lines=[];hidden={u['id'] for u in units if u.get('hidden')};positions={u['id']:u['cell'][:] for u in units}
   for i,original in enumerate(source[split:],start=split):
    line=copy.deepcopy(original);line.pop('bg',None)
    line['pose']=[{'id':u['id'],'pose':'idle'} for u in units if u['id'] not in hidden]
    speaker=CAST.get(line.get('speaker'))
    if speaker:
     assert speaker not in hidden or any(at==i and CAST[name]==speaker and action=='arrive' for at,name,action,_ in beats),(n,slot,'Speaking before entrance',speaker)
     if 'left.talk' in library['actors'][byid[speaker]['sprite']]['clips']:
      line['pose']=[a for a in line['pose'] if a['id']!=speaker]+[{'id':speaker,'pose':'talk'}]
    for at,name,action,bubble in beats:
     if at!=i:continue
     id=CAST[name]
     if id not in byid:continue
     x,y=positions[id]
     if action=='arrive':
      line.setdefault('enter',[]).append({'id':id,'from':[10,y],'to':[x,y]});hidden.discard(id)
      line.setdefault('face',[]).append({'id':id,'dir':byid[id]['facing']})
     elif action=='leave':
      line.setdefault('exit',[]).append({'id':id,'to':[1,y]});hidden.add(id)
     elif action=='step':
      target=[x+1 if x<6 else x-1,y]
      if target not in [v for k,v in positions.items() if k!=id and k not in hidden]:
       line.setdefault('move',[]).append({'id':id,'to':target});positions[id]=target
      action='talk'
     if action not in ['arrive','leave','step']:
      clips=library['actors'][byid[id]['sprite']]['clips']
      if 'left.'+action not in clips:action='talk' if 'left.talk' in clips else 'idle'
      line['pose']=[a for a in line['pose'] if a['id']!=id]+[{'id':id,'pose':action}]
     if bubble:line['bubble']={'id':id,'mark':bubble}
    if speaker:assert speaker not in hidden,(n,slot,'Speaker exited before own dialogue',speaker)
    lines.append(line)
   part={'map':'scene-'+MAPS[n][si],'label':LABELS[n][si],'camera':{'zoom':1.3 if len(names)>1 else 1.6,'focus':[5,4]},'units':units,'lines':lines}
   parts=([dict(bg=old['bg'],lines=copy.deepcopy(source[:split]))] if split else [])+[part]
   keys=['speaker','portraitId','side','text'];assert [{k:l[k] for k in keys if k in l} for l in source]==[{k:l[k] for k in keys if k in l} for pt in parts for l in pt['lines']]
   d['scenario'][slot]=parts
  p.write_text(json.dumps(d,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
 print('Authored 46 slots; all dialogue retained.')

if __name__=='__main__':main()
