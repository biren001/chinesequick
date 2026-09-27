/**
 * 用 node https 抓 sitemap 并核对（curl 在本机对 chinesequick.com 偶发 SSL connect error，
 * 但同一路径批量检查时是 200，属 TLS 抖动；node https 更稳）。
 *
 * 用法：node _dev/sm-check.js [域名]
 */
const https = require("https");

const base = require("./baseurl").normalizeBase(process.argv[2], "https://chinesequick.com");

function get(url) {
  return new Promise((resolve) => {
    https
      .get(url, (r) => {
        let d = "";
        r.on("data", (c) => (d += c));
        r.on("end", () => resolve({ status: r.statusCode, body: d }));
      })
      .on("error", (e) => resolve({ status: "ERR", body: e.message }));
  });
}

(async () => {
  const r = await get(base + "/sitemap.xml");
  const locs = r.body.match(/<loc>/g) || [];
  console.log("sitemap status:", r.status, "bytes:", r.body.length);
  console.log("urls:", locs.length);
  console.log("has /china-travel-checklist/:", r.body.includes("/china-travel-checklist/"));
  console.log("has /chinese-numbers/:", r.body.includes("/chinese-numbers/"));
  console.log("no dead domain (real-life-chinese.com):", !r.body.includes("real-life-chinese.com"));
  console.log("http locs (应为 0，全部 https):", (r.body.match(/<loc>http:\/\//g) || []).length);

  const robots = await get(base + "/robots.txt");
  console.log("\nrobots status:", robots.status);
  console.log(robots.body.trim().split("\n").slice(0, 8).join("\n"));
})();
