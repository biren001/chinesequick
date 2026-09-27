'use strict';
/*
 * 真机验证「一次点击连播 N 遍」（AudioButton 的 repeats）。
 *
 * 为什么必须真机：连播是纯客户端时序逻辑（Audio 元素复用、ended、runRef 取消、
 * 与 audioBus 互斥），静态 HTML 里一个字都看不到。以下四种坏法全都"页面照常打开、
 * 控制台不报错"，只有真的点下去数遍数才发现：
 *   ① 第二遍不响（元素没回到 currentTime=0，play() 立刻 ended）
 *   ② 卡在 Stop 不再收尾（终态没回 false，按钮一直亮着）
 *   ③ 点第二次停不下来（无限响，用户只能刷新）
 *   ④ 互斥失效（两张卡同时响）
 *
 * ⚠️ 关键取证方式：**不能靠数 mp3 请求判断播了几遍** —— 同一个 <audio> 元素连播时
 * src 没变，浏览器不会重新发请求（第二三遍走缓存/内存），请求数恒为 1。
 * 唯一可靠的证据是按钮上那枚进度徽标（Stop 1/3 → 2/3 → 3/3）的**完整变化序列**，
 * 所以探针里用 MutationObserver 抓轨迹，而不是轮询采样（1200ms 一遍，轮询必漏）。
 *
 * 用法：
 *   node _dev/static-server.js &          # 本地 127.0.0.1:4173
 *   node _dev/verify-repeat.js            # 默认验本地 out/
 *   node _dev/verify-repeat.js https://chinesequick.com
 * 结果写 _dev/verify-repeat.txt
 * 注意：会建临时 Chrome profile → 跑之前加 CODEBUDDY_SAFE_DELETE_ENABLED=0，否则 exit 2
 */
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const http = require('http');
const { createAnalyticsFilter } = require('./no-analytics');

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, '_dev', 'verify-repeat.txt');
const BASE = require('./baseurl').normalizeBase(process.argv[2], 'http://127.0.0.1:4173');
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const PORT = 9900 + (process.pid % 90);
const PROFILE = path.join(ROOT, '_dev', '_repeat-profile');
const CHROME_LOG = path.join(ROOT, '_dev', 'chrome-repeat.log');

const DEVICE = { w: 390, h: 844 };
/** 3 遍 × (<=0.9s 音频 + 650ms 间隔) ≈ 3.7s；留足余量但别等到用户以为脚本挂了。 */
const FULL_CYCLE_MS = 9000;
const save = (ms) => new Promise((r) => setTimeout(r, ms));

async function rmrf(dir) {
  for (let i = 0; i < 12; i++) {
    try {
      fs.rmSync(dir, { recursive: true, force: true });
      return true;
    } catch {
      await save(400);
    }
  }
  return false;
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

/* ---------- 探针（整段写死在文件里，避免经命令行传参时引号被吃掉） ---------- */

/**
 * 单句页：点一次 Listen → 必须依次走完 1/3、2/3、3/3，然后自己收尾。
 * 这条同时覆盖坏法 ①②。
 */
const PROBE_FULL_CYCLE = `(async () => {
  const out = { overflowPx: Math.max(0, document.documentElement.scrollWidth - window.innerWidth) };
  const wait = (ms) => new Promise(r => setTimeout(r, ms));
  const btn = () => document.querySelector('button[aria-label="Listen"]');
  const b = btn();
  out.found = !!b;
  if (!b) return JSON.stringify(out);

  out.idleText = b.textContent.trim();
  out.pressedBefore = b.getAttribute('aria-pressed');
  // Slow 不该被带上连播（它一遍就要 1.5s，三遍会拖成 6 秒）
  const slow = document.querySelector('button[aria-label="Slow"]');
  out.slowText = slow ? slow.textContent.trim() : null;

  const seq = [];
  const push = () => {
    const t = btn() && btn().textContent.trim();
    if (t && seq[seq.length - 1] !== t) seq.push(t);
  };
  const mo = new MutationObserver(push);
  mo.observe(b, { childList: true, subtree: true, characterData: true });

  b.click();
  push();
  await wait(${FULL_CYCLE_MS});
  mo.disconnect();
  out.seq = seq;
  out.pressedAfter = btn().getAttribute('aria-pressed');
  out.idleTextAfter = btn().textContent.trim();
  return JSON.stringify(out);
})()`;

/** 单句页：连播途中再点一下 → 必须立刻停，而且之后不能再自己响起来（坏法 ③）。 */
const PROBE_STOP_MIDWAY = `(async () => {
  const out = {};
  const wait = (ms) => new Promise(r => setTimeout(r, ms));
  const btn = () => document.querySelector('button[aria-label="Listen"]');
  if (!btn()) { out.found = false; return JSON.stringify(out); }
  out.found = true;

  btn().click();
  await wait(1500);
  out.midText = btn().textContent.trim();
  out.midPressed = btn().getAttribute('aria-pressed');

  btn().click();
  await wait(250);
  out.stoppedText = btn().textContent.trim();
  out.stoppedPressed = btn().getAttribute('aria-pressed');

  // 静默观察窗：停掉之后按钮文本不该再有任何变化
  const after = [];
  const mo = new MutationObserver(() => {
    const t = btn() && btn().textContent.trim();
    if (t && after[after.length - 1] !== t) after.push(t);
  });
  mo.observe(btn(), { childList: true, subtree: true, characterData: true });
  await wait(3500);
  mo.disconnect();
  out.afterStopSeq = after;
  out.finalPressed = btn().getAttribute('aria-pressed');
  return JSON.stringify(out);
})()`;

/** 学习页：A 卡连播途中点 B 卡 → A 必须立刻停，B 开始连播（audioBus 互斥，坏法 ④）。 */
const PROBE_CARD_MUTEX = `(async () => {
  const out = { overflowPx: Math.max(0, document.documentElement.scrollWidth - window.innerWidth) };
  const wait = (ms) => new Promise(r => setTimeout(r, ms));
  const cards = () => Array.from(document.querySelectorAll('button[aria-label="Listen"]'));
  out.cardCount = cards().length;
  if (out.cardCount < 2) { out.found = false; return JSON.stringify(out); }
  out.found = true;
  out.firstText = cards()[0].textContent.trim();

  cards()[0].click();
  await wait(1300);
  out.aDuring = cards()[0].getAttribute('aria-pressed');

  cards()[1].click();
  await wait(1600);
  out.aAfter = cards()[0].getAttribute('aria-pressed');
  out.bAfter = cards()[1].getAttribute('aria-pressed');
  out.aTextAfter = cards()[0].textContent.trim();

  // A 被顶掉之后不该偷偷接着播第 2/3 遍
  const tail = [];
  const mo = new MutationObserver(() => {
    const t = cards()[0] && cards()[0].textContent.trim();
    if (t && tail[tail.length - 1] !== t) tail.push(t);
  });
  mo.observe(cards()[0], { childList: true, subtree: true, characterData: true });
  await wait(3000);
  mo.disconnect();
  out.aTail = tail;
  out.aFinal = cards()[0].getAttribute('aria-pressed');
  return JSON.stringify(out);
})()`;

const STEPS = [
  { path: '/how-to-say-hello-in-chinese/', probe: PROBE_FULL_CYCLE, note: '单句页：点一次走完三遍并收尾' },
  { path: '/how-to-say-hello-in-chinese/', probe: PROBE_STOP_MIDWAY, note: '单句页：途中再点一下立刻停住' },
  { path: '/learn/everyday/', probe: PROBE_CARD_MUTEX, note: '学习页：A 连播中点 B，A 立刻让位' },
];

async function run() {
  const report = { base: BASE, device: DEVICE, steps: [], consoleErrors: [], fails: [] };

  await rmrf(PROFILE);
  const log = fs.openSync(CHROME_LOG, 'w');
  const chrome = spawn(
    CHROME,
    [
      '--headless=new',
      '--disable-gpu',
      '--no-first-run',
      '--no-default-browser-check',
      // 脚本里的 .click() 是合成点击，Chrome 不把它算作用户手势 ——
      // 没这个开关时 audio.play() 会被自动播放策略直接拒绝，整轮全红且看不出原因。
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
      await save(500);
    }
  }
  if (!version) {
    try {
      report.chromeLog = fs.readFileSync(CHROME_LOG, 'utf8').slice(-400);
    } catch {}
    throw new Error('Chrome 调试端口没起来（port ' + PORT + '）');
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
  const audioResponses = [];
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
    if (msg.method === 'Page.loadEventFired') loadFired = true;
    if (msg.method === 'Network.responseReceived') {
      const r = msg.params.response;
      if (/\.mp3(\?|$)/.test(r.url)) audioResponses.push({ url: r.url, status: r.status });
    }
    if (msg.method === 'Runtime.exceptionThrown') {
      report.consoleErrors.push('exception: ' + (msg.params.exceptionDetails.text || ''));
    }
    if (msg.method === 'Runtime.consoleAPICalled' && msg.params.type === 'error') {
      report.consoleErrors.push(
        'console.error: ' + JSON.stringify(msg.params.args.map((a) => a.value || a.description))
      );
    }
    if (msg.method === 'Log.entryAdded' && msg.params.entry.level === 'error') {
      report.consoleErrors.push('log: ' + msg.params.entry.text);
    }
  });

  const send = (method, params) =>
    new Promise((resolve, reject) => {
      const id = ++seq;
      pending.set(id, (msg) => (msg.error ? reject(new Error(method + ': ' + msg.error.message)) : resolve(msg.result)));
      ws.send(JSON.stringify({ id, method, params: params || {} }));
    });

  await send('Page.enable');
  await send('Runtime.enable');
  await send('Log.enable');
  await send('Network.enable');
  report.analyticsBlocked = await ga.block(send);
  await send('Emulation.setDeviceMetricsOverride', {
    width: DEVICE.w,
    height: DEVICE.h,
    deviceScaleFactor: 2,
    mobile: true,
  });
  await send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });

  for (const step of STEPS) {
    loadFired = false;
    const audioFrom = audioResponses.length;
    await send('Page.navigate', { url: BASE + step.path });
    for (let i = 0; i < 90 && !loadFired; i++) await save(200);
    await save(1400); // 等 React 水合，否则按钮上没有事件监听
    const res = await send('Runtime.evaluate', {
      expression: step.probe,
      awaitPromise: true,
      returnByValue: true,
    });
    let value = null;
    if (res.exceptionDetails) {
      value = { error: res.exceptionDetails.text };
    } else {
      try {
        value = JSON.parse(res.result.value);
      } catch {
        value = { raw: res.result.value };
      }
    }
    report.steps.push({
      path: step.path,
      note: step.note,
      value,
      audioRequests: audioResponses.slice(audioFrom),
    });
  }

  ws.close();
  report.audioResponses = audioResponses;
  chrome.kill();
  await save(400);
  await rmrf(PROFILE);

  /* ---------- 判定 ---------- */
  const [cycle, stopMid, mutex] = report.steps;
  const F = report.fails;
  const v = (s) => (s && s.value) || {};

  /* ① 一次点击走完三遍 */
  const cy = v(cycle);
  if (cy.error) F.push('单句页探针异常: ' + cy.error);
  if (!cy.found) F.push('单句页找不到 Listen 按钮');
  if (!/×3/.test(cy.idleText || '')) {
    F.push(`Listen 按钮上应标出连播次数（×3），实际 ${JSON.stringify(cy.idleText)}`);
  }
  if (cy.pressedBefore !== 'false') F.push('初始 aria-pressed 应为 false，实际 ' + cy.pressedBefore);
  const cySeq = cy.seq || [];
  // 播放中可见文字必须是 Stop —— 连播时用户随时可能想中止，「再点一下就停」得一眼看懂
  if (!cySeq.some((t) => /Stop/.test(t))) {
    F.push('播放中按钮应显示 Stop，按钮文本轨迹 ' + JSON.stringify(cySeq));
  }
  for (const n of [1, 2, 3]) {
    if (!cySeq.some((t) => t.includes(n + '/3'))) {
      F.push(`连播没走到第 ${n} 遍 —— 按钮文本轨迹 ${JSON.stringify(cySeq)}`);
    }
  }
  if (cy.pressedAfter !== 'false') {
    F.push('三遍走完应自动收尾（aria-pressed=false），实际 ' + cy.pressedAfter);
  }
  if (!/×3/.test(cy.idleTextAfter || '')) {
    F.push(`收尾后按钮应回到 Listen ×3，实际 ${JSON.stringify(cy.idleTextAfter)}`);
  }
  if (/×/.test(cy.slowText || '')) {
    F.push(`Slow 不该连播（一遍慢速已 1.5s），实际 ${JSON.stringify(cy.slowText)}`);
  }
  const cyAudio = (cycle.audioRequests || []).filter((r) => /\.mp3(\?|$)/.test(r.url));
  if (!cyAudio.length) F.push('单句页点 Listen 没发出任何 mp3 请求 —— 喇叭是静默的');
  if (cyAudio.some((r) => r.status >= 400)) {
    F.push('单句页音频有失败状态码：' + JSON.stringify(cyAudio.filter((r) => r.status >= 400)));
  }
  if (cy.overflowPx > 0) F.push('单句页横向溢出 ' + cy.overflowPx + 'px');

  /* ② 途中再点一下立刻停 */
  const sm = v(stopMid);
  if (sm.error) F.push('中途停止探针异常: ' + sm.error);
  if (!sm.found) F.push('中途停止探针没找到 Listen 按钮');
  if (!/\d\/3/.test(sm.midText || '')) {
    F.push(`点后 1.5s 应还在连播中（按钮显示 n/3），实际 ${JSON.stringify(sm.midText)}`);
  }
  if (sm.midPressed !== 'true') F.push('连播中 aria-pressed 应为 true，实际 ' + sm.midPressed);
  if (sm.stoppedPressed !== 'false') {
    F.push('途中再点一下应立即停止（aria-pressed=false），实际 ' + sm.stoppedPressed);
  }
  if (!/×3/.test(sm.stoppedText || '')) {
    F.push(`停止后按钮应回到 Listen ×3，实际 ${JSON.stringify(sm.stoppedText)}`);
  }
  if ((sm.afterStopSeq || []).length) {
    F.push('停止之后按钮又自己动了（没停干净）：' + JSON.stringify(sm.afterStopSeq));
  }
  if (sm.finalPressed !== 'false') F.push('静默窗口结束后 aria-pressed 仍应为 false，实际 ' + sm.finalPressed);

  /* ③ 两张卡互斥 */
  const mx = v(mutex);
  if (mx.error) F.push('学习页探针异常: ' + mx.error);
  if (!mx.found) F.push(`学习页 Listen 按钮不足 2 个（实际 ${mx.cardCount}）—— 卡片没渲染出来`);
  if (!/×3/.test(mx.firstText || '')) {
    F.push(`学习页 Listen 也应标 ×3，实际 ${JSON.stringify(mx.firstText)}`);
  }
  if (mx.aDuring !== 'true') F.push('A 卡点 Listen 后应进入连播，实际 ' + mx.aDuring);
  if (mx.aAfter !== 'false') F.push('B 卡开播后 A 卡必须立刻让位（aria-pressed=false），实际 ' + mx.aAfter);
  if (mx.bAfter !== 'true') F.push('B 卡点后应进入连播，实际 ' + mx.bAfter);
  if ((mx.aTail || []).length) {
    F.push('A 卡被顶掉之后又接着播了（互斥没收干净）：' + JSON.stringify(mx.aTail));
  }
  if (mx.aFinal !== 'false') F.push('A 卡最终状态应为 false，实际 ' + mx.aFinal);
  if (mx.overflowPx > 0) F.push('学习页横向溢出 ' + mx.overflowPx + 'px');

  if (report.consoleErrors.length) F.push('控制台报错 ' + report.consoleErrors.length + ' 条');

  report.verdict = F.length ? 'FAIL' : 'PASS';
  report.analytics = ga.stats();
  return report;
}

run()
  .then((report) => {
    fs.writeFileSync(OUT, JSON.stringify(report, null, 2), 'utf8');
    process.exit(report.verdict === 'PASS' ? 0 : 1);
  })
  .catch((err) => {
    fs.writeFileSync(OUT, JSON.stringify({ error: String((err && err.stack) || err) }, null, 2), 'utf8');
    process.exit(2);
  });
