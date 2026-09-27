import type { Metadata } from "next";
import { notFound } from "next/navigation";
import PhraseView, { cleanEnglish } from "@/components/PhraseView";
import SeoCategoryView from "@/components/SeoCategoryView";
import { CATEGORIES } from "@/lib/categories";
import { getPhrasesByCategory, pinyinInline } from "@/lib/phrases";
import { urlOf } from "@/lib/jsonld";
import { getAllPhraseSlugs, getPhraseBySlug } from "@/lib/slug";
import type { Category, Phrase } from "@/lib/types";

/**
 * 根级 SEO 落地页路由。
 *
 * Next.js 不支持 `chinese-[category]-phrases` 这种「参数夹在字面量中间」的目录名
 * （会被当成字面路径），所以这里用一个根级动态段统一解析两类 URL：
 *   /chinese-restaurant-phrases
 *   /how-to-say-thank-you-in-chinese
 * 全部走 generateStaticParams 预渲染，未知路径 -> 404。
 */
type Resolved =
  | { kind: "category"; category: Category }
  | { kind: "phrase"; phrase: Phrase };

const PHRASE_PREFIX = "how-to-say-";
const PHRASE_SUFFIX = "-in-chinese";

export function generateStaticParams() {
  return [
    ...CATEGORIES.map((c) => ({ seo: c.seoSlug })),
    ...getAllPhraseSlugs().map((slug) => ({
      seo: `${PHRASE_PREFIX}${slug}${PHRASE_SUFFIX}`,
    })),
  ];
}

function resolve(seo: string): Resolved | null {
  if (seo.startsWith(PHRASE_PREFIX) && seo.endsWith(PHRASE_SUFFIX)) {
    const slug = seo.slice(PHRASE_PREFIX.length, -PHRASE_SUFFIX.length);
    const phrase = getPhraseBySlug(slug);
    return phrase ? { kind: "phrase", phrase } : null;
  }
  const category = CATEGORIES.find((c) => c.seoSlug === seo);
  return category ? { kind: "category", category } : null;
}

interface PageProps {
  params: Promise<{ seo: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { seo } = await params;
  const resolved = resolve(seo);
  if (!resolved) return { title: "Page not found" };

  if (resolved.kind === "category") {
    const { category } = resolved;
    const count = getPhrasesByCategory(category.id).length;
    return {
      // 用 absolute 去掉站点后缀，让核心词更靠前、不被搜索结果截断
      title: {
        absolute: `${count} Chinese ${category.name} Phrases You'll Actually Use`,
      },
      description: `A free list of ${count} essential Chinese ${category.name.toLowerCase()} phrases with pinyin, English translation and audio. No sign-up needed.`,
      keywords: [
        `Chinese ${category.name.toLowerCase()} phrases`,
        `Chinese phrases for ${category.name.toLowerCase()}`,
        "learn Chinese",
        "Mandarin phrases",
        "Chinese pinyin",
      ],
      alternates: { canonical: urlOf(`/${category.seoSlug}`) },
      openGraph: {
        title: `${count} Chinese ${category.name} Phrases You'll Actually Use`,
        description: `Essential ${category.name.toLowerCase()} Mandarin with pinyin, English and audio.`,
        url: urlOf(`/${category.seoSlug}`),
        // 覆盖 openGraph 会整体替换父级配置，images 必须显式带上，否则分享卡片无图
        images: [{ url: "/og.png", width: 1200, height: 630, alt: `Chinese ${category.name} phrases` }],
      },
    };
  }

  const { phrase } = resolved;
  const english = cleanEnglish(phrase.english);
  const category = CATEGORIES.find((c) => c.id === phrase.category);

  return {
    title: { absolute: `How to say "${english}" in Chinese` },
    description: `"${english}" in Chinese is ${phrase.chinese} (${pinyinInline(phrase.pinyin)}). Pronunciation, pinyin and when to use it${category ? ` — ${category.name.toLowerCase()} Chinese` : ""}.`,
    keywords: [
      `how to say ${english} in Chinese`,
      `${english} in Chinese`,
      phrase.chinese,
      phrase.pinyin,
      "Chinese phrases",
      "learn Chinese",
    ],
    alternates: { canonical: urlOf(`/${seo}`) },
    openGraph: {
      title: `How to say "${english}" in Chinese`,
      description: `${phrase.chinese} (${phrase.pinyin}) means "${english}" in Chinese.`,
      url: urlOf(`/${seo}`),
      images: [{ url: "/og.png", width: 1200, height: 630, alt: `${phrase.chinese} — how to say it in Chinese` }],
    },
  };
}

export default async function SeoPage({ params }: PageProps) {
  const { seo } = await params;
  const resolved = resolve(seo);
  if (!resolved) notFound();

  if (resolved.kind === "category") {
    return <SeoCategoryView category={resolved.category} />;
  }
  return <PhraseView phrase={resolved.phrase} />;
}
