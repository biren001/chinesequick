type EventParams = Record<string, string | number | boolean | undefined>;

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

/**
 * 轻量埋点：配置了 NEXT_PUBLIC_GA_ID 就上报 GA4；
 * 没配置也不影响功能，事件会进 dataLayer（将来接任何工具都不用改业务代码）。
 */
export function track(event: string, params: EventParams = {}): void {
  if (typeof window === "undefined") return;
  try {
    window.gtag?.("event", event, params);
    window.dataLayer?.push({ event, ...params });
  } catch {
    // 埋点失败绝不影响学习体验
  }
}

/** 产品漏斗关注的事件，集中定义避免各处手写字符串。 */
export const EVENTS = {
  pageView: "page_view",
  startLearning: "start_learning",
  categorySelected: "category_selected",
  phraseCompleted: "phrase_completed",
  phraseSaved: "phrase_saved",
  quizStarted: "quiz_started",
  quizCompleted: "quiz_completed",
  quizScore: "quiz_score",
  /** 连续朗读启动（mode = zh / zh-en / repeat） */
  playAllStarted: "play_all_started",
  /** 旅行清单勾选 / 取消 */
  checklistToggled: "checklist_item_toggled",
  /** 旅行清单被全部勾完 */
  checklistCompleted: "checklist_completed",
  feedbackOpen: "feedback_open",
  /** 客户端异常（错误边界捕获）——没有它就无法判断白屏问题的真实发生率 */
  clientError: "client_error",
} as const;
