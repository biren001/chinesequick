import { SITE_ALTERNATE_NAMES, SITE_NAME, SITE_TAGLINE, SITE_URL } from "@/lib/site";
import { pinyinInline } from "@/lib/phrases";
import { phrasePath, phraseSlug } from "@/lib/slug";
import type { Category, Phrase, Scenario } from "@/lib/types";

/** sitemap / canonical 统一按 trailingSlash:true 输出带尾斜杠的地址。 */
export function urlOf(path: string): string {
  const clean = path.startsWith("/") ? path : `/${path}`;
  const withSlash = clean.endsWith("/") ? clean : `${clean}/`;
  return `${SITE_URL}${withSlash === "/learn" ? "/" : withSlash}`;
}

export function orgId(): string {
  return `${urlOf("/")}#organization`;
}

export function websiteId(): string {
  return `${urlOf("/")}#website`;
}

/** 站点级实体。放在首页，让搜索引擎知道"这个站是谁"。 */
export function organizationSchema() {
  return {
    "@type": "EducationalOrganization",
    "@id": orgId(),
    name: SITE_NAME,
    alternateName: SITE_ALTERNATE_NAMES,
    url: urlOf("/"),
    description: SITE_TAGLINE,
    logo: {
      "@type": "ImageObject",
      // 不能走 urlOf()：它会给页面 URL 补尾斜杠，但资源文件被补成 /logo.png/ 就是 404。
      // Google 抓不到 logo 会影响它在搜索结果里认这个品牌（站名/图标）。
      url: `${SITE_URL}/logo.png`,
      width: 512,
      height: 512,
    },
    inLanguage: "en",
    audience: {
      "@type": "Audience",
      audienceType: "English speakers travelling to or living in China",
    },
    teaches: "Mandarin Chinese (Simplified Chinese, Mandarin)",
  };
}

export function websiteSchema() {
  return {
    "@type": "WebSite",
    "@id": websiteId(),
    url: urlOf("/"),
    name: SITE_NAME,
    // Google 的站名系统在首选名"不太有把握"时会回退显示域名；
    // alternateName（含全小写的域名）是官方给的备选机制，见 lib/site.ts 的说明。
    alternateName: SITE_ALTERNATE_NAMES,
    description: SITE_TAGLINE,
    inLanguage: "en",
    publisher: { "@id": orgId() },
  };
}

export interface Crumb {
  name: string;
  path: string;
}

export function breadcrumbSchema(crumbs: Crumb[]) {
  return {
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: urlOf("/") },
      ...crumbs.map((c, i) => ({
        "@type": "ListItem",
        position: i + 2,
        name: c.name,
        item: urlOf(c.path),
      })),
    ],
  };
}

/**
 * 英文不定冠词，按**首字母**选 a / an。
 *
 * 为什么要有这个函数：FAQ 答案里原本写死 `It is a ${category} phrase...`，
 * 而分类名里 everyday / emergency 是元音开头 → 渲染成 "It is a everyday phrase"。
 * 这句 FAQ 是**页面上可见的正文**，也正是 Google 拿去当 SERP 摘要的那段
 * （实测 2026-09-27：搜 `How to say "My Chinese isn't good" in Chinese`，
 *  chinesequick.com 排第一，摘要里就是这句错话）。影响 everyday 30 + emergency 13 = 43 页。
 *
 * 局限：真英文要看**读音**而非字母（an hour / a university / a European）。
 * 分类名都是普通词，按字母判足够；真出现 university 这类词再改成读音表。
 */
export function articleFor(word: string): "a" | "an" {
  return /^[aeiou]/i.test(word.trim()) ? "an" : "a";
}

/**
 * 单句页的 FAQ。
 * 这三条问句刻意对齐真实搜索/提问方式 —— AI 引擎引用时最常抽的就是这种 Q&A 结构。
 */
export function phraseFaqEntries(phrase: Phrase, english: string, category?: Category) {
  // 拼音一律走 pinyinInline：数据里自带句末句点，模板这里还要补一个，
  // 直接拼会出现 "Xièxie.."（线上实测过）。
  const py = pinyinInline(phrase.pinyin);
  const breakdown = phrase.words?.length
    ? phrase.words.map((w) => `${w.zh} (${w.py}) means "${w.en}"`).join("; ")
    : `${phrase.chinese} is pronounced "${py}"`;

  return [
    {
      q: `How do you say "${english}" in Chinese?`,
      a: `"${english}" in Chinese is ${phrase.chinese} — written in pinyin as ${py}. ${
        category
          ? `It is ${articleFor(category.name)} ${category.name.toLowerCase()} phrase you would use in China.`
          : "It is an everyday phrase used throughout China."
      }`,
    },
    {
      q: `What does ${phrase.chinese} mean in Chinese?`,
      a: `${phrase.chinese} (${py}) means "${english}". Broken down word by word: ${breakdown}.`,
    },
    {
      q: `When would you use "${english}" in Chinese?`,
      // 【别改成只读 tip】PhraseView 在 deep.when 存在时就不再渲染 tip 了。
      // 若这条 FAQ 仍读 tip，同一页会出现「正文说一套、FAQ 说另一套」——
      // 而 FAQ 正是 Google 拿去当摘要的那段（实测过）。id 46 踩过这个坑：
      // tip 说「朋友间很自然」，而正文说这是教科书说法。
      a: phrase.deep?.when?.length
        ? phrase.deep.when.join(" ")
        : phrase.tip
          ? `${phrase.tip} You would say ${phrase.chinese} (${py}) in everyday conversation.`
          : `You would say ${phrase.chinese} (${py}) in everyday conversation${
              category ? `, especially in ${category.name.toLowerCase()} situations` : ""
            }.`,
    },
  ];
}

export function faqSchema(entries: { q: string; a: string }[]) {
  return {
    "@type": "FAQPage",
    mainEntity: entries.map((e) => ({
      "@type": "Question",
      name: e.q,
      acceptedAnswer: { "@type": "Answer", text: e.a },
    })),
  };
}

/** 分类集合页：把 10 个短语列成一个有序清单，便于引擎整体理解页面内容。 */
export function itemListSchema(category: Category, phrases: Phrase[]) {
  return {
    "@type": "ItemList",
    name: `${phrases.length} Chinese ${category.name} Phrases`,
    numberOfItems: phrases.length,
    itemListOrder: "https://schema.org/ItemListOrderAscending",
    itemListElement: phrases.map((p, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: p.chinese,
      alternateName: p.pinyin,
      description: p.english,
      url: urlOf(phrasePath(phraseSlug(p))),
    })),
  };
}

/** 学习页：声明这是一个免费课程，争取课程类富媒体结果。 */
export function courseSchema(category: Category, phrases: Phrase[]) {
  return {
    "@type": "Course",
    name: `${category.name} Chinese — ${phrases.length} phrases`,
    description: `Learn ${phrases.length} practical Mandarin phrases for ${category.name.toLowerCase()} situations, with pinyin and audio. ${category.blurb}`,
    provider: { "@id": orgId() },
    inLanguage: ["en", "zh-Hans"],
    isAccessibleForFree: true,
    teaches: phrases.map((p) => p.english.replace(/\.$/, "")).slice(0, 10),
    url: urlOf(`/learn/${category.id}`),
  };
}

/**
 * 场景流程页：把「按顺序走一遍」的步骤写成有序清单。
 * 和分类页的 ItemList 区别在于语义 —— 这里要表达的是顺序，不是集合。
 */
export function scenarioSchema(scenario: Scenario, phrases: Phrase[]) {
  return {
    "@type": "ItemList",
    name: scenario.h1,
    description: scenario.description,
    numberOfItems: phrases.length,
    itemListOrder: "https://schema.org/ItemListOrderAscending",
    itemListElement: phrases.map((p, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: p.chinese,
      alternateName: p.pinyin,
      description: p.english,
      url: urlOf(phrasePath(phraseSlug(p))),
    })),
  };
}

/** 场景总览页：把全部场景列成一个清单。 */
export function scenarioHubSchema(scenarios: Scenario[]) {
  return {
    "@type": "ItemList",
    name: "Chinese phrase guides by situation",
    description:
      "Step-by-step Chinese phrase guides for arriving, taxis, hotels, restaurants, paying and getting around in China.",
    numberOfItems: scenarios.length,
    itemListOrder: "https://schema.org/ItemListOrderAscending",
    itemListElement: scenarios.map((s, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: s.name,
      description: s.blurb,
      url: urlOf(`/scenarios/${s.slug}`),
    })),
  };
}
