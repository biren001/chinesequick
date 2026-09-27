/**
 * live-diff.js — live-version-check 报「不一致」而哨兵解释不了时用：看差异到底是
 * 「框架管线噪音」还是「真的缺内容」。
 *   node _dev/live-diff.js <base> <urlPath>
 *
 * 【别再回到逐字节比对】Next 每次构建会在 HTML 里撒一堆构建相关的字节：<!DOCTYPE> 后的
 * 构建 ID 注释、RSC flight 载荷里的 "b":"<buildId>"、以及 $L19 / $undefined 这类节点引用。
 * 逐字节比对的结果是「任何两个不同构建的产物全站 136 页都不一致」，用户每次看到 FAIL 就
 * 会学会忽略它。正确做法是比对「剥离 script/style 后的可见文本」—— 用户看不到的框架管线
 * 不该参与「内容是否同版」的判断。
 */
const https = require("https");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const OUT = path.join(process.cwd(), "out");

const raw = require("./baseurl.js").normalizeBase(process.argv[2] || "", "https://chinesequick.com");
const urlPath = process.argv[3] || "/";

/** 剥离脚本样式后再嘈杂地压成文本：只剩用户真正能看到的东西。 */
function visibleText(html) {
  return html
    .replace(/<script\b[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[\s\S]*?<\/style>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&[a-zA-Z#0-9]+;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const sha = (s) => crypto.createHash("sha256").update(s, "utf8").digest("hex").slice(0, 12);

function get(urlStr) {
  return new Promise((resolve, reject) => {
    const u = new URL(urlStr);
    const req = https.request(
      { host: u.hostname, port: 443, path: u.pathname + u.search, method: "GET",
        headers: { Accept: "*/*", "Accept-Encoding": "identity" }, timeout: 30000 },
      (res) => { const c = []; res.on("data", (d) => c.push(d)); res.on("end", () => resolve({ status: res.statusCode, body: Buffer.concat(c).toString("utf8") })); }
    );
    req.on("error", reject); req.on("timeout", () => req.destroy(new Error("timeout"))); req.end();
  });
}

(async () => {
  const rel = urlPath === "/" ? "index.html" : urlPath.replace(/^\/|\/$/g, "") + "/index.html";
  const file = path.join(OUT, rel);
  if (!fs.existsSync(file)) { console.log("MISSING local " + file); process.exit(1); }
  const localRaw = fs.readFileSync(file, "utf8");
  const live = await get(raw + urlPath);
  if (live.status !== 200) { console.log("HTTP " + live.status); process.exit(1); }

  const lt = visibleText(localRaw);
  const rt = visibleText(live.body);
  const out = [`URL ${raw}${urlPath}`, `local bytes=${localRaw.length} live bytes=${live.body.length}`,
    `可见文本: local ${lt.length} 字 / live ${rt.length} 字   hash ${sha(lt)} vs ${sha(rt)}   一致=${lt === rt}`];

  if (lt !== rt) {
    let i = 0; const max = Math.min(lt.length, rt.length);
    while (i < max && lt[i] === rt[i]) i++;
    out.push(`\n首处文本差异 @${i}`);
    out.push(`  LOCAL: …${lt.slice(Math.max(0, i - 150), i + 250)}…`);
    out.push(`  LIVE : …${rt.slice(Math.max(0, i - 150), i + 250)}…`);
  }
  fs.writeFileSync("_dev/_livediff.txt", out.join("\n"), "utf8");
  console.log("ok");
})();
