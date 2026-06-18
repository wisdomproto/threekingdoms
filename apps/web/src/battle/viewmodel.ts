/**
 * HUD용 셀렉터 (설계 §2.1 viewmodel) — 전부 settledState 기준 순수 함수.
 * committed가 연출보다 앞서가도 HUD 수치는 드레인 시점(settled)에만 갱신된다 — 스포일러 차단.
 * 반환값은 전부 직렬화 가능한 평면 객체 (useSyncExternalStore 스냅샷에 그대로 실린다).
 */
import type { ClassGrades, Side } from "@tk/data";
import { terrainAt, attackPower, defensePower, spiritPower } from "@tk/engine";
import type { BattleContext, BattleState, UnitState, PendingReward } from "@tk/engine";

/** 장비 탭 1행 — unit.items를 gameData.items 효과로 해석한 표시용 (UnitPanel §8 장비탭) */
export interface ItemVM {
  id: string;
  name: string;
  category: string;
  /** 사람이 읽는 효과 요약 (예: "공격 +15%", "회복 80", "특수") */
  effect: string;
}

/** 책략 탭 1행 — 병종 strategies를 gameData.strategies로 해석 (UnitPanel §8 책략탭) */
export interface StrategyVM {
  id: string;
  name: string;
  mp: number;
  category: string;
  target: "enemy" | "ally";
}

export interface UnitVM {
  id: string;
  name: string;
  className: string;
  side: Side;
  level: number;
  x: number;
  y: number;
  troops: number;
  maxTroops: number;
  mp: number;
  maxMp: number;
  sp: number;       // 필살 게이지(현재) — §9
  maxSp: number;    // 필살 게이지 상한(레퍼런스 255)
  moved: boolean;
  acted: boolean;
  retreated: boolean;
  // 조조전 장수 정보 패널 대응 (sosoden-battle-ux-analysis §1·§6)
  // 부대 능력치(전투에 실제로 쓰이는 값) = floor(장수능력/2) + 성장. 장수 원값은 *Stat에 보존.
  atk: number;          // 부대 공격력 (← 무력)
  def: number;          // 부대 방어력 (← 통솔)
  spirit: number;       // 부대 정신력 (← 지력)
  warStat: number;      // 장수 무력 (원값)
  leadershipStat: number;
  intelligenceStat: number;
  move: number;         // 이동력
  rangeMin: number;
  rangeMax: number;
  terrainName: string;  // 현재 칸 지형명
  terrainGuard: number; // 지형 방어 보정 (0~0.5)
  // ── 장수 패널 탭화(Tier 3 §8). 전부 optional — 기존 UnitVM 리터럴(테스트 등) 무파손 ──
  classId?: string;             // 병종 id (특성/책략 탭 lookup 키)
  grades?: ClassGrades;         // 병종 5스탯 등급 [공·방·정·순·사] (특성 탭 뱃지)
  traitText?: string;           // 병종 상성/약점 설명문 (§8 부대특성 — lineAdvantage 파생)
  passiveText?: string;         // 병종 패시브 설명문 (§7 — combat.passives 파생, 없으면 미설정)
  doubleStrikeText?: string;    // 연속공격 표기 (§7 — 이동력 우위 시. 빠른 병종만 설정)
  equipment?: ItemVM[];         // 소지품(장비/소모품) 해석 목록 (장비 탭)
  strategies?: StrategyVM[];    // 병종 보유 책략 해석 목록 (책략 탭)
}

/** §7 장착 효과(말·보물) 요약 — 사람이 읽는 토막들 */
function effectParts(e?: {
  move?: number; atkPercent?: number; spiritPercent?: number; defensePercent?: number; doubleStrike?: boolean;
}): string[] {
  if (!e) return [];
  const out: string[] = [];
  if (e.move) out.push(`기동 +${e.move}`);
  if (e.atkPercent) out.push(`공격 +${e.atkPercent}%`);
  if (e.spiritPercent) out.push(`정신 +${e.spiritPercent}%`);
  if (e.defensePercent) out.push(`받는 피해 −${e.defensePercent}%`);
  if (e.doubleStrike) out.push("연속공격");
  return out;
}

/** 도구/장비 효과 요약 문구 — category + power/bonusPercent + 장착 효과(effects)를 한 줄로 */
function itemEffect(
  category: string, power: number, bonusPercent: number,
  effects?: Parameters<typeof effectParts>[0],
): string {
  const extra = effectParts(effects);
  const join = (base: string): string => [base, ...extra].filter(Boolean).join(" · ");
  switch (category) {
    case "weapon":
      return join(bonusPercent > 0 ? `공격 +${bonusPercent}%` : "무기");
    case "book":
      return join(bonusPercent > 0 ? `정신 +${bonusPercent}%` : "병법서");
    case "horse":
      return extra.length ? extra.join(" · ") : "기동";
    case "supplyItem":
      return power < 255 ? `회복 ${power}` : "회복";
    case "attackItem":
      return power < 255 ? `피해 ${power}` : "공격 도구";
    case "treasure":
      return extra.length ? extra.join(" · ") : "보물";
    default:
      return "기타";
  }
}

export interface TurnVM {
  turn: number;
  turnLimit: number;
  phase: Side;
}

export interface BattleVM {
  turn: TurnVM;
  status: BattleState["status"];
  units: UnitVM[];
  /** 전략조건으로 적립된 보상(보물·자금) — 결산에서 stage.reward와 병합·중복제거(M3① §2-1) */
  pendingRewards: PendingReward[];
  /** 이번 전투에서 레벨업한 유닛 목록 — 결산 레벨업 연출용 */
  levelUps: { unitId: string; newLevel: number }[];
}

/** line(병종 계열) 한글명 */
const LINE_KO: Record<string, string> = {
  infantry: "보병계",
  cavalry: "기병계",
  archer: "궁병계",
  bandit: "산적계",
  support: "보조계",
};

/**
 * 병종 상성/약점 설명문 (§8 "병종 설명문 + <특성:…>") — combat.lineAdvantage에서 *파생*.
 * 손수 작성한 21개 문자열 대신 엔진의 실제 상성 규칙을 그대로 풀어써 항상 일치한다.
 *   lineAdvantage[X] = Y → X는 Y에 강함. 역참조로 X에 강한 계열 = X가 약한 상대.
 *   rangeMax>1 = 간접 공격(무반격, §7).
 */
function classTraitText(
  line: string,
  lineAdvantage: Record<string, string>,
  rangeMax: number,
): string {
  const ko = (l: string): string => LINE_KO[l] ?? l;
  const strongVs = lineAdvantage[line];
  const weakTo = Object.entries(lineAdvantage).find(([, v]) => v === line)?.[0];
  const rel: string[] = [];
  if (strongVs) rel.push(`${ko(strongVs)}에 강함`);
  if (weakTo) rel.push(`${ko(weakTo)}에 약함`);
  let s = rel.length ? `${ko(line)} — ${rel.join(" · ")}.` : `${ko(line)} — 상성 보정 없음.`;
  if (rangeMax > 1) s += " 간접 공격이라 반격을 받지 않는다.";
  return s;
}

/** 병종 패시브 설명문 (§7 게임성 격상) — combat.passives 수치에서 파생. 패시브 없는 계열은 빈 문자열 */
function classPassiveText(
  line: string,
  passives: { cavalryChargePercent: number; infantryBulwarkPercent: number; archerSnipePiercePercent: number },
): string {
  switch (line) {
    case "cavalry":
      return `돌격 — 이동 후 공격 시 피해 +${passives.cavalryChargePercent}%`;
    case "infantry":
      return `철벽 — 피격 피해 −${passives.infantryBulwarkPercent}%`;
    case "archer":
      return `저격 — 대상 지형 엄폐를 ${passives.archerSnipePiercePercent}% 관통`;
    default:
      return "";
  }
}

export function unitVM(ctx: BattleContext, u: UnitState): UnitVM {
  const terrain = terrainAt(ctx, u.x, u.y);
  const cls = ctx.data.unitClasses[u.classId];
  // 소지품 → 장비 탭 행 (gameData.items 미등록 id는 id를 이름으로 폴백)
  const equipment: ItemVM[] = u.items.map((id) => {
    const it = ctx.data.items[id];
    return {
      id,
      name: it?.name ?? id,
      category: it?.category ?? "기타",
      effect: it ? itemEffect(it.category, it.power, it.bonusPercent, it.effects) : "—",
    };
  });
  // 병종 책략 → 책략 탭 행 (strategies.json 해석)
  const strategies: StrategyVM[] = (cls?.strategies ?? []).map((id) => {
    const s = ctx.data.strategies[id];
    return {
      id,
      name: s?.name ?? id,
      mp: s?.mp ?? 0,
      category: s?.category ?? "—",
      target: s?.target ?? "enemy",
    };
  });
  return {
    id: u.id,
    name: ctx.data.commanders[u.id]?.name ?? u.id,
    className: ctx.data.unitClasses[u.classId]?.name ?? u.classId,
    side: u.side,
    level: u.level,
    x: u.x,
    y: u.y,
    troops: u.troops,
    maxTroops: u.maxTroops,
    mp: u.mp,
    maxMp: u.maxMp,
    sp: u.sp ?? 0,
    maxSp: u.maxSp ?? ctx.data.combat.sp.max,
    moved: u.moved,
    acted: u.acted,
    retreated: u.retreated,
    atk: attackPower(u),
    def: defensePower(u),
    spirit: spiritPower(u),
    warStat: u.war,
    leadershipStat: u.leadership,
    intelligenceStat: u.intelligence,
    move: u.move,
    rangeMin: u.rangeMin,
    rangeMax: u.rangeMax,
    terrainName: terrain.name,
    terrainGuard: terrain.guard,
    classId: u.classId,
    grades: cls?.grades,
    traitText: cls ? classTraitText(cls.line, ctx.data.combat.lineAdvantage, u.rangeMax) : undefined,
    passiveText: cls ? classPassiveText(cls.line, ctx.data.combat.passives) || undefined : undefined,
    doubleStrikeText:
      u.move - ctx.data.combat.doubleStrike.moveGap >= 3
        ? `연속공격 — 이동력 ${u.move}, 더 느린 적(이동력 ≤${u.move - ctx.data.combat.doubleStrike.moveGap})에게 2회 타격`
        : undefined,
    equipment,
    strategies,
  };
}

export function unitPanelVM(
  ctx: BattleContext,
  settled: BattleState,
  unitId: string,
): UnitVM | null {
  const u = settled.units.find((x) => x.id === unitId);
  return u ? unitVM(ctx, u) : null;
}

export function turnVM(ctx: BattleContext, settled: BattleState): TurnVM {
  return { turn: settled.turn, turnLimit: ctx.stage.turnLimit, phase: settled.phase };
}

/** 종료 전이면 null — ResultOverlay 표시 여부 판정용 */
export function resultVM(settled: BattleState): "victory" | "defeat" | null {
  return settled.status === "ongoing" ? null : settled.status;
}

export function battleVM(ctx: BattleContext, settled: BattleState): BattleVM {
  return {
    turn: turnVM(ctx, settled),
    status: settled.status,
    units: settled.units.map((u) => unitVM(ctx, u)),
    pendingRewards: settled.pendingRewards,
    levelUps: settled.levelUps ?? [],
  };
}
