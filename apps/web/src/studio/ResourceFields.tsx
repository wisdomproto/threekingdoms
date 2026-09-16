import BattleEventEditor from "./BattleEventEditor";
import StoryPreview from "./StoryPreview";
import type { AuthoringProject, ChapterStage } from "@tk/data/authoring-project";
type Data = Record<string, unknown>;
const isObject = (value: unknown): value is Data => !!value && typeof value === "object" && !Array.isArray(value);

export default function ResourceFields({ project, node, edit, advanced = false }: {
  project: AuthoringProject; node?: ChapterStage; advanced?: boolean; edit: (fn: (p: AuthoringProject) => void, group?: string) => void;
}) {
  if (!node) return <p>편집할 단계를 선택해 주세요.</p>;
  if (node.kind === "battle") {
    const battle = project.battles.find((b) => b.id === node.resourceId);
    if (!battle) return <p>오른쪽에서 전투를 연결해 주세요.</p>;
    const update = (fn: (data: Data) => void, group?: string) => edit((p) => fn(p.battles.find((b) => b.id === battle.id)!.data), group);
    const units = Array.isArray(battle.data.units) ? battle.data.units as Data[] : [];
    return <div className="studio-resource"><div className="studio-resource-heading"><span className="studio-resource-icon">戰</span><div><small>전투 시나리오</small><h3>{String(battle.data.name)}</h3><p>전투의 기본 설정과 초기 배치를 편집합니다.</p></div></div><div className="studio-form-grid"><label>전투 이름<input value={String(battle.data.name ?? "")} onChange={(e) => update((d) => { d.name = e.target.value; }, `battle-name-${battle.id}`)}/></label><label>턴 제한<input type="number" min="1" value={typeof battle.data.turnLimit === "number" ? battle.data.turnLimit : ""} onChange={(e) => update((d) => { d.turnLimit = e.target.value === "" ? null : Number(e.target.value); }, `battle-turn-${battle.id}`)}/></label><label>사용할 맵<select value={String(battle.data.mapId ?? "")} onChange={(e) => update((d) => { d.mapId = e.target.value; })}>{project.maps.map((m) => <option key={m.id} value={String(m.data.id)}>{String(m.data.name ?? m.data.id)}</option>)}</select></label></div><details open={advanced}><summary>초기 배치 수치 · 고급 설정</summary><h3>초기 배치 <span className="studio-badge">{units.length}명</span></h3><p className="studio-note">좌표는 0부터 시작합니다. 전투 중 대사·목표·증원·보상은 그대로 보존됩니다.</p><div className="studio-unit-list">{units.map((unit, i) => isObject(unit) && <div key={i}><strong>{String(unit.commanderId ?? `유닛 ${i + 1}`)}<small>{unit.side === "player" ? "아군" : unit.side === "ally" ? "우군" : "적군"}</small></strong>{["x", "y", "level"].map((field) => <label key={field}>{field === "level" ? "레벨" : field.toUpperCase()}<input aria-label={`유닛 ${i + 1} ${field}`} type="number" value={typeof unit[field] === "number" ? unit[field] as number : ""} onChange={(e) => update((d) => { (d.units as Data[])[i]![field] = e.target.value === "" ? null : Number(e.target.value); }, `unit-${battle.id}-${i}-${field}`)}/></label>)}</div>)}</div></details><BattleEventEditor project={project} battleId={battle.id} edit={edit} /></div>;
  }
  const scene = project.scenes.find((s) => s.id === node.resourceId);
  if (!scene) return <p>오른쪽에서 스토리를 연결해 주세요.</p>;
  const parts = Array.isArray(scene.data) ? scene.data : [scene.data];
  const updatePart = (index: number, fn: (part: Data) => void, group?: string) => edit((p) => {
    const data = p.scenes.find((s) => s.id === scene.id)!.data;
    const part = Array.isArray(data) ? data[index] : data;
    if (isObject(part)) fn(part);
  }, group);
  return <div className="studio-resource"><div className="studio-resource-heading"><span className="studio-resource-icon story-icon">話</span><div><small>스토리 장면</small><h3>{node.name}</h3><p>화자를 비워두면 내레이션으로 표시됩니다.</p></div></div>{parts.map((part, pi) => {
    if (!isObject(part) || part.kind === "comic" || part.kind === "map" || typeof part.map === "string" || !Array.isArray(part.lines)) return <div className="studio-preserved" key={pi}>{isObject(part) && <StoryPreview part={part} />}<h3>장면 {pi + 1} · 고급 연출</h3><p>위의 장면 편집 버튼에서 캐릭터 배치와 이동·대사를 편집하세요.</p></div>;
    const lines = part.lines as Data[];
    return <section className="studio-scene-part" key={pi}><StoryPreview part={part} /><div className="studio-section-title"><h3>장면 {pi + 1}</h3><span>{lines.length}개 대사</span></div><label>배경 이미지 이름<input value={String(part.bg ?? "")} placeholder="배경 에셋 이름" onChange={(e) => updatePart(pi, (d) => { d.bg = e.target.value; }, `bg-${scene.id}-${pi}`)}/></label>{lines.map((line, li) => isObject(line) && <div className="studio-dialogue-line" key={li}><div className="studio-section-title"><span className="studio-line-number">{String(li + 1).padStart(2, "0")}</span><button aria-label={`장면 ${pi + 1} 대사 ${li + 1} 삭제`} onClick={() => updatePart(pi, (d) => { (d.lines as Data[]).splice(li, 1); })}>삭제</button></div><label>화자<input placeholder="내레이션" value={String(line.speaker ?? "")} onChange={(e) => updatePart(pi, (d) => { const l = (d.lines as Data[])[li]!; if (e.target.value) l.speaker = e.target.value; else delete l.speaker; }, `speaker-${scene.id}-${pi}-${li}`)}/></label><label>대사<textarea rows={3} value={String(line.text ?? "")} onChange={(e) => updatePart(pi, (d) => { (d.lines as Data[])[li]!.text = e.target.value; }, `text-${scene.id}-${pi}-${li}`)}/></label></div>)}<button onClick={() => updatePart(pi, (d) => { (d.lines as Data[]).push({ text: "" }); })}>＋ 대사 추가</button></section>;
  })}</div>;
}
