import { execSync } from "node:child_process";
import type { NextConfig } from "next";

/**
 * 构建版本号 —— 解决「线上到底是新版还是旧版」只能靠猜的问题。
 *
 * 为什么必须有：每次发版后，浏览器缓存 / CDN / 抓包都会让人分不清看到的是哪一份，
 * 而 Next 自己那套构建 ID（HTML 注释里的 `<!--xxxxx-->`）是一串无意义的随机字符，
 * 且被算进「用户看不到的字节」，不能拿来做人工核对（见 live-version-check.js 的 visibleText）。
 *
 * 做法：构建时把 git 短 sha + 构建日期注入 NEXT_PUBLIC_* → 页面 SSR 出可见文案 +
 * <html data-build="…">，肉眼一眼可辨、脚本一句可断言。
 * ⚠ 用 try/catch 兜底：没有 git（例如只拷了源码）时构建不能挂，退化成 "dev"。
 */
function buildSha(): string {
  try {
    return execSync("git rev-parse --short HEAD", { stdio: ["ignore", "pipe", "ignore"] }).toString().trim();
  } catch {
    return "dev";
  }
}

/** 用本地日期而不是 toISOString()：后者是 UTC，凌晨 0–8 点会把日期算成前一天。 */
function buildDate(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

const nextConfig: NextConfig = {
  // 全站静态导出：不依赖任何后端 / 数据库，构建产物直接可托管
  output: "export",
  trailingSlash: true,
  reactStrictMode: true,
  // 沙箱对「单目录内删除 ≥50 个文件」有守卫，Next 构建时会清理旧产物从而撞上。
  // 构建前先跑 `node _dev/prebuild.js`（把 .next 重命名换走）即可；需要换目录时用 NEXT_DIST_DIR。
  distDir: process.env.NEXT_DIST_DIR ?? ".next",
  // 版本号注入（见上面 buildSha/buildDate 的说明）。页面里统一从 lib/build.ts 读，
  // 不直接散落 process.env，避免哪天改了变量名却只改了一半。
  env: {
    NEXT_PUBLIC_BUILD_SHA: buildSha(),
    NEXT_PUBLIC_BUILD_DATE: buildDate(),
  },
};

export default nextConfig;
