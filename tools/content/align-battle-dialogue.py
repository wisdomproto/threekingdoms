"""Bind campaign dialogue to authored events without changing combat rules."""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]

def line(speaker, text, side="player"):
    return {"speaker": speaker, "side": side, "portraitId": speaker, "text": text}

def apply(stage):
    number = int(stage["id"][:2])
    dialogues = stage.setdefault("dialogue", [])
    scripts = stage.get("scriptEvents", [])
    if number == 26:
        dialogues[:] = [d for d in dialogues if d['id'] != '26-chibi_turn8']
    # These lines describe the effect itself, rather than a future order or recollection.
    script_lines = {
        7: [line("곽사", "시가지에 불을 놓았다! 골목으로 들어오는 놈들을 막아라!", "enemy"), line("유비", "불길이 번진다! 불붙은 구역을 피하고 백성의 퇴로부터 열어라!")],
        14: [line("관우", "물이 성 안으로 밀려들었습니다. 적의 발이 묶인 지금, 성문으로 나아갑시다!")],
        18: [line("제갈량", "신호가 올랐습니다. 적의 선두가 골짜기에 든 지금, 불을 놓으십시오!"), line("관우", "복병, 나와라! 불길을 피해 빠져나오는 적을 막는다!"), line("제갈량", "불붙은 구역의 적들이 타격을 입고 움직임을 잃었습니다. 아군도 불길에 들어가지 않도록 하십시오.")],
        21: [line("장비", "연인 장익덕이 여기 있다! 목숨을 버릴 놈부터 건너와라!"), line("문빙", "선봉이 멈췄다! 뒤에서 떠밀지 마라!", "enemy")],
        25: [line("황개", "화선이 닿았다! 불길을 등지고 물러나라. 우리 배도 휘말려서는 안 된다!", "ally"), line("유비", "군영에 불이 붙었다! 타오르는 구역을 피해 적의 퇴로를 막아라!")],
        26: [line("조조", "배가… 배가 불탄다! 사슬을 끊어라! 끊으란 말이다!", "enemy"), line("주유", "연결된 배에 화선이 닿았다! 불길에 갇힌 적을 몰아치되, 아군 함대는 거리를 벌려라!", "ally")],
    }
    for event in scripts:
        entry = next((d for d in dialogues if d['trigger'].get('scriptId') == event['id']), None)
        if entry is None:
            # Retain stable IDs when converting an existing timing-only cue.
            entry = next((d for d in dialogues if d['id'] == {
                7: '07-luoyang_turn5', 18: '18-bowangpo_turn4',
                26: '26-chibi_turn4_fire',
            }.get(number)), None)
        if entry is None:
            entry = {'id': event['id'] + '-dialogue'}
            dialogues.append(entry)
        entry.update(trigger={'kind': 'scriptFired', 'scriptId': event['id']}, lines=script_lines[number])

    # Convert arrival announcements to actual arrival edges, not coincident turn counters.
    for d in dialogues:
        t = d['trigger']
        if t['kind'] != 'turn':
            continue
        reinf = next((r for r in stage.get('reinforcements', [])
                      if r['trigger'].get('kind') == 'turn' and r['trigger']['turn'] == t['n']), None)
        if reinf:
            d['trigger'] = {'kind': 'reinforcementArrived', 'reinforcementId': reinf['id']}

    arrival_text = {
        'ambush_west_forest': '숲 서쪽에서 적 복병이 나타났다! 추격 대열을 모아라!',
        'ambush_east_forest': '동쪽 숲에도 복병이다! 앞뒤로 갈라져 싸우지 마라!',
        'reinf_lubu_press_turn7': '여포군의 후속 부대가 온다! 소패의 방어선을 지켜라!',
        'caocao_pursuit_rear': '후미에 추격대가 붙었다! 퇴로를 지키며 움직여라!',
        'cao_pursuit_north': '북쪽에서 적 추격대가 나타났다! 나루로 향하는 길을 지켜라!',
        'caocao_fleet_2nd_wave': '조조군의 후속 함대가 들어온다! 선두만 보고 진형을 흩뜨리지 마라!',
        'caocao_rally': '적의 잔여 부대가 다시 모였다! 아직 전투는 끝나지 않았다!',
        'cao_rear_guard': '조조군 후위대가 나타났다! 퇴로를 열어 주지 마라!',
        'huoshao_liufeng_guanping': '유봉과 관평의 부대가 도착했다! 퇴로를 지키며 매복군과 합류하라!',
        'fire_rear_guard': '적 후위대가 도착했다! 불길과 적진 사이에 갇히지 않도록 하라!',
    }
    for r in stage.get('reinforcements', []):
        if any(d['trigger'].get('reinforcementId') == r['id'] for d in dialogues):
            continue
        text = arrival_text.get(r['id'])
        if not text:
            raise ValueError('Missing authored arrival cue: ' + r['id'])
        dialogues.append({'id': r['id'] + '-dialogue', 'trigger': {'kind': 'reinforcementArrived', 'reinforcementId': r['id']}, 'lines': [line('유비', text)]})

    if number == 18:
        for d in dialogues:
            if d['trigger'].get('unitId') == '하후돈':
                d['lines'] = [line('하후돈', '물러나라! 대열을 수습하라. 이대로 흩어져서는 안 된다!', 'enemy')]
            if d['trigger'].get('duelId') == 'duel_guanyu_lidian':
                d['lines'][1]['text'] = '골짜기로 들어선 이상, 내 칼을 피할 길은 없다.'
        # A fast victory can happen before turn four; the aftermath must still be true.
        outro = stage['scenario']['outro']
        outro[0]['lines'][0]['text'] = '박망파의 싸움이 끝났다. 물러나는 적을 뒤로하고, 유비군은 흩어진 병사와 부상자를 거두었다.'
        outro[1]['lines'][0]['text'] = '…적이 물러갔구려. 와룡 선생, 이 장비가 잘못 봤소!'
        outro[2]['lines'][0]['text'] = '전장의 소란이 가라앉은 뒤에야 제갈량은 손에 힘이 들어가 있었다는 것을 알았다. 군령을 내리는 동안에는 보이지 않던 손톱 자국이 손바닥에 남았다.'
    if number == 2:
        # The allied fire is in the surrounding battle, not a scripted hazard on this map.
        for d in dialogues:
            if d['trigger']['kind'] == 'turn':
                d['lines'] = [line('장비', '관군이 적의 본진을 흔들고 있다! 우리는 포위를 뚫자, 형님!')]
    if number == 20:
        for d in dialogues:
            if d['trigger'] == {'kind': 'turn', 'n': 4}:
                d['lines'][1]['text'] = '오래 머물수록 추격대가 따라붙는다… 멈추지 말고 길을 열어야 한다!'

if __name__ == '__main__':
    for path in sorted((ROOT / 'packages/data/json/stages').glob('*.json')):
        stage = json.loads(path.read_text(encoding='utf-8'))
        apply(stage)
        path.write_text(json.dumps(stage, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
