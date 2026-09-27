const https = require("https");
const fs = require("fs");

const doh = (name, type) =>
  new Promise((resolve) => {
    const url = `https://cloudflare-dns.com/dns-query?name=${name}&type=${type}`;
    https
      .get(url, { headers: { accept: "application/dns-json" } }, (r) => {
        let d = "";
        r.on("data", (c) => (d += c));
        r.on("end", () => {
          try {
            resolve(JSON.parse(d));
          } catch {
            resolve({ raw: d.slice(0, 200) });
          }
        });
      })
      .on("error", (e) => resolve({ error: e.message }));
  });

(async () => {
  const out = {};
  out.ns = await doh("chinesequick.com", "NS");
  out.a = await doh("chinesequick.com", "A");
  out.www = await doh("www.chinesequick.com", "CNAME");
  fs.writeFileSync("_dev/doh.txt", JSON.stringify(out, null, 1), "utf8");
})();
