// tools/editor/story-model.js — Story Editor 순수 헬퍼 (DOM 무관). spec 2026-09-12-creator-ux-p2-design §5
// 데이터 모양 = packages/data/src/schemas.ts (ScenarioScene · SceneSlot · StageDialogue · DialogueTrigger).

const id = (x) => String(x);

/** 트리거 → 사람 말. nameOf(unitId)·duelLabel(duelId) 는 호출측이 준다(기본 = id 그대로). */
export function describeTrigger(trigger, nameOf = id, duelLabel = id) {
  switch (trigger?.kind) {
    case "battleStart": return "전투가 시작되면";
    case "turn": return `${trigger.n}턴이 시작되면`;
    case "unitRetreated": return `${nameOf(trigger.unitId)}이(가) 퇴각하면`;
    case "duelOccurred": return `일기토 ${duelLabel(trigger.duelId)}이(가) 일어나면`;
    case "battleEnd":
      return trigger.result === "victory" ? "전투에서 이기면" : trigger.result === "defeat" ? "전투에서 지면" : "전투가 끝나면";
    default: return String(trigger?.kind ?? "?");
  }
}

/** "dlg-N" — 기존 dlg-숫자 중 최대 +1 (비정형 id 는 무시하되 충돌은 피한다). */
export function newDialogueId(existing) {
  const used = new Set(existing);
  let n = 0;
  for (const e of used) { const m = /^dlg-(\d+)$/.exec(e); if (m) n = Math.max(n, Number(m[1])); }
  let cand;
  do cand = `dlg-${++n}`; while (used.has(cand));
  return cand;
}

/** 씬 줄 — speaker 없으면 내레이션(키 자체 없음), 있으면 portraitId 기본 = 화자(기존 데이터 관행). */
export function newSceneLine(speaker) {
  return speaker ? { speaker, portraitId: speaker, text: "" } : { text: "" };
}

/** 새 VN 파트 — bg 는 비어 있지 않을 때만 쓰므로 키 없음. */
export function newVnPart() {
  return { lines: [newSceneLine()] };
}

/** 슬롯 정규화(schemas normalizeSceneSlot 과 동형) — 없음 → [], 단일 VN → [vn], 배열 → 그대로. */
export function slotParts(slot) {
  if (slot === undefined || slot === null) return [];
  return Array.isArray(slot) ? slot : [slot];
}

export const isMapScene = (part) => !!part && typeof part === "object" && "map" in part;

/** rail 부제 "컷신 N" = intro + outro 파트 수. */
export function sceneCount(stage) {
  const sc = stage?.scenario ?? {};
  return slotParts(sc.intro).length + slotParts(sc.outro).length;
}

/** 전 스테이지 scenario 의 배경 키(파트 bg + 줄 bg) — 정렬·중복 제거. datalist 용. */
export function collectSceneBgs(stages) {
  const out = new Set();
  for (const st of stages) {
    for (const slot of Object.values(st?.scenario ?? {})) {
      for (const part of slotParts(slot)) {
        if (isMapScene(part)) continue;
        if (part.bg) out.add(part.bg);
        for (const l of part.lines ?? []) if (l.bg) out.add(l.bg);
      }
    }
  }
  return [...out].sort();
}
