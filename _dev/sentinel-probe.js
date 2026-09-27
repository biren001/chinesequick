/**
 * _sentinel-probe — 只在写/修 live-version-check 的哨兵时临时用。
 * 从 out/ 里把候选 needle 的真实上下文打出来，避免凭想象写字符串。
 *   node _dev/sentinel-probe.js <out page rel path> <pattern> [pattern2...]
 */
const fs = require("fs");
const path = require("path");
const ROOT = process.cwd();
const OUT = path.join(ROOT, "out");

const file = process.argv[2];
const pats = process.argv.slice(3);
const p = path.join(OUT, file);
if (!fs.existsSync(p)) {
  console.log("MISSING " + p);
  process.exit(1);
}
const h = fs.readFileSync(p, "utf8");
const lines = [];
lines.push(`FILE ${file}  len=${h.length}`);
for (const pat of pats) {
  const re = new RegExp(pat.replace(/[.*+?^${}()|[\]\\]/g, (c) => "\\" + c), "g");
  const ms = [...h.matchAll(re)];
  lines.push(`\n[${pat}] count=${ms.length}`);
  ms.slice(0, 4).forEach((m, i) => {
    const start = Math.max(0, m.index - 70);
    lines.push(`  #${i + 1} …${h.slice(start, m.index + m[0].length + 70).replace(/\s+/g, " ")}…`);
  });
}
fs.writeFileSync("_dev/_sentinel-probe.txt", lines.join("\n"), "utf8");
console.log("ok");
