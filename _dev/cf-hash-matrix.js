/**
 * 验证 Direct Upload 的真实三步链路（预览分支，零线上风险）：
 *   1) GET  /accounts/{id}/pages/projects/{p}/upload-token       → JWT
 *   2) POST /pages/assets/upload              （JWT）            → JSON [{key,value,metadata,base64}]
 *   3) POST /pages/assets/upsert-hashes       （JWT）            → {hashes:[...]}
 *   4) POST /accounts/{id}/pages/projects/{p}/deployments （API token，multipart 只放 manifest）
 * 判据：能不能取回我们写进去的字节。
 * 用完即删。
 */
const fs = require("fs");
const https = require("https");
const crypto = require("crypto");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const env = {};
for (const line of fs.readFileSync(path.join(ROOT, ".env.local"), "utf8").split(/\r?\n/)) {
  const m = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
  if (m) env[m[1]] = m[2];
}
const { CF_ACCOUNT_ID: ACCOUNT, CF_API_TOKEN: TOKEN, CF_PAGES_PROJECT: PROJECT } = env;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function req({ method, url, headers, body }) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const r = https.request({ method, host: u.hostname, port: 443, path: u.pathname + u.search, headers }, (res) => {
      const bufs = [];
      res.on("data", (c) => bufs.push(c));
      res.on("end", () => resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(bufs) }));
    });
    r.on("error", reject);
    r.setTimeout(180000, () => r.destroy(new Error("timeout")));
    if (body) r.write(body);
    r.end();
  });
}

const j = (b) => {
  try {
    return JSON.parse(b.toString("utf8"));
  } catch {
    return null;
  }
};

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript",
  ".mp3": "audio/mpeg",
  ".png": "image/png",
};
const mimeOf = (p) => MIME[path.extname(p).toLowerCase()] || "application/octet-stream";

(async () => {
  const stamp = Date.now().toString(36);
  const marker = "ASSETMARKER-" + stamp;
  const out = [];
  const files = [
    { rel: "/index.html", buf: Buffer.from(`<html>${marker}</html>`, "utf8") },
    { rel: "/probe.txt", buf: Buffer.from(marker, "utf8") },
  ];
  // 三种 hash 候选各测一遍（manifest 的 value 必须与 assets/upload 的 key 一致）
  const algos = [
    ["sha256", (b) => crypto.createHash("sha256").update(b).digest("hex")],
    ["md5", (b) => crypto.createHash("md5").update(b).digest("hex")],
    ["md5(body+path)", (b, p) => crypto.createHash("md5").update(Buffer.concat([b, Buffer.from(p, "utf8")])).digest("hex")],
  ];

  // ---- 1) upload-token ----
  let tokenRes = await req({
    method: "GET",
    url: `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT}/pages/projects/${encodeURIComponent(PROJECT)}/upload-token`,
    headers: { Authorization: `Bearer ${TOKEN}` },
  });
  out.push(`1) GET upload-token → HTTP ${tokenRes.status}：${tokenRes.body.toString("utf8").slice(0, 200)}`);
  const jwt = j(tokenRes.body) && j(tokenRes.body).result && j(tokenRes.body).result.jwt;
  if (!jwt) {
    out.push("拿不到 JWT，后面没法继续。");
    fs.writeFileSync(path.join(__dirname, "_probe-assets.txt"), out.join("\n"), "utf8");
    console.log(out.join("\n"));
    return;
  }
  out.push(`   JWT 长度 ${jwt.length}`);

  for (const [name, hashFn] of algos) {
    const label = `【${name}】`;
    const entries = files.map((f) => ({ rel: f.rel, key: hashFn(f.buf, f.rel), buf: f.buf }));
    const manifest = {};
    for (const e of entries) manifest[e.rel] = e.key;

    // ---- 2) assets/upload ----
    const payload = JSON.stringify(
      entries.map((e) => ({ key: e.key, value: e.buf.toString("base64"), metadata: { contentType: mimeOf(e.rel) }, base64: true }))
    );
    const up = await req({
      method: "POST",
      url: "https://api.cloudflare.com/client/v4/pages/assets/upload",
      headers: { Authorization: `Bearer ${jwt}`, "Content-Type": "application/json", "Content-Length": Buffer.byteLength(payload) },
      body: Buffer.from(payload, "utf8"),
    });
    const upj = j(up.body);
    out.push(`${label}2) assets/upload → HTTP ${up.status} success=${upj && upj.success} errors=${JSON.stringify((upj && upj.errors) || [])} body=${up.body.toString("utf8").slice(0, 160)}`);

    // ---- 3) upsert-hashes ----
    const uh = await req({
      method: "POST",
      url: "https://api.cloudflare.com/client/v4/pages/assets/upsert-hashes",
      headers: { Authorization: `Bearer ${jwt}`, "Content-Type": "application/json" },
      body: Buffer.from(JSON.stringify({ hashes: entries.map((e) => e.key) }), "utf8"),
    });
    const uhj = j(uh.body);
    out.push(`${label}3) upsert-hashes → HTTP ${uh.status} success=${uhj && uhj.success} errors=${JSON.stringify((uhj && uhj.errors) || [])}`);

    // ---- 4) deployments（multipart 只放 manifest + branch）----
    const boundary = "----as" + crypto.randomBytes(8).toString("hex");
    const chunks = [];
    const push = (s) => chunks.push(Buffer.from(s, "utf8"));
    push(`--${boundary}\r\nContent-Disposition: form-data; name="manifest"\r\n\r\n`);
    push(JSON.stringify(manifest));
    push(`\r\n--${boundary}\r\nContent-Disposition: form-data; name="branch"\r\n\r\n`);
    push(`as-${name.replace(/[^a-z0-9]/gi, "")}-${stamp}\r\n--${boundary}--\r\n`);
    const body = Buffer.concat(chunks);
    const dep = await req({
      method: "POST",
      url: `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT}/pages/projects/${encodeURIComponent(PROJECT)}/deployments`,
      headers: {
        Authorization: `Bearer ${TOKEN}`,
        "Content-Type": `multipart/form-data; boundary=${boundary}`,
        "Content-Length": body.length,
      },
      body,
    });
    const dj = j(dep.body);
    const depRes = dj && dj.result;
    out.push(`${label}4) createDeployment → HTTP ${dep.status} success=${dj && dj.success} errors=${JSON.stringify((dj && dj.errors) || []).slice(0, 200)} dep=${depRes ? depRes.id.slice(0, 8) : null} env=${depRes && depRes.environment}`);

    if (depRes) {
      await sleep(15000);
      const short = depRes.id.slice(0, 8);
      for (const p of ["/probe.txt", "/"]) {
        const g = await req({ method: "GET", url: `https://${short}.${PROJECT}.pages.dev${p}`, headers: { "User-Agent": "Mozilla/5.0 as" } });
        out.push(`   ${p} → HTTP ${g.status} | 含 marker? ${g.body.toString("utf8").includes(marker)} | ${JSON.stringify(g.body.toString("utf8").slice(0, 40))}`);
      }
    }
    out.push("");
  }

  out.push(`marker=${marker}`);
  fs.writeFileSync(path.join(__dirname, "_probe-assets.txt"), out.join("\n"), "utf8");
  console.log(out.join("\n"));
})();
