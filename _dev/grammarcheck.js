/**
 * 英文语法体检（定冠词误用）。
 *
 * 背景：单句页 FAQ 正文原本写死 `It is a ${分类名} phrase you would use in China.`，
 * 而 everyday / emergency 是元音开头 → "It is a everyday phrase"。
 * 这句是**页面上可见的正文**，也正是 Google 拿去当 SERP 摘要的那段
 * （2026-09-27 实测：搜 `How to say "My Chinese isn't good" in Chinese`，
 *  chinesequick.com 排第 1，摘要里引的就是这句错话）。
 * 修复在 lib/jsonld.ts 的 articleFor()。
 *
 * 用法：node _dev/grammarcheck.js
 * 结果写 _dev/grammarcheck.txt
 */
const fs = require('fs');
const path = require('path');

const OUT = 'out';

function walk(dir, acc = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, acc);
    else if (e.name.endsWith('.html')) acc.push(p);
  }
  return acc;
}

function textOf(h) {
  return h
    .replace(/<script[\s\S]*?<\/script>/g, ' ')
    .replace(/<style[\s\S]*?<\/style>/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const files = walk(OUT);
const wrong = [];
const byPhrase = {};
let checked = 0;

for (const f of files) {
  const t = textOf(fs.readFileSync(f, 'utf8'));
  for (const m of t.matchAll(/It is (a|an) ([a-z]+) phrase you would use/g)) {
    checked += 1;
    const word = m[2];
    const want = /^[aeiou]/.test(word) ? 'an' : 'a';
    byPhrase[`${m[1]} ${word}`] = (byPhrase[`${m[1]} ${word}`] || 0) + 1;
    if (m[1] !== want) {
      wrong.push({ file: path.relative(OUT, f), got: m[0], shouldBe: `It is ${want} ${word}` });
    }
  }
}

// 页面数（不是命中数）：一个页面正文里只应出现一次这句 FAQ
const pagesWith = new Set();
for (const f of files) {
  const t = textOf(fs.readFileSync(f, 'utf8'));
  if (/It is (a|an) [a-z]+ phrase you would use/.test(t)) pagesWith.add(f);
}

const report = {
  htmlFiles: files.length,
  occurrences: checked,
  pagesWithFaqSentence: pagesWith.size,
  variants: byPhrase,
  wrong: wrong.length,
  wrongList: wrong.slice(0, 10),
  verdict: wrong.length === 0 ? 'PASS' : 'FAIL',
};
fs.writeFileSync('_dev/grammarcheck.txt', JSON.stringify(report, null, 2), 'utf8');
console.log(report.verdict, '| 命中', checked, '| 页面', pagesWith.size, '| 错误', wrong.length);
if (wrong.length) console.log(JSON.stringify(wrong.slice(0, 5), null, 2));
