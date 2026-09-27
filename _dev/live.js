// 用 IP+SNI 直连，绕开本机 DNS（沙箱内 DNS 不可用）
const https = require("https");
const fs = require("fs");

const HOST = "chinesequick.com";
const IPS = ["172.67.145.52", "104.21.28.91"];

function once(ip, path, method = "GET") {
  return new Promise((resolve) => {
    const req = https.request(
      {
        host: ip,
        servername: HOST,
        port: 443,
        path,
        method,
        headers: { Host: HOST, "User-Agent": "Mozilla/5.0 (probe)" },
        timeout: 12000,
      },
      (res) => {
        const chunks = [];
        res.on("data", (c) => chunks.push(c));
        res.on("end", () =>
          resolve({
            status: res.statusCode,
            headers: res.headers,
            body: Buffer.concat(chunks).toString("utf8"),
          })
        );
      }
    );
    req.on("timeout", () => { req.destroy(); resolve({ err: "TIMEOUT" }); });
    req.on("error", (e) => resolve({ err: e.message }));
    req.end();
  });
}

async function get(path, tries = 3) {
  let last = null;
  for (let t = 0; t < tries; t++) {
    for (const ip of IPS) {
      const r = await once(ip, path);
      if (!r.err) return r;
      last = r;
    }
  }
  return last;
}

(async () => {
  const out = {};
  const paths = ["/", "/robots.txt", "/sitemap.xml", "/llms.txt", "/chinese-restaurant-phrases/", "/how-to-say-thank-you-in-chinese/", "/learn/restaurant/", "/thank-you/"];
  for (const p of paths) {
    const r = await get(p);
    out[p] = r.err ? { err: r.err } : { status: r.status, len: r.body.length, ct: r.headers["content-type"] };
  }
  const home = await get("/");
  if (!home.err) {
    const h = home.body;
    const pick = (re) => { const m = h.match(re); return m ? m[1] : null; };
    out._home = {
      title: pick(/<title>([^<]*)<\/title>/),
      descLen: (pick(/<meta name="description" content="([^"]*)"/) || "").length,
      canonical: pick(/<link rel="canonical" href="([^"]*)"/),
      ogImage: pick(/<meta property="og:image" content="([^"]*)"/),
      jsonldCount: (h.match(/application\/ld\+json/g) || []).length,
      h1: pick(/<h1[^>]*>([\s\S]*?)<\/h1>/),
      imgCount: (h.match(/<img\b/g) || []).length,
    };
  }
  fs.writeFileSync("_dev/live.txt", JSON.stringify(out, null, 1), "utf8");
})();
