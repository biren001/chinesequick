// 全站内链图：sitemap 里每条 URL 的入链数（相对链接必须按来源页解析）
const fs = require("fs");
const path = require("path");
const { URL } = require("url");

const OUT = "out";
const ORIGIN = "https://chinesequick.com";

const norm = (u) => {
  try {
    const x = new URL(u);
    return x.href.split("#")[0].split("?")[0].replace(/\/$/, "") || ORIGIN;
  } catch {
    return null;
  }
};

const sm = fs.readFileSync(path.join(OUT, "sitemap.xml"), "utf8");
const sitemapUrls = new Set(
  [...sm.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => norm(m[1])).filter(Boolean)
);

const htmlFiles = [];
(function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p);
    else if (e.name.endsWith(".html")) htmlFiles.push(p);
  }
})(OUT);

// 跳转页（已删除 URL 的兜底，见 _dev/make-redirect-stubs.js）不是内容页：
// 从扫描集里剔除，让 pagesScanned 与历史批次可比。它们**存在与否**由 seocheck 的
// out.redirects 断言逐条盯着，这里不重复负责 —— 但它们的出链仍然有效（不出现在死链里）。
const STUB_MARKER = "cq-redirect-stub";
for (let i = htmlFiles.length - 1; i >= 0; i--) {
  if (fs.readFileSync(htmlFiles[i], "utf8").includes(STUB_MARKER)) htmlFiles.splice(i, 1);
}

// 页面 URL -> 磁盘路径
const urlFromFile = (f) => {
  let rel = path.relative(OUT, f).split(path.sep).join("/");
  rel = rel === "index.html" ? "" : rel.replace(/index\.html$/, "");
  return norm(`${ORIGIN}/${rel}`);
};

const inbound = new Map([...sitemapUrls].map((u) => [u, 0]));
const outbound = new Map();
const orphans = [];
const broken = [];

// 磁盘上真实存在的页面（含 noindex 的 /saved、/thank-you 及 404）。
// 判「死链」必须以此为准，而不是「是否在 sitemap 里」——
// 否则每个指向 noindex 页的正常链接都会被误报（曾因此刷出 20+ 条假死链）。
const existingPages = new Set();
for (const f of htmlFiles) {
  const rel = path.relative(OUT, f).split(path.sep).join("/");
  if (rel.startsWith("404")) continue;
  const u = urlFromFile(f);
  if (u) existingPages.add(u);
}

for (const f of htmlFiles) {
  const src = urlFromFile(f);
  if (!src) continue;
  const html = fs.readFileSync(f, "utf8");
  const hrefs = [...html.matchAll(/<a[^>]+href\s*=\s*["']([^"']+)["']/gi)].map((m) => m[1]);
  const targets = new Set();
  for (const h of hrefs) {
    if (/^(mailto:|tel:|https?:\/\/)/i.test(h) && !/^https?:\/\/chinesequick\.com/i.test(h)) continue;
    const abs = norm(new URL(h, `${ORIGIN}/${path.relative(OUT, f).split(path.sep).join("/")}`).href);
    if (!abs) continue;
    targets.add(abs);
    if (sitemapUrls.has(abs)) inbound.set(abs, (inbound.get(abs) || 0) + 1);
    else if (/^https?:\/\/chinesequick\.com/i.test(h) || h.startsWith("/")) {
      if (!existingPages.has(abs) && !abs.endsWith("/thank-you")) {
        broken.push({ from: src, to: abs });
      }
    }
  }
  outbound.set(src, targets.size);
}

for (const [u, n] of inbound) if (n === 0) orphans.push(u);

// 首页出链里必须包含全部集合页（从 sitemap 里自动推导，加分类时不用改这里）
const homeHtml = fs.readFileSync(path.join(OUT, "index.html"), "utf8");
const catSlugs = [...sitemapUrls]
  .map((u) => u.replace(`${ORIGIN}/`, ""))
  .filter((p) => /^chinese-[a-z]+-phrases$/.test(p));

fs.writeFileSync(
  "_dev/linkgraph.txt",
  JSON.stringify(
    {
      sitemapPages: sitemapUrls.size,
      pagesScanned: htmlFiles.length,
      orphanCount: orphans.length,
      orphans,
      brokenInternalLinks: broken.slice(0, 10),
      minInbound: Math.min(...inbound.values()),
      maxInbound: Math.max(...inbound.values()),
      homeLinksToCategoryPages: catSlugs.filter((s) => homeHtml.includes(`/${s}/`)),
      sampleInbound: [...inbound.entries()].slice(0, 6),
      lowInbound: [...inbound.entries()].filter(([, n]) => n <= 1).slice(0, 10),
    },
    null,
    1
  ),
  "utf8"
);
