/**
 * 线上 GA 注入核验：确认线上每个 URL 的 HTML 里真的带上了衡量 ID。
 * 用法：node _dev/check-ga-live.js <域名...>
 */
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const envPath = path.join(root, ".env.local");
const id = (fs.readFileSync(envPath, "utf8").match(/^NEXT_PUBLIC_GA_ID=(.+)$/m) || [])[1];
if (!id) { console.log("FAIL: .env.local 里没有 NEXT_PUBLIC_GA_ID"); process.exit(1); }

const hosts = process.argv.slice(2);
if (!hosts.length) hosts.push("https://chinesequick.com");

const PATHS = [
  "/",
  "/about/",
  "/learn/restaurant/",
  "/how-to-say-thank-you-in-chinese/",
  "/chinese-restaurant-phrases/",
  "/thank-you/",
];

const get = async (url) => {
  for (let i = 0; i < 4; i++) {
    try {
      const r = await fetch(url, { redirect: "follow" });
      return { status: r.status, text: await r.text() };
    } catch { /* 国内出口间歇性失败，重试 */ }
  }
  return null;
};

(async () => {
  console.log("衡量 ID :", id);
  for (const host of hosts) {
    console.log("\n=== " + host + " ===");
    let pass = 0, fail = 0;
    for (const p of PATHS) {
      const r = await get(host + p);
      if (!r) { console.log("  " + p.padEnd(38) + " NET-FAIL"); fail++; continue; }
      const hasId = r.text.includes(id);
      const hasSrc = r.text.includes("googletagmanager.com/gtag/js?id=" + id);
      const ok = hasId && hasSrc;
      ok ? pass++ : fail++;
      console.log("  " + p.padEnd(38) + " " + r.status + "  " + (ok ? "GA-OK" : "GA-MISSING"));
    }
    console.log("  小计: " + pass + " 通过 / " + fail + " 待上线");
  }
})();
