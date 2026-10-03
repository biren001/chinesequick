'use strict';
// 打印体检：对每个「应该能打」的页面，看屏幕态正常，切到 print 媒介后
//   ① 所有按钮/导航/悬浮控件消失  ② 内容本体还在  ③ 纸上来源行（如果有）出现。
// 用法：node _dev/verify-print.js [baseURL] [路径,路径,...]
//   默认 http://127.0.0.1:4173 /saved/,/address-card/,/emergency-card/
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const http = require('http');

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const CDP_PORT = 9467;
const PROFILE = path.join(__dirname, '_print-profile');
const BASE = (process.argv[2] || 'http://127.0.0.1:4173').replace(/\/$/, '');
const PATHS = (process.argv[3] || '/saved/,/address-card/,/emergency-card/').split(',').map((s) => s.trim());

try { fs.rmSync(PROFILE, { recursive: true, force: true }); } catch {}
const chrome = spawn(CHROME, [
  '--headless=new', `--remote-debugging-port=${CDP_PORT}`, `--user-data-dir=${PROFILE}`,
  '--no-first-run', '--no-default-browser-check', '--window-size=390,844', 'about:blank',
], { stdio: 'ignore' });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const httpGet = (url) => new Promise((resolve, reject) => {
  http.get(url, (res) => { const b = []; res.on('data', (c) => b.push(c)); res.on('end', () => resolve(Buffer.concat(b).toString('utf8'))); }).on('error', reject);
});

const results = [];
const check = (name, ok, detail) => { results.push({ name, ok, detail }); console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail ? '  — ' + detail : '')); };

(async () => {
  let ready = false;
  for (let i = 0; i < 40 && !ready; i++) {
    try { await httpGet(`http://127.0.0.1:${CDP_PORT}/json/version`); ready = true; } catch { await sleep(700); }
  }
  if (!ready) { console.log('Chrome 未起来'); process.exit(2); }

  const list = JSON.parse(await httpGet(`http://127.0.0.1:${CDP_PORT}/json/list`));
  const page = list.find((t) => t.type === 'page');
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  let id = 0; const pending = new Map(); const events = [];
  const send = (method, params) => new Promise((resolve) => {
    const mid = ++id; pending.set(mid, resolve);
    ws.send(JSON.stringify({ id: mid, method, params: params || {} }));
  });
  ws.onmessage = (ev) => {
    const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) { pending.get(m.id)(m.result); pending.delete(m.id); return; }
    if (m.method === 'Runtime.exceptionThrown') {
      const d = m.params.exceptionDetails;
      events.push('EXCEPTION: ' + (d.exception?.description || d.text).slice(0, 300));
    }
    if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') {
      events.push('CONSOLE.error: ' + (m.params.args || []).map((a) => a.value ?? a.description ?? '').join(' ').slice(0, 200));
    }
  };
  await new Promise((r) => { ws.onopen = r; });
  await send('Runtime.enable');
  await send('Page.enable');
  const ev = (expr) => send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true }).then((r) => r.result?.value);

  // 落地一次才能写 localStorage（/saved/ 需要）
  await send('Page.navigate', { url: BASE + '/' });
  await sleep(3500);
  await ev(`localStorage.setItem('rlc-saved-v1', JSON.stringify({version:1, ids:[1,73]}))`);

  const probe = `(() => {
    const vis = el => !!el && !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length);
    const btns = [...document.querySelectorAll('button')];
    const p = [...document.querySelectorAll('p')].find(p => /Printed from ChineseQuick/i.test(p.textContent||''));
    return JSON.stringify({
      visibleButtons: btns.filter(vis).length,
      visibleButtonInfo: btns.filter(vis).map(b => (b.textContent||'').trim().slice(0,30)),
      navVisible: [...document.querySelectorAll('nav')].some(vis),
      fixedVisible: [...document.querySelectorAll('*')].filter(el => vis(el) && getComputedStyle(el).position === 'fixed').length,
      bodyLen: document.body.innerText.length,
      footerVisible: vis(p),
      hasFooterLine: !!p,
    });
  })()`;

  for (const p of PATHS) {
    console.log('\n===== ' + p + ' =====');
    events.length = 0;
    await send('Emulation.setEmulatedMedia', { media: 'screen' });
    await send('Page.navigate', { url: BASE + p });
    await sleep(3800);
    const screenState = JSON.parse(await ev(probe));
    check(p + ' 屏幕态有正文', screenState.bodyLen > 100, 'bodyLen=' + screenState.bodyLen);

    if (/^\/saved\//.test(p)) {
      const saved = JSON.parse(await ev(`(() => {
        const vis = el => !!el && !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length);
        const btns = [...document.querySelectorAll('button')];
        const pb = btns.find(b => /print/i.test(b.textContent || ''));
        return JSON.stringify({
          phrases: document.querySelectorAll('ol > li').length,
          hasPrintBtn: !!pb, printBtnVisible: vis(pb),
          liBreak: (() => { const li = document.querySelector('ol > li'); return li ? getComputedStyle(li).breakInside : null; })(),
        });
      })()`));
      check('/saved/ 渲染出 2 条收藏', saved.phrases === 2, 'li=' + saved.phrases);
      check('/saved/ Print 按钮可见', saved.hasPrintBtn && saved.printBtnVisible === true);
      check('/saved/ 词条 break-inside-avoid', saved.liBreak === 'avoid', 'breakInside=' + saved.liBreak);
      const clicked = JSON.parse(await ev(`(() => {
        let called = 0; const orig = window.print; window.print = () => { called++; };
        const b = [...document.querySelectorAll('button')].find(x => /print/i.test(x.textContent || ''));
        if (b) b.click(); window.print = orig; return JSON.stringify({ called });
      })()`));
      check('/saved/ 点击触发 window.print()', clicked.called === 1, 'called=' + clicked.called);
    }

    await send('Emulation.setEmulatedMedia', { media: 'print' });
    await sleep(1000);
    const printState = JSON.parse(await ev(probe));
    console.log(p + ' 打印态: ' + JSON.stringify(printState));
    check(p + ' 打印时无可见按钮', printState.visibleButtons === 0, JSON.stringify(printState.visibleButtonInfo));
    check(p + ' 打印时无可见导航', printState.navVisible === false);
    check(p + ' 打印时无悬浮控件', printState.fixedVisible === 0, 'fixed=' + printState.fixedVisible);
    check(p + ' 打印时正文保留', printState.bodyLen > 100, 'bodyLen=' + printState.bodyLen);
    if (printState.hasFooterLine) check(p + ' 打印时出现纸上来源行', printState.footerVisible === true);

    await send('Emulation.setEmulatedMedia', { media: 'screen' });
    await sleep(600);
  }

  if (events.length) { console.log('\n页面异常:'); events.forEach((e) => console.log('  ' + e)); check('无 console 异常 / 未捕获错误', false, events.length + ' 条'); }
  else check('无 console 异常 / 未捕获错误', true);

  const failed = results.filter((r) => !r.ok);
  const out = 'VERDICT: ' + (failed.length ? 'FAIL' : 'PASS') + `  (${results.length - failed.length}/${results.length})\n` +
    results.map((r) => `${r.ok ? 'PASS' : 'FAIL'}  ${r.name}${r.detail ? '  — ' + r.detail : ''}`).join('\n');
  fs.writeFileSync(path.join(__dirname, 'verify-print.txt'), out + '\n', 'utf8');
  console.log('\n' + out);

  try { chrome.kill(); } catch {}
  process.exit(failed.length ? 1 : 0);
})();
