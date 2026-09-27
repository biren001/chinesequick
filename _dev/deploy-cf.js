#!/usr/bin/env node
/**
 * Cloudflare Pages Direct Upload（绕开手动上传 zip）
 *
 *   node _dev/deploy-cf.js            # 打真包并发布（读 .env.local 里的凭据）
 *   node _dev/deploy-cf.js --precheck # 只校验凭据 + 项目名大小写，不上传
 *   node _dev/deploy-cf.js --selftest # 纯本地：证明 multipart 与 manifest 写对了
 *   node _dev/deploy-cf.js --dry-run  # 用假凭据跑，确认 CF 报错能被解析出来
 *
 * 凭据放 .env.local（.gitignore 已含 .env*.local）：
 *   CF_ACCOUNT_ID=32 位十六进制        （CF 后台右侧栏）
 *   CF_API_TOKEN=...                   （权限只要 Account → Cloudflare Pages → Edit）
 *   CF_PAGES_PROJECT=...               （Pages 项目名，大小写敏感）
 *
 * 设计要点（都是实测踩出来的）：
 *  - 传输层用 https.request + 重试，不用全局 fetch：本机 fetch 打 CF 约 2/3 概率
 *    ECONNRESET（TLS 握手前被复位），而 https.request 同条件 3/3 通。
 *    "稳"的不是某条路，是重试；有 HTTPS_PROXY 时把 CONNECT 隧道作为降级路径。
 *  - 结果是 manifest 协议：manifest 字段是 {相对路径: sha256} JSON（key 不带前导斜杠），
 *    每个文件再单独一个 part，part 的 name 就是它的 hash。
 *  - 结果文件绝不写 token，日志里只打前 4 位 + 长度。
 */

const fs = require("fs");
const path = require("path");
const https = require("https");
const http = require("http");
const tls = require("tls");
const crypto = require("crypto");
const { URL } = require("url");

const ROOT = path.resolve(__dirname, "..");
const API_HOST = "api.cloudflare.com";
const MAX_FILE = 25 * 1024 * 1024; // 单文件上限 25 MiB
const MAX_FILES = 20000; // 每项目文件数上限（Free）

// ---------------------------------------------------------------- 凭据

function loadEnv() {
  const p = path.join(ROOT, ".env.local");
  const env = {};
  if (!fs.existsSync(p)) return env;
  for (const line of fs.readFileSync(p, "utf8").split(/\r?\n/)) {
    const m = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/.exec(line);
    if (!m) continue;
    env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
  }
  return env;
}

function maskToken(t) {
  if (!t) return "(未设置)";
  return `${t.slice(0, 4)}… (len ${t.length})`;
}

// ---------------------------------------------------------------- 文件收集

function collectFiles(dir) {
  const out = [];
  (function walk(d) {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const full = path.join(d, e.name);
      if (e.isDirectory()) walk(full);
      else if (e.isFile()) {
        // manifest 的 key 是不带前导斜杠的相对路径
        out.push({ rel: path.relative(dir, full).split(path.sep).join("/"), buf: fs.readFileSync(full) });
      }
    }
  })(dir);
  out.sort((a, b) => (a.rel < b.rel ? -1 : 1));
  return out;
}

// ---------------------------------------------------------------- 归属自检

/**
 * 「这堆产物到底是谁的站、要发到哪个项目」——多站点账号下最贵的错就是发错项目。
 * 两道独立校验，任一不过就拒绝上传：
 *  a. 产物自带的域名（sitemap 里的 host）必须与 .env.local 的 NEXT_PUBLIC_SITE_URL 一致
 *     → 抓「构建产物和配置对不上」
 *  b. 那个域名必须与 CF_PAGES_PROJECT 有可解释的对应（项目名出现在域名里，或显式声明 CF_EXPECT_HOST）
 *     → 抓「发到隔壁站去了」
 */
function sitemapHost(dir) {
  const p = path.join(dir, "sitemap.xml");
  if (!fs.existsSync(p)) return { host: null, reason: "没有 sitemap.xml" };
  const xml = fs.readFileSync(p, "utf8");
  const hosts = {};
  for (const m of xml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/g)) {
    try {
      const h = new URL(m[1]).hostname;
      hosts[h] = (hosts[h] || 0) + 1;
    } catch {
      /* 跳过坏 URL */
    }
  }
  const ranked = Object.entries(hosts).sort((a, b) => b[1] - a[1]);
  if (!ranked.length) return { host: null, reason: "sitemap 里没有可解析的 <loc>" };
  return { host: ranked[0][0], counts: ranked.slice(0, 4) };
}

function checkHost(dir, project, expectHost) {
  const problems = [];
  const siteUrl = (loadEnv().NEXT_PUBLIC_SITE_URL || "").replace(/\/+$/, "");
  let siteHost = null;
  try {
    siteHost = siteUrl ? new URL(siteUrl).hostname : null;
  } catch {
    problems.push(`.env.local 的 NEXT_PUBLIC_SITE_URL 不是合法 URL：${siteUrl || "(空)"}`);
  }

  const sm = sitemapHost(dir);
  if (!sm.host) problems.push(`读不到产物域名：${sm.reason}`);
  else if (!siteHost) problems.push(".env.local 缺 NEXT_PUBLIC_SITE_URL，无法确认产物归属");
  else if (sm.host !== siteHost) problems.push(`产物域名(${sm.host}) 与配置域名(${siteHost}) 不一致`);

  const want = expectHost || null;
  if (sm.host) {
    if (want) {
      if (sm.host !== want) problems.push(`产物域名(${sm.host}) ≠ 声明的 CF_EXPECT_HOST(${want})`);
    } else if (project && !sm.host.toLowerCase().includes(String(project).toLowerCase())) {
      problems.push(
        `产物域名(${sm.host}) 里找不到项目名(${project}) —— 多站点账号下这必须人工确认，` +
          `请在 .env.local 加一行 CF_EXPECT_HOST=${sm.host} 明示，或检查 CF_PAGES_PROJECT 是不是写错了`
      );
    }
  }

  return { ok: problems.length === 0, project, expectHost: want, siteHost, sitemapHost: sm.host, sitemapCounts: sm.counts, problems };
}

// ---------------------------------------------------------------- multipart

const sha256 = (buf) => crypto.createHash("sha256").update(buf).digest("hex");

/**
 * 构造 multipart/form-data body。
 * files: [{rel, buf}]  →  返回 {body, boundary, manifest, entries}
 *
 * 【必须带前导斜杠】manifest 的 key 是**以 "/" 开头的站内绝对路径**。
 * 2026-09-27 实测：写成不带斜杠的相对路径（"index.html"）时，API 照样返回
 * `success:true` + `deploy:success` + canonical_deployment 也切过去了，
 * **但 CF 把文件存到了对不上的 key 上，全站资源 404**：
 *   - HTML 还能打开（那是边缘缓存里 7 天前的旧副本，s-maxage=604800 兜着）
 *   - /_next/static/**.js、css、/audio/*.mp3 全部 404
 * 对照证据：用户手动上传的历史部署，722 个 key **全部**以 "/" 开头。
 * 结论：这种错**没有任何一层会报错**，只能靠「与历史部署的 key 形态比对」发现。
 */
function buildForm(files, boundary = "----CFPagesUpload" + crypto.randomBytes(12).toString("hex")) {
  const manifest = {};
  const entries = [];
  const chunks = [];

  for (const f of files) {
    const key = "/" + String(f.rel).replace(/^\/+/, "");
    const hash = sha256(f.buf);
    manifest[key] = hash;
    entries.push({ rel: key, hash, size: f.buf.length });
  }

  const push = (s) => chunks.push(Buffer.from(s, "utf8"));

  // 每个文件一个 part：name 就是它的 hash，不带 filename、不指定 Content-Type
  for (const f of files) {
    const key = "/" + String(f.rel).replace(/^\/+/, "");
    push(`--${boundary}\r\n`);
    push(`Content-Disposition: form-data; name="${manifest[key]}"\r\n\r\n`);
    chunks.push(f.buf);
    push(`\r\n`);
  }

  // ⚠️ manifest 必须放在**最后**。
  // 大 body 上传实测会被中途截断，而 CF 对「有 manifest、缺文件」的组合**不报错**：
  // 它会 success:true 地建一个 **0 文件部署**，还把它切成 canonical → 整站 500。
  // 把 manifest 放最后，截断就退化成"缺 manifest"→ CF 明确报错 → 干净失败可重试。
  push(`--${boundary}\r\n`);
  push(`Content-Disposition: form-data; name="manifest"\r\n\r\n`);
  push(JSON.stringify(manifest));
  push(`\r\n`);

  push(`--${boundary}--\r\n`);

  return { body: Buffer.concat(chunks), boundary, manifest, entries };
}

/** 把 multipart body 解析回 [{name, data}] —— 仅自检用 */
function parseForm(body, boundary) {
  const delim = Buffer.from(`--${boundary}`);
  const parts = [];
  let i = body.indexOf(delim);
  while (i !== -1) {
    let start = i + delim.length;
    if (body.slice(start, start + 2).toString() === "--") break; // 收尾
    if (body.slice(start, start + 2).toString() === "\r\n") start += 2;
    const headEnd = body.indexOf("\r\n\r\n", start);
    if (headEnd === -1) break;
    const head = body.slice(start, headEnd).toString("utf8");
    const nameM = /name="([^"]*)"/.exec(head);
    const dataStart = headEnd + 4;
    const next = body.indexOf(delim, dataStart);
    const dataEnd = next === -1 ? body.length : next - 2; // 去掉尾随 \r\n
    parts.push({ name: nameM ? nameM[1] : null, data: body.slice(dataStart, dataEnd) });
    i = next;
  }
  return parts;
}

// ---------------------------------------------------------------- 资源上传（正确协议）

const md5hex = (buf) => crypto.createHash("md5").update(buf).digest("hex");
const b64 = (buf) => buf.toString("base64");
const MAX_BUCKET_BYTES = 40 * 1024 * 1024; // wrangler: MAX_BUCKET_SIZE_DEFAULT
const MAX_BUCKET_FILES = 1000; // wrangler 在 Windows 上用 1000

const MIME_BY_EXT = {
  ".html": "text/html; charset=utf-8",
  ".htm": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript",
  ".mjs": "application/javascript",
  ".json": "application/json",
  ".txt": "text/plain; charset=utf-8",
  ".xml": "application/xml",
  ".mp3": "audio/mpeg",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
  ".woff": "font/woff",
};
const mimeOf = (p) => MIME_BY_EXT[path.extname(p).toLowerCase()] || "application/octet-stream";

/**
 * manifest：站内绝对路径 → **md5(内容)**。
 *
 * 🔴 必须是 md5，不能用 sha256。
 * 2026-09-27 实测（预览分支对照实验，两个文件各测一次）：
 *   sha256 作 key → assets/upload 返回 success（successful_key_count 2），
 *                   createDeployment 也 success，但 /probe.txt 取回 **500**、内容是空的；
 *   md5 作 key    → 全部 200，**内容一字不差**。
 * 参考 wrangler：它给 manifest 用的就是 **MD5**（DeepWiki: "maps file paths to their MD5 hashes"）。
 */
function buildManifest(files) {
  const manifest = {};
  const entries = [];
  for (const f of files) {
    const key = "/" + String(f.rel).replace(/^\/+/, "");
    const hash = md5hex(f.buf);
    manifest[key] = hash;
    entries.push({ path: key, hash, buf: f.buf, size: f.buf.length });
  }
  return { manifest, entries };
}

/** 分桶：≤40 MiB 且 ≤1000 个文件（base64 会膨胀 4/3，按膨胀后算更保险） */
function bucketize(entries) {
  const buckets = [];
  let cur = { entries: [], bytes: 0 };
  for (const e of entries) {
    const cost = Math.ceil(e.size / 3) * 4 + 200; // base64 + JSON 包装
    if (cur.entries.length && (cur.entries.length >= MAX_BUCKET_FILES || cur.bytes + cost > MAX_BUCKET_BYTES)) {
      buckets.push(cur);
      cur = { entries: [], bytes: 0 };
    }
    cur.entries.push(e);
    cur.bytes += cost;
  }
  if (cur.entries.length) buckets.push(cur);
  return buckets;
}

/**
 * 三步链路里第 1~3 步：拿 JWT → 上传资源字节 → 声明 hash 已存在。
 * 部署请求里**不再放文件**（放了也会被忽略，见 uploadOnce 的注释）。
 */
async function uploadAssets({ account, token, project, manifest, entries, report }) {
  const t = await apiJson({ method: "GET", url: `${apiBase(account)}/pages/projects/${encodeURIComponent(project)}/upload-token` }, token, "uploadToken");
  const jwt = t.result && t.result.jwt;
  if (!jwt) throw new Error("拿不到上传 JWT（upload-token 返回里没有 result.jwt）");

  const buckets = bucketize(entries);
  report.assetBuckets = buckets.length;
  let uploaded = 0;
  for (let i = 0; i < buckets.length; i++) {
    const b = buckets[i];
    const payload = Buffer.from(
      JSON.stringify(
        b.entries.map((e) => ({ key: e.hash, value: b64(e.buf), metadata: { contentType: mimeOf(e.path) }, base64: true }))
      ),
      "utf8"
    );
    const res = await request(
      {
        method: "POST",
        url: `https://${API_HOST}/client/v4/pages/assets/upload`,
        headers: { ...authHeaders(jwt), "Content-Type": "application/json", "Content-Length": payload.length },
        body: payload,
      },
      { label: `assetsUpload#${i + 1}`, tries: 3 }
    );
    let j = null;
    try {
      j = JSON.parse(res.body.toString("utf8"));
    } catch {
      /* 下面报 */
    }
    if (res.status >= 400 || !j || j.success === false) {
      const em = ((j && j.errors) || []).map((e) => `[${e.code}] ${e.message}`).join("; ") || `HTTP ${res.status}`;
      throw new Error(`资源上传失败（第 ${i + 1}/${buckets.length} 桶，${b.entries.length} 个文件）：${em}`);
    }
    uploaded += b.entries.length;
    report.assetUploaded = uploaded;
  }

  const uh = await request(
    {
      method: "POST",
      url: `https://${API_HOST}/client/v4/pages/assets/upsert-hashes`,
      headers: { ...authHeaders(jwt), "Content-Type": "application/json" },
      body: Buffer.from(JSON.stringify({ hashes: entries.map((e) => e.hash) }), "utf8"),
    },
    { label: "upsertHashes", tries: 3 }
  );
  let uhj = null;
  try {
    uhj = JSON.parse(uh.body.toString("utf8"));
  } catch {
    /* 忽略 */
  }
  if (uh.status >= 400 || (uhj && uhj.success === false)) {
    const em = ((uhj && uhj.errors) || []).map((e) => `[${e.code}] ${e.message}`).join("; ") || `HTTP ${uh.status}`;
    throw new Error(`upsert-hashes 失败：${em}`);
  }
  report.assetHashesDeclared = entries.length;
  return { jwt, buckets: buckets.length, uploaded };
}

/** deployment 请求的 body：**只有 manifest**（+ 可选字符串字段），不放文件字节 */
function buildManifestForm(manifest, boundary, extra = {}) {
  const chunks = [];
  const push = (s) => chunks.push(Buffer.from(s, "utf8"));
  push(`--${boundary}\r\nContent-Disposition: form-data; name="manifest"\r\n\r\n`);
  push(JSON.stringify(manifest));
  push(`\r\n`);
  for (const [k, v] of Object.entries(extra)) {
    if (v === undefined || v === null) continue;
    push(`--${boundary}\r\nContent-Disposition: form-data; name="${k}"\r\n\r\n`);
    push(String(v));
    push(`\r\n`);
  }
  push(`--${boundary}--\r\n`);
  return Buffer.concat(chunks);
}

// ---------------------------------------------------------------- 传输层

// 「截断」也要算连接级故障：大 body 上传时最常见的就是回包收不全，必须多给几次机会
const CONN_ERRORS = /ECONNRESET|ETIMEDOUT|ECONNREFUSED|EPIPE|socket hang up|EAI_AGAIN|ENOTFOUND|timeout|截断|truncat/i;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function proxyUrl() {
  const raw = process.env.HTTPS_PROXY || process.env.https_proxy || process.env.HTTP_PROXY || process.env.http_proxy;
  if (!raw) return null;
  try {
    return new URL(raw);
  } catch {
    return null;
  }
}

/** 直连：https.request */
function directRequest({ method, url, headers, body }) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const req = https.request(
      { method, host: u.hostname, port: u.port || 443, path: u.pathname + u.search, headers },
      (res) => {
        const bufs = [];
        res.on("data", (c) => bufs.push(c));
        res.on("end", () => resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(bufs) }));
      }
    );
    req.on("error", reject);
    // 超时给足：本项目整包 13.8 MB，实测跨国上传耗时约 4 分钟（≈57 KB/s）。
    // 原来写 60 秒 → 大 body 上传永远超时，于是每次都误判成"网络不行"。
    // 这是 socket 空闲超时，不是总时长限制，所以给大值不会惩罚正常请求。
    req.setTimeout(300000, () => req.destroy(new Error("timeout")));
    if (body) req.write(body);
    req.end();
  });
}

/**
 * 解析一条 HTTP/1.1 响应。收不全就返回 null（由调用方继续等）。
 *
 * 为什么必须自己写：走 CONNECT 隧道时拿到的是**裸字节流**，Node 不会帮忙解码。
 * 而 CF API 的响应一律 `Transfer-Encoding: chunked` —— 不解 chunked 的话，
 * body 里会混着 "1a4f\r\n" 这类长度行，JSON.parse 必然失败。
 * **这条 bug 的杀伤力在于它伪装成「上传失败」**：其实部署早就建好了，
 * 只是我们读不懂响应，于是报了一个假的 FAIL（2026-09-27 实测踩到）。
 */
function parseHttpResponse(raw) {
  const sep = raw.indexOf("\r\n\r\n");
  if (sep < 0) return null; // 响应头还没收全
  const head = raw.slice(0, sep).toString("utf8");
  const lines = head.split("\r\n");
  const m = /^HTTP\/\d\.\d\s+(\d+)/.exec(lines[0] || "");
  if (!m) return null;
  const headers = {};
  for (const line of lines.slice(1)) {
    const i = line.indexOf(":");
    if (i < 0) continue;
    headers[line.slice(0, i).trim().toLowerCase()] = line.slice(i + 1).trim();
  }
  const status = Number(m[1]);
  const rest = raw.slice(sep + 4);

  if ((headers["transfer-encoding"] || "").toLowerCase().includes("chunked")) {
    const parts = [];
    let off = 0;
    for (;;) {
      const eol = rest.indexOf("\r\n", off);
      if (eol < 0) return null; // 长度行还没到
      const size = parseInt(rest.slice(off, eol).toString("utf8").split(";")[0].trim(), 16);
      if (!Number.isFinite(size)) return null;
      if (size === 0) return { status, headers, body: Buffer.concat(parts), rawHead: head };
      const start = eol + 2;
      if (rest.length < start + size + 2) return null; // 这一块还没收全
      parts.push(rest.slice(start, start + size));
      off = start + size + 2;
    }
  }

  const cl = headers["content-length"];
  if (cl !== undefined) {
    const n = Number(cl);
    if (!Number.isFinite(n) || rest.length < n) return null;
    return { status, headers, body: rest.slice(0, n), rawHead: head };
  }
  // 既无 chunked 也无 length：只能以连接关闭为准，交给 end 收尾
  return { status, headers, body: rest, rawHead: head };
}

/** 降级路径：HTTP 代理的 CONNECT 隧道 + 手写请求行 */
function tunnelRequest({ method, url, headers, body }, proxy) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const port = u.port || 443;
    const conn = http.request({
      host: proxy.hostname,
      port: proxy.port || 80,
      method: "CONNECT",
      path: `${u.hostname}:${port}`,
      headers: proxy.username
        ? { "Proxy-Authorization": "Basic " + Buffer.from(`${proxy.username}:${proxy.password}`).toString("base64") }
        : {},
    });
    conn.on("connect", (res, socket) => {
      if (res.statusCode !== 200) return reject(new Error(`proxy CONNECT ${res.statusCode}`));
      // 隧道已建立：撤掉 CONNECT 阶段的 30 秒定时器。
      // 不撤的话它可能在上传过程中触发，把正在传 socket 干掉（13.8 MB 要传约 4 分钟）。
      conn.setTimeout(0);
      const tlsSock = tls.connect({ socket, servername: u.hostname }, () => {
        const head = [`${method} ${u.pathname}${u.search} HTTP/1.1`, `Host: ${u.hostname}`];
        for (const [k, v] of Object.entries(headers)) head.push(`${k}: ${v}`);
        head.push("Connection: close");
        tlsSock.write(head.join("\r\n") + "\r\n\r\n");
        if (body) tlsSock.write(body);
      });
      const bufs = [];
      let done = false;
      // 收齐就立刻返回，不等对方关连接（keep-alive 下 end 可能很久才来）
      const tryFinish = () => {
        if (done) return true;
        const r = parseHttpResponse(Buffer.concat(bufs));
        if (!r) return false;
        done = true;
        resolve(r);
        tlsSock.destroy();
        return true;
      };
      tlsSock.on("data", (c) => {
        bufs.push(c);
        tryFinish();
      });
      tlsSock.on("end", () => {
        if (done) return;
        const r = parseHttpResponse(Buffer.concat(bufs));
        done = true;
        // 解析不出完整响应 = 截断。宁可报错重试，也不要把半截 body 当成功交给上层
        if (r) resolve(r);
        else reject(new Error(`隧道响应截断（收到 ${Buffer.concat(bufs).length} 字节，无法解析完整 HTTP 响应）`));
      });
      tlsSock.on("error", reject);
    });
    conn.on("error", reject);
    conn.setTimeout(30000, () => conn.destroy(new Error("proxy timeout")));
    conn.end();
  });
}

/**
 * 带重试的请求。连接级错误额外续命（for 条件每轮重算）。
 * 全部直连失败且存在代理时，自动切隧道重试一轮。
 */
async function request(opts, { tries = 4, label = "" } = {}) {
  const attempt = async (fn, transport) => {
    const errors = [];
    let cap = tries;
    for (let i = 1; i <= cap; i++) {
      try {
        const res = await fn();
        // 没有状态码 = 隧道/代理只回了个半截响应，当失败重试，别把它当成"成功但内容为空"
        if (typeof res.status !== "number" || res.status === 0) throw new Error("响应缺少状态码");
        // 限流/部署冲突：交给调用方决定要不要 force
        if (res.status === 429 || res.status >= 500) throw new Error(`HTTP ${res.status}`);
        res.transport = transport; // 记下这条响应是直连还是走隧道来的，排查时不用猜
        return res;
      } catch (e) {
        errors.push(`${e.message}`);
        if (CONN_ERRORS.test(e.message)) cap = tries + 6;
        if (i < cap) await sleep(Math.min(4000, 800 * i));
      }
    }
    const err = new Error(`${label} 重试耗尽：${errors.slice(-3).join(" | ")}`);
    err.attempts = errors; // 保留全部尝试的错误，排查时不用猜是哪条路、错在哪
    throw err;
  };

  try {
    return await attempt(() => directRequest(opts), "direct");
  } catch (e) {
    const px = proxyUrl();
    if (!px) throw e;
    try {
      return await attempt(() => tunnelRequest(opts, px), "tunnel");
    } catch (e2) {
      // 两条路的错误都留着：只报隧道那条会让人以为是代理问题，
      // 而真实原因常常在直连那几条错误里（例如 300 秒超时 = 大 body 传不完）。
      e2.attempts = [
        `[direct] ${(e.attempts || [e.message]).join(" ; ")}`,
        `[tunnel] ${(e2.attempts || [e2.message]).join(" ; ")}`,
      ];
      throw e2;
    }
  }
}

// ---------------------------------------------------------------- CF API

const apiBase = (account) => `https://${API_HOST}/client/v4/accounts/${account}`;

const authHeaders = (token) => ({ Authorization: `Bearer ${token}` });

async function apiJson(opts, token, label) {
  const res = await request({ ...opts, headers: { ...opts.headers, ...authHeaders(token), "Content-Type": "application/json" } }, { label });
  let json = null;
  try {
    json = JSON.parse(res.body.toString("utf8"));
  } catch {
    /* 保留 null，下面按状态码报 */
  }
  if (!json) {
    // 不把「响应看不懂」静默吃成 null —— 那会让调用方报成 TypeError，掩盖真正的状态码
    const err = new Error(`响应不是 JSON（HTTP ${res.status}）：${res.body.toString("utf8").slice(0, 200)}`);
    err.status = res.status;
    throw err;
  }
  if (res.status >= 400 || json.success === false) {
    const errs = json.errors || [];
    const msg = errs.map((e) => `[${e.code}] ${e.message}`).join("; ") || `HTTP ${res.status}`;
    const err = new Error(msg);
    err.cfErrors = errs;
    err.status = res.status;
    throw err;
  }
  return json;
}

// ---------------------------------------------------------------- 自检

async function selftest() {
  const files = [
    { rel: "index.html", buf: Buffer.from("<html>你好</html>", "utf8") },
    { rel: "audio/ni-hao.mp3", buf: crypto.randomBytes(512) },
    { rel: "nested/deep/x.html", buf: Buffer.alloc(0) },
  ];
  const { body, boundary, manifest } = buildForm(files, "----selftestBOUNDARY");

  // 起本地服务器收下来，再按 boundary 解析回来逐字节比对
  const got = await new Promise((resolve, reject) => {
    const srv = http.createServer((req, res) => {
      const bufs = [];
      req.on("data", (c) => bufs.push(c));
      req.on("end", () => {
        res.writeHead(200, { "Content-Type": "text/plain" });
        res.end("ok");
        srv.close();
        resolve({ ct: req.headers["content-type"], len: req.headers["content-length"], body: Buffer.concat(bufs) });
      });
    });
    srv.on("error", reject);
    srv.listen(0, "127.0.0.1", () => {
      const port = srv.address().port;
      const data = body;
      const req = http.request(
        { host: "127.0.0.1", port, method: "POST", path: "/", headers: { "Content-Type": `multipart/form-data; boundary=${boundary}`, "Content-Length": data.length } },
        () => {}
      );
      req.on("error", reject);
      req.end(data);
    });
  });

  const problems = [];
  const parts = parseForm(got.body, boundary);
  if (got.body.length !== body.length) problems.push(`字节数不符：发出 ${body.length} 收回 ${got.body.length}`);

  const manifestPart = parts.find((p) => p.name === "manifest");
  if (!manifestPart) problems.push("缺少 manifest part");
  let parsed = null;
  if (manifestPart) {
    try {
      parsed = JSON.parse(manifestPart.data.toString("utf8"));
    } catch (e) {
      problems.push(`manifest 不是合法 JSON：${e.message}`);
    }
  }
  if (parsed) {
    // 【硬约束，方向不能反】key 必须带前导斜杠。
    // 这条断言是 2026-09-27 线上事故后加的：不带斜杠时 API 全绿、canonical 也切了，
    // 但全站资源 404。断言的方向必须与「正确形态」一致，否则它会变成「保护 bug 的护栏」。
    for (const k of Object.keys(parsed)) if (!k.startsWith("/")) problems.push(`manifest key 缺前导斜杠：${k}`);
    if (Object.keys(parsed).length !== files.length) problems.push(`manifest 条数 ${Object.keys(parsed).length} ≠ 文件数 ${files.length}`);
    for (const f of files) if (!parsed["/" + f.rel.replace(/^\/+/, "")]) problems.push(`manifest 缺 key：/${f.rel}`);
  }

  for (const f of files) {
    const h = sha256(f.buf);
    const part = parts.find((p) => p.name === h);
    if (!part) {
      problems.push(`找不到 hash=${h.slice(0, 12)}… 的 part（${f.rel}）`);
      continue;
    }
    if (!part.data.equals(f.buf)) problems.push(`part 内容与源文件不一致：${f.rel}`);
  }
  if (manifest && Object.keys(manifest).length !== files.length) problems.push("buildForm 返回的 manifest 条数不对");

  const out = {
    mode: "selftest",
    at: new Date().toISOString(),
    sentBytes: body.length,
    receivedBytes: got.body.length,
    parts: parts.length,
    expectedParts: files.length + 1,
    passed: problems.length === 0,
    problems,
  };
  fs.writeFileSync(path.join(__dirname, "deploy-cf-selftest.txt"), JSON.stringify(out, null, 1), "utf8");
  console.log(out.passed ? `PASS: multipart 自检通过（${files.length} 文件 / ${parts.length} part / ${body.length} 字节）` : `FAIL:\n  ${problems.join("\n  ")}`);
  return out.passed;
}

// ---------------------------------------------------------------- 上线自检

/**
 * 拿「部署专属 URL」当探针，证明这批文件真的被服务到了。
 *
 * 为什么必须做：CF 的 API 对「文件存错位置」这种错**全程不报错**——
 * success:true、deploy:success、canonical_deployment 也切过去了，但站点取不到文件。
 * 2026-09-27 实测就是这样把整站资源弄成 404 的（HTML 还是旧副本，看着像"没生效"）。
 * 唯一可靠的判据 = 直接访问站点，看是否 200。
 * 已验证：好部署（3029a6ae）根路径/CSS/音频全 200；坏部署（4435dac4）根路径 404。
 */
async function verifyServed(shortId, project, keysOrFiles) {
  const base = `https://${shortId}.${project}.pages.dev`;
  // 接受「绝对 key 数组」或「{rel} 数组」，统一成绝对 key。
  // 探针必须用**该部署自己的**文件清单 —— 用别版的清单会探到 404 而误判（第一版夹具就这么错的）。
  const keys = (keysOrFiles || []).map((x) => {
    const s = typeof x === "string" ? x : x.rel;
    return "/" + String(s).replace(/^\/+/, "");
  });
  const asset = keys.find((p) => /^\/_next\/static\/.+\.(js|css)$/.test(p)) || null;
  const audio = keys.find((p) => /\.(mp3|png|ico)$/.test(p)) || null;

  const probe = async (p) => {
    try {
      const r = await directRequest({ method: "GET", url: base + p, headers: { "User-Agent": "deploy-cf-selfcheck" } });
      return { path: p, status: r.status, type: (r.headers["content-type"] || "").split(";")[0] };
    } catch (e) {
      return { path: p, status: 0, error: e.message };
    }
  };

  const checks = [];
  checks.push(await probe("/"));
  if (asset) checks.push(await probe(asset));
  if (audio) checks.push(await probe(audio));
  return { base, checks, ok: checks.every((c) => c.status === 200) };
}

/**
 * 判定「这次上传到底发生了什么」，并保证线上不会停留在坏版本上。
 *
 * 判据全部取自 **CF 的部署记录**，而不是我们这次的 HTTP 响应 ——
 * 因为实测响应会在半路断掉（我们收到 0 字节），而 CF 那边已经建好了部署。
 * 两种收尾都必须正确：
 *   a) 记录里没出现新部署 → 这次没送达，线上未变动，报 FAIL 让重跑（不必回滚）；
 *   b) 记录里有新部署     → 拿**它自己的**文件清单去探针；探不过就自动回滚到 prevDepId。
 */
async function settleDeployment({ account, token, project, prevDepId, knownIds, args, expectedKeys }) {
  const out = { changed: false, servedOk: false };
  const listUrl = `${apiBase(account)}/pages/projects/${encodeURIComponent(project)}/deployments?page=1&per_page=5`;
  // 上传前就存在的部署 id 集合。判定「是不是这次新建的」必须用它，
  // 不能只说 `deps[0].id !== prevDepId` —— 那个条件会把**历史上更晚创建、但已被回滚掉**的
  // 坏部署当成"新部署"（2026-09-27 实测踩到：拿它去探针，探失败后又去回滚一个没问题的线上版本）。
  const known = new Set(knownIds || []);

  let newest = null;
  for (let i = 0; i < 6; i++) {
    try {
      const l = await apiJson({ method: "GET", url: listUrl }, token, "listDeployments");
      newest = (l.result || []).find((d) => !known.has(d.id)) || null;
      if (newest) break;
    } catch (e) {
      out.listError = e.message;
    }
    await sleep(2500);
  }
  if (!newest) return out;

  // 🔴 列部署接口（?page=1&per_page=5）**不返回 `files` 字段** ——
  // 直接读 `newest.files` 永远得到 `{}`，于是报告里印出「文件=0」，
  // 看着像「部署是空的」，跟同一行 `可用=true` 自相矛盾（2026-09-27 实测踩到）。
  // 文件数必须单独 `GET .../deployments/{id}`（详情接口才带 `files`）。
  let filesMap = newest.files || null;
  if (!filesMap || Object.keys(filesMap).length === 0) {
    for (let i = 0; i < 4; i++) {
      try {
        const d = await apiJson(
          { method: "GET", url: `${apiBase(account)}/pages/projects/${encodeURIComponent(project)}/deployments/${newest.id}` },
          token,
          "getDeployment"
        );
        const f = (d && d.result && d.result.files) || null;
        if (f && Object.keys(f).length) {
          filesMap = f;
          break;
        }
      } catch (e) {
        out.detailError = e.message;
      }
      await sleep(2000); // 部署刚建好时详情可能还没挂上 files，给几次机会
    }
  }
  const keys = Object.keys(filesMap || {});
  out.changed = true;
  out.id = newest.id;
  out.shortId = newest.short_id;
  out.url = newest.url || null;
  out.fileCount = keys.length;
  out.fileCountKnown = keys.length > 0;
  out.stages = newest.stages || (newest.latest_stage ? [newest.latest_stage] : []);

  // 🔴 探针绝不能用「空清单」退化到只探 `/`。
  // 只探根路径是本项目**第一次发布事故**里骗过我们的那种假阳性：
  // 边缘可能还留着旧 HTML（`s-maxage=604800`），于是 `/` 返回 200，
  // 而 `_next/static/**` 与 `*.mp3` 全 404 —— 「HTML 能开、站是坏的」。
  // 所以记录里读不到 files 时，改用**我们本次的 manifest keys**去探（那是我们在意的真实集合）。
  const expect = (expectedKeys || []).map((x) => (typeof x === "string" ? x : x.path || x.rel)).filter(Boolean);
  const probeKeys = keys.length ? keys : expect;
  if (!keys.length) {
    out.fileCountSource = "manifest(记录里没读到 files)";
    out.emptyRecord = true;
  } else {
    out.fileCountSource = "deployment";
  }

  // 部署刚建好时可能还没开始服务，给几次重试再判死
  let r = await verifyServed(newest.short_id, project, probeKeys);
  for (let i = 0; i < 3 && !r.ok; i++) {
    await sleep(4000);
    r = await verifyServed(newest.short_id, project, probeKeys);
  }
  out.served = r;
  out.servedOk = r.ok;

  // 探针不过 → 止血：退回上一次部署。绝不让坏版本挂在线等人工发现。
  // 例外：--branch=xxx 建的是**预览**部署（不接管域名），没什么可回滚的，也不该去动线上。
  const isPreview = !!(args || []).find((a) => a.startsWith("--branch="));
  if (!r.ok && prevDepId && !isPreview && !args.includes("--no-autorollback")) {
    try {
      const res = await request(
        { method: "POST", url: `${apiBase(account)}/pages/projects/${encodeURIComponent(project)}/deployments/${prevDepId}/rollback`, headers: authHeaders(token), body: Buffer.alloc(0) },
        { label: "autoRollback", tries: 3 }
      );
      out.rolledBackTo = prevDepId;
      out.rollbackStatus = res.status;
    } catch (e) {
      out.rollbackError = e.message;
    }
  } else if (!r.ok && !prevDepId) {
    out.rollbackError = "不知道上传前的部署 id，无法自动回滚，需人工处理";
  }
  return out;
}

/** 列最近部署的 id（用来判定「哪个是这次新建的」） */
async function listDeploymentIds(account, token, project) {
  try {
    const l = await apiJson({ method: "GET", url: `${apiBase(account)}/pages/projects/${encodeURIComponent(project)}/deployments?page=1&per_page=10` }, token, "listDeployments");
    return (l.result || []).map((d) => d.id);
  } catch {
    return null;
  }
}

/**
 * 一轮上传：POST → （无论成功失败都）核对记录 → 探针 → 必要时回滚。
 * 拆出来是为了外层能整轮重试：大 body 上传在这台机器上是**概率性截断**的，
 * 一次失败不代表发不出去，重试若干轮通常能成，而且每轮都由 settle 负责不留坏版本。
 */
async function uploadOnce({ account, token, project, manifest, entries, url, knownIds, prevDepId, args, report, branch }) {
  const out = { uploadError: null, attempts: null, cfError: null, bodyPrefix: null, transport: null, status: null, assets: null };

  // 先传资源字节。**这一步没成功就别去建部署** —— 建了也只有 manifest、没有内容，
  // 结果是"匹配到路径但取不到文件"（500），比明确失败更难查。
  try {
    out.assets = await uploadAssets({ account, token, project, manifest, entries, report });
    console.log(`资源已上传：${out.assets.uploaded} 个文件 / ${out.assets.buckets} 桶`);
  } catch (e) {
    out.uploadError = `资源上传失败：${e.message}`;
    out.attempts = e.attempts || null;
    console.log(out.uploadError);
    out.settle = { changed: false, servedOk: false };
    return out;
  }

  // deployment 请求只带 manifest（+ 可选 branch）。
  // 🔴 不要把文件字节也当 part 塞进这个请求：2026-09-27 实测**这些 part 会被完全忽略**
  //    （API 照样 success，但 manifest 引用的 hash 在资源库里不存在 → 站点 404/500）。
  const boundary = "----cfd" + crypto.randomBytes(10).toString("hex");
  const depBody = buildManifestForm(manifest, boundary, { branch });
  try {
    const r = await request(
      {
        method: "POST",
        url,
        headers: { "Content-Type": `multipart/form-data; boundary=${boundary}`, "Content-Length": depBody.length, ...authHeaders(token) },
        body: depBody,
      },
      { label: "createDeployment", tries: 3 }
    );
    out.status = r.status;
    out.transport = r.transport || null;
    let j = null;
    try {
      j = JSON.parse(r.body.toString("utf8"));
    } catch {
      /* 下面报 */
    }
    if (r.status >= 400 || (j && j.success === false)) {
      const errs = (j && j.errors) || [];
      out.cfError = errs.map((e) => `[${e.code}] ${e.message}`).join("; ") || `HTTP ${r.status}`;
      out.bodyPrefix = r.body.toString("utf8").slice(0, 300);
      console.log(`CF 拒绝了本次部署：${out.cfError}`);
    } else if (!j || !j.result || !j.result.id) {
      out.cfError = `HTTP ${r.status} 但响应里没有部署 id`;
      out.bodyPrefix = r.body.toString("utf8").slice(0, 300);
      console.log(`响应读不懂（HTTP ${r.status}）→ 前 300 字：${out.bodyPrefix}`);
    }
  } catch (e) {
    // 请求失败 ≠ 没建部署（响应可能半路断掉），所以照样往下走核对记录
    out.uploadError = e.message;
    out.attempts = e.attempts || null;
    console.log(`部署请求失败：${e.message}`);
    if (out.attempts) console.log(`  各次尝试：${out.attempts.join(" | ")}`);
    console.log("  继续核对 CF 侧的部署记录（请求失败 ≠ 没建部署）…");
  }

  out.settle = await settleDeployment({
    account,
    token,
    project,
    prevDepId,
    knownIds,
    args,
    expectedKeys: entries.map((e) => e.path),
  });
  return out;
}

// ---------------------------------------------------------------- 主流程

async function main() {
  const args = process.argv.slice(2);
  if (args.includes("--selftest")) {
    process.exitCode = (await selftest()) ? 0 : 1;
    return;
  }

  const dryRun = args.includes("--dry-run");
  const precheck = args.includes("--precheck");
  const force = args.includes("--force");
  const hostCheck = args.includes("--hostcheck");
  const listDeps = args.includes("--deps");
  const rollbackArg = (args.find((a) => a.startsWith("--rollback")) || "").split("=")[1] || (args.includes("--rollback") ? "latest-good" : null);
  // --branch=xxx → 建**预览**部署（不接管自定义域名），用来安全演练整条链路
  const branch = (args.find((a) => a.startsWith("--branch=")) || "").split("=")[1] || null;
  const projectArg = (args.find((a) => a.startsWith("--project=")) || "").split("=")[1];
  const dirArg = args.find((a) => !a.startsWith("--")) || "out";
  const dir = path.resolve(ROOT, dirArg);

  // 回滚 / 列部署：事故时的止血通道。发坏了必须能一条命令退回去，
  // 否则「自动发布」比手动上传更危险。
  if (listDeps || rollbackArg) {
    const e = loadEnv();
    const acc = e.CF_ACCOUNT_ID;
    const tk = e.CF_API_TOKEN;
    const prj = projectArg || e.CF_PAGES_PROJECT;
    if (!acc || !tk || !prj) {
      console.log("FAIL: 缺凭据（CF_ACCOUNT_ID / CF_API_TOKEN / CF_PAGES_PROJECT）");
      process.exitCode = 1;
      return;
    }
    const list = await apiJson({ method: "GET", url: `${apiBase(acc)}/pages/projects/${encodeURIComponent(prj)}/deployments?page=1&per_page=10` }, tk, "listDeployments");
    const deps = list.result || [];
    const shape = (d) => {
      const st = d.stages || (d.latest_stage ? [d.latest_stage] : []);
      return `${d.id.slice(0, 8)}  ${d.created_on}  env=${d.environment}  deploy=${(st.find((s) => s.name === "deploy") || {}).status || "?"}`;
    };
    console.log(`项目 ${prj} 最近部署：`);
    for (const d of deps) console.log("  " + shape(d));

    if (!rollbackArg) return;

    // latest-good = 列表里的第 2 条。列表按 created_on 倒序，第 1 条就是刚发坏的那次，
    // 直接退回它前一次（就是出事前用户在用的版本）。也可显式给 id 前几位。
    const chosen = rollbackArg === "latest-good" ? deps[1] : deps.find((d) => d.id.startsWith(rollbackArg));
    if (!chosen) {
      console.log(`FAIL: 找不到要回滚的目标部署（--rollback=${rollbackArg}）`);
      process.exitCode = 1;
      return;
    }
    console.log(`\n回滚到 ${chosen.id}（${chosen.created_on}）…`);
    const res = await request(
      { method: "POST", url: `${apiBase(acc)}/pages/projects/${encodeURIComponent(prj)}/deployments/${chosen.id}/rollback`, headers: authHeaders(tk), body: Buffer.alloc(0) },
      { label: "rollback", tries: 3 }
    );
    let j = null;
    try {
      j = JSON.parse(res.body.toString("utf8"));
    } catch {
      /* 下面报 */
    }
    const ok = res.status < 400 && (!j || j.success !== false);
    fs.writeFileSync(
      path.join(__dirname, "deploy-cf-rollback.txt"),
      JSON.stringify({ at: new Date().toISOString(), project: prj, target: chosen.id, targetCreated: chosen.created_on, status: res.status, success: !!(j && j.success), transport: res.transport, bodyPrefix: (res.body.toString("utf8") || "").slice(0, 300) }, null, 1),
      "utf8"
    );
    console.log(ok ? `PASS: 已回滚到 ${chosen.id.slice(0, 8)}（看 CF 面板确认生效）` : `FAIL: HTTP ${res.status} → ${res.body.toString("utf8").slice(0, 200)}`);
    process.exitCode = ok ? 0 : 1;
    return;
  }

  // 纯离线模式：只回答「这批产物属于哪个站、匹配不匹配这个项目名」，不联网
  if (hostCheck) {
    const env0 = loadEnv();
    const project0 = projectArg || env0.CF_PAGES_PROJECT || "chinesequick";
    const r = checkHost(dir, project0, env0.CF_EXPECT_HOST);
    fs.writeFileSync(path.join(__dirname, "deploy-cf-hostcheck.txt"), JSON.stringify({ at: new Date().toISOString(), dir, ...r }, null, 1), "utf8");
    console.log(`产物域名 : ${r.sitemapHost || "(读不到)"}`);
    console.log(`配置域名 : ${r.siteHost || "(未设置)"}`);
    console.log(`项目名   : ${r.project}`);
    console.log(r.ok ? "PASS: 归属一致" : `FAIL:\n  ${r.problems.join("\n  ")}`);
    process.exitCode = r.ok ? 0 : 1;
    return;
  }

  const env = loadEnv();
  // dry-run 的用途是验证「网络 + Bearer 格式 + CF 报错解析」，故意用假凭据；
  // 它一定会在第一步认证失败，所以不要求真实的项目名。
  const account = dryRun ? "0".repeat(32) : env.CF_ACCOUNT_ID;
  const token = dryRun ? "fake-token-for-error-parsing-0123456789" : env.CF_API_TOKEN;
  const project = projectArg || (dryRun ? env.CF_PAGES_PROJECT || "dry-run-project" : env.CF_PAGES_PROJECT);

  const report = { at: new Date().toISOString(), dir, project, dryRun, precheck, token: maskToken(token) };

  if (!dryRun) {
    const need = ["CF_ACCOUNT_ID", "CF_API_TOKEN"];
    if (!project) need.push("CF_PAGES_PROJECT");
    const missing = need.filter((k) => !env[k]);
    if (missing.length) {
      const msg = `缺少凭据：.env.local 里还差 ${missing.join(" / ")}`;
      report.failed = msg;
      fs.writeFileSync(path.join(__dirname, "deploy-cf.txt"), JSON.stringify(report, null, 1), "utf8");
      console.log(`FAIL: ${msg}`);
      process.exitCode = 1;
      return;
    }
  }

  // 1) 预检：项目名大小写是否对得上（提前抓住"打错一个字母"，而不是上传后才发现）
  try {
    // 这个端点的 per_page 上限很低：实测 per_page=25/50 一律 400 [8000024] Invalid list options，
    // 只有默认档/≤20 能用。所以不能一次要 100 条 —— 必须分页拿全，否则项目一多就会
    // 「看不见自己的项目」，把「名字没错」误判成「名字打错」而拒绝发布（比漏发更坏：挡住正确操作）。
    const names = [];
    const PER = 10;
    for (let page = 1; page <= 50; page++) {
      const list = await apiJson({ method: "GET", url: `${apiBase(account)}/pages/projects?page=${page}&per_page=${PER}` }, token, "listProjects");
      const batch = (list.result || []).map((p) => p.name);
      names.push(...batch);
      report.projectPagesFetched = page;
      if (batch.length < PER) break;
    }
    report.projects = names;
    report.projectMatched = names.includes(project);
    if (!report.projectMatched) {
      report.hint = `项目名不匹配。你有的项目：${names.join(", ")}（大小写敏感）`;
      fs.writeFileSync(path.join(__dirname, "deploy-cf.txt"), JSON.stringify(report, null, 1), "utf8");
      console.log(`FAIL: 项目名 "${project}" 不在列表里。已有：${names.join(", ")}`);
      process.exitCode = 1;
      return;
    }
    console.log(`OK: 凭据有效，项目 "${project}" 存在`);
    if (dryRun) report.cfErrorParsingVerified = true;
  } catch (e) {
    report.cfError = e.message;
    // dry-run 用假凭据，本来就应该被 CF 拒；拿到「被解析出来的」CF 错误码才算通过
    const parsedAuthError = dryRun && /9106|Authentication|Unauthorized|invalid/i.test(e.message);
    report.ok = parsedAuthError;
    report.cfErrorParsingVerified = parsedAuthError;
    fs.writeFileSync(path.join(__dirname, "deploy-cf.txt"), JSON.stringify(report, null, 1), "utf8");
    if (parsedAuthError) {
      console.log(`PASS: 连通与认证链路正常，CF 报错已被解析 → ${e.message}`);
      return;
    }
    console.log(`FAIL: 预检失败 → ${e.message}`);
    process.exitCode = 1;
    return;
  }

  // 1.5) 归属自检：这批产物是不是这个站的（多站点账号下别发到隔壁去）
  const hc = checkHost(dir, project, env.CF_EXPECT_HOST);
  report.hostCheck = hc;
  if (!hc.ok) {
    fs.writeFileSync(path.join(__dirname, "deploy-cf.txt"), JSON.stringify(report, null, 1), "utf8");
    console.log(`FAIL: 产物归属自检不过，已拒绝上传\n  产物域名 ${hc.sitemapHost || "(读不到)"} / 配置 ${hc.siteHost || "(未设置)"} / 项目 ${project}\n  ${hc.problems.join("\n  ")}`);
    process.exitCode = 1;
    return;
  }
  console.log(`OK: 归属一致（产物 ${hc.sitemapHost} → 项目 ${project}）`);

  if (precheck) {
    fs.writeFileSync(path.join(__dirname, "deploy-cf.txt"), JSON.stringify(report, null, 1), "utf8");
    console.log("PRECHECK 通过（未上传）");
    return;
  }

  // 2) 收集产物 + 限额
  const files = collectFiles(dir);
  const tooBig = files.filter((f) => f.buf.length > MAX_FILE);
  report.fileCount = files.length;
  report.totalBytes = files.reduce((n, f) => n + f.buf.length, 0);
  if (files.length > MAX_FILES) {
    console.log(`FAIL: 文件数 ${files.length} 超过 ${MAX_FILES}`);
    process.exitCode = 1;
    return;
  }
  if (tooBig.length) {
    console.log(`FAIL: ${tooBig.length} 个文件超过 25 MiB：${tooBig.map((f) => f.rel).slice(0, 5).join(", ")}`);
    process.exitCode = 1;
    return;
  }
  console.log(`产物：${files.length} 个文件 / ${(report.totalBytes / 1024).toFixed(0)} KB`);

  // 3) 上传。先记下「上传前的 canonical 部署」—— 事后一切以 CF 的记录为准。
  //    manifest 用 md5(内容)；文件字节走 /pages/assets/upload 单独传（见 uploadAssets）。
  const { manifest, entries } = buildManifest(files);
  report.manifestEntries = Object.keys(manifest).length;

  let prevDepId = null;
  let knownIds = [];
  try {
    const pj = await apiJson({ method: "GET", url: `${apiBase(account)}/pages/projects/${encodeURIComponent(project)}` }, token, "getProject");
    prevDepId = (pj.result && pj.result.canonical_deployment && pj.result.canonical_deployment.id) || null;
    const before = await apiJson({ method: "GET", url: `${apiBase(account)}/pages/projects/${encodeURIComponent(project)}/deployments?page=1&per_page=10` }, token, "listBeforeUpload");
    knownIds = (before.result || []).map((d) => d.id);
  } catch (e) {
    report.prevDeploymentError = e.message;
  }
  report.prevDeployment = prevDepId;
  report.knownDeployments = knownIds.length;

  const url = `${apiBase(account)}/pages/projects/${encodeURIComponent(project)}/deployments${force ? "?force=true" : ""}`;

  // 4) 整轮重试：大 body 上传是概率性截断的（实测同一条命令时成时败），
  //    一次失败不代表发不出去。每轮都由 settleDeployment 收尾（探针 + 不过就回滚），
  //    所以重试不会堆积坏版本 —— 这是"敢重试"的前提。
  const rounds = Math.max(1, Number((args.find((a) => a.startsWith("--attempts=")) || "").split("=")[1]) || 3);
  report.rounds = [];
  let settle = null;
  let served = null;
  let last = null;
  for (let round = 1; round <= rounds; round++) {
    if (round > 1) {
      console.log(`— 第 ${round}/${rounds} 轮 —`);
      const now = await listDeploymentIds(account, token, project);
      if (now) knownIds = now; // 上一轮的坏部署已被回滚，把它并入"已知"，免得下一轮再被当成新建的
    }
    last = await uploadOnce({ account, token, project, manifest, entries, url, knownIds, prevDepId, args, report, branch });
    settle = last.settle || null;
    served = (settle && settle.served) || null;
    report.rounds.push({
      round,
      newDeployment: !!(settle && settle.changed),
      id: settle && settle.id ? settle.id.slice(0, 8) : null,
      fileCount: (settle && settle.fileCount) || 0,
      fileCountSource: (settle && settle.fileCountSource) || null,
      servedOk: !!(settle && settle.servedOk),
      rolledBackTo: settle && settle.rolledBackTo ? settle.rolledBackTo.slice(0, 8) : null,
      uploadError: last.uploadError || null,
      cfError: last.cfError || null,
    });
    if (settle && settle.changed && settle.servedOk) break;
  }

  report.settle = settle;
  if (served) report.served = served;
  if (last) {
    if (last.uploadError) report.uploadError = last.uploadError;
    if (last.attempts) report.uploadAttempts = last.attempts;
    if (last.cfError) report.cfError = last.cfError;
    if (last.transport) report.transport = last.transport;
  }
  if (settle && settle.url) report.url = settle.url;
  if (settle && settle.id) report.deploymentId = settle.id;

  report.ok = !!(settle && settle.changed && settle.servedOk);
  if (!report.ok) {
    if (!settle || !settle.changed) {
      report.hint = `试了 ${report.rounds.length} 轮，CF 侧始终没有出现新部署 → 请求没送达，线上未变动，重跑即可（无需回滚）`;
    } else if (settle.emptyRecord) {
      report.hint = `部署记录里读不到文件清单（详情接口连续返回空），已改用本次 manifest 的 ${files.length} 个路径做探针；探针不过 → 已回滚。可加大 --attempts 再来`;
    } else {
      report.hint = `新部署只带上 ${settle.fileCount} 个文件（应为 ${files.length}）→ 上传被中途截断、探针不过，已回滚；可加大 --attempts 再来`;
    }
  }

  fs.writeFileSync(path.join(__dirname, "deploy-cf.txt"), JSON.stringify(report, null, 1), "utf8");
  console.log(
    "每轮：" +
      report.rounds
        .map(
          (r) =>
            `#${r.round} 新建=${r.newDeployment} 文件=${r.fileCount}${r.fileCountSource === "deployment" ? "" : "(未知)"} 可用=${r.servedOk}${r.rolledBackTo ? " 已回滚" : ""}`
        )
        .join(" | ")
  );
  if (report.ok) {
    console.log(`PASS: 已上线 → ${report.url || project}`);
    console.log(`  自检：${served.checks.map((c) => `${c.path} ${c.status}`).join(" / ")}`);
  } else {
    if (report.uploadError) console.log(`上传错误：${report.uploadError}`);
    if (report.cfError) console.log(`CF 报错：${report.cfError}`);
    if (served) console.log(`  自检探针：${served.checks.map((c) => `${c.path} ${c.status}`).join(" / ")}`);
    if (report.hint) console.log(`  结论：${report.hint}`);
    if (settle && settle.rolledBackTo) console.log(`  已自动回滚到 ${String(settle.rolledBackTo).slice(0, 8)}（线上恢复为上一版）`);
    if (settle && settle.rollbackError) console.log(`  ⚠ 自动回滚未完成，需人工处理：${settle.rollbackError}`);
  }
  process.exitCode = report.ok ? 0 : 1;
}

if (require.main === module) {
  main().catch((e) => {
    console.log(`FAIL: 未捕获异常 → ${e.message}`);
    process.exitCode = 1;
  });
}

module.exports = { buildForm, parseForm, collectFiles, sha256, maskToken, loadEnv, parseHttpResponse, verifyServed };
