/**
 * 清单页改造后的专项核对（一次性检查脚本，可反复跑）。
 *
 * 由 bash 里 `node -e` 传含引号的代码片段会被 shell 吃掉反斜杠和引号
 * （踩过两次），所以这类检查一律写成文件。
 */
const fs = require("fs");

const s = JSON.parse(fs.readFileSync("_dev/seocheck.txt", "utf8"));
const c = s.checklist;
console.log("== 清单页 ==");
console.log("checkboxes      ", c.checkboxes, "(期望 17)");
console.log("stagesShown     ", c.stagesShown, "(期望 3)");
console.log("topicLabelsShown", c.topicLabelsShown, "(期望 3)");
console.log("internalLinks   ", c.internalLinks);
console.log("externalSources ", c.externalSources, "(期望 3)");
console.log("lastCheckedShown", c.lastCheckedShown);
console.log("textLen         ", c.textLen);

const cat = fs.readFileSync("out/chinese-money-phrases/index.html", "utf8");
const catNews = fs.readFileSync("out/chinese-travel-phrases/index.html", "utf8");
console.log("\n== 分类页 → 清单页 反向互链 ==");
console.log("money 页   ", /href="\/china-travel-checklist\/?"/.test(cat));
console.log("travel 页  ", /href="\/china-travel-checklist\/?"/.test(catNews));

const g = JSON.parse(fs.readFileSync("_dev/linkgraph.txt", "utf8"));
console.log("\n== 链接图 ==");
console.log("孤岛  ", JSON.stringify(g.islands || []));
console.log("死链  ", JSON.stringify((g.deadLinks || []).slice(0, 8)));
console.log("低入链", JSON.stringify(g.lowInbound || []));
const cl = (g.inbound || []).find((r) => Array.isArray(r) && String(r[0]).includes("china-travel-checklist"));
console.log("清单页入链数", cl ? cl[1] : "(未在 inbound 列表)");
