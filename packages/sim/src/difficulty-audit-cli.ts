/** Multi-seed measurement only: never rewrites campaign data or saves. */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { isDeepStrictEqual } from 'node:util';
import { gameData, stages, type Stage, type GameData } from '@tk/data';
import { applyAction, createBattle, type BattleContext } from '@tk/engine';
import { greedyPolicy, naivePolicy, type Policy } from './policy';
import { withLevelOffset } from './runner';

const out = resolve(process.cwd(), process.env.AUDIT_OUTPUT ?? '../../.studio/difficulty-audit');
mkdirSync(out, { recursive: true });
const seeds = Array.from({ length: Number(process.env.AUDIT_SEEDS ?? 20) }, (_, i) => i + 1);
const active = process.env.AUDIT_SOURCE === 'active'
  ? JSON.parse(readFileSync(resolve(process.cwd(),'../../.studio/game/active.json'),'utf8')) : null;
const campaign: Record<string,Stage> = active?.stages ?? stages;
const data: GameData = active ? {...gameData,maps:active.maps,commanders:active.commanders,items:active.items} : gameData;
const baselineSeeds = Array.from({ length: Number(process.env.AUDIT_BASELINE_SEEDS ?? seeds.length) }, (_,i)=>i+1);
const offsets = [-5, -2, 0, 2, 5];
const waitPolicy: Policy = (_, state) => {
  const unit = state.units.find(u => u.side === state.phase && !u.retreated && !u.acted);
  return unit ? { type: 'wait', unitId: unit.id } : undefined;
};
const policies = { auto: greedyPolicy, simple: naivePolicy, wait: waitPolicy };
type Mode = keyof typeof policies;

function run(id: string, mode: Mode, offset: number, seed: number) {
  const stage = withLevelOffset(campaign[id]!, offset);
  const ctx: BattleContext = { data, stage, map: data.maps[stage.mapId]! };
  let state = createBattle(ctx, seed);
  const initialIds = new Set(state.units.filter(u => u.side === 'player').map(u => u.id));
  const initialHp = state.units.filter(u => initialIds.has(u.id)).reduce((n,u) => n + u.maxTroops, 0);
  let actions = 0, playerAttacks = 0, damageTaken = 0;
  const duels: string[] = [], scripts = new Set<string>();
  while (state.status === 'ongoing' && state.turn <= stage.turnLimit + 1) {
    if (++actions > 100000) throw Error(`Runaway ${id}/${mode}/${offset}/${seed}`);
    // Only player skill varies. Enemy and ally use the actual game's driver policy.
    const action = (state.phase === 'player' ? policies[mode] : greedyPolicy)(ctx, state);
    if (!action) break;
    if (state.phase === 'player' && ['attack','ultimate'].includes(action.type)) playerAttacks++;
    const next = applyAction(ctx, state, action);
    for (const event of next.events) {
      if (event.type === 'duelTriggered') duels.push(event.eventId);
      if (event.type === 'scriptMessage') scripts.add(event.text);
      if (event.type === 'damageDealt' && initialIds.has(event.defenderId)) damageTaken += event.damage;
      if (event.type === 'scriptDamage' && initialIds.has(event.unitId)) damageTaken += event.damage;
    }
    state = next.state;
  }
  const players = state.units.filter(u => initialIds.has(u.id));
  return { seed, result: state.status === 'ongoing' ? 'timeout' : state.status,
    turns: state.turn, retreats: players.filter(u => u.retreated).length,
    hpLeft: players.reduce((n,u) => n + (u.retreated ? 0 : u.troops),0) / initialHp,
    damageTaken, playerAttacks, duels, scripts: [...scripts] };
}
const all: unknown[] = [];
for (const id of Object.keys(campaign).sort()) {
  const stage = campaign[id]!;
  // Reuse measured shipped runs only if all combat inputs match the active snapshot.
  const {scenario: _story, ...combat} = stage;
  const {scenario: _oldStory, ...oldCombat} = stages[id]!;
  const same = active && isDeepStrictEqual(combat,oldCombat) &&
    isDeepStrictEqual(data.maps[stage.mapId],gameData.maps[stage.mapId]) &&
    isDeepStrictEqual(data.commanders,gameData.commanders) && isDeepStrictEqual(data.items,gameData.items);
  const cachedPath=resolve(out,'shipped',`${id}.json`);
  const cached=process.env.AUDIT_REUSE_SHIPPED==='1' && same && existsSync(cachedPath) ? JSON.parse(readFileSync(cachedPath,'utf8')) : null;
  const cells = [];
  for (const mode of ['auto','simple','wait'] as Mode[]) {
    for (const offset of mode === 'auto' ? offsets : [0]) {
      const oldRuns: ReturnType<typeof run>[] = cached?.cells.find((c: {mode:string;offset:number})=>c.mode===mode&&c.offset===offset)?.runs ?? [];
      const selectedSeeds=mode==='auto'&&offset===0 ? baselineSeeds : seeds;
      const runs = selectedSeeds.map(seed => oldRuns.find(r=>r.seed===seed) ?? run(id,mode,offset,seed));
      const wins = runs.filter(r => r.result === 'victory');
      const mean = (list: typeof runs, f: (r: typeof runs[number]) => number) => list.length ? list.reduce((n,r)=>n+f(r),0)/list.length : null;
      cells.push({ mode, offset, count: runs.length, wins: wins.length,
        winRate: wins.length/runs.length, cleanWins: wins.filter(r=>r.retreats===0).length,
        meanWinTurns: mean(wins,r=>r.turns), meanRetreats: mean(runs,r=>r.retreats),
        meanHpLeft: mean(runs,r=>r.hpLeft), runs });
    }
  }
  const levels = stage.units.filter(u=>u.side==='player').map(u=>u.level);
  const row = { id, name: stage.name, source: active ? `active revision ${active.revision}` : 'shipped', levels, playerCount: levels.length, turnLimit: stage.turnLimit,
    objectives: stage.objectives ?? stage.victory, cells };
  all.push(row);
  writeFileSync(resolve(out,`${id}.json`),JSON.stringify(row,null,2)+'\n');
  console.log(`${id}: ${cells.map(c=>`${c.mode}${c.offset>=0?'+':''}${c.offset} ${c.wins}/${c.count}`).join(' | ')}`);
}
writeFileSync(resolve(out,'results.json'),JSON.stringify({seeds,baselineSeeds,offsets,source:active?{projectId:active.projectId,revision:active.revision}:'shipped',rows:all},null,2)+'\n');
console.log(`Saved ${all.length} stages to ${out}`);
