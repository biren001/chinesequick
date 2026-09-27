import phrasesJson from "@/data/phrases.json";
import deepJson from "@/data/deep.json";
import { CATEGORIES } from "./categories";
import type { CategoryId, Phrase, PhraseDeep } from "./types";

const DEEP = deepJson as Record<string, PhraseDeep>;

/**
 * 静态数据：全站唯一数据源，构建期即可读，不需要任何后端。
 *
 * `deep` 块来自另一份文件，按短语 id 挂上来。分两个文件是因为变化频率不同：
 * `phrases.json` 是手工排版的短语清单，改一条会影响 URL 与音频；
 * `deep.json` 是纯编辑素材，今天补 8 条、下周再补 20 条都不影响别的东西。
 */
export const PHRASES: Phrase[] = (phrasesJson as Phrase[]).map((p) => {
  const deep = DEEP[String(p.id)];
  return deep ? { ...p, deep } : p;
});

// 构建期自检：deep.json 挂到不存在 id 上的内容是「死内容」——
// 它不报错、不白屏、也不会在任何页面上出现，等着被遗忘。这里直接让它构建失败。
{
  const ids = new Set(PHRASES.map((p) => p.id));
  const orphans = Object.keys(DEEP).filter(
    (k) => k !== "_comment" && !ids.has(Number(k))
  );
  if (orphans.length) {
    throw new Error(
      `data/deep.json 挂在不存在 id 上：${orphans.join(", ")} —— 这些内容永远不会被渲染，请核对 id。`
    );
  }
}

export function getPhrasesByCategory(category: CategoryId): Phrase[] {
  return PHRASES.filter((p) => p.category === category);
}

export function getPhraseById(id: number): Phrase | undefined {
  return PHRASES.find((p) => p.id === id);
}

export function countPhrases(category: CategoryId): number {
  return getPhrasesByCategory(category).length;
}

/**
 * 把拼音嵌进句子里时用这个，不要直接拼 phrase.pinyin。
 *
 * 数据里的拼音自带句末标点（"Xièxie." / "Duōshao qián?"），单独展示没问题，
 * 但模板通常在拼音后面还要补一个句号 —— 直接拼出来就是 "Xièxie.."。
 * 只削句末句点，保留 ? 和 !：那是句子语气，不是冗余。
 */
export function pinyinInline(pinyin: string): string {
  return pinyin.replace(/[.。]+$/, "");
}

/** 首页 / 落地页用：分类 + 该分类下短语数量 */
export function getCategoriesWithCount() {
  return CATEGORIES.map((c) => ({
    ...c,
    count: countPhrases(c.id),
  }));
}
