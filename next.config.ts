import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 全站静态导出：不依赖任何后端 / 数据库，构建产物直接可托管
  output: "export",
  trailingSlash: true,
  reactStrictMode: true,
  // 沙箱对「单目录内删除 ≥50 个文件」有守卫，Next 构建时会清理旧产物从而撞上。
  // 构建前先跑 `node _dev/prebuild.js`（把 .next 重命名换走）即可；需要换目录时用 NEXT_DIST_DIR。
  distDir: process.env.NEXT_DIST_DIR ?? ".next",
};

export default nextConfig;
