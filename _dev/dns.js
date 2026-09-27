const dns = require("dns");
const fs = require("fs");

function p(label, name, type) {
  return new Promise((resolve) => {
    dns.resolve(name, type, (err, val) => {
      resolve(label + ": " + (err ? "ERR " + (err.code || err.message) : JSON.stringify(val).slice(0, 400)));
    });
  });
}

(async () => {
  const lines = [];
  lines.push("servers: " + JSON.stringify(dns.getServers()));
  lines.push(await p("NS", "chinesequick.com", "NS"));
  lines.push(await p("A", "chinesequick.com", "A"));
  lines.push(await p("TXT", "chinesequick.com", "TXT"));
  fs.writeFileSync("_dev/dns.txt", lines.join("\n"), "utf8");
})();
