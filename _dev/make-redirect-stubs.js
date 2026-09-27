/**
 * make-redirect-stubs.js —— 由 `data/legacy-redirects.json` 生成两套跳转产物。
 *
 * 【为什么需要跳转页，而不是只写 `_redirects`】
 * 2026-09-27 做了两组受控实验（`_dev/_cf-redir-probe.js`，跑在预览分支上）：
 *   ① `_redirects` 的 key 带前导斜杠 → 文件被**当成普通资源原样返回**（200 + 原文），规则一条都没执行；
 *   ② 去掉前导斜杠 → 文件取不到（404），规则同样一条都没执行。
 *   两组都放了真 `404.html` 当干净判据（没有它的话未命中会 SPA 兜底成 200，看着像"生效了"）。
 * 结论：**本项目（Cloudflare Pages Direct Upload）不吃 `_redirects`** —— 文档说这个文件「不该被
 * 作为静态资源提供」，而它明明白白被提供出来了，说明压根没进特殊文件解析流程。
 * 所以真正兜底的是**静态跳转页**：一个真存在的 HTML，走 `meta refresh` + `canonical`。
 * `_redirects` 仍然生成，作为"平台哪天支持就自动升级成真 301"的意图声明 —— 两者目标一致，不冲突
 * （真 301 优先于资源查找，所以 `_redirects` 一旦生效会自动盖过跳转页，正是我们想要的优先级）。
 *
 * 【为什么不让 `_redirects` 与跳转页各写一份】
 * 两套产物描述同一件事，手写必然漂移。这里由一份数据派生，谁改了都不会漏另一个。
 *
 * 用法：node _dev/make-redirect-stubs.js
 */
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const SITE = "https://chinesequick.com";
const MARKER = "cq-redirect-stub"; // seocheck / linkgraph 靠这个标记识别跳转页

const data = JSON.parse(fs.readFileSync(path.join(ROOT, "data", "legacy-redirects.json"), "utf8"));
const rules = data.rules || [];

if (!rules.length) {
  console.error("FAIL: data/legacy-redirects.json 里没有规则");
  process.exit(1);
}

// 落点必须是真实存在的页面，否则我们只是把死链搬到另一个死链
for (const r of rules) {
  const p = path.join(ROOT, "out", r.to, "index.html");
  if (fs.existsSync(path.join(ROOT, "out")) && !fs.existsSync(p)) {
    console.error(`FAIL: 落点不存在于产物：${r.to}`);
    process.exit(1);
  }
}

/* ---------- 产物 1：public/_redirects ---------- */
const lines = [
  "# 由 data/legacy-redirects.json 生成（_dev/make-redirect-stubs.js），不要手改。",
  "# ⚠ 本项目实测 CF Pages Direct Upload **不执行**这个文件（见脚本头注释）；",
  "#   真正兜底的是同源的静态跳转页。两条路目标一致，平台支持谁就用谁。",
  "",
];
for (const r of rules) {
  lines.push(`# ${r.label} —— ${r.why}`);
  // 三种形态都写：CF 的匹配是精确的，`/x` 与 `/x/` 是两条不同规则，`*` 只吃带子路径的
  lines.push(`${r.from}    ${r.to}    301`);
  lines.push(`${r.from}/    ${r.to}    301`);
  lines.push(`${r.from}/*    ${r.to}    301`);
  lines.push("");
}
fs.mkdirSync(path.join(ROOT, "public"), { recursive: true });
fs.writeFileSync(path.join(ROOT, "public", "_redirects"), lines.join("\n"), "utf8");

/* ---------- 产物 2：public/<from>/index.html ---------- */
function stub(r) {
  return `<!DOCTYPE html>
<!-- ${MARKER} -->
<!-- 由 data/legacy-redirects.json 生成（_dev/make-redirect-stubs.js），不要手改。
     这条 URL 已下线（${r.why}）→ 跳到 ${r.to}
     刻意不加 noindex：noindex 可能让搜索引擎直接丢弃这个 URL 而**不做权重合并**，
     那正是我们要避免的。redirect + canonical 同时给出，两个信号都指向同一个落点。 -->
<html lang="en" translate="no">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<!-- 站点「不许浏览器自动翻译」两道声明，缺一条 seocheck 的 allPages.noTranslateMissing 就会报。
     跳转页本身没有 React，理论上不会被翻译搞白屏，但保持一致比给检查开特例省事，
     也避免下次有人照着这个模板抄出一个真的缺声明的页面。 -->
<meta name="google" content="notranslate">
<meta http-equiv="refresh" content="0; url=${r.to}">
<link rel="canonical" href="${SITE}${r.to}">
<title>Moved to ${r.label} | ChineseQuick</title>
</head>
<body>
<p>This page has moved to <a href="${r.to}">${r.label}</a>.</p>
</body>
</html>
`;
}

let wrote = 0;
for (const r of rules) {
  const dir = path.join(ROOT, "public", r.from.replace(/^\//, ""));
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "index.html"), stub(r), "utf8");
  wrote++;
}

console.log(`OK: _redirects 写入 ${rules.length * 3} 条规则（${rules.length} 条源路径）`);
console.log(`OK: 跳转页写入 ${wrote} 个 —— ${rules.map((r) => r.from).join(", ")}`);
console.log(`   标记：${MARKER}（seocheck / linkgraph 用它识别并排除）`);
