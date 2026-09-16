import type { BattleScript } from "@tk/data";
import type { ActionResult, BattleContext, BattleState, UnitState } from "./types";
import { applyStatus } from "./status";
import { drainConsumables, spawnUnit } from "./createBattle";

type Target = Extract<BattleScript["actions"][number], { kind: "damage" }>["target"];
function matches(unit: UnitState, target: Target): boolean {
  const a = target.area;
  return !unit.retreated && (!target.side || unit.side === target.side)
    && (!target.unitIds?.length || target.unitIds.includes(unit.id))
    && (!a || (unit.x >= a.x && unit.y >= a.y && unit.x < a.x + a.width && unit.y < a.y + a.height));
}
function triggered(event: BattleScript, state: BattleState): boolean {
  const t = event.trigger;
  if (t.kind === "turn") return state.turn >= t.turn && state.phase === t.phase;
  if (t.kind === "enterArea") return state.units.some(u => matches(u, t.target));
  if (t.kind === "eventFired") return (state.firedScripts ?? []).includes(t.eventId);
  const u = state.units.find(u => u.id === t.unitId);
  return !!u && (t.kind === "unitRetreated" ? u.retreated : !u.retreated && u.troops * 100 <= u.maxTroops * t.percent);
}

/** Bounded, declaration-ordered, one-shot evaluation. No random numbers or presentation dependencies. */
export function applyBattleScripts(ctx: BattleContext, state: BattleState): ActionResult {
  let next = state;
  const events: ActionResult["events"] = [];
  if (state.status !== "ongoing") return { state, events };
  const burning = tickFires(ctx, state);
  next = burning.state; events.push(...burning.events);
  if (!ctx.stage.scriptEvents?.length) return { state: next, events };
  // Multiple passes allow dependencies declared before their prerequisites; every event fires at most once.
  for (let pass = 0; pass < ctx.stage.scriptEvents.length; pass++) {
    let changed = false;
    for (const script of ctx.stage.scriptEvents) {
      if (script.enabled === false || next.firedScripts?.includes(script.id) || !triggered(script, next)) continue;
      changed = true;
      next = { ...next, firedScripts: [...(next.firedScripts ?? []), script.id] };
      for (const action of script.actions) {
        if (action.kind === "fire") {
          const cells = [];
          for (let y=action.area.y;y<Math.min(ctx.map.height,action.area.y+action.area.height);y++) for(let x=action.area.x;x<Math.min(ctx.map.width,action.area.x+action.area.width);x++) cells.push({x,y});
          if (!(action.extinguishInRain && next.weather === "rain")) next = {...next,fires:[...(next.fires??[]),{cells,remaining:action.duration,lastTurn:next.turn,damagePercent:action.damagePercent,spread:action.spread,extinguishInRain:action.extinguishInRain,flammableOnly:action.flammableOnly}]};
          continue;
        }
        if (action.kind === "message") { events.push({ type: "scriptMessage", text: action.text }); continue; }
        if (action.kind === "effect") { events.push({ type: "scriptEffect", effect: action.effect, area: action.area }); continue; }
        if (action.kind === "weather") {
          next = { ...next, weather: action.weather };
          events.push({ type: "weatherChanged", weather: action.weather, casterId: "" }); continue;
        }
        if (action.kind === "reinforcement") {
          const group = ctx.stage.reinforcements?.find(r => r.id === action.reinforcementId);
          if (!group || next.spawnedReinforcements.includes(group.id)) continue;
          const pool = { friendly: [...next.sharedItems.friendly], hostile: [...next.sharedItems.hostile] };
          const units = group.units.map(p => drainConsumables(ctx.data, spawnUnit(ctx.data, { ...p, side: group.side }, ctx.stage.autoPromote !== false), pool));
          next = { ...next, units: [...next.units, ...units], spawnedReinforcements: [...next.spawnedReinforcements, group.id], sharedItems: pool };
          events.push({ type: "reinforcementArrived", reinforcementId: group.id, side: group.side, units: units.map(u => ({ id: u.id, classId: u.classId, x: u.x, y: u.y, troops: u.troops, maxTroops: u.maxTroops })) }); continue;
        }
        next = { ...next, units: next.units.map(u => {
          if (!matches(u, action.target)) return u;
          if (action.kind === "status") {
            events.push({ type: "statusApplied", unitId: u.id, kind: action.status, turns: action.turns });
            const currentStun = action.status === "stun" && u.side === next.phase;
            const turns = action.turns - (currentStun ? 1 : 0);
            return { ...u, ...(currentStun ? { acted: true, moved: true } : {}), statuses: turns > 0 ? applyStatus(u.statuses, action.status, turns) : u.statuses ?? [] };
          }
          const amount = Math.floor(action.percent ? u.maxTroops * action.amount / 100 : action.amount);
          if (action.kind === "heal") {
            const healed = Math.min(amount, u.maxTroops - u.troops);
            events.push({ type: "troopsHealed", unitId: u.id, amount: healed });
            return { ...u, troops: u.troops + healed };
          }
          const damage = Math.min(amount, Math.max(0, u.troops - (action.nonlethal ? 1 : 0)));
          const troops = u.troops - damage;
          events.push({ type: "scriptDamage", unitId: u.id, damage });
          if (troops === 0) events.push({ type: "unitRetreated", unitId: u.id });
          return { ...u, troops, retreated: troops === 0 };
        }) };
      }
    }
    if (!changed) break;
  }
  if (next.weather === "rain" && next.fires?.some(f=>f.extinguishInRain)) next={...next,fires:next.fires.filter(f=>!f.extinguishInRain)};
  return { state: next, events };
}

/** One tick per full turn, independent of action count. Overlaps use the strongest fire. */
function tickFires(ctx: BattleContext, state: BattleState): ActionResult {
  if (!state.fires?.length) return {state,events:[]};
  const events: ActionResult["events"]=[];
  const damage = new Map<string,number>();
  const fires: NonNullable<BattleState["fires"]>=[];
  for(const fire of state.fires) {
    if(fire.extinguishInRain && state.weather==='rain') continue;
    if(fire.lastTurn>=state.turn) {fires.push(fire);continue;}
    const cells=new Map(fire.cells.map(c=>[`${c.x},${c.y}`,c]));
    // Only the previous front spreads: never flood the whole map in one tick.
    if(fire.spread) for(const c of fire.cells) for(const [dx,dy] of [[0,-1],[1,0],[0,1],[-1,0]]) {
      const x=c.x+dx!,y=c.y+dy!;
      if(x<0||y<0||x>=ctx.map.width||y>=ctx.map.height) continue;
      const terrain=ctx.map.tileLegend[ctx.map.tiles[y]![x]!] ?? '';
      if(fire.flammableOnly && !['forest','grass','village','barracks','depot','bridge'].includes(terrain)) continue;
      if(!fire.flammableOnly && ['river','wall','cliff'].includes(terrain)) continue;
      cells.set(`${x},${y}`,{x,y});
    }
    for(const [key] of cells) damage.set(key,Math.max(damage.get(key)??0,fire.damagePercent));
    if(fire.remaining>1) fires.push({...fire,cells:[...cells.values()],remaining:fire.remaining-1,lastTurn:state.turn});
  }
  const units=state.units.map(u=>{
    const percent=damage.get(`${u.x},${u.y}`);
    if(u.retreated||percent===undefined) return u;
    const amount=Math.min(u.troops,Math.floor(u.maxTroops*percent/100));
    if(!amount)return u;
    events.push({type:'scriptDamage',unitId:u.id,damage:amount});
    if(amount===u.troops)events.push({type:'unitRetreated',unitId:u.id});
    return {...u,troops:u.troops-amount,retreated:amount===u.troops};
  });
  return {state:{...state,fires,units},events};
}
