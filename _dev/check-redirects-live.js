/**
 * check-redirects-live.js —— 线上核对「已删除 URL 不再是死链」。
 *
 * 【为什么必须线上验，本地验不了】
 * Next 只负责把 `public/` 原样拷进 `out/`。本地能验的是「产物里有没有这个文件、
 * 它里面的 refresh / canonical 写对没有」（那部分是 seocheck.js 的 `out.redirects` 断言）。
 * 「平台真的会把这个文件送出来吗」只有部署后才知道 —— 所以这是唯一终判。
 *
 * 【为什么不是断言 301】
 * 2026-09-27 实测：本项目（CF Pages Direct Upload）**不执行 `_redirects`**，规则一条都不生效
 * （两组受控实验见 _dev/make-redirect-stubs.js 头注释）。真正兜底的是静态跳转页，
 * 所以线上判据是「这个路径返回我们那个跳转页，且页里带着指向正确落点的 refresh」。
 * `_redirects` 仍然部署着 —— 哪天平台支持了，它会自动盖过跳转页变成真 301，
 * 那时这个脚本会看到 301，**也算通过**（脚本对两种机制都接受，只拒绝死链）。
 *
 * 每个源路径测两种形态（站点 trailingSlash: true，真实入口是带尾斜杠那种）：
 *   /x    —— 允许：200 直接给跳转页，或 301/308 规范化到 /x/
 *   /x/   —— 必须 200 且是真跳转页，refresh 指向正确落点
 * 另外落点页必须 200 —— 跳到 404 比不跳更糟。
 *
 * 用法：node _dev/check-redirects-live.js [域名]
 * 结果：_dev/redirects-live.txt，全绿 exit 0。
 */
const fs = require("fs");
const path = require("path");
const https = require("https");

const ROOT = path.join(__dirname, "..");
const OUT = path.join(ROOT, "out");
const MARKER = "cq-redirect-stub";
const base = require("./baseurl").normalizeBase(process.argv[2], "https://chinesequick.com");

function get(url) {
  return new Promise((resolve) => {
    const req = https.request(
      url,
      { method: "GET", headers: { "User-Agent": "cq-redirect-check" }, timeout: 20000 },
      (r) => {
        const bufs = [];
        r.on("data", (c) => bufs.push(c));
        r.on("end", () =>
          resolve({ status: r.statusCode, location: r.headers.location || null, body: Buffer.concat(bufs).toString("utf8") })
        );
      }
    );
    req.on("timeout", () => {
      req.destroy();
      resolve({ status: "TIMEOUT", location: null, body: "" });
    });
    req.on("error", (e) => resolve({ status: "ERR", location: e.message, body: "" }));
    req.end();
  });
}

const pathOf = (u) => {
  try {
    return new URL(u).pathname;
  } catch {
    return String(u).split("?")[0];
  }
};

(async () => {
  const out = [];
  const fails = [];
  const say = (s) => {
    out.push(String(s));
    console.log(String(s));
  };

  const legacyFile = path.join(ROOT, "data", "legacy-redirects.json");
  if (!fs.existsSync(legacyFile)) {
    say("FAIL: 缺 data/legacy-redirects.json");
    process.exit(1);
  }
  const rules = JSON.parse(fs.readFileSync(legacyFile, "utf8")).rules || [];

  say("== 已删除 URL 去向上的线上核验 ==");
  say(`base : ${base}`);
  say(`来源 : data/legacy-redirects.json（${rules.length} 条）`);
  say("机制 : 静态跳转页（meta refresh + canonical）；`_redirects` 的 301 平台不执行，一旦执行也接受");
  say("");

  const results = [];
  for (const r of rules) {
    const bare = await get(base + r.from);
    const slashed = await get(base + r.from + "/");
    const target = await get(base + r.to);

    const refresh = (slashed.body.match(/<meta http-equiv="refresh" content="0; url=([^"]+)"/) || [])[1] || null;
    const canonical = (slashed.body.match(/<link rel="canonical" href="([^"]+)"/) || [])[1] || null;

    // 裸路径：允许直接给跳转页，或规范化 301/308 到带斜杠那种
    const bareOk =
      (bare.status === 200 && bare.body.includes(MARKER)) ||
      ([301, 308].includes(bare.status) && pathOf(bare.location) === r.from + "/");
    // 带斜杠：必须真是我们的跳转页
    const slashedOk = slashed.status === 200 && slashed.body.includes(MARKER) && refresh === r.to;
    const targetOk = target.status === 200;

    if (!bareOk) fails.push(`${r.from}（裸路径）期望 200 跳转页或 301→${r.from}/，实得 ${bare.status} ${bare.location || ""}`);
    if (!slashedOk)
      fails.push(`${r.from}/ 期望 200 跳转页 + refresh=${r.to}，实得 ${slashed.status} refresh=${refresh}`);
    if (!targetOk) fails.push(`落点不是 200：${r.to} → ${target.status}`);

    const ok = bareOk && slashedOk && targetOk;
    say(`${ok ? "OK  " : "FAIL"} ${r.from}`);
    say(`       裸路径   ${bare.status}${bare.location ? " -> " + pathOf(bare.location) : ""}`);
    say(`       带斜杠   ${slashed.status}  refresh=${refresh}`);
    say(`       canonical ${canonical}`);
    say(`       落点     ${r.to}  ${target.status}`);
    results.push({ ...r, bare: { status: bare.status, location: bare.location }, slashed: { status: slashed.status, refresh, canonical }, targetStatus: target.status, ok });
  }

  say("");
  if (fails.length) {
    say(`FAIL: ${fails.length} 处不符`);
    for (const f of fails) say(`  - ${f}`);
  } else {
    say(`PASS: ${rules.length} 条历史 URL 全部落到跳转页，落点全 200`);
  }

  fs.writeFileSync(
    path.join(__dirname, "redirects-live.txt"),
    JSON.stringify({ base, mechanism: "static-stub", count: rules.length, results, fails }, null, 1),
    "utf8"
  );
  process.exit(fails.length ? 1 : 0);
})();
