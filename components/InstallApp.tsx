"use client";

import { useEffect, useState } from "react";

/** Chromium 的安装事件（lib.dom 里没有，自己声明，避免 any）。 */
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

/**
 * 「把 ChineseQuick 装到手机上」的入口。
 *
 * 为什么要有它：站点已经是 PWA（HTTPS + manifest + Service Worker），
 * 但浏览器只在自己的时机弹一次安装条，多数人根本没看见就划掉了。
 * 装成 App 的实际好处就一条 —— 主屏幕有图标、全屏打开、**断网照用**，
 * 对「到了中国才发现没网」这个场景是刚需。
 *
 * 三条平台分支：
 *  - Chromium（Android / 桌面）：有 beforeinstallprompt → 拦下默认横幅，改成我们自己的按钮。
 *  - iOS Safari：没有这个事件，只能教用户走「分享 → 添加到主屏幕」。
 *  - 已经装好了（standalone 或 navigator.standalone）：什么都不显示。
 *
 * 初始渲染一律不显示（SSR 与首帧保持一致），装完/不支持则由 effect 决定 → 不会有 hydration 警告。
 */
type Mode = "hidden" | "install" | "ios";

export default function InstallApp() {
  const [mode, setMode] = useState<Mode>("hidden");
  const [prompt, setPrompt] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    // 已经以 App 形式运行 → 没必要再提示
    const standalone =
      window.matchMedia?.("(display-mode: standalone)").matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true;
    if (standalone) return;

    const onPrompt = (e: Event) => {
      e.preventDefault(); // 拦掉浏览器那一次性横幅，改由我们的按钮触发
      setPrompt(e as BeforeInstallPromptEvent);
      setMode("install");
    };
    window.addEventListener("beforeinstallprompt", onPrompt);

    // iOS：没有 beforeinstallprompt，给一段手动指引
    const isIOS =
      /iphone|ipad|ipod/i.test(navigator.userAgent) ||
      (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    if (isIOS) setMode("ios");

    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  if (mode === "hidden") return null;

  if (mode === "ios") {
    return (
      <p className="mt-3 text-xs text-muted">
        Use this offline: tap <span aria-hidden="true">Share</span>
        <span className="sr-only">Share</span> then <strong className="font-medium">Add to Home Screen</strong>.
      </p>
    );
  }

  return (
    <button
      type="button"
      className="mt-3 rounded-full border border-line px-4 py-2 text-xs font-medium text-ink transition hover:border-accent hover:text-accent"
      onClick={async () => {
        if (!prompt) return;
        await prompt.prompt();
        const { outcome } = await prompt.userChoice;
        if (outcome === "accepted") setMode("hidden");
        setPrompt(null);
      }}
    >
      Install app
    </button>
  );
}
