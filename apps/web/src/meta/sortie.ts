/**
 * 출진(出陣) 페이로드 — 막간 편성 → 전투 진입의 전달 계약.
 *
 * M1 메커니즘(설계 §16 수직 완성, 사수관 1스테이지):
 *  - 편성 화면이 SortiePayload를 만들어 sessionStorage `tk.sortie`에 저장하고 /battle 로 이동.
 *  - BattleScreen이 진입 시 readSortie()로 읽어, stage.units의 **player 슬롯을 override**한다.
 *  - 좌표(x,y)는 stage JSON의 player 슬롯을 **그대로 재사용**(M1은 배치 UI 없음). 편성은
 *    각 슬롯에 들어갈 commander/class/level/exp/items만 주입한다. 슬롯 수만큼 앞에서부터 매핑.
 *  - 페이로드가 없으면 BattleScreen은 기존 동작(stage JSON 그대로) — 전투 테스트 회귀 방지.
 *
 * sessionStorage를 쓰는 이유: 출진은 1회성 전이 상태(새로고침/뒤로가기로 만료돼도 됨)이고
 * URL 쿼리에 편성 전체를 싣기엔 크다. stageId는 가독성을 위해 쿼리(?stage=)로도 함께 전달.
 */
import type { Stage } from "@tk/data";

const SORTIE_KEY = "tk.sortie";

/** 편성된 한 장수의 전투 주입 데이터(좌표 제외 — 좌표는 stage 슬롯 재사용). */
export interface SortieMember {
  commanderId: string;
  classId: string;
  level: number;
  exp: number;
  /** 장착 아이템 itemId — StageUnit.items로 주입. */
  items: string[];
  /** 기본 병력(troops). 미지정 시 BattleScreen이 stage 슬롯 기본값 유지. */
  troops?: number;
}

/** 출진 1건. stageId + 편성된 player 유닛 목록. */
export interface SortiePayload {
  stageId: string;
  members: SortieMember[];
}

function hasSession(): boolean {
  return typeof window !== "undefined" && typeof window.sessionStorage !== "undefined";
}

/** 편성 화면이 출진 버튼에서 호출 — 페이로드 저장 후 호출부가 router.push('/battle?stage=…'). */
export function writeSortie(payload: SortiePayload): void {
  if (!hasSession()) return;
  try {
    window.sessionStorage.setItem(SORTIE_KEY, JSON.stringify(payload));
  } catch {
    // 저장 실패 — BattleScreen은 페이로드 없음으로 간주(기존 동작).
  }
}

/** BattleScreen 진입점이 호출 — 없거나 파싱 실패면 null(= override 안 함, 기존 동작). */
export function readSortie(): SortiePayload | null {
  if (!hasSession()) return null;
  try {
    const raw = window.sessionStorage.getItem(SORTIE_KEY);
    if (raw == null) return null;
    const parsed = JSON.parse(raw) as Partial<SortiePayload>;
    if (typeof parsed.stageId !== "string" || !Array.isArray(parsed.members)) return null;
    return parsed as SortiePayload;
  } catch {
    return null;
  }
}

/** 1회성 소비 — 전투 진입 후 제거(새로고침 재진입 시 stale 편성 방지). */
export function clearSortie(): void {
  if (!hasSession()) return;
  try {
    window.sessionStorage.removeItem(SORTIE_KEY);
  } catch {
    // 무시.
  }
}

/**
 * 순수 변환(node 테스트 대상) — stage + 편성으로 override된 stage units를 만든다.
 * player 슬롯을 앞에서부터 members로 매핑하고(좌표 유지), enemy/잉여 슬롯은 그대로 둔다.
 * members가 player 슬롯보다 많으면 잉여는 버린다(M1 좌표 슬롯이 상한).
 * members가 비었거나 player 슬롯이 없으면 stage.units를 그대로 반환.
 */
export function applySortieToStage(stage: Stage, members: SortieMember[]): Stage["units"] {
  if (members.length === 0) return stage.units;
  let memberIdx = 0;
  const units = stage.units.map((u) => {
    if (u.side !== "player") return u;
    if (memberIdx >= members.length) return u; // 편성이 모자라면 남은 슬롯 원본 유지
    const m = members[memberIdx++]!;
    return {
      ...u,
      commanderId: m.commanderId,
      classId: m.classId,
      level: m.level,
      items: [...m.items],
      ...(m.troops != null ? { troops: m.troops } : {}),
    };
  });
  return units;
}
