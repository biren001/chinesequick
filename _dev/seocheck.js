// 核验静态产物：canonical / JSON-LD 合法性 / OG / sitemap / robots / llms / 正文长度
const fs = require("fs");
const path = require("path");

const OUT = "out";
const ROOT = path.join(__dirname, "..");
const SITE = "https://chinesequick.com";
// 跳转页（已删除 URL 的兜底）靠这个标记被识别；生成器与断言共用同一个串。
// 见 _dev/make-redirect-stubs.js —— 换标记要同时改那边，否则断言会对不上。
const STUB_MARKER = "cq-redirect-stub";
const out = {};

function read(p) {
  return fs.readFileSync(path.join(OUT, p), "utf8");
}

function pick(h, re) {
  const m = h.match(re);
  return m ? m[1] : null;
}

function textOf(h) {
  return h
    .replace(/<script[\s\S]*?<\/script>/g, " ")
    .replace(/<style[\s\S]*?<\/style>/g, " ")
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * title / description 的长度必须先解码 HTML 实体再量。
 * `&quot;` 占 6 个字符但只渲染 1 个 —— 不解码会把合规的页面误报成超长（踩过一轮）。
 */
function metaLen(s) {
  return String(s || "")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;|&#39;|&apos;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&rsquo;|&lsquo;/g, "'")
    .replace(/&ldquo;|&rdquo;/g, '"')
    .replace(/&mdash;/g, "—")
    .replace(/&hellip;/g, "…")
    .replace(/&nbsp;/g, " ").length;
}

function jsonldOf(h) {
  const blocks = [
    ...h.matchAll(/<script[^>]*application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi),
  ].map((m) => m[1]);
  const parsed = [];
  const errors = [];
  for (const b of blocks) {
    try {
      parsed.push(JSON.parse(b));
    } catch (e) {
      errors.push(e.message);
    }
  }
  return { count: blocks.length, parsed, errors };
}

function typesOf(graphs) {
  const t = [];
  for (const g of graphs) {
    const items = g["@graph"] || [g];
    for (const it of items) if (it && it["@type"]) t.push(it["@type"]);
  }
  return t;
}

// ── 首页 ──
const home = read("index.html");
const hJ = jsonldOf(home);
out.home = {
  canonical: pick(home, /<link rel="canonical" href="([^"]*)"/),
  ogImage: pick(home, /<meta property="og:image" content="([^"]*)"/),
  ogImageAbs: pick(home, /<meta property="og:image" content="([^"]*)"/)?.startsWith(SITE),
  twitterCard: pick(home, /<meta name="twitter:card" content="([^"]*)"/),
  twitterImage: pick(home, /<meta name="twitter:image" content="([^"]*)"/),
  jsonldBlocks: hJ.count,
  jsonldTypes: typesOf(hJ.parsed),
  jsonldErrors: hJ.errors,
  titleLen: metaLen(pick(home, /<title>([^<]*)<\/title>/)),
  textLen: textOf(home).length,
};

// ── 单句页 ──
const pPath = "how-to-say-thank-you-in-chinese/index.html";
const ph = read(pPath);
const pJ = jsonldOf(ph);
out.phrase = {
  canonical: pick(ph, /<link rel="canonical" href="([^"]*)"/),
  title: pick(ph, /<title>([^<]*)<\/title>/),
  titleLen: metaLen(pick(ph, /<title>([^<]*)<\/title>/)),
  descLen: metaLen(pick(ph, /<meta name="description" content="([^"]*)"/)),
  jsonldBlocks: pJ.count,
  jsonldTypes: typesOf(pJ.parsed),
  jsonldErrors: pJ.errors,
  textLen: textOf(ph).length,
  hasWordTable: ph.includes("Word by word"),
  hasFaq: ph.includes("Common questions"),
  h2Count: (ph.match(/<h2/g) || []).length,
};
// FAQ 实体数量
const faqBlock = pJ.parsed.flatMap((g) => g["@graph"] || [g]).find((x) => x["@type"] === "FAQPage");
out.phrase.faqCount = faqBlock ? faqBlock.mainEntity.length : 0;

// ── 分类集合页 ──
const cPath = "chinese-restaurant-phrases/index.html";
const ch = read(cPath);
const cJ = jsonldOf(ch);
out.category = {
  canonical: pick(ch, /<link rel="canonical" href="([^"]*)"/),
  titleLen: metaLen(pick(ch, /<title>([^<]*)<\/title>/)),
  jsonldTypes: typesOf(cJ.parsed),
  jsonldErrors: cJ.errors,
  textLen: textOf(ch).length,
};
const listBlock = cJ.parsed.flatMap((g) => g["@graph"] || [g]).find((x) => x["@type"] === "ItemList");
out.category.itemCount = listBlock ? listBlock.itemListElement.length : 0;

// ── 学习页 ──
const lh = read("learn/restaurant/index.html");
const lJ = jsonldOf(lh);
out.learn = {
  canonical: pick(lh, /<link rel="canonical" href="([^"]*)"/),
  jsonldTypes: typesOf(lJ.parsed),
  jsonldErrors: lJ.errors,
};

// ── sitemap / robots / llms / og ──
const sm = read("sitemap.xml");
const locs = [...sm.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
out.sitemap = {
  total: locs.length,
  allHttps: locs.every((u) => u.startsWith(SITE + "/")),
  allTrailingSlash: locs.every((u) => u === SITE + "/" || u.endsWith("/")),
  // thank-you 与 saved 都是 noindex 的用户态页面，绝不能进 sitemap。
  // 注意：必须按 path 精确比较 —— 用 includes("thank-you") 会被
  // /how-to-say-thank-you-in-chinese/ 这个正常页面误伤（曾据此误报过一轮）。
  noNoindexPage: !locs.some((u) => {
    const p = new URL(u).pathname;
    return p === "/thank-you/" || p === "/saved/";
  }),
  sample: locs.slice(0, 3),
};

// ── 行前清单页 ──
// 这个页面是「文章 + 客户端工具」的混合体：静态 HTML 里必须已经有 SSR 出来的
// 复选框和 FAQ 结构化数据 —— 只靠客户端 JS 渲染，搜索引擎和 AI 抓不到任何东西。
{
  const tFile = path.join(OUT, "china-travel-checklist", "index.html");
  const exists = fs.existsSync(tFile);
  const info = {
    page: exists,
    inSitemap: locs.some((u) => new URL(u).pathname === "/china-travel-checklist/"),
  };
  if (exists) {
    const th = fs.readFileSync(tFile, "utf8");
    const tJ = jsonldOf(th);
    const tFaq = tJ.parsed
      .flatMap((g) => g["@graph"] || [g])
      .find((x) => x["@type"] === "FAQPage");
    Object.assign(info, {
      canonical: pick(th, /<link rel="canonical" href="([^"]*)"/),
      title: pick(th, /<title>([^<]*)<\/title>/),
      titleLen: metaLen(pick(th, /<title>([^<]*)<\/title>/)),
      descLen: metaLen(pick(th, /<meta name="description" content="([^"]*)"/)),
      jsonldTypes: typesOf(tJ.parsed),
      jsonldErrors: tJ.errors,
      faqCount: tFaq ? tFaq.mainEntity.length : 0,
      textLen: textOf(th).length,
      checkboxes: (th.match(/type="checkbox"/g) || []).length,
      // 政策类条目必须给出官方出口，「会变的事实」不能只靠我们自己说了算
      externalSources: (th.match(/rel="noopener noreferrer"/g) || []).length,
      // 时效必须写在静态 HTML 里（客户端才渲染的话，AI 引用时看不到）。
      // 注意要在 textOf 出来的文本上测：React 会在文字与插值之间插 <!-- -->，
      // 直接测原始 HTML 会匹配不到（踩过）。
      lastCheckedShown: /last checked on \d{1,2} \w+ 20\d\d/i.test(textOf(th)),
      // 清单按「什么时候做」分三个阶段。阶段时间窗是页面主干，必须写在静态 HTML 里 ——
      // 只在客户端渲染的话，搜索引擎和 AI 抓到的是 17 条无序待办，读不出先后。
      stagesShown: ["2\u20134 weeks before", "About a week before", "The day before"].filter((t) =>
        textOf(th).includes(t)
      ).length,
      // 条目上的主题标签。这三个词在清单页别处不会出现，所以有区分度
      // （Chinese 到处都是，不列入）。
      topicLabelsShown: ["Documents", "Money", "Phone"].filter((t) =>
        textOf(th).includes(t)
      ).length,
      // 清单项 → 短语分类 / 学习页的站内互链。读完清单什么都没有可点的话，
      // 这一页就只是个走到底的死胡同，也拿不到任何内链权重传递。
      // 注意 href 带尾斜杠（trailingSlash: true），正则要容忍 —— 漏了会数成 0。
      internalLinks: (th.match(/href="\/(?:chinese-[a-z0-9-]+|learn\/[a-z]+)\/?"/g) || []).length,
    });
  }
  out.checklist = info;
}

out.robots = read("robots.txt");
out.robotsUaCount = (out.robots.match(/User-Agent/gi) || []).length;
/** 在构建出的 JS 分包里找一段特征字符串 —— 用来断言「某个组件真的被打进产物了」。 */
function chunkContains(needle) {
  const stack = [path.join(OUT, "_next", "static", "chunks")];
  while (stack.length) {
    const dir = stack.pop();
    let entries = [];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const e of entries) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) stack.push(p);
      else if (e.name.endsWith(".js") && fs.readFileSync(p, "utf8").includes(needle)) return true;
    }
  }
  return false;
}

out.files = {
  llms: fs.existsSync(path.join(OUT, "llms.txt")),
  llmsHead: fs.existsSync(path.join(OUT, "llms.txt")) ? read("llms.txt").slice(0, 160) : null,
  og: fs.existsSync(path.join(OUT, "og.png")),
  ogSize: fs.existsSync(path.join(OUT, "og.png")) ? fs.statSync(path.join(OUT, "og.png")).size : 0,
  icon: fs.existsSync(path.join(OUT, "icon.svg")),
  // 浏览器会独立请求 /favicon.ico，缺了它每个访客控制台都有一条 404
  favicon: fs.existsSync(path.join(OUT, "favicon.ico")),
  // app/error.tsx 是否真的被打进产物：客户端异常绝不能退化成白屏
  // （曾实测：DOM 被浏览器翻译/扩展改写 → React commit 抛错 → 整页白屏，见 app/error.tsx 注释）
  errorBoundary: chunkContains("This page stopped working"),
  thankYouNoindex: pick(read("thank-you/index.html"), /<meta name="robots" content="([^"]*)"/),
};

// ── 全站 JSON-LD 体检：每个 .html 都过一遍 JSON.parse ──
const htmlFiles = [];
(function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p);
    else if (e.name.endsWith(".html")) htmlFiles.push(p);
  }
})(OUT);

let bad = 0;
let totalBlocks = 0;
const badList = [];
const noTranslateMissing = [];
for (const f of htmlFiles) {
  const h = fs.readFileSync(f, "utf8");
  const r = jsonldOf(h);
  totalBlocks += r.count;
  if (r.errors.length) {
    bad++;
    badList.push({ f: path.relative(OUT, f), err: r.errors });
  }
  // 每一页都必须声明不翻译：浏览器自动翻译会在 React 之外改写 DOM，
  // 导致 commit 阶段抛 NotFoundError、整页白屏（已复现）。少一页就是一个白屏入口。
  if (!/<html[^>]*translate="no"/.test(h) || !/<meta name="google" content="notranslate"/.test(h)) {
    noTranslateMissing.push(path.relative(OUT, f));
  }
}
out.allPages = {
  pages: htmlFiles.length,
  jsonldBlocks: totalBlocks,
  pagesWithBadJson: bad,
  badList,
  noTranslateMissing,
};

// ── 数字专页 /chinese-numbers/ ──
// 这一页是「单页吃掉一整簇查询」的做法：数字不拆成几十个单字薄页，而是
// 一张带音频的表 + 规则说明。所以断言重点是：音频真的接上了、有入链、有 FAQ schema。
{
  const nFile = path.join(OUT, "chinese-numbers", "index.html");
  const exists = fs.existsSync(nFile);
  const info = {
    page: exists,
    inSitemap: locs.some((u) => new URL(u).pathname === "/chinese-numbers/"),
  };
  if (exists) {
    const nh = fs.readFileSync(nFile, "utf8");
    const nJ = jsonldOf(nh);
    const nFaq = nJ.parsed
      .flatMap((g) => g["@graph"] || [g])
      .find((x) => x["@type"] === "FAQPage");
    // 每个数字卡片都要真的指向一个音频文件，否则页面上是个静默按钮
    const numberAudioRefs = [...new Set(nh.match(/\/audio\/numbers\/[a-z0-9-]+\.mp3/g) || [])];
    const numbers = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "data", "numbers.json"), "utf8"));
    // 入链：首页与 money 分类页都必须链到它，否则 linkgraph 会判孤岛
    const homeHref = fs.existsSync(path.join(OUT, "index.html"))
      ? /href="\/chinese-numbers\/"/.test(fs.readFileSync(path.join(OUT, "index.html"), "utf8"))
      : false;
    const moneyHref = fs.existsSync(path.join(OUT, "chinese-money-phrases", "index.html"))
      ? /href="\/chinese-numbers\/"/.test(
          fs.readFileSync(path.join(OUT, "chinese-money-phrases", "index.html"), "utf8")
        )
      : false;
    Object.assign(info, {
      canonical: pick(nh, /<link rel="canonical" href="([^"]*)"/),
      title: pick(nh, /<title>([^<]*)<\/title>/),
      titleLen: metaLen(pick(nh, /<title>([^<]*)<\/title>/)),
      descLen: metaLen(pick(nh, /<meta name="description" content="([^"]*)"/)),
      jsonldTypes: typesOf(nJ.parsed),
      jsonldErrors: nJ.errors,
      faqCount: nFaq ? nFaq.mainEntity.length : 0,
      numberItems: numbers.length,
      audioRefs: numberAudioRefs.length,
      audioMissing: numberAudioRefs.filter(
        (u) => !fs.existsSync(path.join(OUT, u.replace(/^\//, "")))
      ).length,
      linkedFromHome: homeHref,
      linkedFromMoney: moneyHref,
    });
  }
  out.numbers = info;
}

// ── money 分类页 ──
{
  const mFile = path.join(OUT, "chinese-money-phrases", "index.html");
  const exists = fs.existsSync(mFile);
  const info = { page: exists };
  if (exists) {
    const mh = fs.readFileSync(mFile, "utf8");
    const mJ = jsonldOf(mh);
    info.inSitemap = locs.some((u) => new URL(u).pathname === "/chinese-money-phrases/");
    info.titleLen = metaLen(pick(mh, /<title>([^<]*)<\/title>/));
    info.descLen = metaLen(pick(mh, /<meta name="description" content="([^"]*)"/));
    info.jsonldErrors = mJ.errors;
    // 数音频引用，不要数 aria-label —— 带 label 的按钮渲染成 aria-label="Listen"，
    // 只有纯图标按钮才写 "Play xxx"，数错会得到 1（踩过）。
    info.audioRefs = new Set(mh.match(/\/audio\/[0-9]+\.mp3/g) || []).size;
  }
  out.money = info;
}

// ── 拼音句末标点撞车（"Xièxie.."）──
// phrases.json 的拼音自带句末句点，模板后面还要补一个，拼出来就是两个句点。
// 线上真的出现过。这类问题不抛错、不影响功能，只有肉眼看得见 —— 只能靠断言守。
{
  const hits = [];
  for (const f of htmlFiles) {
    const t = textOf(fs.readFileSync(f, "utf8"));
    // 只抓「拉丁字母后面紧跟两个点」；省略号走的是 …，正常文案里不会有 ..
    const m = t.match(/.{0,25}[A-Za-zÀ-ÿ]\.[.].{0,15}/);
    if (m) hits.push({ file: path.relative(OUT, f), sample: m[0].trim() });
  }
  out.punctuation = {
    doublePeriodFiles: hits.length,
    doublePeriodList: hits.slice(0, 5),
  };
}

// ── 英文不定冠词（"It is a everyday phrase"）──
// 单句页 FAQ 正文里 `It is a ${分类名} phrase you would use in China.` 写死了冠词，
// 而分类名里 everyday / emergency 是元音开头 → 渲染成 "a everyday" / "a emergency"。
// 关键在于：这句是**页面上可见的正文**，也正是 Google 拿去当 SERP 摘要的那段
// （2026-09-27 实测：搜 `How to say "My Chinese isn't good" in Chinese`，
//  chinesequick.com 排第 1，摘要里引的就是这句错话）。修复见 lib/jsonld.ts 的 articleFor()。
// 断言只盯这一个固定句式，不泛化 —— 泛化会误伤 "a useful" 这类按读音才对的情况。
{
  const wrong = [];
  let checked = 0;
  for (const f of htmlFiles) {
    const t = textOf(fs.readFileSync(f, "utf8"));
    for (const m of t.matchAll(/It is (a|an) ([a-z]+) phrase you would use/g)) {
      checked += 1;
      const want = /^[aeiou]/.test(m[2]) ? "an" : "a";
      if (m[1] !== want) {
        wrong.push({ file: path.relative(OUT, f), got: m[0], want: `It is ${want} ${m[2]}` });
      }
    }
  }
  out.grammar = {
    articleChecked: checked,
    articleWrong: wrong.length,
    articleWrongList: wrong.slice(0, 3),
  };
}

// ── 品牌一致性 ──
// Google 官方文档（appearance/site-names）：站名最重要来源是首页 WebSite 结构化数据，
// 但"如果系统对提供的名称不太有把握，会改为显示域名或子域名"。
// 所以站名必须与域名对得上 —— 改品牌名时漏掉 any 一处（尤其是 title 模板与 OG）
// 都会给 Google 发冲突信号。这里把关键点固化成可复查的输出。
{
  const graph = jsonldOf(home).parsed.flatMap((g) => g["@graph"] || [g]);
  const wf = graph.find((x) => x["@type"] === "WebSite");
  const org = graph.find((x) => x["@type"] === "EducationalOrganization");
  const alternateNames = (wf && wf.alternateName) || [];
  const logoUrl = (org && org.logo && org.logo.url) || null;
  out.brand = {
    ogSiteName: pick(home, /<meta property="og:site_name" content="([^"]*)"/),
    schemaName: wf ? wf.name : null,
    // 两处必须同源，否则 Google 会挑一个（或直接回退域名）
    sameName: !!wf && wf.name === pick(home, /<meta property="og:site_name" content="([^"]*)"/),
    alternateName: alternateNames,
    // 官方要求域名全小写才会被识别为"网站名称偏好"
    domainInAlternateName: alternateNames.some((n) => String(n).toLowerCase() === "chinesequick.com"),
    // logo 是资源文件，绝不能带尾斜杠（/logo.png/ = 404，Google 就抓不到）
    logoUrl,
    logoUrlOk: !!logoUrl && !String(logoUrl).endsWith("/") && /\.(png|svg|jpg)$/i.test(String(logoUrl)),
    // 除首页 alternateName 之外，全站不该再出现旧品牌名。空数组 = 干净。
    legacyNameFiles: htmlFiles
      .filter((f) => fs.readFileSync(f, "utf8").includes("Real-Life Chinese"))
      .map((f) => path.relative(OUT, f)),
  };
}

// ── 场景流程页 /scenarios/（Scenario Mode）──
// 这一组页面的价值全在「有序 + 对方会说什么」上，所以断言盯的不是词数，
// 而是：每个场景页真的把步骤、「You may hear」和 FAQ SSR 出来了，
// 且**可见的步骤数**与 JSON-LD 的 ItemList 条数一致（内容与结构化数据不许打架）。
{
  const hubFile = path.join(OUT, "scenarios", "index.html");
  const hubExists = fs.existsSync(hubFile);
  const info = {
    hub: hubExists,
    hubInSitemap: locs.some((u) => new URL(u).pathname === "/scenarios/"),
  };
  if (hubExists) {
    const hh = fs.readFileSync(hubFile, "utf8");
    const hJ = jsonldOf(hh);
    // 必须按 @type 找 ItemList：BreadcrumbList 也有 itemListElement，
    // 直接 find(Array.isArray(itemListElement)) 会命中面包屑（踩过，数出 3 条）。
    const hubList = hJ.parsed
      .flatMap((g) => g["@graph"] || [g])
      .find((x) => x["@type"] === "ItemList" && Array.isArray(x.itemListElement));
    info.titleLen = metaLen(pick(hh, /<title>([^<]*)<\/title>/));
    info.descLen = metaLen(pick(hh, /<meta name="description" content="([^"]*)"/));
    info.hubItems = hubList ? hubList.itemListElement.length : 0;
    // 数站内 href 必须容忍尾斜杠（trailingSlash:true 下产物是 /scenarios/xxx/）
    info.hubScenarioLinks = new Set(
      hh.match(/href="\/scenarios\/[a-z0-9-]+\/?"/g) || []
    ).size;
    info.jsonldErrors = hJ.errors;

    const dirs = fs
      .readdirSync(path.join(OUT, "scenarios"), { withFileTypes: true })
      .filter((e) => e.isDirectory())
      .map((e) => e.name)
      .sort();

    info.pages = dirs.map((slug) => {
      const f = path.join(OUT, "scenarios", slug, "index.html");
      if (!fs.existsSync(f)) return { slug, exists: false };
      const h = fs.readFileSync(f, "utf8");
      const j = jsonldOf(h);
      const flat = j.parsed.flatMap((g) => g["@graph"] || [g]);
      const faq = flat.find((x) => x["@type"] === "FAQPage");
      // 同样按 @type 找 ItemList（面包屑也有 itemListElement，会数出 3 条）
      const il = flat.find(
        (x) => x["@type"] === "ItemList" && Array.isArray(x.itemListElement)
      );
      // React SSR 会在相邻文本节点之间插 <!-- -->，先去掉再匹配
      const t = textOf(h).replace(/<!--.*?-->/g, "").replace(/\s+/g, " ");
      const stat = t.match(/(\d+) steps · (\d+) phrases/);
      return {
        slug,
        exists: true,
        inSitemap: locs.some((u) => new URL(u).pathname === `/scenarios/${slug}/`),
        titleLen: metaLen(pick(h, /<title>([^<]*)<\/title>/)),
        descLen: metaLen(pick(h, /<meta name="description" content="([^"]*)"/)),
        // 计数一律用「>文字<」形态：
        // App Router 的产物里，同一段文字既在渲染出的 HTML 里，又在 RSC flight
        // payload 的 JSON 字符串里，裸匹配 /You say/ 会正好数成 2 倍（踩过）。
        // 渲染出来的文本节点前一定是 ">"，payload 里是引号，因此这个模式只数真的 DOM。
        stepsRendered: (h.match(/>You say</g) || []).length,
        // 「You may hear」块数 = 真 SSR 出对方回应的步骤数
        theySayRendered: (h.match(/>You may hear</g) || []).length,
        statedSteps: stat ? Number(stat[1]) : null,
        statedPhrases: stat ? Number(stat[2]) : null,
        itemListCount: il ? il.itemListElement.length : 0,
        faqCount: faq ? faq.mainEntity.length : 0,
        // 每条短语都要链到单句页（薄单句页的主要入链来源之一）
        phraseLinks: new Set(h.match(/href="\/how-to-say-[a-z0-9-]+\/?"/g) || [])
          .size,
        jsonldErrors: j.errors,
      };
    });
  }

  // 入链：首页、页脚所在页面、分类页、单句页四条路径各验一处，缺一条就会变孤岛
  const homeHtml = fs.existsSync(path.join(OUT, "index.html"))
    ? fs.readFileSync(path.join(OUT, "index.html"), "utf8")
    : "";
  const aboutHtml = fs.existsSync(path.join(OUT, "about", "index.html"))
    ? fs.readFileSync(path.join(OUT, "about", "index.html"), "utf8")
    : "";
  const moneyHtml = fs.existsSync(path.join(OUT, "chinese-money-phrases", "index.html"))
    ? fs.readFileSync(path.join(OUT, "chinese-money-phrases", "index.html"), "utf8")
    : "";
  const phraseHtml = fs.existsSync(
    path.join(OUT, "how-to-say-how-much-in-chinese", "index.html")
  )
    ? fs.readFileSync(
        path.join(OUT, "how-to-say-how-much-in-chinese", "index.html"),
        "utf8"
      )
    : "";
  info.linkedFromHome = /href="\/scenarios\/"/.test(homeHtml);
  info.linkedFromFooter = /href="\/scenarios\/"/.test(aboutHtml);
  info.categoryLinksScenario = /href="\/scenarios\/[a-z0-9-]+\/"/.test(moneyHtml);
  info.phraseLinksScenario = /href="\/scenarios\/taking-a-taxi\/"/.test(phraseHtml);

  // 一致性：可见步数 ↔ 引用条数 ↔ ItemList 条数
  info.mismatchedSteps = (info.pages || [])
    .filter(
      (p) =>
        p.exists &&
        (p.statedSteps !== p.stepsRendered ||
          p.statedPhrases !== p.itemListCount)
    )
    .map((p) => ({
      slug: p.slug,
      statedSteps: p.statedSteps,
      stepsRendered: p.stepsRendered,
      statedPhrases: p.statedPhrases,
      itemListCount: p.itemListCount,
    }));

  out.scenarios = info;
}

// ── 单句页 URL 与展示文案解耦（Phrase.slug 覆盖）──
// 单句页 URL 默认由英文生成，而英文是会改的（翻译腔要修、错句要替换）。
// 2026-09-27 从 Google SERP 上看到 `How to say "It's this address" in Chinese`
// 这句翻译腔，改文案会连带把**已被收录**的 URL 换掉 → 所以引入 Phrase.slug 覆盖。
// 这里盯三件事：URL 还在不在、页面上的英文是不是新的、canonical 有没有跟着漂。
// 另有一条：覆盖值如果已经和「english 算出来的 slug」一样，说明字段已经过期该删。
{
  const phrases = JSON.parse(fs.readFileSync("data/phrases.json", "utf8"));
  // 与 lib/slug.ts 的 slugify 保持一致（这里用显式码点，避免组合音标字符被编辑器吃掉）
  const slugify = (s) =>
    s
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/['’]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");

  const overridden = phrases.filter((p) => p.slug);
  out.slugOverride = {
    overriddenCount: overridden.length,
    entries: overridden.map((p) => {
      const derived = slugify(p.english);
      const file = path.join(OUT, `how-to-say-${p.slug}-in-chinese`, "index.html");
      const exists = fs.existsSync(file);
      const h = exists ? fs.readFileSync(file, "utf8") : "";
      const title = exists ? pick(h, /<title>([^<]*)<\/title>/) : "";
      const canonical = exists
        ? pick(h, /<link rel="canonical" href="([^"]*)"/)
        : "";
      // cleanEnglish 会削掉句末句点，标题里显示的就是这个值
      const shown = p.english.replace(/\.$/, "");
      return {
        id: p.id,
        chinese: p.chinese,
        slug: p.slug,
        english: p.english,
        // 覆盖字段还在起作用吗？（相等 = 字段过期，可以删掉）
        stillNeeded: derived !== p.slug,
        derivedWouldBe: derived,
        urlStillBuilt: exists,
        // 页面上真的是新英文吗（URL 不变 ≠ 文案没变）
        titleShowsNewEnglish: exists && title.includes(shown),
        // canonical 必须还指向旧地址，否则等于自己给自己制造了一次迁移
        canonicalMatchesUrl: exists && canonical.includes(`/how-to-say-${p.slug}-in-chinese`),
      };
    }),
  };
}

// ── 301 重定向表（public/_redirects）：每一条都要能解析成实体，目标必须真的存在 ──
// 起因：清负资产时删掉了 4 条 URL（我不买了 / 一页两意图 / 我叫大卫 / 很好）。
// 它们**曾经被 IndexNow 提交给搜索引擎** —— 我们主动对搜索引擎宣告过它们存在，
// 删掉就成了线上 404，等于把已经到手的收录信号扔掉。修法是 301 转给最贴近的现役页。
//
// 为什么必须写成断言，而不是「上线时检查一次」——这里会静默腐烂的有三件事：
//   ① 产物里没有 _redirects（Next 拷贝 public/ 的行为变了、文件被挪走）→
//      4 条 URL 悄悄退回 404，而全站其它报告依旧全绿；
//   ② 跳转目标页后来被删或改名 → 变成「301 跳到一个 404」，比不跳更糟（Google 记为死链）；
//   ③ 源路径哪天又生成了实体页面 → `_redirects` 会**覆盖**这个页面，活页被变跳转。
// 三种都是「配置腐烂」，所以每一条规则都要当场解析出 from / to / 落点文件。
{
  const file = path.join(OUT, "_redirects");
  const exists = fs.existsSync(file);
  const raw = exists ? fs.readFileSync(file, "utf8") : "";
  const rules = [];
  const problems = [];

  for (const line of raw.split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const f = t.split(/\s+/);
    if (f.length !== 3) {
      problems.push(`规则字段数不是 3：「${t}」`);
      continue;
    }
    const [from, to, status] = f;
    if (!from.startsWith("/")) problems.push(`源路径不带前导斜杠：「${t}」`);
    if (!/^\/(?!\/)|^https?:/.test(to)) problems.push(`目标不是站内路径或 URL：「${t}」`);
    if (!["301", "302", "200"].includes(status)) problems.push(`状态码不认识：「${t}」`);

    // 目标是否真能落在产物里的一个文件上（目录页走 index.html）
    const clean = to.replace(/^https?:\/\/[^/]+/, "").replace(/[*].*$/, "");
    const target = [
      path.join(OUT, clean, "index.html"),
      path.join(OUT, clean),
      path.join(OUT, clean.replace(/\/$/, "")),
    ].find((p) => fs.existsSync(p) && fs.statSync(p).isFile());

    // 源路径上如果出现实体页面，必须确认它是**我们自己的跳转页**（带标记）——
    // 否则说明那条 URL 又被重新生成了，`_redirects` 会把一个真页面盖成跳转。
    const srcClean = from.replace(/[*].*$/, "");
    const srcFile = fs.existsSync(path.join(OUT, srcClean, "index.html"))
      ? path.join(OUT, srcClean, "index.html")
      : fs.existsSync(path.join(OUT, srcClean))
        ? path.join(OUT, srcClean)
        : null;
    const srcLive = !!srcFile;
    const srcIsStub = srcLive && fs.statSync(srcFile).isFile() && fs.readFileSync(srcFile, "utf8").includes(STUB_MARKER);

    rules.push({
      from,
      to,
      status,
      target: target ? path.relative(OUT, target).replace(/\\/g, "/") : null,
      srcLive,
      srcIsStub,
    });
    if (!target) problems.push(`跳转目标在产物里不存在：${from} → ${to}`);
    if (srcLive && !srcIsStub) problems.push(`源路径上有**真页面**，会被这条规则盖掉：${from}`);
  }

  if (!exists) problems.push("产物里没有 _redirects（平台不吃它，但它是真 301 的意图声明）");
  if (!rules.length) problems.push("_redirects 解析出 0 条规则（文件在但内容认不出来）");

  // ── 跳转页（真正的兜底）：来源表 → 产物，逐条对账 ──
  // 起因见 _dev/make-redirect-stubs.js 头注释：本项目 CF Direct Upload 不执行 `_redirects`，
  // 所以「URL 不再是 404」这件事**只由跳转页保证**。跳转页丢一个 = 一条历史 URL 变死链，
  // 而这不会让任何其它报告变红 —— 必须在这里逐条断言。
  const legacyFile = path.join(ROOT, "data", "legacy-redirects.json");
  const legacyExists = fs.existsSync(legacyFile);
  const legacy = legacyExists ? JSON.parse(fs.readFileSync(legacyFile, "utf8")).rules || [] : [];
  const stubs = [];
  const sitemapRaw = fs.existsSync(path.join(OUT, "sitemap.xml"))
    ? fs.readFileSync(path.join(OUT, "sitemap.xml"), "utf8")
    : "";

  for (const r of legacy) {
    const f = path.join(OUT, r.from.replace(/^\//, ""), "index.html");
    const has = fs.existsSync(f);
    const html = has ? fs.readFileSync(f, "utf8") : "";
    const refresh = (html.match(/<meta http-equiv="refresh" content="0; url=([^"]+)"/) || [])[1] || null;
    const canonical = (html.match(/<link rel="canonical" href="([^"]+)"/) || [])[1] || null;
    const noindex = /<meta name="robots"[^>]*noindex/i.test(html);
    const inSitemap = sitemapRaw.includes(`<loc>https://chinesequick.com${r.from}/</loc>`);

    stubs.push({
      from: r.from,
      to: r.to,
      file: fs.existsSync(f),
      marked: html.includes(STUB_MARKER),
      refresh,
      canonical,
      noindex,
      inSitemap,
    });
    if (!has) problems.push(`跳转页缺失：${r.from}/index.html（这条 URL 会退回 404）`);
    if (has && refresh !== r.to) problems.push(`跳转页指向错：${r.from} → ${refresh}（应为 ${r.to}）`);
    if (has && canonical !== `https://chinesequick.com${r.to}`)
      problems.push(`跳转页 canonical 不对：${r.from} → ${canonical}`);
    // noindex 会让搜索引擎直接丢弃这个 URL 而**不做权重合并**，正是要避免的事
    if (has && noindex) problems.push(`跳转页带了 noindex（会妨碍权重合并）：${r.from}`);
    // 跳转页绝不能进 sitemap —— 那是把死路写进"请收录"清单
    if (inSitemap) problems.push(`跳转页出现在 sitemap 里：${r.from}`);
  }

  if (!legacyExists) problems.push("缺少 data/legacy-redirects.json（跳转表的唯一事实来源）");
  if (legacyExists && !legacy.length) problems.push("data/legacy-redirects.json 里没有规则");

  out.redirects = {
    exists,
    ruleCount: rules.length,
    rules,
    legacyCount: legacy.length,
    stubs,
    problems,
  };
}

fs.writeFileSync("_dev/seocheck.txt", JSON.stringify(out, null, 1), "utf8");

// 只有这条会改退出码：它是本轮新加的唯一「清单类配置」断言，
// 而 seocheck 历来什么都不打印、永远 exit 0 —— 那样的问题看不见。
if (out.redirects.problems.length) {
  console.error(
    `FAIL: _redirects 有 ${out.redirects.problems.length} 处问题：\n  ` +
      out.redirects.problems.join("\n  ")
  );
  process.exitCode = 1;
}
