import type { Category, CategoryId } from "./types";

/** 分类定义：展示顺序 = 数组顺序。 */
export const CATEGORIES: Category[] = [
  {
    id: "restaurant",
    name: "Restaurant",
    emoji: "🍜",
    blurb: "Order food, ask for the bill, handle spice levels.",
    seoSlug: "chinese-restaurant-phrases",
    forLabel: "restaurants",
  },
  {
    id: "travel",
    name: "Travel",
    emoji: "✈️",
    blurb: "Airports, trains, directions and asking for help.",
    seoSlug: "chinese-travel-phrases",
    forLabel: "travel",
  },
  {
    id: "hotel",
    name: "Hotel",
    emoji: "🏨",
    blurb: "Check in, check out and fix things in your room.",
    seoSlug: "chinese-hotel-phrases",
    forLabel: "hotels",
  },
  {
    id: "shopping",
    name: "Shopping",
    emoji: "🛍",
    blurb: "Prices, sizes, bargaining and paying.",
    seoSlug: "chinese-shopping-phrases",
    forLabel: "shopping",
  },
  {
    // 「钱」是外国人来中国最先撞上的墙：QR 码、支付宝、微信支付、不收卡。
    // 单独立一类而不是塞进 shopping —— 搜索意图完全不同（怎么付 vs 怎么买）。
    id: "money",
    name: "Money",
    emoji: "💴",
    blurb: "Pay like a local: QR codes, Alipay, WeChat Pay, cash and cards.",
    seoSlug: "chinese-money-phrases",
    forLabel: "paying",
    guide: { href: "/chinese-numbers", label: "Chinese numbers 0–10,000" },
  },
  {
    id: "everyday",
    name: "Everyday",
    emoji: "💬",
    blurb: "Greetings, thanks and the small words you use all day.",
    seoSlug: "chinese-everyday-phrases",
    forLabel: "everyday conversation",
  },
  {
    id: "emergency",
    name: "Emergency",
    emoji: "🚨",
    blurb: "Get help fast: police, doctor, lost and allergies.",
    seoSlug: "chinese-emergency-phrases",
    forLabel: "emergencies",
  },
];

export function getCategory(id: string): Category | undefined {
  return CATEGORIES.find((c) => c.id === (id as CategoryId));
}

export function isCategoryId(id: string): id is CategoryId {
  return CATEGORIES.some((c) => c.id === id);
}
