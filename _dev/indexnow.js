// IndexNow 推送（Bing / Yandex / 部分 AI 检索共用索引，无日配额）
// 用法：node _dev/indexnow.js --all        只推 sitemap 里「没推过」的
//       node _dev/indexnow.js --force      强制重推全部
//       node _dev/indexnow.js <url> [...]  只推指定 URL（不受状态过滤）
const fs = require("fs");
const https = require("https");
const path = require("path");

const HOST = "chinesequick.com";
const ORIGIN = `https://${HOST}`;
const SITEMAP = path.join("out", "sitemap.xml");
const STATE = "_dev/indexnow-state.json";
const KEY = fs.readFileSync("_dev/indexnow-key.txt", "utf8").trim();

function request(options, body) {
  return new Promise((resolve) => {
    const req = https.request(options, (res) => {
      const c = [];
      res.on("data", (d) => c.push(d));
      res.on("end", () =>
        resolve({ status: res.statusCode, body: Buffer.concat(c).toString("utf8") })
      );
    });
    req.on("timeout", () => { req.destroy(); resolve({ err: "TIMEOUT" }); });
    req.on("error", (e) => resolve({ err: e.message }));
    if (body) req.write(body);
    req.end();
  });
}

async function withRetry(fn, tries = 3) {
  let last;
  for (let i = 0; i < tries; i++) {
    last = await fn();
    if (!last.err) return last;
  }
  return last;
}

(async () => {
  const args = process.argv.slice(2);
  const force = args.includes("--force");
  const explicit = args.filter((a) => a.startsWith("http"));

  const xml = fs.readFileSync(SITEMAP, "utf8");
  let urls = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);

  // 防呆：只允许推本站 URL（片段简写极易拼出 404 路径并真的推出去）
  if (explicit.length) {
    const bad = explicit.filter((u) => !u.startsWith(ORIGIN + "/"));
    if (bad.length) {
      console.error("拒绝推送非本站 URL：", bad.join(", "));
      process.exit(1);
    }
    urls = explicit;
  } else if (!force) {
    const state = fs.existsSync(STATE)
      ? JSON.parse(fs.readFileSync(STATE, "utf8"))
      : { submitted: [] };
    const done = new Set(state.submitted);
    urls = urls.filter((u) => !done.has(u));
  }

  if (!urls.length) {
    console.log("没有需要推送的 URL（状态文件里都已推过，用 --force 强制重推）");
    return;
  }

  // 硬前提：key 文件必须能通过 https://<host>/<key>.txt 访问，否则推了不生效且不报错
  const keyCheck = await withRetry(() =>
    request({
      host: HOST,
      port: 443,
      path: `/${KEY}.txt`,
      method: "GET",
      headers: { "User-Agent": "indexnow-probe" },
      timeout: 15000,
    })
  );
  const keyOk = !keyCheck.err && keyCheck.status === 200 && keyCheck.body.trim() === KEY;
  if (!keyOk) {
    console.error(
      "⚠️ key 文件线上校验失败（" +
        (keyCheck.err || `HTTP ${keyCheck.status}`) +
        "）—— IndexNow 要求 https://" +
        HOST +
        "/" +
        KEY +
        ".txt 返回 200 且内容等于 key。先部署站点再推送。"
    );
    process.exit(2);
  }

  const payload = JSON.stringify({
    host: HOST,
    key: KEY,
    keyLocation: `${ORIGIN}/${KEY}.txt`,
    urlList: urls,
  });

  const res = await withRetry(() =>
    request(
      {
        host: "api.indexnow.org",
        port: 443,
        path: "/indexnow",
        method: "POST",
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          "Content-Length": Buffer.byteLength(payload),
        },
        timeout: 30000,
      },
      payload
    )
  );

  const report = {
    pushed: urls.length,
    status: res.status,
    err: res.err || null,
    body: (res.body || "").slice(0, 300),
  };

  // 只在整批成功时写状态 —— 失败也写会导致下次永久漏推
  if (!res.err && (res.status === 200 || res.status === 202)) {
    const state = fs.existsSync(STATE)
      ? JSON.parse(fs.readFileSync(STATE, "utf8"))
      : { submitted: [] };
    state.submitted = Array.from(new Set([...state.submitted, ...urls]));
    state.updatedAt = new Date().toISOString();
    fs.writeFileSync(STATE, JSON.stringify(state, null, 1), "utf8");
    report.stateWritten = true;
  } else {
    report.stateWritten = false;
    report.hint =
      res.status === 403
        ? "403 = key 校验未通过"
        : res.status === 422
          ? "422 = URL 不属于该 host 或格式错误"
          : res.status === 429
            ? "429 = 请求过快，稍后重试"
            : "未写入状态，可安全重跑";
  }

  fs.writeFileSync("_dev/indexnow.txt", JSON.stringify(report, null, 1), "utf8");
  console.log(JSON.stringify(report));
})();
