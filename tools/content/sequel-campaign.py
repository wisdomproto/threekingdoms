"""Build the authored post-Red-Cliffs campaign. Does not modify saved projects."""
import json
import runpy
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
DATA = ROOT / 'packages/data/json'
SOURCE = Path(__file__).with_name('sequel-scenes.json')

def read(path):
    return json.loads(path.read_text(encoding='utf-8'))

def write(path, value):
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')

def main():
    entries = read(SOURCE)
    commanders, rosters = read(DATA/'commanders.json'), read(DATA/'rosters.json')
    motion = read(ROOT/'apps/web/public/assets/scene-motions/library.json')['actors']
    actors = {a['name']: key for key, a in motion.items() if not key.startswith('troia')}
    actors.update({'유비':'liubei-leader','관우':'guanyu-leader','장비':'zhangfei-leader','조운':'zhaoyun-robes'})
    new_maps, new_stages = [], []
    for e in entries:
        number, slug = e['number'], e['slug']
        sid = f'{number:02}-{slug}'
        level = number
        names = e['party'] + [e['boss']]
        for i, name in enumerate(names):
            if name not in commanders:
                stats = e.get('stats', {}).get(name, [78, 76, 70])
                commanders[name] = {'id':name,'name':name,'war':stats[0],'leadership':stats[1],'intelligence':stats[2],'agility':70,'luck':65,'faceId':0}
        classes = e.get('classes', {})
        for name in e['party']:
            if name not in rosters:
                klass = classes.get(name, 'footman')
                rosters[name] = {'commanderId':name,'classId':klass,'joinChapter':e['chapter'], 'role':'caster' if klass == 'strategist' else 'melee'}
        units = []
        for i, name in enumerate(e['party']):
            klass = classes.get(name, rosters[name]['classId'])
            units.append({'commanderId':name,'classId':klass,'level':level,'troops':int((300 + level*4 if klass != 'strategist' else 230+level*3)*e.get('partyStrength',1)),'items':rosters[name].get('startItems',[]),'side':'player','x':4+i%3,'y':7+(i//3)*2,'facing':'right'})
        units.append({'commanderId':e['boss'],'classId':classes.get(e['boss'],'footman'),'level':level,'troops':310+level*3,'items':[],'side':'enemy','x':23,'y':10,'facing':'left'})
        for i in range(7):
            uid = f'{sid}-guard-{i+1}'
            klass = ['footman','archer','lightCavalry','footman','strategist','archer','footman'][i]
            commanders[uid] = {'id':uid,'name':f'{e["army"]} {i+1}', 'war':65+i%3*5,'leadership':66,'intelligence':76 if klass=='strategist' else 48,'agility':60,'luck':50,'faceId':0}
            units.append({'commanderId':uid,'classId':klass,'level':max(1,level-2),'troops':195+level*3,'items':[],'side':'enemy','x':17+(i%3)*2,'y':6+(i//3)*3,'facing':'left'})
        # Original tactical layouts: two or three approaches; no borrowed bitmap.
        width, height = 28, 20
        grid = [['.' for _ in range(width)] for _ in range(height)]
        terrain = e['terrain']
        for y in range(height):
            for x in range(width):
                if y in (0,1,height-2,height-1): grid[y][x] = 'm' if terrain in ('mountain','pass') else 'g'
                elif (x*7+y*3+number)%29==0: grid[y][x]='g'
        if terrain in ('river','riverfort'):
            for y in range(height):
                for x in (12,13,14): grid[y][x] = 'b' if y in (6,7,10,11,14,15) else '~'
        if terrain in ('siege','riverfort'):
            for y in range(3,17): grid[y][20] = '.' if y in (6,7,10,11,14) else '#'
            grid[10][23]='F'
        if terrain in ('mountain','pass'):
            for y in range(3,17):
                if y not in (5,6,7,10,11,14,15):
                    for x in range(10,16): grid[y][x]='m'
        if terrain in ('forest','marsh'):
            for y in range(3,17):
                for x in range(9,18):
                    if (x+y+number)%4 == 0 and y not in (7,10,13): grid[y][x]='f'
        for u in units:
            for dy in (-1,0,1):
                for dx in (-1,0,1):
                    x,y=u['x']+dx,u['y']+dy
                    if 0<x<width-1 and 1<y<height-2: grid[y][x]='.'
        grid[10][23]='F'
        if terrain in ('siege','riverfort'):
            runpy.run_path(str(Path(__file__).with_name('sequel-cities.py')))['build_city'](grid, units, slug)
        map_data={'id':slug,'name':e['name'],'width':width,'height':height,'tileLegend':{'.':'plain','P':'plain','g':'grass','m':'mountain','f':'forest','~':'river','b':'bridge','#':'wall','F':'fort','G':'gate','V':'village'},'tiles':[''.join(row) for row in grid]}
        script={'id':sid+'-event','name':e['eventName'],'editingMode':'simple','trigger':{'kind':'turn','turn':e.get('eventTurn',3),'phase':'player'},'actions':[{'kind':'message','text':e['eventText']}]}
        area={'x':15,'y':5,'width':10,'height':10}
        target={'side':'enemy','area':area}
        mode=e['event']
        if mode=='fire':
            fire_area={'x':7 if e.get('disaster') else 16,'y':5,'width':5,'height':9}
            if e.get('disaster'): target={'side':'player'}
            script['actions'] += [{'kind':'fire','area':fire_area,'duration':3,'damagePercent':8,'spread':False,'flammableOnly':False}, {'kind':'damage','target':target,'amount':20 if e.get('disaster') else 15,'percent':True,'nonlethal':True}]
        elif mode=='water':
            script['actions'] += [{'kind':'weather','weather':'rain'},{'kind':'effect','effect':'water','area':area},{'kind':'damage','target':target,'amount':e.get('waterDamage',22),'percent':True,'nonlethal':True}]
        elif mode=='rain':
            script['actions'] += [{'kind':'weather','weather':'rain'}]
        elif mode=='supply':
            script['actions'] += [{'kind':'heal','target':{'side':'player'},'amount':20,'percent':True}]
        elif mode=='ambush':
            script['actions'] += [{'kind':'effect','effect':'rock','area':area},{'kind':'damage','target':target,'amount':12,'percent':True,'nonlethal':True}]
        elif mode=='retreat':
            script['actions'] += [{'kind':'heal','target':{'side':'player'},'amount':12,'percent':True}]
        # One event cue, synchronized by scriptFired; no duplicate message popup.
        script['actions'] = script['actions'][1:]
        if not any(action['kind']=='effect' for action in script['actions']):
            script['actions'].insert(0, {'kind':'effect','effect':'fire' if mode=='fire' else 'water' if mode=='rain' else 'special','area':fire_area if mode=='fire' else {'x':3,'y':5,'width':5,'height':9}})
        objectives=[{'kind':'defeatUnit','unitId':e['boss']}]
        if e.get('survive'): objectives=[{'kind':'surviveTurns','turns':e['survive']}]
        for unit in units:
            if unit['side']=='enemy': unit['level']+=e.get('enemyLevelBonus',0)
        stage={'id':sid,'name':e['name'],'mapId':slug,'turnLimit':30,'levelCap':min(99,level+8),'camera':{'zoom':1.5,'focus':[7,10]},'allowedCommanderIds':e['party'],'units':units,'objectives':objectives,'failConditions':[{'kind':'allRetreated','unitIds':e['party']},{'kind':'turnLimitExceeded'}], 'events':[], 'scriptEvents':[script], 'reward':{'gold':1800+number*70,'exp':0,'treasures':[]}, 'dialogue':[{'id':sid+'-opening','trigger':{'kind':'battleStart'},'lines':[{'speaker':e['party'][0],'side':'player','text':e['briefing']}]}]}
        stage['scenario']={}
        stage['dialogue'].append({'id':sid+'-event-cue','trigger':{'kind':'scriptFired','scriptId':script['id']},'lines':[{'speaker':e['party'][0],'side':'player','text':e['eventText']}]})
        for slot in ('intro','outro'):
            lines=[]
            for line in e[slot]:
                speaker, text=line.split('|',1)
                lines.append({'speaker':speaker,'portraitId':speaker,'text':text} if speaker else {'text':text})
            speakers=list(dict.fromkeys(line['speaker'] for line in lines if line.get('speaker')))
            cast=[name for name in speakers if name in actors]
            if cast and len(cast)==len(speakers) and len(cast)<=6:
                cells=[[3,4],[6,4],[8,5],[4,5],[7,6],[9,4]]
                scene={'map':e.get('scene','scene-camp-day'),'label':e['name']+(' · 전야' if slot=='intro' else ' · 그 뒤'),'camera':{'zoom':1.3},'units':[{'id':n,'sprite':actors[n],'cell':cells[i],'facing':'right' if i%2==0 else 'left'} for i,n in enumerate(cast)],'lines':lines}
                # A deliberate entry and turn toward the speaker, without random posing.
                first=next((line for line in lines if line.get('speaker')==cast[0]), None)
                if first: first['pose']=[{'id':cast[0],'pose':'talk'}]
                lines[-1]['pose']=[{'id':n,'pose':'idle'} for n in cast]
                lines[-1]['move']=[{'id':cast[0],'to':[5,6]}]
            else:
                scene={'bg':'18-bowangpo-outro','lines':lines}
            stage['scenario'][slot]=[scene]
        stage['scenario']['outroDefeat']={'bg':'18-bowangpo-outro','lines':[{'text':e['name']+'의 작전은 이루어지지 않았다. 흩어진 병력을 모아 진로와 보급을 다시 살펴야 했다.'}]}
        write(DATA/'maps'/f'{slug}.json',map_data)
        write(DATA/'stages'/f'{sid}.json',stage)
        new_maps.append(map_data); new_stages.append(stage)
    write(DATA/'commanders.json',commanders)
    write(DATA/'rosters.json',rosters)
    index=DATA.parent/'src/sequel.ts'
    code='// Generated from tools/content/sequel-scenes.json.\n'
    for s in new_stages: code+=f'import s{s["id"][:2]} from "../json/stages/{s["id"]}.json";\n'
    for i,m in enumerate(new_maps): code+=f'import m{i} from "../json/maps/{m["id"]}.json";\n'
    code+='export const sequelStages = ['+', '.join('s'+s['id'][:2] for s in new_stages)+'];\n'
    code+='export const sequelMaps = ['+', '.join(f'm{i}' for i in range(len(new_maps)))+'];\n'
    index.write_text(code,encoding='utf-8')
    print(f'Authored {len(entries)} battles, {sum(len(e["intro"])+len(e["outro"]) for e in entries)} story lines. Saved Studio projects untouched.')

if __name__ == '__main__': main()
