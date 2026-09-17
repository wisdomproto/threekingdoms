"""Describe reproducible, individually generated campaign art assets."""
import json
from pathlib import Path
import runpy

ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/'docs/art/sequel-v1'
OUT.mkdir(parents=True,exist_ok=True)
entries=json.loads((ROOT/'tools/content/sequel-scenes.json').read_text(encoding='utf-8'))
library=json.loads((ROOT/'apps/web/public/assets/scene-motions/library.json').read_text(encoding='utf-8'))['actors']
names=sorted({n for e in entries for n in e['party']+[e['boss']]}|{l.split('|')[0] for e in entries for s in ('intro','outro') for l in e[s] if l.split('|')[0]})
existing={a['name'] for a in library.values()}
identities={
 '강유':'Jiang Wei, youthful serious scholar-warrior, clean shaven, emerald teal armor, silver helmet, spear, civilian teal scholar robes',
 '관평':'Guan Ping, young square-jawed man, green gold armor, green headwrap, polearm, civilian green robes',
 '관흥':'Guan Xing, young sharp eyebrows, jade armor, gold-green cap, curved saber, civilian jade robe',
 '당빈':'Tang Bin, middle-aged compact beard, navy silver armor, spear, civilian navy robe',
 '도준':'Tao Jun, stern middle-aged Wu commander, copper red armor, sword, civilian muted red robe',
 '동궐':'Dong Jue, mature narrow moustache, jade black armor, sword, civilian dark green official robe',
 '두예':'Du Yu, older learned commander, slim moustache, silver blue armor, sword and scroll, civilian blue official robe',
 '등애':'Deng Ai, rugged older face, short grey beard, dark blue iron armor, spear, civilian indigo travelling robe',
 '등지':'Deng Zhi, mature diplomatic face, neat moustache, pale green light armor, sword, civilian white green scholar robes',
 '마대':'Ma Dai, young tan face, short moustache, bronze white cavalry armor, spear, civilian sand-colored robe',
 '마량':'Ma Liang, distinctive WHITE eyebrows, kind scholarly face, white jade light armor, fan, civilian cream green scholar robe',
 '마속':'Ma Su, young confident clean-shaven scholar, green blue light armor, sword, civilian blue-green scholar robe',
 '마초':'Ma Chao, handsome young warrior, white silver armor, white helmet with white plume, spear, civilian white robe and blue sash',
 '마충':'Ma Zhong of Shu, middle-aged tan face, moustache, bronze green armor, spear, civilian olive robe',
 '맹획':'Meng Huo, broad warm dark tan face, big black beard, bronze leather southern tribal armor, heavy mace, civilian woven red ochre southern tunic',
 '면죽 별부':'anonymous Shu captain, ordinary middle-aged man, green leather lamellar armor, spear, civilian brown green tunic',
 '반장':'Pan Zhang, fierce narrow eyes, stubble, burgundy iron armor, saber, civilian burgundy tunic',
 '방덕':'Pang De, weathered sturdy face, thick beard, white bronze helmet and armor, long saber, civilian grey ochre robe',
 '방통':'Pang Tong, heavy dark eyebrows, broad nose, scruffy short beard, plum charcoal scholar battle robes, wooden staff, civilian plum scholar robes',
 '법정':'Fa Zheng, sharp calm face, thin moustache, dark teal light armor over robes, scroll and sword, civilian dark teal robe',
 '사마가':'Shamoke, stocky tan southern chieftain, braided hair, ochre leather armor, iron mace, civilian ochre patterned tunic',
 '사마의':'Sima Yi, calculating narrow face, thin black moustache and pointed beard, navy black armored robe, fan, civilian black violet official robe',
 '서황':'Xu Huang, sturdy middle-aged face, short black beard, white headcloth, steel grey armor, great axe, civilian grey robe and white headcloth',
 '양회':'Yang Huai, broad stern moustached face, brown bronze armor, spear, civilian brown robe',
 '영수':'Ning Sui, younger clear-eyed officer, blue green armor, sword, civilian pale teal robe',
 '올돌골':'Wutugu, broad dark tan face, dark hair topknot, layered rattan armor, long club, civilian rattan-trimmed ochre cloth tunic',
 '왕보':'Wang Fu, mature thoughtful face, narrow beard, green light armor, sword, civilian moss green scholar robe',
 '왕융':'Wang Rong, composed middle-aged scholar, short moustache, pale blue light armor, fan, civilian pale blue official robe',
 '왕준':'Wang Jun, older confident admiral, grey moustache and short beard, navy gold armor, command sword, civilian navy gold official robe',
 '왕평':'Wang Ping, sturdy mature face, short beard, forest green leather armor, spear, civilian olive military tunic',
 '왕혼':'Wang Hun, middle-aged narrow eyes, black moustache, blue bronze armor, spear, civilian royal blue official robe',
 '요화':'Liao Hua, weathered older face, grey-streaked beard, green brown armor, spear, civilian olive brown robe',
 '위연':'Wei Yan, fierce reddish face, black beard, maroon green armor, curved long saber, civilian dark red robe',
 '유봉':'Liu Feng, energetic young clean-shaven face, pale green bronze armor, spear, civilian pale green robe',
 '유장':'Liu Zhang, gentle round mature face, short beard, purple gold light armor, sword, civilian purple official robe',
 '육손':'Lu Xun, refined handsome young scholar, clean-shaven, white red light armor, fan and sword, civilian white robe red sash',
 '이구':'Li Qiu, middle-aged small moustache, green silver armor, spear, civilian dark green tunic',
 '장억':'Zhang Ni, tanned rugged older officer, short beard, green ochre armor, spear, civilian ochre green robe',
 '장익':'Zhang Yi, mature long moustache, forest-green steel armor, sword, civilian green official robe',
 '장임':'Zhang Ren, stern upright mature face, trimmed beard, bronze burgundy armor, spear, civilian burgundy robe',
 '장준':'Zhang Zun, young forceful eyebrows, short beard, dark red green armor, spear, civilian dark red robe',
 '장포':'Zhang Bao, young broad face and thick eyebrows, short black beard, dark green black armor, snake-headed spear, civilian dark green robe',
 '장합':'Zhang He, handsome mature face, neat moustache, violet steel armor, spear, civilian violet robe',
 '제갈상':'Zhuge Shang, very young clear-eyed scholar-warrior, white jade light armor, spear, civilian white jade robe',
 '제갈첨':'Zhuge Zhan, middle-aged thoughtful face, short neat beard, pale jade silver armor, sword, civilian jade scholar robe',
 '조루':'Zhao Lei, mature square face, short moustache, dark green bronze armor, spear, civilian brown green robe',
 '조상':'Cao Shuang, round middle-aged face, small moustache, rich blue gold armor, sword, civilian blue gold official robe',
 '조인':'Cao Ren, stocky mature face, thick beard, dark blue steel armor, shield and saber, civilian indigo robe',
 '조홍':'Cao Hong, mature sharp brows, short black beard, navy bronze armor, saber, civilian slate-blue robe',
 '종회':'Zhong Hui, ambitious young pale face, thin moustache, violet silver armor, sword, civilian violet official robe',
 '주창':'Zhou Cang, sturdy dark tan face, wild short black beard, green headwrap, dark leather armor, polearm, civilian dark brown tunic green sash',
 '주태':'Zhou Tai, scarred mature face, short beard, dark red bronze armor, saber, civilian dark red robe',
 '축융':'Lady Zhurong, athletic adult woman, tan skin, dark braided hair, copper red southern armor, throwing blade, civilian orange-red patterned long tunic, practical fully clothed',
 '하후덕':'Xiahou De, mature stocky face, trimmed beard, navy bronze armor, axe, civilian slate robe',
 '하후연':'Xiahou Yuan, mature confident face, short beard, blue steel helmet and armor, bow, civilian blue robe',
 '학소':'Hao Zhao, severe weathered face, short grey beard, navy iron armor, spear and shield, civilian dark grey robe',
 '호분':'Hu Fen, older bold face, grey moustache, blue bronze armor, spear, civilian navy brown robe',
 '호제':'Hu Ji, mature gentle moustached face, green silver armor, sword, civilian blue green robe',
 '황숭':'Huang Chong, young stern brows, clean shaven, green bronze armor, spear, civilian pale green robe',
 '황충':'Huang Zhong, vigorous elderly man, white beard and eyebrows, bronze ochre helmet and armor, burgundy scarf, bow and quiver, civilian ochre robe burgundy sash'
}
atlas="""One production character asset atlas, exactly 4 columns x4 rows, 16 equally sized square cells. Reference is STYLE/body proportions only, not identity. Cute consistent 3-head-tall SD, polished outlined hand-painted 2D tactical RPG artwork, no adult realistic proportions. CHARACTER: {identity}. Battle poses are ON FOOT, no horse. Portrait must match this exact same face. Civilian outfit has NO armor, helmet or weapon, wears a cloth cap. Full body with feet in each cell except portrait. TRUE TRANSPARENT alpha background, no checkerboard, no solid background, no text, labels, grid or borders. Broad empty gutters, nothing crosses cells, keep equal sprite scale. Order left-to-right, top-to-bottom: row1 portrait bust / armored idle three-quarter front facing LEFT / armored idle rear upper-left / armored attacking LEFT using own weapon. Row2 armored attack rear upper-left / armored flinch front LEFT / armored walk front LEFT step / armored walk rear upper-left step. Row3 civilian idle front LEFT / civilian idle rear upper-left / civilian walk front LEFT step1 / civilian walk front LEFT step2. Row4 civilian talking open hand LEFT / civilian hands-clasped salute LEFT / civilian seated cross-legged LEFT / civilian kneeling LEFT. All 16 cells occupied correctly; clear directional silhouette and consistent face. Square high resolution sprite atlas, no scene scenery."""
jobs=[]
layout=runpy.run_path(str(ROOT/'tools/sprite-pipeline/export_layout.py'))
for e in entries:
 layout['export'](e['slug'])
 if e['slug']=='nanjun':continue
 prompt=f"""Create one high-detail painted tactical game ground map for {e['name']} ({e['slug']}), late Han/Three Kingdoms China. Landscape 7:5. Input1 EXACT tile layout 28x20, input2 art STYLE only. Preserve every terrain region and corridor exactly at supplied coordinates. Tan=walkable ochre earth, pale green=patchy short grass with naturally soft boundaries, dark green=forest floor and low undergrowth (NO tree trunks blocking units), brown mountain=rocky impassable elevated earth, blue=water, grey wall=low stone foundations, brown bridge=flat bare bridge approach (NO wood bridges: game draws them separately), single brown fort cell=flat parade ground with no building. Orthographic overhead terrain ground, no horizon/perspective/isometric diamond. Rich readable painted texture, fine stones/grass, varied hue and local ground detail, cohesive soft daylight. Location terrain is {e['terrain']}; evoke geography with ground texture within existing footprint. NO characters, no buildings, no tall trees, no UI/text/grid. Entire image precisely follows blockout, do not invent obstacles on walkable cells. Match cheerful warm green-gold polished SRPG aesthetic of reference2. Maximum native resolution."""
 jobs.append({'id':'map-'+e['slug'],'kind':'map','name':e['slug'],'prompt':prompt,'references':[str(ROOT/f'docs/art/layout_{e["slug"]}.png'),str(ROOT/'apps/web/public/assets/maps/zhuojun.webp')]})
for n in names:
 if n in existing or n=='황충':continue
 assert n in identities,n
 jobs.append({'id':'character-'+n,'kind':'character','name':n,'prompt':atlas.format(identity=identities[n]),'references':[str(ROOT/'apps/web/public/assets/sprites/guanyu/front_idle.webp')]})
(OUT/'jobs.json').write_text(json.dumps(jobs,ensure_ascii=False,indent=2),encoding='utf-8')
print(f'{len(jobs)} individual jobs saved.')
