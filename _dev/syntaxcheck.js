/**
 * _dev 下所有脚本的语法体检（不执行，只解析）。
 *
 * 为什么需要：这些脚本是纯 JS、没有测试覆盖，改错一个括号要等到运行时才炸，
 * 而运行时往往要等几分钟 Chrome 起来。先花一秒 parse 一遍，把这类错挡在前面。
 *
 * 用法：node _dev/syntaxcheck.js
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const dir = __dirname;
const files = fs
  .readdirSync(dir)
  .filter((f) => f.endsWith('.js'))
  .sort();

const bad = [];
for (const f of files) {
  const src = fs.readFileSync(path.join(dir, f), 'utf8');
  try {
    // 只解析不执行：CommonJS 顶层不会有 await，vm.Script 足够。
    new vm.Script(src, { filename: f });
  } catch (e) {
    bad.push({ file: f, error: e.message });
  }
}

console.log(`检查 ${files.length} 个脚本，语法错误 ${bad.length} 个`);
for (const b of bad) console.log(`  ✗ ${b.file}: ${b.error}`);
process.exit(bad.length ? 1 : 0);
