/**
 * 1회성: commanders.json에 민첩(agility) 주입 — 조조전 generals.json 이름매칭 환산.
 * 환산 = clamp(round(agi×2), 1, 100) (조조전 raw는 표시값 ÷2). CRLF/NFC 보존(라인 splice).
 * idempotent: faceId 다음 줄이 이미 "agility"면 건너뜀.
 */
const fs = require("fs");
const path = require("path");
const root = path.resolve(__dirname, "..");
const cmdPath = path.join(root, "packages/data/json/commanders.json");
const genPath = path.join(root, "packages/data/json/sosoden/generals.json");

const gens = JSON.parse(fs.readFileSync(genPath, "utf8"));
const agiByName = new Map();
for (const g of gens) {
  if (!agiByName.has(g.name) && typeof g.agi === "number") {
    agiByName.set(g.name, Math.min(100, Math.max(1, Math.round(g.agi * 2))));
  }
}

const raw = fs.readFileSync(cmdPath, "utf8");
const eol = raw.includes("\r\n") ? "\r\n" : "\n";
const lines = raw.split(/\r?\n/);
const out = [];
let curName = null;
let injected = 0, already = 0, unmatched = 0;
for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  const nm = line.match(/"name":\s*"([^"]+)"/);
  if (nm) curName = nm[1];
  out.push(line);
  if (/"faceId":/.test(line)) {
    const nextIsAgility = i + 1 < lines.length && /"agility":/.test(lines[i + 1]);
    if (nextIsAgility) { already++; continue; }
    if (curName && agiByName.has(curName)) {
      const indent = (line.match(/^(\s*)/) || ["", ""])[1];
      const val = agiByName.get(curName);
      const hasComma = /,\s*$/.test(line);
      if (hasComma) {
        // faceId 뒤에 다른 속성(ultimate 등)이 있음 → agility,(콤마) 삽입
        out.push(`${indent}"agility": ${val},`);
      } else {
        // faceId가 마지막 속성 → faceId 줄에 콤마 추가, agility는 콤마 없이(이제 마지막)
        out[out.length - 1] = line.replace(/\s*$/, ",");
        out.push(`${indent}"agility": ${val}`);
      }
      injected++;
    } else {
      unmatched++;
    }
  }
}
fs.writeFileSync(cmdPath, out.join(eol), "utf8");
console.log(`agility 주입: ${injected}명, 이미 있음: ${already}명, 미매칭(기본 50): ${unmatched}명`);
