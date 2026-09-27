"use client";

import { useEffect } from "react";
import Link from "next/link";
import { EVENTS, track } from "@/lib/analytics";

/**
 * 路由级错误边界。
 *
 * 为什么必须有：静态导出 + PWA 的站点上一旦发生客户端异常，Next 会渲染它内置的默认报错页
 * （"Application error: a client-side exception has occurred"）——用户看到的就是**整整一页白屏 + 一行小字**，
 * 没有任何出路，只能手动刷新甚至以为站点坏了。
 *
 * 真实触发源通常不在我们自己的代码里（已实测排除，见 _dev/repro-client-error.js）：
 * 浏览器自动翻译、扩展脚本会在 React 之外改写 DOM，React 在 commit 阶段找不到锚点节点，
 * 于是抛 NotFoundError → 白屏。这类改写我们控制不了，但可以让异常**不再等于白屏**。
 *
 * 这里只做三件事：说清楚发生了什么、给一键恢复、把发生次数上报（否则永远不知道真实发生率）。
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    track(EVENTS.clientError, {
      digest: error.digest ?? "",
      name: error.name,
      message: (error.message || "").slice(0, 150),
    });
  }, [error]);

  return (
    <main
      data-error-boundary
      className="mx-auto flex min-h-dvh w-full max-w-[440px] flex-col justify-center gap-3 px-5 py-10"
    >
      <p className="text-sm font-medium text-accent">Something went wrong</p>
      <h1 className="text-2xl leading-snug font-medium text-ink">
        This page stopped working.
      </h1>
      <p className="text-sm text-muted">
        It is almost always a browser extension or the browser&rsquo;s auto-translate rewriting the
        page while it loads — not your data. Nothing you saved was lost: your phrases and progress
        stay on this device.
      </p>

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="inline-flex items-center rounded-xl bg-accent px-5 py-3 text-base font-medium text-white transition hover:opacity-90 active:scale-[0.98]"
        >
          Reload the page
        </button>
        <button
          type="button"
          onClick={reset}
          className="inline-flex items-center rounded-xl border border-line bg-card px-4 py-3 text-base font-medium text-ink transition hover:border-accent hover:text-accent active:scale-[0.98]"
        >
          Try again
        </button>
      </div>

      <p className="mt-2 text-sm text-muted">
        Still stuck?{" "}
        <Link className="underline underline-offset-4 hover:text-ink" href="/">
          Go back to all phrases
        </Link>
        .
      </p>

      <details className="mt-4 text-xs text-muted">
        <summary className="cursor-pointer">Technical details</summary>
        <p className="mt-2 break-words">
          {error.name}: {(error.message || "").slice(0, 200)}
          {error.digest ? ` (digest ${error.digest})` : ""}
        </p>
      </details>
    </main>
  );
}
