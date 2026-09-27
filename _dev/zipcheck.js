/**
 * 校验 Cloudflare Pages 上传包的结构（铁律：只数条目等于没校验）。
 * 解析 zip 中央目录，检出：反斜杠分隔符 / ./ 前缀 / 绝对路径 / 多余顶层目录 / 关键条目缺失。
 * 用法：node _dev/zipcheck.js [zip路径]
 */
const fs = require("fs");
const path = require("path");

const zipPath = process.argv[2] || "deploy-chinesequick.zip";
const buf = fs.readFileSync(zipPath);

// 从尾部找 EOCD (0x06054b50)
let eocd = -1;
for (let i = buf.length - 22; i >= 0 && i > buf.length - 66000; i--) {
  if (buf.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
}
if (eocd === -1) { console.log("FAIL: 找不到 EOCD，不是合法 zip"); process.exit(1); }

const total = buf.readUInt16LE(eocd + 10);
let off = buf.readUInt32LE(eocd + 16);

const names = [];
for (let i = 0; i < total; i++) {
  if (buf.readUInt32LE(off) !== 0x02014b50) { console.log("FAIL: 中央目录签名错误 @", off); process.exit(1); }
  const nameLen = buf.readUInt16LE(off + 28);
  const extraLen = buf.readUInt16LE(off + 30);
  const commentLen = buf.readUInt16LE(off + 32);
  names.push(buf.toString("utf8", off + 46, off + 46 + nameLen));
  off += 46 + nameLen + extraLen + commentLen;
}

const backslash = names.filter((n) => n.includes("\\"));
const dotSlash = names.filter((n) => n.startsWith("./"));
const absolute = names.filter((n) => /^([A-Za-z]:|\/)/.test(n));
const topLevels = [...new Set(names.map((n) => n.split("/")[0]))];

const required = ["index.html", "404.html", "robots.txt", "sitemap.xml", "llms.txt",
  "sw.js", "manifest.webmanifest", "about/index.html", "thank-you/index.html",
  "learn/restaurant/index.html", "og.png"];
const missing = required.filter((r) => !names.includes(r));

const badNested = topLevels.filter((t) => ["out", "dist", "build", "public", "_dev"].includes(t));

// 音频条目数必须与磁盘上的 out/audio 对得上。
// 为什么专门查这个：包体从 4.8 MB 掉到几百 KB 时，条目数是唯一一眼能看出问题的信号，
// 而包头的大小/条目数都可能被陈旧文件误导（2026-09-27 我差点据此误判音频全丢了 ——
// 真正的原因是 _dev/zipcheck.txt 是旧残留，本脚本以前只往 stdout 打印）。
const audioNames = names.filter((n) => /\.mp3$/i.test(n));
let audioOnDisk = 0;
for (const dir of ["audio"]) {
  const abs = path.join("out", dir);
  if (!fs.existsSync(abs)) continue;
  const walk = (d) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p);
      else if (/\.mp3$/i.test(e.name)) audioOnDisk += 1;
    }
  };
  walk(abs);
}

const lines = [
  `zip        : ${zipPath}`,
  `大小       : ${(buf.length / 1024).toFixed(0)} KB`,
  `条目数     : ${names.length}`,
  `顶层项     : ${topLevels.length} 个 — ${topLevels.slice(0, 8).join(", ") + (topLevels.length > 8 ? " …" : "")}`,
  `反斜杠分隔 : ${backslash.length} ${backslash.slice(0, 3).join(", ")}`,
  `./ 前缀    : ${dotSlash.length}`,
  `绝对路径   : ${absolute.length}`,
  `多余嵌套   : ${badNested.length} ${badNested.join(", ")}`,
  `缺失关键项 : ${missing.length} ${missing.join(", ")}`,
  `mp3 条目   : ${audioNames.length}（磁盘 out/audio 上 ${audioOnDisk}）`,
  `404.html   : ${names.includes("404.html") ? "有" : "无（CF 会用默认）"}`,
];

const ok =
  !backslash.length &&
  !dotSlash.length &&
  !absolute.length &&
  !badNested.length &&
  !missing.length &&
  audioNames.length > 0 &&
  audioNames.length === audioOnDisk;

lines.push(ok ? "\nPASS: 包结构正确" : "\nFAIL: 包结构有问题，别上传");
console.log(lines.join("\n"));
// 同时落盘：以前只打印到 stdout，残留的 zipcheck.txt 会一直显示上一次的结果，
// 而它看起来完全像一份有效报告（踩过）。
fs.writeFileSync("_dev/zipcheck.txt", lines.join("\n") + "\n", "utf8");
process.exit(ok ? 0 : 1);
