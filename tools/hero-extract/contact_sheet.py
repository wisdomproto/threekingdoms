# -*- coding: utf-8 -*-
import os, sys, glob
from PIL import Image, ImageDraw
sys.stdout.reconfigure(encoding='utf-8')
ROOT=os.path.expanduser(r'~\Downloads\삼국지 조조전\_cap\web')
OUT=os.path.join(ROOT,'_sheets'); os.makedirs(OUT,exist_ok=True)
CW,CH,COLS=300,225,5
for k in ['shop2','bag2','menu2','status2']:
    d=os.path.join(ROOT,k)
    files=sorted([f for f in glob.glob(os.path.join(d,'*')) if f.lower().endswith(('.jpg','.jpeg','.png','.gif','.bmp'))])
    if not files: continue
    rows=(len(files)+COLS-1)//COLS
    sheet=Image.new('RGB',(CW*COLS,CH*rows),(20,20,20)); dr=ImageDraw.Draw(sheet)
    for i,f in enumerate(files):
        try:
            im=Image.open(f).convert('RGB'); im.thumbnail((CW-8,CH-22))
            x=(i%COLS)*CW; y=(i//COLS)*CH
            sheet.paste(im,(x+4,y+18))
            dr.text((x+4,y+4),os.path.basename(f),fill=(255,255,0))
        except Exception as e:
            x=(i%COLS)*CW; y=(i//COLS)*CH; dr.text((x+4,y+4),f'{os.path.basename(f)} ERR',fill=(255,80,80))
    p=os.path.join(OUT,f'{k}.png'); sheet.save(p); print(k,len(files),'->',p)
