/**
 * 内容扩张（2026-09-26）——一次性脚本，保留在仓库里作为「这次加了什么」的审计记录。
 *
 * 做两件事：
 *   1. 替换 4 条负资产短语（slug 零搜索量 / 一页吃两个意图 / 语气生硬）。
 *   2. 按搜索需求「按簇」补 44 条：everyday 10→30、新增 emergency 13、
 *      restaurant 10→14、travel 10→14、shopping 10→13。合计 50 → 94。
 *
 * 用法：<managed node> _dev/expand-content-2026-09-26.js
 * 之后必须跑 _dev/make-audio.py --force 与 _dev/normalize-audio.py。
 */
const fs = require("fs");
const path = require("path");

const FILE = path.join(__dirname, "..", "data", "phrases.json");
const phrases = JSON.parse(fs.readFileSync(FILE, "utf8"));

const w = (zh, py, en) => ({ zh, py, en });

// ---------- 1. 替换负资产 ----------
const replacements = {
  40: {
    chinese: `打折吗？`,
    pinyin: `Dǎzhé ma?`,
    english: `Is there a discount?`,
    tip: `打折 means to give a discount. Big malls have fixed prices — ask this in markets, small shops and tourist streets, where a polite ask often works.`,
    words: [w(`打折`, `dǎzhé`, `to give a discount`), w(`吗`, `ma`, `yes/no question particle`)],
  },
  44: {
    chinese: `不客气。`,
    pinyin: `Bú kèqi.`,
    english: `You're welcome.`,
    tip: `The standard reply to 谢谢. 客气 literally means "to stand on ceremony", so 不客气 is "don't be so polite".`,
    words: [w(`不`, `bù`, `not`), w(`客气`, `kèqi`, `polite / formal`)],
  },
  47: {
    chinese: `你叫什么名字？`,
    pinyin: `Nǐ jiào shénme míngzi?`,
    english: `What's your name?`,
    tip: `Answer with 我叫… (wǒ jiào…) plus your name. To give your surname politely, say 我姓… (wǒ xìng…).`,
    words: [
      w(`你`, `nǐ`, `you`),
      w(`叫`, `jiào`, `to be called`),
      w(`什么`, `shénme`, `what`),
      w(`名字`, `míngzi`, `name`),
    ],
  },
  50: {
    chinese: `不好意思。`,
    pinyin: `Bù hǎoyìsi.`,
    english: `Excuse me.`,
    tip: `The most useful two-syllable phrase in China: it gets attention, makes a light apology, and softens a refusal. Use it before a question or when you squeeze past someone.`,
    words: [w(`不`, `bù`, `not`), w(`好意思`, `hǎoyìsi`, `to feel embarrassed / to have the nerve`)],
  },
};

// ---------- 2. 按簇补内容 ----------
const additions = [
  // ===== Restaurant 10 → 14 =====
  {
    id: 51, category: `restaurant`, chinese: `有什么推荐？`, pinyin: `Yǒu shénme tuījiàn?`,
    english: `What do you recommend?`,
    tip: `推荐 means to recommend. Ask it and the server will usually point at one or two dishes — the fastest way to eat well without reading a long menu.`,
    words: [w(`有`, `yǒu`, `to have`), w(`什么`, `shénme`, `what`), w(`推荐`, `tuījiàn`, `to recommend`)],
  },
  {
    id: 52, category: `restaurant`, chinese: `我吃素。`, pinyin: `Wǒ chī sù.`,
    english: `I'm vegetarian.`,
    tip: `素 means vegetarian. In a noisy restaurant 素 is easy to miss, so add 不要肉 ("no meat") if you want to be certain.`,
    words: [w(`我`, `wǒ`, `I / me`), w(`吃`, `chī`, `to eat`), w(`素`, `sù`, `vegetarian`)],
  },
  {
    id: 53, category: `restaurant`, chinese: `可以加饭吗？`, pinyin: `Kěyǐ jiā fàn ma?`,
    english: `Can I get more rice?`,
    tip: `Rice refills are usually free. 加 means to add, so the same pattern gives you 加汤 (more soup) or 加水 (more water).`,
    words: [
      w(`可以`, `kěyǐ`, `can / may`),
      w(`加`, `jiā`, `to add`),
      w(`饭`, `fàn`, `rice / meal`),
      w(`吗`, `ma`, `yes/no question particle`),
    ],
  },
  {
    id: 54, category: `restaurant`, chinese: `太辣了！`, pinyin: `Tài là le!`,
    english: `This is too spicy!`,
    tip: `Unlike 不要辣 (said when ordering), this one is for food that is already on the table. 太…了 is the "too much" frame — 太贵了 works the same way.`,
    words: [w(`太`, `tài`, `too / so`), w(`辣`, `là`, `spicy`), w(`了`, `le`, `change-of-state particle`)],
  },

  // ===== Travel 10 → 14 =====
  {
    id: 55, category: `travel`, chinese: `请带我去这个地址。`, pinyin: `Qǐng dài wǒ qù zhège dìzhǐ.`,
    english: `Please take me to this address.`,
    tip: `The sentence that makes taxis easy: show the address on your phone and read it out. 带 means to take someone somewhere.`,
    words: [
      w(`请`, `qǐng`, `please`),
      w(`带`, `dài`, `to take / to bring`),
      w(`我`, `wǒ`, `me`),
      w(`去`, `qù`, `to go`),
      w(`这个`, `zhège`, `this`),
      w(`地址`, `dìzhǐ`, `address`),
    ],
  },
  {
    id: 56, category: `travel`, chinese: `多久能到？`, pinyin: `Duōjiǔ néng dào?`,
    english: `How long does it take to get there?`,
    tip: `Ask before you get in, not after. 多久 asks about a length of time; 几点 asks what time (on the clock).`,
    words: [w(`多久`, `duōjiǔ`, `how long`), w(`能`, `néng`, `can / to be able to`), w(`到`, `dào`, `to arrive`)],
  },
  {
    id: 57, category: `travel`, chinese: `我的手机没电了。`, pinyin: `Wǒ de shǒujī méi diàn le.`,
    english: `My phone is dead.`,
    tip: `没电 literally means "no electricity". Useful when you need to show a map, charge your phone or pay — nearly every payment in China runs through a phone.`,
    words: [
      w(`我`, `wǒ`, `I / me`),
      w(`的`, `de`, `possessive particle`),
      w(`手机`, `shǒujī`, `mobile phone`),
      w(`没电`, `méi diàn`, `out of battery`),
      w(`了`, `le`, `change-of-state particle`),
    ],
  },
  {
    id: 58, category: `travel`, chinese: `可以帮我拍张照片吗？`, pinyin: `Kěyǐ bāng wǒ pāi zhāng zhàopiàn ma?`,
    english: `Can you take a photo of me?`,
    tip: `Hand your phone over first, then ask. 张 is the measure word for photos — 拍张照片 is "take a photo", 拍照 is the general verb.`,
    words: [
      w(`可以`, `kěyǐ`, `can / may`),
      w(`帮`, `bāng`, `to help`),
      w(`我`, `wǒ`, `me`),
      w(`拍`, `pāi`, `to take (a photo)`),
      w(`照片`, `zhàopiàn`, `photo`),
      w(`吗`, `ma`, `yes/no question particle`),
    ],
  },

  // ===== Shopping 10 → 13 =====
  {
    id: 59, category: `shopping`, chinese: `有大号的吗？`, pinyin: `Yǒu dàhào de ma?`,
    english: `Do you have a larger size?`,
    tip: `大号 = large, 中号 = medium, 小号 = small. Swap 大 for 小 and you already have the other question.`,
    words: [
      w(`有`, `yǒu`, `to have`),
      w(`大号`, `dàhào`, `large size`),
      w(`的`, `de`, `one / the ... one`),
      w(`吗`, `ma`, `yes/no question particle`),
    ],
  },
  {
    id: 60, category: `shopping`, chinese: `可以退税吗？`, pinyin: `Kěyǐ tuìshuì ma?`,
    english: `Can I get a tax refund?`,
    tip: `Only shops with a 退税 sign can do this, and you need to spend at least 500 yuan in one store on one day. Bring your passport — the refund happens at the airport.`,
    words: [w(`可以`, `kěyǐ`, `can / may`), w(`退税`, `tuìshuì`, `tax refund`), w(`吗`, `ma`, `yes/no question particle`)],
  },
  {
    id: 61, category: `shopping`, chinese: `收现金吗？`, pinyin: `Shōu xiànjīn ma?`,
    english: `Do you take cash?`,
    tip: `In China the question is usually the other way round — many places prefer 微信 or 支付宝. Ask before you queue, and keep some cash for small stalls and taxis.`,
    words: [w(`收`, `shōu`, `to accept / to receive`), w(`现金`, `xiànjīn`, `cash`), w(`吗`, `ma`, `yes/no question particle`)],
  },

  // ===== Everyday 10 → 30 =====
  {
    id: 62, category: `everyday`, chinese: `是。`, pinyin: `Shì.`,
    english: `Yes.`,
    tip: `Chinese rarely answers with a bare yes — it repeats the verb instead: 是 (it is), 有 (I have), 可以 (sure). 对 (duì) means "correct" and is what you'll hear most.`,
    words: [w(`是`, `shì`, `to be / yes`)],
  },
  {
    id: 63, category: `everyday`, chinese: `不是。`, pinyin: `Bú shì.`,
    english: `No.`,
    tip: `不是 negates 是 only. For "I don't have it" say 没有 (méiyǒu), and for a flat refusal 不用了，谢谢.`,
    words: [w(`不`, `bù`, `not`), w(`是`, `shì`, `to be`)],
  },
  {
    id: 64, category: `everyday`, chinese: `请问`, pinyin: `Qǐngwèn`,
    english: `May I ask?`,
    tip: `Drop 请问 in front of any question and it instantly sounds polite — literally "please may I ask". Every local does this in shops and station queues.`,
    words: [w(`请`, `qǐng`, `please`), w(`问`, `wèn`, `to ask`)],
  },
  {
    id: 65, category: `everyday`, chinese: `早上好。`, pinyin: `Zǎoshang hǎo.`,
    english: `Good morning.`,
    tip: `Before roughly 10 a.m. 你好 works at any hour, but 早上好 sounds warmer in the morning — shopkeepers and hotel staff notice the difference.`,
    words: [w(`早上`, `zǎoshang`, `morning`), w(`好`, `hǎo`, `good`)],
  },
  {
    id: 66, category: `everyday`, chinese: `晚安。`, pinyin: `Wǎn'ān.`,
    english: `Good night.`,
    tip: `Only for going to sleep or leaving late. When you arrive somewhere at night, the greeting is 晚上好 (wǎnshang hǎo) — a different phrase.`,
    words: [w(`晚`, `wǎn`, `late / evening`), w(`安`, `ān`, `peace / safe`)],
  },
  {
    id: 67, category: `everyday`, chinese: `好的。`, pinyin: `Hǎo de.`,
    english: `Okay.`,
    tip: `好 alone works too, but 好的 sounds friendlier and softer — the one to use with staff, drivers and hosts.`,
    words: [w(`好`, `hǎo`, `good`), w(`的`, `de`, `particle`)],
  },
  {
    id: 68, category: `everyday`, chinese: `我不知道。`, pinyin: `Wǒ bù zhīdào.`,
    english: `I don't know.`,
    tip: `Different from 我不懂 ("I don't understand"). This one means "I have no idea" — say it and people will usually point you to someone else.`,
    words: [w(`我`, `wǒ`, `I / me`), w(`不`, `bù`, `not`), w(`知道`, `zhīdào`, `to know`)],
  },
  {
    id: 69, category: `everyday`, chinese: `我中文说得不好。`, pinyin: `Wǒ Zhōngwén shuō de bù hǎo.`,
    english: `My Chinese isn't good.`,
    tip: `Say it early and people switch to simpler Chinese or write things down instead of giving up on you mid-sentence.`,
    words: [
      w(`我`, `wǒ`, `I / me`),
      w(`中文`, `Zhōngwén`, `Chinese language`),
      w(`说`, `shuō`, `to speak`),
      w(`得`, `de`, `degree particle`),
      w(`不好`, `bù hǎo`, `not good`),
    ],
  },
  {
    id: 70, category: `everyday`, chinese: `你会说英语吗？`, pinyin: `Nǐ huì shuō Yīngyǔ ma?`,
    english: `Do you speak English?`,
    tip: `会 is about a learned skill. Swap it for 能 and the question shifts from "do you speak English?" to "could you say it in English?".`,
    words: [
      w(`你`, `nǐ`, `you`),
      w(`会`, `huì`, `can / to know how to`),
      w(`说`, `shuō`, `to speak`),
      w(`英语`, `Yīngyǔ`, `English`),
      w(`吗`, `ma`, `yes/no question particle`),
    ],
  },
  {
    id: 71, category: `everyday`, chinese: `请说慢一点。`, pinyin: `Qǐng shuō màn yìdiǎn.`,
    english: `Please speak more slowly.`,
    tip: `一点 means "a little" and softens the request — a bare 说慢 sounds like an order. Same pattern: 便宜一点 (a bit cheaper).`,
    words: [
      w(`请`, `qǐng`, `please`),
      w(`说`, `shuō`, `to speak`),
      w(`慢`, `màn`, `slow`),
      w(`一点`, `yìdiǎn`, `a little`),
    ],
  },
  {
    id: 72, category: `everyday`, chinese: `请写下来。`, pinyin: `Qǐng xiě xiàlái.`,
    english: `Please write it down.`,
    tip: `The most useful sentence when you are stuck. People write faster than they can explain, and characters you can copy are characters you can look up.`,
    words: [w(`请`, `qǐng`, `please`), w(`写`, `xiě`, `to write`), w(`下来`, `xiàlái`, `down / on paper`)],
  },
  {
    id: 73, category: `everyday`, chinese: `我爱你。`, pinyin: `Wǒ ài nǐ.`,
    english: `I love you.`,
    tip: `For partners and family. Between friends Chinese says 我很喜欢你 ("I really like you") — 爱 is strong and saying it casually can land oddly.`,
    words: [w(`我`, `wǒ`, `I / me`), w(`爱`, `ài`, `to love`), w(`你`, `nǐ`, `you`)],
  },
  {
    id: 74, category: `everyday`, chinese: `干杯！`, pinyin: `Gānbēi!`,
    english: `Cheers!`,
    tip: `Literally "dry the glass". Say it as the glasses meet — and in China you are expected to actually drink when someone toasts you, so pour accordingly.`,
    words: [w(`干`, `gān`, `dry / to drain`), w(`杯`, `bēi`, `glass / cup`)],
  },
  {
    id: 75, category: `everyday`, chinese: `生日快乐！`, pinyin: `Shēngrì kuàilè!`,
    english: `Happy birthday!`,
    tip: `快乐 is the "happy" in every greeting: swap the front and you get 新年快乐 (Happy New Year) and 节日快乐 (Happy holidays).`,
    words: [w(`生日`, `shēngrì`, `birthday`), w(`快乐`, `kuàilè`, `happy`)],
  },
  {
    id: 76, category: `everyday`, chinese: `没关系。`, pinyin: `Méi guānxi.`,
    english: `It's fine.`,
    tip: `The standard reply to 对不起 (sorry) — and what you say when someone apologises for bumping into you. Not to be confused with 不客气, which replies to thank you.`,
    words: [w(`没`, `méi`, `not have`), w(`关系`, `guānxi`, `matter / relation`)],
  },
  {
    id: 77, category: `everyday`, chinese: `请等一下。`, pinyin: `Qǐng děng yíxià.`,
    english: `Please wait a moment.`,
    tip: `一下 softens a request the way "just" does in English — 等 alone sounds abrupt, 等一下 is what you'll hear all day in China.`,
    words: [w(`请`, `qǐng`, `please`), w(`等`, `děng`, `to wait`), w(`一下`, `yíxià`, `a moment`)],
  },
  {
    id: 78, category: `everyday`, chinese: `不用了，谢谢。`, pinyin: `Bú yòng le, xièxie.`,
    english: `No thanks.`,
    tip: `The polite way to turn down touts, taxi drivers and street sellers. 不用 literally means "no need" — firmer than it sounds, and it ends the conversation cleanly.`,
    words: [
      w(`不用`, `bú yòng`, `no need`),
      w(`了`, `le`, `particle`),
      w(`谢谢`, `xièxie`, `thank you`),
    ],
  },
  {
    id: 79, category: `everyday`, chinese: `认识你很高兴。`, pinyin: `Rènshi nǐ hěn gāoxìng.`,
    english: `Nice to meet you.`,
    tip: `Literally "knowing you is very happy". On business cards and at formal meetings you'll also see the short version 幸会 (xìnghuì).`,
    words: [
      w(`认识`, `rènshi`, `to know someone`),
      w(`你`, `nǐ`, `you`),
      w(`很`, `hěn`, `very`),
      w(`高兴`, `gāoxìng`, `happy`),
    ],
  },
  {
    id: 80, category: `everyday`, chinese: `我是游客。`, pinyin: `Wǒ shì yóukè.`,
    english: `I'm a tourist.`,
    tip: `Said early, it buys patience — it explains your accent before anyone has to guess, and people slow down for you.`,
    words: [w(`我`, `wǒ`, `I / me`), w(`是`, `shì`, `to be`), w(`游客`, `yóukè`, `tourist`)],
  },
  {
    id: 81, category: `everyday`, chinese: `太棒了！`, pinyin: `Tài bàng le!`,
    english: `That's great!`,
    tip: `太…了 is the "so / too …" frame. 棒 means excellent — the same frame with a different adjective gives you 太好了 (that's great) and 太辣了 (too spicy).`,
    words: [w(`太`, `tài`, `too / so`), w(`棒`, `bàng`, `great / excellent`), w(`了`, `le`, `particle`)],
  },

  // ===== Emergency（新增分类）13 条 =====
  {
    id: 82, category: `emergency`, chinese: `救命！`, pinyin: `Jiùmìng!`,
    english: `Help!`,
    tip: `Only for real danger — 救命 literally means "save my life". For a small favour use 我需要帮助 instead.`,
    words: [w(`救`, `jiù`, `to save`), w(`命`, `mìng`, `life`)],
  },
  {
    id: 83, category: `emergency`, chinese: `我需要帮助。`, pinyin: `Wǒ xūyào bāngzhù.`,
    english: `I need help.`,
    tip: `Calmer and more general than 救命. 需要 is "to need" — reuse the frame as 我需要看医生 or 我需要一张地图.`,
    words: [w(`我`, `wǒ`, `I / me`), w(`需要`, `xūyào`, `to need`), w(`帮助`, `bāngzhù`, `help`)],
  },
  {
    id: 84, category: `emergency`, chinese: `请叫警察。`, pinyin: `Qǐng jiào jǐngchá.`,
    english: `Please call the police.`,
    tip: `China's emergency numbers: 110 police, 120 ambulance, 119 fire. All three are free from any phone, including a locked one.`,
    words: [w(`请`, `qǐng`, `please`), w(`叫`, `jiào`, `to call`), w(`警察`, `jǐngchá`, `police`)],
  },
  {
    id: 85, category: `emergency`, chinese: `请叫救护车。`, pinyin: `Qǐng jiào jiùhùchē.`,
    english: `Please call an ambulance.`,
    tip: `救护车 is the ambulance and 120 is its number. If words fail completely, saying "one-two-zero" out loud is understood everywhere.`,
    words: [w(`请`, `qǐng`, `please`), w(`叫`, `jiào`, `to call`), w(`救护车`, `jiùhùchē`, `ambulance`)],
  },
  {
    id: 86, category: `emergency`, chinese: `我迷路了。`, pinyin: `Wǒ mílù le.`,
    english: `I'm lost.`,
    tip: `迷路 means to lose your way. Show the Chinese name of your hotel on your phone while you say it — names are far more reliable than directions.`,
    words: [w(`我`, `wǒ`, `I / me`), w(`迷路`, `mílù`, `to get lost`), w(`了`, `le`, `change-of-state particle`)],
  },
  {
    id: 87, category: `emergency`, chinese: `医院在哪里？`, pinyin: `Yīyuàn zài nǎlǐ?`,
    english: `Where is the hospital?`,
    tip: `The same 在哪里 pattern as 厕所在哪里. Swap in 药店 (pharmacy) or 派出所 (local police station) and you are covered.`,
    words: [
      w(`医院`, `yīyuàn`, `hospital`),
      w(`在`, `zài`, `to be located at`),
      w(`哪里`, `nǎlǐ`, `where`),
    ],
  },
  {
    id: 88, category: `emergency`, chinese: `我需要看医生。`, pinyin: `Wǒ xūyào kàn yīshēng.`,
    english: `I need to see a doctor.`,
    tip: `In China you usually go straight to a hospital's 急诊 (emergency department) rather than booking an appointment with a clinic.`,
    words: [
      w(`我`, `wǒ`, `I / me`),
      w(`需要`, `xūyào`, `to need`),
      w(`看`, `kàn`, `to see`),
      w(`医生`, `yīshēng`, `doctor`),
    ],
  },
  {
    id: 89, category: `emergency`, chinese: `我过敏。`, pinyin: `Wǒ guòmǐn.`,
    english: `I'm allergic.`,
    tip: `Add the thing with 对…过敏: 我对花生过敏. Say it before you order, and show it written down — in a busy kitchen it is easy to lose.`,
    words: [w(`我`, `wǒ`, `I / me`), w(`过敏`, `guòmǐn`, `to be allergic`)],
  },
  {
    id: 90, category: `emergency`, chinese: `我对花生过敏。`, pinyin: `Wǒ duì huāshēng guòmǐn.`,
    english: `I'm allergic to peanuts.`,
    tip: `Swap 花生 for 海鲜 (seafood), 牛奶 (milk) or 坚果 (nuts). Watch for 花生油 (peanut oil) too — it is common in Chinese cooking.`,
    words: [
      w(`我`, `wǒ`, `I / me`),
      w(`对`, `duì`, `towards / to`),
      w(`花生`, `huāshēng`, `peanut`),
      w(`过敏`, `guòmǐn`, `to be allergic`),
    ],
  },
  {
    id: 91, category: `emergency`, chinese: `我生病了。`, pinyin: `Wǒ shēngbìng le.`,
    english: `I'm sick.`,
    tip: `了 marks the change — you were fine before and you are not now. If it is a fever, 我发烧 (wǒ fāshāo) is more specific and gets you seen faster.`,
    words: [
      w(`我`, `wǒ`, `I / me`),
      w(`生病`, `shēngbìng`, `to get sick`),
      w(`了`, `le`, `change-of-state particle`),
    ],
  },
  {
    id: 92, category: `emergency`, chinese: `我的护照丢了。`, pinyin: `Wǒ de hùzhào diū le.`,
    english: `I lost my passport.`,
    tip: `File a police report (报警) before you contact your embassy — the replacement needs that paper, and it is also what your insurance will ask for.`,
    words: [
      w(`我`, `wǒ`, `I / me`),
      w(`的`, `de`, `possessive particle`),
      w(`护照`, `hùzhào`, `passport`),
      w(`丢`, `diū`, `to lose`),
      w(`了`, `le`, `change-of-state particle`),
    ],
  },
  {
    id: 93, category: `emergency`, chinese: `我的钱包被偷了。`, pinyin: `Wǒ de qiánbāo bèi tōu le.`,
    english: `My wallet was stolen.`,
    tip: `被 marks the passive voice — literally "my wallet was stolen". If you simply lost it, use 丢了 instead: 我的钱包丢了.`,
    words: [
      w(`我`, `wǒ`, `I / me`),
      w(`的`, `de`, `possessive particle`),
      w(`钱包`, `qiánbāo`, `wallet`),
      w(`被`, `bèi`, `passive voice marker`),
      w(`偷`, `tōu`, `to steal`),
      w(`了`, `le`, `change-of-state particle`),
    ],
  },
  {
    id: 94, category: `emergency`, chinese: `这附近有药店吗？`, pinyin: `Zhè fùjìn yǒu yàodiàn ma?`,
    english: `Is there a pharmacy nearby?`,
    tip: `Chinese pharmacies are 药店 and are marked with a green cross. 附近 means "nearby" and slots in front of any place you need.`,
    words: [
      w(`这`, `zhè`, `this`),
      w(`附近`, `fùjìn`, `nearby`),
      w(`有`, `yǒu`, `to have / is there`),
      w(`药店`, `yàodiàn`, `pharmacy`),
      w(`吗`, `ma`, `yes/no question particle`),
    ],
  },
];

// ---------- 3. 应用 ----------
let replaced = 0;
for (const p of phrases) {
  const r = replacements[p.id];
  if (!r) continue;
  replaced += 1;
  p.chinese = r.chinese;
  p.pinyin = r.pinyin;
  p.english = r.english;
  p.tip = r.tip;
  p.words = r.words;
}

const existingIds = new Set(phrases.map((p) => p.id));
const dupes = additions.filter((p) => existingIds.has(p.id));
if (dupes.length) throw new Error("id 冲突：" + dupes.map((p) => p.id).join(","));

const merged = [...phrases, ...additions];

// 校验：id 唯一、字段齐全、逐词表非空
const seen = new Set();
for (const p of merged) {
  if (seen.has(p.id)) throw new Error("重复 id " + p.id);
  seen.add(p.id);
  for (const key of ["id", "category", "chinese", "pinyin", "english", "tip", "words"]) {
    if (p[key] === undefined || p[key] === null) throw new Error(`id ${p.id} 缺字段 ${key}`);
  }
  if (!Array.isArray(p.words) || !p.words.length) throw new Error(`id ${p.id} 没有逐词表`);
  for (const word of p.words) {
    if (!word.zh || !word.py || !word.en) throw new Error(`id ${p.id} 的逐词条目不完整`);
  }
}

// ---------- 4. 按现有排版风格写回 ----------
const blocks = merged.map((p) => {
  const head =
    `  { "id": ${p.id}, "category": ${JSON.stringify(p.category)}, ` +
    `"chinese": ${JSON.stringify(p.chinese)}, "pinyin": ${JSON.stringify(p.pinyin)}, ` +
    `"english": ${JSON.stringify(p.english)}, "audio": null,`;
  const tip = `    "tip": ${JSON.stringify(p.tip)},`;
  const words =
    `    "words": [${p.words
      .map((x) => `{ "zh": ${JSON.stringify(x.zh)}, "py": ${JSON.stringify(x.py)}, "en": ${JSON.stringify(x.en)} }`)
      .join(", ")}] }`;
  return [head, tip, words].join("\n");
});

fs.writeFileSync(FILE, `[\n${blocks.join(",\n\n")}\n]\n`, "utf8");

const byCat = {};
for (const p of merged) byCat[p.category] = (byCat[p.category] || 0) + 1;
console.log(`替换 ${replaced} 条，新增 ${additions.length} 条，总计 ${merged.length} 条`);
console.log(JSON.stringify(byCat, null, 1));
