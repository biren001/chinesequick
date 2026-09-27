/**
 * 统一解析各验证脚本的 baseUrl 参数。
 *
 * 起因（2026-09-27）：5 个脚本原先都写 `process.argv[2] || '<带协议的默认值>'`，
 * 而项目笔记里记的用法是 `node _dev/check-errors-live.js <域名>`。
 * 于是照文档传裸域名时，`https://` 没被补上，直接进 `Page.navigate` →
 * `Cannot navigate to invalid URL`，脚本 exit 2 并写出一份 `fatal` 结果文件。
 * 看起来像"线上炸了"，其实是参数格式不对 —— 这种假警报最浪费时间。
 *
 * 这里统一容错：裸域名自动补 `https://`，并去掉尾斜杠
 * （trailingSlash:true 站点自己会补，重复拼会出 `//`）。
 * 已经是 http:// 或 https:// 的（包括本地 `http://127.0.0.1:4173`）原样保留。
 */
function normalizeBase(arg, fallback) {
  const raw = String(arg || fallback || "").trim();
  const withProto = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  return withProto.replace(/\/+$/, "");
}

module.exports = { normalizeBase };
