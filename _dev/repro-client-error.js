'use strict';
/*
 * 复现「用户真机白屏 + React error #418 + insertBefore NotFoundError」。
 *
 * 背景：check-errors-live.js 在无头浏览器里跑 8 次加载都是 0 错误，
 * 说明崩溃依赖带外条件。用户截图给了两条关键线索：
 *   ① 那条报错文字是中文 → 页面上有翻译脚本在改 DOM（Chrome 内置翻译/LanguageDetector）
 *   ② insertBefore "not a child of this node" → 典型的「DOM 被 React 之外的东西改过」
 *
 * 本脚本跑多组对照：
 *   baseline           干净加载（应当无异常）
 *   returning-user     预置 localStorage（收藏 / 进度 / 错题）后加载
 *   translate-text     文字节点被包进 <font>（模拟 Chrome/Google 翻译）
 *   translate+click    上一条 + 之后点心形触发 React 更新
 *   move-elements+click 元素被挪进新容器（模拟扩展改写）+ 交互
 *   text+move+click    两者叠加 + 交互
 *
 * 模拟脚本会像真实 Chrome 一样尊重 `translate="no"` / notranslate meta：
 * 站点一旦声明不翻译，模拟器也必须收手，否则「修复前 vs 修复后」对照就失去意义。
 *
 * 用法: node _dev/repro-client-error.js [baseUrl] [path] [scenarioNames]
 *   例: node _dev/repro-client-error.js http://127.0.0.1:4173 /crash-test/ baseline
 *       （第三个参数是逗号分隔的场景名，省略则跑全部）
 * 结果写 _dev/repro-error.txt
 */
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const http = require('http');
const { createAnalyticsFilter } = require('./no-analytics');

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, '_dev', 'repro-error.txt');
const BASE = require('./baseurl').normalizeBase(process.argv[2], 'https://real-life-chinese.app.workbuddy.host');
const TARGET_PATH = process.argv[3] || '/learn/restaurant/';
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const PORT = 9500 + (process.pid % 200);
const PROFILE = path.join(ROOT, '_dev', '_repro-profile');
const CHROME_LOG = path.join(ROOT, '_dev', 'chrome-repro.log');

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

/* 模拟 Google/Chrome 翻译：把每个文字节点包进 <font> 里（这正是它改写 DOM 的方式） */
const TRANSLATE_SIM = `(() => {
  function optedOut() {
    if (document.documentElement.getAttribute('translate') === 'no') return true;
    if (document.querySelector('meta[name="google"][content="notranslate"]')) return true;
    return false;
  }
  function wrapTextNodes() {
    if (!document.body || optedOut()) return 0;
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
      acceptNode(n) {
        const p = n.parentNode;
        if (!p) return NodeFilter.FILTER_REJECT;
        const tag = p.nodeName;
        if (tag === 'SCRIPT' || tag === 'STYLE' || tag === 'FONT' || tag === 'NOSCRIPT') return NodeFilter.FILTER_REJECT;
        if (!n.nodeValue || !n.nodeValue.trim()) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      },
    });
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    for (const n of nodes) {
      try {
        const font = document.createElement('font');
        font.setAttribute('class', 'translated-ltr');
        n.parentNode.insertBefore(font, n);
        font.appendChild(n);
      } catch (e) {}
    }
    return nodes.length;
  }
  let total = 0;
  document.addEventListener('DOMContentLoaded', () => { total += wrapTextNodes(); });
  let ticks = 0;
  const timer = setInterval(() => {
    total += wrapTextNodes();
    if (++ticks >= 120) clearInterval(timer);
  }, 100);
  window.__translateSim = () => total;
})()`;

/* 更狠的一类外来改写：**移动元素**（扩展横幅、阅读模式、翻译工具都会这么干）。
 * React 插入新节点时会拿「后一个兄弟元素」当锚点；锚点被挪走 =
 * "The node before which the new node is to be inserted is not a child of this node"。 */
const MOVE_SIM = `(() => {
  function moved() {
    if (document.documentElement.getAttribute('translate') === 'no') return 0;
    if (document.querySelector('meta[name="google"][content="notranslate"]')) return 0;
    let n = 0;
    const containers = Array.from(document.querySelectorAll('main, header, section, ol, ul, div'))
      .filter((c) => c.children.length > 1 && !c.hasAttribute('data-ext-wrap'))
      .slice(0, 12);
    for (const c of containers) {
      for (const k of Array.from(c.children)) {
        try {
          const wrap = document.createElement('div');
          wrap.setAttribute('data-ext-wrap', '1');
          c.insertBefore(wrap, k);
          wrap.appendChild(k);
          n++;
        } catch (e) {}
      }
    }
    return n;
  }
  document.addEventListener('DOMContentLoaded', () => { window.__moveSim1 = moved(); });
  setTimeout(() => { window.__moveSim2 = moved(); }, 2500);
  window.__moveSim = () => (window.__moveSim1 || 0) + (window.__moveSim2 || 0);
})()`;

/* 页面存活探针：到底是渲染出来了，还是被 Next 的默认报错页替换了 */
const PROBE = `(() => {
  const body = document.body;
  const txt = (body ? body.innerText : '').trim();
  let h1 = null, links = 0, buttons = 0, h1Count = 0;
  try {
    h1 = (document.querySelector('h1') || {}).textContent || null;
    h1Count = document.querySelectorAll('h1').length;
    links = document.querySelectorAll('a').length;
    buttons = document.querySelectorAll('button').length;
  } catch (e) {}
  return {
    bodyChars: txt.length,
    bodyChildren: body ? body.children.length : -1,
    h1,
    h1Count,
    links,
    buttons,
    nextErrorPage: /Application error|client-side exception|应用程序错误|客户端异常/i.test(txt),
    firstText: txt.slice(0, 120),
    translateAttr: document.documentElement.getAttribute('translate'),
    notranslateMeta: !!document.querySelector('meta[name="google"][content="notranslate"]'),
    mutations: typeof window.__translateSim === 'function' ? window.__translateSim() : null,
    movedEls: typeof window.__moveSim === 'function' ? window.__moveSim() : null,
    errorBoundary: !!document.querySelector('[data-error-boundary]'),
  };
})()`;

const SEED = `(() => {
  localStorage.setItem('rlc-saved-v1', JSON.stringify({ version: 1, ids: [3, 7, 12] }));
  localStorage.setItem('rlc-progress-v1', JSON.stringify({
    version: 1,
    completedIds: [1, 2, 3, 4, 5],
    quiz: { restaurant: { best: 60, attempts: 1 } },
    mistakes: { restaurant: [2, 5] },
    streak: 2,
    lastActive: '2026-09-26',
  }));
  return Object.keys(localStorage);
})()`;

const ONLY = (process.argv[4] || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

const SCENARIOS = [
  { name: 'baseline', seed: false, sim: null, interact: false },
  { name: 'returning-user', seed: true, sim: null, interact: false },
  { name: 'translate-text', seed: false, sim: TRANSLATE_SIM, interact: false },
  { name: 'translate+click', seed: false, sim: TRANSLATE_SIM, interact: true },
  { name: 'move-elements+click', seed: false, sim: MOVE_SIM, interact: true },
  { name: 'text+move+click', seed: false, sim: TRANSLATE_SIM + ';\n' + MOVE_SIM, interact: true },
].filter((s) => (ONLY.length ? ONLY.includes(s.name) : true));

(async () => {
  const report = { base: BASE, path: TARGET_PATH, at: new Date().toISOString(), scenarios: [] };
  let seeded = false;

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
  if (!ok) throw new Error('Chrome 调试端口没起来');

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
  const scriptIds = [];
  // 统计脚本拦掉并忽略 —— 被拦的请求会以 net::ERR_BLOCKED_BY_CLIENT 出现，
  // 不忽略就会让这个脚本把"我们自己的拦截"报成客户端异常。详见 _dev/no-analytics.js。
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
          text:
            (p.exceptionDetails &&
              (p.exceptionDetails.exception?.description || p.exceptionDetails.text)) ||
            '?',
        });
        break;
      case 'Runtime.consoleAPICalled':
        if (p.type === 'error' || p.type === 'warning') {
          bucket.push({
            kind: 'console.' + p.type,
            text: (p.args || []).map((a) => a.value ?? a.description ?? a.type).join(' ').slice(0, 500),
          });
        }
        break;
      case 'Log.entryAdded':
        if (p.entry && p.entry.level === 'error') {
          bucket.push({ kind: 'log.error', text: p.entry.text, url: p.entry.url });
        }
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

  const inject = async (source) => {
    const r = await send('Page.addScriptToEvaluateOnNewDocument', { source });
    scriptIds.push(r.identifier);
  };
  const clearInjected = async () => {
    for (const id of scriptIds.splice(0)) {
      await send('Page.removeScriptToEvaluateOnNewDocument', { identifier: id }).catch(() => {});
    }
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

  const load = async (url) => {
    bucket = [];
    loadFired = false;
    await send('Page.navigate', { url });
    for (let i = 0; i < 60 && !loadFired; i++) await sleep(250);
    await sleep(4000);
    return evaluate(PROBE);
  };

  /* 先访问一次源站，拿到 localStorage 的写权限 */
  await load(BASE + '/');

  for (const sc of SCENARIOS) {
    await clearInjected();
    if (sc.sim) await inject(sc.sim);

    if (sc.seed && !seeded) {
      await evaluate(SEED);
      seeded = true;
    }

    const probe = await load(BASE + TARGET_PATH);
    const entry = { name: sc.name, probe, events: bucket.slice(0, 20), after: null };

    /* DOM 被外来脚本改过之后，再让 React 更新一次（点心形）——
     * 这正是「insertBefore: not a child of this node」的触发点 */
    if (sc.interact) {
      entry.click = await evaluate(
        `(() => {
          const b = document.querySelector('button[aria-label*="Save"], button[aria-label*="saved"]');
          if (!b) return 'no-button';
          b.click();
          return 'clicked';
        })()`
      );
      await sleep(2500);
      entry.after = await evaluate(PROBE);
    }

    report.scenarios.push(entry);
  }

  report.analytics = ga.stats();
  fs.writeFileSync(OUT, JSON.stringify(report, null, 1), 'utf8');
  ws.close();
  try {
    require('child_process').execSync('taskkill /F /IM chrome.exe /T', { stdio: 'ignore' });
  } catch {}
  process.exit(0);
})().catch((e) => {
  fs.writeFileSync(OUT, JSON.stringify({ base: BASE, fatal: String(e) }, null, 1), 'utf8');
  process.exit(2);
});
