"""Author chapter-one blocking from preserved dialogue; never rewrite an existing map scene."""
import copy
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
STAGES = ROOT / 'packages/data/json/stages'

def unit(id, sprite, x, y, facing='left', hidden=False):
    return dict(id=id, sprite=sprite, cell=[x,y], facing=facing, hidden=hidden)

def brothers():
    return [unit('liu','liubei-foot',5,4,'right'),unit('guan','guanyu-foot',4,5,'up'),unit('zhang','zhangfei-foot',6,5,'up')]

def pose(id, value): return dict(id=id,pose=value)
def face(id, value): return dict(id=id,dir=value)
def move(id, x, y): return dict(id=id,to=[x,y])
def enter(id, x, y, tx, ty): return {'id':id,'from':[x,y],'to':[tx,ty]}

def scene(map, label, units, lines, edits, seated=False):
    result=copy.deepcopy(lines)
    names={'유비':'liu','관우':'guan','장비':'zhang','조조':'cao','공손찬':'gong','미축':'mi','백성':'civilian','병사':'soldier'}
    library=json.loads((ROOT/'apps/web/public/assets/scene-motions/library.json').read_text(encoding='utf-8'))
    byid={u['id']:u for u in units}
    for i,line in enumerate(result):
        speaker=names.get(line.get('speaker'))
        # Reset reactions between lines; retain seated posture during the night council.
        line['pose']=[pose(u['id'],'rest' if seated and u['id'] in ['liu','guan','zhang'] else 'sit' if seated else 'idle') for u in units]
        if speaker in byid and not seated:
            u=byid[speaker];direction='left' if u['facing']=='right' else u['facing']
            if f'{direction}.talk' in library['actors'].get(u['sprite'],{}).get('clips',{}):
                line['pose']=[p for p in line['pose'] if p['id']!=speaker]+[pose(speaker,'talk')]
        for key,value in edits.get(i,{}).items():
            if key=='pose':
                ids={p['id'] for p in value};line[key]=[p for p in line[key] if p['id'] not in ids]+value
            else: line[key]=value
        if seated and i < len(result)-1:
            for action in line['pose']:
                if action['id'] in ['liu','guan','zhang']:
                    action['pose']={'talk':'rest-talk','emphasize':'rest-emphasize'}.get(action['pose'],action['pose'])
    return dict(map=map,label=label,camera=dict(zoom=1.25,focus=[5,4]),units=units,lines=result)

def main():
    for number in range(1,5):
        p=next(STAGES.glob(f'{number:02}-*.json'));d=json.loads(p.read_text(encoding='utf-8'))
        for slot in ['intro','outro']:
            if number==1 and slot=='intro':continue
            old=d['scenario'][slot]
            if not isinstance(old,dict) or 'map' in old:continue
            lines=old['lines'];parts=[]
            if number==1:
                units=brothers()+[unit('civilian','civilian-scene',7,2,'left',True)]
                parts=[scene('scene-town-gate','탁군 · 첫 승리',units,lines,{
                    0:{'enter':[enter('civilian',7,2,7,4)]},
                    2:{'pose':[pose('zhang','emphasize')],'bubble':{'id':'zhang','mark':'!'}},
                    3:{'face':[face('zhang','left')],'pose':[pose('guan','talk')]},
                    4:{'pose':[pose('liu','salute')]}})]
            elif number==2 and slot=='intro':
                parts=[scene('scene-camp-day','남하 · 영천으로',brothers(),lines[:2],{1:{'pose':[pose('liu','emphasize')]}}),
                    scene('scene-camp-day','영천 · 조조와의 첫 만남',brothers()+[unit('cao','caocao-robes',9,4,'left',True)],lines[2:],{
                        0:{'enter':[enter('cao',9,4,7,4)]},
                        3:{'move':[move('zhang',6,4)],'face':[face('zhang','right')],'pose':[pose('zhang','emphasize')],'bubble':{'id':'zhang','mark':'!'}},
                        4:{'pose':[pose('liu','idle')],'bubble':{'id':'liu','mark':'...'}},
                        5:{'pose':[pose('liu','salute')]}})]
            elif number==2:
                parts=[scene('scene-camp-day','영천 · 엇갈리는 길',brothers()+[unit('cao','caocao-robes',7,4)],lines,{
                    1:{'pose':[pose('cao','talk')]},2:{'pose':[pose('zhang','emphasize')],'bubble':{'id':'zhang','mark':'!'}},
                    3:{'exit':[move('cao',10,4)],'face':[face('liu','left')],'bubble':{'id':'liu','mark':'...'}}})]
            elif number==3 and slot=='intro':
                parts=[scene('scene-camp-day','북쪽 길 · 옛 벗과의 재회',brothers()+[unit('gong','gongsunzan-robes',10,4,'left',True)],lines[:3],{
                    0:{'enter':[enter('gong',10,4,7,4)]},1:{'pose':[pose('gong','salute')],'bubble':{'id':'liu','mark':'!'}},2:{'pose':[pose('liu','salute')]}}),
                    scene('scene-town-gate','광종 · 성문을 앞두고',brothers(),lines[3:],{
                        0:{'face':[face('liu','up'),face('guan','up'),face('zhang','up')]},
                        1:{'pose':[pose('zhang','emphasize')]},3:{'pose':[pose('liu','emphasize')]}})]
            elif number==3:
                parts=[scene('scene-town-gate','광종 · 열린 성문',brothers()+[unit('gong','gongsunzan-robes',8,4),unit('civilian','civilian-scene',7,2,'left',True)],lines,{
                    0:{'enter':[enter('civilian',7,2,7,3)]},1:{'bubble':{'id':'civilian','mark':'!'}},
                    2:{'pose':[pose('gong','salute')]},3:{'pose':[pose('liu','salute')]}})]
            elif slot=='intro':
                units=[unit('liu','liubei-foot',4,3,'right'),unit('guan','guanyu-foot',4,4,'right'),unit('zhang','zhangfei-foot',7,4),unit('mi','mizhu-robes',7,3)]
                parts=[dict(bg=old['bg'],lines=lines[:1]),scene('scene-camp-night','장각 토벌 · 결전 전야',units,lines[1:],{
                    2:{'pose':[pose('zhang','emphasize')],'bubble':{'id':'zhang','mark':'!'}},
                    3:{'pose':[pose('guan','talk')]},4:{'bubble':{'id':'liu','mark':'...'}},
                    5:{'pose':[pose('liu','emphasize')]},
                    6:{'pose':[pose(u['id'],'idle') for u in units]}},seated=True)]
                parts[-1]['lines'].append({'exit':[move('liu',4,7),move('guan',5,7),move('zhang',7,7),move('mi',6,7)]})
            else:
                parts=[scene('scene-town-gate','황건의 난 · 돌아갈 곳',brothers()+[unit('soldier','civilian-scene',8,4)],lines,{
                    1:{'bubble':{'id':'soldier','mark':'!'}},2:{'pose':[pose('liu','idle')],'bubble':{'id':'liu','mark':'...'}},
                    3:{'face':[face('guan','right')],'pose':[pose('guan','talk')]},4:{'pose':[pose('liu','salute')]}})]
            # Retain all authored dialogue/portraits/sides verbatim and in order.
            original=[{k:v for k,v in l.items() if k in ['text','speaker','portraitId','side']} for l in lines]
            authored=[{k:v for k,v in l.items() if k in ['text','speaker','portraitId','side']} for part in parts for l in part['lines'] if 'text' in l]
            assert original==authored,(p.name,slot)
            d['scenario'][slot]=parts
        p.write_text(json.dumps(d,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')

if __name__=='__main__':main()
