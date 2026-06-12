# -*- coding: utf-8 -*-
"""BAKDATA.R3에서 아이템 이름 위치 + 장수 이름(유비/관우/...) 위치를 전 파일에서 탐색"""
import os, sys
sys.stdout.reconfigure(encoding='utf-8')

HERO = r'C:\HERO'

names = ['유비', '관우', '장비', '조운', '제갈량', '여포', '조조', '하후돈', '화웅', '동탁']
items = ['둔갑천서', '청룡언월도', '방천화극', '적토마']

targets = {}
for w in names + items:
    targets[w] = w.encode('cp949')

for fn in sorted(os.listdir(HERO)):
    p = os.path.join(HERO, fn)
    if not os.path.isfile(p):
        continue
    data = open(p, 'rb').read()
    hits = []
    for w, b in targets.items():
        offs = []
        start = 0
        while True:
            i = data.find(b, start)
            if i < 0:
                break
            offs.append(i)
            start = i + 1
        if offs:
            hits.append((w, offs[:6]))
    if hits:
        print(f'== {fn} ({len(data)}b)')
        for w, offs in hits:
            print(f'   {w}: ' + ', '.join(f'0x{o:X}' for o in offs))
