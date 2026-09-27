/**
 * cf-domain-check.js —— 确认「自有域名现在指向的是哪个部署」
 *
 * 为什么需要它：CF Pages 的**自定义域名挂在「项目」上，不是挂在某次部署上**。
 * 项目有且只有一个 production 环境，每次生产部署会自动成为 `canonical_deployment`，
 * 而 chinesequick.com / www.chinesequick.com 这两个自定义域名 + 项目子域
 * chinesequick.pages.dev **都跟着 canonical 走** —— 所以「发布完域名要不要再手动关联」
 * 的答案是「不用」，这个工具就是把这句话变成可执行断言。
 *
 * 三条判据：
 *   ① canonical_deployment.id === 最新一次 production 部署的 id
 *   ② canonical 的 aliases 里带着自有域名
 *   ③ 自有域名与项目子域返回**同一份页面**（指纹比对，见下面的容差说明）
 *
 * ⚠️ 判据 ③ 必须做两处容差，否则**必然误报**（2026-09-27 连踩两次，别重开）：
 *   a. **剔掉 CF 注入的统计脚本**：自有域名在 CF 上是橙云代理的 zone，zone 开了
 *      Web Analytics 自动注入 → apex 的 HTML 尾部多出
 *      `<script type="module" src="https://static.cloudflareinsights.com/beacon.min.js/...">`
 *      （实测 366 字节），而 `*.pages.dev` 不经代理、没有这段。
 *   b. **再折叠空白**：CF 注入时**还夹带了一个换行符**，于是归一化后仍会「差 1 字节」。
 *      只比原始字节 → 三个路径全判不一致（第一版），剔脚本后仍报不一致（第二版），
 *      两次都是探针自己造出来的假失败。
 *   做完 a+b 后 apex 与 `9041f2f6.chinesequick.pages.dev` **完全同指纹**。
 *   仍不等时会把差异片段打出来 —— 那时才是真的没跟上（或 zone 又开了 Auto Minify 之类）。
 *
 * 用法：node _dev/cf-domain-check.js            # 全量（含线上探测）
 *       node _dev/cf-domain-check.js --config   # 只查配置，不联网探测
 * 退出码：0 = 全绿；1 = 有断言失败（此时**不要**以为域名已经跟上）
 *
 * 地址分工（别混用）：
 *   https://chinesequick.com/            ← 对外唯一正式地址，跟着 canonical 走
 *   https://chinesequick.pages.dev/      ← 项目子域，同样跟 canonical 走
 *   https://<sha>.chinesequick.pages.dev ← **该次部署的永久快照**，不跟随生产，
 *                                          用途只有一个：`deploy-cf.js --rollback=<sha>`
 */
const fs = require("fs");
const https = require("https");
const crypto = require("crypto");

const APEX = "https://chinesequick.com";
const WWW = "https://www.chinesequick.com";
// 三条真实内容页 + 一条跳转页（跳转页只存在于最新构建，用它反证「跟在最新构建上」）
const PROBE_PATHS = [
  "/",
  "/how-to-say-thank-you-in-chinese/",
  "/chinese-everyday-phrases/",
  "/how-to-say-very-good-in-chinese/",
];
const INJECT_HOST = "static.cloudflareinsights.com";

function env() {
  const o = {};
  for (const l of fs.readFileSync(".env.local", "utf8").split(/\r?\n/)) {
    const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
    if (m) o[m[1]] = m[2].replace(/^["']|["']$/g, "").trim();
  }
  return o;
}

/**
 * 容差 a：剔掉 CF 注入的 beacon 脚本。
 * 容差 b：折叠**标签之间**的空白（`>\s+<` → `><`）—— 只动标签边界，不动文本节点内部的空白。
 *         必须用这个写法，**不能把连续空白折叠成单个空格**：CF 注入时在
 *         `</script>` 与 `</body>` 之间夹了一个 `\n`，叠成空格会得到 `</script> </body>`，
 *         与不注入侧的 `</script></body>` 仍然不等（第二版就栽在这，连报三个假失败）。
 * 剩下的差异才是真内容差异。
 */
function fingerprint(html) {
  let out = html;
  let injected = 0;
  for (;;) {
    const i = out.indexOf(INJECT_HOST);
    if (i < 0) break;
    const start = out.lastIndexOf("<script", i);
    const end = out.indexOf("</script>", i);
    if (start < 0 || end < 0) break;
    out = out.slice(0, start) + out.slice(end + "</script>".length);
    injected++;
  }
  return { fp: out.replace(/>\s+</g, "><").trim(), injected };
}

const sha = (s) => crypto.createHash("sha256").update(s).digest("hex").slice(0, 12);

function api(path, token) {
  return new Promise((res, rej) => {
    const req = https.request(
      { host: "api.cloudflare.com", path: "/client/v4" + path, method: "GET", headers: { Authorization: "Bearer " + token } },
      (r) => {
        let s = "";
        r.on("data", (d) => (s += d));
        r.on("end", () => {
          try {
            res({ status: r.statusCode, body: JSON.parse(s) });
          } catch (e) {
            res({ status: r.statusCode, body: { raw: s.slice(0, 300) } });
          }
        });
      }
    );
    req.on("error", rej);
    req.end();
  });
}

function get(url) {
  return new Promise((res, rej) => {
    const u = new URL(url);
    const req = https.request(
      {
        host: u.hostname,
        path: u.pathname + u.search,
        method: "GET",
        headers: { "user-agent": "cq-domain-check", "accept-encoding": "identity" },
      },
      (r) => {
        let s = "";
        r.setEncoding("utf8");
        r.on("data", (d) => (s += d));
        r.on("end", () => {
          const { fp, injected } = fingerprint(s);
          res({ status: r.statusCode, rawLen: Buffer.byteLength(s), fpLen: Buffer.byteLength(fp), hash: sha(fp), injected });
        });
      }
    );
    req.on("error", rej);
    req.end();
  });
}

function head(url) {
  return new Promise((res, rej) => {
    const u = new URL(url);
    const req = https.request(
      { host: u.hostname, path: u.pathname, method: "GET", headers: { "user-agent": "cq-domain-check" } },
      (r) => {
        r.on("data", () => {});
        r.on("end", () => res({ status: r.statusCode, loc: r.headers.location || "" }));
      }
    );
    req.on("error", rej);
    req.end();
  });
}

(async () => {
  const cfgOnly = process.argv.includes("--config");
  const E = env();
  const name = E.CF_PAGES_PROJECT || "chinesequick";
  const problems = [];
  const notes = [];
  const L = [];

  const pr = await api(`/accounts/${E.CF_ACCOUNT_ID}/pages/projects/${name}`, E.CF_API_TOKEN);
  const p = pr.body.result;
  if (!p) {
    console.log("FAIL: 读不到项目 " + name + " → " + JSON.stringify(pr.body).slice(0, 300));
    process.exit(1);
  }

  const domains = (p.domains || []).map((d) => (typeof d === "string" ? d : d && d.name)).filter(Boolean);
  const canon = (p.canonical_deployment && p.canonical_deployment.id) || "";
  const latest = (p.latest_deployment && p.latest_deployment.id) || "";
  const latestEnv = p.latest_deployment && p.latest_deployment.environment;
  const sub = p.subdomain || name + ".pages.dev";

  L.push("项目        : " + name + "   subdomain=" + sub);
  L.push("项目域名    : " + JSON.stringify(domains));
  L.push("生产分支    : " + p.production_branch);
  L.push("canonical   : " + canon.slice(0, 8) + "  （自有域名现在服务的就是它）");
  L.push("latest      : " + latest.slice(0, 8) + "  env=" + latestEnv);

  for (const d of ["chinesequick.com", "www.chinesequick.com"]) {
    if (!domains.includes(d)) problems.push(`项目域名里没有 ${d}`);
  }
  if (latestEnv !== "production") problems.push(`最新部署的 environment=${latestEnv}，不是 production`);
  if (canon !== latest) {
    problems.push(`canonical(${canon.slice(0, 8)}) ≠ 最新生产部署(${latest.slice(0, 8)}) → 自有域名可能还停在上一个版本`);
  }

  const deps = await api(`/accounts/${E.CF_ACCOUNT_ID}/pages/projects/${name}/deployments?per_page=5`, E.CF_API_TOKEN);
  L.push("");
  L.push("最近部署：");
  let canonAliases = [];
  for (const d of (deps.body.result || []).slice(0, 5)) {
    const aliases = d.aliases || [];
    if (d.id === canon) canonAliases = aliases;
    L.push(
      `  ${d.id.slice(0, 8)}  ${d.environment.padEnd(10)} ${d.created_on}  ${aliases.length ? aliases.join(" ") : "（无别名）"}`
    );
  }
  if (!canonAliases.some((a) => a.includes("chinesequick.com"))) {
    problems.push("canonical 部署的 aliases 里没有 chinesequick.com");
  }

  if (!cfgOnly) {
    L.push("");
    L.push("线上指纹比对（自有域名 vs " + sub + "）：");
    let apexInjected = 0;
    let subInjected = 0;
    for (const path of PROBE_PATHS) {
      let a, b;
      try {
        a = await get(APEX + path);
        b = await get("https://" + sub + path);
      } catch (e) {
        problems.push(path + " 请求失败 " + e.message);
        L.push("  " + path.padEnd(34) + " 请求失败 " + e.message);
        continue;
      }
      if (a.injected) apexInjected++;
      if (b.injected) subInjected++;
      const same = a.hash === b.hash && a.status === b.status;
      L.push(
        `  ${path.padEnd(34)} apex ${String(a.status).padEnd(3)}/${a.hash}  ${same ? "" : ""}` +
          `子域 ${String(b.status).padEnd(3)}/${b.hash}  ${same ? "一致 ✓" : "★不一致"}`
      );
      if (!same) problems.push(`自有域名与项目子域指纹不同：${path}（apex ${a.hash} vs ${b.hash}）`);
      if (a.status >= 400) notes.push(`${path} 在线上是 ${a.status} —— 探针路径本身可能已失效，换一条`);
    }

    if (apexInjected && !subInjected) {
      notes.push(
        "apex 侧有 CF Web Analytics 自动注入（自有域名是橙云代理、pages.dev 不是）—— 正常，已计入指纹容差，与 GA4 互不影响"
      );
    }
    if (apexInjected && subInjected) {
      notes.push("两侧都被注入了统计脚本 —— zone 的注入规则可能扩到了全站，值得瞄一眼");
    }

    try {
      const w = await head(WWW + "/");
      const ok = w.status === 301 && w.loc.replace(/\/$/, "") === APEX;
      L.push("");
      L.push("www 行为    : " + w.status + " → " + (w.loc || "-") + (ok ? "  ✓（归一到 apex，不产生重复内容）" : "  ★异常"));
      if (!ok) problems.push(`www 没 301 到 apex：${w.status} → ${w.loc}`);
    } catch (e) {
      problems.push("www 探测失败 " + e.message);
    }
  }

  console.log(L.join("\n"));
  if (notes.length) {
    console.log("");
    for (const n of notes) console.log("注：" + n);
  }
  console.log("");
  if (problems.length) {
    console.log("VERDICT: FAIL —— 自有域名可能没跟上当前生产部署");
    for (const x of problems) console.log("  - " + x);
    process.exitCode = 1;
  } else {
    console.log("VERDICT: PASS —— chinesequick.com 正在服务 canonical 部署 " + canon.slice(0, 8) + "，无需任何额外操作");
  }
})();
