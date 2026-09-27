/**
 * deep-audit.js —— 单句页「内容厚度」体检。
 *
 * 目的：P1 要给单句页加深内容，先按「现在有字 quantities」排序，找出最薄的、
 * 以及流量权重最高的那批该优先补。不需要任何外部数据。
 *
 * 输出：_dev/_deep-audit.txt
 */
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const phrases = JSON.parse(
  fs.readFileSync(path.join(ROOT, "data", "phrases.json"), "utf8")
);
const OUT = path.join(ROOT, "out");

function slugify(s) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// URL 走 `slug` 覆盖优先（id 13 改了英文但锁住了旧 URL），
// 否则这条会被误报成「out/ 里找不到页面」。生成规则的真相在 lib/slug.ts。
function pageSlug(p) {
  return p.slug || slugify(p.english);
}

function pageWords(p) {
  const file = path.join(OUT, "how-to-say-" + pageSlug(p) + "-in-chinese", "index.html");
  if (!fs.existsSync(file)) return null;
  const h = fs.readFileSync(file, "utf8");
  // 只取 body 正文段，剥掉 RSC flight payload（它含 self.__next_f）
  const bodyStart = h.indexOf("<body");
  const body = bodyStart < 0 ? h : h.slice(bodyStart, h.indexOf("self.__next_f") > 0 ? h.indexOf("self.__next_f") : undefined);
  const text = body
    .replace(/<script[\s\S]*?<\/script>/g, " ")
    .replace(/<style[\s\S]*?<\/style>/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&[a-z]+;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return {
    words: text.trim() ? text.split(" ").length : 0,
    chars: text.replace(/\s/g, "").length,
  };
}


const lines = [];
lines.push("=== 单句页内容厚度体检（不含导航/页脚/JS）===");
lines.push(`站点：${phrases.length} 条短语   out/ 存在：${fs.existsSync(OUT)}`);
lines.push("");

const rows = [];
let missing = 0;
let noTip = 0;
for (const p of phrases) {
  const m = pageWords(p);
  if (!m) {
    missing++;
    continue;
  }
  if (!p.tip) noTip++;
  rows.push({
    id: p.id,
    english: p.english,
    cn: p.chinese,
    cat: p.category,
    words: m.words,
    tip: p.tip ? p.tip.length : 0,
  });
}

lines.push(`out/ 里找不到对应页面：${missing} 条`);
lines.push(`没有 tip（当前页主要的信息增量来源）：${noTip} 条`);
lines.push("");

const sorted = [...rows].sort((a, b) => a.words - b.words);
const nums = sorted.map((r) => r.words);
const sum = nums.reduce((a, b) => a + b, 0);
const med = nums[Math.floor(nums.length / 2)];
lines.push(
  `页面正文字数：min ${nums[0]} / 中位 ${med} / max ${nums[nums.length - 1]} / 均值 ${Math.round(
    sum / nums.length
  )}`
);
lines.push(`正文 < 250 词的页面：${nums.filter((n) => n < 250).length} 条`);
lines.push("");

lines.push("=== 最薄的 15 页（优先补）===");
lines.push("id\t英文\t中文\t分类\t正文字数\ttip字数");
for (const r of sorted.slice(0, 15)) {
  lines.push(`${r.id}\t${r.english}\t${r.cn}\t${r.cat}\t${r.words}\t${r.tip}`);
}

lines.push("");
lines.push("=== 已知高流量重点页（手动指定）===");
const KEY = [
  "thank you",
  "My Chinese isn't good",
  "Hello",
  "Sorry",
  "How much",
  "I don't understand",
  "Where is the bathroom",
  "Help",
  "Delicious",
  // ⚠ 曾写作 "I don't speak Chinese" —— 站内真实文案是 "I can't speak Chinese."（id 16），
  //   于是这行永远输出 NOT FOUND，那页也就一直没被纳入重点观察。下方有断言兜住。
  "can't speak Chinese",
  "This is the address",
  "Do you speak English",
];
lines.push("id\t英文\t中文\t分类\t正文字数\ttip字数");
const missKey = [];
for (const k of KEY) {
  const r = rows.find((x) => x.english.toLowerCase().includes(k.toLowerCase()));
  if (r) lines.push(`${r.id}\t${r.english}\t${r.cn}\t${r.cat}\t${r.words}\t${r.tip}`);
  else {
    lines.push(`-\tNOT FOUND: ${k}\t-\t-\t-\t-`);
    missKey.push(k);
  }
}
// 【为什么要有这条断言】KEY 是「这些页要一直盯着」的清单。关键词写错时它只打印一行
// NOT FOUND，没人会去读；实测 "I don't speak Chinese" 就这么漏了 id 16（真实文案是
// I can't speak Chinese.）。有断言才会在收尾处显式报出来。
lines.push("");
if (missKey.length) lines.push(`⚠ KEY 有 ${missKey.length} 条对不上任何短语（重点页观察已失效）：${missKey.join(" / ")}`);
else lines.push(`KEY ${KEY.length} 条全部对得上短语。`);

fs.writeFileSync(path.join(__dirname, "_deep-audit.txt"), lines.join("\n"), "utf8");
console.log(lines.join("\n"));
