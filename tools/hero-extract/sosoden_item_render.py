# -*- coding: utf-8 -*-
import os, sys
from PIL import Image
sys.stdout.reconfigure(encoding='utf-8')
exec(open(r'C:\project\threekingdoms\tools\hero-extract\sosoden_ui_inspect.py', encoding='utf-8').read().split("if __name__")[0])
GAME=os.path.expanduser(r'~\Downloads\삼국지 조조전')
OUT=r'C:\project\threekingdoms\tools\hero-extract\out\sosoden_ui'
def pal(c): return [(c[i*3],c[i*3+1],c[i*3+2]) for i in range(256)]
def r8(d,w,h,p):
    img=Image.new('RGB',(w,h)); px=img.load()
    for y in range(h):
        for x in range(w):
            i=y*w+x; px[x,y]=p[d[i]] if i<len(d) else (0,0,0)
    return img
sp=pal(load_chunks(os.path.join(GAME,'SPALET.E5'))[0])
items=load_chunks(os.path.join(GAME,'ITEM.E5'))
N=40; cols=10
grid=Image.new('RGB',(32*cols,32*((N+cols-1)//cols)),(30,30,30))
for i in range(N):
    grid.paste(r8(items[i],32,32,sp),((i%cols)*32,(i//cols)*32))
grid.save(os.path.join(OUT,'ITEM_montage.png')); print('done')
