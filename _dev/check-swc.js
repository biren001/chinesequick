const fs = require("fs");
const path = require("path");
const out = [];
const p = path.join(
  __dirname,
  "..",
  "node_modules",
  "@next",
  "swc-win32-x64-msvc",
  "next-swc.win32-x64-msvc.node"
);
const fd = fs.openSync(p, "r");
const buf = Buffer.alloc(0x400);
fs.readSync(fd, buf, 0, 0x400, 0);
fs.closeSync(fd);

const peOff = buf.readUInt32LE(0x3c);
const machine = buf.readUInt16LE(peOff + 4);
const names = { 332: "i386 32-bit", 34404: "x86-64", 43620: "ARM64", 452: "ARMNT" };
const optMagic = buf.readUInt16LE(peOff + 24);

out.push("peOffset=" + peOff);
out.push("signature=" + buf.toString("latin1", peOff, peOff + 4).replace(/[^A-Za-z0-9]/g, "."));
out.push("machineCode=" + machine + " name=" + (names[machine] || "unknown"));
out.push("optionalMagic=0x" + optMagic.toString(16) + (optMagic === 0x20b ? " PE32plus-64bit" : " PE32-32bit"));
out.push("processArch=" + process.arch + " platform=" + process.platform);
fs.writeFileSync(path.join(__dirname, "check-swc.txt"), out.join("\n"), "utf8");
