/**
 * 에디터 플레이테스트 스냅샷(spec 2026-09-12-editor-playtest-design §4) → LabPayload.
 * 서버 드래프트 파일 `/_draft/{draftId}.json` 의 내용을 검증한다. DOM·Next 무관(순수) — node 테스트 대상.
 * 스테이지/맵은 zod 로 검증해 "실행 최소 조건" 을 실제로 검사한다(첫 이슈의 경로·메시지를 돌려준다).
 */
import { StageSchema, BattleMapSchema } from "@tk/data";
import type { LabPayload } from "./lab";

export const PLAYTEST_KIND = "tk-playtest-snapshot";
export const PLAYTEST_VERSION = 1;

export interface PlaytestSnapshot {
  kind: typeof PLAYTEST_KIND;
  version: typeof PLAYTEST_VERSION;
  draftId: string;
  revision: number;
  stage: unknown;
  map: unknown;
  seed: number;
  returnUrl?: string;
  savedAt: string;
}

export type PlaytestParseResult =
  | { ok: true; payload: LabPayload }
  | { ok: false; message: string };

function firstIssue(error: { issues: Array<{ path: (string | number)[]; message: string }> }): string {
  const i = error.issues[0];
  return i ? `${i.path.map(String).join(".") || "(root)"}: ${i.message}` : "알 수 없는 검증 오류";
}

export function parsePlaytestSnapshot(json: unknown): PlaytestParseResult {
  if (!json || typeof json !== "object") return { ok: false, message: "드래프트가 JSON 객체가 아닙니다" };
  const s = json as Partial<PlaytestSnapshot>;
  if (s.kind !== PLAYTEST_KIND || s.version !== PLAYTEST_VERSION) {
    return { ok: false, message: `드래프트 형식이 다릅니다 (kind=${String(s.kind)}, version=${String(s.version)}) — 에디터에서 ▶ 테스트를 다시 누르세요` };
  }
  const stage = StageSchema.safeParse(s.stage);
  if (!stage.success) return { ok: false, message: `스테이지 검증 실패 — ${firstIssue(stage.error)}` };
  const map = BattleMapSchema.safeParse(s.map);
  if (!map.success) return { ok: false, message: `맵 검증 실패 — ${firstIssue(map.error)}` };
  // 에디터의 자체 validate()를 신뢰하지 않는다 — 트러스트 바운더리에서 다시 교차검증.
  if (stage.data.mapId !== map.data.id) {
    return { ok: false, message: `스테이지 mapId(${stage.data.mapId})와 맵 id(${map.data.id})가 다릅니다` };
  }
  const seed = typeof s.seed === "number" ? s.seed : 1; // 에디터는 항상 1을 보낸다 — 폴백은 방어용.
  const payload: LabPayload = { stage: stage.data, map: map.data, sharedItems: [], seed };
  if (typeof s.returnUrl === "string" && s.returnUrl) payload.returnUrl = s.returnUrl;
  return { ok: true, payload };
}

/** `/playtest?scene=` 값 → 씬 슬롯 키. 그 외(null 포함) = 전투로. (P2 spec §6) */
export type SceneKey = "intro" | "outro" | "outroDefeat";
export function parseSceneParam(v: string | null): SceneKey | null {
  return v === "intro" || v === "outro" || v === "outroDefeat" ? v : null;
}
