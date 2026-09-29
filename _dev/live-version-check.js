/**
 * live-version-check.js — 判断「线上那份」和「本地 out/ 那份」是不是同一版。
 *
 *   node _dev/live-version-check.js chinesequick.com
 *   node _dev/live-version-check.js https://chinesequick.com
 *   node _dev/live-version-check.js chinesequick.com --full        # 逐个 URL 比对（慢，但能定位到具体页）
 *   node _dev/live-version-check.js --sentinels                    # 只体检哨兵本身，不联网（1 秒）
 *
 * 为什么需要它：手动上传 zip 唯一会出事的环节不是上传本身，而是「传完之后没人能确认
 * 上线的是不是最新版」。曾发生过：本地已修好的文案没传上去，Google 一直拿旧版的
 * FAQ 正文当搜索摘要。所以这里不猜版本号，直接：
 *   1. 抽页面，剥掉 script/style/标签后对「可见文本」算 sha256 → 是不是同一版内容
 *      （不能比 HTML 字节：Next 每次构建会改动一批用户看不到的管线字节，见 visibleText 注释）
 *   2. 如果不同，用「哨兵特征」反查线上缺的是哪一批改动 → 落后在哪，而不是只说不一样
 *
 * 结果写入 _dev/live-version.txt。退出码：一致 0 / 不一致 1（`--sentinels` 模式：
 * 哨兵无问题 0 / 有死哨兵或全站通用串 1）。
 */
const fs = require("fs");
const path = require("path");
const https = require("https");
const http = require("http");
const tls = require("tls");
const crypto = require("crypto");

const ROOT = process.cwd();
const OUT = path.join(ROOT, "out");
const FULL = process.argv.includes("--full");
const SENTINEL_ONLY = process.argv.includes("--sentinels");

/* ---------------- HTTP：直连 + 重试（本机到 CF 会间歇 RST，fetch 也一样，见 deploy-cf.js 注释）---------------- */

function proxyUrl() {
  const raw = process.env.CF_PROXY || process.env.HTTPS_PROXY || process.env.https_proxy;
  if (!process.env.CF_PROXY && !process.argv.includes("--proxy")) return null;
  try {
    return new URL(raw);
  } catch {
    return null;
  }
}

class TunAgent extends https.Agent {
  constructor(p) {
    super({ keepAlive: false, maxSockets: 1 });
    this.p = p;
  }
  createConnection(options, callback) {
    const target = `${options.host}:${options.port || 443}`;
    const req = http.request({
      host: this.p.hostname,
      port: Number(this.p.port || 80),
      method: "CONNECT",
      path: target,
      headers: { Host: target },
    });
    req.setTimeout(20000, () => req.destroy(new Error("proxy CONNECT timeout")));
    req.on("connect", (res, socket) => {
      if (res.statusCode !== 200) {
        socket.destroy();
        return callback(new Error(`proxy CONNECT ${res.statusCode}`));
      }
      const t = tls.connect({ socket, servername: options.host, host: options.host, port: options.port || 443 });
      t.setTimeout(30000, () => t.destroy(new Error("tls timeout")));
      t.on("secureConnect", () => callback(null, t));
      t.on("error", (e) => callback(e));
    });
    req.on("error", (e) => callback(e));
    req.end();
  }
}

async function get(urlStr, tries = 4) {
  const u = new URL(urlStr);
  const proxy = proxyUrl();
  const modes = proxy ? (process.argv.includes("--proxy") ? ["tunnel"] : ["direct", "tunnel"]) : ["direct"];
  let lastErr = "";
  for (const mode of modes) {
    // 【为什么重试上限要能中途抬高】本地到 Cloudflare 的 TLS 握手偶发 ECONNRESET，
    // 实测全量 136 页里约 3%（4 页）会撞上，而固定的 0.7/1.4/2.1s 退避有时整个落进
    // 同一个抖动窗口 → 4 次全失败 → 该页被记成「取不到」。而 `ok` 要求 missing 为 0，
    // 于是**上传明明成功了也可能报 FAIL**（假失败比漏报更伤：会让人学会忽略报告）。
    // 连接级错误因此额外给更长的窗，且 cap 必须是可变变量（for 条件每轮重算）。
    let cap = tries;
    for (let i = 1; i <= cap; i++) {
      try {
        return await new Promise((resolve, reject) => {
          const agent = mode === "tunnel" ? new TunAgent(proxy) : new https.Agent({ keepAlive: false });
          const req = https.request(
            {
              host: u.hostname,
              port: u.port || 443,
              path: u.pathname + u.search,
              method: "GET",
              headers: { Accept: "*/*", "Accept-Encoding": "identity", "User-Agent": "version-check/1.0" },
              agent,
              timeout: 30000,
            },
            (res) => {
              if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                res.resume();
                return resolve({ status: res.statusCode, body: "", location: res.headers.location });
              }
              const chunks = [];
              res.on("data", (c) => chunks.push(c));
              res.on("end", () => resolve({ status: res.statusCode, body: Buffer.concat(chunks).toString("utf8") }));
            }
          );
          req.setTimeout(30000, () => req.destroy(new Error("timeout")));
          req.on("error", reject);
          req.end();
        });
      } catch (e) {
        lastErr = `${e.code || ""} ${e.message}`.trim();
        const connLevel = /ECONNRESET|ETIMEDOUT|ECONNREFUSED|EPIPE|socket hang up|timeout/i.test(lastErr);
        if (connLevel) cap = tries + 6;
        await sleep(Math.min(4000, (connLevel ? 900 : 700) * i));
      }
    }
  }
  return { status: 0, body: "", error: lastErr };
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const sha = (s) => crypto.createHash("sha256").update(s, "utf8").digest("hex").slice(0, 12);

/**
 * 取 <html data-build="…"> 里的版本号（lib/build.ts，格式 `YYYY.MM.DD·gitshortsha`）。
 * 这是「线上是不是这一份产物」最快的判据：一次请求、一句断言，比逐页比对快两个数量级。
 */
function buildAttr(html) {
  const m = /data-build="([^"]*)"/.exec(html || "");
  return m ? m[1] : "";
}

/**
 * 判断「同不同版」只能比【用户看得见的文本】，不能比整份 HTML 字节。
 *
 * 【为什么】Next 每次构建会在 HTML 里撒一堆构建相关字节，实测逐字节比对的结果是
 * 「任何两个不同构建的产物，全站 136 页全部不一致」：
 *   ① <!DOCTYPE html> 后面紧跟的构建 ID 注释  <!--159sIf67rFOzE8fmOGLqr-->
 *   ② RSC flight 载荷里的同一个 ID           "b":"159sIf67rFOzE8fmOGLqr"
 *   ③ React 序列化节点引用的等价写法差异       "$undefined","$undefined","$L19"  vs  "$L19"
 * 这些都是框架管线，用户一个字也看不到。照字节比，用户每次重建后都会看到 FAIL，
 * 然后学会忽略它 —— 那比没有检查更糟。
 *
 * 【做法】剥掉 script/style/注释/标签，只看剩下的文本。实测：
 *   同一份内容、不同次构建  → 文本 hash 相同
 *   少了一批文案            → 文本立刻变短、首处差异正好落在缺的那段
 */
function visibleText(html) {
  return html
    .replace(/<script\b[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[\s\S]*?<\/style>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&[a-zA-Z#0-9]+;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/* ---------------- 哨兵：本地有而线上没有 = 线上缺这一批改动 ---------------- */

/**
 * needle 必须在 visibleText() 的结果里成立 —— 写错就等于这条断言永远沉默。
 * 写/改 needle 前先用 _dev/sentinel-probe.js 打出真实上下文：
 *   node _dev/sentinel-probe.js 'china-travel-checklist\index.html' 'weeks before'
 * 已知四个坑：
 *   ① URL 不能当 needle：href="…/chinese-numbers/" 会被标签剥离。
 *   ② HTML 实体不能当 needle：&quot; / &#x201C; / &#x27; 会被空格替换（撇号在 HTML 里是 &#x27;，
 *      所以 needle 必须在撇号处截断）。
 *   ③ 短横线是字面 –（U+2013），不是 &#x2013; 实体。
 *   ④ **不能拿页脚/导航里的串当 needle**：那种串全站每页都有，命中的是"页面存在"而不是
 *      "这批内容上线了"。改完跑 `node _dev/live-version-check.js --sentinels` 看体检结果。
 */
const SENTINELS = [
  { label: "冠词修复（a everyday → an everyday）", needle: "an everyday phrase you would use in China" },
  // 这两条是「深度内容通用小节」的标记：**每深化一批，命中数就跟着涨**。
  // 标签别写成"第一批" —— 那样第三批没上线时会归因到第一批，误导。
  { label: "P1 深化内容：更自然的说法（全部批次）", needle: "Other ways people say it" },
  { label: "P1 深化内容：新手常见坑（全部批次）", needle: "What usually trips people up" },
  // 第二批（45/46/62/63/65/67/75/82 八页）—— 这两条 needle 分别落在
  // MUST 里的 goodbye 页与 how-are-you 页，所以线上抽样都能取到。
  { label: "P1 深化第二批：告别页", needle: "我先走了" },
  { label: "P1 深化第二批：问候页（含 FAQ 改读正文）", needle: "Have you eaten?" },
  // FAQ 那条「When would you use…」的答案从 tip 改读 deep.when —— 这会让每个已深化页
  // 的可见文本变动 40~50 字符。谢谢页在 MUST 里，所以这条 needle 抽得到。
  { label: "FAQ 答案改读正文（deep.when）", needle: "Thank someone for anything small" },
  { label: "id 13 文案改写（It's this address → This is the address）", needle: "This is the address" },
  { label: "清单时间轴（三阶段）", needle: "2\u20134 weeks before" },
  // ⚠ 这条曾写 needle: "Situations" —— 那是页脚导航链接（components/FeedbackFooter.tsx），
  // 全站每页都有 → 命中 31/31，报告里看着"全绿"，实际这条断言永远不会因为
  // 「场景内容没上线」而变假。哨兵必须取**只在本功能页面出现的正文串**。
  { label: "Scenario Mode（场景总览 H1）", needle: "What to say, in the order you" },
  { label: "Numbers & Money 改动", needle: "how to count to 10,000" },
  // P1 第三批（9/10/31/50/74/83/85/87 八页）—— 必须落在一页 MUST 里，
  // 否则「第三批没传上去」时它所在的页压根不在抽样里，归因取不到。
  { label: "P1 深化第三批：不好意思（拒推销）", needle: "wave off a tout at a tourist site" },
  // 连播功能（2026-09-27）：Listen 按钮上的 ×3 徽标 = 「点一次自动播三遍」的可见证据。
  // 它出现在每个带 Listen 的页面（≈100 页），所以别塞进 MUST —— 也完全不需要。
  // 与当年那条 Situations 页脚串的区别：这条监控的就是被测功能本身（AudioButton），
  // 而页脚串监控的是「页脚有没有那个链接」，功能丢了照样命中。
  // ⚠ needle 里 Listen 与 ×3 之间**必须有一个空格**：两者是相邻的两个 <span>，
  //   visibleText() 会把夹在中间的标签替换成空格。写成 "Listen×3" 时本地 0 命中
  //   —— 当场被下面的哨兵自检抓成「死哨兵」（2026-09-27）。
  { label: "连播（Listen ×3）", needle: "Listen ×3" },
  // P1 第四批（73/66/64/34/76/47/81/84 八页）。这批的头一条是**插队**进来的：
  // GSC 已经给 /how-to-say-i-love-you-in-chinese/ 曝光（i love you / i really love you /
  // chinese of i love you 是同一意图的三种问法），而它当时还是全站最薄那一档。
  // 用两条互相独立、落在不同页不同分类的 needle 当证人，避免「某一页碰巧变动」被误归因。
  { label: "P1 深化第四批：我爱你（GSC 已曝光页）", needle: "怎么突然说这个" },
  { label: "P1 深化第四批：报案证明（emergency）", needle: "报案证明" },
  // P1 第五批（3/77/78/89/8/40/32/80 八页）。这批三条落在 restaurant、两条落在
  // shopping、两条 everyday、一条 emergency —— 用两条**不同分类**的 needle 当证人，
  // 避免「某一页碰巧变动」被误归因成整批。
  { label: "P1 深化第五批：打包（restaurant）", needle: "Doggy bags carry no stigma" },
  { label: "P1 深化第五批：过敏（emergency）", needle: "Allergy is a known idea in China" },
  // P1 第六批（69/70/17/16/99/91/68/2 八页）。这批的特殊之处：**前四条是插队进来的** ——
  // GSC 已经在曝光「my chinese isnt good / do you speak english / please help me」这三条，
  // 而它们当时是全站最薄那一档（316 / 342 / 297 词），所以按「已曝光页优先」而不是按词数排序选。
  // 两条 needle 分别落在**不同分类**且都在 MUST 里：everyday（69）与 emergency（91）。
  { label: "P1 深化第六批：中文不好（everyday · GSC 已曝光）", needle: "is politeness rather than a measurement" },
  { label: "P1 深化第六批：生病（emergency）", needle: "A fever is what pharmacies and clinics act on" },
  // P1 第七批（79/7/19/15/33/27/98/49 八页）—— 挑法回到「最薄 15 页」，因为上一批把
  // GSC 已曝光的三条插队页做完后，曝光侧没有新的薄页冒出来，而 285~297 这一档已挤满 15 页。
  // 分类刻意分散：everyday 2（79 认识你很高兴 / 49 请再说一遍）、restaurant 1（7 请给我水）、
  // travel 2（19 什么时候出发 / 15 火车站在哪儿）、shopping 1（33 我可以试试吗）、
  // hotel 1（27 空调坏了）、money 1（98 我来付）。
  // 两条 needle 落在**不同分类**且都会进 MUST：restaurant（7）与 hotel（27）。
  { label: "P1 深化第七批：水（restaurant）", needle: "water is not poured automatically" },
  { label: "P1 深化第七批：空调（hotel）", needle: "reports a fault without blaming anyone for it" },
  // P1 第八批（4/23/28/36/39/52/90/97 八页）—— 挑法同第七批：最薄 15 页 + 分类分散。
  // 分类：restaurant 2（4 菜单 / 52 吃素）、shopping 2（39 退货 / 36 刷卡）、
  // hotel 2（28 毛巾 / 23 入住）、money 1（97 怎么付款）、emergency 1（90 花生过敏）。
  // 两条 needle 落在**不同分类**且都会进 MUST：restaurant（4）与 emergency（90）。
  { label: "P1 深化第八批：菜单（restaurant）", needle: "a pointed finger at a code" },
  { label: "P1 深化第八批：花生过敏（emergency）", needle: "is cooked with peanuts" },
  // P1 第九批（6/24/26/37/38/51/86/88 八页）—— 挑法同前：最薄 15 页 + 分类分散。
  // 分类：shopping 2（37 小号 / 38 袋子）、restaurant 2（6 不吃肉 / 51 推荐）、
  // hotel 2（26 Wi-Fi / 24 退房）、emergency 2（86 迷路 / 88 看医生）。
  // 两条 needle 落在**不同分类**且都会进 MUST：shopping（37）与 emergency（88）。
  { label: "P1 深化第九批：小号（shopping）", needle: "may pinch here" },
  { label: "P1 深化第九批：看医生（emergency）", needle: "without a number no doctor will call you" },
  // P1 第十批（13/18/21/35/54/72/92/100 八页）—— 挑法：GSC 已曝光页插队（id 13「这就是地址」）
  // + 最薄 15 页 + 分类分散（travel 2 / shopping 1 / everyday 1 / hotel 1 / restaurant 1 / money 1 / emergency 1）。
  // 两条 needle 落在**不同分类**且都会进 MUST：emergency（92）与 money（100，money 分类首次当哨兵）。
  // 两条都是先从构建产物 HTML 里现查现抄（HIT）才写进来的，不凭写稿记忆。
  { label: "P1 深化第十批：护照丢了（emergency）", needle: "the sentence starts two things at once" },
  { label: "P1 深化第十批：一共多少钱（money）", needle: "the word printed on receipts" },
  // P1 第十一批（41/42/44/45/48/62/63/65/67/75 十页）—— 这批性质不同：**不是新增页**，
  // 而是给首批/第二批那 17 条老格式补到标准厚度（replies 从 0 补到 3、mistakes 补到 3）。
  // 十页全在 everyday（问候类），**跨分类做不到** → 改用两条落在不同页的 needle 互相印证。
  // 挑 hello（GSC 曝光最高）与 yes（是/不是 那一组）。两条都先从产物现查现抄（HIT）才写入。
  { label: "P1 深化第十一批：你好（三声变调）", needle: "with two separate dips" },
  { label: "P1 深化第十一批：是的语气", needle: "can sound clipped, even impatient" },
  // P1 第十二批（1/5/9/11/43/46/82 七条）—— P1 深化收口批：补完这批 105 条全部达标准形状。
  // 两条 needle 落在**不同分类**（money 的多少钱 / emergency 的救命），都先从产物现查现抄（HIT）。
  { label: "P1 深化第十二批：多少钱（块 vs 元）", needle: "Same number, two words" },
  { label: "P1 深化第十二批：救命（120 的读法）", needle: "yāo èr líng" },
];

/* ---------------- 哨兵体检：按【全部本地页】统计，不联网 ---------------- */

/**
 * 【为什么按全部本地页统计，而不是按抽到的 31 页】
 * 抽样统计会把两件事搞错，两件都已踩过：
 *   ① 哨兵所在页没被抽到 → 本地命中 0 → 误报「死哨兵」。当时的解法是往 MUST 里塞页面
 *      （"哨兵必须在 MUST 里才有意义"这条注释就是这么来的）—— 那是绕开，不是修好。
 *   ② 页脚/导航这类全站通用串 → 命中全部抽样页 → 报告全绿，但这条断言永远不会变假，
 *      等于「Scenario Mode 整块内容没上线」它也不会报警（2026-09-27 实测）。
 * 按全量统计，两个问题一起消失：死哨兵 = 0/136，全站通用串 = 136/136，都精确定位。
 * 而且纯本地、约 1 秒、可离线跑 → 改完 needle 就能立刻双向验证。
 */
function sentinelScan(pages) {
  const hitPages = new Map(SENTINELS.map((s) => [s.label, []]));
  for (const p of pages) {
    let t = "";
    try {
      t = visibleText(fs.readFileSync(p.file, "utf8"));
    } catch {
      continue;
    }
    for (const s of SENTINELS) if (t.includes(s.needle)) hitPages.get(s.label).push(p.urlPath);
  }
  return hitPages;
}

/**
 * 打印哨兵体检表。liveHits / sampleTotal 只在联网跑的时候给。
 * verbose = 列出命中页面清单（`--sentinels` 模式用）。
 * 返回 {dead, everywhere}，两者都表示「这条哨兵的归因能力是坏的」。
 */
function reportSentinels(hitPages, totalPages, liveHits, sampleTotal, verbose, say) {
  const dead = [];
  const everywhere = [];
  say(`-- 哨兵自检（本地命中 / 线上抽样命中）--`);
  for (const s of SENTINELS) {
    const pages = hitPages.get(s.label) || [];
    const isDead = pages.length === 0;
    const isEverywhere = totalPages > 1 && pages.length === totalPages;
    if (isDead) dead.push(s.label);
    if (isEverywhere) everywhere.push(s.label);
    const mark = isDead ? "✗ 死哨兵" : isEverywhere ? "⚠ 全站通用" : "·";
    const liveTxt = liveHits ? ` · 线上抽样 ${liveHits.get(s.label).live}/${sampleTotal}` : "";
    say(`  ${mark} ${s.label} → 本地 ${pages.length}/${totalPages} 页${liveTxt}`);
    if (verbose && !isDead && !isEverywhere) {
      say(`      命中：${pages.slice(0, 5).join(" ")}${pages.length > 5 ? ` …共 ${pages.length} 页` : ""}`);
    }
  }
  if (dead.length) {
    say(``);
    say(`✗ ${dead.length} 条死哨兵（全站 0 命中）——判同版仍有效，但对这些批次「缺哪一批」的归因是瞎的：`);
    for (const l of dead) say(`  - ${l}`);
    say(`  修法：用 _dev/sentinel-probe.js 取该功能页面里的真实可见文本当 needle。`);
  }
  if (everywhere.length) {
    say(``);
    say(`⚠ ${everywhere.length} 条哨兵命中全部 ${totalPages} 页 —— 取到的是页脚/导航这类全站通用串，`);
    say(`  它命中的是「页面存在」而不是「这批内容上线了」，永远不会变假：`);
    for (const l of everywhere) say(`  - ${l}`);
    say(`  修法：换成只出现在目标功能页面正文里的串（先 sentinel-probe 看上下文）。`);
  }
  return { dead, everywhere };
}

/* ---------------- 选页面 ---------------- */

function localPages() {
  const pages = [];
  (function walk(dir, rel) {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      const r = rel ? `${rel}/${e.name}` : e.name;
      if (e.isDirectory()) walk(p, r);
      else if (e.name === "index.html") {
        // 已删除 URL 的静态跳转页不是内容页（见 _dev/make-redirect-stubs.js）：
        // 不剔的话全量样本会随「加了几条 301」而漂移（136 → 140），
        // 而「136/136 一致」这个数是历史可比的关键指标。存在性由 seocheck 逐条盯着。
        if (fs.readFileSync(p, "utf8").includes("cq-redirect-stub")) continue;
        pages.push({ urlPath: rel ? `/${rel}/` : "/", file: p });
      }
    }
  })(OUT, "");
  return pages;
}

const MUST = [
  "/",
  "/how-to-say-thank-you-in-chinese/",
  // ⚠ 这条曾写作 "/how-to-say-im-sorry-in-chinese/" —— 产物里根本没有这个目录
  //   （真实页是 /how-to-say-sorry-in-chinese/），于是它被 pickSample 静默跳过，
  //   而报告里抽样数照样看着正常。已加 MUST_MISSING 断言，同类错误不会再沉默。
  "/how-to-say-sorry-in-chinese/",
  // id 13：URL 被 slug 锁定、文案改写的那条。必检，否则「文案改写」哨兵在线上抽样里取不到。
  "/how-to-say-its-this-address-in-chinese/",
  "/china-travel-checklist/",
  "/scenarios/",
  "/chinese-numbers/",
  "/learn/everyday/",
  "/learn/money/",
  // P1 第二批次哨兵落在这两页上 —— 不放进必检，线上抽样就取不到它们
  "/how-to-say-goodbye-in-chinese/",
  "/how-to-say-how-are-you-in-chinese/",
  // P1 第三批哨兵落在这页上（同时它也是第三批里搜索量最高的一条）
  "/how-to-say-excuse-me-in-chinese/",
  // P1 第四批的两条哨兵分别落在这两页上。i-love-you 页同时是 GSC 已曝光页，
  // 本来就值得常驻必检；please-call-the-police 是唯一能代表 emergency 分类的。
  "/how-to-say-i-love-you-in-chinese/",
  "/how-to-say-please-call-the-police-in-chinese/",
  // P1 第五批的两条哨兵分别落在这两页上。packing 页代表 restaurant 分类，
  // allergic 页代表 emergency 分类 —— 两条都不能落进抽样盲区。
  "/how-to-say-can-i-get-this-to-go-in-chinese/",
  "/how-to-say-im-allergic-in-chinese/",
  // P1 第六批：两条哨兵分别落在 my-chinese-isnt-good（everyday）与 im-sick（emergency）。
  // 前三条是 GSC 已经曝光的高价值页 —— 它们从「被展示」变成「值得每次必检」，
  // 常驻在这里也顺手把「薄页有没有加厚」这件事纳入常态监控。
  // ⚠ 三条路径都已用 MUST_MISSING 断言核对过真的解析到本地页，不是摆设。
  "/how-to-say-my-chinese-isnt-good-in-chinese/",
  "/how-to-say-im-sick-in-chinese/",
  "/how-to-say-do-you-speak-english-in-chinese/",
  "/how-to-say-please-help-me-in-chinese/",
  // P1 第七批：两条哨兵分别落在 water-please（restaurant）与 the-air-conditioner-is-broken（hotel）。
  // 这两页同时也是这批里搜索意图最清楚的两条 → 常驻必检既盯哨兵也盯厚度。
  "/how-to-say-water-please-in-chinese/",
  "/how-to-say-the-air-conditioner-is-broken-in-chinese/",
  // P1 第八批：两条哨兵分别落在 do-you-have-a-menu（restaurant）与
  // im-allergic-to-peanuts（emergency）。目录已用 existsSync 核实过，不是摆设。
  "/how-to-say-do-you-have-a-menu-in-chinese/",
  "/how-to-say-im-allergic-to-peanuts-in-chinese/",
  // P1 第九批：两条哨兵分别落在 do-you-have-a-small-size（shopping）与
  // i-need-to-see-a-doctor（emergency）。目录已用 existsSync 核实过，不是摆设。
  "/how-to-say-do-you-have-a-small-size-in-chinese/",
  "/how-to-say-i-need-to-see-a-doctor-in-chinese/",
  // P1 第十批：两条哨兵分别落在 i-lost-my-passport（emergency）与
  // how-much-is-it-altogether（money）。目录已用 existsSync 核实过，不是摆设。
  "/how-to-say-i-lost-my-passport-in-chinese/",
  "/how-to-say-how-much-is-it-altogether-in-chinese/",
  // P1 第十一批：两条哨兵分别落在 hello 与 yes —— 这两条都是 GSC 正在曝光的问候类查询，
  // 常驻必检顺便盯住「补齐的内容有没有真的上线」。
  "/how-to-say-hello-in-chinese/",
  "/how-to-say-yes-in-chinese/",
  // P1 第十二批（收口批）：两条哨兵分别落在 how-much（money）与 help（emergency）。
  "/how-to-say-how-much-in-chinese/",
  "/how-to-say-help-in-chinese/",
];

/* MUST 里对不上任何本地页的路径。非空 = 「必检」这个承诺已经被悄悄打折，必须当失败处理。 */
const MUST_MISSING = [];

function pickSample(pages) {
  const byPath = new Map(pages.map((p) => [p.urlPath, p]));
  const chosen = [];
  const seen = new Set();
  for (const m of MUST) {
    if (byPath.has(m)) {
      chosen.push(byPath.get(m));
      seen.add(m);
    } else if (m === "/") {
      chosen.push({ urlPath: "/", file: path.join(OUT, "index.html") });
      seen.add(m);
    } else {
      // 【为什么必须报错而不是跳过】MUST 是「这些页一定要检」的承诺。路径写错时
      // 旧实现静默跳过，抽样数、一致率、VERDICT 全都照常漂亮 —— 那条承诺变成了空气
      // 而且看不出来。2026-09-27 实测：/how-to-say-im-sorry-in-chinese/ 长期挂在这里，
      // 匹配不到任何页面（真实页是 -sorry-），等于 对不起 那页从没被必检过。
      MUST_MISSING.push(m);
    }
  }
  // 其余按固定步长抽样（可复现，不随机）
  const rest = pages.filter((p) => !seen.has(p.urlPath));
  const target = FULL ? rest.length : 20;
  const step = Math.max(1, Math.floor(rest.length / target));
  for (let i = 0; i < rest.length && chosen.length < MUST.length + target; i += step) chosen.push(rest[i]);
  return chosen;
}

/* ---------------- 主流程 ---------------- */

(async () => {
  if (!fs.existsSync(OUT)) {
    console.log("FAIL: 没有 out/，先 npm run build");
    process.exit(1);
  }
  const all = localPages();

  /* --sentinels：只体检哨兵，不联网。改完 needle 先跑这个（1 秒）。 */
  if (SENTINEL_ONLY) {
    const scan = sentinelScan(all);
    const out0 = [];
    const say0 = (s) => {
      out0.push(String(s));
      console.log(String(s));
    };
    say0(`== 哨兵体检（离线）==`);
    say0(`local    : ${OUT}（${all.length} 页）`);
    say0(``);
    const { dead, everywhere } = reportSentinels(scan, all.length, null, 0, true, say0);
    say0(``);
    say0(
      dead.length || everywhere.length
        ? `VERDICT FAIL —— ${dead.length} 条死哨兵 / ${everywhere.length} 条全站通用串`
        : `VERDICT PASS —— ${SENTINELS.length} 条哨兵都活着且有区分度`
    );
    fs.writeFileSync("_dev/live-sentinels.txt", out0.join("\n"), "utf8");
    process.exit(dead.length || everywhere.length ? 1 : 0);
  }

  const raw = require("./baseurl.js").normalizeBase(process.argv[2] || "", "https://chinesequick.com");
  const sample = pickSample(all);
  const out = [];
  const say = (s) => {
    out.push(String(s));
    console.log(String(s));
  };

  say(`== 线上版本核验 ==`);
  say(`base     : ${raw}`);
  say(`local    : ${OUT}（${all.length} 页）`);
  say(`sample   : ${sample.length} 页${FULL ? "（全量）" : "（抽样，--full 可全量）"}`);
  if (MUST_MISSING.length) {
    say(`⚠ MUST 有 ${MUST_MISSING.length} 条对不上任何本地页 —— 「必检」承诺已失效：`);
    for (const m of MUST_MISSING) say(`    ${m}`);
    say(`  （改对路径，或确认这页真的删了并把这条从 MUST 移除）`);
  }
  say(``);

  /* build 号比对 —— 先做这一步：它只要一次请求，就能回答「线上是不是我刚构建的这份」。
     ⚠ 本地值只取**本地产物**里的标记，绝不拿 `git rev-parse HEAD` 当本地值：
        发版流程是 build → deploy → 之后才 commit，commit 一落地 HEAD 就变了，
        用 git 当本地值会在每次提交后误报「线上落后」，而线上其实是对的。 */
  const localBuild = buildAttr(fs.readFileSync(path.join(OUT, "index.html"), "utf8"));
  const liveHome = await get(raw + "/");
  const liveBuild = buildAttr(liveHome.body);
  const buildOk = Boolean(localBuild) && localBuild === liveBuild;
  say(`-- build 号（<html data-build>）--`);
  say(`本地产物 : ${localBuild || "(产物里没有标记 —— 构建早于 lib/build.ts)"}`);
  say(`线上首页 : ${liveBuild || "(取不到，或线上那一份还没有版本标记)"}`);
  say(
    buildOk
      ? `判定     : 一致 ✅ 线上就是本地这份`
      : `判定     : 不一致 ⚠ 线上不是本地这份（部署没生效 / CDN 还挂着旧份 / 构建后没上传）`
  );
  say(``);

  let same = 0;
  let diff = [];
  let missing = [];
  const liveHits = new Map(SENTINELS.map((s) => [s.label, { live: 0 }]));
  const hitPages = sentinelScan(all);
  const t0 = Date.now();

  for (const p of sample) {
    if (!fs.existsSync(p.file)) {
      missing.push(`${p.urlPath} (本地文件不存在)`);
      continue;
    }
    const localHtml = visibleText(fs.readFileSync(p.file, "utf8"));
    const localHash = sha(localHtml);
    const live = await get(raw + p.urlPath);
    if (live.status !== 200) {
      missing.push(`${p.urlPath} → HTTP ${live.status}${live.error ? " " + live.error : ""}`);
      continue;
    }
    const liveHtml = visibleText(live.body);
    const liveHash = sha(liveHtml);
    for (const s of SENTINELS) {
      if (liveHtml.includes(s.needle)) liveHits.get(s.label).live += 1;
    }
    if (liveHash === localHash) {
      same += 1;
    } else {
      // 反查这一页差的是哪一批改动
      const lacking = SENTINELS.filter((s) => localHtml.includes(s.needle) && !liveHtml.includes(s.needle)).map(
        (s) => s.label
      );
      diff.push({ path: p.urlPath, localHash, liveHash, localLen: localHtml.length, liveLen: liveHtml.length, lacking });
    }
  }

  say(`-- 逐页比对 --`);
  say(`一致   : ${same} / ${sample.length}`);
  say(`不一致 : ${diff.length}`);
  if (missing.length) say(`取不到 : ${missing.length}\n  ${missing.join("\n  ")}`);

  if (diff.length) {
    say(``);
    say(`-- 不一致的页面 --`);
    for (const d of diff.slice(0, 25)) {
      const delta = d.liveLen - d.localLen;
      const deltaS = `${delta > 0 ? "+" : ""}${delta}`;
      say(`  ${d.path}   可见文本 ${d.localLen} → ${d.liveLen}（${deltaS}）`);
      say(`    ${d.lacking.length ? `缺: ${d.lacking.join(" / ")}` : "（哨兵未覆盖这一页的改动）"}`);
    }
    if (diff.length > 25) say(`  …另有 ${diff.length - 25} 页`);
  }

  const missingBatches = [...new Set(diff.flatMap((d) => d.lacking))];
  const ok = diff.length === 0 && missing.length === 0 && MUST_MISSING.length === 0 && buildOk;
  say(``);
  reportSentinels(hitPages, all.length, liveHits, sample.length, false, say);
  say(``);
  say(`耗时 ${((Date.now() - t0) / 1000).toFixed(1)}s`);
  if (missingBatches.length) {
    say(``);
    say(`线上落后于本地，缺少这批改动：`);
    for (const b of missingBatches) say(`  - ${b}`);
  }
  say(``);
  say(ok ? "VERDICT PASS —— 线上 = 本地，上传的是最新版" : "VERDICT FAIL —— 线上 ≠ 本地");

  fs.writeFileSync("_dev/live-version.txt", out.join("\n"), "utf8");
  process.exit(ok ? 0 : 1);
})();
