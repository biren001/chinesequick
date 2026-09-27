/**
 * _cf-redir-probe.js —— 一次性受控实验：CF Pages 到底认不认我们上传的 `_redirects`。
 *
 * 【为什么值得单开一个脚本而不是直接重发生产】
 * 生产部署要传 723 个文件、约 4 分钟；而这个实验只需要 3 个文件、约 10 秒。
 * 实验跑在**预览分支**上，不接管自定义域名 → 零线上风险。
 *
 * 【实验设计：只留一个变量】
 * 传一个「最理想形态」的 `_redirects`：纯 ASCII、无注释、静态规则在前、通配在后，
 * 三条规则覆盖 301 的三种匹配形态。同时传两个真实存在的目标页，好把
 * 「301 到 404」和「根本没 301」分开。
 *
 * 三条判据：
 *   A. 基路径   /rr-plain        → 301 /rr-target/
 *   B. 带尾斜杠 /rr-slash/       → 301 /rr-target/
 *   C. 通配     /rr-splat/x/y    → 301 /rr-target/
 *   D. /_redirects 本身取回 404 还是 200 —— 文档说这个文件**不该**被当静态资源提供，
 *      所以它返回 200 就等于「CF 没把它认成特殊文件」（这条是最强的指纹）。
 */
const fs = require("fs");
const path = require("path");
const https = require("https");
const crypto = require("crypto");

const ROOT = path.join(__dirname, "..");
const md5 = (b) => crypto.createHash("md5").update(b).digest("hex");

function env(k) {
  const m = fs.readFileSync(path.join(ROOT, ".env.local"), "utf8").match(new RegExp("^" + k + "=(.*)$", "m"));
  return m ? m[1].trim() : null;
}
const ACCOUNT = env("CF_ACCOUNT_ID");
const TOKEN = env("CF_API_TOKEN");
const PROJECT = env("CF_PAGES_PROJECT");

function req({ method, url, headers, body }) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const r = https.request(
      { method, host: u.hostname, port: u.port || 443, path: u.pathname + u.search, headers, timeout: 60000 },
      (res) => {
        const bufs = [];
        res.on("data", (c) => bufs.push(c));
        res.on("end", () => resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(bufs) }));
      }
    );
    r.on("timeout", () => {
      r.destroy();
      reject(new Error("timeout " + url));
    });
    r.on("error", reject);
    if (body) r.write(body);
    r.end();
  });
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** 探针：只看状态码与 Location */
function probe(host, p) {
  return new Promise((resolve) => {
    const r = https.request(
      { host, port: 443, path: p, method: "GET", headers: { "User-Agent": "cq-redir-probe" }, timeout: 20000 },
      (res) => {
        res.resume();
        res.on("end", () => resolve({ status: res.statusCode, location: res.headers.location || null }));
      }
    );
    r.on("timeout", () => {
      r.destroy();
      resolve({ status: "TIMEOUT", location: null });
    });
    r.on("error", (e) => resolve({ status: "ERR", location: e.message }));
    r.end();
  });
}

const OUT = [];
const say = (s) => {
  OUT.push(String(s));
  console.log(String(s));
};

(async () => {
  const branch = "redir-probe-" + Date.now().toString(36);
  // 变量：`_redirects` 在 manifest 里的 key 带不带前导斜杠。
  // 猜测来源：CF 的**特殊文件识别**可能是对「上传时那个名字」做字面匹配，
  // 而资源服务路径会给所有 key 补前导斜杠 —— 两者可能不是同一套规则。
  const NOSLASH = process.argv[2] === "noslash";

  const target = '<!doctype html><meta charset="utf-8"><title>rr target</title><h1>redirect target</h1>';
  const index = '<!doctype html><meta charset="utf-8"><title>rr probe</title><h1>probe</h1>';
  // 放一个真 404.html：这样「未命中路由」回 404 而不是 SPA 兜底的 index.html，
  // 探针就能干净区分「301 生效」/「301 没生效」——上一轮 200 是兜底假象。
  const notFound = '<!doctype html><meta charset="utf-8"><title>404</title><h1>not found</h1>';
  // 纯 ASCII / 无注释 / 静态在前、通配在后
  const redirects = [
    "/rr-plain  /rr-target/  301",
    "/rr-slash/  /rr-target/  301",
    "/rr-splat/*  /rr-target/  301",
    "",
  ].join("\n");

  const files = [
    { key: "/index.html", buf: Buffer.from(index, "utf8") },
    { key: "/404.html", buf: Buffer.from(notFound, "utf8") },
    { key: "/rr-target/index.html", buf: Buffer.from(target, "utf8") },
    { key: NOSLASH ? "_redirects" : "/_redirects", buf: Buffer.from(redirects, "utf8") },
  ];
  const manifest = {};
  const entries = [];
  for (const f of files) {
    const h = md5(f.buf);
    manifest[f.key] = h;
    entries.push({ key: f.key, hash: h, buf: f.buf });
  }

  say("== CF `_redirects` 受控实验（预览分支，零线上风险）==");
  say(`分支 : ${branch}`);
  say(`文件 : ${files.length} 个 —— ${files.map((f) => f.key).join(", ")}`);
  say("");
  say("--- 送进去的 _redirects 原文 ---");
  say(JSON.stringify(redirects));
  say("");

  // 1) upload-token
  const t1 = await req({
    method: "GET",
    url: `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT}/pages/projects/${PROJECT}/upload-token`,
    headers: { Authorization: "Bearer " + TOKEN },
  });
  const jwt = JSON.parse(t1.body.toString("utf8")).result?.jwt;
  if (!jwt) {
    say("FAIL: 拿不到 upload-token: " + t1.body.toString("utf8").slice(0, 300));
    fs.writeFileSync(path.join(__dirname, "_cf-redir-probe.txt"), OUT.join("\n"), "utf8");
    process.exit(1);
  }
  say("OK  : upload-token 到手");

  // 2) assets/upload
  const payload = Buffer.from(
    JSON.stringify(
      entries.map((e) => ({
        key: e.hash,
        value: e.buf.toString("base64"),
        metadata: { contentType: "application/octet-stream" },
        base64: true,
      }))
    ),
    "utf8"
  );
  const t2 = await req({
    method: "POST",
    url: "https://api.cloudflare.com/client/v4/pages/assets/upload",
    headers: { Authorization: "Bearer " + jwt, "Content-Type": "application/json", "Content-Length": payload.length },
    body: payload,
  });
  say(`OK  : assets/upload ${t2.status}`);

  // 3) upsert-hashes
  const t3 = await req({
    method: "POST",
    url: "https://api.cloudflare.com/client/v4/pages/assets/upsert-hashes",
    headers: { Authorization: "Bearer " + jwt, "Content-Type": "application/json" },
    body: Buffer.from(JSON.stringify({ hashes: entries.map((e) => e.hash) }), "utf8"),
  });
  say(`OK  : upsert-hashes ${t3.status}`);

  // 4) createDeployment（只放 manifest + branch）
  const boundary = "----cqprobe" + Date.now().toString(36);
  const chunks = [];
  const push = (s) => chunks.push(Buffer.from(s, "utf8"));
  push(`--${boundary}\r\nContent-Disposition: form-data; name="manifest"\r\n\r\n`);
  push(JSON.stringify(manifest));
  push("\r\n");
  push(`--${boundary}\r\nContent-Disposition: form-data; name="branch"\r\n\r\n`);
  push(branch);
  push("\r\n");
  push(`--${boundary}--\r\n`);
  const body = Buffer.concat(chunks);

  const t4 = await req({
    method: "POST",
    url: `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT}/pages/projects/${PROJECT}/deployments`,
    headers: {
      Authorization: "Bearer " + TOKEN,
      "Content-Type": "multipart/form-data; boundary=" + boundary,
      "Content-Length": body.length,
    },
    body,
  });
  let dep = null;
  try {
    dep = JSON.parse(t4.body.toString("utf8"));
  } catch {
    /* ignore */
  }
  if (!dep || dep.success === false || !dep.result) {
    say(`FAIL: createDeployment ${t4.status} —— ${t4.body.toString("utf8").slice(0, 400)}`);
    fs.writeFileSync(path.join(__dirname, "_cf-redir-probe.txt"), OUT.join("\n"), "utf8");
    process.exit(1);
  }
  const short = dep.result.short_id || String(dep.result.id).slice(0, 8);
  say(`OK  : 部署已建 ${short}（${dep.result.stage?.name || dep.result.latest_stage?.name || "?"}）`);
  const host = `${short}.${PROJECT}.pages.dev`;

  // 等它开始服务
  say("");
  say("--- 探针（最多重试 6 次）---");
  const cases = [
    { label: "A 基路径   ", p: "/rr-plain" },
    { label: "B 带尾斜杠 ", p: "/rr-slash/" },
    { label: "C 通配     ", p: "/rr-splat/x/y" },
    { label: "D 目标页   ", p: "/rr-target/" },
    { label: "E _redirects 本身", p: "/_redirects" },
  ];
  let last = null;
  for (let i = 0; i < 6; i++) {
    last = [];
    for (const c of cases) last.push({ ...c, ...(await probe(host, c.p)) });
    if (last.find((x) => x.p === "/rr-target/").status === 200) break;
    await sleep(5000);
  }
  for (const x of last) {
    const loc = x.location ? String(x.location).replace(/^https?:\/\/[^/]+/, "") : "";
    say(`  ${x.label}  ${x.status}  ${loc}`);
  }

  const A = last.find((x) => x.p === "/rr-plain");
  const E = last.find((x) => x.p === "/_redirects");
  const works = A.status === 301;
  say("");
  if (works) {
    say("结论：CF **认** _redirects（301 生效）。那我们生产上不生效的原因在**文件内容形态**上，");
    say("      回去逐个变量排除（注释 / 中文 / 静态与通配混排 / 三形态重复条目）。");
  } else {
    say("结论：CF **不认** 这个 _redirects。");
    if (E.status === 200) {
      say("      指纹吻合：/_redirects 本身被当普通资源返回了 200，而文档说它「不该被作为静态资源提供」");
      say("      → 说明它压根没进入特殊文件解析流程，而不是「解析了但规则不匹配」。");
      say("      → 下一步：改用 wrangler 传一次做对照（同一条 API，只差 CLI 会不会把");
      say("        _redirects 当特殊文件单独处理），或改用平台外的等价方案（静态跳转页 / Bulk Redirects）。");
    } else {
      say("      但 /_redirects 本身返回 " + E.status + "（不是 200）→ 指纹不符，得换思路查。");
    }
  }

  fs.writeFileSync(path.join(__dirname, "_cf-redir-probe.txt"), OUT.join("\n"), "utf8");
  process.exit(works ? 0 : 1);
})();
