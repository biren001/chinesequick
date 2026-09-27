/**
 * 打印 verify-saved.txt 的结论：失败项 + 清单相关步骤。
 * 用法：node _dev/vs-summary.js
 */
const fs = require("fs");
const j = JSON.parse(fs.readFileSync("_dev/verify-saved.txt", "utf8"));
const F = j.failures || j.fails || j.errors || [];
console.log("base:", j.base);
console.log("步骤数:", (j.steps || []).length);
console.log("失败数:", Array.isArray(F) ? F.length : JSON.stringify(F));
if (Array.isArray(F)) F.forEach((x) => console.log("  ✗", x));
else console.log(F);

console.log("\n== 清单相关步骤 ==");
(j.steps || [])
  .filter((s) => String(s.path).includes("china-travel-checklist"))
  .forEach((s) => {
    console.log("-", s.note);
    console.log("  ", JSON.stringify(s.value));
  });
