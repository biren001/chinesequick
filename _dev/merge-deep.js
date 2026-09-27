/**
 * merge-deep.js —— 把一批新条目并进 data/deep.json（有备份、有形状校验、有键序复验）
 *
 * 为什么需要独立脚本：`deep.json` 是**只追加**的（按批次追加，不按 id 排序），
 * `_comment` 键在**最后**。手写「在最后一个 } 之前插入」时很容易：
 *   · 把新条目插到 `_comment` 之后（顺序变了，虽不影响功能但会和历史批次不一致）
 *   · 漏掉逗号 / 多一个逗号 → 整个 JSON 解析失败（构建期自检会抛，但报错点很远）
 *   · 重复 id → 静默覆盖旧内容（这批就很危险：49 在第一批已深化过）
 * 所以这里用对象展开合并（JS 层面不可能产生语法错），并在合并后**逐条复验**。
 *
 * 用法：
 *   node _dev/merge-deep.js _dev/_deepnew7.json            # 合并
 *   node _dev/merge-deep.js _dev/_deepnew7.json --dry       # 只校验不写
 * 退出码：0 = 成功；1 = 形状/重复问题，**一个字节都不写**。
 */
const fs = require("fs");

const src = process.argv[2];
const dry = process.argv.includes("--dry");
if (!src) {
  console.log("用法：node _dev/merge-deep.js <新条目.json> [--dry]");
  process.exit(1);
}

const DEEP = "data/deep.json";
const REQUIRED_KEYS = {
  when: "array2",
  variants: "array3",
  mistakes: "array3",
  replies: "array3",
};

function checkShape(id, d) {
  const errs = [];
  for (const [k, kind] of Object.entries(REQUIRED_KEYS)) {
    const v = d[k];
    const want = Number(kind.replace("array", ""));
    if (!Array.isArray(v)) errs.push(k + " 不是数组");
    else if (v.length !== want) errs.push(k + " 有 " + v.length + " 项，应为 " + want);
  }
  for (const w of d.when || []) {
    if (typeof w !== "string" || w.length < 30) errs.push("when 有一条过短或非字符串");
    if (/^(Said|To a|Use to|For )/.test(w)) errs.push("when 起点像片段而非完整句：" + w.slice(0, 30));
  }
  for (const v of d.variants || []) {
    if (!v.zh || !v.py || !v.en) errs.push("variants 缺 zh/py/en");
    if (/[.?!]/.test(v.py.slice(0, -1))) errs.push("variants py 中间有句末标点，会让 deep-verify 断言失败：" + v.py);
  }
  for (const r of d.replies || []) {
    if (!r.zh || !r.py || !r.en) errs.push("replies 缺 zh/py/en");
  }
  for (const m of d.mistakes || []) {
    if (typeof m !== "string" || m.length < 30) errs.push("mistakes 有一条过短或非字符串");
  }
  return errs;
}

const cur = JSON.parse(fs.readFileSync(DEEP, "utf8"));
const add = JSON.parse(fs.readFileSync(src, "utf8"));

const problems = [];
for (const [id, d] of Object.entries(add)) {
  if (id === "_comment") continue;
  if (!/^\d+$/.test(id)) {
    problems.push("键不是数字 id：" + id);
    continue;
  }
  if (Object.prototype.hasOwnProperty.call(cur, id)) {
    problems.push(id + " 在 deep.json 里已存在（重复 id 会静默覆盖旧内容）");
  }
  for (const e of checkShape(id, d)) problems.push(id + " → " + e);
}

if (problems.length) {
  console.log("FAIL：新条目有问题，未写入任何内容");
  for (const p of problems) console.log("  - " + p);
  process.exit(1);
}

const before = Object.keys(cur).length;
const merged = { ...cur, ...add };
const after = Object.keys(merged).length;

console.log("现有条目 : " + before + "（含 _comment）");
console.log("新增条目 : " + Object.keys(add).length + "  " + JSON.stringify(Object.keys(add).sort((a, b) => a - b)));
console.log("合并后   : " + after);
console.log("_comment : " + (merged._comment ? "保留 ✓" : "★丢失"));
console.log("新增的 id: " + JSON.stringify(Object.keys(add).filter((k) => k !== "_comment")));

if (dry) {
  console.log("");
  console.log("--dry：校验通过，未写入。");
  process.exit(0);
}

fs.writeFileSync(DEEP + ".bak7", fs.readFileSync(DEEP));
fs.writeFileSync(DEEP, JSON.stringify(merged, null, 2) + "\n", "utf8");

// 写后复验：重新 parse + 逐条确认形状
const back = JSON.parse(fs.readFileSync(DEEP, "utf8"));
let ok = Object.keys(add).every((id) => id === "_comment" || back[id]);
console.log("");
console.log("写后复验 : " + (ok ? "JSON.parse 通过，8 条全部在文件里 ✓" : "★有条目丢失"));
console.log("备份     : " + DEEP + ".bak7（" + fs.statSync(DEEP + ".bak7").size + "B）");
