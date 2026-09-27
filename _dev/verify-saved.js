'use strict';
/*
 * 真机验证「所有有状态的客户端功能」。目前四块：
 *   ① 收藏（♡ Save）：点收藏 → /saved/ 出现 → 刷新仍在 → 取消 → 消失
 *   ② 错题复习：做完测验 → 复习卡数量 = 错题数 → 进独立复习测验
 *   ③ 行前清单：勾选 → 进度文案 + 删除线 → 刷新仍在 → 取消勾选写回
 *   ④ 连续朗读：Play all → 自动推进 → 与单句播放互斥 → 停止后收摊
 *
 * 为什么必须用浏览器而不是 curl：这些都是纯客户端行为
 * （localStorage + useSyncExternalStore），静态 HTML 里永远看不到结果，
 * 只有真的点下去、真的刷新才知道有没有坏。
 *
 * 用法：
 *   node _dev/static-server.js &            # 本地跑在 127.0.0.1:4173
 *   node _dev/verify-saved.js               # 默认验本地
 *   node _dev/verify-saved.js https://chinesequick.com
 * 结果写 _dev/verify-saved.txt
 * 注意：会建临时 Chrome profile → 跑之前加 CODEBUDDY_SAFE_DELETE_ENABLED=0，否则 exit 2
 */
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const http = require('http');
const { createAnalyticsFilter } = require('./no-analytics');

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, '_dev', 'verify-saved.txt');
const BASE = require('./baseurl').normalizeBase(process.argv[2], 'http://127.0.0.1:4173');
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const PORT = 9600 + (process.pid % 180);
const PROFILE = path.join(ROOT, '_dev', '_saved-profile');
const CHROME_LOG = path.join(ROOT, '_dev', 'chrome-saved.log');

const DEVICE = { w: 390, h: 844 };
const save = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * 删临时 Chrome profile。
 * 上一次的 Chrome 刚被 taskkill 掉时，文件句柄还没释放，EBUSY 是常态
 * （实测报 `EBUSY: resource busy or locked, unlink ...\Default\Cache\...`）。
 * 所以这里必须重试，否则脚本会在真正开始验证之前就 exit 2。
 * 注意：外部仍要加 CODEBUDDY_SAFE_DELETE_ENABLED=0，否则删除守卫直接拦掉。
 */
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

// 学习页：点第一条短语的爱心，并回读它在 localStorage 里的落盘结果
const PROBE_LEARN = `(async () => {
  const out = { overflowPx: Math.max(0, document.documentElement.scrollWidth - window.innerWidth) };
  const btn = document.querySelector('button[aria-label="Save this phrase"]');
  out.found = !!btn;
  if (!btn) return JSON.stringify(out);
  const card = btn.closest('article');
  out.chinese = card ? (card.querySelector('p') || {}).textContent : null;
  out.before = btn.getAttribute('aria-pressed');
  btn.click();
  await new Promise(r => setTimeout(r, 150));
  out.after = btn.getAttribute('aria-pressed');
  out.labelAfter = btn.getAttribute('aria-label');
  out.storage = window.localStorage.getItem('rlc-saved-v1');
  // 同页第二个爱心不该被带着一起变（快照是共享的，但状态要按 id 区分）
  const others = Array.from(document.querySelectorAll('button[aria-label="Save this phrase"]'));
  out.otherUntouched = others.length;
  return JSON.stringify(out);
})()`;

// 收藏页：列出所有条目 + 空状态
const PROBE_LIST = `(async () => {
  const out = { overflowPx: Math.max(0, document.documentElement.scrollWidth - window.innerWidth) };
  const items = Array.from(document.querySelectorAll('ol > li'));
  out.count = items.length;
  out.chinese = items.map(li => {
    const ps = Array.from(li.querySelectorAll('p'));
    return ps.length > 1 ? ps[1].textContent : (ps[0] || {}).textContent;
  });
  out.hasEmptyState = document.body.innerText.includes('No saved phrases yet');
  out.storage = window.localStorage.getItem('rlc-saved-v1');
  out.heartFilled = document.querySelectorAll('button[aria-label="Remove from saved phrases"]').length;
  return JSON.stringify(out);
})()`;

// 收藏页：取消第一条
const PROBE_REMOVE = `(async () => {
  const out = {};
  out.before = document.querySelectorAll('ol > li').length;
  const btn = document.querySelector('button[aria-label="Remove from saved phrases"]');
  out.found = !!btn;
  if (!btn) return JSON.stringify(out);
  btn.click();
  await new Promise(r => setTimeout(r, 250));
  out.after = document.querySelectorAll('ol > li').length;
  out.hasEmptyState = document.body.innerText.includes('No saved phrases yet');
  out.storage = window.localStorage.getItem('rlc-saved-v1');
  return JSON.stringify(out);
})()`;

// 单句页（服务端渲染的页面里嵌的客户端组件）
const PROBE_PHRASE_PAGE = `(async () => {
  const out = {};
  const btn = document.querySelector('button[aria-label="Save this phrase"]');
  out.found = !!btn;
  if (!btn) return JSON.stringify(out);
  out.text = btn.textContent.trim();
  btn.click();
  await new Promise(r => setTimeout(r, 150));
  out.after = btn.getAttribute('aria-pressed');
  out.textAfter = btn.textContent.trim();
  out.storage = window.localStorage.getItem('rlc-saved-v1');
  return JSON.stringify(out);
})()`;

// 错题复习：把测验每题都点第一个选项，再看复习卡是否按错题数长出来
const PROBE_REVIEW = `(async () => {
  const out = {};
  const wait = (ms) => new Promise(r => setTimeout(r, ms));
  const btns = () => Array.from(document.querySelectorAll('button'));
  const options = () => btns().filter(b => b.className.includes('text-left') && !b.disabled);
  const advance = () => btns().find(b => /^(Next|See result)/.test(b.textContent.trim()) && !b.disabled);

  let answered = 0;
  for (let i = 0; i < 6; i++) {
    const opts = options();
    if (!opts.length) break;
    opts[0].click();
    await wait(120);
    const next = advance();
    if (next) next.click();
    answered++;
    await wait(180);
  }
  out.answered = answered;

  const body = document.body.innerText;
  const m = body.match(/(\\d+) to review/);
  out.wrongCount = m ? Number(m[1]) : 0;
  out.sawResult = /Perfect!|Nice!/.test(body);

  const heading = Array.from(document.querySelectorAll('h2'))
    .map(h => h.textContent.trim())
    .find(t => t.startsWith('Review ') && t.includes('you missed'));
  out.reviewHeading = heading || null;

  if (heading) {
    const n = Number((heading.match(/Review (\\d+)/) || [])[1]);
    out.headingCount = n;
    const section = Array.from(document.querySelectorAll('section'))
      .find(s => s.textContent.includes('you missed'));
    out.listedPhrases = section ? Array.from(section.querySelectorAll('li p:first-of-type')).map(p => p.textContent) : [];
    const practise = section && Array.from(section.querySelectorAll('button')).find(b => /^Practise these/.test(b.textContent.trim()));
    out.practiseLabel = practise ? practise.textContent.trim() : null;
    if (practise) {
      practise.click();
      await wait(250);
      out.reviewQuizShown = /Review quiz/.test(document.body.innerText);
      out.reviewQuizOptions = options().length;
      out.reviewQuizQuestion = (document.querySelector('h3') || {}).textContent || null;
      const back = btns().find(b => b.textContent.trim() === 'Back to the full list');
      out.hasBackButton = !!back;
    }
  }
  out.overflowPx = Math.max(0, document.documentElement.scrollWidth - window.innerWidth);
  return JSON.stringify(out);
})()`;

/* ---------- 行前清单 ---------- */

const PROBE_CHECKLIST_TOGGLE = `(async () => {
  const out = { overflowPx: Math.max(0, document.documentElement.scrollWidth - window.innerWidth) };
  const boxes = Array.from(document.querySelectorAll('input[type="checkbox"]'));
  const progress = () => (document.querySelector('[data-checklist-progress]') || {}).textContent || null;
  out.boxes = boxes.length;
  out.progressBefore = progress();
  out.checkedBefore = boxes.filter(b => b.checked).length;
  if (boxes.length < 3) return JSON.stringify(out);
  out.firstTitle = boxes[0].closest('li').querySelector('label').textContent.trim();
  boxes[0].click();
  boxes[1].click();
  await new Promise(r => setTimeout(r, 250));
  out.checkedAfter = boxes.filter(b => b.checked).length;
  out.progressAfter = progress();
  out.storage = window.localStorage.getItem('rlc-checklist-v1');
  return JSON.stringify(out);
})()`;

const PROBE_CHECKLIST_RELOAD = `(async () => {
  const out = {};
  const boxes = Array.from(document.querySelectorAll('input[type="checkbox"]'));
  const progress = () => (document.querySelector('[data-checklist-progress]') || {}).textContent || null;
  out.boxes = boxes.length;
  out.checked = boxes.filter(b => b.checked).length;
  out.progress = progress();
  out.lineThrough = document.querySelectorAll('label.line-through').length;
  out.storage = window.localStorage.getItem('rlc-checklist-v1');
  if (!boxes.length) return JSON.stringify(out);
  boxes[0].click();
  await new Promise(r => setTimeout(r, 250));
  out.checkedAfterUntick = boxes.filter(b => b.checked).length;
  out.progressAfterUntick = progress();
  out.storageAfterUntick = window.localStorage.getItem('rlc-checklist-v1');
  return JSON.stringify(out);
})()`;

/* ---------- 数字专页 ---------- */

// 数字卡片上的喇叭是纯图标按钮，aria-label 就是 "Play <汉字>"。
// aria-pressed 是可靠的播放判据（404 或解码失败时 AudioButton 会走 onUnplayable → release()，
// 状态会回到 false），但**采样必须够快**：它在点击处理里同步翻转，而单个数字只有 0.4–0.6s。
const PROBE_NUMBERS_AUDIO = `(async () => {
  const out = { overflowPx: Math.max(0, document.documentElement.scrollWidth - window.innerWidth) };
  const wait = (ms) => new Promise(r => setTimeout(r, ms));
  out.h1 = (document.querySelector('h1') || {}).textContent || null;
  // 每次都按 aria-label 重新取节点：React 重渲染可能换掉 DOM 节点，
  // 抓着旧的引用读状态会读到已经脱离文档的那个（值恒为初始值）。
  const byLabel = (l) => document.querySelector('button[aria-label="' + l + '"]');
  const all = Array.from(document.querySelectorAll('button[aria-label^="Play "]'));
  out.playButtons = all.length;
  if (!all.length) return JSON.stringify(out);
  out.firstLabel = all[0].getAttribute('aria-label');
  out.firstDisabled = all[0].disabled;

  all[0].click();
  // 采样必须又快又早。
  // setPlaying(true) 是在点击处理里**同步**发生的，而单个数字音频只有 0.4–0.6s：
  // 原先每 500ms 采一次、第一次采在 t=+500ms —— 稳定落在播放窗口之后，
  // 本地实测 6 次全 false（但它其实响了，音频请求是 200）。改成 80ms 一次、命中即退出：
  // 既不会错过 0.4s 的窗口，也仍然覆盖"慢网络下播放器起得晚"的情况。
  out.samples = [];
  for (let i = 0; i < 30; i++) {
    await wait(80);
    const b = byLabel(out.firstLabel);
    const v = b ? b.getAttribute('aria-pressed') : null;
    out.samples.push(v);
    if (v === 'true') break;
  }
  out.pressedAfter = out.samples[out.samples.length - 1];

  // 全站音频互斥：点第二个，第一个必须让位
  if (all.length > 1) {
    const secondLabel = all[1].getAttribute('aria-label');
    const b2 = byLabel(secondLabel);
    if (b2) {
      b2.click();
      await wait(900);
      const b1 = byLabel(out.firstLabel);
      const b2b = byLabel(secondLabel);
      out.firstAfterSecond = b1 ? b1.getAttribute('aria-pressed') : null;
      out.secondAfterSecond = b2b ? b2b.getAttribute('aria-pressed') : null;
    }
  }
  return JSON.stringify(out);
})()`;

/* ---------- 连续朗读 ---------- */

const PROBE_PLAY_ALL = `(async () => {
  const out = { overflowPx: Math.max(0, document.documentElement.scrollWidth - window.innerWidth) };
  const wait = (ms) => new Promise(r => setTimeout(r, ms));
  const btns = () => Array.from(document.querySelectorAll('button'));
  // 注意：这个按钮的 aria-label 会在「Play all N」与「Stop playback」之间切换，
  // 用「以 Play all 开头」定位会在开始播放之后立刻找不到按钮（踩过一次）。
  const playBtn = () => btns().find(b => /^(Play all|Stop playback)/.test(b.getAttribute('aria-label') || ''));
  const b = playBtn();
  out.found = !!b;
  if (!b) return JSON.stringify(out);
  out.label = b.getAttribute('aria-label');
  out.pressedBefore = b.getAttribute('aria-pressed');

  // 先点一句单句 Listen：连播开始时它必须被顶掉（全站音频互斥）
  const listen = btns().find(x => x.getAttribute('aria-label') === 'Listen');
  if (listen) { listen.click(); await wait(400); }
  out.singlePressedDuring = listen ? listen.getAttribute('aria-pressed') : null;

  playBtn().click();
  await wait(250);
  out.pressedAfterStart = playBtn().getAttribute('aria-pressed');
  // 单句按钮的状态按时间采样，而不是只读一次：线上音频要从网络取，
  // 暂停一个「play() 还没 resolve」的 <audio> 与暂停一个正在播的，时序不一样，
  // 只读一个 250ms 的快照会把「慢」误判成「没停」。
  out.singleSamples = [];
  for (let i = 0; i < 6; i++) {
    out.singleSamples.push(listen ? listen.getAttribute('aria-pressed') : null);
    await wait(300);
  }
  out.singleStoppedByPlayAll = out.singleSamples[out.singleSamples.length - 1];

  const readIndex = () => {
    const m = (playBtn().textContent || '').match(/(\\d+)\\s*\\/\\s*(\\d+)/);
    return m ? Number(m[1]) : -1;
  };
  const seen = [];
  for (let i = 0; i < 24; i++) {
    await wait(500);
    const n = readIndex();
    if (n > 0 && seen[seen.length - 1] !== n) seen.push(n);
    if (seen.length >= 3) break;
  }
  out.advanced = seen;
  out.nowPlaying = /Now playing/.test(document.body.innerText);
  out.currentLine = (document.body.innerText.match(/Now playing[^\\n]*\\n+([^\\n]*)/) || [])[1] || null;

  playBtn().click();
  await wait(300);
  out.pressedAfterStop = playBtn().getAttribute('aria-pressed');
  out.panelGoneAfterStop = !/Now playing/.test(document.body.innerText);
  out.labelAfterStop = playBtn().textContent.trim();
  return JSON.stringify(out);
})()`;

/* ---------- 场景流程页 ---------- */

// 场景页比其它页面更容易「悄悄变坏」：少渲染一段步骤、对方回应没 SSR 出来，
// 页面照样能打开、也不报错。所以在真机上同时查三件事：
//   ① 渲染出来的步骤块数 == 页面声明的步数（内容与自我描述一致）
//   ② 点 Listen 真的取到音频（页面上有几十个喇叭，最容易混进一条静默的）
//   ③ 点收藏真的写进 localStorage（复用不了别人的断言，这是新页面类型）
const PROBE_SCENARIO = `(async () => {
  const out = { overflowPx: Math.max(0, document.documentElement.scrollWidth - window.innerWidth) };
  const wait = (ms) => new Promise(r => setTimeout(r, ms));
  out.h1 = (document.querySelector('h1') || {}).textContent || null;
  const html = document.body.innerHTML;
  // 数「>文字<」形态而不是裸文字：RSC flight payload 里也有同样的字符串，
  // 裸匹配会正好数成两倍（在 seocheck 上踩过）。
  out.sayBlocks = (html.match(/>You say</g) || []).length;
  out.hearBlocks = (html.match(/>You may hear</g) || []).length;
  const stat = document.body.innerText.replace(/\\s+/g, ' ').match(/(\\d+) steps · (\\d+) phrases/);
  out.statedSteps = stat ? Number(stat[1]) : null;
  out.statedPhrases = stat ? Number(stat[2]) : null;
  // 「下一场景」卡片恰好一张（面包屑的 /scenarios/ 不匹配这个模式）
  out.nextScenario = Array.from(document.querySelectorAll('a')).filter((a) =>
    /^\\/scenarios\\/[a-z0-9-]+\\/$/.test(a.getAttribute('href') || '')
  ).length;

  // 收藏按钮的 aria-label 点完会从 Save this phrase 变成 Remove from saved，
  // 所以每次都用「两种状态都匹配」的选择器重新取节点（抓旧引用会读到脱离文档的那个）。
  const saveBtn = () => document.querySelector(
    'button[aria-label="Save this phrase"], button[aria-label="Remove from saved phrases"]'
  );

  const listen = document.querySelector('button[aria-label="Listen"]');
  out.foundListen = !!listen;
  if (listen) {
    listen.click();
    out.samples = [];
    for (let i = 0; i < 6; i++) { await wait(400); out.samples.push(listen.getAttribute('aria-pressed')); }
  }

  out.foundSave = !!saveBtn();
  if (out.foundSave) {
    saveBtn().click();
    await wait(250);
    out.savePressed = saveBtn() ? saveBtn().getAttribute('aria-pressed') : null;
    out.savedRaw = window.localStorage.getItem('rlc-saved-v1');
  }
  return JSON.stringify(out);
})()`;

const STEPS = [
  { path: '/learn/restaurant/', probe: PROBE_LEARN, note: '学习页点爱心' },
  { path: '/saved/', probe: PROBE_LIST, note: '收藏页应列出它' },
  { path: '/saved/', probe: PROBE_LIST, note: '刷新后仍在（持久化）' },
  { path: '/how-to-say-i-love-you-in-chinese/', probe: PROBE_PHRASE_PAGE, note: '单句页点爱心' },
  { path: '/saved/', probe: PROBE_LIST, note: '收藏页应有两条' },
  { path: '/saved/', probe: PROBE_REMOVE, note: '在收藏页取消一条' },
  { path: '/learn/restaurant/', probe: PROBE_REVIEW, note: '做完测验→错题复习卡' },
  { path: '/china-travel-checklist/', probe: PROBE_CHECKLIST_TOGGLE, note: '清单：勾选两项' },
  { path: '/china-travel-checklist/', probe: PROBE_CHECKLIST_RELOAD, note: '清单：刷新后仍在（持久化）' },
  { path: '/chinese-travel-phrases/', probe: PROBE_PLAY_ALL, note: '连播：自动推进 + 与单句互斥 + 停止', slow: true },
  { path: '/chinese-numbers/', probe: PROBE_NUMBERS_AUDIO, note: '数字页：点数字发音 + 互斥' },
  // 放在最后：这一步会往收藏里加一条，会污染前面 /saved/ 的计数断言
  { path: '/scenarios/ordering-food/', probe: PROBE_SCENARIO, note: '场景页：步骤渲染 + 发音 + 收藏', last: true },
];

async function run() {
  const report = {
    base: BASE,
    device: DEVICE,
    steps: [],
    consoleErrors: [],
    // 传输层噪音（net::ERR_*）单独记账：可见、但不判失败。见下面 Log.entryAdded 的说明。
    networkNoise: [],
    fails: [],
  };

  await rmrf(PROFILE);
  const log = fs.openSync(CHROME_LOG, 'w');
  const chrome = spawn(
    CHROME,
    [
      '--headless=new',
      '--disable-gpu',
      '--no-first-run',
      '--no-default-browser-check',
      // 连播验证需要它：脚本里的 .click() 是合成点击，Chrome 不把它算作
      // 用户手势 → 没有这个开关时 audio.play() 会被自动播放策略直接拒绝。
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
  // 音频请求的状态码。这是判断「发音按钮真的响了」唯一可靠的证据：
  // aria-pressed 只在播放期间为 true，而数字音频不到半秒就播完了 ——
  // 采样能不能撞上全看运气（踩过：零 0.41s，采样 6 次只撞到第一次）。
  const audioResponses = [];
  // 统计脚本一律拦掉并忽略 —— 详见 _dev/no-analytics.js。
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
      report.consoleErrors.push('console.error: ' + JSON.stringify(msg.params.args.map((a) => a.value || a.description)));
    }
    if (msg.method === 'Log.entryAdded' && msg.params.entry.level === 'error') {
      const text = msg.params.entry.text || '';
      /*
        浏览器会把**网络层**的失败也记成 level:error 的日志条目，最典型的就是
        `Failed to load resource: net::ERR_QUIC_PROTOCOL_ERROR.QUIC_NETWORK_IDLE_TIMEOUT`
        —— 那是本机到 CF 的 HTTP/3 连接空闲超时，跟页面代码毫无关系。
        2026-09-27 实测把它当成「控制台报错 1 条」→ 12 步功能全对却判 FAIL。
        **假失败的代价比漏报还大**（会让人学会忽略这份报告），必须在判定前分出去。

        判据要用「传输层错误 vs 服务器真的回了错误状态」来切：
        · net::ERR_*（含被拦的 ERR_BLOCKED_BY_CLIENT）→ 网络噪音，单独记账、不判失败
        · 「the server responded with a status of 404/500」→ **页面真的坏了**，照旧判失败
      */
      const transport = /net::ERR_/.test(text) && !/status of/.test(text);
      if (transport) report.networkNoise.push(text);
      else report.consoleErrors.push('log: ' + text);
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

  /**
   * 弱网模拟。
   *
   * 为什么必须有：真实网络下 `<audio>.play()` 会长时间挂在 pending 上，而
   * 「主动 pause() 一个尚未 resolve 的 play()」会让它以 AbortError 拒绝 ——
   * 这正是线上那个「连播开始后单句按钮卡在正在播放」的触发条件。
   * localhost 太快，play() 早已 resolve，这条路径在本地根本走不到（真实踩过）。
   * 需要走它的步骤加 `slow: true`。
   */
  const THROTTLE = { offline: false, latency: 300, downloadThroughput: 51200, uploadThroughput: 51200 };
  const NO_THROTTLE = { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1 };
  const setSlow = async (on) => {
    await send('Network.enable');
    // 重新 Network.enable 有可能把上一轮的拦截列表清掉，这里补一次，确保整轮都拦得住。
    await ga.block(send);
    await send('Network.emulateNetworkConditions', on ? THROTTLE : NO_THROTTLE);
  };

  for (const step of STEPS) {
    if (step.slow) await setSlow(true);
    loadFired = false;
    // 记下本步开始前的音频请求数：audioResponses 是全局累积的，
    // 不留切点就没法判断「这一步真的取到音频」，只能证明"整轮里有过"。
    const audioFrom = audioResponses.length;
    await send('Page.navigate', { url: BASE + step.path });
    for (let i = 0; i < 90 && !loadFired; i++) await save(200);
    await save(1400);
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
      slow: !!step.slow,
      value,
      audioRequests: audioResponses.slice(audioFrom),
    });
    if (step.slow) await setSlow(false);
  }

  ws.close();
  report.audioResponses = audioResponses;
  chrome.kill();
  await save(400);
  await rmrf(PROFILE);

  /* ---------- 判定 ---------- */
  const [
    learn,
    listAfterLearn,
    listAfterReload,
    phrasePage,
    listAfterPhrase,
    remove,
    review,
    checklistToggle,
    checklistReload,
    playAll,
    numbersAudio,
    scenario,
  ] = report.steps;
  const F = report.fails;
  const v = (s) => (s && s.value) || {};

  /* 场景流程页（Scenario Mode） */
  const sc = v(scenario);
  if (sc.error) F.push('场景页探针异常: ' + sc.error);
  if (!sc.h1) F.push('场景页没有 h1');
  // 9 = lib/scenarios.ts 里 ordering-food 的步骤数。写死是有意的：步数只在我们
  // 主动改内容时才会变，而「某一步没渲染出来」正是这个页面类型最容易悄悄发生的事故
  // （页面照常打开、不报错，只是少了一段）。
  if (sc.statedSteps !== 9) F.push(`ordering-food 场景页应声明 9 步，实际 ${sc.statedSteps}`);
  if (sc.sayBlocks !== sc.statedSteps) {
    F.push(`场景页渲染的步骤块(${sc.sayBlocks})与声明步数(${sc.statedSteps})不一致`);
  }
  if (!(sc.hearBlocks >= 9)) {
    F.push(`场景页「You may hear」只渲染了 ${sc.hearBlocks} 块（应 9 块）—— 对方回应没 SSR 出来`);
  }
  if (sc.nextScenario !== 1) F.push('场景页「下一场景」卡片数量异常：' + sc.nextScenario);
  if (!sc.foundListen) F.push('场景页找不到 Listen 按钮');
  if (!(sc.samples || []).includes('true')) {
    F.push('场景页点 Listen 后播放器从未进入播放状态：' + JSON.stringify(sc.samples));
  }
  const scAudio = (scenario.audioRequests || []).filter((r) => /\.mp3(\?|$)/.test(r.url));
  if (!scAudio.length) F.push('场景页点 Listen 没有发出任何 mp3 请求 —— 喇叭是静默的');
  if (scAudio.some((r) => r.status >= 400)) {
    F.push('场景页音频有失败状态码：' + JSON.stringify(scAudio.filter((r) => r.status >= 400)));
  }
  if (!sc.foundSave) F.push('场景页找不到收藏按钮');
  if (sc.savePressed !== 'true') F.push('场景页点收藏后 aria-pressed 应为 true，实际 ' + sc.savePressed);
  if (!sc.savedRaw || !sc.savedRaw.includes('"ids"')) F.push('场景页收藏没有写进 localStorage');
  if (sc.overflowPx > 0) F.push('场景页横向溢出 ' + sc.overflowPx + 'px');

  if (v(learn).error) F.push('学习页探针异常: ' + v(learn).error);
  if (!v(learn).found) F.push('学习页找不到爱心按钮');
  if (v(learn).before !== 'false') F.push('初始 aria-pressed 应为 false，实际 ' + v(learn).before);
  if (v(learn).after !== 'true') F.push('点后 aria-pressed 应为 true，实际 ' + v(learn).after);
  if (!v(learn).storage || !v(learn).storage.includes('"ids"')) F.push('localStorage 里没有 rlc-saved-v1');
  if (v(learn).overflowPx > 0) F.push('学习页横向溢出 ' + v(learn).overflowPx + 'px');

  const savedChinese = v(learn).chinese;
  if (v(listAfterLearn).count !== 1) F.push('/saved/ 应列出 1 条，实际 ' + v(listAfterLearn).count);
  if (!(v(listAfterLearn).chinese || []).includes(savedChinese)) {
    F.push(`/saved/ 里没有出现刚收藏的「${savedChinese}」，实际 ${JSON.stringify(v(listAfterLearn).chinese)}`);
  }
  if (v(listAfterLearn).heartFilled !== 1) F.push('/saved/ 的爱心应为实心(1)，实际 ' + v(listAfterLearn).heartFilled);

  if (v(listAfterReload).count !== 1) F.push('刷新后应仍有 1 条（持久化失败），实际 ' + v(listAfterReload).count);

  if (!v(phrasePage).found) F.push('单句页找不到爱心按钮');
  if (v(phrasePage).after !== 'true') F.push('单句页点后 aria-pressed 应为 true，实际 ' + v(phrasePage).after);
  if (v(phrasePage).text !== 'Save' || v(phrasePage).textAfter !== 'Saved') {
    F.push(`单句页文案应 Save -> Saved，实际 ${v(phrasePage).text} -> ${v(phrasePage).textAfter}`);
  }

  if (v(listAfterPhrase).count !== 2) F.push('/saved/ 应累计 2 条，实际 ' + v(listAfterPhrase).count);

  if (v(remove).before !== 2) F.push('取消前应有 2 条，实际 ' + v(remove).before);
  if (v(remove).after !== 1) F.push('取消后应剩 1 条，实际 ' + v(remove).after);

  /* 错题复习 */
  const rv = v(review);
  if (!rv.sawResult) F.push('测验没走到结果页（answered=' + rv.answered + '）');
  if (rv.answered !== 5) F.push('测验应有 5 题，实际答了 ' + rv.answered);
  if (rv.wrongCount > 0) {
    if (!rv.reviewHeading) F.push('答错 ' + rv.wrongCount + ' 题但没长出复习卡');
    if (rv.headingCount !== rv.wrongCount) {
      F.push(`复习卡数量与错题数不一致：卡上 ${rv.headingCount}，错题 ${rv.wrongCount}`);
    }
    if ((rv.listedPhrases || []).length !== rv.wrongCount) {
      F.push(`复习卡列出的短语数 ${(rv.listedPhrases || []).length} 与错题数 ${rv.wrongCount} 不一致`);
    }
    if (rv.practiseLabel !== `Practise these ${rv.wrongCount}`) {
      F.push('复习按钮文案不对：' + rv.practiseLabel);
    }
    if (!rv.reviewQuizShown) F.push('点了「练习这些」没进入复习测验');
    if (!(rv.reviewQuizOptions >= 2)) F.push('复习测验选项数异常：' + rv.reviewQuizOptions);
    if (!rv.hasBackButton) F.push('复习测验缺「返回完整列表」按钮');
  } else {
    // 全对是极小概率事件（(1/3)^5），出现就说明判定逻辑没在跑
    F.push('5 题全对，无法验证错题复习路径（请重跑）');
  }
  if (rv.overflowPx > 0) F.push('复习页横向溢出 ' + rv.overflowPx + 'px');

  /* 行前清单 */
  const ct = v(checklistToggle);
  if (ct.error) F.push('清单页探针异常: ' + ct.error);
  // 总数从页面自己读，不要写死 —— 清单条目会随内容扩张变化（16 → 17 → …），
  // 写死一次就要跟着改一次断言，改了还容易漏。这里只要求 ≥15 兜住「SSR 没渲染」。
  const totalFromPage = Number(((ct.progressBefore || '').match(/\/\s*(\d+)/) || [])[1]);
  if (!totalFromPage) F.push('清单页没显示总条数，progressBefore=' + JSON.stringify(ct.progressBefore));
  if (ct.boxes < 15) F.push('清单页复选框太少（SSR 没渲染出来？），实际 ' + ct.boxes);
  if (totalFromPage && ct.boxes !== totalFromPage) {
    F.push(`复选框数(${ct.boxes})与进度文案里的总数(${totalFromPage})不一致`);
  }
  if (ct.checkedBefore !== 0) F.push('清单初始不该有勾选，实际 ' + ct.checkedBefore);
  if (ct.checkedAfter !== 2) F.push('勾两项后应有 2 项选中，实际 ' + ct.checkedAfter);
  if (!new RegExp(`\\b2\\s*/\\s*${totalFromPage}\\b`).test(ct.progressAfter || '')) {
    F.push(`勾选后进度文案应变成 2 / ${totalFromPage}，实际 ` + JSON.stringify(ct.progressAfter));
  }
  if (!ct.storage || !ct.storage.includes('passport-validity')) {
    F.push('localStorage 里没有 rlc-checklist-v1 的勾选记录');
  }
  if (ct.overflowPx > 0) F.push('清单页横向溢出 ' + ct.overflowPx + 'px');

  const cr = v(checklistReload);
  if (cr.checked !== 2) F.push('刷新后应仍有 2 项勾选（持久化失败），实际 ' + cr.checked);
  if (!new RegExp(`\\b2\\s*/\\s*${totalFromPage}\\b`).test(cr.progress || '')) {
    F.push(`刷新后进度文案应是 2 / ${totalFromPage}，实际 ` + JSON.stringify(cr.progress));
  }
  if (cr.lineThrough !== 2) F.push('已勾选项的标题应加删除线（2 条），实际 ' + cr.lineThrough);
  if (cr.checkedAfterUntick !== 1) F.push('取消一项后应剩 1 项，实际 ' + cr.checkedAfterUntick);
  if ((cr.storageAfterUntick || '').includes('passport-validity')) {
    F.push('取消勾选没有写回 localStorage');
  }

  /* 连续朗读 */
  const pa = v(playAll);
  if (pa.error) F.push('连播探针异常: ' + pa.error);
  if (!pa.found) F.push('分类集合页找不到「Play all」按钮');
  if (pa.pressedBefore !== 'false') F.push('连播按钮初始 aria-pressed 应为 false，实际 ' + pa.pressedBefore);
  if (pa.pressedAfterStart !== 'true') F.push('点后 aria-pressed 应为 true，实际 ' + pa.pressedAfterStart);
  if (pa.singleStoppedByPlayAll !== 'false') {
    F.push('连播开始后单句播放应立即停止（互斥），实际 ' + pa.singleStoppedByPlayAll);
  }
  if (!(pa.advanced || []).length || pa.advanced[pa.advanced.length - 1] < 3) {
    F.push('连播没有自动推进到第 3 句，经过的序号 ' + JSON.stringify(pa.advanced));
  }
  if (!pa.nowPlaying) F.push('连播时没有「Now playing」面板');
  if (pa.pressedAfterStop !== 'false') F.push('停止后 aria-pressed 应为 false，实际 ' + pa.pressedAfterStop);
  if (!pa.panelGoneAfterStop) F.push('停止后「Now playing」面板应消失');
  if (pa.overflowPx > 0) F.push('连播页横向溢出 ' + pa.overflowPx + 'px');

  /* 数字专页 */
  const nz = v(numbersAudio);
  if (nz.error) F.push('数字页探针异常: ' + nz.error);
  // 24 = data/numbers.json 的条数。写死是有意的：这个数字只在我们主动加数字时才会变，
  // 而「少一条音频」正是最容易悄悄发生的事故（页面上只会多一个点不响的喇叭）。
  if (nz.playButtons !== 24) F.push(`数字页应有 24 个发音按钮，实际 ${nz.playButtons}`);
  if (nz.firstDisabled) F.push('数字页第一个发音按钮是 disabled —— src 没接上音频文件');
  // 「响没响」两条互不重叠的证据，命中任一即算通过：
  //   DOM 侧 —— 采样窗口内出现过 aria-pressed=true（证明点击驱动到了播放器）
  //   网络侧 —— 点它之后确实发出 /audio/numbers/**.mp3 且状态 2xx（证明文件真的取到了）
  // 为什么必须取「或」而不是「且」：单个数字只有 0.4–0.6s，DOM 采样再快也存在错过窗口，
  // 只认它会让这条断言退化成看运气（2026-09-27 实测过一次假 FAIL，而当时音频请求全是 200）。
  const numberRes = (report.audioResponses || []).filter((r) => /\/audio\/numbers\//.test(r.url));
  const numberAudioOk = numberRes.some((r) => r.status >= 200 && r.status < 300);
  const sawPlaying = (nz.samples || []).includes('true');
  if (!numberRes.length) F.push('数字页没有发出任何 /audio/numbers/ 请求 —— 发音按钮没真的点响');
  if (!sawPlaying && !numberAudioOk) {
    F.push(
      '点数字后播放器既没进入播放态、也没取到音频 —— 按钮没真的响：DOM ' +
        JSON.stringify(nz.samples) +
        ' / 网络 ' +
        JSON.stringify(numberRes)
    );
  }
  if (numberRes.some((r) => r.status >= 400)) {
    F.push('数字音频有失败状态码：' + JSON.stringify(numberRes.filter((r) => r.status >= 400)));
  }
  if (nz.overflowPx > 0) F.push('数字页横向溢出 ' + nz.overflowPx + 'px');

  if (report.consoleErrors.length) F.push('控制台报错 ' + report.consoleErrors.length + ' 条');

  report.verdict = F.length ? 'FAIL' : 'PASS';
  // 拦截没生效（responses > 0）说明这一轮真的往 GA 记账了 —— 打出来，别让它是隐形的。
  report.analytics = ga.stats();
  // 以前这个脚本写完全程一声不响，只靠退出码说话 —— 出问题时得回头翻 JSON 才知道坏在哪。
  console.log(
    `${report.verdict}: ${report.steps.length} 步 · 控制台报错 ${report.consoleErrors.length} · 网络噪音 ${report.networkNoise.length}（不判失败）· GA 拦截=${report.analyticsBlocked}`
  );
  for (const f of F) console.log('  ✗ ' + f);
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
