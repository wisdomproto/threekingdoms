import {
  applyAction,
  attackPower,
  computeDamage,
  createBattle,
  defensePower,
  type BattleContext,
  type UnitState,
} from "@tk/engine";
import { chooseAction } from "./policy";
import {
  REF_CLASSES,
  refData,
  skirmishContext,
  unit,
  type StageUnit,
} from "./fixtures";

/**
 * 일기토 없는 순수 교전 밸런스 측정 리포터.
 * 세 리포트(a 타격당 데미지 / b 격파 타수 / c 스커미시 sim)를 콘솔+마크다운으로 낸다.
 * 자동 튜닝 없음 — 측정·기록만. 결정론(엔진 공식 무분산).
 */

// ── 공통 헬퍼: 측정용 단발 UnitState 합성 ──────────────────────────────────────
// computeDamage/attackPower/defensePower는 UnitState만 필요(공식이 troops·위치에 무관, guard는
// 평지=0). createBattle로 1유닛 배치 후 그 UnitState를 뽑아 쓰면 grades/bookBonus까지 정합.

function makeUnitState(commanderId: string, classId: string, level: number): UnitState {
  const ctx = skirmishContext([
    unit(commanderId, classId, level, 100, "player", 0, 0),
  ]);
  const st = createBattle(ctx, 1);
  return st.units[0]!;
}

/** 측정용 더미 ctx (평지, defFactor·guard 판정용). 어떤 합성 ctx든 combat/terrains는 동일. */
const probeCtx: BattleContext = skirmishContext([
  unit("ace", REF_CLASSES.cavalry, 1, 100, "player", 0, 0),
]);

const LINE_KO: Record<string, string> = {
  cavalry: "기병",
  infantry: "보병",
  archer: "궁병",
  support: "보조",
  bandit: "산적",
};

function md(line = ""): string {
  return line + "\n";
}

// ── (a) 타격당 데미지 표 ───────────────────────────────────────────────────────
// 대표 공격자 병종 × 방어자 병종, Lv1/5/10. 상성(기병>보병>궁>기병) 반영 확인.

interface DamageRow {
  attacker: string;
  defender: string;
  matchup: string; // 유리/불리/-
  byLevel: Record<number, number>;
}

const ATK_LEVELS = [1, 5, 10];

function lineMatchup(ctx: BattleContext, a: UnitState, d: UnitState): string {
  const adv = ctx.data.combat.lineAdvantage;
  if (adv[a.line] === d.line) return "유리";
  if (adv[d.line] === a.line) return "불리";
  return "-";
}

export function damageTable(): { rows: DamageRow[]; markdown: string } {
  // 대표 공격자: 에이스 기병 / 군주 보병 / 책사궁(궁병) — 무력 영향 보이게 ace로 통일하지 않고
  // 같은 "쫄병(mook)" 공격자도 넣어 무력 격차 체감.
  const attackers: Array<[string, string, string]> = [
    ["ace", REF_CLASSES.cavalry, "에이스기병(무96)"],
    ["mook", REF_CLASSES.cavalry, "쫄병기병(무60)"],
    ["lord", REF_CLASSES.infantry, "군주보병(무78)"],
    ["mook", REF_CLASSES.archer, "쫄병궁병(무60)"],
  ];
  const defenders: Array<[string, string, string]> = [
    ["mook", REF_CLASSES.infantry, "쫄병보병(통60)"],
    ["mook", REF_CLASSES.cavalry, "쫄병기병(통60)"],
    ["mook", REF_CLASSES.archer, "쫄병궁병(통60)"],
    ["brute", REF_CLASSES.infantry, "맹장보병(통82)"],
  ];

  const rows: DamageRow[] = [];
  for (const [acid, acls, alabel] of attackers) {
    for (const [dcid, dcls, dlabel] of defenders) {
      const byLevel: Record<number, number> = {};
      let matchup = "-";
      for (const lv of ATK_LEVELS) {
        const a = makeUnitState(acid, acls, lv);
        const d = makeUnitState(dcid, dcls, 1); // 방어자는 Lv1 고정(공격자 레벨 효과 분리)
        matchup = lineMatchup(probeCtx, a, d);
        byLevel[lv] = computeDamage(probeCtx, a, d);
      }
      rows.push({ attacker: alabel, defender: dlabel, matchup, byLevel });
    }
  }

  let s = "";
  s += md("타격당 데미지 (방어자 Lv1 고정, 평지 guard=0, 명중100%·무분산)");
  s += md();
  s += md("| 공격자 | 방어자 | 상성 | Lv1 | Lv5 | Lv10 |");
  s += md("|---|---|:--:|--:|--:|--:|");
  for (const r of rows) {
    s += md(
      `| ${r.attacker} | ${r.defender} | ${r.matchup} | ${r.byLevel[1]} | ${r.byLevel[5]} | ${r.byLevel[10]} |`,
    );
  }
  return { rows, markdown: s };
}

// ── (b) 격파 타수 (hits-to-kill) ──────────────────────────────────────────────
// 대표 매치업에서 troops(~100~150) 기준 몇 타에 격파. 길중의 "쫄병 처치 체감".

interface HtkRow {
  label: string;
  matchup: string;
  dmgPerHit: number;
  troops: number;
  hits: number; // ceil(troops / dmgPerHit)
}

function hitsToKill(
  attackerCid: string,
  attackerCls: string,
  attackerLv: number,
  defenderCid: string,
  defenderCls: string,
  defenderLv: number,
  troops: number,
): { dmg: number; hits: number; matchup: string } {
  const a = makeUnitState(attackerCid, attackerCls, attackerLv);
  const d = makeUnitState(defenderCid, defenderCls, defenderLv);
  const dmg = computeDamage(probeCtx, a, d);
  const hits = dmg <= 0 ? Infinity : Math.ceil(troops / dmg);
  return { dmg, hits, matchup: lineMatchup(probeCtx, a, d) };
}

export function hitsToKillTable(): { rows: HtkRow[]; markdown: string } {
  const TROOPS = 120; // 조조전 스케일 대표 병력
  const cases: Array<[string, string, string, number, string, string, number]> = [
    // label, atkCid, atkCls, atkLv, defCid, defCls, defLv
    ["에이스기병 → 쫄병보병", "ace", REF_CLASSES.cavalry, 5, "mook", REF_CLASSES.infantry, 1],
    ["쫄병기병 → 쫄병보병", "mook", REF_CLASSES.cavalry, 1, "mook", REF_CLASSES.infantry, 1],
    ["쫄병보병 → 쫄병보병", "mook", REF_CLASSES.infantry, 1, "mook", REF_CLASSES.infantry, 1],
    ["쫄병보병 → 쫄병궁병", "mook", REF_CLASSES.infantry, 1, "mook", REF_CLASSES.archer, 1],
    ["쫄병궁병 → 쫄병기병", "mook", REF_CLASSES.archer, 1, "mook", REF_CLASSES.cavalry, 1],
    ["에이스기병 → 맹장보병", "ace", REF_CLASSES.cavalry, 10, "brute", REF_CLASSES.infantry, 5],
    ["군주보병 → 쫄병보병", "lord", REF_CLASSES.infantry, 5, "mook", REF_CLASSES.infantry, 1],
  ];
  const rows: HtkRow[] = cases.map(([label, acid, acls, alv, dcid, dcls, dlv]) => {
    const { dmg, hits, matchup } = hitsToKill(acid, acls, alv, dcid, dcls, dlv, TROOPS);
    return { label, matchup, dmgPerHit: dmg, troops: TROOPS, hits };
  });

  let s = "";
  s += md(`격파 타수 (병력 ${TROOPS} 기준, 단발 데미지로 나눈 ceil — 반격·반복 제외)`);
  s += md();
  s += md("| 매치업 | 상성 | 타격당 | 병력 | 격파 타수 |");
  s += md("|---|:--:|--:|--:|--:|");
  for (const r of rows) {
    s += md(`| ${r.label} | ${r.matchup} | ${r.dmgPerHit} | ${r.troops} | ${r.hits} |`);
  }
  return { rows, markdown: s };
}

// ── (c) 스커미시 sim (그리디 vs 그리디, 시드 스윕, 레벨 격차 변주) ────────────────

export interface SkirmishResult {
  result: "victory" | "defeat" | "timeout";
  turns: number;
  playerRetreats: number;
  enemyRetreats: number;
  playerTroopsLeft: number; // 생존 아군 잔존 병력 합
}

/** 일기토 없는 합성 교전 1판 (runner.ts와 동형이지만 ctx를 인자로 받음). */
export function runSkirmish(ctx: BattleContext, seed: number, maxTurns?: number): SkirmishResult {
  const limit = maxTurns ?? ctx.data.combat.maxTurns;
  let state = createBattle(ctx, seed);
  let guard = 0;
  while (state.status === "ongoing" && state.turn <= limit) {
    if (++guard > 200_000) throw new Error("skirmish runaway");
    const action = chooseAction(ctx, state);
    if (!action) break;
    state = applyAction(ctx, state, action).state;
  }
  const players = state.units.filter((u) => u.side === "player");
  const enemies = state.units.filter((u) => u.side === "enemy");
  return {
    result: state.status === "ongoing" ? "timeout" : state.status,
    turns: Math.min(state.turn, limit),
    playerRetreats: players.filter((u) => u.retreated).length,
    enemyRetreats: enemies.filter((u) => u.retreated).length,
    playerTroopsLeft: players.filter((u) => !u.retreated).reduce((a, u) => a + u.troops, 0),
  };
}

interface SweepStat {
  label: string;
  runs: number;
  winRate: number;
  avgTurns: number;
  minTurns: number;
  maxTurns: number;
  avgPlayerRetreats: number;
  avgPlayerTroopsLeft: number;
}

/**
 * 6 vs 6 평지 라인배틀(아군 좌, 적 우) — 양 진영 균형 편성에서 레벨 격차만 변주.
 * 시드 스윕(0..N-1). 엔진 무분산이라 시드는 결과 동일하나, 재사용·회귀 계약 위해 스윕 형태 유지.
 */
function balancedArmy(playerLv: number, enemyLv: number, troops: number): StageUnit[] {
  // 12×8 평지. 군주(첫 유닛 = defeat 판정 대상)는 후열에 둬 실제 게임의 "보호받는 군주"를
  // 흉내낸다. 전열(x=2~3)에 근접, 후열(x=0~1)에 군주/책사 — 그래야 sweep이 "군주 한 명 죽음"이
  // 아니라 군대 소모전을 측정한다.
  // [cid, cls, dx(좌측 기준 열 오프셋), dy]
  const playerSquad: Array<[string, string, number, number]> = [
    ["lord", REF_CLASSES.infantry, 0, 3], //  군주(후열) — defeat 판정 대상
    ["caster", REF_CLASSES.caster, 0, 4], // 책사(후열)
    ["ace", REF_CLASSES.cavalry, 2, 1], //   에이스 기병(전열)
    ["mook", REF_CLASSES.infantry, 2, 2], // 보병(전열)
    ["mook", REF_CLASSES.archer, 1, 3], //   궁병(중열)
    ["mook", REF_CLASSES.cavalry, 2, 4], // 기병(전열)
  ];
  const enemySquad: Array<[string, string, number, number]> = [
    ["brute", REF_CLASSES.cavalry, 0, 1], // 적 맹장 기병
    ["mook", REF_CLASSES.infantry, 0, 2],
    ["mook", REF_CLASSES.infantry, 0, 3],
    ["mook", REF_CLASSES.archer, 1, 3],
    ["mook", REF_CLASSES.cavalry, 0, 4],
    ["mook", REF_CLASSES.caster, 1, 4],
  ];
  const units: StageUnit[] = [];
  playerSquad.forEach(([cid, cls, dx, dy], i) => {
    // 같은 commanderId가 양쪽/중복되면 엔진이 id로 유닛을 구분 못 하므로 접미사로 유일화
    units.push(unit(`${cid}#P${i}`, cls, playerLv, troops, "player", dx, dy));
  });
  enemySquad.forEach(([cid, cls, dx, dy], i) => {
    units.push(unit(`${cid}#E${i}`, cls, enemyLv, troops, "enemy", 11 - dx, dy));
  });
  return units;
}

function sweep(label: string, units: StageUnit[], runs: number): SweepStat {
  const ctx = skirmishContext(units, { width: 12, height: 8, turnLimit: 40 });
  const results = Array.from({ length: runs }, (_, i) => runSkirmish(ctx, i));
  const turns = results.map((r) => r.turns);
  const wins = results.filter((r) => r.result === "victory").length;
  const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
  return {
    label,
    runs,
    winRate: (wins / runs) * 100,
    avgTurns: sum(turns) / runs,
    minTurns: Math.min(...turns),
    maxTurns: Math.max(...turns),
    avgPlayerRetreats: sum(results.map((r) => r.playerRetreats)) / runs,
    avgPlayerTroopsLeft: sum(results.map((r) => r.playerTroopsLeft)) / runs,
  };
}

export function skirmishSweep(runs = 8): { stats: SweepStat[]; markdown: string } {
  const TROOPS = 120;
  const stats: SweepStat[] = [
    sweep("동레벨 (아Lv5 vs 적Lv5)", balancedArmy(5, 5, TROOPS), runs),
    sweep("아군 +1 (아Lv6 vs 적Lv5)", balancedArmy(6, 5, TROOPS), runs),
    sweep("아군 +2 (아Lv7 vs 적Lv5)", balancedArmy(7, 5, TROOPS), runs),
    sweep("적군 +1 (아Lv5 vs 적Lv6)", balancedArmy(5, 6, TROOPS), runs),
    sweep("적군 +2 (아Lv5 vs 적Lv7)", balancedArmy(5, 7, TROOPS), runs),
  ];

  let s = "";
  s += md(`스커미시 sim (6v6 평지, 그리디 vs 그리디, 시드 0~${runs - 1}, 병력 ${TROOPS}, turnLimit 40)`);
  s += md();
  s += md("| 시나리오 | 판수 | 승률 | 평균턴 | 최소 | 최대 | 평균 아군퇴각 | 평균 잔존병력 |");
  s += md("|---|--:|--:|--:|--:|--:|--:|--:|");
  for (const st of stats) {
    s += md(
      `| ${st.label} | ${st.runs} | ${st.winRate.toFixed(0)}% | ${st.avgTurns.toFixed(1)} | ${st.minTurns} | ${st.maxTurns} | ${st.avgPlayerRetreats.toFixed(2)} | ${Math.round(st.avgPlayerTroopsLeft)} |`,
    );
  }
  return { stats, markdown: s };
}

// ── 성장 곡선 보조 표 (등급계수가 레벨에 따라 벌어지는 양상) ──────────────────────
// 해석에 쓰일 atk/def 누적 성장 — 데이터 변경 아님, 측정용.

export function growthCurveTable(): string {
  const levels = [1, 5, 10, 20, 30, 50];
  const samples: Array<[string, string, string]> = [
    ["에이스기병 공격력(무96·atk S)", "ace", REF_CLASSES.cavalry],
    ["쫄병보병 방어력(통60·def S)", "mook", REF_CLASSES.infantry],
    ["쫄병궁병 공격력(무60·atk A)", "mook", REF_CLASSES.archer],
    ["맹장보병 방어력(통82·def S)", "brute", REF_CLASSES.infantry],
  ];
  let s = "";
  s += md("능력치 누적 성장 (등급계수 증분형 — 참고)");
  s += md();
  s += md(`| 지표 | ${levels.map((l) => `Lv${l}`).join(" | ")} |`);
  s += md(`|---|${levels.map(() => "--:").join("|")}|`);
  for (const [label, cid, cls] of samples) {
    const isDef = label.includes("방어");
    const vals = levels.map((lv) => {
      const u = makeUnitState(cid, cls, lv);
      return isDef ? defensePower(u) : attackPower(u);
    });
    s += md(`| ${label} | ${vals.join(" | ")} |`);
  }
  return s;
}

/** 세 리포트 + 보조표를 합친 전체 마크다운 본문(머리말 제외). */
export function buildReportBody(skirmishRuns = 8): string {
  const a = damageTable();
  const b = hitsToKillTable();
  const c = skirmishSweep(skirmishRuns);
  const g = growthCurveTable();
  let s = "";
  s += md("## (a) 타격당 데미지 표");
  s += md();
  s += a.markdown;
  s += md();
  s += md("## (b) 격파 타수 (hits-to-kill)");
  s += md();
  s += b.markdown;
  s += md();
  s += md("## (c) 스커미시 sim");
  s += md();
  s += c.markdown;
  s += md();
  s += md("## (참고) 능력치 누적 성장 곡선");
  s += md();
  s += g;
  return s;
}

// refData 미사용 경고 방지 (외부 재사용 위해 re-export)
export { refData };
