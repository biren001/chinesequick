// 导出全部短语的 english 字段，用于人工审查 SERP 标题质量
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const phrases = JSON.parse(fs.readFileSync(path.join(root, 'data', 'phrases.json'), 'utf8'));
const lines = [];
lines.push('TOTAL: ' + phrases.length);
const byCat = {};
for (const p of phrases) (byCat[p.category] = byCat[p.category] || []).push(p);
for (const cat of Object.keys(byCat).sort()) {
  lines.push('');
  lines.push('=== ' + cat + ' (' + byCat[cat].length + ') ===');
  for (const p of byCat[cat]) {
    lines.push(`id=${p.id}\t${p.chinese}\t${p.english}`);
  }
}
fs.writeFileSync(path.join(__dirname, 'english-dump.txt'), lines.join('\n'), 'utf8');
console.log('written', phrases.length);
