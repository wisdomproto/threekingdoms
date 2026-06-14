/**
 * 목표/패배조건 → 한국어 명령형 텍스트 (인배틀 목표 오버레이용, 순수 함수).
 *
 * 레퍼런스(yeonggeoljeon-remake-ux-analysis.md §14, g0227)의 충실 복제:
 *   "승리조건 / 여포를 퇴각시켜라! / 제한 턴 수 20" 식의 **간결 명령형**.
 * 우리는 같은 정보 위계·문구 형식을 그대로 따르되 텍스트만 생성한다(아트 스킨은 ObjectiveBanner 담당).
 *
 * React/Pixi 무관 — node에서 단위 테스트 가능. 이름 해석은 주입된 nameOf(id)로만 한다
 * (스테이지 unitId가 한국어 이름 키 = commanders 키와 동치이므로 폴백은 id 그대로).
 *
 * ⚠️ engine/schemas 의존 금지(소유 경계). 타입은 @tk/data의 Objective/FailCondition만 type-import.
 */
import type { Objective, FailCondition } from "@tk/data";

/** 한글 음절의 받침(종성) 유무 — 조사 선택용. 비한글 문자는 받침 없음으로 본다(이름 끝이 한글이 아닐 때 안전). */
export function hasFinalConsonant(word: string): boolean {
  if (!word) return false;
  const code = word.charCodeAt(word.length - 1);
  // 한글 음절 영역 (가 0xAC00 ~ 힣 0xD7A3): (code-0xAC00) % 28 !== 0 이면 받침 있음.
  if (code < 0xac00 || code > 0xd7a3) return false;
  return (code - 0xac00) % 28 !== 0;
}

/** 목적격 조사 을/를 */
export function objectParticle(word: string): "을" | "를" {
  return hasFinalConsonant(word) ? "을" : "를";
}

/** 방향격 조사 으로/로 (받침 'ㄹ'은 예외적으로 '로'를 쓰지만, 좌표/지명엔 영향 미미 — 표준 규칙만 적용) */
export function directionParticle(word: string): "으로" | "로" {
  if (!word) return "로";
  const code = word.charCodeAt(word.length - 1);
  if (code < 0xac00 || code > 0xd7a3) return "로";
  const jong = (code - 0xac00) % 28;
  // 받침 없음(0) 또는 받침이 'ㄹ'(8) 이면 '로', 그 외 받침은 '으로'
  return jong === 0 || jong === 8 ? "로" : "으로";
}

/** 좌표를 사람이 읽는 지점 라벨로 — 별도 지명이 없을 때의 폴백. */
function tileLabel(x: number, y: number): string {
  return `(${x}, ${y})`;
}

export interface ObjectiveTextOptions {
  /** unitId → 표시 이름. 미지정/미등록 id는 id 그대로(스테이지 unitId가 한국어 이름). */
  nameOf?: (id: string) => string;
  /** reachTile 등 좌표 목표의 목적지 지명(예: "성문"). 없으면 좌표 라벨. */
  tileNameOf?: (x: number, y: number) => string | undefined;
}

function name(id: string, opts?: ObjectiveTextOptions): string {
  return opts?.nameOf?.(id) ?? id;
}

/**
 * 단일 목표 → 명령형 한 줄.
 *  - defeatUnit  화웅      → "화웅을 쓰러뜨려라!"
 *  - defeatAll               → "적을 전멸시켜라!"
 *  - surviveTurns N          → "N턴을 버텨라!"
 *  - reachTile  유비→성문    → "유비를 성문으로 탈출시켜라!" (unitId 없으면 "○○로 진군하라!")
 *  - captureTile (x,y)       → "○○를 점령하라!"
 */
export function objectiveText(obj: Objective, opts?: ObjectiveTextOptions): string {
  switch (obj.kind) {
    case "defeatUnit": {
      const n = name(obj.unitId, opts);
      return `${n}${objectParticle(n)} 쓰러뜨려라!`;
    }
    case "defeatAll":
      return "적을 전멸시켜라!";
    case "surviveTurns":
      return `${obj.turns}턴을 버텨라!`;
    case "reachTile": {
      const dest = opts?.tileNameOf?.(obj.x, obj.y) ?? tileLabel(obj.x, obj.y);
      if (obj.unitId) {
        const n = name(obj.unitId, opts);
        return `${n}${objectParticle(n)} ${dest}${directionParticle(dest)} 탈출시켜라!`;
      }
      return `${dest}${directionParticle(dest)} 진군하라!`;
    }
    case "captureTile": {
      const dest = opts?.tileNameOf?.(obj.x, obj.y) ?? tileLabel(obj.x, obj.y);
      return `${dest}${objectParticle(dest)} 점령하라!`;
    }
  }
}

/**
 * 단일 패배조건 → 한 줄.
 *  - unitRetreated 유비          → "유비 퇴각 시 패배"
 *  - allRetreated [백성1,백성2]  → "백성 전멸 시 패배" (호위 대상 전부 퇴각)
 *  - turnLimitExceeded            → "제한 턴 초과 시 패배"
 */
export function failConditionText(fc: FailCondition, opts?: ObjectiveTextOptions): string {
  switch (fc.kind) {
    case "unitRetreated":
      return `${name(fc.unitId, opts)} 퇴각 시 패배`;
    case "allRetreated": {
      const names = fc.unitIds.map((id) => name(id, opts));
      const label = names.length === 1 ? names[0] : `${names[0]} 등`;
      return `${label} 전멸 시 패배`;
    }
    case "turnLimitExceeded":
      return "제한 턴 초과 시 패배";
  }
}

/** 레거시 victory(objectives 미지정 스테이지) → 명령형 한 줄. */
export function legacyVictoryText(
  victory: { kind: "defeatAll" } | { kind: "defeatUnit"; unitId: string },
  opts?: ObjectiveTextOptions,
): string {
  if (victory.kind === "defeatAll") return objectiveText({ kind: "defeatAll", optional: false }, opts);
  return objectiveText({ kind: "defeatUnit", unitId: victory.unitId, optional: false }, opts);
}

/** 레거시 defeat(failConditions 미지정 스테이지) → 한 줄. */
export function legacyDefeatText(
  defeat: { kind: "lordRetreat"; unitId: string },
  opts?: ObjectiveTextOptions,
): string {
  return failConditionText({ kind: "unitRetreated", unitId: defeat.unitId }, opts);
}

/** 제한 턴 보조 라벨 — 상시 띠 꼬리표(레퍼런스 "제한 턴 수 20"). */
export function turnLimitText(turnLimit: number): string {
  return `제한 ${turnLimit}턴`;
}

/** ObjectiveBanner가 소비하는 정리된 표시 모델. */
export interface ObjectiveDisplay {
  /** 필수 승리 목표 명령형 줄들(optional:true 보너스 목표 제외). */
  primary: string[];
  /** 보너스(optional) 목표 명령형 줄들 — 작게/부가 표시용. */
  bonus: string[];
  /** 패배 조건 줄들. */
  fails: string[];
  /** "제한 N턴" 꼬리표(turnLimit 항상 존재). */
  turnLimit: string;
}

/** 목표 표시에 필요한 스테이지 최소 형태 — 전체 Stage 타입 없이도 호출 가능(테스트 용이). */
export interface StageObjectiveLike {
  turnLimit: number;
  objectives?: Objective[];
  failConditions?: FailCondition[];
  victory?: { kind: "defeatAll" } | { kind: "defeatUnit"; unitId: string };
  defeat?: { kind: "lordRetreat"; unitId: string };
}

/**
 * 스테이지(또는 vm 보강용)에서 배너 표시 모델을 만든다.
 * objectives가 있으면 그것을, 없으면 레거시 victory/defeat로 폴백(스키마 하위호환 절과 동일 규칙).
 */
export function buildObjectiveDisplay(
  stage: StageObjectiveLike,
  opts?: ObjectiveTextOptions,
): ObjectiveDisplay {
  const primary: string[] = [];
  const bonus: string[] = [];
  const fails: string[] = [];

  if (stage.objectives && stage.objectives.length > 0) {
    for (const o of stage.objectives) {
      const line = objectiveText(o, opts);
      // 모든 Objective variant는 optional 필드를 갖는다(스키마 default false).
      if ("optional" in o && o.optional) bonus.push(line);
      else primary.push(line);
    }
  } else if (stage.victory) {
    primary.push(legacyVictoryText(stage.victory, opts));
  }

  if (stage.failConditions && stage.failConditions.length > 0) {
    for (const f of stage.failConditions) fails.push(failConditionText(f, opts));
  } else if (stage.defeat) {
    fails.push(legacyDefeatText(stage.defeat, opts));
  }

  return { primary, bonus, fails, turnLimit: turnLimitText(stage.turnLimit) };
}
