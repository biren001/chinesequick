export type CategoryId =
  | "restaurant"
  | "travel"
  | "hotel"
  | "shopping"
  | "money"
  | "everyday"
  | "emergency";

/** 逐词拆解：让 SEO 页能给出「这个词是什么意思」的对照表。 */
export interface PhraseWord {
  zh: string;
  py: string;
  en: string;
}

/**
 * 单句页的「深度内容」。
 *
 * 背景：105 个单句页中位数只有 ~290 词，而其中流量最大的几条偏偏最薄
 * （谢谢 216 / 你好 215 / 对不起 191）—— 但这些页已经在 Google 上排到第一。
 * 给它们加内容，比新建一个页面类型划算。
 *
 * **全部字段可选**：没填的短语按原样渲染，不受影响。这样填一条上一条，
 * 不必 105 条一起改完才能发布。
 *
 * **刻意不配音频**：变体走 `AudioButton` 已有的浏览器语音兜底
 * （`src` 为 null 时 speechSynthesis），所以深化不增加任何 mp3 ——
 * 站点包已经 4.88 MB 且要手动上传 Cloudflare，这是硬约束。
 */
export interface PhraseDeep {
  /** 什么时候说。要具体到情境，不要写成词典释义 */
  when?: string[];
  /** 同一意图，中国人实际还怎么说。按常用度排序 */
  variants?: { zh: string; py: string; en: string; note?: string }[];
  /** 新手真会犯的错 —— 全站信息增量最高的一段，也是竞品没有的一段 */
  mistakes?: string[];
  /** 对方通常会怎么回 —— 说完之后的接话指南 */
  replies?: { zh: string; py: string; en: string }[];
}

/** 一条短语。字段与 data/phrases.json 一一对应。 */
export interface Phrase {
  id: number;
  category: CategoryId;
  chinese: string;
  pinyin: string;
  english: string;
  /**
   * URL 段覆盖（/how-to-say-<slug>-in-chinese 中间那截）。
   *
   * 默认用 english 生成，**只有当英文文案被改写、而旧 URL 已经被搜索引擎收录时**才填。
   * 目的：改文案不该改 URL —— 已收录的 URL 一变，旧地址 404、新地址要从头攒权重。
   * 用法示例：id 13 的英文从 "It's this address." 改成 "This is the address."，
   * 但 slug 锁在 `its-this-address`。
   *
   * 规则：填了之后就不要再改（它等同于对外承诺的地址）。
   */
  slug?: string;
  /** 音频文件路径；null 表示走浏览器语音合成（TTS）兜底 */
  audio?: string | null;
  /** 什么时候用、中国人怎么用 —— SEO 页的独立信息增量 */
  tip?: string;
  /** 逐词拆解，可选（老数据没有也能正常渲染） */
  words?: PhraseWord[];
  /** 深度内容块，可选（见 PhraseDeep 的说明） */
  deep?: PhraseDeep;
}

/**
 * 场景流程的一步（Scenario Mode）。
 * 步骤不新增句子：sayId 指向 data/phrases.json 里已有的短语，
 * 所以音频、单句页、收藏、逐词表全部天然可用。
 */
export interface ScenarioStep {
  /** 该步要说的短语 id（构建期会校验它真的存在） */
  sayId: number;
  /** 这一步在干什么（短标题，动词开头） */
  title: string;
  /** 对方通常会回什么 —— 场景页相对分类页的真正信息增量 */
  theySay?: { zh: string; py: string; en: string };
  /** 经验提醒：什么时候说、为什么这么说、会踩什么坑 */
  note?: string;
}

/** 一个真实场景的完整流程（Scenario Mode）。 */
export interface Scenario {
  /** URL 段：/scenarios/<slug>/ */
  slug: string;
  emoji: string;
  /** 卡片与导航上的短名 */
  name: string;
  /** 卡片上的一句话 */
  blurb: string;
  /** 页面 H1（也是搜索意图的落点） */
  h1: string;
  /** title 标签（不带站点后缀） */
  metaTitle: string;
  description: string;
  /** 引子：先讲清这个场景真正难在哪 */
  intro: string[];
  steps: ScenarioStep[];
  /** 「顺手也带上」：不进流程但值得备着的相关短语 */
  alsoIds?: number[];
  faq: { q: string; a: string }[];
}

export interface Category {
  id: CategoryId;
  name: string;
  emoji: string;
  /** 分类页一句话说明 */
  blurb: string;
  /** SEO 页面 slug，如 restaurant -> /chinese-restaurant-phrases */
  seoSlug: string;
  /** 用在「Chinese phrases for ___」句式里的自然说法 */
  forLabel: string;
  /**
   * 该分类配套的「指南页」（不是短语列表页）。有值就会在首页卡片与分类页上
   * 渲染成一条链接 —— 指南页靠这条入链避免变成孤岛。
   */
  guide?: { href: string; label: string };
}
