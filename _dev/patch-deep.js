/**
 * patch-deep.js —— 给 **已存在** 的 deep.json 条目补齐小节（追加，不覆盖）。
 *
 *   node _dev/patch-deep.js _dev/_deeppatch11.json [--dry]
 *
 * 为什么它必须和 merge-deep.js 分开：
 *   `merge-deep` 是 `{...cur, ...add}` 的**整条替换**，并且**拒绝已存在的 id**
 *   （"重复 id 会静默覆盖旧内容"）—— 那是为「新增一批页」设计的。
 *   而「第十一批」这类活是给首批/第二批那 17 条老格式**补 replies / 补 mistake**，
 *   走 merge-deep 会被拒，手写 JSON 又极易插错位置 → 所以单独一个追加语义的脚本。
 *
 * 语义（只用「追加」，永不删已有内容）：
 *   variants / mistakes / replies —— push 到原有数组后面（按 zh / 前 40 字符去重）
 *   when                          —— 只在显式给出时替换（补齐批次原则上不动它）
 *
 * 退出码：0 = 写入成功；1 = 有问题，**一个字节都不写**。
 */
const fs = require("fs");

const DEEP = "data/deep.json";
const src = process.argv[2];
const dry = process.argv.includes("--dry");

if (!src) {
  console.log("用法：node _dev/patch-deep.js <补丁.json> [--dry]");
  process.exit(1);
}

/** 目标形状：与 deep-shape.js 的「当前标准」一致。 */
const MIN = { when: 2, variants: 3, mistakes: 3, replies: 3 };

function shapeErrors(id, d) {
  const errs = [];
  for (const [k, min] of Object.entries(MIN)) {
    const v = d[k];
    if (!Array.isArray(v)) errs.push(`${k} 不是数组`);
    else if (v.length < min) errs.push(`${k} 只有 ${v.length} 项，应 ≥ ${min}`);
  }
  for (const v of d.variants || []) {
    if (!v.zh || !v.py || !v.en) errs.push("variants 缺 zh/py/en");
    // deep-verify 的断言是 py.split(/[.?!]/)[0] 必须出现在正文里 → 中间夹句末标点会当场断掉
    if (v.py && /[.?!]/.test(v.py.slice(0, -1))) errs.push(`variants py 中间有句末标点：${v.py}`);
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
const patch = JSON.parse(fs.readFileSync(src, "utf8"));
const problems = [];

for (const [id, p] of Object.entries(patch)) {
  if (id === "_comment") continue;
  const old = cur[id];
  if (!old) {
    problems.push(`${id} 在 deep.json 里还不存在 —— 新增条目请用 merge-deep.js`);
    continue;
  }
  for (const k of Object.keys(p)) {
    if (!["when", "variants", "mistakes", "replies"].includes(k)) {
      problems.push(`${id} 出现未知字段 ${k}`);
    }
  }
}

if (problems.length) {
  console.log("FAIL：补丁有问题，未写入任何内容");
  for (const p of problems) console.log("  - " + p);
  process.exit(1);
}

/* ---- 逐条追加 ---- */
const report = [];
for (const [id, p] of Object.entries(patch)) {
  if (id === "_comment") continue;
  const old = cur[id];
  const next = { ...old };

  if (Array.isArray(p.when)) next.when = p.when;

  for (const key of ["variants", "mistakes", "replies"]) {
    if (!Array.isArray(p[key]) || !p[key].length) continue;
    const seen = new Set(
      (old[key] || []).map((x) => (typeof x === "string" ? x.slice(0, 40) : x.zh || ""))
    );
    const add = p[key].filter((x) => {
      const sig = typeof x === "string" ? x.slice(0, 40) : x.zh || "";
      if (seen.has(sig)) return false;
      seen.add(sig);
      return true;
    });
    next[key] = [...(old[key] || []), ...add];
  }

  const errs = shapeErrors(id, next);
  if (errs.length) {
    problems.push(`${id} 补齐后仍不达标 → ${errs.join("；")}`);
    continue;
  }
  report.push({
    id,
    before: `when${(old.when || []).length}/var${(old.variants || []).length}/mis${(old.mistakes || []).length}/rep${(old.replies || []).length}`,
    after: `when${next.when.length}/var${next.variants.length}/mis${next.mistakes.length}/rep${next.replies.length}`,
    next,
  });
}

if (problems.length) {
  console.log("FAIL：补齐后校验不通过，未写入任何内容");
  for (const p of problems) console.log("  - " + p);
  process.exit(1);
}

console.log(`== 补齐 ${report.length} 条（追加，不删已有内容）==`);
for (const r of report) console.log(`  id ${r.id.padStart(3)}  ${r.before}  →  ${r.after}`);
console.log("");

if (dry) {
  console.log("--dry：只校验不写。");
  process.exit(0);
}

// 备份名必须带数字：.gitignore 里是 `*.bak[0-9]*`（不是 `*.bak*`），
// 写成 .bakpatch 之类纯字母后缀会**漏进版本库**（实测已踩）。
fs.writeFileSync(DEEP + ".bak8", fs.readFileSync(DEEP));
const merged = { ...cur };
for (const r of report) merged[r.id] = r.next;
fs.writeFileSync(DEEP, JSON.stringify(merged, null, 2) + "\n", "utf8");

// 写后复验：重新 parse + 逐条确认形状 + _comment 还在
const back = JSON.parse(fs.readFileSync(DEEP, "utf8"));
let bad = 0;
for (const r of report) {
  const e = shapeErrors(r.id, back[r.id]);
  if (e.length) {
    bad += 1;
    console.log(`  ✗ id ${r.id} 复验失败：${e.join("；")}`);
  }
}
console.log(`写后复验 : ${report.length - bad}/${report.length} 条达标`);
console.log(`_comment : ${back._comment ? "保留 ✓" : "★丢失"}`);
console.log(`备份     : ${DEEP}.bak8`);
process.exit(bad ? 1 : 0);
