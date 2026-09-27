const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const root = "out";
const zip = "deploy-chinesequick.zip";
if (fs.existsSync(zip)) fs.renameSync(zip, `${zip}.prev-${Date.now()}`);

// 显式列出顶层条目，不使用 "."（会产生 ./ 前缀）
const entries = fs.readdirSync(root);
// 排除上一次打包残留
const list = entries.filter((e) => !e.startsWith("deploy-"));

const tar = process.env.SystemRoot + "\\System32\\tar.exe";
const res = spawnSync(tar, ["-a", "-cf", zip, "-C", root, ...list], {
  encoding: "utf8",
  shell: false,
});

fs.writeFileSync(
  "_dev/pack.txt",
  JSON.stringify(
    {
      exit: res.status,
      size: fs.existsSync(zip) ? fs.statSync(zip).size : 0,
      count: list.length,
      stderr: (res.stderr || "").slice(0, 500),
    },
    null,
    1
  ),
  "utf8"
);
