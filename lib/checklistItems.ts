/**
 * 中国行前准备清单的内容本身（纯数据，服务端/客户端都能读）。
 *
 * 选材标准：只留「不准备会真的卡住」的项 —— 落地之后没法补救，
 * 或者补救成本远高于出发前花十分钟的那种。泛泛的旅行建议一律不收，
 * 否则清单会变成 50 条没人看得完的待办。
 *
 * 结构上刻意分成两个正交维度：
 *   - 阶段（CHECKLIST_STAGES）：什么时候做。这是清单的执行顺序，也是页面的主干。
 *   - 主题（CHECKLIST_TOPICS）：这一项属于证件、付款、手机还是中文。
 * 只按主题排的话，用户读完不知道先干哪件；只按时间排的话，一堆条目混在一起
 * 看不出各自是什么性质。两个都要，主题降级成条目上的一个小标签。
 */

export type ChecklistTopicId = "documents" | "money" | "phone" | "chinese";

export interface ChecklistTopic {
  id: ChecklistTopicId;
  label: string;
  emoji: string;
}

export const CHECKLIST_TOPICS: ChecklistTopic[] = [
  { id: "documents", label: "Documents", emoji: "📄" },
  { id: "money", label: "Money", emoji: "💴" },
  { id: "phone", label: "Phone", emoji: "📱" },
  { id: "chinese", label: "Chinese", emoji: "🗣" },
];

export interface ChecklistItem {
  id: string;
  /** 渲染成条目上的小标签，让「这是证件还是学中文」一眼可见 */
  topic: ChecklistTopicId;
  title: string;
  why: string;
  /** 站内可以进一步学的东西（有就给个链接，别让用户读完就走到死胡同） */
  href?: string;
  linkLabel?: string;
  /**
   * 站外官方来源。只给「会变的事实」配 —— 签证、入境、支付通道这类
   * 每年都可能改、写错了会真的误事的条目。学中文的条目不需要。
   */
  source?: { label: string; href: string };
}

export interface ChecklistStage {
  id: string;
  /** 时间窗，渲染成阶段小标题 */
  when: string;
  title: string;
  /** 为什么是现在做 —— 一句话，别写成鸡汤 */
  blurb: string;
  emoji: string;
  /** 顺序即页面上展开的顺序 */
  itemIds: string[];
}

export const CHECKLIST_STAGES: ChecklistStage[] = [
  {
    id: "weeks-out",
    when: "2–4 weeks before",
    title: "Start the things that take time",
    emoji: "📅",
    blurb:
      "A passport renewal takes weeks, a visa decision can take longer, and hotels that can register foreign guests book out in high season. Everything here has a queue attached to it, which is the only reason it comes first — none of it is hard, it just cannot be rushed at the last minute.",
    itemIds: ["passport-validity", "visa-rules", "hotel-foreign-guests", "payment-app", "tell-bank"],
  },
  {
    id: "week-out",
    when: "About a week before",
    title: "Set things up at home, while it's easy",
    emoji: "🛠",
    blurb:
      "Mobile data, apps, offline maps and the Chinese you'll actually use. All of it is far easier on your own wifi than on airport wifi — and the phrases need a few days of listening before they come out of your mouth without thinking.",
    // 短语类条目刻意放在这个阶段而不是「前一天」：语言是要练的，不是要带的
    itemIds: [
      "data-plan",
      "apps-check",
      "offline-maps",
      "everyday-30",
      "numbers",
      "restaurant",
      "transport",
      "emergency",
    ],
  },
  {
    id: "day-before",
    when: "The day before",
    title: "Pack, and save what you'll reach for",
    emoji: "🎒",
    blurb:
      "Nothing here takes more than ten minutes, but each one is the difference between a calm first day and a stressful one. Do them the night before, at home, not in a taxi with no signal.",
    itemIds: ["cash-backup", "power", "passport-copy", "address-cn"],
  },
];

export const CHECKLIST_ITEMS: ChecklistItem[] = [
  {
    id: "passport-validity",
    topic: "documents",
    title: "Check your passport validity requirements",
    // 刻意不写「必须剩 6 个月以上」：那是部分签证类型的要求，不是对所有国籍
    // 所有入境方式都成立的普遍规则（免签入境就按停留期算）。写成通例会误事。
    why: "How much validity you need depends on your nationality, your visa type and how long you are staying — a blanket \u201csix months\u201d does not apply to every passport. Look up the rule for yours, and start a renewal early: it takes weeks and it is the one item here you cannot fix at short notice.",
    source: {
      label: "China's Ministry of Foreign Affairs — embassies and consulates",
      href: "https://www.mfa.gov.cn/eng/",
    },
  },
  {
    id: "visa-rules",
    topic: "documents",
    title: "Check the entry rules for your nationality",
    why: "Many nationalities can now visit China visa-free for short trips, and there is a separate rule for transit passengers. The rules change often, so confirm on the Chinese embassy or consulate site for your passport before you book anything non-refundable.",
    source: {
      label: "National Immigration Administration (official)",
      href: "https://en.nia.gov.cn/",
    },
  },
  {
    id: "hotel-foreign-guests",
    topic: "documents",
    title: "Book accommodation that can register foreign guests",
    why: "Most hotels can, but a few budget places are not set up for foreign passports. Booking platforms usually show which is which — worth checking before you pay.",
    href: "/chinese-hotel-phrases",
    linkLabel: "Checking in: the phrases",
  },
  {
    id: "payment-app",
    topic: "money",
    title: "Set up Alipay or WeChat Pay with your own card",
    why: "Scanning a QR code is how China pays for almost everything, and both apps now accept international cards. Do it at home while you still have your bank's SMS and a reliable connection — it is much harder to sort out from inside China. Which cards are accepted changes, so check before you fly.",
    href: "/chinese-money-phrases",
    linkLabel: "Paying in China: the phrases",
    source: {
      label: "Alipay — official info for international visitors",
      href: "https://global.alipay.com/",
    },
  },
  {
    id: "tell-bank",
    topic: "money",
    title: "Tell your bank you are travelling",
    why: "Foreign-card payments are sometimes flagged the first time they are used abroad, and unblocking it from another country is slow.",
  },
  {
    id: "data-plan",
    topic: "phone",
    title: "Sort out mobile data before you fly",
    why: "An eSIM or a roaming plan is far easier to set up at home than at the airport. You need data to pay, to translate, and to call a car.",
  },
  {
    id: "apps-check",
    topic: "phone",
    title: "Check which apps you rely on may not be reachable",
    why: "Some of the services people use daily are not available in mainland China. Decide what you will use instead before you fly, and save offline copies of anything you need on the way in — tickets, bookings, addresses.",
  },
  {
    id: "offline-maps",
    topic: "phone",
    title: "Download offline maps for the cities you are visiting",
    why: "Useful when signal drops, essential when you are navigating on foot. Do it on hotel wifi the night before, not in the street.",
    href: "/chinese-travel-phrases",
    linkLabel: "Chinese for directions",
  },
  {
    id: "everyday-30",
    topic: "chinese",
    title: "Learn the everyday words: hello, thank you, yes, no, excuse me",
    why: "These come up dozens of times a day, and the first thing you say usually sets the tone for the rest of the exchange.",
    href: "/chinese-everyday-phrases",
    linkLabel: "30 everyday phrases",
  },
  {
    id: "numbers",
    topic: "chinese",
    title: "Learn to hear Chinese numbers",
    why: "Prices, taxi fares, platform numbers, hotel floors, phone numbers — numbers reach you before any sentence does, and you cannot gesture your way through a till. You need 0\u201310 plus two rules: 万 means ten thousand, and 两 replaces 二 before a unit.",
    href: "/chinese-numbers",
    linkLabel: "Chinese numbers 0\u201310,000",
  },
  {
    id: "restaurant",
    topic: "chinese",
    title: "Rehearse the restaurant phrases before your first meal",
    why: "Spice level and allergies are the two things you cannot gesture your way out of, and menus outside big hotels are rarely in English.",
    href: "/chinese-restaurant-phrases",
    linkLabel: "Restaurant phrases",
  },
  {
    id: "transport",
    topic: "chinese",
    title: "Rehearse the taxi and train phrases",
    why: "Drivers rarely speak English, and the single most useful sentence you own is pointing at an address and saying \u201cplease take me here\u201d.",
    href: "/chinese-travel-phrases",
    linkLabel: "Travel phrases",
  },
  {
    id: "emergency",
    topic: "chinese",
    title: "Save the emergency phrases before you need them",
    why: "\u201cI don't speak Chinese\u201d, \u201cplease help me\u201d, \u201cI'm lost\u201d, \u201ccall a doctor\u201d. Reading them once at home is the difference between panic and a sentence you can actually say.",
    href: "/chinese-emergency-phrases",
    linkLabel: "Emergency phrases",
  },
  {
    id: "cash-backup",
    topic: "money",
    title: "Carry a small amount of cash as backup",
    why: "You will rarely need it, but if a phone dies or an app refuses to load, a few hundred yuan is what gets you back to the hotel.",
  },
  {
    id: "power",
    topic: "phone",
    title: "Pack a power bank and a plug adapter",
    why: "China runs on 220V with type A, C and I sockets. Your phone is your wallet, your map and your translator at the same time — running out of battery is a real problem, not an inconvenience.",
  },
  {
    id: "passport-copy",
    topic: "documents",
    title: "Keep a photo of your passport and visa on your phone",
    why: "Hotel check-in, ticket desks and any police report may all ask for the details. A photo means you do not have to carry the real thing everywhere you go.",
  },
  {
    id: "address-cn",
    topic: "chinese",
    title: "Save your hotel's address in Chinese",
    why: "Screenshot it or keep it on your home screen. You will show this screen to a taxi driver more than once, and you will not want to be spelling it out.",
    href: "/learn/hotel",
    linkLabel: "Hotel phrases",
  },
];

const ITEMS_BY_ID = new Map(CHECKLIST_ITEMS.map((item) => [item.id, item]));
const TOPICS_BY_ID = new Map(CHECKLIST_TOPICS.map((topic) => [topic.id, topic]));

export function checklistItem(id: string): ChecklistItem | undefined {
  return ITEMS_BY_ID.get(id);
}

export function checklistTopic(id: ChecklistTopicId): ChecklistTopic | undefined {
  return TOPICS_BY_ID.get(id);
}

export const CHECKLIST_TOTAL = CHECKLIST_ITEMS.length;

/**
 * 阶段与条目的一一对应关系自检。
 *
 * 条目漏挂到阶段上，就会从页面上静默消失（总数还对不上）；挂两次就渲染两遍。
 * 这两种错都不会让构建失败，只能靠一道显式检查拦住 —— 由 _dev/seocheck.js 断言。
 */
export function checklistIntegrity() {
  const staged = CHECKLIST_STAGES.flatMap((stage) => stage.itemIds);
  return {
    items: CHECKLIST_ITEMS.length,
    staged: staged.length,
    unknownIds: staged.filter((id) => !ITEMS_BY_ID.has(id)),
    duplicatedIds: staged.filter((id, i) => staged.indexOf(id) !== i),
    unstagedIds: CHECKLIST_ITEMS.filter((item) => !staged.includes(item.id)).map(
      (item) => item.id
    ),
    badTopicIds: CHECKLIST_ITEMS.filter((item) => !TOPICS_BY_ID.has(item.topic)).map(
      (item) => item.id
    ),
  };
}

/**
 * 清单里「会变的事实」（签证、入境、支付通道）最后一次人工核对的时间。
 *
 * 显示成具体日期而不是「最近更新」：前者是可以被追责的承诺，后者是话术。
 * 改动任何 source 条目时，把这个日期一起改掉。
 */
export const CHECKLIST_LAST_CHECKED = "26 September 2026";
