"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * 「接着上次看」—— 解决手机上最常见的失位问题：
 * 切去微信/接电话太久，系统把浏览器（或 PWA WebView）回收，回来后页面从首页重启，
 * 滚动位置无处恢复。网站救不回滚动位置，但可以记住你上次在哪个页面，
 * 在首页给一张「继续上次」的卡片，一点就回。
 *
 * 两个组件：
 *  - RememberPlace：挂在 layout，每次路由变化把 {path, title} 写进本地（首页本身不记）。
 *  - ResumeCard：挂在首页。读到记录且未被划掉就渲染卡片。
 *
 * 全部挂载后才渲染（SSR 为 null），localStorage 形状不对在读取处挡掉 —— 沿用全站铁律。
 */

const STORAGE_KEY = "rlc-last-place-v1";

interface LastPlace {
  version: 1;
  path: string;
  title: string;
  /** 记录时间（毫秒），仅用于展示"多久之前" */
  ts: number;
  /** 用户划掉了这条记录（同一路径下不再提示，直到他去了新页面） */
  dismissed: boolean;
}

const NEVER: LastPlace | null = null;

/** 这些页面不记也不推荐回去：它们本来就是"中转/终态"页。 */
const SKIP_PATHS = new Set(["/", "/thank-you", "/offline", "/404"]);

function sanitizePlace(value: unknown): LastPlace | null {
  if (!value || typeof value !== "object") return null;
  const v = value as Partial<LastPlace>;
  if (v.version !== 1) return null;
  if (typeof v.path !== "string" || !v.path.startsWith("/")) return null;
  if (typeof v.title !== "string" || !v.title) return null;
  if (typeof v.ts !== "number" || !Number.isFinite(v.ts)) return null;
  return {
    version: 1,
    path: v.path.slice(0, 200),
    title: v.title.slice(0, 140),
    ts: v.ts,
    dismissed: v.dismissed === true,
  };
}

function readPlace(): LastPlace | null {
  if (typeof window === "undefined") return NEVER;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return sanitizePlace(JSON.parse(raw));
  } catch {
    return null;
  }
}

/** 记录标题里的站点后缀去掉，卡片上只显示页面自己的名字。 */
function cleanTitle(title: string): string {
  return title.replace(/\s*\|\s*ChineseQuick\s*$/, "");
}

function whenLabel(ts: number): string {
  const now = new Date();
  const then = new Date(ts);
  const sameDay =
    now.getFullYear() === then.getFullYear() &&
    now.getMonth() === then.getMonth() &&
    now.getDate() === then.getDate();
  if (sameDay) return "earlier today";
  const yesterday = new Date(now.getTime() - 86_400_000);
  const isYesterday =
    yesterday.getFullYear() === then.getFullYear() &&
    yesterday.getMonth() === then.getMonth() &&
    yesterday.getDate() === then.getDate();
  if (isYesterday) return "yesterday";
  return `on ${then.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;
}

export function RememberPlace() {
  const pathname = usePathname();

  useEffect(() => {
    if (!pathname || SKIP_PATHS.has(pathname)) return;
    const next: LastPlace = {
      version: 1,
      path: pathname,
      title: cleanTitle(document.title || pathname),
      ts: Date.now(),
      dismissed: false,
    };
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // 隐私模式写不进去就算了：这个功能本来就是锦上添花
    }
  }, [pathname]);

  return null;
}

export function ResumeCard() {
  const [place, setPlace] = useState<LastPlace | null | undefined>(undefined);

  useEffect(() => {
    setPlace(readPlace());
  }, []);

  // undefined = 还没挂载（SSR 与首帧一致）；null = 没记录或不该显示
  if (!place) return null;
  if (place.dismissed || place.path === "/") return null;

  return (
    <section className="mb-8 rounded-2xl border border-accent bg-accent-soft p-5">
      <p className="text-xs font-medium tracking-wide text-accent uppercase">
        Continue where you left off ({whenLabel(place.ts)})
      </p>
      <p className="mt-1 text-base font-medium text-ink">{cleanTitle(place.title)}</p>
      <div className="mt-3 flex items-center gap-3">
        <Link
          href={place.path}
          className="inline-block flex-1 rounded-xl bg-accent px-5 py-3 text-center text-base font-medium text-white transition hover:opacity-90 active:scale-[0.98]"
        >
          Open that page
        </Link>
        <button
          type="button"
          aria-label="Dismiss this suggestion"
          onClick={() => {
            const next = { ...place, dismissed: true };
            setPlace(next);
            try {
              window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
            } catch {
              // 写不进去就让它在下次访问再出现
            }
          }}
          className="rounded-xl border border-line bg-card px-4 py-3 text-sm text-muted transition hover:border-accent hover:text-accent"
        >
          ✕
        </button>
      </div>
    </section>
  );
}
