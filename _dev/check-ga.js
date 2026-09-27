/**
 * GA 注入核验：确认构建产物每个页面都带上了衡量 ID。
 * 用法：node _dev/check-ga.js [可选的期望 ID]
 */
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const outDir = path.join(root, "out");
const expected = process.argv[2] || (fs.existsSync(path.join(root, ".env.local"))
  ? (fs.readFileSync(path.join(root, ".env.local"), "utf8").match(/^NEXT_PUBLIC_GA_ID=(.+)$/m) || [])[1] || ""
  : "");

if (!expected) {
  console.log("FAIL: 未找到 NEXT_PUBLIC_GA_ID（.env.local 或命令行参数）");
  process.exit(1);
}

const logPath = path.join(root, "build.log");
if (fs.existsSync(logPath)) {
  const lines = fs.readFileSync(logPath, "utf8").split(/\r?\n/).filter(Boolean);
  console.log("--- build.log tail ---");
  console.log(lines.slice(-14).join("\n"));
  console.log("");
}

const pages = [];
(function walk(d) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) walk(p);
    else if (e.name.endsWith(".html")) pages.push(p);
  }
})(outDir);

let withId = 0;
let withSrc = 0;
let withConfig = 0;
const missing = [];

const gtagSrcRe = new RegExp("googletagmanager\\.com/gtag/js\\?id=" + expected);
const configRe = new RegExp("gtag\\(\\s*'config'\\s*,\\s*'" + expected + "'");

for (const p of pages) {
  const h = fs.readFileSync(p, "utf8");
  const hasId = h.includes(expected);
  if (hasId) withId++;
  else missing.push(path.relative(outDir, p));
  if (gtagSrcRe.test(h)) withSrc++;
  if (configRe.test(h)) withConfig++;
}

console.log("期望 ID       :", expected);
console.log("HTML 页面总数 :", pages.length);
console.log("含该 ID 的页面:", withId);
console.log("带 gtag.js src:", withSrc);
console.log("带 gtag config:", withConfig);
console.log("缺失的页面    :", missing.length ? missing.slice(0, 10).join(", ") : "无");

const ok = withId === pages.length && withSrc === pages.length && withConfig === pages.length;
console.log(ok ? "\nPASS: 全站每页都已注入 GA" : "\nFAIL: 有页面没注入 GA");
process.exit(ok ? 0 : 1);
