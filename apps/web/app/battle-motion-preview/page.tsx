"use client";

import { useEffect, useRef, useState } from "react";
import originalGroups from "../../src/pixi/chapterOnePreview.json";
import { BattleVoicePlayer, audio } from "../../src/audio";

const chapterOneGroups = [...originalGroups,
  [{ id: 'troia-agamemnon', name: '아가멤논', classId: 'lord' }, { id: 'troia-menelaus', name: '메넬라오스', classId: 'footman' }],
  [{ id: 'achilles', name: '아킬레우스', classId: 'lord' }, { id: 'patroclus', name: '파트로클로스', classId: 'strategist' }, { id: 'diores', name: '디오레스', classId: 'footman' }],
  [{ id: 'greek-spear', name: '그리스 창병', classId: 'footman' }, { id: 'greek-archer', name: '그리스 궁병', classId: 'archer' }],
  [{ id: 'trojan-spear-1', name: '트로이 창병', classId: 'footman' }, { id: 'trojan-archer-1', name: '트로이 궁병', classId: 'archer' }],
];


type SpellCategory = "fire" | "water" | "wind" | "earth" | "heal" | "debuff" | "weather" | "special";
type Action = `spell:${SpellCategory}` | "burn" | "extinguish" | "weak" | "healthy" | "attack" | "move" | "hit" | "guard" | "flank" | "crit" | "ultimate";
type Controls = { play(action: Action, back: boolean, generic: boolean): Promise<void>; zoom(value: number): void; speed(value: number): void };

/** Read-only art workbench using the actual battle UnitView/FxLayer renderers. */
export default function BattleMotionPreview() {
  const host = useRef<HTMLDivElement>(null);
  const controls = useRef<Controls | null>(null);
  const [status, setStatus] = useState("동작 이미지 불러오는 중…");
  const [busy, setBusy] = useState(false);
  const [back, setBack] = useState(false);
  const [generic, setGeneric] = useState(false);
  const [group, setGroup] = useState(0);
  useEffect(() => {
    let disposed = false;
    setStatus("동작 이미지 불러오는 중…");
    let cleanup: (() => void) | undefined;
    void (async () => {
      const [{ Application, Container, Graphics, Text }, { TextureResolver }, { TweenRunner }, { UnitView }, { FxLayer }, { gridToWorld }, { FireLayer }] = await Promise.all([
        import("pixi.js"), import("../../src/pixi/textures"), import("../../src/pixi/tweens"),
        import("../../src/pixi/layers/UnitView"), import("../../src/pixi/layers/FxLayer"), import("../../src/pixi/projection"), import("../../src/pixi/layers/FireLayer"),
      ]);
      if (!host.current || disposed) return;
      const app = new Application();
      await app.init({ width: 864, height: 300, background: "#ada776", antialias: true, resolution: window.devicePixelRatio || 1, autoDensity: true });
      if (disposed) { app.destroy(true, { children: true }); return; }
      host.current.appendChild(app.canvas);
      const textures = new TextureResolver(app.renderer, true);
      const tweens = new TweenRunner(app.ticker);
      const world = new Container();
      app.stage.addChild(world);
      world.position.set(0, 50);
      const grid = new Graphics();
      for (let x = 0; x <= 864; x += 48) grid.moveTo(x, 0).lineTo(x, 240);
      for (let y = 0; y <= 240; y += 48) grid.moveTo(0, y).lineTo(864, y);
      grid.stroke({ color: 0xffffff, width: 1, alpha: 0.13 });
      world.addChild(grid);
      const fires = new FireLayer(textures);
      world.addChild(fires);
      const fx = new FxLayer(tweens, textures);
      app.stage.addChild(fx.screen);
      fx.resize(864, 300);
      const entries = chapterOneGroups[group]!;
      const voices = new BattleVoicePlayer();
      void voices.preload(entries.map(entry => entry.id));
      const names = entries.map(entry => entry.name);
      const units = entries.map((entry, i) => new UnitView({ id: entry.id, commanderId: entry.id, classId: entry.classId, name: entry.name, side: "player", x: 3 + i * 6, y: 3, troops: 100, maxTroops: 100, retreated: false }, textures, tweens, { bars: true }));
      units.forEach((unit, i) => {
        world.addChild(unit);
        const label = new Text({ text: names[i], style: { fontSize: 14, fill: 0x252e23 } });
        label.anchor.set(0.5); label.position.set((3 + i * 6) * 48 + 24, 224); world.addChild(label);
      });
      world.addChild(fx.world);
      let speed = 1;
      const tick = () => { units.forEach(unit => unit.tickIdle(app.ticker.deltaMS * speed)); fires.tick(app.ticker.deltaMS * speed); };
      app.ticker.add(tick);
      cleanup = () => { voices.destroy(); app.ticker.remove(tick); tweens.destroy(); textures.destroy(); app.destroy(true, { children: true }); };
      await Promise.all([textures.loadSprites(undefined, new Set(units.map(unit => unit.spriteKey).filter((key): key is string => Boolean(key)))), textures.loadFx()]);
      if (disposed) return;
      units.forEach(unit => unit.refreshSprite());
      controls.current = {
        zoom(value) { world.scale.set(value); app.renderer.resize(864 * value, 250 * value + 50); fx.resize(Math.min(864 * value, host.current?.clientWidth ?? 864), 250 * value + 50); },
        speed(value) { speed = value; tweens.setTimeScale(value); },
        async play(action, rear, generic) {
          if (action === "burn" || action === "extinguish") {
            fires.sync(action === "burn" ? [{cells: entries.flatMap((_,i)=>[{x:2+i*6,y:3},{x:3+i*6,y:3},{x:4+i*6,y:3}]),remaining:3,lastTurn:1,damagePercent:5,spread:false,extinguishInRain:true,flammableOnly:true}] : []);
            return;
          }
          if (action === "weak" || action === "healthy") {
            units.forEach((unit,i) => {unit.setTroops(action === "weak" ? 25 : 100); unit.faceToward({x:2+i*6,y:rear?2:3});});
            return;
          }
          if (action.startsWith("spell:")) {
            const category = action.slice(6);
            await Promise.all(units.map((unit,i) => fx.strategyEffect(category, gridToWorld({x:3+i*6,y:3}))));
            return;
          }
          if (action === "ultimate") {
            units.forEach((unit, i) => {
              unit.snapTo(3 + i * 6, 3);
            });
            await fx.banner(generic || group !== 0 ? "필살!" : "필살 · 인덕의 결의 / 청룡언월 / 장팔사모", 650);
            if (disposed) return;
          }
          if (action === "flank") {
            const [lead, target, helper] = units;
            if (!lead || !target || !helper) return;
            lead!.snapTo(8, 3); target!.snapTo(9, 3); helper!.snapTo(10, 3);
            lead!.faceToward({ x: 9, y: 3 }); helper!.faceToward({ x: 9, y: 3 });
            const at = gridToWorld({ x: 9, y: 3 });
            await fx.flankPopup(at, 20);
            if (disposed) return;
            void voices.play(entries[0]!.id);
            void voices.play(entries[2]!.id, "attack", 0.45);
            await Promise.all([lead!.play("attack"), helper!.playCoordinatedAttack(lead!.attackDurationMs), (async () => {
              await tweens.delay(lead!.attackContactMs);
              if (disposed) return;
              await Promise.all([lead.signatureFx ? fx.heroWeaponArc(lead.signatureFx, gridToWorld({ x: 8, y: 3 }), at) : fx.slashArc(gridToWorld({ x: 8, y: 3 }), at),
                fx.impactFlash(at), target!.playHitFrom(-1, 0.5), fx.damagePopup(at, 120, false)]);
            })()]);
            return;
          }
          await Promise.all(units.map(async (unit, i) => {
            const x = 3 + i * 6, y = 3;
            unit.snapTo(x, y);
            const target = { x: x - 1, y: rear ? y - 1 : y };
            unit.faceToward(target);
            if (action === "move") {
              await unit.moveAlong([{x,y},{x:x-1,y:rear?y-1:y},{x:x-2,y:rear?y-1:y}], 360);
              if (!disposed) unit.snapTo(x, y);
            } else if (action === "hit" || action === "guard") {
              const at = gridToWorld({ x, y });
              await Promise.all([unit.playHitFrom(-1, action === "guard" ? 0.3 : 0.5, action === "guard"),
                action === "guard" ? fx.guardFlash(at, gridToWorld(target)) : fx.impactFlash(at),
                fx.damagePopup(at, action === "guard" ? 40 : 80, false, false, action === "guard")]);
            } else {
              void voices.play(entries[i]!.id, action === "ultimate" ? "ultimate" : "attack");
              await Promise.all([unit.play("attack"), (async () => {
                await tweens.delay(unit.attackContactMs);
                if (disposed) return;
                const at = gridToWorld(target);
                const special = action === "crit" || action === "ultimate";
                await Promise.all([special
                  ? fx.specialImpact(action === "crit" ? "critical" : "ultimate", at, gridToWorld({x,y}), generic ? null : unit.signatureFx)
                  : Promise.all([unit.signatureFx ? fx.heroWeaponArc(unit.signatureFx, gridToWorld({x,y}), at) : fx.slashArc(gridToWorld({x,y}), at), fx.impactFlash(at)]),
                  action === "crit" || action === "ultimate" ? fx.damagePopup(at, action === "crit" ? 150 : 250, false, action === "crit") : Promise.resolve()]);
              })()]);
            }
          }));
        },
      };
      setStatus("준비됨 · 전투와 같은 렌더러 · 1배율에서 한 칸 48px");
    })().catch(error => { if (!disposed) setStatus(String(error)); });
    return () => { disposed = true; controls.current = null; cleanup?.(); };
  }, [group]);
  async function play(action: Action) {
    if (busy || !controls.current) return;
    audio.ensureUnlocked();
    setBusy(true);
    try { await controls.current.play(action, back, generic); }
    finally { setBusy(false); }
  }
  const style = { padding: "10px 16px", border: "1px solid #65735c", borderRadius: 7, background: "#263326", color: "#fff", cursor: "pointer" };
  return <main style={{ padding: 28, color: "#eee7cf", minHeight: "100vh", background: "#152018" }}>
    <a href="/studio" style={{ color: "#ddc484" }}>← Studio로 돌아가기</a>
    <h1>전투 동작·책략 미리보기</h1>
    <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:16}}>
      <button style={style} disabled={busy} onClick={()=>play("weak")}>빈사 · 체력 25%</button>
      <button style={style} disabled={busy} onClick={()=>play("healthy")}>회복 · 체력 100%</button>
      <button style={style} disabled={busy} onClick={()=>play("burn")}>지속 화공</button>
      <button style={style} disabled={busy} onClick={()=>play("extinguish")}>불 끄기</button>
      {Object.entries({fire:"화계",water:"수계",wind:"풍계",earth:"낙석",heal:"회복",debuff:"상태이상",weather:"날씨",special:"특수"}).map(([key,label])=><button key={key} style={style} disabled={busy} onClick={()=>play(`spell:${key as SpellCategory}`)}>{label}</button>)}
    </div>
    <label>캐릭터 묶음 <select value={group} disabled={busy} onChange={e => setGroup(Number(e.target.value))}>
      {chapterOneGroups.map((entries, index) => <option key={index} value={index}>{entries.map(entry => entry.name).join(" · ")}</option>)}
    </select></label>
    <p>{status}</p>
    <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center", marginBottom: 24 }}>
      {([["attack", "공격 + 이펙트"], ["move", "이동"], ["hit", "피격"], ["guard", "막음"], ["flank", "협공"], ["crit", "치명타"], ["ultimate", "필살기"]] as const).map(([action, label]) => <button style={style} key={action} disabled={busy || !controls.current || (action === "flank" && chapterOneGroups[group]!.length < 3)} onClick={() => void play(action)}>{label}</button>)}
      <label><input type="checkbox" checked={back} disabled={busy} onChange={e => setBack(e.target.checked)}/> 후면 동작</label>
      <label><input type="checkbox" checked={generic} disabled={busy} onChange={e => setGeneric(e.target.checked)}/> 기본 필살기 비교</label>
      <label>확대 <select key={`zoom-${group}`} disabled={!controls.current} defaultValue="1" onChange={e => controls.current?.zoom(Number(e.target.value))}><option value="1">1배</option><option value="2">2배</option><option value="3">3배</option></select></label>
      <label>재생 속도 <select key={`speed-${group}`} disabled={!controls.current} defaultValue="1" onChange={e => controls.current?.speed(Number(e.target.value))}><option value="0.25">느리게 · 0.25배</option><option value="1">보통 · 1배</option><option value="2">빠르게 · 2배</option></select></label>
    </div>
    <div ref={host} style={{ overflow: "auto", maxWidth: "100%", borderRadius: 12 }} />
    <p>대기 2 · 이동 4 · 공격 6 · 피격 2 · 방어 2장 × 앞/뒤. 저장된 전투와 캐릭터 수치는 바뀌지 않습니다.</p>
  </main>;
}
