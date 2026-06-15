/**
 * 에셋 매니페스트 수집 (W1 — 캠페인 루프) — 순수. 스테이지 scenario/dialogue/units에서
 * 필요한 이미지(초상·씬 배경·맵 배경)를 모은다. CLI(asset-manifest)가 존재여부를 붙여 md로 굽는다.
 *
 * "모든 에셋은 생성 출력물"(§2-7) — 이 목록이 길중의 "이 이미지 만들어주세요" 요청서가 된다.
 */
import type { Stage, Commander } from "@tk/data";

export interface PortraitReq {
  id: string; // commanderId(=portraitId 규약)
  name: string;
  firstStage: string; // 최초 등장 스테이지 id
}
export interface SceneReq {
  bgId: string;
  stageId: string;
  type: "intro" | "outro" | "outroDefeat";
  firstLine: string; // 장면 맥락(프롬프트 힌트)
}
export interface MapReq {
  stageId: string;
  mapId: string;
}

export interface RequiredAssets {
  portraits: PortraitReq[];
  scenes: SceneReq[];
  maps: MapReq[];
}

function stageNum(id: string): number {
  const n = Number.parseInt(id.slice(0, id.indexOf("-")), 10);
  return Number.isFinite(n) ? n : 999;
}

/** 스테이지·장수 데이터에서 필요한 에셋 집합을 수집(결정론, 스테이지 번호순). */
export function collectRequiredAssets(
  stages: Record<string, Stage>,
  commanders: Record<string, Commander>,
): RequiredAssets {
  const ordered = Object.values(stages).sort((a, b) => stageNum(a.id) - stageNum(b.id));

  const portraitFirst = new Map<string, string>(); // id → firstStage
  const scenes: SceneReq[] = [];
  const maps: MapReq[] = [];
  const seenMap = new Set<string>();

  const notePortrait = (id: string | undefined, stageId: string) => {
    if (!id) return;
    if (!portraitFirst.has(id)) portraitFirst.set(id, stageId);
  };

  for (const st of ordered) {
    // 맵(스테이지별 1개)
    if (!seenMap.has(st.id)) {
      seenMap.add(st.id);
      maps.push({ stageId: st.id, mapId: st.mapId });
    }
    // 전투 유닛 초상
    for (const u of st.units) notePortrait(u.commanderId, st.id);
    // 전투 내 대사 초상
    for (const d of st.dialogue ?? []) for (const l of d.lines) notePortrait(l.portraitId ?? l.speaker, st.id);
    // 막간 시나리오 — 씬 배경 + 화자 초상
    const sc = st.scenario;
    if (sc) {
      for (const type of ["intro", "outro", "outroDefeat"] as const) {
        const scene = sc[type];
        if (!scene) continue;
        if (scene.bg) scenes.push({ bgId: scene.bg, stageId: st.id, type, firstLine: scene.lines[0]?.text ?? "" });
        for (const l of scene.lines) notePortrait(l.portraitId ?? l.speaker, st.id);
      }
    }
  }

  const portraits: PortraitReq[] = [...portraitFirst.entries()]
    .map(([id, firstStage]) => ({ id, name: commanders[id]?.name ?? id, firstStage }))
    .sort((a, b) => stageNum(a.firstStage) - stageNum(b.firstStage) || a.id.localeCompare(b.id));

  return { portraits, scenes, maps };
}
