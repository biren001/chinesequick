/**
 * probe-live.js —— 用 node 读线上 HTML 来核验，绕开 PowerShell 的编码坑。
 *
 * 起因：Invoke-WebRequest 的 $Response.Content 会按它自己猜的字符集解码，
 *      结果英文能匹配上、中文全匹配不上 —— 看起来像「变体没渲染」，
 *      其实是探针的解码问题。所有涉及中文的线上核验都走这个脚本。
 *
 * 用法：node _dev/probe-live.js <本地已下载的 html 文件> [关键词...]
 */
const fs = require("fs");
const file = process.argv[2];
const wanted = process.argv.slice(3);

const html = fs.readFileSync(file, "utf8");
console.log("file:", file, "bytes:", Buffer.byteLength(html, "utf8"));

const DEFAULTS = [
  "Other ways people say it",
  "What usually trips people up",
  "What you might hear back",
  "When you use it",
  "谢谢你",
  "太谢谢了",
  "谢谢大家",
  "an everyday",
];
const terms = wanted.length ? wanted : DEFAULTS;

for (const t of terms) {
  console.log(`${t}\t->\t${html.includes(t) ? "FOUND" : "MISSING"}`);
}
// 顺带看 SSR 里有没有变体拼音失 DNA 的情况
console.log("a everyday ->", html.includes("a everyday") ? "FOUND(BAD)" : "absent(good)");
