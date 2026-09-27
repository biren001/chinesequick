const https = require("https");
const fs = require("fs");
const base = "https://real-life-chinese.app.workbuddy.host";
const paths = ["/thank-you/", "/", "/learn/restaurant/"];
(async () => {
  const out = [];
  for (const p of paths) {
    const body = await new Promise((res) => {
      https
        .get(base + p, (r) => {
          let d = "";
          r.on("data", (c) => (d += c));
          r.on("end", () => res("status=" + r.statusCode + " " + d));
        })
        .on("error", () => res("status=ERR "));
    });
    out.push(
      p +
        " :: " +
        body.slice(0, 12) +
        " :: continue=" +
        body.includes("Continue learning") +
        " :: noindex=" +
        body.includes("noindex")
    );
  }
  fs.writeFileSync("_dev/probe.txt", out.join("\n"), "utf8");
})();
