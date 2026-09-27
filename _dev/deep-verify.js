/**
 * deep-verify.js —— 确认 deep.json 的内容真的 SSR 进了产物。
 *
 * 光看 word count 涨了不足以证明「是那段内容涨的」——
 * 也可能只是脚本的统计口径变了。所以逐条校对可见文本，
 * 顺便给每个新小节留一条断言，以后改坏了会立刻红。
 */
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const OUT = path.join(ROOT, "out");
const phrases = JSON.parse(
  fs.readFileSync(path.join(ROOT, "data", "phrases.json"), "utf8")
);
const deepRaw = JSON.parse(
  fs.readFileSync(path.join(ROOT, "data", "deep.json"), "utf8")
);

function slugify(s) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
const pageSlug = (p) => p.slug || slugify(p.english);

function readPage(p) {
  const f = path.join(OUT, "how-to-say-" + pageSlug(p) + "-in-chinese", "index.html");
  return fs.existsSync(f) ? fs.readFileSync(f, "utf8") : null;
}

// 只取 HTML 正文，剥掉 <script>（含 RSC flight payload），
// 否则同样的句子会被数两遍。
function visibleText(html) {
  const body = html.slice(html.indexOf("<body"));
  return body
    .replace(/<script[\s\S]*?<\/script>/g, " ")
    .replace(/<style[\s\S]*?<\/style>/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#x27;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&ldquo;|&rdquo;/g, '"')
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const ids = Object.keys(deepRaw).filter((k) => k !== "_comment");
const rows = [];
const fails = [];

for (const id of ids) {
  const p = phrases.find((x) => String(x.id) === id);
  if (!p) {
    fails.push(`deep.json 的 id ${id} 在 phrases.json 里不存在`);
    continue;
  }
  const html = readPage(p);
  if (!html) {
    fails.push(`找不到 id ${id} (${p.english}) 的页面产物`);
    continue;
  }
  const text = visibleText(html);
  const d = deepRaw[id];

  const checks = {
    headingWhen: text.includes("When you use it"),
    headingVariants: (d.variants?.length ?? 0) > 0
      ? text.includes("Other ways people say it")
      : true,
    headingMistakes: (d.mistakes?.length ?? 0) > 0
      ? text.includes("What usually trips people up")
      : true,
    headingReplies: (d.replies?.length ?? 0) > 0
      ? text.includes("What you might hear back")
      : true,
  };
  // 每一条 when / mistake / variant 的汉字或英文都要在正文里出现
  const missingWhen = (d.when ?? []).filter((s) => !text.includes(s.slice(0, 40)));
  const missingMistake = (d.mistakes ?? []).filter((s) => !text.includes(s.slice(0, 40)));
  const missingVariant = (d.variants ?? []).filter((v) => !text.includes(v.zh));
  const missingPinyin = (d.variants ?? []).filter((v) => !text.includes(v.py.split(/[.?!]/)[0]));

  for (const [k, ok] of Object.entries(checks)) {
    if (!ok) fails.push(`id ${id} 缺少小节标题：${k}`);
  }
  for (const s of missingWhen) fails.push(`id ${id} when 未渲染：${s.slice(0, 40)}…`);
  for (const s of missingMistake) fails.push(`id ${id} mistake 未渲染：${s.slice(0, 40)}…`);
  for (const v of missingVariant) fails.push(`id ${id} variant 缺失汉字：${v.zh}`);
  for (const v of missingPinyin) fails.push(`id ${id} variant 缺失拼音：${v.py}`);

  const beforeTextLen = text.length;
  rows.push({
    id,
    en: p.english,
    cn: p.chinese,
    when: d.when?.length ?? 0,
    variants: d.variants?.length ?? 0,
    mistakes: d.mistakes?.length ?? 0,
    replies: d.replies?.length ?? 0,
    chars: beforeTextLen,
    allRendered:
      Object.values(checks).every(Boolean) &&
      !missingWhen.length &&
      !missingMistake.length &&
      !missingVariant.length &&
      !missingPinyin.length,
  });
}

const lines = [];
lines.push("=== 深度内容 SSR 校验 ===");
lines.push(`deep.json 覆盖 ${ids.length} 条短语 / 全站 ${phrases.length} 条`);
lines.push("");
lines.push("id\t英文\t中文\twhen\tvariants\tmistakes\treplies\t正文字符\t全渲染");
for (const r of rows) {
  lines.push(
    `${r.id}\t${r.en}\t${r.cn}\t${r.when}\t${r.variants}\t${r.mistakes}\t${r.replies}\t${r.chars}\t${r.allRendered ? "YES" : "NO"}`
  );
}
lines.push("");
if (fails.length === 0) {
  lines.push("verdict: PASS —— 所有 deep 内容都真的渲染进了产物");
} else {
  lines.push(`verdict: FAIL —— ${fails.length} 项`);
  for (const f of fails) lines.push("  - " + f);
}

fs.writeFileSync(path.join(__dirname, "_deep-verify.txt"), lines.join("\n"), "utf8");
console.log(lines.join("\n"));
if (fails.length) process.exit(1);
