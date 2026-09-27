import numbersJson from "@/data/numbers.json";

/**
 * 数字与计量单位的发音表。
 *
 * 与 phrases.json 分开存：这些不是「句子」，不该各自占一个短语页（会变成
 * 一堆单字薄页），但「Chinese numbers 1-10」这类查询的量级又远大于多数短语。
 * 所以做成一张专页 + 一份带音频的表，而不是 24 个页面。
 * 音频由 _dev/make-audio.py 读同一个 JSON 生成，两边不会漂移。
 */
export interface NumberItem {
  zh: string;
  py: string;
  en: string;
  section: NumberSection;
}

export type NumberSection = "basics" | "building" | "money" | "time";

export const NUMBERS = numbersJson as NumberItem[];

export function numbersBySection(section: NumberSection): NumberItem[] {
  return NUMBERS.filter((n) => n.section === section);
}
