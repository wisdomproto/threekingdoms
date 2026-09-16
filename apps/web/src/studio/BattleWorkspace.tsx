import { useState } from "react";
import type { AuthoringProject, ChapterStage } from "@tk/data/authoring-project";
import ResourceFields from "./ResourceFields";
import { addBattleStory, storyLabels, type StorySlot } from "./battle-story";

export default function BattleWorkspace({ project, chapterId, node, edit, openDetail, openAdvanced }: {
  project: AuthoringProject; chapterId?: string; node?: ChapterStage;
  edit: (fn: (p: AuthoringProject) => void, group?: string) => void;
  openDetail: (node: ChapterStage) => Promise<void>; openAdvanced: () => void;
}) {
  const [tab, setTab] = useState<StorySlot>("intro");
  const battle = node?.kind === "battle" ? project.battles.find(b => b.id === node.resourceId) : undefined;
  if (!battle || !node) return <div className="studio-empty"><h2>왼쪽에서 전투를 선택하세요</h2><p>각 전투에서 전후 이야기와 전투 설정을 편집합니다.</p><button onClick={openAdvanced}>시나리오 연결 페이지 열기</button></div>;
  const sceneId = battle.sceneSlots[tab];
  const target: ChapterStage = {
    id: `slot:${battle.id}:${tab}`, kind: "scene", name: storyLabels[tab], resourceId: sceneId ?? null, next: {},
  };
  const exists = !!project.scenes.find(s => s.id === sceneId);
  return <>
    <div className="studio-tabs studio-battle-tabs" role="tablist" aria-label="전투 편집">
      {(["intro", "outro", "outroDefeat"] as const).map(key => <button key={key} role="tab" aria-selected={tab === key} onClick={() => setTab(key)}>{storyLabels[key]}</button>)}
    </div>
    {exists ? <>
      <div className="studio-detail-launch"><button className="primary" onClick={() => void openDetail(target)}>대사·맵 장면·만화 편집 →</button><p>이 전투의 이야기를 순서대로 편집합니다.</p></div>
      <ResourceFields project={project} node={target} edit={edit} />
    </> : <div className="studio-empty"><h3>{storyLabels[tab as StorySlot]}</h3><p>{sceneId ? "연결된 이야기 리소스를 찾을 수 없습니다. 고급 모드에서 연결을 확인해 주세요." : "아직 이야기가 없습니다. 필요한 경우 추가하세요."}</p>
      {sceneId ? <button onClick={openAdvanced}>시나리오 연결 페이지에서 확인</button> : <button className="primary" onClick={() => edit(p => addBattleStory(p, battle.id, tab as StorySlot, crypto.randomUUID(), () => crypto.randomUUID()))}>＋ 이야기 만들기</button>}
    </div>}
  </>;
}
