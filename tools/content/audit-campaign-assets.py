"""Check shipped campaign references without changing projects or save games."""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
PUBLIC = ROOT / 'apps/web/public'
DATA = ROOT / 'packages/data/json'


def read(path):
    return json.loads(path.read_text(encoding='utf-8'))


def audit():
    manifest = read(PUBLIC / 'assets/sprites/manifest.json')
    actors = read(PUBLIC / 'assets/scene-motions/library.json')['actors']
    errors = []
    scenes = 0
    lines = 0

    def check(path, context):
        if not path.is_file():
            errors.append(f'{context}: missing {path.relative_to(ROOT)}')

    for sprite, entry in manifest.items():
        for pose in entry['poses']:
            check(PUBLIC / 'assets/sprites' / sprite / f'{pose}.webp', sprite)
    for actor, entry in actors.items():
        for clip, value in entry['clips'].items():
            for frame in value['frames']:
                if frame['image'].startswith('/assets/'):
                    check(PUBLIC / frame['image'].lstrip('/'), f'{actor}/{clip}')

    stages = sorted((DATA / 'stages').glob('*.json'))
    for file in stages:
        stage = read(file)
        for slot, parts in stage.get('scenario', {}).items():
            for index, part in enumerate(parts if isinstance(parts, list) else [parts]):
                if not isinstance(part, dict):
                    continue
                context = f'{file.stem}/{slot}/{index}'
                lines += len(part.get('lines', []))
                if part.get('bg'):
                    check(PUBLIC / 'assets/scenes' / f"{part['bg']}.webp", context)
                if 'map' not in part:
                    continue
                scenes += 1
                check(DATA / 'maps' / f"{part['map']}.json", context)
                map_image = PUBLIC / 'assets/maps' / f"{part['map']}.webp"
                if not map_image.is_file():
                    map_image = map_image.with_suffix('.png')
                check(map_image, context)
                cast = {unit['id']: unit['sprite'] for unit in part.get('units', [])}
                for sprite in cast.values():
                    if sprite not in actors and sprite not in manifest:
                        errors.append(f'{context}: unknown actor sprite {sprite}')
                for line in part.get('lines', []):
                    if line.get('bg'):
                        check(PUBLIC / 'assets/scenes' / f"{line['bg']}.webp", context)
                    for op in line.get('pose', []):
                        sprite = cast.get(op['id'])
                        pose = op['pose']
                        if not sprite:
                            errors.append(f"{context}: unknown pose actor {op['id']}")
                        elif sprite in actors:
                            if not any(key.endswith('.' + pose) for key in actors[sprite]['clips']):
                                errors.append(f'{context}: missing motion {sprite}/{pose}')
                        elif sprite in manifest:
                            if not any(key.startswith('front_' + pose) for key in manifest[sprite]['poses']):
                                errors.append(f'{context}: missing sprite pose {sprite}/{pose}')
    return {'stages': len(stages), 'mapScenes': scenes, 'dialogueLines': lines,
            'motionActors': len(actors), 'errors': sorted(set(errors))}


if __name__ == '__main__':
    result = audit()
    print(json.dumps(result, ensure_ascii=True, indent=2))
    raise SystemExit(bool(result['errors']))
