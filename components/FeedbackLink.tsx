"use client";

import Link from "next/link";
import { EVENTS, track } from "@/lib/analytics";
import { FEEDBACK_URL } from "@/lib/site";

/**
 * 全站统一的反馈入口：没配置 FEEDBACK_URL 就不渲染，避免出现死链。
 * 只在页脚出现，不打扰学习流程。
 * 同标签跳转（不开新标签）：表单提交后会重定向到 /thank-you，
 * 用户必须留在同一个标签里，"Continue learning" 才成立。
 */
export default function FeedbackLink({
  variant = "footer",
}: {
  variant?: "footer" | "inline";
}) {
  if (!FEEDBACK_URL) return null;

  const common =
    "inline-flex items-center gap-1.5 rounded-full text-sm text-muted underline-offset-4 transition hover:text-accent hover:underline";

  return (
    <Link
      href={FEEDBACK_URL}
      onClick={() => track(EVENTS.feedbackOpen)}
      className={
        variant === "inline"
          ? common
          : `${common} border border-line bg-card px-4 py-2`
      }
    >
      <span aria-hidden="true">💬</span>
      Feedback
    </Link>
  );
}
