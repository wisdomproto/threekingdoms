# -*- coding: utf-8 -*-
"""U_SELECT 대형 청크 width 자동탐지: 후보 width별 행간 상관도(실사진은 세로 연속성 높음).
8bpp/4bpp 둘 다 시도."""
import struct, os, sys
sys.stdout.reconfigure(encoding='utf-8')
GAME=os.path.expanduser(r'~\Downloads\삼국지 조조전')
exec(open(r'C:\project\threekingdoms\tools\hero-extract\sosoden_ui_inspect.py', encoding='utf-8').read().split("if __name__")[0])

def row_corr(buf, w):
    h=len(buf)//w
    if h<3: return -1
    diffs=0
    for y in range(h-1):
        a=buf[y*w:(y+1)*w]; b=buf[(y+1)*w:(y+2)*w]
        diffs+=sum(1 for i in range(w) if a[i]!=b[i])
    return diffs/((h-1)*w)  # 낮을수록 행간 유사(=정답 width 후보)

def analyze(buf, label):
    n=len(buf)
    print(f'\n== {label} ({n} bytes) ==')
    # 8bpp: width = divisor; 4bpp: 2px/byte → width=2*divisor
    cands=[]
    for w in range(64, 1281):
        if n % w == 0:
            cands.append(('8bpp', w, buf))
    # also try 4bpp expansion
    nib=bytearray()
    for b in buf: nib.append(b>>4); nib.append(b&0xF)
    for w in range(64,1281):
        if len(nib)%w==0:
            cands.append(('4bpp', w, nib))
    scored=[]
    for mode,w,b in cands:
        c=row_corr(b,w)
        scored.append((c,mode,w,len(b)//w))
    scored.sort()
    print('  best 8 (low diff = coherent):')
    for c,mode,w,h in scored[:8]:
        print(f'    {mode} {w}x{h}  rowdiff={c:.3f}')

if __name__=='__main__':
    us=load_chunks(os.path.join(GAME,'U_SELECT.E5'))
    analyze(us[3],'U_SELECT[3] 118400')
    analyze(us[4],'U_SELECT[4] 51200')
