// 临时探针：评估「从已有句子派生词页」的可行性（不进 seocheck，用完可删）
const fs = require("fs");
const path = require("path");
const phrases = JSON.parse(
  fs.readFileSync(path.join(__dirname, "..", "data", "phrases.json"), "utf8")
);

const total = phrases.length;
const withWords = phrases.filter(
  (p) => Array.isArray(p.words) && p.words.length > 0
);
const all = [];
for (const p of withWords) for (const w of p.words) all.push(w);

// 唯一词（按汉字去重）
const map = new Map();
for (const p of withWords) {
  for (const w of p.words) {
    if (!map.has(w.zh)) map.set(w.zh, { ...w, sentences: [] });
    map.get(w.zh).sentences.push(p.id);
  }
}
const uniq = [...map.values()];
const multi = uniq.filter((w) => w.sentences.length >= 2).sort((a, b) => b.sentences.length - a.sentences.length);

// 拼音/英文缺失率
const missingPy = uniq.filter((w) => !w.py).length;
const missingEn = uniq.filter((w) => !w.en).length;

// 已 Theodore: 分类词 page 覆盖 — 每个唯一词出现在哪几个分类
const catOf = new Map(phrases.map((p) => [p.id, p.category]));

const lines = [];
lines.push(`phrases total: ${total}`);
lines.push(`phrases with words[]: ${withWords.length}`);
lines.push(`word entries total (with dup): ${all.length}`);
lines.push(`unique words: ${uniq.length}`);
lines.push(`words appearing in >=2 sentences: ${multi.length}`);
lines.push(`words missing pinyin: ${missingPy}`);
lines.push(`words missing english: ${missingEn}`);
lines.push("");
lines.push("TOP 25 words by #sentences:");
for (const w of multi.slice(0, 25)) {
  const cats = [...new Set(w.sentences.map((id) => catOf.get(id)))].join(",");
  lines.push(
    `  ${w.zh}  ${w.py}  ${w.en}  -> ${w.sentences.length} sentences [${cats}] ids=${w.sentences.join(",")}`
  );
}
lines.push("");
const singles = uniq.length - multi.length;
lines.push(`words appearing in exactly 1 sentence: ${singles}`);

fs.writeFileSync(path.join(__dirname, "_words-probe.txt"), lines.join("\n"), "utf8");
console.log(lines.join("\n"));
