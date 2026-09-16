import { BattleScriptSchema, type BattleScript } from "@tk/data";
import type { AuthoringProject } from "@tk/data/authoring-project";

type Action = BattleScript["actions"][number];
type Target = Extract<Action, { kind: "damage" }>["target"];
const kinds = { fire: "지속 화재", message: "대사·알림", effect: "범위 연출", damage: "피해", heal: "회복", status: "상태이상", weather: "날씨 변경", reinforcement: "원군 호출" };
const triggers = { turn: "턴 도달", enterArea: "구역 진입", unitRetreated: "장수 퇴각", hpBelow: "체력 이하", eventFired: "다른 사건 발동 후" };
const area = () => ({ x: 0, y: 0, width: 3, height: 3 });
const newAction = (kind: Action["kind"]): Action => {
  switch (kind) {
    case "fire": return {kind,area:area(),duration:3,damagePercent:10,spread:false,extinguishInRain:true,flammableOnly:true};
    case "message": return { kind, text: "사건이 발생했습니다." };
    case "effect": return { kind, effect: "fire", area: area() };
    case "damage": return { kind, target: { side: "enemy" }, amount: 30, percent: true, nonlethal: true };
    case "heal": return { kind, target: { side: "player" }, amount: 30, percent: true };
    case "status": return { kind, target: { side: "enemy" }, status: "stun", turns: 2 };
    case "weather": return { kind, weather: "rain" };
    case "reinforcement": return { kind, reinforcementId: "" };
  }
};
function NumberField({ label, value, change, min = 0, max }: { label: string; value: number; change: (value: number) => void; min?: number; max?: number }) {
  return <label>{label}<input type="number" min={min} max={max} value={value} onChange={e => change(Number(e.target.value))} /></label>;
}
function AreaFields({ value, change }: { value: ReturnType<typeof area>; change: (value: ReturnType<typeof area>) => void }) {
  return <div className="studio-event-grid">{(["x", "y", "width", "height"] as const).map(key => <NumberField key={key} label={{ x: "X (0부터)", y: "Y (0부터)", width: "가로 칸 수", height: "세로 칸 수" }[key]} value={value[key]} min={key === "x" || key === "y" ? 0 : 1} change={v => change({ ...value, [key]: v })} />)}</div>;
}
function TargetFields({ value, change }: { value: Target; change: (value: Target) => void }) {
  return <div className="studio-event-target"><label>대상 진영<select value={value.side ?? ""} onChange={e => { const next = { ...value }; if (e.target.value) next.side = e.target.value as Target["side"]; else delete next.side; change(next); }}><option value="">전체</option><option value="player">아군</option><option value="ally">우군</option><option value="enemy">적군</option></select></label>
    <label>특정 장수 ID (쉼표 구분, 비우면 진영 전체)<input value={value.unitIds?.join(",") ?? ""} onChange={e => change({ ...value, unitIds: e.target.value.split(",").map(s => s.trim()).filter(Boolean) })} /></label>
    <label><input type="checkbox" checked={!!value.area} onChange={e => { const next = { ...value }; if (e.target.checked) next.area = area(); else delete next.area; change(next); }} />구역 안에 있는 대상만</label>
    {value.area && <AreaFields value={value.area} change={a => change({ ...value, area: a })} />}
  </div>;
}

export default function BattleEventEditor({ project, battleId, edit }: { project: AuthoringProject; battleId: string; edit: (fn: (p: AuthoringProject) => void, group?: string) => void }) {
  const battle = project.battles.find(b => b.id === battleId)!;
  const raw = battle.data.scriptEvents;
  if (raw !== undefined && !Array.isArray(raw)) return <p role="alert">사건 데이터 형식이 올바르지 않습니다. 원본은 보존됩니다.</p>;
  const scripts = (raw ?? []) as unknown[];
  const modify = (fn: (list: BattleScript[]) => void) => edit(p => {
    const data = p.battles.find(b => b.id === battleId)!.data;
    const list = (data.scriptEvents ??= []) as unknown as BattleScript[];
    fn(list);
  });
  const add = (fire: boolean) => modify(list => list.push({ id: crypto.randomUUID(), name: fire ? "화공" : "새 사건", trigger: { kind: "turn", turn: 4, phase: "player" }, actions: fire ? [newAction("message"), newAction("effect"), newAction("damage"), newAction("status")] : [newAction("message")] }));
  const groups = Array.isArray(battle.data.reinforcements) ? battle.data.reinforcements as { id: string }[] : [];
  return <section className="studio-event-editor"><h3>전투 사건</h3><p className="studio-note">조건이 충족되면 위에서부터 실행합니다. 각 사건은 전투당 한 번 발동합니다. 체력 %는 최대 체력 기준이며 기절은 대상의 행동 차례를 건너뜁니다. 범위 연출과 피해 대상 구역은 각각 설정하세요.</p>
    <div className="studio-event-buttons"><button onClick={() => add(false)}>＋ 사건 추가</button><button onClick={() => add(true)}>＋ 화공 예시</button></div>
    {scripts.map((rawEvent, index) => {
      const parsed = BattleScriptSchema.safeParse(rawEvent);
      // Validation never replaces the author-owned raw model.
      const event = rawEvent as BattleScript;
      if (!event || !triggers[event.trigger?.kind] || !Array.isArray(event.actions)) return <p key={index}>사건 {index + 1}: 미지원 형식입니다. 원본을 보존합니다.</p>;
      const update = (fn: (value: BattleScript) => void) => modify(list => fn(list[index]!));
      return <details className="studio-event-card" key={event.id} open><summary>{index + 1}. {event.name}</summary>
        <label>사건 이름<input value={event.name} onChange={e => update(v => { v.name = e.target.value; })} /></label>
        <label><input type="checkbox" checked={event.enabled !== false} onChange={e => update(v => { v.enabled = e.target.checked; })} />사용</label>
        <label>발동 조건<select value={event.trigger.kind} onChange={e => update(v => {
          switch (e.target.value) {
            case "turn": v.trigger = { kind: "turn", turn: 4, phase: "player" }; break;
            case "enterArea": v.trigger = { kind: "enterArea", target: { side: "player", area: area() } }; break;
            case "hpBelow": v.trigger = { kind: "hpBelow", unitId: "", percent: 50 }; break;
            case "unitRetreated": v.trigger = { kind: "unitRetreated", unitId: "" }; break;
            case "eventFired": v.trigger = { kind: "eventFired", eventId: "" }; break;
          }
        })}>{Object.entries(triggers).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
        {event.trigger.kind === "turn" && <><NumberField label="턴" value={event.trigger.turn} min={1} change={n => update(v => { if (v.trigger.kind === "turn") v.trigger.turn = n; })} /><label>진영 차례<select value={event.trigger.phase} onChange={e => update(v => { if (v.trigger.kind === "turn") v.trigger.phase = e.target.value as "player"; })}><option value="player">아군</option><option value="ally">우군</option><option value="enemy">적군</option></select></label></>}
        {event.trigger.kind === "enterArea" && <TargetFields value={event.trigger.target} change={t => update(v => { if (v.trigger.kind === "enterArea") v.trigger.target = { ...t, area: t.area ?? area() }; })} />}
        {(event.trigger.kind === "unitRetreated" || event.trigger.kind === "hpBelow") && <label>장수 ID<input value={event.trigger.unitId} onChange={e => update(v => { if (v.trigger.kind === "unitRetreated" || v.trigger.kind === "hpBelow") v.trigger.unitId = e.target.value; })} /></label>}
        {event.trigger.kind === "hpBelow" && <NumberField label="체력 % 이하" min={0} max={100} value={event.trigger.percent} change={n => update(v => { if (v.trigger.kind === "hpBelow") v.trigger.percent = n; })} />}
        {event.trigger.kind === "eventFired" && <label>선행 사건<select value={event.trigger.eventId} onChange={e => update(v => { if (v.trigger.kind === "eventFired") v.trigger.eventId = e.target.value; })}><option value="">선택</option>{(scripts as BattleScript[]).filter(s => s?.id && s.id !== event.id).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>}
        {event.actions.map((action, ai) => {
          const actionEdit = (fn: (value: Action) => void) => update(v => fn(v.actions[ai]!));
          return <div className="studio-event-action" key={ai}><label>실행 {ai + 1}<select value={action.kind} onChange={e => update(v => { v.actions[ai] = newAction(e.target.value as Action["kind"]); })}>{Object.entries(kinds).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
            {action.kind === "message" && <label>표시할 대사·알림<textarea value={action.text} onChange={e => actionEdit(a => { if (a.kind === "message") a.text = e.target.value; })} /></label>}
            {action.kind === "effect" && <><label>연출<select value={action.effect} onChange={e => actionEdit(a => { if (a.kind === "effect") a.effect = e.target.value as "fire"; })}><option value="fire">불꽃</option><option value="water">물</option><option value="rock">낙석</option><option value="special">섬광</option></select></label><AreaFields value={action.area} change={value => actionEdit(a => { if (a.kind === "effect") a.area = value; })} /></>}
            {"target" in action && <TargetFields value={action.target} change={t => actionEdit(a => { if ("target" in a) a.target = t; })} />}
            {(action.kind === "damage" || action.kind === "heal") && <><NumberField label="수치" value={action.amount} change={n => actionEdit(a => { if (a.kind === "damage" || a.kind === "heal") a.amount = n; })} /><label><input type="checkbox" checked={action.percent} onChange={e => actionEdit(a => { if (a.kind === "damage" || a.kind === "heal") a.percent = e.target.checked; })} />최대 체력의 %</label>{action.kind === "damage" && <label><input type="checkbox" checked={action.nonlethal} onChange={e => actionEdit(a => { if (a.kind === "damage") a.nonlethal = e.target.checked; })} />체력 1은 남기기</label>}</>}
            {action.kind === "status" && <><label>상태<select value={action.status} onChange={e => actionEdit(a => { if (a.kind === "status") a.status = e.target.value as "stun"; })}><option value="stun">기절</option><option value="poison">중독</option><option value="seal">책략 금지</option><option value="immobilize">이동 금지</option></select></label><NumberField label="지속 차례" min={1} max={20} value={action.turns} change={n => actionEdit(a => { if (a.kind === "status") a.turns = n; })} /></>}
            {action.kind === "weather" && <label>날씨<select value={action.weather} onChange={e => actionEdit(a => { if (a.kind === "weather") a.weather = e.target.value as "rain"; })}><option value="clear">맑음</option><option value="rain">비</option><option value="cloudy">흐림</option></select></label>}
            {action.kind === "reinforcement" && <label>기존 증원 그룹<select value={action.reinforcementId} onChange={e => actionEdit(a => { if (a.kind === "reinforcement") a.reinforcementId = e.target.value; })}><option value="">선택</option>{groups.map(g => <option key={g.id} value={g.id}>{g.id}</option>)}</select></label>}
            <div className="studio-event-buttons"><button disabled={ai === 0} onClick={() => update(v => { [v.actions[ai - 1], v.actions[ai]] = [v.actions[ai]!, v.actions[ai - 1]!]; })}>위로</button><button disabled={ai === event.actions.length - 1} onClick={() => update(v => { [v.actions[ai + 1], v.actions[ai]] = [v.actions[ai]!, v.actions[ai + 1]!]; })}>아래로</button><button onClick={() => update(v => { v.actions.splice(ai, 1); })}>실행 삭제</button></div>
          </div>;
        })}
        <button onClick={() => update(v => { v.actions.push(newAction("message")); })}>＋ 실행 추가</button><button onClick={() => modify(list => { list.splice(index, 1); })}>사건 삭제</button>
        {!parsed.success && <p role="alert">입력값을 확인해 주세요: {parsed.error.issues.map(i => `${i.path.join(".")}: ${i.message}`).join(" · ")}</p>}
      </details>;
    })}
  </section>;
}
