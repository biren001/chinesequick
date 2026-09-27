/**
 * sitemap-cross.js —— 「sitemap ↔ 构建产物 ↔ noindex 声明」三方对账（离线，1 秒）
 *
 * 为什么需要它：`sm-check.js` 只查**线上** sitemap，且只做字符串包含判断。没有任何工具
 * 保证「产物里的可收录页面都进了 sitemap」。这类漂移是**静默**的：新页面写好了、能访问、
 * 内链也有，就是没被宣告给搜索引擎 —— 除非有人一条条数，否则所有报告都是绿的。
 *
 * 🔑 判据不靠白名单，靠**从页面自己推**：产物 HTML 里的 `<meta name="robots" content="noindex">`
 *    就是「这个页面不打算被收录」的声明。于是不变量是双向的，也就不会过期：
 *      · 有 noindex  → **必须不在** sitemap 里（在 = 自相矛盾：一边请收录一边说不许收录）
 *      · 无 noindex  → **必须在** sitemap 里（不在 = 静默漏掉一个可收录页）
 *    白名单（哪怕写得再清楚）总有一天会跟代码漂移；这个不会。
 *
 * 四条断言：
 *   A. 无 noindex 的内容页 → 必须都在 sitemap 里
 *   B. sitemap 里的 URL → 必须在产物里真有文件（否则是**真死链**，比 A 严重）
 *   C. 有 noindex 的页面 → 必须**不在** sitemap 里
 *   D. sitemap 内无重复条目
 * 另外报一条 **E**：跳转页（`cq-redirect-stub`）混进 sitemap = 把死路写进「请收录」清单。
 *
 * 用法：node _dev/sitemap-cross.js           # 报告 + 断言，退出码 0/1
 *       node _dev/sitemap-cross.js --list    # 额外逐条列出两边的名单
 *
 * ⚠️ 只做集合比较，**绝不写死条数** —— 加页面时它会自动跟着走。
 */
const fs = require("fs");
const path = require("path");

const OUT = "out";

function toPath(u) {
  let s = String(u).replace(/^https?:\/\/[^/]+/, "");
  if (!s.startsWith("/")) s = "/" + s;
  if (!s.endsWith("/")) s += "/";
  return s;
}

/** 从已渲染的 HTML 里取 robots 声明（Next 会把它输出成 meta 标签） */
function robotsMeta(html) {
  const m = html.match(/<meta\s+name="robots"\s+content="([^"]*)"/i);
  return m ? m[1].toLowerCase() : "";
}

function walkPages() {
  const pages = []; // { url, noindex }
  const stubs = [];
  (function walk(dir, rel) {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) {
        walk(p, rel ? rel + "/" + e.name : e.name);
      } else if (e.name === "index.html") {
        const url = rel ? "/" + rel + "/" : "/";
        const html = fs.readFileSync(p, "utf8");
        if (html.includes("cq-redirect-stub")) stubs.push(url);
        else pages.push({ url, robots: robotsMeta(html) });
      }
    }
  })(OUT, "");
  return { pages, stubs };
}

const listAll = process.argv.includes("--list");
const problems = [];

if (!fs.existsSync(path.join(OUT, "sitemap.xml"))) {
  console.log("FAIL: 找不到 out/sitemap.xml —— 先构建");
  process.exit(1);
}

const smPaths = [...fs.readFileSync(path.join(OUT, "sitemap.xml"), "utf8").matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/g)].map(
  (m) => toPath(m[1])
);
const smSet = new Set(smPaths);
const { pages, stubs } = walkPages();

const indexable = pages.filter((p) => !p.robots.includes("noindex"));
const noindexed = pages.filter((p) => p.robots.includes("noindex"));
const pageSet = new Set(pages.map((p) => p.url));

const missingFromSitemap = indexable.filter((p) => !smSet.has(p.url)).map((p) => p.url);
const wronglyInSitemap = noindexed.filter((p) => smSet.has(p.url)).map((p) => p.url);
const anythingMissing = pages.filter((p) => !p.robots).map((p) => p.url); // 连 robots meta 都没有
const dead = smPaths.filter((u) => !pageSet.has(u));
const stubsInSitemap = stubs.filter((u) => smSet.has(u));
const dupes = [...new Set(smPaths.filter((u, i) => smPaths.indexOf(u) !== i))];

console.log("sitemap 条数        : " + smPaths.length);
console.log("产物内容页          : " + pages.length);
console.log("  ├ 可收录（无 noindex）: " + indexable.length);
console.log("  └ 明确 noindex       : " + noindexed.length + "  " + JSON.stringify(noindexed.map((p) => p.url)));
console.log("跳转页              : " + stubs.length);
if (listAll) {
  console.log("");
  console.log("sitemap 全量：");
  for (const u of smPaths) console.log("    " + u);
}
console.log("");

if (missingFromSitemap.length) {
  problems.push(missingFromSitemap.length + " 个可收录页没进 sitemap");
  console.log("【A】无 noindex、却不在 sitemap 里（★静默漏掉可收录页）:");
  for (const u of missingFromSitemap) console.log("    " + u);
  console.log("");
} else {
  console.log("【A】可收录页全部在 sitemap 里 ✓（" + indexable.length + " 条）");
}

if (dead.length) {
  problems.push(dead.length + " 条 sitemap URL 在产物里不存在（真死链）");
  console.log("【B】sitemap 里有、产物里没有（★真死链）:");
  for (const u of dead) console.log("    " + u);
  console.log("");
} else {
  console.log("【B】sitemap 无死链 ✓");
}

if (wronglyInSitemap.length) {
  problems.push(wronglyInSitemap.length + " 个 noindex 页混进了 sitemap（自相矛盾）");
  console.log("【C】声明了 noindex、却出现在 sitemap 里（★一边请收录一边说不许收录）:");
  for (const u of wronglyInSitemap) console.log("    " + u);
  console.log("");
} else {
  console.log("【C】noindex 页均未进 sitemap ✓");
}

if (stubsInSitemap.length) {
  problems.push(stubsInSitemap.length + " 个跳转页混进了 sitemap");
  console.log("【E】跳转页混进 sitemap（★把死路写进请收录清单）:");
  for (const u of stubsInSitemap) console.log("    " + u);
  console.log("");
} else {
  console.log("【E】跳转页未进 sitemap ✓");
}

if (dupes.length) {
  problems.push(dupes.length + " 条重复 URL");
  console.log("【D】sitemap 重复条目（★）:");
  for (const u of dupes) console.log("    " + u);
  console.log("");
} else {
  console.log("【D】无重复条目 ✓");
}

if (anythingMissing.length) {
  console.log("");
  console.log("⚠ 下面这些页面连 robots meta 都没有（既没 noindex 也没声明 index）——");
  console.log("  本脚本按「可收录」处理，且要求它们必须进 sitemap。建议显式表态：");
  for (const u of anythingMissing) console.log("    " + u);
}

console.log("");
if (problems.length) {
  console.log("VERDICT: FAIL");
  for (const p of problems) console.log("  - " + p);
  process.exitCode = 1;
} else {
  console.log("VERDICT: PASS —— sitemap / 产物 / noindex 声明三方一致（" + smPaths.length + " 条）");
  console.log("          可收录 " + indexable.length + " ⊂ sitemap " + smPaths.length + "；noindex " + noindexed.length + " 条已排除在外 ✓");
}
