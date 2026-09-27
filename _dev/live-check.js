// 线上核验：workbuddy 域名上本次 SEO/GEO 改动是否真的生效
const https = require("https");
const fs = require("fs");

const HOST = "real-life-chinese.app.workbuddy.host";

function once(path, method = "GET") {
  return new Promise((resolve) => {
    const req = https.request(
      { host: HOST, port: 443, path, method, headers: { "User-Agent": "seo-probe" }, timeout: 15000 },
      (res) => {
        const c = [];
        res.on("data", (d) => c.push(d));
        res.on("end", () => resolve({ status: res.statusCode, body: Buffer.concat(c).toString("utf8") }));
      }
    );
    req.on("timeout", () => { req.destroy(); resolve({ err: "TIMEOUT" }); });
    req.on("error", (e) => resolve({ err: e.message }));
    req.end();
  });
}

async function get(path, tries = 3) {
  let last;
  for (let i = 0; i < tries; i++) {
    last = await once(path);
    if (!last.err) return last;
  }
  return last;
}

(async () => {
  const out = {};

  const files = ["/robots.txt", "/llms.txt", "/og.png", "/logo.png", "/apple-icon.png", "/sitemap.xml", "/b3009d2d0336934d3d8380112e45b81d.txt"];
  out.files = {};
  for (const f of files) {
    const r = await get(f);
    out.files[f] = r.err ? { err: r.err } : { status: r.status, len: r.body.length };
  }

  const pages = [
    "/",
    "/chinese-restaurant-phrases/",
    "/how-to-say-thank-you-in-chinese/",
    "/how-to-say-i-dont-eat-meat-in-chinese/",
    "/learn/restaurant/",
  ];
  out.pages = {};
  for (const p of pages) {
    const r = await get(p);
    if (r.err) { out.pages[p] = { err: r.err }; continue; }
    const h = r.body;
    const blocks = [...h.matchAll(/<script[^>]*application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)].map((m) => m[1]);
    let bad = 0;
    const types = [];
    for (const b of blocks) {
      try {
        const j = JSON.parse(b);
        for (const it of j["@graph"] || [j]) if (it["@type"]) types.push(it["@type"]);
      } catch { bad++; }
    }
    out.pages[p] = {
      status: r.status,
      canonical: (h.match(/<link rel="canonical" href="([^"]*)"/) || [])[1] || null,
      jsonldBlocks: blocks.length,
      jsonldTypes: types,
      jsonldBad: bad,
      ogImage: (h.match(/<meta property="og:image" content="([^"]*)"/) || [])[1] || null,
    };
  }

  // 单句页正文长度
  const ph = await get("/how-to-say-i-dont-eat-meat-in-chinese/");
  if (!ph.err) {
    const t = ph.body
      .replace(/<script[\s\S]*?<\/script>/g, " ")
      .replace(/<style[\s\S]*?<\/style>/g, " ")
      .replace(/<br\s*\/?>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    out.phrasePage = {
      textLen: t.length,
      hasWordByWord: ph.body.includes("Word by word"),
      hasFaq: ph.body.includes("Common questions"),
    };
  }

  // robots 里 AI 爬虫声明的条目数
  const rb = await get("/robots.txt");
  if (!rb.err) {
    const ua = [...rb.body.matchAll(/^User-Agent:\s*(.+)$/gim)].map((m) => m[1].trim());
    out.robotsUA = ua.length;
    out.robotsHasPerplexity = ua.includes("PerplexityBot");
    out.robotsHasGooglebot = ua.includes("Googlebot");
  }

  // 首页是否链到 5 个集合页
  const home = await get("/");
  if (!home.err) {
    out.homeLinks = [
      "chinese-restaurant-phrases",
      "chinese-travel-phrases",
      "chinese-hotel-phrases",
      "chinese-shopping-phrases",
      "chinese-everyday-phrases",
    ].filter((s) => home.body.includes(`/${s}/`));
  }

  fs.writeFileSync("_dev/livecheck.txt", JSON.stringify(out, null, 1), "utf8");
})();
