import { PHRASES } from "./phrases";

/**
 * 「7 天旅行中文课」。
 *
 * 定位：把站上所有短语按一次旅行的自然顺序排成 7 天课程，
 * **零新音频** —— 每条都链到它自己的单句页（音频、逐词表、深化内容全复用）。
 * 课程页本身卖的是"顺序"和"每天的推进感"，不是新内容。
 *
 * 新短语按主题归入对应的天（每天 15–18 条浮动，构建期自检抓漏抓重）。
 */
export const COURSE_PATH = "/7-day-chinese-course";

export interface CourseDay {
  /** 第几天（1 起），也是页面上 Day N 的 N */
  day: number;
  emoji: string;
  /** 导航/锚点用的短名 */
  name: string;
  /** 当天标题（H2） */
  title: string;
  /** 当天引子：学完能应付什么 */
  intro: string;
  /** 当天任务：把"学过"变成"用过" */
  mission: string;
  /** 当天 15 条短语的 id（按学习顺序） */
  ids: number[];
}

export const COURSE_DAYS: CourseDay[] = [
  {
    day: 1,
    emoji: "👋",
    name: "Say hello",
    title: "Say hello, thank you, sorry",
    intro:
      "Fifteen words that carry almost every polite exchange you will have in China. None of them is hard to say, and locals notice immediately when a visitor uses them — doors open faster, service gets friendlier, and small misunderstandings shrink.",
    mission:
      "Greet three people today — hotel staff, a shop assistant, a taxi driver. A spoken 你好 plus a smile is enough.",
    ids: [41, 65, 46, 79, 47, 80, 42, 44, 50, 43, 76, 62, 63, 67, 45],
  },
  {
    day: 2,
    emoji: "🧱",
    name: "Break the wall",
    title: "Break the language wall",
    intro:
      "The phrases that rescue you the moment a conversation outruns your Chinese. These are also the ones locals answer most helpfully: 请说慢一点 and 请写下来 turn a blank stare into a typed screen or a handwritten note you can show to the next person.",
    mission:
      "Have one full conversation where you say 我不懂 and 请再说一遍 out loud instead of switching to gestures.",
    ids: [48, 49, 70, 71, 72, 69, 68, 64, 77, 78, 66, 73, 74, 75, 81, 124, 133, 144],
  },
  {
    day: 3,
    emoji: "🍜",
    name: "Order food",
    title: "Order food and drinks",
    intro:
      "Restaurants are where you will use Chinese most. Menus may have no photos, staff may have no English, and pointing alone will not get you less spicy or no meat. After today you can order, ask what is good, and pay for the meal.",
    mission:
      "Order one dish end to end: point at the menu, say 我要这个，and finish with 买单。",
    ids: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 51, 52, 53, 54, 99, 106, 116, 117, 118, 126, 127, 146, 147],
  },
  {
    day: 4,
    emoji: "🚕",
    name: "Get around",
    title: "Taxis, trains and getting around",
    intro:
      "Drivers and station staff often speak no English at all, which makes this the day that saves the most walking. The address card on this site plus 请带我去这个地址 handles the destination; the rest of today's phrases handle tickets, timing and directions.",
    mission:
      "Take one taxi or train using Chinese only — show the address, ask 多久能到？and pay with 不用找了。",
    ids: [11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 55, 56, 57, 58, 102, 107, 108, 110, 119, 120, 128, 129, 140, 141, 142, 148, 149, 155],
  },
  {
    day: 5,
    emoji: "🏨",
    name: "Hotel & pay",
    title: "Check in, fix the room, pay",
    intro:
      "Hotels are also where mobile payments stop being optional: front desks, breakfast vouchers and luggage storage all move faster when you can ask for Alipay or WeChat Pay by name. Today ends with you checking in, sorting a room problem, and paying without opening your wallet for cash.",
    mission:
      "Check in by saying 我要入住 and 我订了房间，then pay once with 可以用支付宝吗？",
    ids: [21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 95, 96, 97, 98, 103, 111, 112, 113, 121, 122, 130, 131, 143, 150, 151, 152],
  },
  {
    day: 6,
    emoji: "🛍",
    name: "Shop",
    title: "Shop, try on, bargain a little",
    intro:
      "Markets and small shops run on two sentences: 这个多少钱 and 可以便宜一点吗。Everything else today is about getting the right size, the right color, and not buying the first thing you touch. Browse politely with 我随便看看 — sellers genuinely back off when you say it.",
    mission:
      "Buy something small: ask the price, try it on, and ask 可以便宜一点吗？ once. The worst case is a smile and a no.",
    ids: [31, 32, 33, 34, 35, 36, 37, 38, 39, 40, 59, 60, 61, 100, 101, 109, 114, 115, 123, 132, 136, 137, 138, 139, 153],
  },
  {
    day: 7,
    emoji: "🚨",
    name: "Emergencies",
    title: "Emergencies and payment problems",
    intro:
      "The phrases you hope never to need, learned last so they stay fresh. They cover the four emergency numbers, sickness and allergies, a lost passport or stolen wallet — plus the two payment failures that most often end a good day badly.",
    mission:
      "Fill in the emergency card on this site and save 110 and 120 in your phone under favorites before your trip.",
    ids: [82, 83, 84, 85, 86, 87, 88, 89, 90, 91, 92, 93, 94, 104, 105, 125, 134, 135, 145, 154],
  },
];

export function getCourseDayPhrases(ids: number[]) {
  return ids.map((id) => {
    const p = PHRASES.find((x) => x.id === id);
    if (!p) throw new Error(`课程 day id ${id} 在 data/phrases.json 里不存在`);
    return p;
  });
}

/* ---------------- 构建期自检 ---------------- */
// 课程承诺的是「7 天覆盖全站所有短语，一条不多一条不少」。
// 增删短语时这里会立刻报错，而不是让课程页悄悄漏掉一条或重复一条。
// 每天条数不强制均分（新词按主题归入对应天，天数会在 15–18 之间浮动），
// 但每天不得低于 15 条 —— 低于它说明分堆失衡，课程节奏会垮。
{
  const flat = COURSE_DAYS.flatMap((d) => d.ids);
  const seen = new Set<number>();
  const dupes: number[] = [];
  for (const id of flat) {
    if (seen.has(id)) dupes.push(id);
    seen.add(id);
  }
  if (dupes.length) {
    throw new Error(`7 天课里重复的短语 id：${dupes.join(", ")}`);
  }
  const all = new Set(PHRASES.map((p) => p.id));
  const missing = [...all].filter((id) => !seen.has(id));
  if (missing.length) {
    throw new Error(`7 天课漏掉的短语 id：${missing.join(", ")}`);
  }
  if (flat.length !== PHRASES.length) {
    throw new Error(
      `7 天课条数 ${flat.length} ≠ 短语总数 ${PHRASES.length} —— 需要把新短语归入对应的天`
    );
  }
  const thinDay = COURSE_DAYS.find((d) => d.ids.length < 15);
  if (thinDay) {
    throw new Error(`Day ${thinDay.day} 只有 ${thinDay.ids.length} 条 —— 每天至少 15 条`);
  }
}
