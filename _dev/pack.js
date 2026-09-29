const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const root = "out";
const zip = "deploy-chinesequick.zip";
if (fs.existsSync(zip)) fs.renameSync(zip, `${zip}.prev-${Date.now()}`);

// ---- 生成 SW 的预缓存清单 out/sw-precache.json ----
// 为什么必须在 pack 阶段（build 之后）生成：_next/static 里的 chunk 文件名带内容哈希，
// 只有构建完才知道最终名字；而 public/ 里的文件是构建前就拷好的，写不进这份清单。
// SW 读它来决定「装好之后后台抓什么」—— 清单错了不会报错，只会静默漏缓存，
// 所以这里把条目数写进 _dev/pack.txt 供人眼核对。
function walk(dir, exts) {
  const out = [];
  (function rec(d) {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) rec(p);
      else if (exts.some((x) => e.name.endsWith(x))) out.push(p);
    }
  })(dir);
  return out;
}

const toUrl = (p) => "/" + p.split(path.sep).join("/").replace(/^out\//, "");

const audio = walk(path.join(root, "audio"), [".mp3"]).map(toUrl);
const assets = walk(path.join(root, "_next", "static"), [".js", ".css"]).map(toUrl);

// 关键入口页：离线时最可能被点开的那些。短语页太多（105），交给「访问过才缓存」，
// 没访问过的由 SW 回落到 /offline/ 页说明情况。
const pageDirs = fs
  .readdirSync(root, { withFileTypes: true })
  .filter((e) => e.isDirectory() && /^chinese-.*-phrases$/.test(e.name))
  .map((e) => `/${e.name}/`);
const scenarioDirs = fs
  .existsSync(path.join(root, "scenarios"))
  ? fs
      .readdirSync(path.join(root, "scenarios"), { withFileTypes: true })
      .filter((e) => e.isDirectory())
      .map((e) => `/scenarios/${e.name}/`)
  : [];
const pages = [
  "/",
  "/offline/",
  "/china-travel-checklist/",
  "/chinese-numbers/",
  "/scenarios/",
  // 行程卡是「断了网才最需要」的页 —— 必须进预缓存
  "/emergency-card/",
  "/address-card/",
  // 7 天课：装成 App 后整个课程离线可学（音频本来就在预缓存里）
  "/7-day-chinese-course/",
  ...scenarioDirs,
  ...pageDirs,
  "/saved/",
  "/about/",
];

const precache = { audio, assets, pages };
fs.writeFileSync(path.join(root, "sw-precache.json"), JSON.stringify(precache), "utf8");

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
      precache: {
        audio: audio.length,
        assets: assets.length,
        pages: pages.length,
      },
      stderr: (res.stderr || "").slice(0, 500),
    },
    null,
    1
  ),
  "utf8"
);
