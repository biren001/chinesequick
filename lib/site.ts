/**
 * 部署域名。兜底值与正式域名保持一致 —— 一旦这里写成一个我们不拥有的域名，
 * 而 NEXT_PUBLIC_SITE_URL 又缺失（换机器 / CI / 别人 clone），
 * 全站 canonical、sitemap、OG 会集体指向别人的站，属于事故级隐患。
 */
export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://chinesequick.com";

/** 品牌名：与域名 chinesequick.com 保持一致，Google 的站名系统最认这种一致。 */
export const SITE_NAME = "ChineseQuick";

/**
 * 备用名称，顺序即优先级。
 * Google 官方文档（site-names）给的排查手段：如果系统对首选名称"不太有把握"，
 * 它会**回退显示域名**。此时把备选名（尤其是全小写的域名）放进 alternateName，
 * 系统会重点考虑这里，而不是硬塞一个域名给用户看。
 */
export const SITE_ALTERNATE_NAMES = [
  "Chinese Quick",
  "chinesequick.com",
  "Real-Life Chinese",
];

/**
 * 品牌标语：站点定位是「到中国生活旅游的助手」，而不是单纯的语言课。
 * 用户不是为了学中文才学中文 —— 是为了点菜、打车、看病。
 */
export const SITE_TAGLINE = "Get by in China — real phrases, audio and trip prep.";

/**
 * 全站 meta description。
 * 定位用助手口吻说，但**保留 learn Chinese / phrases 这类搜索词**：
 * 流量入口仍然来自 "how to say X in Chinese"、"Chinese phrases for restaurant"。
 */
export const SITE_DESCRIPTION =
  "Learn the Mandarin you'll use in China: restaurant, taxi, hotel and emergency phrases with pinyin and audio, plus a pre-trip checklist. Free, no sign-up.";

/**
 * 用户反馈入口。二选一即可，都没配则页面上不显示反馈链接：
 *  - NEXT_PUBLIC_FEEDBACK_URL：第三方表单链接（推荐，如 https://tally.so/r/xxxxxx）
 *  - NEXT_PUBLIC_FEEDBACK_EMAIL：会自动拼成带预填主题/正文的 mailto
 */
const FEEDBACK_SUBJECT = `Feedback on ${SITE_NAME}`;
const FEEDBACK_BODY = [
  "What were you trying to do?",
  "",
  "What was confusing or missing?",
  "",
  "(optional) Could I reply to you? Leave your email here:",
].join("\n");

export const FEEDBACK_URL: string | null = (() => {
  const url = process.env.NEXT_PUBLIC_FEEDBACK_URL?.trim();
  if (url) return url;
  const email = process.env.NEXT_PUBLIC_FEEDBACK_EMAIL?.trim();
  if (email) {
    const query = new URLSearchParams({
      subject: FEEDBACK_SUBJECT,
      body: FEEDBACK_BODY,
    });
    return `mailto:${email}?${query.toString()}`;
  }
  return null;
})();
