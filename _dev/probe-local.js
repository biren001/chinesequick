const fs = require("fs");
const s = fs.readFileSync("out/sitemap.xml", "utf8");
const r = fs.readFileSync("out/robots.txt", "utf8");
const h = fs.readFileSync("out/index.html", "utf8");
const out = {
  sitemapUrls: (s.match(/<loc>/g) || []).length,
  newDomain: (s.match(/chinesequick\.com/g) || []).length,
  oldDomainGone: !s.includes("workbuddy") && !s.includes("real-life-chinese.com"),
  ogInHome: h.includes("chinesequick.com"),
  robots: r.trim(),
  sitemapHead: s.slice(0, 200),
};
fs.writeFileSync("_dev/probe.txt", JSON.stringify(out, null, 1), "utf8");
