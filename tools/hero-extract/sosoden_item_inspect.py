# -*- coding: utf-8 -*-
import os, sys
sys.stdout.reconfigure(encoding='utf-8')
exec(open(r'C:\project\threekingdoms\tools\hero-extract\sosoden_ui_inspect.py', encoding='utf-8').read().split("if __name__")[0])
GAME=os.path.expanduser(r'~\Downloads\삼국지 조조전')
from collections import Counter
for n in ['ITEM.E5','LOGO.E5','MARK.E5']:
    try:
        ch=load_chunks(os.path.join(GAME,n)); sizes=[len(c) for c in ch]
        print(f'{n}: {len(ch)} chunks, size hist {dict(sorted(Counter(sizes).items(),key=lambda kv:-kv[1])[:6])}, first {sizes[:6]}')
    except Exception as e:
        print(n,'ERR',e)
