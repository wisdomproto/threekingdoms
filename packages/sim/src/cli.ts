import { runBattle } from "./runner";

function arg(name: string, fallback: string): string {
  const i = process.argv.indexOf(`--${name}`);
  const v = i >= 0 ? process.argv[i + 1] : undefined;
  return v ?? fallback;
}

const stageId = arg("stage", "05-sishuiguan");
const runs = Number(arg("runs", "200"));
const seed = Number(arg("seed", "42"));

const results = Array.from({ length: runs }, (_, i) => runBattle(stageId, seed + i));

const wins = results.filter((r) => r.result === "victory").length;
const timeouts = results.filter((r) => r.result === "timeout").length;
const avg = (xs: number[]) => (xs.reduce((a, b) => a + b, 0) / xs.length).toFixed(1);

console.log(`스테이지: ${stageId} | ${runs}판 (시드 ${seed}~${seed + runs - 1})`);
console.log(`승률: ${((wins / runs) * 100).toFixed(1)}% (승 ${wins} / 패 ${runs - wins - timeouts} / 시간초과 ${timeouts})`);
console.log(`평균 턴: ${avg(results.map((r) => r.turns))}`);
console.log(`평균 아군 퇴각: ${avg(results.map((r) => r.playerRetreats))}`);
console.log(`일기토 발동률: ${((results.filter((r) => r.duelsFired.length > 0).length / runs) * 100).toFixed(1)}%`);
console.log(`(참고: 그리디 정책은 HP 최저 우선이라 일기토 발동률·승률은 실제 플레이보다 보수적)`);
