// 일기토 키비주얼 프롬프트 파생(§9 Tier 1) — stages의 duel 이벤트에서 유니크 (공격자,방어자)
// 페어를 뽑아 duel-prompts.json 잡 목록을 만든다. gen_assets.py가 merge해 생성(kind:"duel",
// do_scene 핸들러 재사용 → public/assets/duels/{pair}.webp + R2).
//
// 이 이미지는 컷인(DuelCutin) 배경이자 **미래 Seedance I2V의 시드 키프레임**(§4) — 이중 용도.
// 스타일 문구는 에셋보드 STYLE/NEGATIVE(하우스 톤)와 동일 계열로 맞춘다.
//
// 사용:  node tools/sprite-pipeline/gen/derive_duel_prompts.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..", "..", "..");
const STAGES = path.join(ROOT, "packages", "data", "json", "stages");
const OUT = path.join(HERE, "duel-prompts.json");

// 참전 장수 외형 묘사(영문) — 시그니처 무기·실루엣 중심, 코에이 디자인 인용 금지.
const DESC = {
  관우: "Guan Yu, a towering general with a magnificent long black beard, deep-green robe over lamellar armor, wielding a huge crescent-moon glaive",
  장비: "Zhang Fei, a burly ferocious general with bristling whiskers and glaring eyes, dark armor, wielding a long serpent-coiled spear",
  조운: "Zhao Yun, a young gallant cavalry general in silver-white armor with a white plume, wielding a slender dragon spear",
  황개: "Huang Gai, a grizzled veteran naval commander with a gray beard, Wu navy lamellar armor, swinging an iron whip-staff",
  관해: "Guan Hai, a Yellow Turban chieftain with a yellow head-wrap and ragged patchwork armor, swinging a crude heavy saber",
  유벽: "Liu Pi, a Yellow Turban commander in a yellow turban and worn leather armor, thrusting a battered spear",
  화웅: "Hua Xiong, a fearsome vanguard general in dark iron armor with a red-crested helmet, swinging a broad executioner saber",
  여포: "Lu Bu, a peerless warrior in crimson-and-gold armor with twin pheasant-tail plumes, wielding a sky-piercing halberd",
  서영: "Xu Rong, a grim western field general in dark cavalry armor and iron helm, leveling a long lance",
  이각: "Li Jue, a cruel Xiliang warlord in heavy western armor and fur-trimmed cloak, slashing a curved blade",
  국의: "Qu Yi, an elite vanguard commander in black-iron armor, thrusting a long halberd",
  우금: "Yu Jin, a stern disciplined general in blue-black armor, striking with a straight long sword",
  장요: "Zhang Liao, a dignified elite general in teal-and-iron armor, sweeping a long halberd",
  기령: "Ji Ling, a bronze-armored champion swinging a three-pointed double-edged saber",
  허저: "Xu Chu, a hulking bear-like warrior of massive frame in simple heavy armor, swinging an enormous broadsword",
  이전: "Li Dian, a calm scholarly general in dark blue armor, thrusting a straight sword",
  조인: "Cao Ren, a stalwart defensive general in heavy gray-blue armor with a tall shield silhouette, bracing a long spear",
  하후은: "Xiahou En, a proud sword-bearer officer in light ornate armor, drawing a jeweled precious sword",
  진손: "Chen Sun, a wiry bandit leader in leather armor wielding twin sabers",
  장무: "Zhang Wu, a river-pirate warlord in scale armor swinging a heavy cutlass",
  채모: "Cai Mao, a naval commander in Jing-province lamellar armor with an officer's saber",
  조조: "Cao Cao, the supreme warlord with keen piercing eyes, black-and-gold ornate armor and a flowing war cloak, raising a straight sword",
};

const STYLE =
  "Art style: East Asian ink-wash painting fused with modern game illustration. Confident calligraphic linework, muted earth tones with selective vivid accent colors (vermilion, jade green, gold), textured rice-paper feel in shading, dramatic negative space. NOT photorealistic, NOT anime-cel.";
const NEGATIVE =
  "Avoid: Koei-style portraits, Dynasty Warriors look, Japanese sengoku armor, photobash, text, watermark, frame, border, modern objects.";

function promptFor(attackerId, defenderId) {
  const a = DESC[attackerId];
  const b = DESC[defenderId];
  if (!a || !b) throw new Error(`외형 묘사 누락: ${!a ? attackerId : defenderId} — DESC에 추가하세요`);
  return (
    `Dramatic one-on-one duel keyframe for a Three Kingdoms tactics game. LEFT fighter: ${a}, charging from the left and facing right. ` +
    `RIGHT fighter: ${b}, charging from the right and facing left. Their weapons collide at the center with sparks and torn dust, ` +
    `low heroic camera angle, dark hazy battlefield backdrop with distant war banners and drifting smoke, charged duel atmosphere. ` +
    `Both warriors fully in frame, dynamic diagonal composition. ${STYLE} ${NEGATIVE} 16:9 aspect ratio, no text anywhere.`
  );
}

const files = fs.readdirSync(STAGES).filter((f) => f.endsWith(".json")).sort();
const pairs = new Map(); // pairKey → {attackerId, defenderId, stages: []}
for (const f of files) {
  const st = JSON.parse(fs.readFileSync(path.join(STAGES, f), "utf8"));
  for (const ev of st.events ?? []) {
    if (ev.type !== "duel" || ev.trigger?.kind !== "attack") continue;
    const key = `${ev.trigger.attackerId}_${ev.trigger.defenderId}`;
    const cur = pairs.get(key) ?? { attackerId: ev.trigger.attackerId, defenderId: ev.trigger.defenderId, stages: [] };
    cur.stages.push(st.id);
    pairs.set(key, cur);
  }
}

const jobs = [...pairs.entries()].map(([key, p]) => ({
  kind: "duel",
  id: `duel-${key}`,
  savePath: `assets/duels/${key}.webp`,
  stages: p.stages, // 참고용(생성엔 미사용)
  prompt: promptFor(p.attackerId, p.defenderId),
}));

fs.writeFileSync(OUT, JSON.stringify({ generatedAt: "derive_duel_prompts.mjs", jobs }, null, 2) + "\n", "utf8");
console.log(`유니크 대결 ${jobs.length}쌍 → ${path.relative(ROOT, OUT)}`);
for (const j of jobs) console.log("  " + j.id + "  (" + j.stages.join(",") + ")");
