'use strict';
/*
 * 诊断「线上页面出现客户端异常」。
 *
 * 抓四类证据（curl 抓不到这些）：
 *   ① JS 未捕获异常（Runtime.exceptionThrown）
 *   ② console.error（Runtime.consoleAPICalled）
 *   ③ 浏览器层日志（Log.entryAdded，含 CSP / 证书 / 资源失败）
 *   ④ 失败的请求 + 非 2xx 响应（Network.loadingFailed / responseReceived）
 *
 * 额外做一件事：**每个页面加载两次**。第一次是冷访客，第二次是「装完 service worker 的回访用户」——
 * 后者才是静态站最容易崩的场景（SW 给出旧 HTML → 旧 HTML 引用已被新部署删掉的 chunk → JS 全挂）。
 *
 * 用法: node _dev/check-errors-live.js [baseUrl]
 * 结果写 _dev/errors-live.txt（不靠 stdout）
 */
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const http = require('http');
const { createAnalyticsFilter } = require('./no-analytics');

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, '_dev', 'errors-live.txt');
const BASE = require('./baseurl').normalizeBase(process.argv[2], 'https://chinesequick.com');
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const PORT = 9700 + (process.pid % 200);
const PROFILE = path.join(ROOT, '_dev', '_err-profile');
const CHROME_LOG = path.join(ROOT, '_dev', 'chrome-err.log');

const PAGES = ['/', '/how-to-say-how-much-in-chinese/', '/learn/restaurant/', '/about/', '/scenarios/', '/scenarios/ordering-food/'];
const DEVICE = { w: 390, h: 844 };

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function httpJson(url) {
  return new Promise((resolve, reject) => {
    http
      .get(url, (res) => {
        let b = '';
        res.on('data', (c) => (b += c));
        res.on('end', () => {
          try {
            resolve(JSON.parse(b));
          } catch (e) {
            reject(e);
          }
        });
      })
      .on('error', reject);
  });
}

/* 页面内自查：React 到底渲染出来没有 */
const PROBE = `(() => {
  const body = document.body;
  const txt = (body ? body.innerText : '').trim();
  return {
    title: document.title,
    bodyChars: txt.length,
    h1: (document.querySelector('h1') || {}).textContent || null,
    nextError: !!document.querySelector('[data-nextjs-error]'),
    errOverlay: /Application error|客户端异常|client-side exception/i.test(txt),
    swController: !!(navigator.serviceWorker && navigator.serviceWorker.controller),
    scriptsFailed: Array.from(document.querySelectorAll('script[src]')).filter(s => s.dataset.failed === '1').length,
  };
})()`;

(async () => {
  const report = { base: BASE, at: new Date().toISOString(), pages: [], issues: [] };

  fs.rmSync(PROFILE, { recursive: true, force: true });
  const log = fs.openSync(CHROME_LOG, 'w');
  spawn(
    CHROME,
    [
      '--headless=new',
      '--disable-gpu',
      '--no-first-run',
      '--no-default-browser-check',
      '--mute-audio',
      '--remote-debugging-port=' + PORT,
      '--user-data-dir=' + PROFILE,
      'about:blank',
    ],
    { stdio: ['ignore', log, log] }
  );

  let ok = null;
  for (let i = 0; i < 90; i++) {
    try {
      ok = await httpJson('http://127.0.0.1:' + PORT + '/json/version');
      break;
    } catch {
      await sleep(500);
    }
  }
  if (!ok) throw new Error('Chrome 调试端口没起来（port ' + PORT + '）');

  const list = await httpJson('http://127.0.0.1:' + PORT + '/json/list');
  const target = list.find((t) => t.type === 'page');
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((res, rej) => {
    ws.addEventListener('open', res, { once: true });
    ws.addEventListener('error', rej, { once: true });
  });

  let seq = 0;
  const pending = new Map();
  let bucket = [];
  let loadFired = false;
  // 统计脚本拦掉并忽略。必须放在异常判定之前 —— 被拦的请求会以
  // net::ERR_BLOCKED_BY_CLIENT 出现，不忽略就会自己报一堆"线上异常"。
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
    const p = msg.params || {};
    switch (msg.method) {
      case 'Page.loadEventFired':
        loadFired = true;
        break;
      case 'Runtime.exceptionThrown':
        bucket.push({
          kind: 'uncaught',
          text: (p.exceptionDetails && (p.exceptionDetails.exception?.description || p.exceptionDetails.text)) || '?',
          url: p.exceptionDetails && p.exceptionDetails.url,
        });
        break;
      case 'Runtime.consoleAPICalled':
        if (p.type === 'error' || p.type === 'warning') {
          bucket.push({
            kind: 'console.' + p.type,
            text: (p.args || []).map((a) => a.value ?? a.description ?? a.type).join(' ').slice(0, 400),
          });
        }
        break;
      case 'Log.entryAdded':
        if (p.entry && (p.entry.level === 'error' || p.entry.level === 'warning')) {
          bucket.push({ kind: 'log.' + p.entry.level, text: p.entry.text, url: p.entry.url });
        }
        break;
      case 'Network.loadingFailed':
        bucket.push({ kind: 'net-failed', text: (p.errorText || '?') + ' ' + (p.type || ''), url: p.requestId });
        break;
      case 'Network.responseReceived': {
        const r = p.response;
        if (r && r.status >= 400) bucket.push({ kind: 'http-' + r.status, text: r.url });
        break;
      }
      default:
        break;
    }
  });

  const send = (method, params) =>
    new Promise((resolve, reject) => {
      const id = ++seq;
      pending.set(id, (m) => (m.error ? reject(new Error(method + ': ' + m.error.message)) : resolve(m.result)));
      ws.send(JSON.stringify({ id, method, params: params || {} }));
    });

  const evaluate = async (expr) => {
    const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
    if (r.exceptionDetails) return { __err: r.exceptionDetails.text };
    return r.result ? r.result.value : null;
  };

  await send('Page.enable');
  await send('Network.enable');
  report.analyticsBlocked = await ga.block(send);
  await send('Runtime.enable');
  await send('Log.enable');
  await send('Emulation.setDeviceMetricsOverride', {
    width: DEVICE.w,
    height: DEVICE.h,
    deviceScaleFactor: 2,
    mobile: true,
  });

  for (const p of PAGES) {
    for (const pass of [1, 2]) {
      bucket = [];
      loadFired = false;
      await send('Page.navigate', { url: BASE + p });
      for (let i = 0; i < 60 && !loadFired; i++) await sleep(250);
      await sleep(3500);

      const probe = await evaluate(PROBE);
      const entry = { path: p, pass, probe, events: bucket.slice(0, 25) };
      report.pages.push(entry);

      if (probe && probe.__err) report.issues.push(`${p} pass${pass} 探针异常 ${probe.__err}`);
      const real = bucket.filter(
        (e) => e.kind === 'uncaught' || e.kind === 'console.error' || e.kind.startsWith('http-')
      );
      for (const e of real) report.issues.push(`${p} pass${pass} [${e.kind}] ${e.text.slice(0, 200)}`);
    }
  }

  report.analytics = ga.stats();
  fs.writeFileSync(OUT, JSON.stringify(report, null, 1), 'utf8');
  ws.close();
  try {
    require('child_process').execSync('taskkill /F /IM chrome.exe /T', { stdio: 'ignore' });
  } catch {}
  process.exit(report.issues.length ? 1 : 0);
})().catch((e) => {
  fs.writeFileSync(OUT, JSON.stringify({ base: BASE, fatal: String(e) }, null, 1), 'utf8');
  process.exit(2);
});
