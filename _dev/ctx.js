/**
 * 打印某个字符串在文件里的出现上下文（HTML 是压缩成单行的，Grep 只看得到
 * "Omitted long matching line"）。一次性排查工具。
 *
 * 用法：node _dev/ctx.js <文件> <要查的字符串>
 */
const fs = require("fs");
const file = process.argv[2];
const needle = process.argv[3];
const t = fs.readFileSync(file, "utf8");
let i = 0;
let n = 0;
while ((i = t.indexOf(needle, i)) !== -1 && n < 6) {
  console.log("--- match " + (n + 1) + " @" + i + " ---");
  console.log(JSON.stringify(t.slice(Math.max(0, i - 200), i + 120)));
  i += needle.length;
  n++;
}
console.log("total occurrences:", t.split(needle).length - 1);
