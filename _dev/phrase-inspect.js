/**
 * phrase-inspect.js —— 写批次前看某几条短语的现状 + 查变体重叠
 *
 * 为什么需要它：`data/deep.json` 里写 `when` 会**替换**掉 `phrases.json` 的 `tip`
 * （`PhraseView` 里两者三元互斥），所以动笔前必须先把 tip 读一遍，保证
 * ①`when` 的信息量 ≥ tip ②`mistakes` 不与 tip 对同一事实给出不同口径。
 * 另外新写的变体（`variants[].zh`）不能是别的短语的主句 —— 那会造成两页说同一件事。
 * 这两件事每个批次都要做，靠 `node -e` 拼长命令会被 bash 吃掉转义符（实测），所以固化到这里。
 *
 * 🔴 **schema 断言**：字段名取错会静默读出 `undefined`，然后连带刷出一堆假警告
 * （第一版把 `chinese` 写成 `zh`，于是「本批有两条同句：都是 undefined」报了 7 条）。
 * 所以这里**先验字段再干活**，缺字段直接 exit 1 —— 这正是 skill 里那条
 * 「清单类配置必须自带『解析得到实体』断言」用在自建工具上。
 *
 * 用法：
 *   node _dev/phrase-inspect.js 79 7 19 15 33 27 98 49
 *   node _dev/phrase-inspect.js 79 --overlap 水 出发 火车站      # 同时查重叠
 *   node _dev/phrase-inspect.js --overlap 结账                  # 只查重叠
 *
 * （「列最薄 15 页」用 `node _dev/deep-audit.js`，不要在这里重复实现。）
 */
const fs = require("fs");

const P = JSON.parse(fs.readFileSync("data/phrases.json", "utf8"));
const arr = Array.isArray(P) ? P : P.phrases;
const REQUIRED = ["id", "category", "chinese", "pinyin", "english", "tip"];
const missing = REQUIRED.filter((k) => !(k in arr[0]));
if (missing.length) {
  console.log("FAIL: phrases.json 缺少字段 " + JSON.stringify(missing));
  console.log("      实际字段：" + Object.keys(arr[0]).join(", "));
  console.log("      字段名改过就改这里（REQUIRED），别让取不到值的地方静默变 undefined。");
  process.exit(1);
}

const byId = new Map(arr.map((p) => [p.id, p]));
const deep = fs.existsSync("data/deep.json") ? JSON.parse(fs.readFileSync("data/deep.json", "utf8")) : {};

const argv = process.argv.slice(2);
const ids = [];
const overlaps = [];
let mode = "inspect";
for (const a of argv) {
  if (a === "--overlap") mode = "overlap";
  else if (/^\d+$/.test(a)) ids.push(Number(a));
  else overlaps.push(a);
}

let bad = 0;

if (ids.length) {
  console.log("=== 短语现状（" + ids.length + " 条）===");
  console.log("");
  for (const id of ids) {
    const p = byId.get(id);
    if (!p) {
      console.log("--- id " + id + "  ★NOT FOUND（清单里的 id 对不上短语，别再往下写）");
      bad++;
      continue;
    }
    console.log(
      "--- id " + id + "  [" + p.category + "]  " + (deep[id] ? "★已深化（重复写会覆盖！）" : "未深化")
    );
    console.log("    zh  : " + p.chinese);
    console.log("    py  : " + p.pinyin);
    console.log("    en  : " + p.english);
    console.log("    tip : " + (p.tip || "（无）"));
    if (deep[id]) {
      console.log("    现有 when[0] : " + ((deep[id].when || [])[0] || "（无）"));
      console.log("    现有 variants: " + JSON.stringify((deep[id].variants || []).map((v) => v.zh)));
    }
    console.log("");
  }

  const picked = ids.map((id) => byId.get(id)).filter(Boolean);
  console.log("=== 本批 tip 汇总（写 when / mistakes 时不许与它们打架）===");
  for (const p of picked) console.log("  id " + p.id + ": " + (p.tip || "（无）"));
  console.log("");

  const seen = new Map();
  for (const p of picked) {
    if (seen.has(p.chinese)) {
      console.log("⚠ 本批有两条同句：id " + seen.get(p.chinese) + " 与 id " + p.id + " 都是「" + p.chinese + "」");
    }
    seen.set(p.chinese, p.id);
  }
}

if (overlaps.length) {
  console.log("=== 重叠检查：这些串是否已是别的短语的主句或已有变体 ===");
  console.log("    （命中主句 = 会造成两页说同一件事，换一个说法）");
  console.log("");
  const deepVariants = [];
  for (const [id, d] of Object.entries(deep)) {
    if (id === "_comment") continue;
    for (const v of d.variants || []) deepVariants.push({ id, zh: v.zh });
  }
  for (const k of overlaps) {
    const asMain = arr.filter((x) => String(x.chinese).includes(k)).map((x) => x.id + ":" + x.chinese);
    const asVariant = deepVariants.filter((x) => String(x.zh).includes(k)).map((x) => "deep#" + x.id + ":" + x.zh);
    console.log("  「" + k + "」");
    console.log("      主句 : " + (asMain.length ? asMain.join("  |  ") : "—"));
    console.log("      变体 : " + (asVariant.length ? asVariant.join("  |  ") : "—"));
  }
  console.log("");
}

if (bad) {
  console.log("VERDICT: FAIL —— " + bad + " 个 id 在 phrases.json 里不存在");
  process.exitCode = 1;
}
