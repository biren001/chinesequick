/**
 * 构建版本号 —— 全站唯一来源。
 *
 * 目的：让「我现在看到的这一份是不是最新版」能被**一眼确认**，不用比对文件 hash、
 * 不用等线上核验脚本。三个落点，各自服务一种确认方式：
 *   ① 首页可见文案（hero 下方小字）  → 肉眼，打开首页就看见
 *   ② 页脚可见文案（带 git 短 sha）  → 肉眼 + 精确核对
 *   ③ <html data-build="…">          → 脚本断言（live-version-check.js 拿它比对线上）
 *
 * 值由 next.config.ts 在**构建时**注入 NEXT_PUBLIC_BUILD_*（不是运行时），所以静态
 * 导出的每一页都带着同一份值；没注入时（例如直接 dev 起）退化成 "dev"，不让页面崩。
 */

export const BUILD_SHA: string = process.env.NEXT_PUBLIC_BUILD_SHA || "dev";

/** YYYY-MM-DD，构建当天（本地时区）。 */
export const BUILD_DATE: string = process.env.NEXT_PUBLIC_BUILD_DATE || "";

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

/**
 * "2026-09-28" → "28 Sep 2026"。
 * 手工切字符串而不是 new Date(str)：后者会按时区再解析一遍，可能把日期挪一天
 * （"2026-09-28" 被当成 UTC 午夜，东八区之外读出来是 27 号）。
 */
export function buildDateLabel(date: string = BUILD_DATE): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!m) return "";
  const month = MONTHS[Number(m[2]) - 1];
  return month ? `${Number(m[3])} ${month} ${m[1]}` : date;
}

/** 机器可读的一行版本号，例：`2026.09.28·93a9edf`。给脚本和人工比对用。 */
export function buildId(): string {
  return BUILD_DATE ? `${BUILD_DATE.replace(/-/g, ".")}·${BUILD_SHA}` : BUILD_SHA;
}
