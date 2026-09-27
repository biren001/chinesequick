/**
 * jsonld-check.js —— 结构化数据校验（离线，约 2 秒）
 *
 * 为什么需要它：整站的 SEO 打法押在两件事上 ——
 *   ① 单句页的 **FAQPage**（Google 摘要直接取这段原文，是「SERP 广告文案」）
 *   ② 首页的 **WebSite / EducationalOrganization**（品牌名与 alternateName，影响站名显示）
 * 而 JSON-LD 坏掉是**完全静默**的：页面照常渲染、肉眼全对、其它任何报告都不会变红，
 * 只有 Google 那边悄悄拿不到结构化数据。此前 `seocheck.js` 里连 `ld+json` 都没出现过。
 *
 * ⚠️ 本项目的真实结构（先看清楚再改判据）：
 *   每页**只有一个** `<script type="application/ld+json">`，形态是
 *   `{ "@context": "https://schema.org", "@graph": [ {…BreadcrumbList…}, {…FAQPage…} ] }`
 *   —— `@graph` 里的节点**按 Schema.org 规范继承顶层的 `@context`**。
 *   **逐个节点要求 `@context` 是错的**（第一版就这么误报 200+ 条）。
 *
 * 五条断言：
 *   A. 每个 JSON-LD 块都能 `JSON.parse`（引号/换行没被弄坏）
 *   B. 块**顶层**有 `@context`，每个节点有 `@type`
 *   C. 单句页必须有 `FAQPage`，问题数 ≥ 3、答案非空
 *   D. 🔑 **JSON-LD 里的答案必须真的出现在页面可见正文里** ——
 *      这条是「正文与 FAQ 各说一套」那个已踩过的坑的探测器
 *      （`phraseFaqEntries` 曾只读 `tip` 而正文渲染 `deep.when`；页面看起来完全正常，
 *      但 Google 摘走的是另一套，谁都不会发现）。
 *   E. 首页必须有 `WebSite`（含 `alternateName`）与 `*Organization`
 *
 * 工具页（about / contact / privacy / terms / 404 / saved / thank-you）**不要求** schema，
 * 只统计不报错 —— 它们本来就不是拿来被检索的。
 *
 * 用法：node _dev/jsonld-check.js            # 全量，退出码 0/1
 *       node _dev/jsonld-check.js --sample   # 只查前 12 页（改一处时快速迭代）
 */
const fs = require("fs");
const path = require("path");

const OUT = "out";
const sampleOnly = process.argv.includes("--sample");

/** HTML 实体解码（比较 JSON-LD 文本与正文时必须先解码，否则 `&#x27;` 永远对不上） */
function decode(s) {
  return s
    .replace(/&#x27;|&#39;|&apos;/g, "'")
    .replace(/&quot;|&#34;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#x2F;/g, "/")
    .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(Number(d)));
}

function stripTags(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ");
}

function walk() {
  const pages = [];
  (function w(dir, rel) {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) w(p, rel ? rel + "/" + e.name : e.name);
      else if (e.name === "index.html") {
        const html = fs.readFileSync(p, "utf8");
        if (html.includes("cq-redirect-stub")) continue;
        pages.push({ url: rel ? "/" + rel + "/" : "/", file: p, html });
      }
    }
  })(OUT, "");
  return pages;
}

/** 「内容页」= 本该被检索的页面，才要求带结构化数据 */
function needsSchema(url) {
  return (
    url === "/" ||
    url.startsWith("/how-to-say-") ||
    url.startsWith("/chinese-") ||
    url.startsWith("/learn/") ||
    url.startsWith("/scenarios") ||
    url === "/china-travel-checklist/"
  );
}

const problems = [];
const stats = { pages: 0, blocks: 0, faqPages: 0, questions: 0, compared: 0, mismatch: 0, utilityNoSchema: 0 };

let pages = walk();
if (sampleOnly) pages = pages.slice(0, 12);
stats.pages = pages.length;

for (const pg of pages) {
  const blocks = [...pg.html.matchAll(/<script[^>]*application\/ld\+json[^>]*>([\s\S]*?)<\/script>/g)];

  if (!blocks.length) {
    if (needsSchema(pg.url)) problems.push(pg.url + " 是内容页却没有 JSON-LD 块");
    else stats.utilityNoSchema++;
    continue;
  }

  // 页面可见正文（去标签 + 解码实体 + 折叠空白），用于断言 D
  const visible = decode(stripTags(pg.html)).replace(/\s+/g, " ");

  const types = [];
  for (const b of blocks) {
    stats.blocks++;
    let obj;
    try {
      obj = JSON.parse(b[1]);
    } catch (e) {
      problems.push(pg.url + " 有 JSON-LD 块无法解析：" + e.message);
      continue;
    }

    const nodes = Array.isArray(obj) ? obj : obj["@graph"] ? obj["@graph"] : [obj];
    // @context 只要求出现在**块顶层**；@graph 节点继承它，不重复声明是正确的
    const topHasContext = Array.isArray(obj) ? obj.every((n) => n["@context"]) : !!obj["@context"];
    if (!topHasContext) problems.push(pg.url + " 的 JSON-LD 块顶层缺 @context");

    for (const n of nodes) {
      if (!n["@type"]) {
        problems.push(pg.url + " 的 JSON-LD 块里有节点缺 @type");
        continue;
      }
      const t = String(n["@type"]);
      types.push(t);

      if (t === "FAQPage") {
        stats.faqPages++;
        const ents = n.mainEntity || [];
        if (ents.length < 3) problems.push(pg.url + " 的 FAQPage 只有 " + ents.length + " 个问题（应 ≥ 3）");
        for (const q of ents) {
          stats.questions++;
          const ans = q.acceptedAnswer && q.acceptedAnswer.text;
          if (!ans || !String(ans).trim()) {
            problems.push(pg.url + " 的 FAQ「" + String(q.name).slice(0, 40) + "」答案是空的");
            continue;
          }
          const needle = decode(String(ans)).replace(/\s+/g, " ").trim();
          stats.compared++;
          if (!visible.includes(needle)) {
            stats.mismatch++;
            problems.push(
              pg.url +
                " ★FAQ 答案在页面正文里找不到（正文与结构化数据不是同一套）：「" +
                needle.slice(0, 70) +
                "…」"
            );
          }
        }
      }
    }
  }

  if (pg.url === "/") {
    if (!types.includes("WebSite")) problems.push("/ 页缺少 WebSite 结构化数据");
    if (!types.some((t) => t.endsWith("Organization"))) problems.push("/ 页缺少 Organization / EducationalOrganization");
    if (!pg.html.includes("alternateName")) {
      problems.push("/ 页的 JSON-LD 里没有 alternateName（站名拿不准时 Google 会回退显示域名）");
    }
  }
}

console.log("扫描页面   : " + stats.pages);
console.log("JSON-LD 块 : " + stats.blocks);
console.log("FAQPage    : " + stats.faqPages + " 页 / " + stats.questions + " 个问题");
console.log("答案对照   : 比对 " + stats.compared + " 条，正文里找不到 " + stats.mismatch + " 条");
console.log("工具页无 schema（正常）: " + stats.utilityNoSchema);
console.log("");
if (problems.length) {
  const show = problems.slice(0, 25);
  console.log("问题 " + problems.length + " 条" + (problems.length > show.length ? "（只列前 25）" : "") + "：");
  for (const p of show) console.log("  - " + p);
  console.log("");
  console.log("VERDICT: FAIL");
  process.exitCode = 1;
} else {
  console.log("VERDICT: PASS —— JSON-LD 全部可解析，且 FAQ 答案与页面正文逐条一致");
}
