/**
 * lint-live-scripts.js — 守住「核验脚本不许往 GA 里灌假数据」这条线。
 *
 *   node _dev/lint-live-scripts.js
 *
 * 背景：`_dev` 里有一类脚本会**启动真机 Chrome 打开线上域名**。GA 的
 * `gtag('config')` 会自动发一次 page_view，而我们每轮验证都建**临时 profile**，
 * 于是每次导航都是一个新的 client_id = 一个新的「活跃用户」。
 *   check-errors-live  12 页 × 2 次 ≈ 24
 *   verify-saved       12 步         ≈ 12
 *   verify-audio-live  逐页点音频    ≈ 10
 *   verify-repeat      4 次导航      ≈ 6
 *   repro-client-error 6 组 × 2      ≈ 12
 * 而 28 天真实总量只有 152 次 —— 我们自己能占掉四分之一以上。
 * → 任何「有多少真实用户」的判断都会被这套自产流量污染。
 *
 * 拦截器是 `_dev/no-analytics.js`（CDP `Network.setBlockedURLs`）。它靠**人手记得 require**
 * —— 这正是会腐烂的地方：新写一个真机脚本时最容易漏的就是它，而漏了不会有任何症状
 * （验证照样 PASS），只会在几周后让 GA 报表变得不可信。
 *
 * 所以这里做**静态检查**，三件事：
 *   1. 凡启动 Chrome 调试端口的脚本，必须 `require('./no-analytics')`
 *   2. 还必须真的调用 `.block(...)`（只 require 不 block 等于没接）
 *   3. 必须把 `ga.stats()` 写进结果文件（否则「拦没拦上」事后无从复查）
 * 例外白名单只有 `check-ga*.js` —— 它们的职责就是检查 GA 有没有注入，拦了就没法干活。
 *
 * 退出码：0 = 全部合规 / 1 = 有脚本漏接 / 2 = 自身出错。
 */
const fs = require("fs");
const path = require("path");

const ROOT = process.cwd();
const DEV = path.join(ROOT, "_dev");
const OUT = path.join(DEV, "lint-live-scripts.txt");

/** 职责就是检查 GA 的脚本，拦了反而没法工作。 */
const ALLOWLIST = [/^check-ga(-live)?\.js$/];

/** 判定「会启动真机浏览器」的特征。 */
const LAUNCHES_CHROME = [/--remote-debugging-port/, /webSocketDebuggerUrl/];

/** 检查器自身不启动 Chrome，但源码里含检测用的字面量，必须排除，否则会自我判定。 */
const SELF = "lint-live-scripts.js";

/**
 * 剥掉注释再匹配。
 * 不剥的话，一个**只在注释里写了** `require('./no-analytics')` 的脚本会通过检查 ——
 * 与「清单里写了对不上实体的路径就静默腐烂」是同一类病：**看的是文字，不是行为。**
 */
function stripComments(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, " ") // 块注释
    .replace(/(^|[^:'"\\])\/\/[^\n]*/g, "$1 "); // 行注释（避开 http:// 这类）
}

function listScripts() {
  // 只看 _dev 顶层：_err-profile 之类是 Chrome 临时 profile，里面几万个文件。
  // 排除自身：源码里的检测模式字面量会被自己匹配到。
  return fs
    .readdirSync(DEV, { withFileTypes: true })
    .filter((d) => d.isFile() && d.name.endsWith(".js") && d.name !== SELF)
    .map((d) => d.name)
    .sort();
}

function main() {
  const scripts = listScripts();
  const problems = [];
  const checked = [];

  for (const name of scripts) {
    const code = stripComments(fs.readFileSync(path.join(DEV, name), "utf8"));

    const launches = LAUNCHES_CHROME.some((re) => re.test(code));
    if (!launches) continue; // 纯 HTTP / 纯解析脚本，不执行 JS，天然不污染

    if (ALLOWLIST.some((re) => re.test(name))) {
      checked.push({ name, status: "allowlisted" });
      continue;
    }

    const required = /require\(\s*['"]\.\/no-analytics['"]\s*\)/.test(code);
    const blocks = /\.block\s*\(/.test(code);
    const reports = /\.stats\s*\(/.test(code);

    if (!required) {
      problems.push(`${name} — 启动了 Chrome 但没 require('./no-analytics') → GA 会照记一次 page_view/页面`);
      continue;
    }
    if (!blocks) {
      problems.push(`${name} — require 了 no-analytics 但从没调用 .block() → 拦截根本没生效`);
      continue;
    }
    if (!reports) {
      problems.push(`${name} — 没有把 ga.stats() 写进结果 → 事后无法证明「这一轮真的拦住了」`);
      continue;
    }
    checked.push({ name, status: "ok" });
  }

  const lines = [];
  lines.push("== 真机脚本 GA 拦截体检 ==");
  lines.push(`扫描 ${scripts.length} 个脚本，其中 ${checked.length + problems.length} 个会启动真机 Chrome`);
  lines.push("");
  for (const c of checked) {
    lines.push(`${c.status === "ok" ? "✓" : "·"} ${c.name}${c.status === "allowlisted" ? "（白名单：职责就是查 GA）" : ""}`);
  }
  lines.push("");
  if (problems.length) {
    lines.push(`✗ FAIL — ${problems.length} 个脚本会污染 GA：`);
    for (const p of problems) lines.push("  - " + p);
    lines.push("");
    lines.push("修法：require('./no-analytics') → Network.enable 之后、Page.navigate 之前调用 .block(send)，");
    lines.push("      并把 .stats() 的结果写进报告；同时在 CDP 消息处理器最前面 `if (ga.observe(msg)) return;`");
    lines.push("      （被拦请求会以 net::ERR_BLOCKED_BY_CLIENT 出现，忽略掉，别当线上异常）");
  } else {
    lines.push("✓ PASS — 所有真机脚本都会拦断统计域名");
  }

  const ok = problems.length === 0;
  lines.push("");
  lines.push(`VERDICT: ${ok ? "PASS" : "FAIL"}`);

  fs.writeFileSync(OUT, lines.join("\n") + "\n", "utf8");
  process.stdout.write(lines.join("\n") + "\n");
  process.exit(ok ? 0 : 1);
}

try {
  main();
} catch (e) {
  fs.writeFileSync(OUT, "lint 自身出错: " + String(e) + "\n", "utf8");
  process.stderr.write(String(e && e.stack ? e.stack : e) + "\n");
  process.exit(2);
}
