/**
 * 短语 URL 锁（slug lock）。
 *
 * 背景：单句页的 URL 由英文文案生成（/how-to-say-<english-slug>-in-chinese）。
 * 但英文文案是会改的 —— 翻译腔要修、错句要替换。2026-09-27 就发生了：
 * 用户从 Google SERP 看到 `How to say "It's this address" in Chinese` 很别扭，
 * 要改成 "This is the address."，而这一改就会把**已经被收录**的 URL 换掉。
 *
 * 解法是在数据里加 `slug` 覆盖字段（见 lib/types.ts），让改文案不改 URL。
 * 这个脚本就是那道保险：把当前上线过的 URL 全量记在 _dev/sluglock.json，
 * 之后任何一次构建只要少了其中任何一条，就报错。
 *
 * 用法：
 *   node _dev/sluglock.js              校验（构建后跑）
 *   node _dev/sluglock.js --write      重新生成锁（只在新页面**有意**新增时用）
 *
 * 注意：只锁「单句页」。分类页 / 场景页的 URL 是手写的常量，本来就不会漂。
 */
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const outDir = path.join(root, "out");
const lockFile = path.join(__dirname, "sluglock.json");

const PREFIX = "how-to-say-";
const SUFFIX = "-in-chinese";

// 已删除 URL 的静态跳转页（见 _dev/make-redirect-stubs.js）也叫 how-to-say-*-in-chinese，
// 但**不是单句页**。不剔除的话它们会被当成「新增 URL」刷成假警报，
// 而假警报会训练人忽略真警报 —— 下一次真丢了 URL 就没人看了。
const STUB_MARKER = "cq-redirect-stub";

function builtPhraseUrls() {
  if (!fs.existsSync(outDir)) {
    throw new Error(`构建产物不存在：${outDir}（先跑 next build）`);
  }
  return fs
    .readdirSync(outDir, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .filter((n) => n.startsWith(PREFIX) && n.endsWith(SUFFIX))
    .filter((n) => {
      const f = path.join(outDir, n, "index.html");
      return fs.existsSync(f) && !fs.readFileSync(f, "utf8").includes(STUB_MARKER);
    })
    .sort();
}

const actual = builtPhraseUrls();
const write = process.argv.includes("--write");
const lines = [];

if (write || !fs.existsSync(lockFile)) {
  fs.writeFileSync(lockFile, JSON.stringify(actual, null, 2) + "\n", "utf8");
  lines.push(`写入锁文件：_dev/sluglock.json（${actual.length} 条单句页 URL）`);
  lines.push("PASS: 已生成（下次构建起开始校验）");
} else {
  const locked = JSON.parse(fs.readFileSync(lockFile, "utf8"));
  const lockedSet = new Set(locked);
  const actualSet = new Set(actual);
  const missing = locked.filter((u) => !actualSet.has(u));
  const added = actual.filter((u) => !lockedSet.has(u));

  lines.push(`锁内 URL : ${locked.length}`);
  lines.push(`实际 URL : ${actual.length}`);

  if (missing.length) {
    lines.push("");
    lines.push(`【失败】${missing.length} 条已上线的 URL 在本次构建里消失了：`);
    for (const u of missing) lines.push(`  - /${u}`);
    lines.push("");
    lines.push("原因通常是：改了某条短语的 english，却没有给它加 `slug` 覆盖字段。");
    lines.push("正确做法：在 data/phrases.json 里给该条补上 \"slug\": \"<旧 URL 中间那截>\"。");
    lines.push("（确实要故意下线这些 URL 时，才用 --write 重建锁文件。）");
  }

  if (added.length) {
    lines.push("");
    lines.push(`新增 URL（${added.length} 条，正常情况是加了新短语）：`);
    for (const u of added) lines.push(`  + /${u}`);
    if (!missing.length) {
      lines.push("提醒：新短语是**有意**加的，请跑 --write 把锁更新掉，否则下次它会一直显示为新增。");
    }
  }

  if (!missing.length) lines.push("", "PASS: 没有已上线的单句页 URL 丢失");
}

fs.writeFileSync(path.join(__dirname, "sluglock.txt"), lines.join("\n") + "\n", "utf8");
console.log(lines.join("\n"));
process.exit(lines.some((l) => l.includes("【失败】")) ? 1 : 0);
