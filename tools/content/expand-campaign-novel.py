"""Apply reviewed novel interludes while preserving gameplay and staging data.

Dry-run by default. --apply backs up complete stages under .studio before writing.
Already inserted passages are detected; revisions belong in the story editor.
"""
import argparse
import copy
import datetime
import json
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[2]


def read_manuscript():
    passages = {}
    stage = slot = None
    for raw in (ROOT / 'tools/content/campaign-novel.md').read_text(encoding='utf-8').splitlines():
        if match := re.fullmatch(r'## (\d{2})', raw):
            stage, slot = int(match[1]), None
        elif match := re.fullmatch(r'### (intro|outro) \| (.+)', raw):
            slot = match[1]
            passages[stage, slot] = {'title': match[2], 'lines': []}
        elif stage and slot and raw.strip():
            line = {'text': raw}
            if ' | ' in raw:
                speaker, text = raw.split(' | ', 1)
                line = {'speaker': speaker, 'text': text}
                if (ROOT / f'apps/web/public/assets/ui/portraits/{speaker}.webp').exists():
                    line['portraitId'] = speaker
            passages[stage, slot]['lines'].append(line)
    assert set(passages) == {(n, s) for n in range(1, 28) for s in ('intro', 'outro')}
    assert all(len(p['lines']) >= 6 for p in passages.values())
    return passages


def continuity(stage):
    """Only authored dialogue and the departed actor change; battle rules do not."""
    n = int(stage['id'].split('-')[0])
    scenes = stage['scenario']
    if n == 17:
        lines = scenes['intro'][1]['lines']
        lines[0]['text'] = '의심과 오해를 넘어서, 형제들은 여남의 진영으로 돌아왔다. 흩어진 군사들에게도 재회의 소식이 전해졌다.'
        lines[1]['text'] = '주공, 두 부인을 안전한 곳에 모셨습니다. 관 장군과 함께 오신 분들도 쉬고 있습니다.'
        lines[2]['text'] = '고맙소. 먼 길을 온 사람들부터 먹이시오.'
        lines[3]['text'] = '운장 형님, 뒤의 일은 나한테 맡기시오.'
        lines[4]['text'] = '아직 추격군이 남았다. 형님 곁을 함께 지키자.'
        lines[5]['text'] = '다시 모였으니, 이번에는 흩어지지 말자.'
        scenes['outro'][1]['lines'][3]['text'] = '떨어져 있던 형제들은 다시 같은 진영에 섰다. 지켜보던 병사들도 소리 죽여 울었다.'
    if n == 18:
        scenes['intro'][0]['lines'][0]['text'] = '형주에 몸을 의탁한 유비는 신야에 자리를 잡았다. 잠시 찾아온 평온 속에서 뜻밖의 만남과 이별이 기다리고 있었다.'
        for slot in ('intro', 'outro'):
            for part in scenes[slot]:
                if 'units' not in part:
                    continue
                part['units'] = [u for u in part['units'] if u['id'] != 'xushu']
                for line in part['lines']:
                    for key, value in list(line.items()):
                        if isinstance(value, list):
                            line[key] = [v for v in value if not isinstance(v, dict) or v.get('id') != 'xushu']
                part['lines'] = [l for l in part['lines'] if l.get('speaker') != '서서']
        part = scenes['outro'][1]
        part['label'] = '박망파 · 첫 군령 뒤에'
        part['lines'][-1]['text'] = '군사들이 돌아오는 동안 공명은 부상자를 확인했다. 승리 다음에 맡아야 할 일도 이제 그의 일이었다.'
    if n == 24:
        scenes['outro'][1]['lines'][1]['text'] = '공명, 오늘은 뜻이 맞았소. 앞으로도 서로 맡은 일을 지켜 주기를 바라오.'
        scenes['outro'][1]['lines'][2]['text'] = '화살과 군량부터 보충해야겠습니다. 큰 싸움은 아직 남았습니다.'
        scenes['outro'][1]['lines'][3]['text'] = '승리한 진영에서도 준비는 멈추지 않았다. 제갈량은 부족한 화살을 사흘 안에 마련하겠다고 약속했다.'
    if n == 25:
        scenes['outro'][0]['lines'][0]['text'] = '오림의 교전이 끝나고 강변의 길이 열렸다. 황개는 결전에 쓸 화선을 숨겨 둔 물가로 돌아왔다.'
        scenes['outro'][1]['label'] = '오림 · 결전을 기다리는 배'
        scenes['outro'][1]['lines'][0]['text'] = '길은 열렸소. 이제 배와 사람을 다시 살펴야겠구려. 바람이 불 때 빈틈이 없어야 하오.'
        scenes['outro'][1]['lines'][1]['text'] = '함께 돌아올 길도 살피겠습니다. 노장군, 끝까지 몸을 아껴 주시오.'
    if n == 27:
        scenes['intro'][0]['lines'][0]['text'] = '적벽에서 패한 조조가 북쪽으로 달아났다. 강을 벗어난 패잔병들은 좁은 산길로 접어들고 있었다.'
        lines = scenes['intro'][1]['lines']
        lines[2]['text'] = '화용도의 길은 좁습니다. 진을 유지하고, 정한 신호를 기다리십시오.'
        lines[3]['text'] = '알겠소. 군사를 거느리고 먼저 가겠소.'
        lines[4]['text'] = '운장, 네가 맡은 사람들과 함께 돌아오너라.'
        # The new passage tells the release and petition; existing staging follows it.
        scenes['outro'][0]['lines'][0]['text'] = '보고가 끝난 뒤에도 진영은 조용했다. 세 사람은 앞으로 감당할 일을 다시 마주 보았다.'
        lines = scenes['outro'][1]['lines']
        lines[0]['text'] = '오늘의 책임을 잊지 않겠습니다.'
        lines[1]['text'] = '서약은 보관하겠습니다. 다음 군령까지 가벼워져서는 안 됩니다.'
        lines[2]['text'] = '일어나라, 운장. 남은 일은 함께 감당하자.'
        lines[3]['text'] = '황건의 들불에서 적벽까지, 돌아갈 집을 찾던 사람들의 길은 여기서 잠시 멈춘다. 새로운 길은 아직 정해지지 않았다.'


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--apply', action='store_true')
    args = parser.parse_args()
    passages = read_manuscript()
    backup = ROOT / '.studio/novel-backups' / datetime.datetime.now().strftime('%Y%m%d-%H%M%S')
    changed = []
    for path in sorted((ROOT / 'packages/data/json/stages').glob('*.json')):
        n = int(path.name[:2])
        original = json.loads(path.read_text(encoding='utf-8'))
        stage = copy.deepcopy(original)
        # Do not duplicate or overwrite an earlier import, including editor revisions.
        needle = passages[n, 'intro']['lines'][0]['text']
        if needle in json.dumps(stage['scenario'], ensure_ascii=False):
            continue
        for slot in ('intro', 'outro'):
            if not isinstance(stage['scenario'][slot], list):
                stage['scenario'][slot] = [stage['scenario'][slot]]
        continuity(stage)
        for slot in ('intro', 'outro'):
            parts = stage['scenario'][slot]
            new = {'bg': f'{stage["id"]}-{slot}', 'lines': passages[n, slot]['lines']}
            # Flashback / preparation precedes the map conversation.
            if slot == 'intro':
                parts.insert(1 if parts and 'map' not in parts[0] and 'kind' not in parts[0] else 0, new)
            elif n == 27:
                parts.insert(0, new)
            else:
                parts.append(new)
        assert {k:v for k,v in original.items() if k != 'scenario'} == {k:v for k,v in stage.items() if k != 'scenario'}
        if args.apply:
            backup.mkdir(parents=True, exist_ok=True)
            (backup / path.name).write_bytes(path.read_bytes())
            path.write_text(json.dumps(stage, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
        changed.append(stage['id'])
    print(json.dumps({'applied': args.apply, 'stages': changed, 'newLines': sum(len(p['lines']) for p in passages.values()), 'backup': str(backup) if args.apply and changed else None}, ensure_ascii=False))


if __name__ == '__main__':
    main()
