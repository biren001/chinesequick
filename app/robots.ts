import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

export const dynamic = "force-static";

/**
 * AI 爬虫按「角色」显式声明，而不是只写一个 `User-agent: *`。
 * 理由：多数检测工具按「最具体 UA 组优先」判定，只写 `*` 会让每一项显示成"未声明"。
 *
 * 这个站的内容是要被引用、传播的，所以检索型和训练型都放行。
 * 想改成「禁止 AI 训练」的话：把 TRAINING 那段整体挪进下面的头部常量即可（注释里有示例）。
 */

/** 检索型：它们在实时回答里替用户找资料，被挡 = 在 AI 答案里彻底消失。 */
const RETRIEVAL = [
  "Googlebot",
  "Bingbot",
  "DuckDuckBot",
  "Applebot",
  "OAI-SearchBot",
  "ChatGPT-User",
  "Claude-SearchBot",
  "Claude-User",
  "PerplexityBot",
  "Amazonbot",
  "meta-externalfetcher",
];

/** 训练型：决定模型的「记忆」里有没有这个站，不影响上面的实时引用。 */
const TRAINING = [
  "GPTBot",
  "ClaudeBot",
  "CCBot",
  "Google-Extended",
  "Applebot-Extended",
  "meta-externalagent",
  "Bytespider",
];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: RETRIEVAL, allow: "/" },
      { userAgent: TRAINING, allow: "/" },
      { userAgent: "*", allow: "/" },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
