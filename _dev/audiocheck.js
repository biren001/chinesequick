/**
 * 音频一致性检查（改内容或改音频后必跑）。
 *
 * 检查四件事：
 *   1. lib/audio.ts 里引用的每个 mp3 都真实存在；
 *   2. public/audio 下每个 mp3 都被 lib/audio.ts 引用（孤儿 = 白发进包里的体积）；
 *   3. 每条短语的整句 + 慢速音频都在；
 *   4. public/audio/manifest.json 与短语数量一致（SW 预缓存清单别漏条目）。
 *
 * 用法：<managed node> _dev/audiocheck.js
 */
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const PUB = path.join(ROOT, "public", "audio");
const TS = path.join(ROOT, "lib", "audio.ts");

const fail = [];
const warn = [];

const ts = fs.readFileSync(TS, "utf8");
const refs = [...ts.matchAll(/"(\/audio\/[^"]+\.mp3)"/g)].map((m) => m[1]);
const unique = new Set(refs);

const missing = [...unique].filter((u) => !fs.existsSync(path.join(ROOT, "public", u)));
if (missing.length) fail.push(`引用但不存在（${missing.length}）：${missing.slice(0, 10).join(", ")}`);

const disk = [];
(function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p);
    else if (e.name.endsWith(".mp3")) disk.push("/audio" + p.slice(PUB.length).split(path.sep).join("/"));
  }
})(PUB);

const orphans = disk.filter((f) => !unique.has(f));
if (orphans.length) warn.push(`孤儿音频（${orphans.length}）：${orphans.join(", ")}`);

const phrases = JSON.parse(fs.readFileSync(path.join(ROOT, "data", "phrases.json"), "utf8"));
const need = [];
for (const p of phrases) {
  need.push(`/audio/${p.id}.mp3`, `/audio/slow/${p.id}.mp3`);
}
const lack = need.filter((u) => !fs.existsSync(path.join(ROOT, "public", u)));
if (lack.length) fail.push(`短语音频缺失（${lack.length}）：${lack.slice(0, 10).join(", ")}`);

const manifest = JSON.parse(fs.readFileSync(path.join(PUB, "manifest.json"), "utf8"));
if (manifest.length !== phrases.length) {
  fail.push(`manifest.json 有 ${manifest.length} 条，短语有 ${phrases.length} 条 — 不一致`);
}

// 逐词表里的每个词都要有音频
const words = new Set();
for (const p of phrases) for (const w of p.words || []) words.add(w.zh);
const wordAudioKeys = new Set([...ts.matchAll(/^  "([^"]+)": "\/audio\/words\//gm)].map((m) => m[1]));
const wordLack = [...words].filter((zh) => !wordAudioKeys.has(zh));

// 数字表：data/numbers.json 是唯一事实来源，/chinese-numbers/ 专页直接遍历它渲染。
// 少一条音频不会报错，只会在页面上留下一个静默的按钮 —— 所以必须断言。
const numbers = JSON.parse(fs.readFileSync(path.join(ROOT, "data", "numbers.json"), "utf8"));
const numberAudioKeys = new Set(
  [...ts.matchAll(/^  "([^"]+)": "\/audio\/numbers\//gm)].map((m) => m[1])
);
const numberLack = numbers.filter((n) => !numberAudioKeys.has(n.zh)).map((n) => n.zh);
if (numberLack.length) {
  fail.push(`数字音频缺失（${numberLack.length}）：${numberLack.join("、")}`);
}
const numberOrphans = [...numberAudioKeys].filter((zh) => !numbers.some((n) => n.zh === zh));
if (numberOrphans.length) {
  warn.push(`数字音频多出（${numberOrphans.length}）：${numberOrphans.join("、")}`);
}

const total = disk.reduce((sum, f) => sum + fs.statSync(path.join(ROOT, "public", f)).size, 0);
console.log(`短语 ${phrases.length} 条 · 音频文件 ${disk.length} 个 · ${(total / 1024 / 1024).toFixed(2)} MB`);
console.log(`引用 ${unique.size} 条 · 逐词 ${words.size} 个（缺音频 ${wordLack.length}）`);
console.log(`数字 ${numbers.length} 个（缺音频 ${numberLack.length}）`);
console.log(`离线清单 ${manifest.length} 条`);

if (wordLack.length) console.log(`逐词音频缺失：${wordLack.slice(0, 12).join("、")}`);
for (const w of warn) console.log("WARN " + w);

if (fail.length) {
  console.log("");
  for (const f of fail) console.log("FAIL " + f);
  process.exit(1);
}
console.log("\n全部通过");
