"use client";

import { useEffect, useState } from "react";

/**
 * 全站悬浮控件：字号放大 + 回到顶部/底部。
 *
 * 字号：改 <html> 的根字号（Tailwind 全站用 rem，根字号一放大所有文字跟着放大）。
 * 选择持久化到 localStorage（rlc-fontscale-v1）；首屏绘制前的类挂载由 layout 里的
 * 内联脚本负责（防闪烁），本组件只在用户点击时再写一次。
 * 读取侧消毒照 progress.ts 铁律：不在白名单里的值一律当默认。
 *
 * 顶部/底部按钮：滚动超过一屏才出现，页面不长时不占地方。
 * 打印时全部隐藏（print:hidden）。
 */

const SIZES = ["100", "115", "130"] as const;
type Size = (typeof SIZES)[number];
const KEY = "rlc-fontscale-v1";

const SIZE_LABELS: { value: Size; label: string; className: string; aria: string }[] = [
  { value: "100", label: "A", className: "text-xs", aria: "Text size: normal" },
  { value: "115", label: "A+", className: "text-sm", aria: "Text size: larger" },
  { value: "130", label: "A++", className: "text-base", aria: "Text size: largest" },
];

function isSize(v: unknown): v is Size {
  return typeof v === "string" && (SIZES as readonly string[]).includes(v);
}

function loadSize(): Size {
  try {
    const v = localStorage.getItem(KEY);
    return isSize(v) ? v : "100";
  } catch {
    return "100";
  }
}

function applySize(s: Size) {
  const el = document.documentElement;
  el.classList.remove("fs-115", "fs-130");
  if (s !== "100") el.classList.add(`fs-${s}`);
}

function smoothScroll(top: number) {
  const reduce =
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  window.scrollTo({ top, behavior: reduce ? "auto" : "smooth" });
}

export default function SiteControls() {
  const [size, setSize] = useState<Size>("100");
  const [showTop, setShowTop] = useState(false);
  const [showBottom, setShowBottom] = useState(false);

  useEffect(() => {
    const saved = loadSize();
    setSize(saved);
  }, []);

  useEffect(() => {
    const onScroll = () => {
      const y = window.scrollY;
      const doc = document.documentElement;
      const max = doc.scrollHeight - window.innerHeight;
      setShowTop(y > 600);
      setShowBottom(y > 200 && y < max - 600);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);

  const pick = (s: Size) => {
    setSize(s);
    applySize(s);
    try {
      localStorage.setItem(KEY, s);
    } catch {
      /* 存不进去就不存，本次会话内仍然生效 */
    }
  };

  const btn =
    "flex h-10 w-10 items-center justify-center rounded-full border border-line bg-card text-ink shadow-sm transition hover:bg-accent-soft active:scale-95";

  return (
    <div
      className="fixed bottom-4 right-3 z-40 flex flex-col items-center gap-2 print:hidden"
      aria-label="Page controls"
      role="group"
    >
      {/* 字号：正常 / 大 / 特大 */}
      <div className="flex overflow-hidden rounded-full border border-line bg-card shadow-sm">
        {SIZE_LABELS.map((s) => (
          <button
            key={s.value}
            type="button"
            aria-label={s.aria}
            aria-pressed={size === s.value}
            onClick={() => pick(s.value)}
            className={`${s.className} h-9 w-9 font-medium transition ${
              size === s.value ? "bg-accent text-white" : "text-ink hover:bg-accent-soft"
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      {showTop && (
        <button
          type="button"
          aria-label="Back to top"
          className={btn}
          onClick={() => smoothScroll(0)}
        >
          <span aria-hidden="true" className="text-lg leading-none">
            ↑
          </span>
        </button>
      )}

      {showBottom && (
        <button
          type="button"
          aria-label="Go to bottom"
          className={btn}
          onClick={() =>
            smoothScroll(document.documentElement.scrollHeight - window.innerHeight)
          }
        >
          <span aria-hidden="true" className="text-lg leading-none">
            ↓
          </span>
        </button>
      )}
    </div>
  );
}
