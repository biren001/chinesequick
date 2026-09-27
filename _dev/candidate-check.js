/**
 * candidate-check.js —— 核实「外部评审提议的词」是否真的存在于本站数据里。
 *
 * 背景：评审一边说「具体名单应该从你实际的 105 个句子数据里算，而不是凭感觉」，
 *      一边给出的候选词是从通用汉语学习经验里来的。这个脚本就是那把尺子。
 *
 * 用法：node _dev/candidate-check.js [词1] [词2] ...
 *      不传词则跑内置的那份外部候选名单。
 */
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const phrases = JSON.parse(
  fs.readFileSync(path.join(ROOT, "data", "phrases.json"), "utf8")
);

// 语法功能词 / 代词：它们高频，但不适合做「旅行词页」（评审自己也这么说）
const FUNCTION_WORDS = new Set([
  "我", "你", "他", "她", "它", "们", "的", "了", "吗", "呢", "吧", "啊",
  "是", "在", "有", "不", "也", "就", "都", "很", "太", "还", "而", "把",
  "被", "让", "给", "对", "和", "跟", "我", "这个", "那个", "这", "那",
]);

const slots = [];
for (const p of phrases) {
  for (const w of p.words || []) {
    slots.push({ zh: w.zh, py: w.py, en: w.en, id: p.id, cat: p.category });
  }
}

const groups = new Map();
for (const s of slots) {
  if (!groups.has(s.zh)) groups.set(s.zh, []);
  groups.get(s.zh).push(s);
}

const all = [...groups.entries()].map(([zh, list]) => ({
  zh,
  py: list[0].py,
  en: list[0].en,
  n: list.length,
  cats: [...new Set(list.map((x) => x.cat))],
  ids: [...new Set(list.map((x) => x.id))],
}));

const argWords = process.argv.slice(2).filter(Boolean);
const DEFAULT_CANDIDATES = [
  "要", "可以", "需要", "方便", "多少钱", "哪里", "这里", "那里",
  "现在", "帮", "找", "给", "要不要", "可以吗", "怎么", "什么",
];
const wanted = argWords.length ? argWords : DEFAULT_CANDIDATES;

const lines = [];
lines.push("=== 外部候选词核账：提议的词 vs 站里真实存在的词 ===");
lines.push(`站点：${phrases.length} 句 / ${slots.length} 词条 / ${all.length} 唯一词`);
lines.push("");
lines.push("候选词\t拼音\t出现句数\t英文\t所在分类");
let hit = 0;
let miss = 0;
for (const w of wanted) {
  const g = all.find((x) => x.zh === w);
  if (g) {
    hit++;
    lines.push(
      `FOUND\t${w}\t${g.py}\t${g.n}\t${g.en}\t${g.cats.join(",")}`
    );
  } else {
    miss++;
    lines.push(`MISSING\t${w}\t-\t0\t-\t-`);
  }
}
lines.push("");
lines.push(`命中 ${hit} / ${wanted.length}，缺失 ${miss} / ${wanted.length}`);

lines.push("");
lines.push("=== 本站真实候选：剔除功能词后，按「出现句数」排序（>=2 句）===");
lines.push("词\t拼音\t英文\t句数\t分类\t句 id");
const real = all
  .filter((x) => x.n >= 2 && !FUNCTION_WORDS.has(x.zh))
  .sort((a, b) => b.n - a.n || a.zh.localeCompare(b.zh));
for (const c of real) {
  lines.push(`${c.zh}\t${c.py}\t${c.en}\t${c.n}\t${c.cats.join(",")}\t${c.ids.join(",")}`);
}
lines.push("");
lines.push(`合计 ${real.length} 个 —— 这就是整个 Word Hub 候选池的真实大小。`);

fs.writeFileSync(path.join(__dirname, "_candidates.txt"), lines.join("\n"), "utf8");
console.log(lines.join("\n"));
