/**
 * 场景页（Scenario Mode）专项核对。
 *
 * seocheck.js 会把结果写进 _dev/seocheck.txt，这里把它读成人能看懂的一份报告，
 * 并对「必须成立」的几条做硬判定 —— 之所以单独一个脚本，是因为 seocheck 是
 * 全站体检（几十个断言），一个字段红了容易被刷过去，而场景页的结构一旦被改坏
 * （步骤漏渲染、ItemList 与可见内容不一致、失去入链）不会报错、只会静默变差。
 *
 * 用法：node _dev/seocheck.js && node _dev/check-scenarios.js
 */
const fs = require("fs");
const path = require("path");

const file = path.join(__dirname, "seocheck.txt");
if (!fs.existsSync(file)) {
  console.error("缺少 _dev/seocheck.txt —— 先跑 node _dev/seocheck.js");
  process.exit(2);
}

const s = JSON.parse(fs.readFileSync(file, "utf8"));
const S = s.scenarios;
const fails = [];
const line = (ok, label, extra = "") =>
  `${ok ? "PASS" : "FAIL"}  ${label}${extra ? "  " + extra : ""}`;

if (!S || !S.hub) {
  console.log(line(false, "场景总览页 /scenarios/"));
  process.exit(1);
}

console.log("── 场景总览页 ──");
console.log(line(S.hub, "/scenarios/ 已生成"));
console.log(line(S.hubInSitemap, "在 sitemap 里"));
console.log(line(S.titleLen > 0 && S.titleLen <= 60, `title ${S.titleLen} 字符`));
console.log(line(S.descLen > 0 && S.descLen <= 160, `description ${S.descLen} 字符`));
console.log(
  line(
    S.hubScenarioLinks === S.hubItems && S.hubItems > 0,
    `总览页列出 ${S.hubItems} 个场景（链接 ${S.hubScenarioLinks} 条）`
  )
);
console.log(line(S.jsonldErrors.length === 0, "JSON-LD 合法", S.jsonldErrors.join("; ")));

if (S.hubScenarioLinks !== S.hubItems) fails.push("总览页链接数与 ItemList 条数不一致");
if (S.jsonldErrors.length) fails.push("总览页 JSON-LD 报错");

console.log("\n── 各场景页 ──");
const seen = new Set();
for (const p of S.pages || []) {
  if (!p.exists) {
    console.log(line(false, `${p.slug}: 页面缺失`));
    fails.push(`${p.slug} 页面缺失`);
    continue;
  }
  seen.add(p.slug);
  const stepsOk = p.stepsRendered > 0 && p.stepsRendered === p.statedSteps;
  const listOk = p.itemListCount === p.statedPhrases;
  const hearOk = p.theySayRendered > 0 && p.theySayRendered <= p.stepsRendered;
  const faqOk = p.faqCount >= 3;
  const lenOk = p.titleLen > 0 && p.titleLen <= 60 && p.descLen > 0 && p.descLen <= 160;
  const linkOk = p.phraseLinks >= p.statedPhrases;

  console.log(`\n  ${p.slug}`);
  console.log("    " + line(stepsOk, `${p.stepsRendered} 步已渲染`, `声明 ${p.statedSteps}`));
  console.log("    " + line(hearOk, `「You may hear」${p.theySayRendered} 块`));
  console.log("    " + line(listOk, `ItemList ${p.itemListCount} 条`, `声明 ${p.statedPhrases} 条`));
  console.log("    " + line(linkOk, `链到单句页 ${p.phraseLinks} 条`));
  console.log("    " + line(lenOk, `title ${p.titleLen} / desc ${p.descLen}`));
  console.log("    " + line(faqOk, `FAQ ${p.faqCount} 条`));
  console.log("    " + line(p.inSitemap, "在 sitemap 里"));
  console.log("    " + line(p.jsonldErrors.length === 0, "JSON-LD 合法"));

  if (!stepsOk) fails.push(`${p.slug}: 可见步数与声明不符`);
  if (!hearOk) fails.push(`${p.slug}: 缺少「You may hear」块`);
  if (!listOk) fails.push(`${p.slug}: ItemList 与可见短语数不符`);
  if (!linkOk) fails.push(`${p.slug}: 单句页入链不足`);
  if (!lenOk) fails.push(`${p.slug}: title/description 长度越界`);
  if (!faqOk) fails.push(`${p.slug}: FAQ 少于 3 条`);
  if (!p.inSitemap) fails.push(`${p.slug}: 不在 sitemap`);
  if (p.jsonldErrors.length) fails.push(`${p.slug}: JSON-LD 报错`);
}

console.log("\n── 入链（少一条就会变孤岛）──");
const inbound = [
  ["首页 → /scenarios/", S.linkedFromHome],
  ["页脚（任意页如 /about/）→ /scenarios/", S.linkedFromFooter],
  ["分类页 → 场景页", S.categoryLinksScenario],
  ["单句页 → 场景页（反向）", S.phraseLinksScenario],
];
for (const [label, ok] of inbound) {
  console.log(line(ok, label));
  if (!ok) fails.push(`入链缺失：${label}`);
}

console.log(
  `\n场景数 ${(S.pages || []).length} · 总步骤 ${(S.pages || []).reduce(
    (n, p) => n + (p.statedSteps || 0),
    0
  )}`
);

if (fails.length) {
  console.log("\n失败项：\n- " + fails.join("\n- "));
  process.exit(1);
}
console.log("\nSCENARIOS PASS");
