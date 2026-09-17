"""Contact sheets for visual QA; no source artwork is repainted."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
ROOT=Path(__file__).resolve().parents[2]
SRC=ROOT/'.studio/sequel-art/sources'
OUT=ROOT/'.studio/sequel-art/review'
OUT.mkdir(exist_ok=True)
font=ImageFont.truetype('C:/Windows/Fonts/malgun.ttf',18)
files=sorted(SRC.glob('character-*.png'))
for page in range((len(files)+11)//12):
    sheet=Image.new('RGB',(1200,1000),'#cfbea3'); draw=ImageDraw.Draw(sheet)
    for j,p in enumerate(files[page*12:page*12+12]):
        im=Image.open(p).convert('RGBA'); x=(j%3)*400; y=(j//3)*250
        draw.text((x+8,y+4),p.stem[10:],font=font,fill='black')
        for k,index in enumerate((0,1,8)):
            a,b=index%4,index//4
            c=im.crop((round(a*im.width/4),round(b*im.height/4),round((a+1)*im.width/4),round((b+1)*im.height/4)))
            c.thumbnail((130,215)); sheet.paste(c,(x+k*132,y+30),c)
    sheet.save(OUT/f'cast-{page+1}.jpg')
files=sorted(SRC.glob('scene-sequel-*.png'))
sheet=Image.new('RGB',(1200,840))
for i,p in enumerate(files):
    im=Image.open(p).convert('RGB'); im.thumbnail((600,420));sheet.paste(im,((i%2)*600,(i//2)*420))
sheet.save(OUT/'scenes.jpg')
print(OUT)

# Inspect final alpha-cropped civilian frames at approximately game scale.
import json
assets=ROOT/'apps/web/public/assets'
library=json.loads((assets/'scene-motions/library.json').read_text(encoding='utf-8'))['actors']
actors=[(k,v) for k,v in library.items() if k.startswith('sequel-')]
for page in range((len(actors)+19)//20):
    sheet=Image.new('RGB',(1200,800),'#52714a');draw=ImageDraw.Draw(sheet)
    for j,(key,actor) in enumerate(actors[page*20:page*20+20]):
        x=j%5*240;y=j//5*200
        draw.text((x+6,y+4),actor['name'],font=font,fill='white')
        for k,index in enumerate((8,9)):
            im=Image.open(assets/'scene-motions/sequel-v1'/f'{key}-{index}.webp').convert('RGBA')
            im.thumbnail((115,160));sheet.paste(im,(x+k*120,y+35),im)
    sheet.save(OUT/f'packed-{page+1}.jpg')
entries=json.loads((ROOT/'tools/content/sequel-scenes.json').read_text(encoding='utf-8'))
for page in range(4):
    sheet=Image.new('RGB',(1200,750),'#242824');draw=ImageDraw.Draw(sheet)
    for j,e in enumerate(entries[page*8:page*8+8]):
        x=j%4*300;y=j//4*375
        im=Image.open(assets/'maps'/f'{e["slug"]}.webp');im.thumbnail((300,330));sheet.paste(im,(x,y+35))
        draw.text((x+4,y+4),e['name'],font=font,fill='white')
    sheet.save(OUT/f'maps-{page+1}.jpg')
