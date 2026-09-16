"""Stage reviewed novel passages using the existing authorable MapScene contract.

No battle data or motion library is modified. Explicit direction notes below are
matched against manuscript text, so missing cues fail instead of shifting actions.
"""
import argparse
import copy
import datetime
import json
from pathlib import Path
import runpy

ROOT = Path(__file__).resolve().parents[2]
LIBRARY = json.loads((ROOT / 'apps/web/public/assets/scene-motions/library.json').read_text(encoding='utf-8'))['actors']
MANUSCRIPT = runpy.run_path(str(Path(__file__).with_name('expand-campaign-novel.py')))['read_manuscript']()
ACTORS = {v['name']: k for k, v in LIBRARY.items()}
ACTORS.update({'유비': 'liubei-foot', '관우': 'guanyu-foot', '장비': 'zhangfei-foot', '조운': 'zhaoyun-robes'})

# Stage, slot, set, visible cast. Omitted passages retain their illustrated narration.
PLANS = [
    (1,'intro','scene-01-street','유비 간옹'), (1,'outro','scene-camp-night','유비 관우 장비 병사'),
    (2,'intro','scene-camp-day','유비 관우 장비'), (2,'outro','scene-camp-night','유비 관우 장비'),
    (3,'intro','scene-camp-day','유비 공손찬 관우 장비'),
    (4,'intro','scene-camp-night','유비 관우 장비 백성'),
    (5,'intro','scene-council-hall','유비 공손찬 관우 장비'), (5,'outro','scene-camp-night','유비 관우 공손찬'),
    (6,'intro','scene-camp-day','유비 관우 장비'), (6,'outro','scene-camp-night','유비 관우 장비'),
    (7,'intro','scene-ruined-city','유비 간옹 장비'), (7,'outro','scene-ruined-city','유비 간옹 장비'),
    (8,'intro','scene-camp-day','유비 간옹 관우 장비'), (8,'outro','scene-camp-night','유비 관우 장비'),
    (9,'intro','scene-camp-day','유비 조운'), (9,'outro','scene-refugee-road','유비 조운 관우 장비'),
    (10,'intro','scene-camp-day','유비 간옹 관우 장비 병사'), (10,'outro','scene-council-hall','유비 도겸 미축 관우'),
    (11,'intro','scene-council-hall','유비 장비 관우'), (11,'outro','scene-camp-night','유비 장비 관우'),
    (12,'intro','scene-town-gate','유비 간옹 관우 조운'), (12,'outro','scene-camp-night','유비 관우 장비 간옹'),
    (13,'intro','scene-camp-day','유비 미축 관우'), (13,'outro','scene-town-gate','유비 장비 간옹'),
    (14,'intro','scene-camp-night','유비 장비 관우'),
    (15,'intro','scene-council-hall','유비 간옹 관우 장비'),
    (16,'intro','scene-camp-night','유비 조운'), (16,'outro','scene-camp-night','유비 간옹 조운'),
    (17,'intro','scene-town-gate','장비 관우 유비'), (17,'outro','scene-camp-night','유비 관우 장비'),
    (18,'outro','scene-camp-night','유비 제갈량 장비 관우'),
    (19,'intro','scene-town-gate','유비 미축 간옹 제갈량'), (19,'outro','scene-refugee-road','유비 관우 장비 조운'),
    (20,'intro','scene-refugee-road','조운 병사'), (20,'outro','scene-camp-day','유비 조운 병사'),
    (21,'intro','scene-changban-bridge','장비 병사'), (21,'outro','scene-camp-night','유비 장비 병사'),
    (22,'intro','scene-river-landing','유비 간옹 조운'), (22,'outro','scene-river-landing','유비 관우 미축'),
    (23,'outro','scene-camp-night','유비 제갈량 관우 조운'),
    (25,'intro','scene-command-deck','주유 황개'),
    (26,'intro','scene-command-deck','황개 병사'), (26,'outro','scene-river-landing','유비 관우 장비 제갈량'),
    (27,'intro','scene-camp-day','유비 관우 제갈량'),
]

# Cue, operation, actor, target. No random pacing or keyword-generated movement.
BEATS = {
 (1,'intro'): [('간옹은 남은 짚신을','move','간옹',[6,4]), ('유비는 팔리지 않은','exit','유비',[12,6])],
 (1,'outro'): [('유비는 전리품을','move','유비',[3,4]), ('그날 밤 간옹이','pose','유비','sit'), ('관우는 말없이','move','관우',[5,4])],
 (2,'intro'): [('남으로 가는 길','move','장비',[8,4])],
 (2,'outro'): [('유비','face','유비','right')],
 (3,'intro'): [('공손찬은 격문을 접어','pose','공손찬','salute')],
 (4,'intro'): [('결전을 앞두고','pose','장비','rest'), ('아무도 곧장','face','관우','down'), ('그날 밤 장비는','pose','장비','idle')],
 (5,'intro'): [('말석','move','유비',[3,4])],
 (5,'outro'): [('술','pose','관우','rest')],
 (6,'intro'): [('관우','face','관우','left')],
 (6,'outro'): [('손','pose','장비','rest')],
 (7,'intro'): [('불','move','장비',[8,4])],
 (7,'outro'): [('유비','face','유비','down')],
 (8,'intro'): [('간옹','move','간옹',[6,4])],
 (8,'outro'): [('그날 밤 돌아온 유비를','pose','유비','sit')],
 (9,'intro'): [('유비는 먼저 이름을','move','유비',[6,4])],
 (9,'outro'): [('두 사람 사이에','face','유비','up'), ('헤어질 때 유비는','move','유비',[6,4]), ('북방의 강바람이','exit','조운',[10,6])],
 (10,'intro'): [('간옹은 봉함','move','간옹',[6,4])],
 (10,'outro'): [('미축은 탁자에','move','미축',[6,5]), ('그날 유비는','exit','유비',[1,6])],
 (11,'intro'): [('떠나는 날 장비가','move','장비',[5,4])],
 (11,'outro'): [('쫓겨난 사람들이','pose','장비','kneel'), ('장비가 칼자루에','move','유비',[6,4]), ('관우는 두 사람 앞에','move','관우',[5,4]), ('그날 형제는','pose','장비','rest')],
 (12,'intro'): [('유비는 장부와 군기를','face','유비','down')],
 (12,'outro'): [('그날 밤 유비는','pose','유비','sit'), ('유비는 마른 신을','pose','유비','idle')],
 (13,'intro'): [('유비는 징발한','move','유비',[6,4])],
 (13,'outro'): [('관우는 형을','face','장비','left')],
 (14,'intro'): [('유비는 조조의 본영으로','exit','유비',[1,6])],
 (15,'intro'): [('사냥에 나갈 옷을','face','관우','up'), ('조조가 보낸 말이','exit','유비',[1,6])],
 (16,'intro'): [('유비는 어느 쪽이','face','유비','down')],
 (16,'outro'): [('가족이 함께 있다는','pose','유비','rest'), ('조운은 남쪽 길로','exit','조운',[10,6])],
 (17,'intro'): [('관우는 말에서 내렸다','move','관우',[6,4]), ('수레의 발이','move','장비',[3,4]), ('뒤늦게 도착한 유비는','move','유비',[5,4])],
 (17,'outro'): [('장비는 사과할 말을','pose','장비','rest'), ('장비가 처음으로 웃었다','face','유비','right'), ('날이 밝자 다시','pose','장비','idle')],
 (18,'outro'): [('장비는 보고를','pose','장비','salute'), ('관우는 웃지 않고','move','관우',[6,5]), ('유비는 편지의','face','유비','down')],
 (19,'intro'): [('유비는 곳간을','move','유비',[3,4]), ('그날 밤 빈집의','face','유비','up')],
 (19,'outro'): [('유비는 답하기 전에','move','유비',[3,4]), ('관우가 떠난 뒤','exit','관우',[10,6]), ('저녁이면 사람들은','face','유비','up')],
 (20,'intro'): [('조운은 흩어진','move','조운',[5,4]), ('조운은 이름을','move','조운',[8,4]), ('빈 수레 안에는','pose','조운','salute')],
 (20,'outro'): [('조운이 돌아왔을','move','조운',[6,4]), ('유비는 아이를','move','유비',[5,4]), ('조운은 그제야','pose','조운','sit')],
 (21,'intro'): [('그 말은 부하들에게','exit','병사',[10,4]), ('물 아래에는','face','장비','up')],
 (21,'outro'): [('다리에서 물러나온','pose','장비','rest'), ('관우가 없는 자리에서','move','유비',[6,4]), ('밤이 되자','face','유비','down')],
 (22,'intro'): [('유비는 약속한','face','유비','up'), ('마침내 강바람이','move','유비',[6,4])],
 (22,'outro'): [('미축은 아이와','move','미축',[6,5]), ('밤에 배 안에서','face','유비','down')],
 (23,'outro'): [('제갈량은 손권이','pose','제갈량','salute'), ('관우는 강변의 길을','exit','관우',[1,6]), ('관우는 강변의 길을','exit','조운',[10,6])],
 (25,'intro'): [('막사 안에서 황개는','pose','황개','rest'), ('불을 놓는 사람도','pose','황개','idle')],
 (26,'intro'): [('바람이 바뀐 것을','face','황개','up'), ('주유의 군령이','exit','병사',[10,6])],
 (26,'outro'): [('강 건너를 보는','face','유비','up'), ('강 건너를 보는','face','관우','up'), ('제갈량은 도주로를','move','제갈량',[6,5])],
 (27,'intro'): [('관우는 잠시 답하지','face','관우','down'), ('서약을 쓰는 붓이','pose','관우','salute'), ('관우가 떠난 뒤','exit','관우',[10,6])],
}


def stage_part(n, slot, map_id, names, lines, title, beats):
    names = names.split()
    cells = [[4,4], [7,4], [5,5], [8,5], [3,5]]
    units = [{'id': name, 'sprite': ACTORS[name], 'cell': cells[i], 'facing': 'right' if i == 0 else 'left'} for i,name in enumerate(names)]
    directed = copy.deepcopy(lines)
    for line in directed:
        line['pose'] = [{'id': name, 'pose': 'talk' if line.get('speaker') == name and any(c.endswith('.talk') for c in LIBRARY[ACTORS[name]]['clips']) else 'idle'} for name in names]
    for cue, op, actor, target in beats:
        matches = [line for line in directed if cue in line.get('text','') or cue == line.get('speaker')]
        if not matches:
            raise ValueError(f'{n}/{slot}: missing cue {cue}')
        assert actor in names, actor
        key = 'pose' if op == 'pose' else 'dir' if op == 'face' else 'to'
        line = matches[0]
        if op == 'pose':
            assert any(c.endswith('.'+target) for c in LIBRARY[ACTORS[actor]]['clips']), (actor,target)
            line['pose'] = [p for p in line['pose'] if p['id'] != actor]
        line.setdefault(op, []).append({'id': actor, key: target})
    # Seated/resting/kneeling performances persist across dialogue until released.
    held = {}
    for line in directed:
        for actor, pose in list(held.items()):
            if any(cue in line.get('text','') and op == 'pose' and name == actor and target == 'idle' for cue,op,name,target in beats):
                del held[actor]
                continue
            speech_pose = pose + '-talk'
            use = speech_pose if line.get('speaker') == actor and any(c.endswith('.'+speech_pose) for c in LIBRARY[ACTORS[actor]]['clips']) else pose
            line['pose'] = [p for p in line['pose'] if p['id'] != actor] + [{'id':actor,'pose':use}]
        for cue,op,actor,target in beats:
            if op == 'pose' and target in ('rest','sit','kneel') and cue in line.get('text',''):
                held[actor] = target
    return {'map':map_id, 'label':title, 'camera':{'zoom':1.3}, 'units':units, 'lines':directed}


def entrance(scene, actor, cue, start, end):
    unit = next(u for u in scene['units'] if u['id'] == actor)
    unit['hidden'] = True
    unit['cell'] = start
    line = next(l for l in scene['lines'] if cue in l.get('text',''))
    line['move'] = [m for m in line.get('move',[]) if m['id'] != actor]
    line.setdefault('enter',[]).append({'id':actor,'from':start,'to':end})


def key_scenes(stage, n):
    if n not in (18,27): return
    slot = 'intro' if n == 18 else 'outro'
    passage = MANUSCRIPT[n,slot]
    parts = stage['scenario'][slot]
    old = next(p for p in parts if p.get('lines') and p['lines'][0].get('text') == passage['lines'][0]['text'])
    if 'map' in old: return
    lines = old['lines']
    if n == 18:
        farewell = stage_part(n,slot,'scene-camp-night','유비 서서',lines[:5],'신야 · 마지막 등불',[
            ('그러던 어느 날','face','서서','down'),('마지막 밤 두 사람은','pose','유비','sit'),('마지막 밤 두 사람은','pose','서서','rest')])
        road = stage_part(n,slot,'scene-refugee-road','유비 서서',lines[5:7],'신야 밖 · 돌아온 말발굽',[
            ('이튿날 유비는','move','서서',[9,4]),('이튿날 유비는','face','유비','right'),('제 마음을 돌린','move','서서',[6,4])])
        road['lines'].append({'text':'서서는 깊이 고개를 숙였다. 유비는 이번에는 붙잡지 않았다. 말발굽 소리가 멀어진 뒤에도 길은 한동안 비어 있었다.',
            'pose':[{'id':'서서','pose':'salute'},{'id':'유비','pose':'idle'}], 'exit':[{'id':'서서','to':[10,6]}], 'face':[{'id':'유비','dir':'right'}]})
        cottage = stage_part(n,slot,'scene-longzhong-courtyard','유비 제갈량 관우 장비',lines[7:14],'융중 · 초려 앞 뜰',[
            ('세 번째 방문에서','pose','장비','emphasize'),('세 번째 방문에서','face','유비','right'),
            ('작은 초가까지','pose','제갈량','salute'),('유비는 그 마지막 말까지','pose','유비','kneel')])
        entrance(cottage,'제갈량','작은 초가까지',[9,3],[7,4])
        cottage['lines'].append({'text':'마당을 나설 때 유비는 한 걸음 기다렸다. 제갈량이 곁에 서자 네 사람은 함께 산 아래로 향했다.',
            'pose':[{'id':'유비','pose':'idle'},{'id':'장비','pose':'idle'}], 'move':[{'id':'유비','to':[6,6]},{'id':'제갈량','to':[7,6]}],
            'face':[{'id':'관우','dir':'down'},{'id':'장비','dir':'down'}]})
        departure = json.loads((Path(__file__).parent / 'novel-18-departure.json').read_text(encoding='utf-8'))
        replacement = [farewell,road,departure,cottage,{'bg':old['bg'],'lines':lines[14:]}]
    else:
        road = stage_part(n,slot,'scene-refugee-road','관우 조조 병사',lines[:5],'화용도 · 비켜선 등',[
            ('관우는 뒤의 군사들을','face','관우','right'),('칼을 쥔 손이','move','관우',[4,6]),('칼을 쥔 손이','face','관우','up'),
            ('마지막 발소리가','exit','조조',[1,4]),('마지막 발소리가','exit','병사',[1,5])])
        camp = stage_part(n,slot,'scene-camp-night','유비 관우 제갈량',lines[5:10],'진영 · 남겨 둔 군령장',[
            ('놓아주었소','pose','관우','kneel'),('진영으로 돌아온','move','유비',[6,4]),('제갈량은 오래 침묵했다','face','제갈량','down')])
        replacement = [road,camp,{'bg':old['bg'],'lines':lines[10:]}]
    index = parts.index(old)
    parts[index:index+1] = replacement


def main():
    parser = argparse.ArgumentParser(); parser.add_argument('--apply', action='store_true'); args = parser.parse_args()
    changes = {}
    for n,slot,map_id,cast in PLANS:
        path = next((ROOT / 'packages/data/json/stages').glob(f'{n:02}-*.json'))
        if path not in changes: changes[path] = json.loads(path.read_text(encoding='utf-8'))
        stage = changes[path]; passage = MANUSCRIPT[n,slot]
        candidates = [p for p in stage['scenario'][slot] if p.get('lines') and p['lines'][0].get('text') == passage['lines'][0]['text']]
        assert len(candidates) == 1, (n,slot)
        old = candidates[0]
        if 'map' in old: continue
        new = stage_part(n,slot,map_id,cast,old['lines'],passage['title'],BEATS.get((n,slot),[]))
        if (n,slot) == (17,'intro'): entrance(new,'유비','뒤늦게 도착한 유비는',[1,6],[5,4])
        if (n,slot) == (20,'outro'): entrance(new,'조운','조운이 돌아왔을',[10,6],[6,4])
        parts = stage['scenario'][slot]; parts[parts.index(old)] = new
    for path,stage in changes.items(): key_scenes(stage,int(path.name[:2]))
    backup = ROOT / '.studio/staging-backups' / datetime.datetime.now().strftime('%Y%m%d-%H%M%S')
    if args.apply:
        backup.mkdir(parents=True,exist_ok=True)
        for path,data in changes.items():
            (backup/path.name).write_bytes(path.read_bytes())
            path.write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print(json.dumps({'scenes':len(PLANS),'applied':args.apply,'backup':str(backup)},ensure_ascii=False))


if __name__ == '__main__': main()
