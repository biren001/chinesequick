# chinesequick.com 竞品分析与产品路线

日期：2026-09-26　方法：公开 sitemap + 页面形态实测（不依赖 Ahrefs/Semrush，本机可复现）

---

## 0. 结论先行

1. **我们的差异化定位没人占住**：Zitou 是字典 + HSK，nihawa 是内容 + 联盟，翻译 App 是通用翻译器。**"某个场景下此刻要说的话"（场景脚本 + 发音 + 离线 + 零注册）这条缝，三家都没做。**
2. **最大的即时漏洞不是缺功能，是自己写的承诺没兑现**：首页写着 `works offline`，但项目里既没有 `manifest` 也没有 service worker（实测 `public/` 只有 `logo.png`/`og.png`/IndexNow key）。这是一个"能修、便宜、且直接兑现卖点"的洞。
3. **最大的结构性缺口是内容面**：我们 50 条短语 = 61 个 URL，**全站在漏斗最底部**（"how to say X"）。两家竞品都有中上层内容（指南/工具），我们一篇都没有 = 没有任何词能承接"我准备去中国了"这个搜索。
4. **加页 ≠ 能排**：我们外链接近 0，权威才是真瓶颈。所以路线里"投清单/拿外链"和"加内容"要一起排，别只加页。

---

## 1. 三家底盘实测

| | Zitou `z.tou.gg` | nihawa.com | 截图里的翻译 App | chinesequick.com（我们） |
|---|---|---|---|---|
| sitemap 总条数 | 130 + **7,823** | 85 | 无（App） | 61 |
| 去掉语言前缀的真实内容单元 | **13 个路径** + 7,823 个 `/w/<汉字>` | **50 个单元** | — | 61 |
| 语言 | **10 种**（uz 默认/en/ru/zh/es/pt/fr/de/tr/id），带 hreflang | 2 种（en/ar），带 hreflang | 界面为**西班牙语** | 1 种（en） |
| 技术底座 | 纯浏览器运行、可安装成 App；开放语料拼装 | 静态站 + 少量 JS 工具 | 原生 App | Next 静态导出、TTS |
| 打法 | 广度：字典 + 新旧 HSK 大纲 | 中上层内容 + 工具 + 联盟 | 零摩擦即问即答 | 场景短句 + 练习闭环 |

---

## 2. 逐个拆解

### 2.1 Zitou（z.tou.gg）

**它是什么**：about 页自述——面向乌兹别克语/俄语/英语使用者的中文学习 App：HSK 课程、间隔重复、123,000+ 词条字典、8,500+ 母语者录音、笔顺书写。免费、跑在浏览器里、可装到手机。

**结构实测**
- `sitemap.xml` 130 条 → 剥掉 10 个语言前缀只剩 **13 个路径**：home、about、blog 索引、**blog 仅 4 篇文章**（30 天学中文 / 声调 / 笔顺规则 / HSK 等级）、`hsk/1..7`、`hsk2/1..6`、`hsk3/1..7`、privacy、terms。
- `sitemap-words.xml` **7,823 条** `https://z.tou.gg/w/<汉字>`（的/了/我/是/你/在/不/有 … 按字频排）。**它真正的索引体量在这一层，不在主 sitemap。**
- 12 个语言版本各自有独立 URL + `xhtml:link` 互指 = hreflang 簇做得很规范。

**可借鉴（按性价比）**
1. **开放语料换真人声**。它用 `audio-cmn`（Yue Tan / Chen Wang，CC BY-SA 3.0）拿到 8,500 条母语者录音，`CC-CEDICT` 校音，`Make Me a Hanzi` + `Hanzi Writer` 做笔顺。**我们现在用浏览器 TTS 顶替 mp3**——这是"能立刻变成事实"的升级点，但注意 CC BY-SA 的署名与体积问题（按需加载、只在分类页引）。
2. **可安装成 App + 离线**。它把 PWA 当卖点写进 about。我们首页已经写了 `works offline`，但没实现。
3. **`/w/<字>` 程序化页**。我们 50 条短语里能拆出 150+ 个词，做 `/word/<词>` 是同一套模板的降级复制，成本极低（但竞争不过它的 7,823 页，别在这条赛道上正面对撞）。
4. **`/about` 页明列数据来源与许可证**。这既是合规动作，也是 E-E-A-T 信号。我们**目前连 about 页都没有**。
5. **语言倍乘**。10 种语言把 13 个路径放大成 130 条 URL。这是它们索引面最大的杠杆，也解释了为什么 nihawa 也要做 ar。

**它的弱点（我们的机会）**
- 乌兹别克语/俄语释义是 **AI 翻译且自认可能有错**（"being checked step by step, so some may be wrong"）→ 语言倍乘的代价是质量；我们如果做多语言，要么做好、要么别做。
- 词条页是**字典意图**，SERP 对手是 MDBG / Pleco 这种十几年老站，难打。
- **完全没有场景/旅行短句**，也不教"什么时候说哪句"。

### 2.2 nihawa.com

**它是什么**：内容站 + 工具站 + 联盟。sitemap 85 条 → 剥语言前缀 **50 个内容单元** × (en / **ar**)。

**三个族**
- `/learn/`（36 篇）：chinese-greetings、chinese-tones-explained、chinese-tones-self-check、how-to-learn-chinese-for-beginners、1000-common-chinese-characters、graded-chinese-listening、mandarin-vs-cantonese、understand-but-cant-speak-chinese、hsk-1-*（10 篇连题材都按 HSK 大纲切成"日常问候/餐饮/健康/爱好/自我介绍/校园/购物/旅行问路/天气/工作"）……
- `/tools/`（4 个）：tone-pair-trainer、pinyin-converter、hsk-level-test
- `/news/`（7 条）

**单页实测**（`/learn/chinese-greetings/`）
- title/h1：`Chinese Greetings for Beginners: 20 Phrases You'll Actually Use`
  → **它在用和我们 slogan 同一个词（"phrases you'll actually use"）**。这句差异化话术已经被占，我们得说更具体的（"在餐厅点菜那一刻要说的 10 句"）。
- H2 骨架：Core greetings → Everyday real-life openers → Phone / message greetings → Farewells → **5-minute daily practice** → **Common beginner mistakes** → Next steps → CTA
  → 这个骨架可以直接套在我们的 `SeoCategoryView` 上，几乎零设计成本。
- 正文约 **3,000 可见字符**（偏薄）；有 hreflang + JSON-LD，**没有 FAQPage**；内链把 `/tools/`、`/learn/`、语言切换全串上。
- `/tools/tone-pair-trainer/` 仅 **~794 字符**，但它占住了 tool 意图，并给全站导流 —— **工具页是低成本高杠杆**。
- 明显的联盟属性：`/learn/best-app-to-learn-chinese/`、`/learn/after-hellochinese-what-next/` —— 写榜单评测别的 App 来承接决策期流量。

**它的弱点**
- 页面薄（3k 字符级），没有真正的练习闭环，没有进度留存。
- 我们的单句页有"直答句 + 逐词表 + FAQ + 音频"，**内容密度是压过它的**。

### 2.3 截图里的通用翻译 App

**能力**：任意英文句子 → 中文 + 拼音；朗读；**Alternativas（多种译法）**；收藏 / 分享 / 复制；语言方向 `Inglés ⇄ Chino (simplificado)`；键盘上方给词形变体建议。

**强在哪**：零摩擦。任何需求，输入即得答案，不用先找到"分类"。
**弱在哪**：不留记忆、不给场景、不告诉你"哪句更礼貌/更安全"、没有练习。**用完即忘 —— 这恰恰是学习产品的价值所在。**

**可借鉴**
1. **"输入即得结果"的交互心智** → 我们首页加一个本地搜索框：输入英文，立刻列出匹配短语（中文 + 拼音 + 发音）。纯前端，零后端。
2. **Alternativas** → 每条短语给 2-3 个同义说法 + **语域标注**（更礼貌 / 更随意 / 更本地）。这同时是内容增量：50 条 → 150+ 个可索引句子。
3. **复制 / 分享是标配**：旅行场景里"把中文截图给司机看"是真实动作。
4. **界面是西班牙语** → 有非英语市场在抢同一需求。

---

## 3. 我们现在的家底 vs 缺口

**家底（实测）**：61 条 sitemap URL（1 首页 + 5 分类 + 50 单句 + 5 集合）；50 条短语 × 5 类；quiz 即时反馈 + 结果页高潮；Got it 进度；吸顶进度；TTS；OG 图；61 块 JSON-LD 0 失败；llms.txt；IndexNow；seocheck / linkgraph 两个自检脚本。

**缺口（按"能多快修好"排）**

| # | 缺口 | 证据 | 修的成本 |
|---|---|---|---|
| 1 | 首页说 `works offline`，但没有 `manifest` / `sw.js` | `grep -rn offline app` 只有一句文案；`public/` 无 manifest | 半天 |
| 2 | 没有 `/about/`（E-E-A-T 空档） | 路由只有 `[seo]`、`learn/[category]`、`thank-you` | 半天 |
| 3 | 零中上层内容（无指南带） | 61 条 URL 全是底部意图 | 1-2 周 |
| 4 | 零工具页 | 无 `/tools/*` | 2-3 天 |
| 5 | 无 hreflang / 第二语言 | 家底#2 已确认 | 重（见 P2） |
| 6 | 音是合成 TTS，不是真人 | `AudioButton` 走浏览器语音 | 中（依赖开放语料） |

---

## 4. 建议路线

### P0（本周，1-2 天，先修"承诺"和"入口"）
1. **补真离线**：`app/manifest.webmanifest` + 极简 service worker（缓存 HTML / OG / 图标），首页那句 `works offline` 才算数，顺带拿到"可安装"。
2. **首页即时搜索**：输入英文 → 本地过滤 50 条短语并直接给发音按钮（借翻译 App 的心智，零后端）。
3. **`/about/` 页**：我们是谁、短语怎么选、发音怎么来、数据来源与许可证、联系方式。补 E-E-A-T，也顺手给数据来源留合规位。
4. **每句加 "Also say"（Alternativas）**：`phrases.json` 增 `alts: [{chinese, pinyin, english, register}]`，每句 1-2 条。

### P1（2-4 周，扩意图面 —— 唯一能同时喂饱单句长尾和分类长尾的动作）
5. **短语库 50 → 200**：沿场景继续切 —— 出租车/问路/急诊/药店/支付方式/外卖/砍价/理发/换汇/寄快递/手机卡/地铁。每类 10 句，模板复用 → 直接多出 ~150 个单句页 + ~13 个新分类页。
6. **`/learn/` 指南带 6-8 篇**，骨架照 nihawa 抄（现成短句 → 常见错误 → 5 分钟练法 → 下一步 CTA），每篇往下链短语页。选题按"痛 + 低权威 SERP"挑：
   `chinese-tones`、`pinyin-basics`、`polite-words`、`taking-a-taxi`、`tipping-in-china`、`ordering-food`、`bargaining`、`emergency-phrases`。
   **SERP 已验证**（见 §5），这类词的首页全是内容农场和小站，没有巨头。
7. **`/tools/` 三个工具页**：`phrase-finder`（上面那个搜索，独立成页）、`tone-pair-trainer`（我们已有拼音 + 音频数据）、`pinyin-typing`（数字声调 → 带调拼音）。

### P2（可选，重，先放着）
8. **加一个语言（先西语）**：只翻 UI + 元数据 + 50 句，配 hreflang，观察 3 个月再决定要不要继续。理由：截图那款 App 的界面就是西语，说明需求真实；且两家竞品都靠语言倍乘放大索引面。
9. **TTS 换真人声**：`audio-cmn`（CC BY-SA 3.0）覆盖常用字音，按需加载 + 署名。把 "Hear real pronunciation" 从话术变成事实。

---

## 5. SERP 反查（判断这些词值不值得做）

按"看排前面的是谁"而不是看搜索量：

**`learn chinese tones explained beginner guide`** 的首页构成：
- `linguavoyage.org` ×2 —— 明显的 AI 内容农场
- `wellchinese.com` —— 华文学校站点
- `eduhk.hk` —— 香港教育大学课程页
- `nihawa.com` —— 前面分析过的那个新站

**结论：没有巨头。** 全是内容农场 + 小站 + 一所大学的资料页 → **这是新站唯一有机会的 SERP 类型**，指南带值得写。反过来，`dictionary`/`HSK` 类词（Zitou 的地盘）前排是十几年的老站，别碰。

---

## 6. 不要做的事

| 不做 | 原因 |
|---|---|
| 通用翻译器 | 需要 API/后端/成本，且打不过 Google/Apple，也和我们"不加 AI 功能"的约束冲突 |
| 7,800 页汉字字典 | 那是 Zitou 的护城河，且"的/了/我"这类 SERP 被老站占满 |
| HSK 课程 / 考试 | nihawa 和 Zitou 已占；我们的用户是**要去中国的旅行者**，不是考生 |
| 一开始就做 10 种语言 | Zitou 自己承认 AI 译文可能有错。语言倍乘的代价是质量，先做 1 种做对 |
| 登录 / 订阅 / 单词本 | 已定约束，且"no sign-up"是我们的卖点 |

---

## 7. 真正的瓶颈：权威，不是页数

- 我们外链 ≈ 0。**加页只是入场券，不是解药。** 只有在低权威 SERP 里，"内容与意图的匹配度"本身才能换排名。
- 所以 P1 要配一条并行的"收录"动作，三家竞品都给了现成入口：
  - **z.tou.gg 的 about 页明写接受 partnerships**（Telegram `@toudotgg` / 邮箱）—— 它是同赛道、非英语市场、做开放数据的独立开发者，是最可能的真实连接点。
  - **nihawa 的 `/learn/best-app-to-learn-chinese/`** 本身就是榜单页 —— 这类页面是可以去争取被收录的。
  - 其余按 `directory-link-vetting` 那套流程：**先验 rel 属性再投**，别把时间花在 nofollow 目录上。
- 顺序建议：**先修 P0 的"承诺"（离线/搜索/about）→ 再写 6-8 篇指南 → 同时投 3-5 个真实可投的清单 → 观察 2-3 个月 GSC 表现 → 再决定要不要加语言。**

---

## 附：本次实测的可复现命令

```bash
curl -s https://z.tou.gg/robots.txt
curl -s https://z.tou.gg/sitemap.xml | grep -o "<loc>[^<]*</loc>" | wc -l        # 130
curl -s https://z.tou.gg/sitemap-words.xml | grep -o "<loc>[^<]*</loc>" | wc -l  # 7823
curl -s https://nihawa.com/sitemap.xml | grep -o "<loc>[^<]*</loc>" | wc -l      # 85
```
