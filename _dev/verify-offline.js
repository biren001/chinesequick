// 实测线上「works offline」成立到什么程度。
// 做法：无头 Chrome 正常访问线上站（让 SW 安装并预缓存音频）→ CDP 把网络切成 offline
//       → 重载 / 打开已访问页 / 点朗读，看是否真的还能用。
//
// 用法： node _dev/verify-offline.js [baseURL]   默认 https://chinesequick.com/
// 结果写 _dev/offline-verify.txt；断言不过退 1。
const fs = require("fs");
const path = require("path");
const os = require("os");
const { spawn } = require("child_process");

const BASE = (process.argv[2] || "https://chinesequick.com/").replace(/\/$/, "");
const PORT = 41261;
const CHROME = "C:/Program Files/Google/Chrome/Application/chrome.exe";
const REPORT = path.join(__dirname, "offline-verify.txt");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const lines = [];
const say = (s) => { lines.push(s); console.log(s); };

class CDP {
  constructor(ws) { this.ws = ws; this.id = 0; this.pending = new Map();
    ws.addEventListener("message", (ev) => { const m = JSON.parse(ev.data);
      if (m.id && this.pending.has(m.id)) { const { resolve, reject } = this.pending.get(m.id); this.pending.delete(m.id); m.error ? reject(new Error(JSON.stringify(m.error))) : resolve(m.result); } });
  }
  send(method, params = {}) { const id = ++this.id; return new Promise((res, rej) => { this.pending.set(id, { resolve: res, reject: rej }); this.ws.send(JSON.stringify({ id, method, params })); setTimeout(() => { if (this.pending.has(id)) { this.pending.delete(id); rej(new Error("CDP timeout " + method)); } }, 120000); }); }
}

(async () => {
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), "cq-offline-"));
  const chrome = spawn(CHROME, ["--headless=new", `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, "--no-first-run", "--mute-audio", "--autoplay-policy=no-user-gesture-required", "--disable-gpu", "about:blank"], { stdio: "ignore", env: { ...process.env, CODEBUDDY_SAFE_DELETE_ENABLED: "0" } });

  let t = null;
  for (let i = 0; i < 40 && !t; i++) { await sleep(500); try { const l = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json(); t = l.find((x) => x.type === "page"); } catch {} }
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
  const go = async (u) => { await cdp.send("Page.navigate", { url: u }); await sleep(3000); };
  const offline = (on) => cdp.send("Network.emulateNetworkConditions", { offline: on, latency: 0, downloadThroughput: on ? 0 : -1, uploadThroughput: on ? 0 : -1 });

  say("目标站点: " + BASE);

  // ---------- 联网首访：等 SW 装好 + 音频预缓存 ----------
  await go(BASE + "/");
  let info = { mp3: 0 };
  for (let i = 0; i < 40; i++) {
    await sleep(1000);
    info = await ev(`(async()=>{const ns=await caches.keys();let mp3=0,pages=[];for(const k of ns){const c=await caches.open(k);const ks=await c.keys();mp3+=ks.filter(x=>x.url.endsWith('.mp3')).length;pages=pages.concat(ks.filter(x=>x.mode==='navigate').map(x=>x.url));}return {caches:ns,mp3:mp3,pages:pages};})()`);
    if (info.mp3 >= 105) break;
  }
  say("SW 状态: " + JSON.stringify(await ev(`navigator.serviceWorker.controller?{controller:true,script:navigator.serviceWorker.controller.scriptURL}:{controller:false}`)));
  say("缓存桶: " + JSON.stringify(info.caches));
  say("预缓存音频: " + info.mp3 + " 条（清单 105 条）");
  say("已缓存页面: " + JSON.stringify(info.pages.map((u) => u.replace(BASE, ""))));

  // 联网逛两个页（模拟真实用户）
  await go(BASE + "/how-to-say-thank-you-in-chinese/");
  await go(BASE + "/chinese-numbers/");

  // ---------- 断网 ----------
  await offline(true);
  say("");
  say("-- 已切到 offline --");

  await cdp.send("Page.reload", {});
  await sleep(3000);
  say("断网重载（数字页）: " + (await ev(`location.pathname + ' || ' + (/Chinese numbers|数字/.test(document.body.innerText) ? '内容在' : '内容不在')`)));

  await go(BASE + "/how-to-say-thank-you-in-chinese/");
  say("断网打开已访问短语页: " + (await ev(`location.pathname + ' || ' + (/不客气/.test(document.body.innerText) ? '正文在' : '正文不在')`)));

  const PLAY = (src) => `(async()=>{const a=new Audio(${JSON.stringify(src)});const v=await new Promise((res)=>{a.addEventListener('canplay',()=>res('canplay'),{once:true});a.addEventListener('error',()=>res('error:'+(a.error&&a.error.code)),{once:true});setTimeout(()=>res('timeout'),15000);a.play().catch(()=>{});});return {v:v,dur:a.duration};})()`;
  let p1 = await ev(PLAY("/audio/42.mp3"));
  say("断网朗读 谢谢（/audio/42.mp3）: " + JSON.stringify(p1));

  // 点真实按钮（AudioButton）走一遍
  const btn = await ev(`(async()=>{const b=document.querySelector('button[aria-label="Listen"]');if(!b)return 'no-button';b.click();await new Promise(r=>setTimeout(r,4000));const a=document.querySelector('audio');return a?('src='+a.currentSrc.split('/').pop()+' readyState='+a.readyState):'no-audio-el';})()`);
  say("断网点页面朗读按钮: " + btn);

  await go(BASE + "/how-to-say-hello-in-chinese/");
  say("断网打开未访问页: " + (await ev(`location.pathname + ' || ' + (/Pick a situation|Find a phrase/.test(document.body.innerText) ? '回落到首页内容' : '拿到该页内容')`)));

  for (const s of ["/audio/slow/42.mp3", "/audio/numbers/ba.mp3", "/audio/words/ai.mp3"]) {
    say(`断网 ${s}: ` + JSON.stringify(await ev(PLAY(s))));
  }

  // ---------- 恢复网络 ----------
  await offline(false);
  await go(BASE + "/how-to-say-hello-in-chinese/");
  say("");
  say("-- 恢复网络 --");
  say("恢复后打开短语页: " + (await ev(`/你好/.test(document.body.innerText) ? '正常' : '异常'`)));

  ws.close(); chrome.kill();
  try { fs.rmSync(profile, { recursive: true, force: true }); } catch {}

  const ok = info.mp3 >= 105 && p1.v === "canplay" && /内容在|正文在/.test(lines.join("\n"));
  say("");
  say("判定: " + (ok ? "PASS ✅ 断网可朗读、已访问页可离线打开" : "FAIL ❌ 见上"));
  fs.writeFileSync(REPORT, lines.join("\n"), "utf8");
  process.exit(ok ? 0 : 1);
})().catch((e) => {
  say("脚本异常: " + e.message);
  fs.writeFileSync(REPORT, lines.join("\n"), "utf8");
  process.exit(2);
});
