"""Stage the sequel manuscript with civilian cast and authored bridge passages."""
import json
from pathlib import Path

ROOT=Path(__file__).resolve().parents[2]
DATA=ROOT/'packages/data/json'
SOURCE=Path(__file__).with_name('sequel-scenes.json')
BRIDGES=Path(__file__).with_name('sequel-interludes.json')

def read(path): return json.loads(path.read_text(encoding='utf-8'))
def write(path,value): path.write_text(json.dumps(value,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')

def setting(e,slot,label):
    slug=e['slug']
    if slug=='yiling' and slot=='outro': return 'scene-sequel-sickroom'
    if slug=='wuzhangyuan': return 'scene-sequel-wuzhang'
    if slug in ('nanman','tengjia'): return 'scene-sequel-south-camp'
    if slug in ('chengdu','yangping') and slot=='outro': return 'scene-sequel-palace'
    if slug=='maicheng' and ('성도' in label or '남겨진' in label): return 'scene-sequel-palace'
    if slug=='mianzhu' and slot=='outro': return 'scene-sequel-palace'
    return e.get('scene','scene-camp-day')

def scene_parts(raw, e, slot, actors, label):
    # Split at a cast change; never drop a speaking character to meet a cast limit.
    chunks=[]; chunk=[]; cast=[]
    for line in raw:
        speaker=line.split('|',1)[0]
        if speaker and speaker not in cast and len(cast)==6:
            chunks.append(chunk);chunk=[];cast=[]
        chunk.append(line)
        if speaker and speaker not in cast:cast.append(speaker)
    if chunk:chunks.append(chunk)
    parts=[]
    for chunk in chunks:
        map_id=setting(e,slot,label)
        names=list(dict.fromkeys(l.split('|',1)[0] for l in chunk if l.split('|',1)[0]))
        # A narration-only epilogue uses an empty stage, not resurrected deceased actors.
        missing=[n for n in names if n not in actors]
        if missing: raise ValueError(f'Missing civilian actor for {e["slug"]}: {missing}')
        cells=[[3,4],[7,4],[5,5],[9,5],[3,6],[7,6]]
        lines=[];last=None
        def resting(n):
            if e['slug']=='yiling' and slot=='outro' and n=='유비': return 'rest'
            if e['slug']=='wuzhangyuan' and n=='제갈량': return 'rest'
            return 'idle'
        for raw_line in chunk:
            speaker,text=raw_line.split('|',1)
            line={'text':text}
            if speaker:
                line.update({'speaker':speaker,'portraitId':speaker})
                poses=[]
                if last and last!=speaker:poses.append({'id':last,'pose':resting(last)})
                poses.append({'id':speaker,'pose':'talk'})
                if any(word in text for word in ('명을 받','알겠습니다','따르겠습니다','다녀오겠습니다')):
                    poses[-1]['pose']='salute'
                if (e['slug']=='yiling' and slot=='outro' and speaker=='유비') or (e['slug']=='wuzhangyuan' and speaker=='제갈량'):
                    poses[-1]['pose']=resting(speaker)
                line['pose']=poses;last=speaker
            elif last:
                line['pose']=[{'id':last,'pose':resting(last)}];last=None
            lines.append(line)
        # One intentional entrance before conversation; room between two groups stays clear.
        units=[{'id':n,'sprite':actors[n],'cell':cells[i].copy(),'facing':'right' if cells[i][0]<6 else 'left'} for i,n in enumerate(names)]
        if units:
            # The ill commander remains seated; a visitor makes the entrance.
            visitor=next((i for i,n in enumerate(names) if not (map_id=='scene-sequel-sickroom' and n=='유비') and not (e['slug']=='wuzhangyuan' and n=='제갈량')),None)
            if visitor is not None:
                units[visitor]['cell']=[1,4]
                lines[0]['move']=[{'id':names[visitor],'to':cells[visitor]}]
            lines[-1].setdefault('pose',[])
            lines[-1]['pose']=[{'id':n,'pose':resting(n)} for n in names]
        if not units:
            parts.append({'bg':map_id,'lines':lines})
        else:
            parts.append({'map':map_id,'label':label,'camera':{'zoom':1.3},'units':units,'lines':lines})
    return parts

def main():
    library=read(ROOT/'apps/web/public/assets/scene-motions/library.json')['actors']
    actors={a['name']:key for key,a in library.items() if not key.startswith('troia')}
    actors.update({'유비':'liubei-leader','관우':'guanyu-leader','장비':'zhangfei-leader','조운':'zhaoyun-robes'})
    entries=read(SOURCE);bridges=read(BRIDGES)
    count=0;parts_count=0
    for e in entries:
        sid=f'{e["number"]:02}-{e["slug"]}'
        path=DATA/f'stages/{sid}.json';stage=read(path)
        b=bridges[e['slug']]
        for slot in ('intro','outro'):
            groups=[(b['before'],'길을 나서기 전에'),(e['intro'],'출정')] if slot=='intro' else [(e['outro'],'전투 뒤'),(b['after'],'남겨진 이야기')]
            if e['slug']=='yiling' and slot=='outro':
                groups=[(e['outro'][:4],'백제성으로'),(b['after'],'등불 아래'),(e['outro'][4:],'마지막 부탁')]
            if e['slug']=='maicheng' and slot=='outro':
                groups=[(e['outro'][:4],'맥성의 마지막 밤'),(e['outro'][4:],'성도에 닿은 소식'),(b['after'],'남겨진 이야기')]
            parts=[]
            for raw,label in groups:
                parts+=scene_parts(raw,e,slot,actors,e['name']+' · '+label)
                count+=len(raw)
            stage['scenario'][slot]=parts;parts_count+=len(parts)
        write(path,stage)
    print(f'Staged {parts_count} parts, {count} manuscript lines across 56 story slots.')

if __name__=='__main__':main()
