import { PHRASES } from "./phrases";
import type { Phrase } from "./types";

/** 把任意文本压成 URL 友好的 slug（同时去掉拼音声调符号）。 */
export function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * 单条短语的 SEO slug：/how-to-say-thank-you-in-chinese
 *
 * 默认由 english 生成；phrase.slug 存在时优先用它 —— 见 Phrase.slug 的注释：
 * 改文案不该改已经被收录的 URL。
 */
export function phraseSlug(phrase: Phrase): string {
  if (phrase.slug) return phrase.slug;
  const base = slugify(phrase.english);
  return base || `phrase-${phrase.id}`;
}

/**
 * slug -> 短语 的映射表。
 * 英文重复时自动加 id 后缀保证唯一（当前数据没有重复，但别让将来加数据时炸掉构建）。
 */
const PHRASE_SLUGS: Map<string, Phrase> = (() => {
  const map = new Map<string, Phrase>();
  for (const p of PHRASES) {
    let slug = phraseSlug(p);
    if (map.has(slug)) slug = `${slug}-${p.id}`;
    map.set(slug, p);
  }
  return map;
})();

export function getPhraseBySlug(slug: string): Phrase | undefined {
  return PHRASE_SLUGS.get(slug);
}

export function getAllPhraseSlugs(): string[] {
  return Array.from(PHRASE_SLUGS.keys());
}

/** /how-to-say-{slug}-in-chinese 的完整路径 */
export function phrasePath(slug: string): string {
  return `/how-to-say-${slug}-in-chinese`;
}
