# -*- coding: utf-8 -*-
"""R_xx 이벤트 파일의 섹션 오프셋 테이블 + 블록 시작부 구조 분석."""
import sys, os, struct
sys.stdout.reconfigure(encoding='utf-8')
sys.path.insert(0, os.path.dirname(__file__))
from sosoden_ls12 import GAME

def dump(fn, n=64):
    b = open(os.path.join(GAME, fn), 'rb').read()
    print(f'\n===== {fn} ({len(b)}B) =====')
    # 헤더 워드 테이블 (off 4~ 까지 0이 아닌 증가 오프셋 후보)
    w = [struct.unpack_from('<H', b, o)[0] for o in range(4, 60, 2)]
    print('  헤더워드:', w)
    # 증가하는 오프셋 시퀀스(섹션 테이블) 추출
    offs = [x for x in w if 4 < x < len(b)]
    offs = sorted(set(offs))
    print('  섹션 오프셋 후보:', offs)
    for o in offs[:8]:
        seg = b[o:o+24]
        txt = ''.join(chr(c) if 32<=c<127 else '.' for c in seg)
        try: k = seg.decode('cp949','replace')[:12]
        except: k=''
        print(f'   @{o:5d}: {seg[:24].hex(" ")}  |{txt}|')

for fn in ('R_00.EEX','R_01.EEX','R_02.EEX','R_05.EEX'):
    dump(fn)

# S_00 텍스트 직전 영역 (이벤트 명령 후보) — 맵 끝 추정 위치 탐색
print('\n\n===== S_00 맵/텍스트 경계 탐색 =====')
b = open(os.path.join(GAME,'S_00.EEX'),'rb').read()
# 0xff ff 38 00 (타일) 패턴이 끝나는 지점
i = 40
while i < len(b)-4:
    if not (b[i+1]==0 and b[i+2]==0xff and b[i+3]==0xff) and b[i]==0x38:
        pass
    i += 1
# 첫 한글 위치 주변
for off in (6390, 6400, 6413):
    print(f'  @{off}: ' + b[off:off+32].hex(' '))
