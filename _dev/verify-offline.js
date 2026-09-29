// 实测「works offline」到底成立到什么程度。
//
// 🔴 为什么默认走**本地静态服务器 + 中途把服务器关掉**：
//    CDP 的 Network.emulateNetworkConditions offline 只作用于页面所在渲染进程，
//    **管不到 Service Worker 自己发的请求** —— 那样测出来的是假断网
//    （SW 照样联网，拿到的是服务器的 404 页，看起来像「离线能用」其实是联网）。
//    把服务器关掉 = 真·连接被拒，谁也连不上。
//
// 用法：
//   node _dev/verify-offline.js                    # 本地模式（默认，真断网，推荐）
//   node _dev/verify-offline.js https://xxx/       # 线上模式（CDP 模拟断网，仅作参考）
//
// 结果写 _dev/offline-verify.txt；断言不过退 1。
const http = require("http");
const fs = require("fs");
const path = require("path");
const os = require("os");
const { spawn } = require("child_process");

const CHROME = "C:/Program Files/Google/Chrome/Application/chrome.exe";
const REPORT = path.join(__dirname, "offline-verify.txt");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const LOCAL = !process.argv[2];
const BASE = LOCAL ? "" : process.argv[2].replace(/\/$/, "");
const PORT = LOCAL ? 41299 : 41261;
const ROOT = path.join(__dirname, "..", "out");

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".mp3": "audio/mpeg",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".txt": "text/plain; charset=utf-8",
  ".webmanifest": "application/manifest+json",
  ".ico": "image/x-icon",
};

const lines = [];
const say = (s) => { lines.push(s); console.log(s); };

function startServer() {
  const sockets = new Set();
  const server = http.createServer((req, res) => {
    let p = decodeURIComponent(req.url.split("?")[0]);
    if (p.endsWith("/")) p += "index.html";
    const file = path.join(ROOT, p);
    if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      res.writeHead(404, { "Content-Type": "text/plain" });
      res.end("not found");
      return;
    }
    res.writeHead(200, { "Content-Type": TYPES[path.extname(file)] || "application/octet-stream" });
    fs.createReadStream(file).pipe(res);
  });
  server.on("connection", (s) => {
    sockets.add(s);
    s.on("close", () => sockets.delete(s));
  });
  // 真断网：停止监听 + 掐掉所有 keep-alive 连接，否则 Chrome 复用旧连接还能拿到数据
  server.hardClose = () => {
    server.close();
    for (const s of sockets) s.destroy();
  };
  return new Promise((r) => server.listen(PORT, "127.0.0.1", () => r(server)));
}

class CDP {
  constructor(ws) { this.ws = ws; this.id = 0; this.pending = new Map();
    ws.addEventListener("message", (ev) => { const m = JSON.parse(ev.data);
      if (m.id && this.pending.has(m.id)) { const { resolve, reject } = this.pending.get(m.id); this.pending.delete(m.id); m.error ? reject(new Error(JSON.stringify(m.error))) : resolve(m.result); } }); }
  send(method, params = {}) { const id = ++this.id; return new Promise((res, rej) => { this.pending.set(id, { resolve: res, reject: rej }); this.ws.send(JSON.stringify({ id, method, params })); setTimeout(() => { if (this.pending.has(id)) { this.pending.delete(id); rej(new Error("CDP timeout " + method)); } }, 120000); }); }
}

(async () => {
  let server = null;
  let base = BASE;
  if (LOCAL) {
    server = await startServer();
    base = `http://127.0.0.1:${PORT}`;
    say(`模式: 本地真断网（中途关掉服务器）  ${base} ← out/`);
  } else {
    say(`模式: 线上 + CDP 模拟断网（⚠ SW 可能仍能联网，仅供参考）  ${base}`);
  }

  const profile = fs.mkdtempSync(path.join(os.tmpdir(), "cq-offline-"));
  const chrome = spawn(CHROME, ["--headless=new", `--remote-debugging-port=${PORT + 1}`, `--user-data-dir=${profile}`, "--no-first-run", "--mute-audio", "--autoplay-policy=no-user-gesture-required", "--disable-gpu", "about:blank"], { stdio: "ignore", env: { ...process.env, CODEBUDDY_SAFE_DELETE_ENABLED: "0" } });

  let t = null;
  for (let i = 0; i < 40 && !t; i++) { await sleep(500); try { const l = await (await fetch(`http://127.0.0.1:${PORT + 1}/json/list`)).json(); t = l.find((x) => x.type === "page"); } catch {} }
  if (!t) throw new Error("拿不到 Chrome 调试目标");

  const ws = new WebSocket(t.webSocketDebuggerUrl);
  await new Promise((r) => ws.addEventListener("open", r, { once: true }));
  const cdp = new CDP(ws);
  await cdp.send("Page.enable"); await cdp.send("Network.enable"); await cdp.send("Runtime.enable");
  const ev = async (e) => {
    const r = await cdp.send("Runtime.evaluate", { expression: e, awaitPromise: true, returnByValue: true });
    if (r.exceptionDetails) return "EVAL错误:" + r.exceptionDetails.text;
    return r.result.value;
  };
  const go = async (u) => { await cdp.send("Page.navigate", { url: u }); await sleep(2500); };

  // ---------- 联网首访：等 SW 装好 + 预缓存 ----------
  await go(base + "/");
  let info = { mp3: 0, pages: [] };
  for (let i = 0; i < 180; i++) {
    await sleep(1000);
    info = await ev(`(async()=>{const ns=await caches.keys();let mp3=0,pages=[];for(const k of ns){const c=await caches.open(k);const ks=await c.keys();mp3+=ks.filter(x=>x.url.endsWith('.mp3')).length;pages=pages.concat(ks.filter(x=>!/\\.(mp3|js|css|png|svg|ico|json|webmanifest)$/.test(new URL(x.url).pathname)).map(x=>new URL(x.url).pathname));}return {caches:ns,mp3:mp3,pages:pages};})()`);
    if (info.mp3 >= 401) break;
  }
  say("SW controller: " + (await ev(`navigator.serviceWorker.controller?navigator.serviceWorker.controller.scriptURL:'无'`)));
  say("缓存桶: " + JSON.stringify(info.caches));
  say("预缓存音频: " + info.mp3 + " 条（全站 401 条）");
  say("预缓存页面: " + (info.pages || []).length + " 个 → " + JSON.stringify(info.pages));

  // 联网逛两个页
  await go(base + "/how-to-say-thank-you-in-chinese/");
  await go(base + "/chinese-numbers/");

  // ---------- 断网 ----------
  if (LOCAL) {
    server.hardClose();
    say("");
    say("-- 服务器已关闭（真断网：连接被拒）--");
  } else {
    await cdp.send("Network.emulateNetworkConditions", { offline: true, latency: 0, downloadThroughput: 0, uploadThroughput: 0 });
    say("");
    say("-- CDP offline --");
  }

  await cdp.send("Page.reload", {});
  await sleep(2500);
  const numbers = await ev(`location.pathname + ' || ' + (/Chinese numbers|数字/.test(document.body.innerText) ? '内容在' : '内容不在')`);
  say("断网重载（数字页）: " + numbers);

  await go(base + "/how-to-say-thank-you-in-chinese/");
  const visited = await ev(`(/不客气/.test(document.body.innerText) ? '正文在' : '正文不在')`);
  say("断网打开已访问短语页: " + visited);

  const PLAY = (src) => `(async()=>{const a=new Audio(${JSON.stringify(src)});const v=await new Promise((res)=>{a.addEventListener('canplay',()=>res('canplay'),{once:true});a.addEventListener('error',()=>res('error'),{once:true});setTimeout(()=>res('timeout'),12000);a.play().catch(()=>{});});return {v:v,dur:a.duration};})()`;
  const p1 = await ev(PLAY("/audio/42.mp3"));
  say("断网朗读 谢谢（/audio/42.mp3）: " + JSON.stringify(p1));

  // ⚠ 别用 ASCII 撇号匹配：页面里渲染的是印刷体 ’（U+2019），/You're/ 永远不命中
  await go(base + "/how-to-say-hello-in-chinese/");
  say("断网打开未访问页: " + (await ev(`(/stored on this device/.test(document.body.innerText) ? 'offline 兜底页' : (/Pick a situation|Find a phrase/.test(document.body.innerText) ? '错：回落到首页内容' : '被预取命中，拿到真实内容'))`)));

  await go(base + "/definitely-not-a-real-page-zzz/");
  const fallback = await ev(`(/stored on this device/.test(document.body.innerText) ? 'offline 兜底页 ✅' : (/could not be found/.test(document.body.innerText) ? '错：拿到服务器 404 页（说明根本没断网）' : ('其它内容 → title=' + document.title + ' body=' + document.body.innerText.slice(0,100))))`);
  say("断网打开不存在页: " + fallback);
  say("  地址栏: " + (await ev(`location.href`)));

  for (const s of ["/audio/slow/42.mp3", "/audio/numbers/ba.mp3", "/audio/words/ai.mp3"]) {
    say(`断网 ${s}: ` + JSON.stringify(await ev(PLAY(s))));
  }

  ws.close(); chrome.kill();
  try { fs.rmSync(profile, { recursive: true, force: true }); } catch {}

  const ok =
    info.mp3 >= 401 &&
    p1.v === "canplay" &&
    /内容在/.test(numbers) &&
    visited === "正文在" &&
    /offline 兜底页/.test(fallback);
  say("");
  say("判定: " + (ok ? "PASS ✅ 断网可朗读、已访问页可开、未缓存页落到 offline 页" : "FAIL ❌ 见上"));
  fs.writeFileSync(REPORT, lines.join("\n"), "utf8");
  process.exit(ok ? 0 : 1);
})().catch((e) => {
  say("脚本异常: " + e.message);
  fs.writeFileSync(REPORT, lines.join("\n"), "utf8");
  process.exit(2);
});
