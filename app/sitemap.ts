import type { MetadataRoute } from "next";
import { CATEGORIES } from "@/lib/categories";
import { SCENARIOS } from "@/lib/scenarios";
import { phrasePath, getAllPhraseSlugs } from "@/lib/slug";
import { SITE_URL } from "@/lib/site";

export const dynamic = "force-static";

/**
 * 所有 URL 统一带尾斜杠 —— 站点配置了 trailingSlash:true，
 * 任何 `/xxx` 都会被 308 到 `/xxx/`。sitemap 直接给出终态 URL，避免让爬虫每次多跳一次。
 */
function loc(path: string): string {
  const clean = path.startsWith("/") ? path : `/${path}`;
  return `${SITE_URL}${clean.endsWith("/") ? clean : `${clean}/`}`;
}

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();

  const routes: { url: string; priority: number; changeFrequency: "weekly" | "monthly" | "yearly" }[] = [
    { url: "/", priority: 1, changeFrequency: "weekly" },
    { url: "/china-travel-checklist", priority: 0.9, changeFrequency: "monthly" },
    { url: "/chinese-numbers", priority: 0.9, changeFrequency: "monthly" },
    { url: "/scenarios", priority: 0.9, changeFrequency: "monthly" },
    { url: "/7-day-chinese-course", priority: 0.9, changeFrequency: "monthly" },
    { url: "/emergency-card", priority: 0.8, changeFrequency: "monthly" },
    { url: "/address-card", priority: 0.8, changeFrequency: "monthly" },
    { url: "/getting-online-in-china", priority: 0.8, changeFrequency: "monthly" },
    ...SCENARIOS.map((s) => ({
      url: `/scenarios/${s.slug}`,
      priority: 0.8,
      changeFrequency: "monthly" as const,
    })),
    { url: "/about", priority: 0.5, changeFrequency: "monthly" },
    { url: "/contact", priority: 0.4, changeFrequency: "yearly" },
    { url: "/privacy", priority: 0.3, changeFrequency: "yearly" },
    { url: "/terms", priority: 0.3, changeFrequency: "yearly" },
    ...CATEGORIES.map((c) => ({
      url: `/${c.seoSlug}`,
      priority: 0.9,
      changeFrequency: "monthly" as const,
    })),
    ...CATEGORIES.map((c) => ({
      url: `/learn/${c.id}`,
      priority: 0.8,
      changeFrequency: "monthly" as const,
    })),
    ...getAllPhraseSlugs().map((slug) => ({
      url: phrasePath(slug),
      priority: 0.6,
      changeFrequency: "monthly" as const,
    })),
  ];

  return routes.map((r) => ({ ...r, url: loc(r.url), lastModified }));
}
