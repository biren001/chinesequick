'use strict';
/*
 * 用 CDP 无头 Chrome 验证「线上音频真的能播」。
 *
 * 为什么不用 curl：curl 只能证明文件在，证明不了
 *   ① 浏览器能不能解码这个 mp3  ② 点按钮时真的会去取那个文件  ③ 页面被点后状态对
 *
 * 用法: node _dev/verify-audio-live.js [baseUrl]
 * 结果写 _dev/verify-audio.txt（不靠 stdout）
 */
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const http = require('http');
const { createAnalyticsFilter } = require('./no-analytics');

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, '_dev', 'verify-audio.txt');
const BASE = require('./baseurl').normalizeBase(process.argv[2], 'https://chinesequick.com');
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const PORT = 9800 + (process.pid % 180);
const PROFILE = path.join(ROOT, '_dev', '_audio-profile');
const CHROME_LOG = path.join(ROOT, '_dev', 'chrome-audio.log');

const PAGES = [
  { path: '/chinese-restaurant-phrases/', audio: '/audio/1.mp3', note: '集合页（10 条整句）' },
  { path: '/how-to-say-how-much-in-chinese/', audio: '/audio/words/duoshao.mp3', note: '单句页（含逐词表）' },
  { path: '/learn/restaurant/', audio: '/audio/1.mp3', note: '学习页（客户端渲染）' },
];

const DEVICE = { w: 390, h: 844 };

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function httpJson(url) {
  return new Promise((resolve, reject) => {
    http
      .get(url, (res) => {
        let body = '';
        res.on('data', (c) => (body += c));
        res.on('end', () => {
          try {
            resolve(JSON.parse(body));
          } catch (e) {
            reject(e);
          }
        });
      })
      .on('error', reject);
  });
}

/* 页面内跑的一段：测解码 + 点按钮 + 量溢出。整段写死在文件里，不经命令行传参。 */
const PROBE = `(async () => {
  const out = {};
  out.overflowPx = Math.max(0, document.documentElement.scrollWidth - window.innerWidth);

  const btns = Array.from(document.querySelectorAll('button'));
  const listen = btns.find(b => (b.getAttribute('aria-label') || '') === 'Listen');
  out.listenBtn = !!listen;
  out.listenDisabled = listen ? !!listen.disabled : null;

  const ghost = btns.filter(b => (b.getAttribute('aria-label') || '').startsWith('Play ')).length;
  out.ghostBtns = ghost;               // 逐词表里的图标按钮
  out.audioTags = document.querySelectorAll('audio').length;

  const wait = (ms) => new Promise(r => setTimeout(r, ms));

  out.decode = await new Promise(resolve => {
    const a = new Audio('__AUDIO__?v=' + Date.now());
    const t = setTimeout(() => resolve('timeout'), 9000);
    a.addEventListener('canplaythrough', () => { clearTimeout(t); resolve('canplaythrough'); }, { once: true });
    a.addEventListener('error', () => {
      clearTimeout(t);
      resolve('error:' + (a.error ? a.error.code + '/' + a.error.message : 'unknown'));
    }, { once: true });
    a.volume = 0;
    a.play().catch(() => {});
  });

  out.durationSec = await new Promise(resolve => {
    const a = new Audio('__AUDIO__?v=' + Date.now());
    const t = setTimeout(() => resolve(-1), 9000);
    a.addEventListener('loadedmetadata', () => { clearTimeout(t); resolve(+(a.duration || 0).toFixed(2)); }, { once: true });
    a.addEventListener('error', () => { clearTimeout(t); resolve(-1); }, { once: true });
    a.load();
  });

  if (listen) {
    /*
      连播（repeats>1）会改变「播完复位」的时间尺度，必须先读出 N。
      按钮在**未播放时**会常驻一个 \`×N\` 徽标（播放中变成 \`1/3\` 这样的进度）——
      所以点击前读它，才能算出该等多久。
      🔴 踩过：断言写死「点完等 3.5 秒应复位」，而 repeats=3 的真实时长是
      3×clip + 2×650ms 间隔 ≈ 3.7 秒（示例音频 0.81s）→ 探针在还在播的时候就采样，
      报出「播完未复位」的**假失败**。判据本身没错，等的时间错了。
      （旧版此脚本还要求 mp3 必须回 200，同理已放宽到 200≤s<300 —— CF 对 Range 回 206。）
    */
    out.repeatTotal = 1;
    const badge = listen.querySelector('span[aria-hidden="true"]');
    if (badge) {
      const m = /^(?:×|x)(\\d+)$/.exec((badge.textContent || '').trim());
      if (m) out.repeatTotal = parseInt(m[1], 10);
      out.badgeBefore = (badge.textContent || '').trim();
    }

    out.pressBefore = listen.getAttribute('aria-pressed');
    listen.click();
    await wait(500);
    out.pressDuring = listen.getAttribute('aria-pressed');

    // 轮询而不是死等：真实时长 = N×clip + (N-1)×间隔，再加上首播加载与缓冲的余量。
    // 这比"猜一个够大的常数"可靠 —— 音频换成长句时它自己就跟着变。
    const N = out.repeatTotal;
    const est = (out.durationSec > 0 ? out.durationSec : 1) * N + 0.65 * (N - 1);
    const deadline = Math.min(30000, Math.max(4000, est * 1000 + 4000));
    const t0 = Date.now();
    while (Date.now() - t0 < deadline) {
      if (listen.getAttribute('aria-pressed') === 'false') break;
      await wait(200);
    }
    out.pressAfter = listen.getAttribute('aria-pressed');
    out.resetAfterMs = Date.now() - t0;
    out.resetDeadlineMs = Math.round(deadline);
  }
  return JSON.stringify(out);
})()`;

async function run() {
  const report = { base: BASE, device: DEVICE, pages: [], requests: [], errors: [] };

  fs.rmSync(PROFILE, { recursive: true, force: true });
  const log = fs.openSync(CHROME_LOG, 'w');
  const chrome = spawn(
    CHROME,
    [
      '--headless=new',
      '--disable-gpu',
      '--no-first-run',
      '--no-default-browser-check',
      '--autoplay-policy=no-user-gesture-required',
      '--mute-audio',
      '--remote-debugging-port=' + PORT,
      '--user-data-dir=' + PROFILE,
      'about:blank',
    ],
    { stdio: ['ignore', log, log] }
  );

  let version = null;
  for (let i = 0; i < 90; i++) {
    try {
      version = await httpJson('http://127.0.0.1:' + PORT + '/json/version');
      break;
    } catch {
      await sleep(500);
    }
  }
  if (!version) {
    let tail = '';
    try {
      tail = fs.readFileSync(CHROME_LOG, 'utf8').slice(-400);
    } catch {}
    throw new Error('Chrome 调试端口没起来（port ' + PORT + '）log=' + tail);
  }

  const list = await httpJson('http://127.0.0.1:' + PORT + '/json/list');
  const target = list.find((t) => t.type === 'page');
  if (!target) throw new Error('没有 page target');

  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((res, rej) => {
    ws.addEventListener('open', res, { once: true });
    ws.addEventListener('error', rej, { once: true });
  });

  let seq = 0;
  let loadFired = false;
  const pending = new Map();
  const ga = createAnalyticsFilter();
  ws.addEventListener('message', (ev) => {
    let msg;
    try {
      msg = JSON.parse(ev.data);
    } catch {
      return;
    }
    if (msg.id && pending.has(msg.id)) {
      pending.get(msg.id)(msg);
      pending.delete(msg.id);
      return;
    }
    if (ga.observe(msg)) return;
    if (msg.method === 'Network.responseReceived') {
      const r = msg.params.response;
      if (/\.mp3(\?|$)/.test(r.url)) {
        report.requests.push({ url: r.url.replace(BASE, ''), status: r.status, fromDiskCache: !!r.fromDiskCache });
      }
    }
    if (msg.method === 'Page.loadEventFired') {
      loadFired = true;
    }
  });

  const send = (method, params) =>
    new Promise((resolve, reject) => {
      const id = ++seq;
      pending.set(id, (msg) => (msg.error ? reject(new Error(method + ': ' + msg.error.message)) : resolve(msg.result)));
      ws.send(JSON.stringify({ id, method, params: params || {} }));
    });

  await send('Page.enable');
  await send('Network.enable');
  report.analyticsBlocked = await ga.block(send);
  await send('Runtime.enable');
  await send('Emulation.setDeviceMetricsOverride', {
    width: DEVICE.w,
    height: DEVICE.h,
    deviceScaleFactor: 2,
    mobile: true,
  });
  await send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });

  for (const p of PAGES) {
    loadFired = false;
    const before = report.requests.length;
    await send('Page.navigate', { url: BASE + p.path + '?cb=' + Date.now() });
    for (let i = 0; i < 60 && !loadFired; i++) await sleep(200);
    await sleep(1200); // 等客户端渲染/hydrate 完成

    const res = await send('Runtime.evaluate', {
      expression: PROBE.replace(/__AUDIO__/g, p.audio),
      awaitPromise: true,
      returnByValue: true,
    });

    const entry = { path: p.path, note: p.note, probe: null, mp3Requests: [] };
    if (res.exceptionDetails) {
      entry.probe = { error: res.exceptionDetails.text + ' ' + (res.exceptionDetails.exception || {}).description };
    } else {
      try {
        entry.probe = JSON.parse(res.result.value);
      } catch {
        entry.probe = { raw: res.result.value };
      }
    }
    entry.mp3Requests = report.requests.slice(before);
    report.pages.push(entry);
  }

  ws.close();
  chrome.kill();
  await sleep(400);
  fs.rmSync(PROFILE, { recursive: true, force: true });

  /* ---- 判定 ---- */
  const fails = [];
  for (const pg of report.pages) {
    const q = pg.probe || {};
    const tag = pg.path;
    if (q.error) fails.push(`${tag} 探针异常: ${q.error}`);
    if (q.decode !== 'canplaythrough') fails.push(`${tag} 解码失败: ${q.decode}`);
    if (!(q.durationSec > 0)) fails.push(`${tag} 时长无效: ${q.durationSec}`);
    if (q.overflowPx > 0) fails.push(`${tag} 横向溢出 ${q.overflowPx}px`);
    if (q.listenDisabled) fails.push(`${tag} Listen 按钮被禁用`);
    if (q.pressDuring !== 'true') fails.push(`${tag} 点击后 aria-pressed 未置真: ${q.pressDuring}`);
    // 「播完复位」这一条必须结合连播次数看：repeats=3 时按钮在 3 遍播完前保持按下是**正确行为**。
    // 探针已按 badge 上的 ×N 推算等待窗口（见 PROBE 里的说明），这里只判最终是否回落。
    if (q.pressAfter !== 'false')
      fails.push(
        `${tag} 播完未复位: ${q.pressAfter}（×${q.repeatTotal} 连播，等了 ${q.resetAfterMs}ms / 上限 ${q.resetDeadlineMs}ms）`
      );
    // 206 是正常的：浏览器对 <audio> 会发 Range 请求，Cloudflare 回 206 Partial Content。
    // 只认 200 会把"部署正确"误判成失败（踩过一次）。
    const ok = pg.mp3Requests.some((r) => r.status >= 200 && r.status < 300);
    if (!ok) fails.push(`${tag} 播放期间没有成功取到 mp3`);
  }
  report.verdict = fails.length ? 'FAIL' : 'PASS';
  report.fails = fails;
  report.analytics = ga.stats();

  return report;
}

run()
  .then((report) => {
    fs.writeFileSync(OUT, JSON.stringify(report, null, 2), 'utf8');
    process.exit(report.verdict === 'PASS' ? 0 : 1);
  })
  .catch((err) => {
    fs.writeFileSync(OUT, JSON.stringify({ error: String(err && err.stack || err) }, null, 2), 'utf8');
    process.exit(2);
  });
