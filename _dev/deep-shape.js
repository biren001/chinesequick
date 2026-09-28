/**
 * 单句页深化内容的结构完整性体检
 *
 * 为什么需要它：`deep-verify` 校的是「写了的内容有没有真渲染出来」，
 * 它不会发现「某个小节压根没写」—— 首批/第二批写的时候格式还没定型，
 * 有 17 条只写了 when/variants/mistakes 的一部分、replies 整块缺失。
 * 每条的页面上这些小节是**条件渲染**的（没内容就不出现），所以线上看不出毛病，
 * 只是内容比后来的批次薄一大截。这正是本项目最怕的那类「静默失效」。
 *
 * 判据分两档：
 *   · 硬底线（违反即 exit 1）：when≥2、variants≥2、mistakes≥2
 *   · 当前标准（只报告，不失败）：when=2、variants=3、mistakes=3、replies=3
 *     —— 老的 17 条不满足，属于「待补齐」清单，不是错误。
 *
 * 用法：node _dev/deep-shape.js
 */
const fs = require("fs");
const path = require("path");

const DEEP = path.join(__dirname, "..", "data", "deep.json");
const PHRASES = path.join(__dirname, "..", "data", "phrases.json");

const deep = JSON.parse(fs.readFileSync(DEEP, "utf8"));
const phrases = JSON.parse(fs.readFileSync(PHRASES, "utf8"));
const list = phrases.phrases || phrases;
const byId = {};
list.forEach((p) => (byId[p.id] = p));

const ids = Object.keys(deep)
  .filter((k) => /^[0-9]+$/.test(k))
  .map(Number)
  .sort((a, b) => a - b);

const STD = { when: 2, variants: 3, mistakes: 3, replies: 3 };
const FLOOR = { when: 2, variants: 2, mistakes: 2, replies: 0 };

const standard = [];
const legacy = [];
const broken = [];

for (const id of ids) {
  const e = deep[String(id)] || {};
  const c = {
    when: (e.when || []).length,
    variants: (e.variants || []).length,
    mistakes: (e.mistakes || []).length,
    replies: (e.replies || []).length,
  };
  const ph = byId[id] || {};
  const label = `${String(id).padStart(3)}  ${(ph.english || "?").padEnd(34)} ${ph.chinese || ""}`;

  const floorFail = Object.keys(FLOOR).filter((k) => c[k] < FLOOR[k]);
  if (floorFail.length) broken.push(`  ${label}  → 缺 ${floorFail.join("/")}（${floorFail.map((k) => k + "=" + c[k]).join(", ")}）`);
  else if (Object.keys(STD).some((k) => c[k] < STD[k])) legacy.push(`  ${label}  → when${c.when} variants${c.variants} mistakes${c.mistakes} replies${c.replies}`);
  else standard.push(id);
}

const out = [];
out.push("=== 单句页深化内容结构体检 ===");
out.push(`deep.json 覆盖 ${ids.length} / ${list.length} 条短语`);
out.push(`· 达到当前标准（when2/variants3/mistakes3/replies3）：${standard.length} 条`);
out.push(`· 未达标准（旧格式，待补齐）：${legacy.length} 条`);
out.push(`· 违反硬底线（when≥2 / variants≥2 / mistakes≥2）：${broken.length} 条`);
out.push("");

if (legacy.length) {
  out.push(`--- 待补齐清单（${legacy.length} 条，下一批的优先候选）---`);
  legacy.forEach((x) => out.push(x));
  out.push("");
}
if (broken.length) {
  out.push(`--- 硬底线违反（必须修）---`);
  broken.forEach((x) => out.push(x));
  out.push("");
}

out.push(broken.length === 0 ? "PASS: 没有条目跌破硬底线" : `FAIL: ${broken.length} 条跌破硬底线`);

const txt = out.join("\n");
fs.writeFileSync(path.join(__dirname, "_deep-shape.txt"), txt, "utf8");
console.log(txt);
process.exit(broken.length === 0 ? 0 : 1);
